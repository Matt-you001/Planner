import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { format, subDays } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import ActionItem from '../components/ActionItem';
import type { System, Task, WithId } from '../lib/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DataService } from '../lib/DataService';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { useCelebration } from '../context/CelebrationContext';

type Action = WithId<System> | WithId<Task>;

export default function ReviewYesterdayScreen() {
  const navigation = useNavigation<any>();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { celebrate } = useCelebration();
  
  // Calculate Yesterday's Date
  const yesterday = useMemo(() => subDays(new Date(), 1), []);
  const dateString = format(yesterday, 'yyyy-MM-dd');
  const formattedDate = format(yesterday, 'EEEE, MMMM d, yyyy');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsDataLoading(true);
    const [fetchedTasks, fetchedSystems] = await Promise.all([
        DataService.getTasks(user.uid, undefined, dateString),
        DataService.getSystems(user.uid, undefined, dateString)
    ]);
    setTasks(fetchedTasks);
    setSystems(fetchedSystems);
    setIsDataLoading(false);
  }, [user, dateString]);

  useFocusEffect(
    useCallback(() => {
        loadData();
    }, [loadData])
  );

  const actions = useMemo(() => {
    const allActions: Action[] = [...(systems || []), ...(tasks || [])];
    return allActions.sort((a, b) => {
      const dateComparison = a.date.localeCompare(b.date);
      if (dateComparison !== 0) return dateComparison;
      return (a.startTime || '23:59').localeCompare(b.startTime || '23:59');
    });
  }, [systems, tasks]);

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
  };

  const isLoading = isAuthLoading || isDataLoading;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center px-4 py-4 border-b border-gray-200">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
            <ArrowLeft size={24} color="black" />
        </TouchableOpacity>
        <View>
            <Text className="text-xl font-bold text-gray-900">Review Yesterday</Text>
            <Text className="text-sm text-gray-500">{formattedDate}</Text>
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-4 pt-4"
        refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={loadData} />
        }
      >
        <Text className="mb-4 text-sm text-gray-600">
            Did you miss anything? Catch up by marking your activities below.
        </Text>

        {!isLoading && actions.length > 0 ? (
          actions.map(action => (
            <ActionItem
              key={action.id}
              action={action}
              onActionChange={(newValues) => handleActionChange(action, newValues)}
            />
          ))
        ) : !isLoading && (
          <View className="items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12">
            <Text className="text-lg font-semibold text-gray-900">No activities found</Text>
            <Text className="mt-2 text-center text-sm text-gray-500">
              You had nothing scheduled for yesterday.
            </Text>
          </View>
        )}
        <View className="h-20" /> 
      </ScrollView>
    </SafeAreaView>
  );
}