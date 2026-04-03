import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Linking, TouchableOpacity, Modal, Alert, TextInput } from 'react-native';
import * as Notifications from 'expo-notifications';
import { launchApp } from '../services/InstalledApps';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import ActionItem from '../components/ActionItem';
import type { System, Task, WithId, Goal, JournalEntry, JournalMood } from '../lib/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DataService } from '../lib/DataService';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Plus, X, Calendar, ClipboardList, Clock, Zap, BookOpen } from 'lucide-react-native';
import { useCelebration } from '../context/CelebrationContext';

type Action = WithId<System> | WithId<Task>;

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const { celebrate } = useCelebration();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [goals, setGoals] = useState<WithId<Goal>[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isJournalModalVisible, setJournalModalVisible] = useState(false);
  const [isGoalPickerVisible, setGoalPickerVisible] = useState(false);
  // Secondary state for "Create a Plan" sub-selection
  const [showCreatePlanOptions, setShowCreatePlanOptions] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [journalContent, setJournalContent] = useState('');
  const [journalMood, setJournalMood] = useState<JournalMood>('Good');
  const [isSavingJournal, setIsSavingJournal] = useState(false);

  // Track which apps we've already auto-opened this session
  const openedActionsRef = useRef<Set<string>>(new Set());

  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    setIsDataLoading(true);
    const [fetchedTasks, fetchedSystems, fetchedGoals, fetchedJournals] = await Promise.all([
        DataService.getTasks(user.uid, undefined, today),
        DataService.getSystems(user.uid, undefined, today),
        DataService.getGoals(user.uid),
        DataService.getJournals(user.uid, today)
    ]);
    setTasks(fetchedTasks);
    setSystems(fetchedSystems);
    setGoals(fetchedGoals);
    setJournals(fetchedJournals);
    setIsDataLoading(false);
  }, [user, today]);

  useFocusEffect(
    useCallback(() => {
        loadDashboardData();
    }, [loadDashboardData])
  );

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

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
    
    // Fix 1: Exclude "missed" activities (successPercentage < 50) from "completed" count
    // "Missed" means isCompleted=true AND successPercentage=0 (or <50)
    // "Done" means isCompleted=true AND successPercentage >= 50
    const successful = allActions.filter(a => a.isCompleted && (a.successPercentage || 0) >= 50).length;
    
    const percentage = Math.round((successful / allActions.length) * 100);
    
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

  const todaysJournalEntries = useMemo(() => {
    return [...journals].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [journals]);

  const handleSaveJournal = async () => {
    if (!user || !journalContent.trim()) return;

    setIsSavingJournal(true);
    try {
      await DataService.addNote(user.uid, selectedGoalId || undefined, {
        content: journalContent.trim(),
        date: today,
        mood: journalMood
      });
      setJournalContent('');
      setJournalMood('Good');
      setSelectedGoalId('');
      setJournalModalVisible(false);
      loadDashboardData();
    } catch (error) {
      console.error("Failed to save journal entry", error);
      Alert.alert("Error", "Could not save journal entry.");
    } finally {
      setIsSavingJournal(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200">
        <View>
            <Text className="text-2xl font-bold text-gray-900">Today's Dashboard</Text>
            <Text className="text-sm text-gray-500">Your upcoming activities and one-off tasks.</Text>
        </View>
        <View className="flex-row gap-2">
            <TouchableOpacity  
                className="flex-row items-center justify-center rounded-md bg-amber-500 px-2 py-2"
                onPress={() => {
                    setSelectedGoalId('');
                    setJournalModalVisible(true);
                }}
            >
                <BookOpen size={18} color="white" />
                <Text className="ml-1 text-xs font-medium text-white">Journal</Text>
            </TouchableOpacity>
            <TouchableOpacity  
                className="flex-row items-center justify-center rounded-md bg-sky-500 px-3 py-2"
                onPress={() => setModalVisible(true)}
            >
                <Plus size={20} color="white" />
                <Text className="ml-1 text-xs font-medium text-white">New</Text>
            </TouchableOpacity>
        </View>
      </View>

      {/* Daily Progress Tracker */}
      <View className="px-4 pt-4 pb-2">
        <View className="mb-2 flex-row justify-between items-center">
            <Text className="text-sm font-bold text-gray-700">Daily Progress</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ReviewYesterday')}> 
                <Text className="text-xs font-medium text-sky-600 underline">Review Yesterday</Text>
            </TouchableOpacity>
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
        <View className="mb-6">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-sm font-bold text-gray-700">Today's Journal</Text>
            <TouchableOpacity onPress={() => {
              setSelectedGoalId('');
              setJournalModalVisible(true);
            }}>
              <Text className="text-xs font-semibold text-amber-600">Add Entry</Text>
            </TouchableOpacity>
          </View>

          {todaysJournalEntries.length > 0 ? (
            todaysJournalEntries.map((entry) => (
              <View key={entry.id} className="mb-3 rounded-xl border border-amber-100 bg-amber-50 p-4">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-amber-800">{entry.goalTitle || 'Personal Journal'}</Text>
                  {entry.mood ? (
                    <Text className="text-[10px] font-bold uppercase text-amber-600">{entry.mood}</Text>
                  ) : null}
                </View>
                <Text className="text-sm text-gray-800">{entry.content}</Text>
                <Text className="mt-2 text-xs text-gray-500">
                  {format(new Date(entry.createdAt), 'EEE, MMM d')} at {format(new Date(entry.createdAt), 'h:mm a')}
                </Text>
              </View>
            ))
          ) : (
            <View className="rounded-lg border border-dashed border-amber-200 bg-amber-50/60 p-4">
              <Text className="text-sm text-amber-800">No journal entries yet for today.</Text>
            </View>
          )}
        </View>

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

      <Modal
        visible={isJournalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJournalModalVisible(false)}
      >
        <View className="flex-1 justify-center bg-black/50 p-4">
          <View className="rounded-lg bg-white p-6 shadow-lg">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-bold">Journal Today</Text>
              <TouchableOpacity onPress={() => setJournalModalVisible(false)}>
                <X size={24} color="gray" />
              </TouchableOpacity>
            </View>

            <Text className="mb-2 text-sm font-medium text-gray-700">Link to Plan/Habit (Optional)</Text>
            <TouchableOpacity
              className="mb-2 rounded-md border border-gray-300 px-3 py-3"
              onPress={() => setGoalPickerVisible(true)}
            >
              <Text className={`text-sm ${selectedGoalId ? 'text-gray-900' : 'text-gray-500'}`}>
                {selectedGoalId
                  ? goals.find(goal => goal.id === selectedGoalId)?.title || 'Linked plan selected'
                  : 'Select a plan or habit to link this journal'}
              </Text>
            </TouchableOpacity>
            {selectedGoalId ? (
              <TouchableOpacity onPress={() => setSelectedGoalId('')} className="mb-4 self-start">
                <Text className="text-xs font-semibold text-red-500">Remove link</Text>
              </TouchableOpacity>
            ) : (
              <Text className="mb-4 text-xs text-gray-500">Leave this unselected to save an independent journal.</Text>
            )}

            <Text className="mb-2 text-sm font-medium text-gray-700">Mood</Text>
            <View className="mb-4 flex-row gap-2">
              {(['Great', 'Good', 'Okay', 'Hard'] as JournalMood[]).map((mood) => (
                <TouchableOpacity
                  key={mood}
                  className={`rounded-full border px-3 py-2 ${journalMood === mood ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white'}`}
                  onPress={() => setJournalMood(mood)}
                >
                  <Text className={`text-xs font-semibold ${journalMood === mood ? 'text-sky-700' : 'text-gray-600'}`}>{mood}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              className="mb-4 rounded-md border border-gray-300 p-3 h-28"
              placeholder="What happened today? What worked, what was hard, what do you want to remember?"
              value={journalContent}
              onChangeText={setJournalContent}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              className="items-center rounded-md bg-amber-500 p-3"
              onPress={handleSaveJournal}
              disabled={isSavingJournal || !journalContent.trim()}
            >
              {isSavingJournal ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-bold text-white">Save Journal Entry</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isGoalPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGoalPickerVisible(false)}
      >
        <TouchableOpacity
          className="flex-1 justify-end bg-black/50"
          activeOpacity={1}
          onPress={() => setGoalPickerVisible(false)}
        >
          <View className="rounded-t-xl bg-white p-4" style={{ maxHeight: '60%' }}>
            <Text className="mb-4 text-center text-lg font-bold text-gray-900">Link to Plan/Habit</Text>
            <ScrollView>
              {goals.length > 0 ? goals.map(goal => (
                <TouchableOpacity
                  key={goal.id}
                  className="border-b border-gray-100 py-4"
                  onPress={() => {
                    setSelectedGoalId(goal.id);
                    setGoalPickerVisible(false);
                  }}
                >
                  <Text className="text-center text-base text-gray-800">{goal.title}</Text>
                </TouchableOpacity>
              )) : (
                <View className="py-8">
                  <Text className="text-center text-sm text-gray-500">No plans or habits available yet.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
