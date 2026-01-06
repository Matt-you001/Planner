import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Linking, TouchableOpacity, Modal, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { launchApp } from '../services/InstalledApps';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import ActionItem from '../components/ActionItem';
import type { System, Task, WithId } from '../lib/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DataService } from '../lib/DataService';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Plus, X, Calendar, CheckSquare, LogOut, Layers, ClipboardList, Clock, Zap } from 'lucide-react-native';
import { useCelebration } from '../context/CelebrationContext';

type Action = WithId<System> | WithId<Task>;

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const { celebrate } = useCelebration();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  // Secondary state for "Create a Plan" sub-selection
  const [showCreatePlanOptions, setShowCreatePlanOptions] = useState(false);

  // Track which apps we've already auto-opened this session
  const openedActionsRef = useRef<Set<string>>(new Set());

  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    setIsDataLoading(true);
    const [fetchedTasks, fetchedSystems] = await Promise.all([
        DataService.getTasks(user.uid, undefined, today),
        DataService.getSystems(user.uid, undefined, today)
    ]);
    setTasks(fetchedTasks);
    setSystems(fetchedSystems);
    setIsDataLoading(false);
  }, [user, today]);

  useFocusEffect(
    useCallback(() => {
        loadDashboardData();
    }, [loadDashboardData])
  );

  const upcomingActions = useMemo(() => {
    const allActions: Action[] = [...(systems || []), ...(tasks || [])];
    return allActions.sort((a, b) => {
      const dateComparison = a.date.localeCompare(b.date);
      if (dateComparison !== 0) return dateComparison;
      return (a.startTime || '23:59').localeCompare(b.startTime || '23:59');
    });
  }, [systems, tasks]);

  const dailyProgress = useMemo(() => {
    const allActions = [...(systems || []), ...(tasks || [])];
    if (allActions.length === 0) return { percentage: 0, message: "No activities today" };
    
    const completed = allActions.filter(a => a.isCompleted).length;
    const percentage = Math.round((completed / allActions.length) * 100);
    
    let message = "Let's start!";
    if (percentage > 0 && percentage <= 25) message = "Good start!";
    else if (percentage > 25 && percentage <= 50) message = "Making progress!";
    else if (percentage > 50 && percentage <= 75) message = "Keep going!";
    else if (percentage > 75 && percentage < 100) message = "Almost there!";
    else if (percentage === 100) message = "Excellent! All done!";
    
    return { percentage, message };
  }, [systems, tasks]);

  // Handle notification response (Background/Foreground tap)
  // MOVED TO App.js for Global Handling
  /*
  useEffect(() => {
    // ...
  }, []);
  */

  // Auto-Open Linked Apps Logic (Reverted: Uses interval to check for start time)
  useEffect(() => {
    const interval = setInterval(() => {
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const nowInMins = currentHours * 60 + currentMinutes;
        
        upcomingActions.forEach(action => {
            // Check if action has a linked app and hasn't been opened yet
            if (action.linkedApp && !openedActionsRef.current.has(action.id)) {
                if (!action.startTime) return;
                
                const [h, m] = action.startTime.split(':').map(Number);
                const actionDate = new Date();
                actionDate.setHours(h, m, 0, 0); // Start Time EXACTLY
                
                const nowTime = now.getTime();
                const triggerTime = actionDate.getTime();

                // Window of 60 seconds (since interval is 10s, this is safe)
                // We check if "now" is within [Start Time, Start Time + 60s]
                if (nowTime >= triggerTime && nowTime <= triggerTime + 60000) {
                    console.log(`Auto-opening app for action: ${action.title}`);
                    let url = action.linkedApp;

                    // If it looks like a package name (no scheme), try to launch it via native intent
                    if (!url.includes(':')) {
                         const launched = launchApp(url);
                         if (launched) {
                             console.log(`Successfully launched package: ${url}`);
                             openedActionsRef.current.add(action.id);
                             return; // Skip Linking.openURL
                         }
                    }
                    
                    Linking.openURL(url).catch(err => {
                        console.warn(`Failed to open linked app: ${url}`, err);
                    });
                    openedActionsRef.current.add(action.id);
                }
            }
        });
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [upcomingActions]);

  const handleActionChange = async (action: Action, newValues: { isCompleted?: boolean; successPercentage?: number }) => {
    if (!user) return;

    // Optimistic update
    let updatedSystems = systems;
    let updatedTasks = tasks;

    if ('goalTitle' in action) {
        updatedSystems = systems.map(s => s.id === action.id ? { ...s, ...newValues } : s);
        setSystems(updatedSystems);
        await DataService.updateSystem(user.uid, action.id, newValues);
    } else {
        updatedTasks = tasks.map(t => t.id === action.id ? { ...t, ...newValues } : t);
        setTasks(updatedTasks);
        await DataService.updateTask(user.uid, action.id, newValues);
    }

    // Check for celebration: "All Day's Activities Done"
    if (newValues.isCompleted) {
        const allSystemsDone = updatedSystems.every(s => s.isCompleted);
        const allTasksDone = updatedTasks.every(t => t.isCompleted);
        
        if (allSystemsDone && allTasksDone && (updatedSystems.length + updatedTasks.length) > 0) {
            celebrate('all_daily_done', 'You have completed all your activities for today!');
        }

        // Check for celebration: "Goal 100% Executed"
        if ('goalId' in action && action.goalId) {
            const goalProgress = await DataService.calculateGoalProgress(user.uid, action.goalId);
            if (goalProgress === 100) {
                celebrate('goal_completed', `Congratulations! You've achieved 100% on this goal.`);
            }
        }
    }
  };

  const isLoading = isAuthLoading || isDataLoading;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200">
        <View>
            <Text className="text-2xl font-bold text-gray-900">Today's Dashboard</Text>
            <Text className="text-sm text-gray-500">Your upcoming activities and one-off tasks.</Text>
        </View>
        <TouchableOpacity  
            className="flex-row items-center justify-center rounded-md bg-sky-500 px-3 py-2"
            onPress={() => setModalVisible(true)}
        >
            <Plus size={20} color="white" />
            <Text className="ml-1 font-medium text-white">New</Text>
        </TouchableOpacity>
      </View>

      {/* Daily Progress Tracker */}
      <View className="px-4 pt-4 pb-2">
        <View className="mb-2 flex-row justify-between items-center">
            <Text className="text-sm font-bold text-gray-700">Daily Progress</Text>
            <Text className="text-xs font-medium text-sky-600">{dailyProgress.message}</Text>
        </View>
        <View className="h-4 w-full rounded-full bg-gray-200 overflow-hidden">
            <View 
                className="h-full bg-sky-500 rounded-full" 
                style={{ width: `${dailyProgress.percentage}%` }} 
            />
        </View>
        <Text className="mt-1 text-right text-xs text-gray-500">{dailyProgress.percentage}%</Text>
      </View>

      <ScrollView 
        className="flex-1 px-4 pt-4"
        refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={loadDashboardData} />
        }
      >
        {!isLoading && upcomingActions.length > 0 ? (
          upcomingActions.map(action => (
            <ActionItem
              key={action.id}
              action={action}
              onActionChange={(newValues) => handleActionChange(action, newValues)}
            />
          ))
        ) : !isLoading && (
          <View className="items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12">
            <Text className="text-lg font-semibold text-gray-900">Nothing planned</Text>
            <Text className="mt-2 text-center text-sm text-gray-500">
              Make a plan or set a one-time task to get started.
            </Text>
          </View>
        )}
        <View className="h-20" /> 
      </ScrollView>

      {/* Creation Type Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
            setModalVisible(false);
            setShowCreatePlanOptions(false);
        }}
      >
        <View className="flex-1 justify-center bg-black/50 p-4">
            <View className="rounded-lg bg-white p-6 shadow-lg">
                <View className="mb-4 flex-row items-center justify-between">
                    <Text className="text-lg font-bold">Create New</Text>
                    <TouchableOpacity onPress={() => {
                        setModalVisible(false);
                        setShowCreatePlanOptions(false);
                    }}>
                        <X size={24} color="gray" />
                    </TouchableOpacity>
                </View>
                
                <Text className="mb-6 text-gray-500">
                    {showCreatePlanOptions 
                        ? "Choose how you want to plan your day." 
                        : "Build a habit to achieve a long-term goal, or create a plan for today."}
                </Text>

                {showCreatePlanOptions ? (
                    // Sub-Options for "Create a Plan"
                    <View className="flex-row gap-4">
                        <TouchableOpacity 
                            className="flex-1 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-6 active:bg-gray-100"
                            onPress={() => {
                                setModalVisible(false);
                                setShowCreatePlanOptions(false);
                                navigation.navigate('CreatePlan', { type: 'isolate' });
                            }}
                        >
                            <ClipboardList size={32} color="#0ea5e9" className="mb-2" />
                            <Text className="font-semibold text-gray-900 text-center">Create Plan</Text>
                            <Text className="text-xs text-gray-400 text-center mt-1">(Isolate Activities)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            className="flex-1 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-6 active:bg-gray-100"
                            onPress={() => {
                                setModalVisible(false);
                                setShowCreatePlanOptions(false);
                                navigation.navigate('CreateTask');
                            }}
                        >
                            <Clock size={32} color="#0ea5e9" className="mb-2" />
                            <Text className="font-semibold text-gray-900 text-center">Set Reminder</Text>
                            <Text className="text-xs text-gray-400 text-center mt-1">(One-time Task)</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    // Main Options
                    <View className="flex-row gap-4">
                        <TouchableOpacity 
                            className="flex-1 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-6 active:bg-gray-100"
                            onPress={() => {
                                setModalVisible(false);
                                navigation.navigate('CreatePlan', { type: 'habit' });
                            }}
                        >
                            <Zap size={32} color="#0ea5e9" className="mb-2" />
                            <Text className="font-semibold text-gray-900 text-center">Build a Habit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            className="flex-1 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-6 active:bg-gray-100"
                            onPress={() => setShowCreatePlanOptions(true)}
                        >
                            <Calendar size={32} color="#0ea5e9" className="mb-2" />
                            <Text className="font-semibold text-gray-900 text-center">Create a Plan</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
