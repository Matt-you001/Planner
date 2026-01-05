import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Alert, Switch, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Clock, Calendar, Link2, Bell, BellOff, Repeat, X, Lock } from 'lucide-react-native';
import { DataService } from '../lib/DataService';
import type { RepeatFrequency, CustomRepeatConfig } from '../lib/types';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NotificationService } from '../lib/NotificationService';
import CustomRepeatModal from '../components/CustomRepeatModal';
import AppSelectionModal from '../components/AppSelectionModal';
import { generateRecurringDates } from '../lib/recurrence';

export default function CreateTaskScreen() {
  const navigation = useNavigation();
  const { user, subscriptionTier, upgradeToPremium } = useAuth();
  
  const [title, setTitle] = useState('');
  
  // Date/Time States
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  
  const [endTime, setEndTime] = useState(() => {
    const d = new Date();
    d.setHours(9, 30, 0, 0);
    return d;
  });
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  
  const [linkedApp, setLinkedApp] = useState('');
  
  // Repeat & Alarm State
  const [alarmEnabled, setAlarmEnabled] = useState(true); // Default to TRUE
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>('Daily');
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [customRepeatConfig, setCustomRepeatConfig] = useState<CustomRepeatConfig | undefined>();
  const [showCustomRepeatModal, setShowCustomRepeatModal] = useState(false);
  const [showAppPicker, setShowAppPicker] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const onDateChange = (event: any, selectedDate?: Date) => {
    // On Android, the picker is modal and returns result immediately. 
    // We must dismiss the "show" state immediately.
    setShowDatePicker(Platform.OS === 'ios');
    
    if (event.type === 'set' && selectedDate) {
        setDate(selectedDate);
    }
  };

  const onStartTimeChange = (event: any, selectedDate?: Date) => {
    setShowStartTimePicker(Platform.OS === 'ios');
    
    if (event.type === 'set' && selectedDate) {
        setStartTime(selectedDate);
    }
  };

  const onEndTimeChange = (event: any, selectedDate?: Date) => {
    setShowEndTimePicker(Platform.OS === 'ios');
    
    if (event.type === 'set' && selectedDate) {
        setEndTime(selectedDate);
    }
  };

  const renderPicker = (
    show: boolean,
    value: Date,
    mode: 'date' | 'time',
    onChange: (event: any, date?: Date) => void
  ) => {
    if (!show) return null;

    return (
        <DateTimePicker
            value={value}
            mode={mode}
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onChange}
        />
    );
  };

  const handleCreate = async () => {
    if (!title.trim() || !user) return;

    // Conflict Check
    const dateStr = date.toISOString().split('T')[0];
    const startStr = format(startTime, 'HH:mm');
    // const endStr = format(endTime, 'HH:mm'); // End Time ignored for tasks
    
    // We only check conflict if we had a duration, but since we removed end time, we can assume a default duration (e.g. 30m) or skip end-check
    // For now, let's just pass startStr as endStr to check point-in-time or small window
    const hasConflict = await DataService.checkConflict(user.uid, dateStr, startStr, startStr);

    if (hasConflict) {
        Alert.alert(
            "Time Conflict",
            "This task overlaps with an existing activity. Do you want to continue?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Accept", onPress: () => performCreate() }
            ]
        );
    } else {
        performCreate();
    }
  };

  const performCreate = async () => {
    if (!user) return;
    setIsSubmitting(true);
    
    // Generate Dates
    // No limit date since no goal
    const limitDate = undefined;
    
    const datesToSave = generateRecurringDates(
        date, 
        repeatEnabled ? repeatFrequency : 'Never', 
        customRepeatConfig, 
        limitDate
    );

    try {
      const promises: Promise<any>[] = [];

      for (const d of datesToSave) {
          // Schedule Alarm
          let notificationId: string | undefined;
          if (alarmEnabled) {
              const triggerDate = new Date(d);
              triggerDate.setHours(startTime.getHours());
              triggerDate.setMinutes(startTime.getMinutes());
              triggerDate.setSeconds(0);
              
              if (triggerDate > new Date()) {
                  // Schedule notification exactly at start time
                  // Attach linkedApp to data payload so Dashboard listener can open it on tap
                  const id = await NotificationService.scheduleNotification(
                      title, // Title: Task Title
                      `It's time to ${title}`, // Body: It's time to {Task Title}
                      triggerDate,
                      linkedApp ? { linkedApp } : undefined
                  );
                  if (id) notificationId = id;
              }
          }

          promises.push(DataService.createTask(user.uid, {
            title: title.trim(),
            // goalId is now optional
            date: d.toISOString().split('T')[0],
            startTime: format(startTime, 'HH:mm'),
            endTime: format(startTime, 'HH:mm'), // Set End Time same as Start Time (or undefined if backend supports it) to effectively "hide" duration
            linkedApp: linkedApp || undefined,
            repeat: repeatEnabled ? repeatFrequency : 'Never',
            alarm: alarmEnabled,
            notificationId
          }));
      }

      await Promise.all(promises);
      navigation.goBack();
    } catch (error) {
      console.error("Error creating task:", error);
      navigation.goBack();
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
        <Text className="text-lg font-bold text-gray-900">Set a Task</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-700">Task Title</Text>
          <TextInput
            className="rounded-lg border border-gray-300 p-3 text-base"
            placeholder="e.g. Schedule dentist appointment"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-700">Date</Text>
          <TouchableOpacity 
            onPress={() => setShowDatePicker(true)}
            className="flex-row items-center rounded-lg border border-gray-300 p-3"
          >
            <Calendar size={20} color="gray" className="mr-2" />
            <Text className="text-base text-gray-900">{date.toISOString().split('T')[0]}</Text>
          </TouchableOpacity>
          {renderPicker(showDatePicker, date, 'date', onDateChange)}
        </View>

        <View className="mb-4 flex-row gap-4">
            <View className="flex-1">
                <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-medium text-gray-700">Start Time</Text>
                </View>
                <TouchableOpacity 
                    onPress={() => setShowStartTimePicker(true)}
                    className="flex-row items-center rounded-lg border border-gray-300 p-3"
                >
                    <Clock size={20} color="gray" className="mr-2" />
                    <Text className="text-base text-gray-900">{format(startTime, 'HH:mm')}</Text>
                </TouchableOpacity>
                {renderPicker(showStartTimePicker, startTime, 'time', onStartTimeChange)}
            </View>
            {/* End Time Removed from UI per request */}
            {/* <View className="flex-1">
                <Text className="mb-2 text-sm font-medium text-gray-700">End Time</Text>
                <TouchableOpacity 
                    onPress={() => setShowEndTimePicker(true)}
                    className="flex-row items-center rounded-lg border border-gray-300 p-3"
                >
                    <Clock size={20} color="gray" className="mr-2" />
                    <Text className="text-base text-gray-900">{endTime ? format(endTime, 'HH:mm') : 'None'}</Text>
                </TouchableOpacity>
                {endTime && renderPicker(showEndTimePicker, endTime, 'time', onEndTimeChange)}
            </View> */}
        </View>

          <View className="mb-6">
          <Text className="mb-2 text-sm font-medium text-gray-700">Linked App (Optional)</Text>
          <TouchableOpacity 
            onPress={() => {
                if (subscriptionTier === 'free') {
                    Alert.alert(
                        "Premium Feature",
                        "Linking apps to tasks is available only for Premium subscribers.",
                        [
                            { text: "Cancel", style: "cancel" },
                            { text: "Upgrade", onPress: upgradeToPremium }
                        ]
                    );
                } else {
                    setShowAppPicker(true);
                }
            }}
            className={`flex-row items-center rounded-lg border p-3 ${subscriptionTier === 'free' ? 'bg-gray-100 border-gray-300' : 'border-gray-300'}`}
          >
            <Link2 size={20} color={subscriptionTier === 'free' ? 'gray' : 'gray'} className="mr-2" />
            <Text className={`flex-1 text-base ${linkedApp ? 'text-gray-900' : 'text-gray-400'}`}>
                {linkedApp || (subscriptionTier === 'free' ? "Unlock to link an app" : "Tap to select an app")}
            </Text>
            {subscriptionTier === 'free' ? (
                <Lock size={16} color="gray" />
            ) : (
                linkedApp ? (
                    <TouchableOpacity onPress={() => {
                        setLinkedApp('');
                        setAlarmEnabled(false); // Disable alarm if removing app
                    }}>
                        <X size={20} color="gray" />
                    </TouchableOpacity>
                ) : null
            )}
          </TouchableOpacity>
        </View>

      <AppSelectionModal 
        visible={showAppPicker}
        onClose={() => setShowAppPicker(false)}
        onSelect={(pkg) => {
            setLinkedApp(pkg);
            // Auto-enable alarm if an app is linked, as notification is required to open it
            setAlarmEnabled(true);
        }}
      />

        {/* Repeat Settings */}
        <View className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
            <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                    <Repeat size={20} color={repeatEnabled ? "#0ea5e9" : "gray"} className="mr-2" />
                    <Text className="text-base font-medium text-gray-900">Repeat Task</Text>
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
                    <Text className="text-xs text-gray-500 mb-2">Repeat this task:</Text>
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
          className={`items-center justify-center rounded-lg bg-sky-500 p-4 ${isSubmitting || !title ? 'opacity-70' : ''}`}
          onPress={handleCreate}
          disabled={isSubmitting || !title}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-bold text-white">Create Task</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
      {/* Moved AppSelectionModal to above */}
    </SafeAreaView>
  );
}
