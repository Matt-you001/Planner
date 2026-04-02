import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { ArrowRight, CalendarPlus, PlusCircle } from 'lucide-react-native';
import type { Goal, WithId } from '../lib/types';
import { styled } from 'nativewind';

interface GoalCardProps {
  goal: WithId<Goal>;
}

export default function GoalCard({ goal }: GoalCardProps) {
  const navigation = useNavigation<any>();

  // Use startDate and targetDate if available, or fallback to createdAt
  const startDate = goal.startDate || new Date(goal.createdAt).toISOString().split('T')[0];
  const targetDate = goal.targetDate || 'Forever';

  return (
    <View className="mb-4 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <View className="mb-3 flex-row items-start justify-between">
        <Text className="flex-1 text-xl font-bold text-gray-900" numberOfLines={2}>{goal.title}</Text>
        <View className="ml-2 rounded-full bg-blue-50 px-3 py-1">
          <Text className="text-xs font-bold text-blue-700">{goal.category}</Text>
        </View>
      </View>
      
      <View className="mb-4 flex-row justify-between border-b border-gray-100 pb-4">
        <View>
            <Text className="text-xs text-gray-400">Start Date</Text>
            <Text className="text-sm font-semibold text-gray-700">{startDate}</Text>
        </View>
        <View>
            <Text className="text-xs text-gray-400 text-right">Target Date</Text>
            <Text className="text-sm font-semibold text-gray-700 text-right">{targetDate}</Text>
        </View>
      </View>

      <View className="mb-4 flex-row items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
        <Text className="text-xs font-semibold text-amber-800">Journal Entries</Text>
        <Text className="text-xs font-bold text-amber-700">{goal.notes?.length || 0}</Text>
      </View>

      <View className="mb-5">
        <View className="mb-1 flex-row justify-between">
            <Text className="text-sm font-medium text-gray-600">Success Rate</Text>
            <Text className="text-sm font-bold text-green-600">{goal.progress || 0}%</Text>
        </View>
        <View className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <View 
                className="h-full bg-green-500 rounded-full" 
                style={{ width: `${goal.progress || 0}%` }} 
            />
        </View>
      </View>

      <View className="flex-row gap-3">
          {/* Add to Plan Button - Goes to Plan Setup/Isolate */}
          <TouchableOpacity 
              className="flex-1 flex-row items-center justify-center rounded-lg bg-sky-500 px-4 py-3 active:bg-sky-600"
              onPress={() => navigation.navigate('PlanSetup', { 
                goalId: goal.id, 
                goalTitle: goal.title,
                startDate: startDate,
                targetDate: targetDate === 'Forever' ? undefined : targetDate
              })}
          >
              <PlusCircle size={18} color="white" className="mr-2" />
              <Text className="font-bold text-white">Add to Plan</Text>
          </TouchableOpacity>
          
          {/* View Details Button - Goes to Goal Details */}
          <TouchableOpacity 
              className="flex-1 flex-row items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 active:bg-gray-50"
              onPress={() => navigation.navigate('GoalDetails', { goalId: goal.id })}
          >
              <Text className="font-semibold text-gray-700 mr-2">View Detail</Text>
              <ArrowRight size={18} color="#374151" />
          </TouchableOpacity>
      </View>
    </View>
  );
}
