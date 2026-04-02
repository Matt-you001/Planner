import React, { useEffect } from 'react';
import './global.css';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, GanttChart, LayoutDashboard, Bot } from 'lucide-react-native';
import { AuthProvider } from './src/context/AuthContext';
import { CelebrationProvider } from './src/context/CelebrationContext';
import DashboardScreen from './src/screens/DashboardScreen';
import PlansScreen from './src/screens/PlansScreen';
import GoalDetailsScreen from './src/screens/GoalDetailsScreen';
import CreatePlanScreen from './src/screens/CreatePlanScreen';
import CreateTaskScreen from './src/screens/CreateTaskScreen';
import PlanSetupScreen from './src/screens/PlanSetupScreen';
import PlanIsolateScreen from './src/screens/PlanIsolateScreen';
import PlanStackScreen from './src/screens/PlanStackScreen';
import AiCoachScreen from './src/screens/AiCoachScreen';
import ReviewYesterdayScreen from './src/screens/ReviewYesterdayScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import * as Notifications from 'expo-notifications';
import { launchApp } from './src/services/InstalledApps';
import { Linking, Platform } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

const BACKGROUND_FETCH_TASK = 'background-app-launcher';

// Define the background task
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  // Note: Background Launching of other apps is restricted on Android 10+.
  // This task is mainly to ensure the app wakes up or processes data.
  // Realistically, the Notification is the primary way to interact in background.
  // But we can try to keep the app alive.
  try {
    const now = new Date();
    // console.log(`Background fetch executed at ${now.toISOString()}`);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Configure notifications to be immediate and high priority
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Tab = createBottomTabNavigator();
const PlansStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0ea5e9', // primary color (sky-500 approx)
        tabBarInactiveTintColor: 'gray',
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tab.Screen 
        name="PlansList" 
        component={PlansScreen}
        options={{
          tabBarIcon: ({ color, size }) => <GanttChart color={color} size={size} />,
          title: 'Plans'
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  useEffect(() => {
      // Define Notification Categories (Action Buttons)
      Notifications.setNotificationCategoryAsync('linked-app-reminder', [
          {
              identifier: 'ACCEPT',
              buttonTitle: 'Open App',
              options: { opensAppToForeground: true }, // Bring app to front to handle logic
          },
          {
              identifier: 'DISMISS',
              buttonTitle: 'Dismiss',
              options: { isDestructive: true },
          },
      ]);

      Notifications.setNotificationCategoryAsync('default-reminder', [
          {
              identifier: 'DISMISS',
              buttonTitle: 'Dismiss',
              options: { isDestructive: true },
          },
      ]);
  }, []);

  useEffect(() => {
    // Request permissions on app start
    async function requestPermissions() {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }
    }
    requestPermissions();

    // Global Notification Listener
    const subscription = Notifications.addNotificationResponseReceivedListener(async response => {
      const linkedApp = response.notification.request.content.data?.linkedApp;
      const actionIdentifier = response.actionIdentifier;

      // Always dismiss the notification first
      await Notifications.dismissNotificationAsync(response.notification.request.identifier);

      if (linkedApp) {
        console.log(`[Global] Notification interaction: ${actionIdentifier}`);
        
        // Handle "Open App" button click OR regular body tap
        if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER || actionIdentifier === 'ACCEPT') {
             // 1. Try Native Launch (Package Name)
            if (Platform.OS === 'android' && !linkedApp.includes(':')) {
                const launched = launchApp(linkedApp);
                if (launched) return;
            }

            // 2. Try Deep Link
            Linking.openURL(linkedApp).catch(err => console.warn('Failed to open linked app', err));
        }
      }
      // If actionIdentifier is 'DISMISS', it's already dismissed by the dismissNotificationAsync above (or by system)
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Register background fetch
    async function registerBackgroundFetchAsync() {
      try {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
          minimumInterval: 60 * 15, // 15 minutes (Minimum allowed by iOS/Android)
          stopOnTerminate: false, // Continue even if app is killed (on Android)
          startOnBoot: true, // Restart on device boot
        });
        // console.log("Background fetch registered");
      } catch (err) {
        console.log("Background Fetch failed to register", err);
      }
    }
    registerBackgroundFetchAsync();
  }, []);

  return (
    <AuthProvider>
      <CelebrationProvider>
        <NavigationContainer>
          <RootStack.Navigator screenOptions={{ headerShown: false }}>
            <RootStack.Screen name="MainTabs" component={TabNavigator} />
            <RootStack.Screen name="CreatePlan" component={CreatePlanScreen} />
            <RootStack.Screen name="CreateTask" component={CreateTaskScreen} />
            <RootStack.Screen name="PlanSetup" component={PlanSetupScreen} />
            <RootStack.Screen name="PlanIsolate" component={PlanIsolateScreen} />
            <RootStack.Screen name="PlanStack" component={PlanStackScreen} />
            <RootStack.Screen name="GoalDetails" component={GoalDetailsScreen} />
            <RootStack.Screen name="ReviewYesterday" component={ReviewYesterdayScreen} />
            <RootStack.Screen name="AiCoach" component={AiCoachScreen} />
            <RootStack.Screen name="Settings" component={SettingsScreen} />
          </RootStack.Navigator>
        </NavigationContainer>
      </CelebrationProvider>
    </AuthProvider>
  );
}
