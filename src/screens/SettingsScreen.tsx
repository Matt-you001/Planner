import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Platform, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { LogOut, Bell, User, Volume2, ArrowLeft, Zap, Moon, ShieldAlert } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

const PLANAPP_DELETION_URL = 'https://techsolutionproviders.net/account-deletion-planapp.html';

export default function SettingsScreen() {
  const {
    user,
    logout,
    subscriptionTier,
    isPremiumGatingEnabled,
    upgradeToPremium,
    restorePremiumPurchases,
    isSubscriptionLoading
  } = useAuth();
  const navigation = useNavigation();
  
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [eveningReviewEnabled, setEveningReviewEnabled] = useState(true);

  const handleLogout = () => {
    Alert.alert(
        "Logout",
        "Are you sure you want to logout?",
        [
            { text: "Cancel", style: "cancel" },
            { text: "Logout", style: "destructive", onPress: logout }
        ]
    );
  };

  const handleDeleteAccountRequest = () => {
    Alert.alert(
      'Delete Account & Data',
      'This opens the official PlanApp account deletion page where you can submit a request to delete your account and associated data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Page',
          onPress: async () => {
            try {
              await Linking.openURL(PLANAPP_DELETION_URL);
            } catch (error) {
              console.warn('Failed to open PlanApp deletion page', error);
              Alert.alert(
                'Unable to Open Page',
                'Please visit techsolutionproviders.net/account-deletion-planapp.html in your browser.'
              );
            }
          }
        }
      ]
    );
  };

  const toggleEveningReview = async (value: boolean) => {
    setEveningReviewEnabled(value);
    if (value) {
        // Schedule reminders
        try {
            await Notifications.scheduleNotificationAsync({
                content: { title: "Review your day", body: "How did today go? Take a moment to track your progress.", data: { screen: 'Home' } },
                trigger: { 
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                    hour: 22, 
                    minute: 0, 
                },
            });
            await Notifications.scheduleNotificationAsync({
                content: { title: "Last chance to review", body: "Don't break your streak! Mark today's activities.", data: { screen: 'Home' } },
                trigger: { 
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                    hour: 23, 
                    minute: 50, 
                },
            });
            Alert.alert("Reminders Set", "You will be reminded at 10:00 PM and 11:50 PM to review your day.");
        } catch (e) {
            console.warn("Failed to schedule evening reminders", e);
            Alert.alert("Error", "Could not schedule reminders. Please check permissions.");
        }
    } else {
        // Cancel all (simulated by just not scheduling new ones, usually we'd track IDs)
        await Notifications.cancelAllScheduledNotificationsAsync();
        Alert.alert("Reminders Off", "Evening review reminders disabled.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center border-b border-gray-200 bg-white p-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <ArrowLeft size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">Settings</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Profile Section */}
        <View className="mb-6 items-center">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-sky-100 mb-3">
                <User size={40} color="#0ea5e9" />
            </View>
            <Text className="text-lg font-bold text-gray-900">{user?.email}</Text>
            <View className={`mt-2 rounded-full px-3 py-1 ${subscriptionTier === 'premium' ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                <Text className={`text-xs font-bold ${subscriptionTier === 'premium' ? 'text-yellow-700' : 'text-gray-500'}`}>
                    {!isPremiumGatingEnabled
                      ? 'Testing Access'
                      : subscriptionTier === 'premium'
                        ? 'Premium Plan'
                        : 'Free Plan'}
                </Text>
            </View>

            {isPremiumGatingEnabled && subscriptionTier === 'free' && (
                <TouchableOpacity 
                    className={`mt-4 flex-row items-center rounded-lg bg-yellow-500 px-6 py-2 shadow-sm ${isSubscriptionLoading ? 'opacity-70' : ''}`}
                    onPress={upgradeToPremium}
                    disabled={isSubscriptionLoading}
                >
                    <Zap size={16} color="white" className="mr-2" />
                    <Text className="font-bold text-white">
                        {isSubscriptionLoading ? 'Processing...' : 'Upgrade to Premium'}
                    </Text>
                </TouchableOpacity>
            )}

            {isPremiumGatingEnabled ? (
              <>
                <TouchableOpacity
                    className={`mt-3 rounded-lg border border-gray-200 px-6 py-2 ${isSubscriptionLoading ? 'opacity-70' : ''}`}
                    onPress={restorePremiumPurchases}
                    disabled={isSubscriptionLoading}
                >
                    <Text className="text-center font-semibold text-gray-700">Restore Purchases</Text>
                </TouchableOpacity>

                <Text className="mt-3 text-center text-xs text-gray-400">
                    Real purchases require a development, preview, or production build, not Expo Go.
                </Text>
              </>
            ) : (
              <Text className="mt-3 text-center text-xs text-sky-600">
                  All premium features are open during testing.
              </Text>
            )}
        </View>

        {/* Notifications Section */}
        <View className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
            <Text className="mb-4 text-sm font-bold text-gray-500 uppercase">Notifications</Text>
            
            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                    <Bell size={20} color="gray" className="mr-3" />
                    <Text className="text-base text-gray-900">Allow Notifications</Text>
                </View>
                <Switch 
                    value={true} 
                    disabled={true} // Always on per requirements
                    trackColor={{ false: "#e5e7eb", true: "#bae6fd" }}
                    thumbColor={"#0ea5e9"}
                />
            </View>

            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                    <Moon size={20} color="gray" className="mr-3" />
                    <Text className="text-base text-gray-900">Evening Review (10pm)</Text>
                </View>
                <Switch 
                    value={eveningReviewEnabled} 
                    onValueChange={toggleEveningReview}
                    trackColor={{ false: "#e5e7eb", true: "#bae6fd" }}
                    thumbColor={eveningReviewEnabled ? "#0ea5e9" : "#f4f4f5"}
                />
            </View>

            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                    <Volume2 size={20} color="gray" className="mr-3" />
                    <Text className="text-base text-gray-900">Sound</Text>
                </View>
                <Switch 
                    value={soundEnabled} 
                    onValueChange={setSoundEnabled}
                    trackColor={{ false: "#e5e7eb", true: "#bae6fd" }}
                    thumbColor={soundEnabled ? "#0ea5e9" : "#f4f4f5"}
                />
            </View>
            
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <Text className="ml-8 text-base text-gray-900">Vibration</Text>
                </View>
                <Switch 
                    value={vibrationEnabled} 
                    onValueChange={setVibrationEnabled}
                    trackColor={{ false: "#e5e7eb", true: "#bae6fd" }}
                    thumbColor={vibrationEnabled ? "#0ea5e9" : "#f4f4f5"}
                />
            </View>
        </View>

        <View className="mb-6 rounded-lg border border-red-100 bg-red-50 p-4">
            <Text className="mb-4 text-sm font-bold uppercase text-red-500">Account & Data</Text>
            <View className="rounded-lg border border-red-100 bg-white p-4">
                <View className="mb-3 flex-row items-start">
                    <ShieldAlert size={20} color="#dc2626" className="mr-3" />
                    <View className="flex-1">
                        <Text className="text-base font-semibold text-gray-900">Delete PlanApp Account</Text>
                        <Text className="mt-1 text-sm leading-6 text-gray-600">
                            Need your PlanApp account and associated data deleted? Use the official deletion request page provided by TechConsults.
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3"
                    onPress={handleDeleteAccountRequest}
                >
                    <Text className="text-center font-semibold text-red-600">Open Account Deletion Request</Text>
                </TouchableOpacity>

                <Text className="mt-3 text-xs leading-5 text-gray-500">
                    The deletion page is available to satisfy Google Play account deletion requirements and lets you request removal of your PlanApp account and related data.
                </Text>
            </View>
        </View>

        <TouchableOpacity 
            className="flex-row items-center justify-center rounded-lg bg-red-50 p-4"
            onPress={handleLogout}
        >
            <LogOut size={20} color="#ef4444" className="mr-2" />
            <Text className="font-bold text-red-600">Log Out</Text>
        </TouchableOpacity>
        
        <Text className="mt-8 text-center text-xs text-gray-400">
            Version 1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
