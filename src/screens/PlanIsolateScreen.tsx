import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Modal, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Plus, Trash2, Calendar, Clock, Sparkles, X, Smartphone, Bell, BellOff, Repeat } from 'lucide-react-native';
import { DataService } from '../lib/DataService';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { AiService } from '../lib/AiService';
import { NotificationService } from '../lib/NotificationService';
import type { RepeatFrequency, CustomRepeatConfig } from '../lib/types';
import CustomRepeatModal from '../components/CustomRepeatModal';
import { generateRecurringDates } from '../lib/recurrence';
import AppSelectionModal from '../components/AppSelectionModal';

// Common Apps for Linking (Reused)
const COMMON_APPS = [
  { name: 'None', schema: '' },
  { name: 'Phone', schema: 'tel:' },
  { name: 'Messages', schema: 'sms:' },
  { name: 'Email', schema: 'mailto:' },
  { name: 'Browser', schema: 'https://google.com' },
  { name: 'WhatsApp', schema: 'whatsapp://' },
  { name: 'Instagram', schema: 'instagram://' },
  { name: 'Twitter', schema: 'twitter://' },
  { name: 'Facebook', schema: 'fb://' },
  { name: 'Spotify', schema: 'spotify://' },
  { name: 'Maps', schema: 'maps://' },
  { name: 'Calendar', schema: 'calshow:' },
  { name: 'YouTube', schema: 'youtube://' },
];

interface ActivityItem {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  linkedApp: string;
  alarm: boolean;
}

export default function PlanIsolateScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user, subscriptionTier, upgradeToPremium } = useAuth();
  const { goalId, goalTitle, startDate, targetDate, initialSelectedDate } = route.params;

  // Date State
  // Default to initialSelectedDate if provided, else startDate, else today.
  const [date, setDate] = useState(
      initialSelectedDate ? new Date(initialSelectedDate) : 
      (startDate ? new Date(startDate) : new Date())
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Time Picker State
  const [showTimePicker, setShowTimePicker] = useState<{ id: string, type: 'start' | 'end' } | null>(null);

  // App Picker State
  const [showAppPicker, setShowAppPicker] = useState<{ id: string } | null>(null);

  const [activities, setActivities] = useState<ActivityItem[]>([
    { id: '1', title: '', startTime: new Date(), endTime: new Date(new Date().getTime() + 30 * 60000), linkedApp: '', alarm: false }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Repeat State
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>('Daily');
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [customRepeatConfig, setCustomRepeatConfig] = useState<CustomRepeatConfig | undefined>();
  const [showCustomRepeatModal, setShowCustomRepeatModal] = useState(false);

  // Activities ListAI State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(null);
    
    if (selectedDate && showTimePicker) {
        setActivities(prev => prev.map(a => {
            if (a.id === showTimePicker.id) {
                return {
                    ...a,
                    [showTimePicker.type === 'start' ? 'startTime' : 'endTime']: selectedDate
                };
            }
            return a;
        }));
    }
  };

  const updateActivityApp = (id: string, appSchema: string) => {
    setActivities(prev => prev.map(a => a.id === id ? { 
        ...a, 
        linkedApp: appSchema,
        alarm: true // Auto-enable alarm when app is linked
    } : a));
    setShowAppPicker(null);
  };

  const renderDatePicker = (
    show: boolean, 
    value: Date, 
    onChange: (event: any, date?: Date) => void
  ) => {
    if (!show) return null;
    return (
        <DateTimePicker
            value={value}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onChange}
            minimumDate={startDate ? new Date(startDate) : undefined}
            maximumDate={targetDate ? new Date(targetDate) : undefined}
        />
    );
  };

  const renderTimePicker = () => {
    if (!showTimePicker) return null;
    
    const activity = activities.find(a => a.id === showTimePicker.id);
    if (!activity) return null;

    const value = showTimePicker.type === 'start' ? activity.startTime : activity.endTime;

    return (
        <DateTimePicker
            value={value}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onTimeChange}
        />
    );
  };

  const addActivity = (title: string = '') => {
    setActivities(prev => [...prev, { 
        id: Date.now().toString() + Math.random(), 
        title, 
        startTime: new Date(), 
        endTime: new Date(new Date().getTime() + 30 * 60000),
        linkedApp: '',
        alarm: false
    }]);
  };

  const removeActivity = (id: string) => {
    if (activities.length === 1) {
        setActivities([{ id: '1', title: '', startTime: new Date(), endTime: new Date(new Date().getTime() + 30 * 60000), linkedApp: '', alarm: false }]);
        return;
    }
    setActivities(activities.filter(a => a.id !== id));
  };

  const updateActivityTitle = (id: string, text: string) => {
    setActivities(activities.map(a => a.id === id ? { ...a, title: text } : a));
  };
  
  const toggleActivityAlarm = (id: string) => {
      setActivities(activities.map(a => a.id === id ? { ...a, alarm: !a.alarm } : a));
  };

  const handleGetSuggestions = async () => {
    setIsAiLoading(true);
    try {
        const suggestions = await AiService.suggestHabits(goalTitle);
        setAiSuggestions(suggestions);
        setShowAiModal(true);
    } catch (e) {
        console.error("AI Error", e);
    } finally {
        setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (!goalTitle?.trim()) return;
    if (!(activities.length === 1 && activities[0].title.trim() === '')) return;

    let isCancelled = false;

    const preloadSuggestions = async () => {
      setIsAiLoading(true);
      try {
        const suggestions = await AiService.suggestHabits(goalTitle);
        if (!isCancelled) {
          setAiSuggestions(suggestions);
          if (suggestions.length > 0) {
            setActivities(suggestions.slice(0, 3).map((suggestion, index) => ({
              id: `${Date.now()}-${index}`,
              title: suggestion,
              startTime: new Date(),
              endTime: new Date(new Date().getTime() + 30 * 60000),
              linkedApp: '',
              alarm: false
            })));
          }
        }
      } catch (error) {
        console.error('Failed to preload plan suggestions', error);
      } finally {
        if (!isCancelled) {
          setIsAiLoading(false);
        }
      }
    };

    preloadSuggestions();

    return () => {
      isCancelled = true;
    };
  }, [goalTitle]);

  const handleSelectSuggestion = (suggestion: string) => {
    // If the first activity is empty, replace it
    if (activities.length === 1 && activities[0].title === '') {
        setActivities([{ ...activities[0], title: suggestion }]);
    } else {
        addActivity(suggestion);
    }
    setShowAiModal(false);
  };

  const handleSave = async () => {
    if (!user) return;
    
    const validActivities = activities.filter(a => a.title.trim() !== '');
    if (validActivities.length === 0) return;

    // Check for conflicts
    const dateStr = date.toISOString().split('T')[0];
    let hasConflict = false;

    // We check each activity against the DB. 
    // Note: This doesn't strictly check for conflicts *within* the new batch, 
    // but usually users add sequential items here.
    for (const activity of validActivities) {
        const startStr = format(activity.startTime, 'HH:mm');
        const endStr = format(activity.endTime, 'HH:mm');
        const conflict = await DataService.checkConflict(user.uid, dateStr, startStr, endStr);
        if (conflict) {
            hasConflict = true;
            break; 
        }
    }

    if (hasConflict) {
        Alert.alert(
            "Time Conflict",
            "One or more activities overlap with existing plans. Do you want to continue?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Accept", onPress: () => performSave(validActivities) }
            ]
        );
    } else {
        performSave(validActivities);
    }
  };

  const performSave = async (validActivities: ActivityItem[]) => {
    if (!user) return;
    setIsSubmitting(true);
    
    const baseDate = new Date(date);
    
    // Determine Limit Date
    let limitDate: Date | undefined;
    if (targetDate) {
        limitDate = new Date(targetDate);
    }
    
    const datesToSave = generateRecurringDates(
        baseDate, 
        repeatEnabled ? repeatFrequency : 'Never', 
        customRepeatConfig, 
        limitDate
    );

    try {
        const promises: Promise<any>[] = [];

        for (const d of datesToSave) {
            const dateString = d.toISOString().split('T')[0];
            
            for (const activity of validActivities) {
                // Schedule Alarm
                let notificationId: string | undefined;
                if (activity.alarm) {
                    const triggerDate = new Date(d);
                    triggerDate.setHours(activity.startTime.getHours());
                    triggerDate.setMinutes(activity.startTime.getMinutes());
                    triggerDate.setSeconds(0);
                    
                    if (triggerDate > new Date()) {
                        const id = await NotificationService.scheduleNotification(
                            goalTitle, // Title: Plan Title
                            `It's time to ${activity.title}`, // Body: It's time to {activity}
                            triggerDate,
                            activity.linkedApp ? { linkedApp: activity.linkedApp } : undefined
                        );
                        if (id) notificationId = id;
                    }
                }

                promises.push(DataService.createGoalSystem(user.uid, {
                    goalId,
                    goalTitle,
                    title: activity.title,
                    date: dateString,
                    startTime: format(activity.startTime, 'HH:mm'),
                    endTime: format(activity.startTime, 'HH:mm'), // Set End Time same as Start Time to hide duration
                    isCompleted: false,
                    successPercentage: 0,
                    linkedApp: activity.linkedApp,
                    repeat: repeatEnabled ? repeatFrequency : 'Never',
                    alarm: activity.alarm,
                    notificationId
                }));
            }
        }
        
        await Promise.all(promises);
        navigation.navigate('MainTabs', { screen: 'PlansList' });
    } catch (error) {
        console.error("Error saving plan:", error);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center border-b border-gray-200 bg-white p-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <ArrowLeft size={24} color="black" />
        </TouchableOpacity>
        <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">Isolate Activities</Text>
            <Text className="text-xs text-gray-500">For: {goalTitle}</Text>
        </View>
        <TouchableOpacity 
            onPress={handleGetSuggestions} 
            disabled={isAiLoading}
            className="flex-row items-center rounded-full bg-indigo-50 px-3 py-1"
        >
            {isAiLoading ? <ActivityIndicator size="small" color="#6366f1" /> : <Sparkles size={16} color="#6366f1" />}
            <Text className="ml-1 text-xs font-bold text-indigo-600">AI Help</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 p-4">
        {aiSuggestions.length > 0 ? (
          <View className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <Text className="mb-2 text-sm font-bold text-indigo-900">AI activity ideas for this plan</Text>
            {aiSuggestions.slice(0, 5).map((suggestion) => (
              <Text key={suggestion} className="mb-1 text-sm text-indigo-800">{`\u2022 ${suggestion}`}</Text>
            ))}
          </View>
        ) : null}

        <View className="mb-6">
          <Text className="mb-2 text-center text-sm font-medium text-gray-500">
             Pick any day between {(() => {
                 try {
                     return format(new Date(startDate), 'MMM d, yyyy');
                 } catch (e) {
                     return startDate;
                 }
             })()} to {targetDate ? (() => {
                 try {
                     return format(new Date(targetDate), 'MMM d, yyyy');
                 } catch (e) {
                     return targetDate;
                 }
             })() : 'forever'} to create your plan.
          </Text>
          <Text className="mb-2 text-sm font-medium text-gray-700">Select Date</Text>
          <TouchableOpacity 
            onPress={() => setShowDatePicker(true)}
            className="flex-row items-center rounded-lg border border-gray-300 p-3"
          >
            <Calendar size={20} color="gray" className="mr-2" />
            <Text className="text-base text-gray-900">{date.toISOString().split('T')[0]}</Text>
          </TouchableOpacity>
          {renderDatePicker(showDatePicker, date, onDateChange)}
        </View>

        <Text className="mb-4 text-lg font-semibold text-gray-900">Activities</Text>

        {activities.map((activity, index) => {
            const appName = COMMON_APPS.find(a => a.schema === activity.linkedApp)?.name || 'Link App';
            return (
            <View key={activity.id} className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <View className="mb-3 flex-row items-center justify-between">
                    <Text className="font-medium text-gray-700">Activity {index + 1}</Text>
                    <TouchableOpacity onPress={() => removeActivity(activity.id)}>
                        <Trash2 size={20} color="#ef4444" />
                    </TouchableOpacity>
                </View>
                
                <TextInput
                    className="mb-3 rounded-md border border-gray-300 bg-white p-3"
                    placeholder="Activity Title"
                    value={activity.title}
                    onChangeText={(text) => updateActivityTitle(activity.id, text)}
                />
                
                <View className="flex-row gap-2">
                    <TouchableOpacity 
                        onPress={() => setShowTimePicker({ id: activity.id, type: 'start' })}
                        className="flex-1 flex-row items-center rounded-md border border-gray-200 bg-white p-2"
                    >
                        <Clock size={16} color="gray" className="mr-2" />
                        <Text>{format(activity.startTime, 'HH:mm')}</Text>
                    </TouchableOpacity>

                    {/* End Time Removed from UI per request */}
                    {/* <TouchableOpacity 
                        onPress={() => setShowTimePicker({ id: activity.id, type: 'end' })}
                        className="flex-1 flex-row items-center rounded-md border border-gray-200 bg-white p-2"
                    >
                        <Clock size={16} color="gray" className="mr-2" />
                        <Text>{format(activity.endTime, 'HH:mm')}</Text>
                    </TouchableOpacity> */}

                    <TouchableOpacity 
                        onPress={() => {
                            if (subscriptionTier === 'free') {
                                Alert.alert(
                                    "Premium Feature",
                                    "Linking apps to plans is available only for Premium subscribers.",
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        { text: "Upgrade", onPress: upgradeToPremium }
                                    ]
                                );
                            } else {
                                setShowAppPicker({ id: activity.id });
                            }
                        }}
                        className={`flex-1 flex-row items-center rounded-md border p-2 ${activity.linkedApp ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}
                    >
                        <Smartphone size={16} color={activity.linkedApp ? "#4f46e5" : "gray"} className="mr-2" />
                        <Text className={`text-xs ${activity.linkedApp ? 'text-indigo-700 font-bold' : 'text-gray-500'}`} numberOfLines={1}>
                            {activity.linkedApp ? appName : (subscriptionTier === 'free' ? 'Unlock App' : 'Link App')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
            );
        })}

        {renderTimePicker()}

        <TouchableOpacity 
            className="mb-8 flex-row items-center justify-center rounded-lg border border-dashed border-gray-300 p-4"
            onPress={() => addActivity('')}
        >
            <Plus size={20} color="gray" className="mr-2" />
            <Text className="text-gray-600">Add Another Activity</Text>
        </TouchableOpacity>

        {/* Repeat Settings */}
        <View className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
            <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                    <Repeat size={20} color={repeatEnabled ? "#0ea5e9" : "gray"} className="mr-2" />
                    <Text className="text-base font-medium text-gray-900">Repeat Plan</Text>
                </View>
                <Switch 
                    value={repeatEnabled} 
                    onValueChange={setRepeatEnabled}
                    trackColor={{ false: "#e5e7eb", true: "#bae6fd" }}
                    thumbColor={repeatEnabled ? "#0ea5e9" : "#f4f4f5"}
                />
            </View>
            
            {repeatEnabled && (
                <View>
                    <Text className="text-xs text-gray-500 mb-2">Repeat this day's plan:</Text>
                    <TouchableOpacity 
                        onPress={() => setShowRepeatPicker(true)}
                        className="flex-row items-center justify-between rounded-md border border-gray-300 bg-gray-50 p-3"
                    >
                        <Text className="text-gray-900">{repeatFrequency}</Text>
                        <Text className="text-xs text-blue-500">Change</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>

        <TouchableOpacity
          className={`items-center justify-center rounded-lg bg-sky-500 p-4 mb-20 ${isSubmitting ? 'opacity-70' : ''}`} // Added more bottom margin (mb-20)
          onPress={handleSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-bold text-white">Save Plan</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* AI Suggestions Modal */}
      <Modal
        visible={showAiModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAiModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
            <View className="rounded-t-xl bg-white p-6 h-2/3">
                <View className="mb-4 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                        <Sparkles size={20} color="#6366f1" className="mr-2" />
                        <Text className="text-lg font-bold text-gray-900">AI Suggestions</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowAiModal(false)}>
                        <X size={24} color="gray" />
                    </TouchableOpacity>
                </View>
                
                <Text className="mb-4 text-sm text-gray-500">
                    Select an activity to add to your plan:
                </Text>

                <ScrollView>
                    {aiSuggestions.map((suggestion, idx) => (
                        <TouchableOpacity 
                            key={idx}
                            className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50 p-4"
                            onPress={() => handleSelectSuggestion(suggestion)}
                        >
                            <Text className="font-medium text-indigo-900">{suggestion}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
      </Modal>

      {/* App Picker Modal */}
      <AppSelectionModal 
        visible={!!showAppPicker}
        onClose={() => setShowAppPicker(null)}
        onSelect={(pkg) => {
            if (showAppPicker) {
                updateActivityApp(showAppPicker.id, pkg);
            }
        }}
      />

      {/* Repeat Frequency Picker Modal */}
      <Modal
        visible={showRepeatPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRepeatPicker(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
            <View className="bg-white rounded-t-xl p-6">
                <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-lg font-bold text-gray-900">Select Frequency</Text>
                    <TouchableOpacity onPress={() => setShowRepeatPicker(false)}>
                        <X size={24} color="gray" />
                    </TouchableOpacity>
                </View>
                {['Daily', 'Weekly', 'Monthly', 'Yearly', 'Custom'].map((freq) => (
                    <TouchableOpacity 
                        key={freq}
                        className={`p-4 border-b border-gray-100 ${repeatFrequency === freq ? 'bg-sky-50' : ''}`}
                        onPress={() => {
                            if (freq === 'Custom') {
                                setShowRepeatPicker(false);
                                setShowCustomRepeatModal(true);
                            } else {
                                setRepeatFrequency(freq as RepeatFrequency);
                                setShowRepeatPicker(false);
                            }
                        }}
                    >
                        <Text className={`text-base ${repeatFrequency === freq ? 'text-sky-600 font-bold' : 'text-gray-900'}`}>
                            {freq === 'Daily' ? 'Every Day' : (freq === 'Custom' ? 'Custom...' : `Every ${freq.replace('ly', '')}`)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
      </Modal>

      <CustomRepeatModal
        visible={showCustomRepeatModal}
        onClose={() => setShowCustomRepeatModal(false)}
        onSave={(config) => {
            setCustomRepeatConfig(config);
            setRepeatFrequency('Custom');
        }}
        initialConfig={customRepeatConfig}
      />
    </SafeAreaView>
  );
}
