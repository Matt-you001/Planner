import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ArrowLeft, BrainCircuit, RefreshCw, Wifi, WifiOff } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { DataService } from '../lib/DataService';
import { AiService, NextBestAction } from '../lib/AiService';

export default function AiCoachScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const uid = user?.uid || 'mock-user-123';

  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Array<{ goalId: string; goalTitle: string; recommendation: NextBestAction }>>([]);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const goals = await DataService.getGoals(uid);
      const activeGoals = goals.filter(goal => !goal.archived);

      const aiResults = await Promise.all(
        activeGoals.map(async (goal) => {
          const habitStats = await DataService.getHabitStage(uid, goal.id).catch(() => ({ stage: 'Intention' as const, completedCount: 0 }));
          const recentProgress = goal.progress || 0;

          const recommendation = await AiService.suggestNextBestAction(goal.title, {
            category: goal.category,
            recentProgress,
            completedCount: habitStats.completedCount,
            journalEntries: goal.notes?.length || 0,
          });

          return {
            goalId: goal.id,
            goalTitle: goal.title,
            recommendation,
          };
        })
      );

      setRecommendations(aiResults);
    } catch (error) {
      console.error('Failed to load AI recommendations', error);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      loadRecommendations();
    }, [loadRecommendations])
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center justify-between border-b border-gray-200 bg-white p-4">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <ArrowLeft size={24} color="black" />
          </TouchableOpacity>
          <View>
            <Text className="text-lg font-bold text-gray-900">AI Coach</Text>
            <Text className="text-xs text-gray-500">Next best actions for your goals</Text>
          </View>
        </View>

        <TouchableOpacity onPress={loadRecommendations} className="rounded-full bg-sky-50 p-2">
          <RefreshCw size={18} color="#0284c7" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 p-4">
        <View className={`mb-4 rounded-xl border p-4 ${AiService.isOnlineConfigured() ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <View className="flex-row items-center">
            {AiService.isOnlineConfigured() ? <Wifi size={18} color="#047857" /> : <WifiOff size={18} color="#b45309" />}
            <Text className={`ml-2 text-sm font-semibold ${AiService.isOnlineConfigured() ? 'text-emerald-800' : 'text-amber-800'}`}>
              {AiService.isOnlineConfigured() ? 'Online AI is configured' : 'Using offline AI fallback'}
            </Text>
          </View>
          <Text className={`mt-2 text-xs ${AiService.isOnlineConfigured() ? 'text-emerald-700' : 'text-amber-700'}`}>
            {AiService.isOnlineConfigured()
              ? 'The app can call your configured backend endpoint for live suggestions.'
              : 'Set EXPO_PUBLIC_AI_API_URL to connect the coach to your online AI backend.'}
          </Text>
        </View>

        {loading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator color="#0ea5e9" />
            <Text className="mt-3 text-sm text-gray-500">Building your coaching suggestions...</Text>
          </View>
        ) : recommendations.length > 0 ? (
          recommendations.map((item) => (
            <TouchableOpacity
              key={item.goalId}
              className="mb-4 rounded-xl border border-gray-200 bg-white p-5"
              onPress={() => navigation.navigate('GoalDetails', { goalId: item.goalId })}
            >
              <View className="mb-3 flex-row items-center">
                <BrainCircuit size={18} color="#7c3aed" />
                <Text className="ml-2 flex-1 text-base font-bold text-gray-900">{item.goalTitle}</Text>
              </View>
              <Text className="mb-2 text-sm font-semibold text-sky-700">{item.recommendation.title}</Text>
              <Text className="text-sm leading-6 text-gray-600">{item.recommendation.reason}</Text>
              {item.recommendation.suggestedDuration ? (
                <Text className="mt-3 text-xs font-semibold text-gray-500">Suggested duration: {item.recommendation.suggestedDuration}</Text>
              ) : null}
            </TouchableOpacity>
          ))
        ) : (
          <View className="items-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10">
            <Text className="text-base font-semibold text-gray-900">No coaching suggestions yet</Text>
            <Text className="mt-2 text-center text-sm text-gray-500">
              Create a few plans first, then the AI Coach will suggest your next best actions.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
