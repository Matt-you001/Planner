import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Calendar as CalendarIcon, ChevronDown } from 'lucide-react-native';
import { DataService } from '../lib/DataService';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Goal } from '../lib/types';

const habitCategories = ['Health & Fitness', 'Skill Building', 'Mindfulness', 'Routine', 'Productivity', 'Wellness'];
const planCategories = ['Career', 'Finance', 'Education', 'Project', 'Travel', 'Personal'];

export default function CreatePlanScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { type, goalId, goalTitle, initialSelectedDate } = route.params || { type: 'habit' }; // Default to 'habit' if undefined, though dashboard should pass it
  const { user } = useAuth();
  
  const [title, setTitle] = useState(goalTitle || '');
  const [category, setCategory] = useState(goalId ? 'Existing Plan' : ''); // Dummy category if existing
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const suggestedCategories = type === 'habit' ? habitCategories : planCategories;
  
  // Link to Plan (for Habit flow)
  const [existingPlans, setExistingPlans] = useState<Goal[]>([]);
  const [linkedPlanId, setLinkedPlanId] = useState<string | undefined>(undefined);
  const [showPlanPicker, setShowPlanPicker] = useState(false);

  // If goalId is passed (Adding to existing), we want to SKIP this setup screen entirely and jump to the next step.
  // But React Navigation 'replace' might be tricky inside render/useEffect if not careful.
  // Better approach: If goalId is present, we still render this screen but maybe auto-submit? 
  // OR, we just let the user confirm the "Context" (Date) and then proceed.
  // Actually, the user said: "plan's page should open up with the title and category preloaded. The user just needs to set the date and proceed"
  
  // Date states
  const [startDate, setStartDate] = useState(initialSelectedDate ? new Date(initialSelectedDate) : new Date());
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !user) return; // Category is now optional

    setIsSubmitting(true);
    try {
      let finalGoalId = goalId;
      let finalGoalTitle = title.trim();

      // Only create a NEW goal if we don't have one passed in
      if (!finalGoalId) {
          const newGoal = await DataService.createGoal(user.uid, {
            title: finalGoalTitle,
            category: category.trim() || 'General', // Default if empty
            progress: 0,
            startDate: startDate.toISOString().split('T')[0],
            targetDate: targetDate ? targetDate.toISOString().split('T')[0] : undefined,
            linkedPlanId: type === 'habit' ? linkedPlanId : undefined 
          });
          finalGoalId = newGoal.id;
      } else {
          // If adding to existing, we might want to update the goal's date range if the new task is outside it?
          // Or just proceed. For now, just proceed using the existing ID.
      }

      // Navigate based on flow type
      if (type === 'isolate') {
          navigation.replace('PlanIsolate', { 
              goalId: finalGoalId, 
              goalTitle: finalGoalTitle,
              startDate: startDate.toISOString(),
              targetDate: targetDate ? targetDate.toISOString() : undefined,
              initialSelectedDate: startDate.toISOString()
          });
      } else {
          // Default to Habit Stack ('habit')
          navigation.replace('PlanStack', { 
              goalId: finalGoalId, 
              goalTitle: finalGoalTitle,
              startDate: startDate.toISOString(),
              targetDate: targetDate ? targetDate.toISOString() : undefined,
              initialSelectedDate: startDate.toISOString()
          });
      }
    } catch (error) {
      console.error("Error creating/navigating plan:", error);
      navigation.goBack();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCategorySelect = (cat: string) => {
    if (cat === 'Custom') {
        setIsCustomCategory(true);
        setCategory('');
    } else {
        setIsCustomCategory(false);
        setCategory(cat);
    }
    setShowCategoryModal(false);
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
        setStartDate(selectedDate);
    }
  };

  const onTargetDateChange = (event: any, selectedDate?: Date) => {
    setShowTargetPicker(Platform.OS === 'ios');
    if (selectedDate) {
        setTargetDate(selectedDate);
    }
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
        />
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center border-b border-gray-200 bg-white p-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <ArrowLeft size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">
            {type === 'habit' ? 'Build a Habit' : 'Create a Plan'}
        </Text>
      </View>

      <ScrollView className="flex-1 p-4">
        <Text className="mb-6 text-center text-sm text-gray-500">
            {type === 'habit' 
                ? "Define the goal for your new habit stack." 
                : "Define the goal you want to achieve with this plan."}
        </Text>

        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-700">
              {type === 'habit' ? 'Habit Title' : 'Plan Title'}
          </Text>
          <TextInput
            className="rounded-lg border border-gray-300 p-3 text-base"
            placeholder={type === 'habit' ? "e.g. Morning Run" : "e.g. Become a proficient writer"}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Link to Plan (Optional, Habit only) */}
        {type === 'habit' && existingPlans.length > 0 && (
             <View className="mb-4">
                <Text className="mb-2 text-sm font-medium text-gray-700">Link to a Plan (Optional)</Text>
                <TouchableOpacity 
                    className="flex-row items-center justify-between rounded-lg border border-gray-300 p-3"
                    onPress={() => setShowPlanPicker(true)}
                >
                    <Text className={`text-base ${linkedPlanId ? 'text-gray-900' : 'text-gray-400'}`}>
                        {linkedPlanId 
                            ? existingPlans.find(p => p.id === linkedPlanId)?.title 
                            : "Select a plan to support"}
                    </Text>
                    <ChevronDown size={20} color="gray" />
                </TouchableOpacity>
                {linkedPlanId && (
                    <TouchableOpacity onPress={() => setLinkedPlanId(undefined)} className="mt-1 self-end">
                        <Text className="text-xs text-red-500">Clear Link</Text>
                    </TouchableOpacity>
                )}
             </View>
        )}

        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-700">Category</Text>
          {isCustomCategory ? (
            <TextInput
                className="rounded-lg border border-gray-300 p-3 text-base"
                placeholder="Enter a custom category"
                value={category}
                onChangeText={setCategory}
                autoFocus
            />
          ) : (
            <TouchableOpacity 
                className="flex-row items-center justify-between rounded-lg border border-gray-300 p-3"
                onPress={() => setShowCategoryModal(true)}
            >
                <Text className={`text-base ${category ? 'text-gray-900' : 'text-gray-400'}`}>
                    {category || "Select a category"}
                </Text>
                <ChevronDown size={20} color="gray" />
            </TouchableOpacity>
          )}
        </View>

        <View className="mb-6 flex-row gap-4">
            <View className="flex-1">
                <Text className="mb-2 text-sm font-medium text-gray-700">Start Date</Text>
                <TouchableOpacity 
                    onPress={() => setShowStartPicker(true)}
                    className="flex-row items-center rounded-lg border border-gray-300 p-3"
                >
                    <CalendarIcon size={20} color="gray" className="mr-2" />
                    <Text className="text-base text-gray-900">{startDate.toISOString().split('T')[0]}</Text>
                </TouchableOpacity>
                {renderDatePicker(showStartPicker, startDate, onStartDateChange)}
            </View>
            <View className="flex-1">
                <Text className="mb-2 text-sm font-medium text-gray-700">Target Date</Text>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity 
                      onPress={() => setShowTargetPicker(true)}
                      className="flex-1 flex-row items-center rounded-lg border border-gray-300 p-3"
                  >
                      <CalendarIcon size={20} color="gray" className="mr-2" />
                      <Text className={`text-base ${targetDate ? 'text-gray-900' : 'text-gray-500'}`}>
                        {targetDate ? targetDate.toISOString().split('T')[0] : "Forever"}
                      </Text>
                  </TouchableOpacity>
                  {targetDate && (
                    <TouchableOpacity onPress={() => setTargetDate(undefined)}>
                        <Text className="text-xs font-bold text-gray-400">Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {renderDatePicker(showTargetPicker, targetDate || new Date(), onTargetDateChange)}
            </View>
        </View>

        <TouchableOpacity
          className={`items-center justify-center rounded-lg bg-sky-500 p-4 ${isSubmitting || !title || !category ? 'opacity-70' : ''}`}
          onPress={handleCreate}
          disabled={isSubmitting || !title || !category}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-bold text-white">
                {type === 'habit' ? "Next: Stack Habits" : "Next: Isolate Activities"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity 
            className="flex-1 justify-end bg-black/50" 
            activeOpacity={1} 
            onPress={() => setShowCategoryModal(false)}
        >
            <View className="bg-white rounded-t-xl p-4 pb-10">
                <Text className="mb-4 text-center text-lg font-bold text-gray-900">Select Category</Text>
                {suggestedCategories.map(cat => (
                    <TouchableOpacity 
                        key={cat} 
                        className="border-b border-gray-100 py-4"
                        onPress={() => handleCategorySelect(cat)}
                    >
                        <Text className="text-center text-base text-gray-800">{cat}</Text>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity 
                    className="py-4 mb-4"
                    onPress={() => handleCategorySelect('Custom')}
                >
                    <Text className="text-center text-base font-bold text-sky-600">Create Custom...</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
      </Modal>

      {/* Plan Selection Modal */}
      <Modal
        visible={showPlanPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlanPicker(false)}
      >
        <TouchableOpacity 
            className="flex-1 justify-end bg-black/50" 
            activeOpacity={1} 
            onPress={() => setShowPlanPicker(false)}
        >
            <View className="bg-white rounded-t-xl p-4" style={{ maxHeight: '60%' }}>
                <Text className="mb-4 text-center text-lg font-bold text-gray-900">Select a Plan</Text>
                <ScrollView>
                    {existingPlans.map(plan => (
                        <TouchableOpacity 
                            key={plan.id} 
                            className="border-b border-gray-100 py-4"
                            onPress={() => {
                                setLinkedPlanId(plan.id);
                                setShowPlanPicker(false);
                            }}
                        >
                            <Text className="text-center text-base text-gray-800">{plan.title}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
