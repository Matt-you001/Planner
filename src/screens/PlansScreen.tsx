import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import type { Goal } from '../lib/types';
import GoalCard from '../components/GoalCard';
import { Plus, X, Calendar, CheckSquare, Zap, ClipboardList, Clock } from 'lucide-react-native';
import { DataService } from '../lib/DataService';
import { useFocusEffect } from '@react-navigation/native';

export default function PlansScreen({ navigation }: any) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isGoalsLoading, setIsGoalsLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [showCreatePlanOptions, setShowCreatePlanOptions] = useState(false);

  const loadGoals = useCallback(async () => {
    // Wait for auth to settle, but also allow loading if we are in demo mode (user might be null or mock)
    // If user is null, we can still load from localStore using a generic key if we wanted, 
    // but typically we need a uid. MOCK_USER has a uid.
    const uid = user?.uid || 'mock-user-123';
    
    setIsGoalsLoading(true);
    try {
        console.log('PlansScreen: Loading goals...');
        const data = await DataService.getGoals(uid);
        console.log(`PlansScreen: Found ${data.length} goals.`);
        setGoals([...data]);
    } catch (e) {
        console.error("Failed to load goals", e);
    } finally {
        setIsGoalsLoading(false);
    }
  }, [user]);

  // Use useFocusEffect to reload whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
        loadGoals();
    }, [loadGoals])
  );

  // Initial load
  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const isLoading = isAuthLoading || isGoalsLoading;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200">
        <View>
            <Text className="text-2xl font-bold text-foreground">My Plans</Text>
            <Text className="text-sm text-muted-foreground">Manage your long-term goals.</Text>
        </View>
        <View className="flex-row gap-2">
            <TouchableOpacity 
                className="flex-row items-center justify-center rounded-md bg-gray-100 px-3 py-2"
                onPress={() => navigation.goBack()}
            >
                <Text className="font-medium text-gray-700">Back</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                className="flex-row items-center justify-center rounded-md bg-primary px-3 py-2"
                onPress={() => setModalVisible(true)}
            >
                <Plus size={20} color="white" />
                <Text className="ml-1 font-medium text-primary-foreground">New Plan</Text>
            </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-4"
        refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={loadGoals} />
        }
      >
        {!isLoading && goals.length > 0 ? (
          goals.map(goal => (
            <GoalCard key={goal.id} goal={goal} />
          ))
        ) : !isLoading && (
          <View className="mt-10 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 p-12">
            <Text className="text-lg font-semibold text-foreground">No plans yet</Text>
            <Text className="mt-2 text-center text-sm text-muted-foreground">
              Create your first plan to get started.
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
