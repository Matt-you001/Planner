import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { LogOut, Bell, User, Volume2, ArrowLeft, Zap, Moon } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

export default function SettingsScreen() {
  const { user, logout, subscriptionTier, upgradeToPremium } = useAuth();
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

  const toggleEveningReview = async (value: boolean) => {
    setEveningReviewEnabled(value);
    if (value) {
        // Schedule reminders
        try {
            await Notifications.scheduleNotificationAsync({
                content: { title: "Review your day", body: "How did today go? Take a moment to track your progress.", data: { screen: 'Dashboard' } },
                trigger: { 
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                    hour: 22, 
                    minute: 0, 
                },
            });
            await Notifications.scheduleNotificationAsync({
                content: { title: "Last chance to review", body: "Don't break your streak! Mark today's activities.", data: { screen: 'Dashboard' } },
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
                    {subscriptionTier === 'premium' ? 'Premium Plan' : 'Free Plan'}
                </Text>
            </View>

            {subscriptionTier === 'free' && (
                <TouchableOpacity 
                    className="mt-4 flex-row items-center rounded-lg bg-yellow-500 px-6 py-2 shadow-sm"
                    onPress={upgradeToPremium}
                >
                    <Zap size={16} color="white" className="mr-2" />
                    <Text className="font-bold text-white">Upgrade to Premium</Text>
                </TouchableOpacity>
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
