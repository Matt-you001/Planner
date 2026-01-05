import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, Platform } from 'react-native';
import { X, ChevronDown } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import type { CustomRepeatConfig } from '../lib/types';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSave: (config: CustomRepeatConfig) => void;
    initialConfig?: CustomRepeatConfig;
}

export default function CustomRepeatModal({ visible, onClose, onSave, initialConfig }: Props) {
    const [frequency, setFrequency] = useState(initialConfig?.frequency?.toString() || '1');
    const [unit, setUnit] = useState<'Day' | 'Week' | 'Month' | 'Year'>(initialConfig?.unit || 'Week');
    const [weekDays, setWeekDays] = useState<number[]>(initialConfig?.weekDays || []);
    const [endOption, setEndOption] = useState<'Never' | 'OnDate' | 'AfterOccurrences'>(initialConfig?.endOption || 'Never');
    const [endDate, setEndDate] = useState(initialConfig?.endDate ? new Date(initialConfig.endDate) : new Date());
    const [occurrences, setOccurrences] = useState(initialConfig?.occurrences?.toString() || '1');
    
    const [showUnitPicker, setShowUnitPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const handleSave = () => {
        onSave({
            frequency: parseInt(frequency) || 1,
            unit,
            weekDays,
            endOption,
            endDate: endDate.toISOString().split('T')[0],
            occurrences: parseInt(occurrences) || 1
        });
        onClose();
    };

    const toggleWeekDay = (day: number) => {
        if (weekDays.includes(day)) {
            setWeekDays(prev => prev.filter(d => d !== day));
        } else {
            setWeekDays(prev => [...prev, day]);
        }
    };

    const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // 0=Sun, 6=Sat

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-white rounded-t-xl h-[80%]">
                    {/* Header */}
                    <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
                        <TouchableOpacity onPress={onClose}>
                             <X size={24} color="gray" />
                        </TouchableOpacity>
                        <Text className="text-lg font-bold text-gray-900">Custom recurrence</Text>
                        <TouchableOpacity onPress={handleSave}>
                            <Text className="text-lg font-bold text-sky-600">Done</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1 p-4">
                        {/* Repeats Every */}
                        <Text className="text-sm font-bold text-gray-700 mb-2">Repeats every</Text>
                        <View className="flex-row gap-4 mb-6">
                            <TextInput 
                                className="w-20 rounded-lg border border-gray-300 p-3 text-center text-lg bg-white"
                                keyboardType="number-pad"
                                value={frequency}
                                onChangeText={setFrequency}
                            />
                            <TouchableOpacity 
                                className="flex-1 flex-row items-center justify-between rounded-lg border border-gray-300 p-3 bg-white"
                                onPress={() => setShowUnitPicker(!showUnitPicker)}
                            >
                                <Text className="text-lg text-gray-900">{unit.toLowerCase()}{parseInt(frequency) > 1 ? 's' : ''}</Text>
                                <ChevronDown size={20} color="gray" />
                            </TouchableOpacity>
                        </View>

                        {/* Unit Picker Dropdown */}
                        {showUnitPicker && (
                            <View className="mb-6 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                                {['Day', 'Week', 'Month', 'Year'].map((u) => (
                                    <TouchableOpacity 
                                        key={u} 
                                        className={`p-3 border-b border-gray-100 ${unit === u ? 'bg-sky-50' : ''}`}
                                        onPress={() => {
                                            setUnit(u as any);
                                            setShowUnitPicker(false);
                                        }}
                                    >
                                        <Text className={`${unit === u ? 'font-bold text-sky-600' : 'text-gray-900'}`}>{u}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Repeats On (Only for Week) */}
                        {unit === 'Week' && (
                            <View className="mb-6">
                                <Text className="text-sm font-bold text-gray-700 mb-2">Repeats on</Text>
                                <View className="flex-row justify-between">
                                    {DAYS.map((d, idx) => {
                                        const isSelected = weekDays.includes(idx);
                                        return (
                                            <TouchableOpacity 
                                                key={idx}
                                                onPress={() => toggleWeekDay(idx)}
                                                className={`h-10 w-10 items-center justify-center rounded-full border ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}
                                            >
                                                <Text className={`font-bold ${isSelected ? 'text-white' : 'text-gray-500'}`}>{d}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* Ends */}
                        <Text className="text-sm font-bold text-gray-700 mb-4">Ends</Text>
                        
                        {/* Never */}
                        <TouchableOpacity 
                            className="flex-row items-center mb-4"
                            onPress={() => setEndOption('Never')}
                        >
                            <View className={`h-5 w-5 rounded-full border items-center justify-center mr-3 ${endOption === 'Never' ? 'border-sky-600' : 'border-gray-400'}`}>
                                {endOption === 'Never' && <View className="h-3 w-3 rounded-full bg-sky-600" />}
                            </View>
                            <Text className="text-base text-gray-900">Never</Text>
                        </TouchableOpacity>

                        {/* On Date */}
                        <View className="flex-row items-center mb-4">
                            <TouchableOpacity 
                                className="flex-row items-center mr-3"
                                onPress={() => setEndOption('OnDate')}
                            >
                                <View className={`h-5 w-5 rounded-full border items-center justify-center mr-3 ${endOption === 'OnDate' ? 'border-sky-600' : 'border-gray-400'}`}>
                                    {endOption === 'OnDate' && <View className="h-3 w-3 rounded-full bg-sky-600" />}
                                </View>
                                <Text className="text-base text-gray-900">On</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                onPress={() => {
                                    setEndOption('OnDate');
                                    setShowDatePicker(true);
                                }}
                                className={`rounded-lg border px-4 py-2 ${endOption === 'OnDate' ? 'border-gray-400 bg-white' : 'border-gray-200 bg-gray-50'}`}
                            >
                                <Text className={endOption === 'OnDate' ? 'text-gray-900' : 'text-gray-400'}>
                                    {format(endDate, 'd MMM yyyy')}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* After Occurrences */}
                        <View className="flex-row items-center mb-4">
                            <TouchableOpacity 
                                className="flex-row items-center mr-3"
                                onPress={() => setEndOption('AfterOccurrences')}
                            >
                                <View className={`h-5 w-5 rounded-full border items-center justify-center mr-3 ${endOption === 'AfterOccurrences' ? 'border-sky-600' : 'border-gray-400'}`}>
                                    {endOption === 'AfterOccurrences' && <View className="h-3 w-3 rounded-full bg-sky-600" />}
                                </View>
                                <Text className="text-base text-gray-900">After</Text>
                            </TouchableOpacity>
                            
                            <TextInput 
                                className={`w-16 rounded-lg border px-2 py-2 text-center mr-2 ${endOption === 'AfterOccurrences' ? 'border-gray-400 bg-white text-gray-900' : 'border-gray-200 bg-gray-50 text-gray-400'}`}
                                keyboardType="number-pad"
                                value={occurrences}
                                onChangeText={setOccurrences}
                                onFocus={() => setEndOption('AfterOccurrences')}
                            />
                            <Text className="text-base text-gray-900">occurrences</Text>
                        </View>

                    </ScrollView>

                    {showDatePicker && (
                        <DateTimePicker
                            value={endDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(e, d) => {
                                setShowDatePicker(Platform.OS === 'ios');
                                if (d) setEndDate(d);
                            }}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}
