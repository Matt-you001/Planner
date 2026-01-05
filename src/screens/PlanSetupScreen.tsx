import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Layers, Zap, ArrowLeft, Lock } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { Alert } from 'react-native';

export default function PlanSetupScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { goalId, goalTitle, startDate, targetDate, initialSelectedDate } = route.params;
  const { subscriptionTier, upgradeToPremium } = useAuth();

  const handleHabitStackPress = () => {
    if (subscriptionTier === 'free') {
        Alert.alert(
            "Premium Feature",
            "Habit Stacking is available only for Premium subscribers.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Upgrade", onPress: upgradeToPremium }
            ]
        );
    } else {
        navigation.navigate('PlanStack', { 
            goalId, 
            goalTitle, 
            startDate, 
            targetDate,
            initialSelectedDate
        });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center border-b border-gray-200 bg-white p-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <ArrowLeft size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">Plan: {goalTitle}</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        <Text className="mb-6 text-center text-gray-500">
            Choose how to plan your day to build a system for your goal.
        </Text>

        <View className="gap-4">
            <TouchableOpacity 
                className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-8 active:bg-gray-100"
                onPress={() => navigation.navigate('PlanIsolate', { 
                    goalId, 
                    goalTitle, 
                    startDate, 
                    targetDate,
                    initialSelectedDate
                })}
            >
                <Layers size={48} color="#0ea5e9" className="mb-4" />
                <Text className="mb-2 text-xl font-bold text-gray-900">Create Isolate Activities</Text>
                <Text className="text-center text-gray-500">
                    Manually add one or more separate activities for the day.
                </Text>
            </TouchableOpacity>

            <TouchableOpacity 
                className={`flex items-center justify-center rounded-lg border p-8 active:bg-gray-100 ${subscriptionTier === 'free' ? 'bg-gray-100 border-gray-300' : 'bg-gray-50 border-gray-200'}`}
                onPress={handleHabitStackPress}
            >
                <View className="relative">
                    <Zap size={48} color={subscriptionTier === 'free' ? 'gray' : '#eab308'} className="mb-4" />
                    {subscriptionTier === 'free' && (
                        <View className="absolute -right-2 -top-2 bg-white rounded-full p-1 shadow-sm">
                            <Lock size={16} color="gray" />
                        </View>
                    )}
                </View>
                <Text className={`mb-2 text-xl font-bold ${subscriptionTier === 'free' ? 'text-gray-500' : 'text-gray-900'}`}>Create a Habit Stack</Text>
                <Text className="text-center text-gray-500">
                    Build a chain of habits to reinforce your goal (Atomic Habits).
                </Text>
            </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
