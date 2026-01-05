import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Calendar as CalendarIcon, ChevronDown } from 'lucide-react-native';
import { DataService } from '../lib/DataService';
import DateTimePicker from '@react-native-community/datetimepicker';

const suggestedCategories = ['Health', 'Career', 'Learning', 'Finance', 'Relationships', 'Personal'];

export default function CreatePlanScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  
  // Date states
  const [startDate, setStartDate] = useState(new Date());
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !category.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const newGoal = await DataService.createGoal(user.uid, {
        title: title.trim(),
        category: category.trim(),
        progress: 0,
        startDate: startDate.toISOString().split('T')[0],
        targetDate: targetDate ? targetDate.toISOString().split('T')[0] : undefined,
      });
      // Replace the current screen with PlanSetup so back button goes to PlansList
      // Pass startDate so subsequent screens can use it as default
      navigation.replace('PlanSetup', { 
          goalId: newGoal.id, 
          goalTitle: newGoal.title,
          startDate: startDate.toISOString(),
          targetDate: targetDate ? targetDate.toISOString() : undefined
      });
    } catch (error) {
      console.error("Error creating plan:", error);
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
        <Text className="text-lg font-bold text-gray-900">Make a Plan</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        <Text className="mb-6 text-center text-sm text-gray-500">
            Define the ultimate outcome or identity you want to achieve with this plan.
        </Text>

        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-700">Plan Title</Text>
          <TextInput
            className="rounded-lg border border-gray-300 p-3 text-base"
            placeholder="e.g. Become a proficient writer"
            value={title}
            onChangeText={setTitle}
          />
        </View>

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
            <Text className="text-base font-bold text-white">Let's Start a Plan</Text>
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
            <View className="bg-white rounded-t-xl p-4">
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
                    className="py-4"
                    onPress={() => handleCategorySelect('Custom')}
                >
                    <Text className="text-center text-base font-bold text-sky-600">Create Custom...</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
