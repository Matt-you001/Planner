import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Platform, Modal, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Zap, Wand2, Calendar, Plus, Trash2, Clock, Smartphone, X, Bell, BellOff, Repeat } from 'lucide-react-native';
import { DataService } from '../lib/DataService';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { RepeatFrequency, CustomRepeatConfig } from '../lib/types';
import CustomRepeatModal from '../components/CustomRepeatModal';
import { generateRecurringDates } from '../lib/recurrence';
// import { FlatList, Image } from 'react-native'; // Removed unused imports
// import { getInstalledApps } from '../services/InstalledApps'; // Removed invalid import
import AppSelectionModal from '../components/AppSelectionModal';

// Common Apps for Linking (Fallback if needed, though modal handles it)
const COMMON_APPS = [
    { name: 'WhatsApp', schema: 'whatsapp://' },
    { name: 'Instagram', schema: 'instagram://' },
    { name: 'Twitter', schema: 'twitter://' },
    { name: 'YouTube', schema: 'youtube://' },
    { name: 'Spotify', schema: 'spotify://' },
    { name: 'Google Maps', schema: 'com.google.android.apps.maps' },
    { name: 'Chrome', schema: 'googlechrome://' },
    { name: 'Gmail', schema: 'googlegmail://' },
];

interface StackPart {
  title: string;
  startTime: Date;
  linkedApp: string;
  alarm: boolean;
}

interface StackItem {
  id: string;
  trigger: StackPart;
  response: StackPart;
  stacked: StackPart;
  reward: StackPart;
}

export default function PlanStackScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user, subscriptionTier, upgradeToPremium } = useAuth();
  const {
    goalId,
    goalTitle,
    startDate,
    initialSelectedDate,
    draftGoalTitle,
    draftCategory,
    draftStartDate,
    draftLinkedPlanId
  } = route.params;
  const resolvedGoalTitle = goalTitle || draftGoalTitle || 'Habit';
  const resolvedStartDate = draftStartDate || startDate;

  const [isSaving, setIsSaving] = useState(false);
  
  // Date State
  // Default to initialSelectedDate if provided, else startDate, else today.
  const [date, setDate] = useState(
      initialSelectedDate ? new Date(initialSelectedDate) : 
      (resolvedStartDate ? new Date(resolvedStartDate) : new Date())
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Time Picker State
  const [showTimePicker, setShowTimePicker] = useState<{ 
      stackId: string, 
      part: keyof Omit<StackItem, 'id'>
  } | null>(null);

  // App Picker State
  const [showAppPicker, setShowAppPicker] = useState<{
      stackId: string,
      part: keyof Omit<StackItem, 'id'>
  } | null>(null);
  const [customAppUrl, setCustomAppUrl] = useState('');

  // Repeat State
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>('Daily');
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [customRepeatConfig, setCustomRepeatConfig] = useState<CustomRepeatConfig | undefined>();
  const [showCustomRepeatModal, setShowCustomRepeatModal] = useState(false);

  React.useEffect(() => {
    if (subscriptionTier !== 'free') return;

    Alert.alert(
      "Premium Feature",
      "Building habits is available only for Premium subscribers.",
      [
        { text: "Back", onPress: () => navigation.goBack() },
        { text: "Upgrade", onPress: () => {
            upgradeToPremium();
            navigation.goBack();
          }
        }
      ]
    );
  }, [navigation, subscriptionTier, upgradeToPremium]);

  // Stacks List
  const [stacks, setStacks] = useState<StackItem[]>([
    {
      id: '1',
      trigger: { title: '', startTime: getRoundedDate(0, 0), linkedApp: '', alarm: true },
      response: { title: '', startTime: getRoundedDate(0, 5), linkedApp: '', alarm: true },
      stacked: { title: '', startTime: getRoundedDate(0, 10), linkedApp: '', alarm: true },
      reward: { title: '', startTime: getRoundedDate(0, 15), linkedApp: '', alarm: true },
    }
  ]);
  const partOrder: (keyof Omit<StackItem, 'id'>)[] = ['trigger', 'response', 'stacked', 'reward'];

  function getRoundedDate(hourOffset: number = 0, minuteOffset: number = 0) {
      const start = new Date();
      start.setSeconds(0, 0);
      const remainder = start.getMinutes() % 5;
      if (remainder !== 0) {
          start.setMinutes(start.getMinutes() + (5 - remainder));
      }
      start.setHours(start.getHours() + hourOffset);
      start.setMinutes(start.getMinutes() + minuteOffset);
      return start;
  }

  // Helper to create default part
  const createPart = (title: string = '', hourOffset: number = 0, minuteOffset: number = 0): StackPart => {
      const start = getRoundedDate(hourOffset, minuteOffset);
      return { title, startTime: start, linkedApp: '', alarm: true };
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(null);
    
    if (selectedDate && showTimePicker) {
        setStacks(prev => prev.map(s => {
            if (s.id === showTimePicker.stackId) {
                const partKey = showTimePicker.part;
                
                let newStack = {
                    ...s,
                    [partKey]: {
                        ...s[partKey],
                        startTime: selectedDate
                    }
                };

                const currentIdx = partOrder.indexOf(partKey);
                if (currentIdx !== -1 && currentIdx < partOrder.length - 1) {
                    let previousStart = new Date(selectedDate);

                    for (let i = currentIdx + 1; i < partOrder.length; i++) {
                         const thisKey = partOrder[i];
                         const newStart = new Date(previousStart.getTime() + 5 * 60000);
                         newStack[thisKey] = {
                             ...newStack[thisKey],
                             startTime: newStart
                         };
                         previousStart = newStart;
                    }
                }
                
                return newStack;
            }
            return s;
        }));
    }
  };

  const renderDatePicker = (show: boolean, value: Date, onChange: (event: any, date?: Date) => void) => {
    if (!show) return null;
    return (
        <DateTimePicker
            value={value}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onChange}
            minimumDate={resolvedStartDate ? new Date(resolvedStartDate) : undefined}
        />
    );
  };

  const renderTimePicker = () => {
    if (!showTimePicker) return null;
    const stack = stacks.find(s => s.id === showTimePicker.stackId);
    if (!stack) return null;
    const part = stack[showTimePicker.part];

    return (
        <DateTimePicker
            value={part.startTime}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onTimeChange}
        />
    );
  };

  const addStack = () => {
      const idx = stacks.length;
      setStacks(prev => [...prev, {
          id: Date.now().toString(),
          trigger: createPart('', idx, 0),
          response: createPart('', idx, 5),
          stacked: createPart('', idx, 35),
          reward: createPart('', idx, 45)
      }]);
  };

  const removeStack = (id: string) => {
      if (stacks.length === 1) return; 
      setStacks(prev => prev.filter(s => s.id !== id));
  };

  const updatePartTitle = (stackId: string, partKey: keyof Omit<StackItem, 'id'>, text: string) => {
      setStacks(prev => prev.map(s => s.id === stackId ? { 
          ...s, 
          [partKey]: { ...s[partKey], title: text } 
      } : s));
  };

  const updatePartApp = (stackId: string, partKey: keyof Omit<StackItem, 'id'>, appSchema: string) => {
      setStacks(prev => prev.map(s => s.id === stackId ? { 
          ...s, 
          [partKey]: { ...s[partKey], linkedApp: appSchema, alarm: true } // Auto-enable alarm 
      } : s));
      setShowAppPicker(null);
      setCustomAppUrl('');
  };

  const togglePartAlarm = (stackId: string, partKey: keyof Omit<StackItem, 'id'>) => {
      setStacks(prev => prev.map(s => s.id === stackId ? { 
          ...s, 
          [partKey]: { ...s[partKey], alarm: !s[partKey].alarm } 
      } : s));
  };

  const handleSave = async () => {
    if (!user) return;
    
    // Conflict Check
    const dateStr = format(date, 'yyyy-MM-dd');
    let hasConflict = false;
    
    const partsToCheck: StackPart[] = [];
    stacks.forEach(stack => {
        partsToCheck.push(stack.trigger);
        partsToCheck.push(stack.response);
        partsToCheck.push(stack.stacked);
        partsToCheck.push(stack.reward);
    });

    for (const part of partsToCheck) {
        if (!part.startTime) continue;
        
        const startStr = format(part.startTime, 'HH:mm');
        const conflict = await DataService.checkConflict(user.uid, dateStr, startStr, startStr);
        if (conflict) {
            hasConflict = true;
            break;
        }
    }

    if (hasConflict) {
        Alert.alert(
            "Time Conflict",
            "One or more steps overlap with existing plans. Do you want to continue?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Accept", onPress: () => performSave() }
            ]
        );
    } else {
        performSave();
    }
  };

  const performSave = async () => {
    if (!user) return;
    setIsSaving(true);
    const baseDate = new Date(date);
    
    const datesToSave = generateRecurringDates(
        baseDate, 
        repeatEnabled ? repeatFrequency : 'Never', 
        customRepeatConfig, 
        undefined
    );

    try {
        let resolvedGoalId = goalId;

        if (!resolvedGoalId) {
            if (!draftGoalTitle) {
                throw new Error('Missing draft goal details for habit creation.');
            }

            const createdGoal = await DataService.createGoal(user.uid, {
                title: draftGoalTitle,
                category: draftCategory || 'General',
                progress: 0,
                startDate: resolvedStartDate
                    ? new Date(resolvedStartDate).toISOString().split('T')[0]
                    : new Date().toISOString().split('T')[0],
                linkedPlanId: draftLinkedPlanId
            });
            resolvedGoalId = createdGoal.id;
        }

        const promises: Promise<any>[] = [];

        for (const d of datesToSave) {
            const dateStr = format(d, 'yyyy-MM-dd');

            for (const stack of stacks) {
                const parts: { key: keyof Omit<StackItem, 'id'>, titlePrefix: string }[] = [
                    { key: 'trigger', titlePrefix: 'Cue: ' },
                    { key: 'response', titlePrefix: 'Habit: ' },
                    { key: 'stacked', titlePrefix: 'Stack: ' },
                    { key: 'reward', titlePrefix: 'Reward: ' }
                ];

                for (const { key, titlePrefix } of parts) {
                    const part = stack[key];
                    if (!part.title.trim()) continue; // Skip empty parts?

                    promises.push(DataService.createGoalSystem(user.uid, {
                        goalId: resolvedGoalId,
                        goalTitle: resolvedGoalTitle,
                        title: `${titlePrefix}${part.title}`, 
                        date: dateStr, 
                        startTime: format(part.startTime, 'HH:mm'), 
                        endTime: format(part.startTime, 'HH:mm'),
                        isCompleted: false,
                        successPercentage: 0,
                        linkedApp: part.linkedApp,
                        repeat: repeatEnabled ? repeatFrequency : 'Never',
                        alarm: part.alarm
                    }));
                }
            }
        }

        await Promise.all(promises);
        navigation.navigate('MainTabs', { screen: 'PlansList' });
    } catch (e) {
        console.error("Save failed", e);
    } finally {
        setIsSaving(false);
    }
  };

  const removePart = (stackId: string, partKey: keyof Omit<StackItem, 'id'>) => {
    // We replace the part with empty values effectively "removing" it from view, 
    // or we could track active parts. For simplicity in this fixed structure, we just clear it.
    // User requested "remove the number of rows". 
    // Since our data structure is fixed 4 parts per stack, we can't easily delete one part 
    // without breaking the "Trigger->Habit->Stack->Reward" flow or changing the type definition.
    // However, we can just clear the title and maybe hide it if title is empty?
    // Better yet, let's allow clearing.
    setStacks(prev => prev.map(s => s.id === stackId ? {
        ...s,
        [partKey]: { ...s[partKey], title: '', linkedApp: '' }
    } : s));
  };

  // Render a single part row (Title input + Time + Link App)
  const renderPartRow = (stack: StackItem, partKey: keyof Omit<StackItem, 'id'>, label: string, placeholder: string) => {
      const part = stack[partKey];
      const appName = COMMON_APPS.find(a => a.schema === part.linkedApp)?.name || part.linkedApp || 'Link App';

      return (
        <View className="mb-4">
            <Text className="mb-1 text-sm font-bold text-gray-900">{label}</Text>
            
            <View className="flex-row gap-2 items-center mb-2">
                <TextInput 
                    className="flex-1 rounded-lg border border-gray-300 p-3 bg-white"
                    value={part.title}
                    onChangeText={(text) => updatePartTitle(stack.id, partKey, text)}
                    placeholder={placeholder}
                />
                <TouchableOpacity 
                    onPress={() => removePart(stack.id, partKey)}
                    className="p-2"
                >
                    <Trash2 size={20} color="#ef4444" />
                </TouchableOpacity>
            </View>

            <View className="flex-row gap-2">
                <TouchableOpacity 
                    onPress={() => setShowTimePicker({ stackId: stack.id, part: partKey })}
                    className="flex-1 flex-row items-center rounded-md border border-gray-200 bg-gray-50 p-2"
                >
                    <Clock size={14} color="gray" className="mr-1" />
                    <Text className="text-xs">{format(part.startTime, 'HH:mm')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => {
                        if (subscriptionTier === 'free') {
                            Alert.alert(
                                "Premium Feature",
                                "Linking apps to habit stacks is available only for Premium subscribers.",
                                [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Upgrade", onPress: upgradeToPremium }
                                ]
                            );
                        } else {
                            setShowAppPicker({ stackId: stack.id, part: partKey });
                        }
                    }}
                    className={`flex-1 flex-row items-center rounded-md border p-2 ${part.linkedApp ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}
                >
                    <Smartphone size={14} color={part.linkedApp ? "#4f46e5" : "gray"} className="mr-1" />
                    <Text className={`text-xs ${part.linkedApp ? 'text-indigo-700 font-bold' : 'text-gray-500'}`} numberOfLines={1}>
                        {part.linkedApp ? (appName.length > 8 ? 'App Linked' : appName) : (subscriptionTier === 'free' ? 'Unlock' : 'Link App')}
                    </Text>
                </TouchableOpacity>
            </View>
            <View className="mt-2 flex-row items-center justify-between rounded-md border border-sky-100 bg-sky-50 px-3 py-2">
                <View className="flex-row items-center">
                    {part.alarm ? <Bell size={16} color="#0284c7" /> : <BellOff size={16} color="#64748b" />}
                    <Text className="ml-2 text-xs font-semibold text-gray-700">
                        Reminder at {format(part.startTime, 'HH:mm')}
                    </Text>
                </View>
                <Switch
                    value={part.alarm}
                    onValueChange={() => togglePartAlarm(stack.id, partKey)}
                    trackColor={{ false: '#cbd5e1', true: '#7dd3fc' }}
                    thumbColor={part.alarm ? '#0284c7' : '#f8fafc'}
                />
            </View>
        </View>
      );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center border-b border-gray-200 bg-white p-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <ArrowLeft size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">Habit Stack Builder</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        <View className="mb-6 flex-row items-center gap-3 bg-yellow-50 p-4 rounded-lg border border-yellow-100">
            <Wand2 size={24} color="#ca8a04" />
            <View className="flex-1">
                <Text className="text-lg font-bold text-black-900">{resolvedGoalTitle}</Text>
                <Text className="text-base text-black-800">Build your stack manually and adjust the times and activities as needed.</Text>
            </View>
        </View>

        <View className="mb-6">
          <Text className="mb-2 text-center text-sm font-medium text-gray-500">
             Pick any day on or after {(() => {
                 try {
                     return format(new Date(resolvedStartDate), 'MMM d, yyyy');
                 } catch (e) {
                     return resolvedStartDate;
                 }
             })()} to create your plan.
          </Text>
          <Text className="mb-2 text-sm font-medium text-gray-700">Select Date</Text>
          <TouchableOpacity 
            onPress={() => setShowDatePicker(true)}
            className="flex-row items-center rounded-lg border border-gray-300 p-3"
          >
            <Calendar size={20} color="gray" className="mr-2" />
            <Text className="text-base text-gray-900">{format(date, 'yyyy-MM-dd')}</Text>
          </TouchableOpacity>
          {renderDatePicker(showDatePicker, date, onDateChange)}
        </View>

        {stacks.map((stack, index) => (
            <View key={stack.id} className="mb-8 border-b border-gray-200 pb-8">
                <View className="mb-4 flex-row items-center justify-between">
                    <Text className="text-lg font-bold text-gray-900">Stack {index + 1}</Text>
                    {stacks.length > 1 && (
                        <TouchableOpacity onPress={() => removeStack(stack.id)}>
                            <Trash2 size={20} color="#ef4444" />
                        </TouchableOpacity>
                    )}
                </View>

                <View className="gap-2">
                    {renderPartRow(stack, 'trigger', '1. Cue / Trigger', 'e.g., After I pour my coffee...')}
                    {renderPartRow(stack, 'response', '2. Main Habit', 'e.g., I will meditate for 1 minute')}
                    {renderPartRow(stack, 'stacked', '3. Stacked Habit', 'e.g., I will write my to-do list')}
                    {renderPartRow(stack, 'reward', '4. Reward', 'e.g., I will check my social media')}
                </View>
            </View>
        ))}

        <View className="mb-8 flex-row gap-4">
            <TouchableOpacity 
                className="flex-1 items-center justify-center rounded-lg border border-dashed border-gray-300 p-4"
                onPress={addStack}
            >
                <Plus size={24} color="gray" className="mb-2" />
                <Text className="text-gray-600 text-center font-medium">Add Stack</Text>
            </TouchableOpacity>

            <View className="flex-1 rounded-lg border border-gray-200 bg-white p-4 justify-center">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 mr-2">
                        <Repeat size={20} color={repeatEnabled ? "#0ea5e9" : "gray"} className="mr-2" />
                        <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>Repeat</Text>
                    </View>
                    <Switch 
                        value={repeatEnabled} 
                        onValueChange={setRepeatEnabled}
                        trackColor={{ false: "#e5e7eb", true: "#bae6fd" }}
                        thumbColor={repeatEnabled ? "#0ea5e9" : "#f4f4f5"}
                        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                </View>
                
                {repeatEnabled && (
                    <TouchableOpacity 
                        onPress={() => setShowRepeatPicker(true)}
                        className="mt-2 flex-row items-center justify-between rounded-md border border-gray-300 bg-gray-50 p-2"
                    >
                        <Text className="text-gray-900 text-xs flex-1" numberOfLines={1}>{repeatFrequency}</Text>
                        <Text className="text-xs text-blue-500 font-bold ml-1">Edit</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>

        <TouchableOpacity 
            className="mb-20 w-full items-center justify-center rounded-lg bg-sky-500 p-4"
            onPress={handleSave}
            disabled={isSaving}
        >
             {isSaving ? (
                <ActivityIndicator color="white" />
            ) : (
                <Text className="text-base font-bold text-white">Save All Stacks</Text>
            )}
        </TouchableOpacity>
      </ScrollView>

      {renderTimePicker()}

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

      {/* App Picker Modal */}
      <AppSelectionModal 
        visible={!!showAppPicker}
        onClose={() => setShowAppPicker(null)}
        onSelect={(pkg) => {
            if (showAppPicker) {
                updatePartApp(showAppPicker.stackId, showAppPicker.part, pkg);
            }
        }}
      />
    </SafeAreaView>
  );
}
