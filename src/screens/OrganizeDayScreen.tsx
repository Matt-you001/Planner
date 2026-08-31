import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bell,
  CalendarDays,
  Check,
  Clock3,
  ListPlus,
  Sparkles,
  Trash2
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { AiService } from '../lib/AiService';
import { DataService } from '../lib/DataService';

type Priority = 'High' | 'Medium' | 'Low';

type OrganizerActivity = {
  id: string;
  title: string;
  duration: string;
  priority: Priority;
};

type ScheduledActivity = OrganizerActivity & {
  startMinutes: number;
  endMinutes: number;
  breakMinutes: number;
};

const PRIORITIES: Priority[] = ['High', 'Medium', 'Low'];
const PRIORITY_SCORE: Record<Priority, number> = { High: 3, Medium: 2, Low: 1 };

function clampDuration(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(240, Math.max(5, parsed));
}

function getInitialStartTime() {
  const date = new Date();
  const roundedMinutes = Math.ceil((date.getMinutes() + 5) / 15) * 15;
  date.setSeconds(0, 0);
  date.setMinutes(roundedMinutes);
  return date;
}

function minutesFromDate(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function formatClock(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return format(date, 'h:mm a');
}

function formatTimeValue(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function buildSchedule(activities: OrganizerActivity[], startMinutes: number): ScheduledActivity[] {
  let cursor = startMinutes;

  return activities.map((activity, index) => {
    const duration = clampDuration(activity.duration);
    const breakMinutes = index === activities.length - 1 ? 0 : duration >= 90 ? 15 : 10;
    const scheduled = {
      ...activity,
      duration: String(duration),
      startMinutes: cursor,
      endMinutes: cursor + duration,
      breakMinutes
    };

    cursor += duration + breakMinutes;
    return scheduled;
  });
}

export default function OrganizeDayScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [initialStart] = useState(getInitialStartTime);
  const [activities, setActivities] = useState<OrganizerActivity[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDuration, setDraftDuration] = useState('30');
  const [draftPriority, setDraftPriority] = useState<Priority>('Medium');
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(initialStart));
  const [dayStart, setDayStart] = useState<Date>(initialStart);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [hasOrganized, setHasOrganized] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [organizerNote, setOrganizerNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const dateValue = format(selectedDate, 'yyyy-MM-dd');
  const dateLabel = isSameDay(selectedDate, new Date())
    ? `Today, ${format(selectedDate, 'MMM d')}`
    : isSameDay(selectedDate, addDays(new Date(), 1))
      ? `Tomorrow, ${format(selectedDate, 'MMM d')}`
      : format(selectedDate, 'EEE, MMM d, yyyy');
  const schedule = useMemo(
    () => buildSchedule(activities, minutesFromDate(dayStart)),
    [activities, dayStart]
  );
  const scheduleEnd = schedule[schedule.length - 1]?.endMinutes ?? minutesFromDate(dayStart);
  const totalActivityMinutes = schedule.reduce(
    (total, activity) => total + clampDuration(activity.duration),
    0
  );

  const addActivity = () => {
    const title = draftTitle.trim();
    if (!title) {
      Alert.alert('Activity Needed', 'Enter an activity before adding it to the day.');
      return;
    }

    setActivities(current => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        title,
        duration: String(clampDuration(draftDuration)),
        priority: draftPriority
      }
    ]);
    setDraftTitle('');
    setDraftDuration('30');
    setDraftPriority('Medium');
  };

  const organizeLocally = (source: OrganizerActivity[]) =>
    source
      .map((activity, index) => ({ activity, index }))
      .sort((left, right) => {
        const priorityDifference =
          PRIORITY_SCORE[right.activity.priority] - PRIORITY_SCORE[left.activity.priority];
        if (priorityDifference !== 0) return priorityDifference;

        const durationDifference =
          clampDuration(right.activity.duration) - clampDuration(left.activity.duration);
        if (durationDifference !== 0) return durationDifference;
        return left.index - right.index;
      })
      .map(({ activity }) => activity);

  const organizeActivities = async () => {
    if (activities.length === 0) {
      Alert.alert('Add Activities', 'Add at least one activity before organizing your day.');
      return;
    }

    setIsOrganizing(true);
    try {
      const result = await AiService.organizeDay(
        activities.map(activity => ({
          id: activity.id,
          title: activity.title,
          durationMinutes: clampDuration(activity.duration),
          priority: activity.priority
        })),
        format(dayStart, 'HH:mm'),
        dateValue
      );

      const currentById = new Map(activities.map(activity => [activity.id, activity]));
      const returnedIds = result?.activities.map(activity => activity.sourceId) ?? [];
      const responseIsComplete =
        result !== null &&
        returnedIds.length === activities.length &&
        new Set(returnedIds).size === activities.length &&
        returnedIds.every(id => currentById.has(id));

      if (result && responseIsComplete) {
        setActivities(
          result.activities.map(activity => ({
            id: activity.sourceId,
            title: activity.title.trim() || currentById.get(activity.sourceId)!.title,
            duration: String(activity.durationMinutes),
            priority: activity.priority
          }))
        );
        setOrganizerNote(result.summary?.trim() || 'AI organized your activities into a focused, realistic sequence.');
      } else {
        setActivities(organizeLocally(activities));
        setOrganizerNote('A reliable offline schedule was created because live AI was unavailable.');
      }

      setHasOrganized(true);
    } finally {
      setIsOrganizing(false);
    }
  };

  const updateActivity = (id: string, updates: Partial<OrganizerActivity>) => {
    setActivities(current =>
      current.map(activity => (activity.id === id ? { ...activity, ...updates } : activity))
    );
  };

  const moveActivity = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= activities.length) return;

    setActivities(current => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const removeActivity = (id: string) => {
    setActivities(current => current.filter(activity => activity.id !== id));
  };

  const openDatePicker = () => {
    setShowTimePicker(false);
    setShowDatePicker(true);
  };

  const openTimePicker = () => {
    setShowDatePicker(false);
    setShowTimePicker(true);
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (event.type === 'set' && selectedTime) {
      setDayStart(selectedTime);

      const proposedStart = new Date(selectedDate);
      proposedStart.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      if (isSameDay(selectedDate, new Date()) && proposedStart.getTime() <= Date.now()) {
        const tomorrow = startOfDay(addDays(new Date(), 1));
        setSelectedDate(tomorrow);
        Alert.alert(
          'Scheduled for Tomorrow',
          `${format(selectedTime, 'h:mm a')} has already passed today, so PlanApp moved this schedule to ${format(tomorrow, 'EEEE, MMMM d')}.`
        );
      }
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (event.type === 'set' && date) {
      setSelectedDate(startOfDay(date));
    }
  };

  const acceptSchedule = async () => {
    if (!user || schedule.length === 0) return;

    const invalidActivity = schedule.find(activity => !activity.title.trim());
    if (invalidActivity) {
      Alert.alert('Activity Needed', 'Every scheduled activity must have a title.');
      return;
    }

    if (scheduleEnd >= 1440) {
      Alert.alert(
        'Schedule Runs Past Midnight',
        'Shorten some activities or choose an earlier start time so this daily schedule finishes today.'
      );
      return;
    }

    const scheduledStart = new Date(selectedDate);
    scheduledStart.setHours(dayStart.getHours(), dayStart.getMinutes(), 0, 0);
    if (scheduledStart.getTime() <= Date.now()) {
      Alert.alert(
        'Choose a Future Date or Time',
        'This schedule starts in the past. Select a later time today or choose a future date.'
      );
      return;
    }

    setIsSaving(true);
    try {
      for (const activity of schedule) {
        await DataService.createTask(user.uid, {
          title: activity.title.trim(),
          date: dateValue,
          startTime: formatTimeValue(activity.startMinutes),
          endTime: formatTimeValue(activity.endMinutes),
          notes: `Organized activity: ${activity.duration} minutes, ${activity.priority.toLowerCase()} priority.`,
          repeat: 'Never',
          alarm: remindersEnabled
        });
      }

      Alert.alert(
        'Day Organized',
        `${schedule.length} ${schedule.length === 1 ? 'activity has' : 'activities have'} been added to ${format(selectedDate, 'EEEE, MMMM d')}.`,
        [{ text: 'View Home', onPress: () => navigation.navigate('MainTabs', { screen: 'Home' }) }]
      );
    } catch (error) {
      console.error('Failed to save organized day', error);
      Alert.alert('Could Not Save', 'Your schedule could not be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="flex-row items-center border-b border-slate-200 bg-white px-4 py-4">
        <TouchableOpacity
          accessibilityLabel="Go back"
          className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-sky-50"
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color="#0284c7" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold text-slate-900">Organize a Day</Text>
          <Text className="text-xs text-slate-500">Build a realistic, editable time-block plan.</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="bg-slate-50 px-4 pb-6 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-5 overflow-hidden rounded-2xl bg-sky-500 p-5">
          <View className="mb-3 h-10 w-10 items-center justify-center rounded-full bg-white/20">
            <Sparkles size={21} color="white" />
          </View>
          <Text className="text-xl font-bold text-white">Turn your list into an executable day</Text>
          <Text className="mt-2 text-sm leading-5 text-white/90">
            Add what you need to do. PlanApp will prioritize the work, allocate focus time, and leave transition space between activities.
          </Text>
        </View>

        <View className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
          <View className="mb-4 flex-row items-center">
            <ListPlus size={20} color="#0369a1" />
            <Text className="ml-2 text-base font-bold text-slate-900">Add activities</Text>
          </View>

          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            What needs to get done?
          </Text>
          <TextInput
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900"
            placeholder="Example: Prepare the client proposal"
            placeholderTextColor="#94a3b8"
            value={draftTitle}
            onChangeText={setDraftTitle}
            returnKeyType="done"
            onSubmitEditing={addActivity}
          />

          <View className="mt-4 flex-row gap-3">
            <View className="flex-1">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Minutes
              </Text>
              <TextInput
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900"
                keyboardType="number-pad"
                value={draftDuration}
                onChangeText={setDraftDuration}
                maxLength={3}
              />
            </View>
            <View className="flex-[2]">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Priority
              </Text>
              <View className="flex-row gap-2">
                {PRIORITIES.map(priority => (
                  <TouchableOpacity
                    key={priority}
                    className={`flex-1 rounded-xl border px-2 py-3 ${
                      draftPriority === priority
                        ? 'border-sky-600 bg-sky-50'
                        : 'border-slate-200 bg-white'
                    }`}
                    onPress={() => setDraftPriority(priority)}
                  >
                    <Text
                      className={`text-center text-xs font-bold ${
                        draftPriority === priority ? 'text-sky-700' : 'text-slate-500'
                      }`}
                    >
                      {priority}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <TouchableOpacity
            className="mt-4 flex-row items-center justify-center rounded-xl bg-sky-500 py-3"
            onPress={addActivity}
          >
            <ListPlus size={18} color="white" />
            <Text className="ml-2 font-bold text-white">Add to My Day</Text>
          </TouchableOpacity>
        </View>

        {activities.length > 0 && !hasOrganized ? (
          <View className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
            <Text className="mb-3 text-base font-bold text-slate-900">
              Your activities ({activities.length})
            </Text>
            {activities.map((activity, index) => (
              <View
                key={activity.id}
                className="mb-2 flex-row items-center rounded-xl bg-slate-50 px-3 py-3"
              >
                <View className="mr-3 h-7 w-7 items-center justify-center rounded-full bg-sky-100">
                  <Text className="text-xs font-bold text-sky-700">{index + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-slate-900">{activity.title}</Text>
                  <Text className="mt-1 text-xs text-slate-500">
                    {activity.duration} min | {activity.priority} priority
                  </Text>
                </View>
                <TouchableOpacity className="p-2" onPress={() => removeActivity(activity.id)}>
                  <Trash2 size={18} color="#dc2626" />
                </TouchableOpacity>
              </View>
            ))}

            <View className="mt-3 rounded-xl bg-sky-50 px-4 py-3">
              <TouchableOpacity
                className="flex-row items-center justify-between border-b border-sky-100 pb-3"
                onPress={openDatePicker}
              >
                <View className="flex-row items-center">
                  <CalendarDays size={19} color="#0284c7" />
                  <View className="ml-3">
                    <Text className="text-xs font-semibold uppercase text-sky-600">Day to organize</Text>
                    <Text className="mt-1 text-base font-bold text-sky-900">{dateLabel}</Text>
                  </View>
                </View>
                <Text className="font-semibold text-sky-700">Change</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="mt-3 flex-row items-center justify-between"
                onPress={openTimePicker}
              >
                <View className="flex-row items-center">
                  <Clock3 size={19} color="#0284c7" />
                  <View className="ml-3">
                    <Text className="text-xs font-semibold uppercase text-sky-600">Start the day at</Text>
                    <Text className="mt-1 text-base font-bold text-sky-900">{format(dayStart, 'h:mm a')}</Text>
                  </View>
                </View>
                <Text className="font-semibold text-sky-700">Change</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              className={`mt-4 flex-row items-center justify-center rounded-xl bg-amber-500 py-4 ${
                isOrganizing ? 'opacity-70' : ''
              }`}
              disabled={isOrganizing}
              onPress={organizeActivities}
            >
              {isOrganizing ? (
                <>
                  <ActivityIndicator color="white" />
                  <Text className="ml-2 text-base font-bold text-white">AI is organizing...</Text>
                </>
              ) : (
                <>
                  <Sparkles size={19} color="white" />
                  <Text className="ml-2 text-base font-bold text-white">Organize My Day</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {showDatePicker ? (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            minimumDate={startOfDay(new Date())}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
          />
        ) : null}

        {showTimePicker ? (
          <DateTimePicker
            value={dayStart}
            mode="time"
            is24Hour={false}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
          />
        ) : null}

        {hasOrganized && schedule.length > 0 ? (
          <View className="mb-5">
            <View className="mb-3 flex-row items-end justify-between">
              <View>
                <Text className="text-lg font-bold text-slate-900">Your organized day</Text>
                <Text className="mt-1 text-xs text-slate-500">
                  {totalActivityMinutes} focus minutes | Finishes {formatClock(scheduleEnd)}
                </Text>
              </View>
              <TouchableOpacity
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                onPress={organizeActivities}
                disabled={isOrganizing}
              >
                {isOrganizing ? (
                  <ActivityIndicator size="small" color="#b45309" />
                ) : (
                  <Text className="text-xs font-bold text-amber-700">Re-organize with AI</Text>
                )}
              </TouchableOpacity>
            </View>

            {organizerNote ? (
              <View className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <Text className="text-xs font-semibold uppercase tracking-wide text-amber-700">Planner's note</Text>
                <Text className="mt-1 text-sm leading-5 text-amber-900">{organizerNote}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              className="mb-3 flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
              onPress={openDatePicker}
            >
              <View className="flex-row items-center">
                <CalendarDays size={19} color="#0369a1" />
                <Text className="ml-2 font-semibold text-slate-700">Schedule date</Text>
              </View>
              <Text className="font-bold text-sky-700">{dateLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="mb-3 flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
              onPress={openTimePicker}
            >
              <View className="flex-row items-center">
                <Clock3 size={19} color="#0369a1" />
                <Text className="ml-2 font-semibold text-slate-700">Schedule starts</Text>
              </View>
              <Text className="font-bold text-sky-700">{format(dayStart, 'h:mm a')}</Text>
            </TouchableOpacity>

            {schedule.map((activity, index) => (
              <View
                key={activity.id}
                className="mb-3 overflow-hidden rounded-xl border border-sky-100 bg-white"
              >
                <View className="flex-row items-center bg-sky-50 px-3 py-2.5">
                  <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-amber-500">
                    <Text className="font-bold text-white">{index + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                      {formatClock(activity.startMinutes)} - {formatClock(activity.endMinutes)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityLabel="Move activity earlier"
                    className={`mr-2 rounded-lg border border-sky-200 bg-white p-2 ${index === 0 ? 'opacity-30' : ''}`}
                    disabled={index === 0}
                    onPress={() => moveActivity(index, -1)}
                  >
                    <ArrowUp size={16} color="#0284c7" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel="Move activity later"
                    className={`rounded-lg border border-sky-200 bg-white p-2 ${
                      index === schedule.length - 1 ? 'opacity-30' : ''
                    }`}
                    disabled={index === schedule.length - 1}
                    onPress={() => moveActivity(index, 1)}
                  >
                    <ArrowDown size={16} color="#0284c7" />
                  </TouchableOpacity>
                </View>

                <View className="p-3">
                  <TextInput
                    className="border-b border-slate-200 pb-2 text-base font-bold text-slate-900"
                    value={activity.title}
                    onChangeText={title => updateActivity(activity.id, { title })}
                  />

                  <View className="mt-3 flex-row items-center">
                    <View className="mr-3 flex-row items-center rounded-lg bg-slate-100 px-3 py-2">
                      <Clock3 size={15} color="#0284c7" />
                      <TextInput
                        className="ml-2 min-w-8 p-0 text-center font-bold text-slate-700"
                        keyboardType="number-pad"
                        maxLength={3}
                        value={activity.duration}
                        onChangeText={duration => updateActivity(activity.id, { duration })}
                        onBlur={() =>
                          updateActivity(activity.id, {
                            duration: String(clampDuration(activity.duration))
                          })
                        }
                      />
                      <Text className="ml-1 text-xs text-slate-500">min</Text>
                    </View>

                    <View className="flex-1 flex-row gap-1.5">
                      {PRIORITIES.map(priority => (
                        <TouchableOpacity
                          key={priority}
                          className={`flex-1 rounded-full border px-1 py-2 ${
                            activity.priority === priority
                              ? 'border-sky-500 bg-sky-50'
                              : 'border-slate-200 bg-white'
                          }`}
                          onPress={() => updateActivity(activity.id, { priority })}
                        >
                          <Text
                            className={`text-center text-[11px] font-semibold ${
                              activity.priority === priority ? 'text-sky-700' : 'text-slate-500'
                            }`}
                          >
                            {priority}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      accessibilityLabel="Remove activity"
                      className="ml-2 rounded-lg border border-red-100 bg-red-50 p-2"
                      onPress={() => removeActivity(activity.id)}
                    >
                      <Trash2 size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>

                  {activity.breakMinutes > 0 ? (
                    <Text className="mt-2 text-xs font-medium text-amber-700">
                      Then allow a {activity.breakMinutes}-minute transition.
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}

            <View className="mt-2 flex-row items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
              <View className="mr-4 flex-1 flex-row items-center">
                <Bell size={19} color="#0369a1" />
                <View className="ml-3 flex-1">
                  <Text className="font-semibold text-slate-900">Start-time reminders</Text>
                  <Text className="mt-1 text-xs text-slate-500">Notify me when each activity begins.</Text>
                </View>
              </View>
              <Switch
                value={remindersEnabled}
                onValueChange={setRemindersEnabled}
                trackColor={{ false: '#cbd5e1', true: '#7dd3fc' }}
                thumbColor={remindersEnabled ? '#0284c7' : '#f8fafc'}
              />
            </View>

          </View>
        ) : null}
      </ScrollView>

      {hasOrganized && schedule.length > 0 ? (
        <View className="border-t border-slate-200 bg-white px-4 py-3">
          <TouchableOpacity
            className={`flex-row items-center justify-center rounded-xl bg-sky-500 py-4 ${
              isSaving ? 'opacity-70' : ''
            }`}
            disabled={isSaving}
            onPress={acceptSchedule}
          >
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Check size={20} color="white" />
                <Text className="ml-2 text-base font-bold text-white">Accept and Save Schedule</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
