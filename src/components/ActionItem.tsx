import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Linking, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { format, isToday, isPast } from 'date-fns';
import { Link2, Target, Check, Square, Trash2 } from 'lucide-react-native';
import type { System, Task, WithId } from '../lib/types';
import { useCelebration } from '../context/CelebrationContext';
import { styled } from 'nativewind';

type Action = WithId<System> | WithId<Task>;

type ActionItemProps = {
  action: Action;
  onActionChange: (newValues: { isCompleted?: boolean; successPercentage?: number }) => void;
  onDelete?: () => void;
};

const HIDE_DELAY = 30 * 60 * 1000; // 30 minutes

export default function ActionItem({ action, onActionChange, onDelete }: ActionItemProps) {
  const { celebrate } = useCelebration();
  const [isVisible, setIsVisible] = useState(true);

  const isCompleted = action.isCompleted || false;
  const successPercentage = action.successPercentage || 0;

  useEffect(() => {
    if (isCompleted) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, HIDE_DELAY);
      return () => clearTimeout(timer);
    }
  }, [isCompleted]);

  const handleCheckedChange = () => {
    const checked = !isCompleted;
    onActionChange({ isCompleted: checked, successPercentage: checked ? 100 : 0 });
    
    if (checked) {
        celebrate('activity_done', `Completed: ${action.title}`);
    }
  };

  const handleSliderChange = (value: number) => {
    onActionChange({ successPercentage: Math.round(value) });
  };

  const isSystemAction = 'goalId' in action;

  const actionDate = new Date(action.date + 'T00:00:00');
  const formattedDate = isToday(actionDate)
    ? 'Today'
    : isPast(actionDate)
    ? format(actionDate, 'MMM d (Past)')
    : format(actionDate, 'EEE, MMM d');

  if (!isVisible) {
    return null;
  }

  const cleanTitle = (title: string) => {
    // Regex to remove "Cue: ", "Habit: ", "Stack: ", "Reward: " prefixes (case insensitive)
    return title.replace(/^(Cue|Habit|Stack|Reward):\s*/i, '');
  };

  return (
    <View className={`mb-4 rounded-lg border border-border bg-card p-4 shadow-sm ${isCompleted ? 'bg-muted opacity-50' : ''}`}>
      <View className="flex-row items-start gap-3">
        <Pressable onPress={handleCheckedChange} className="mt-1">
          {isCompleted ? (
             <View className="bg-primary rounded-md p-0.5">
                <Check size={16} color="white" />
             </View>
          ) : (
            <Square size={20} className="text-muted-foreground" />
          )}
        </Pressable>

        <View className="flex-1 gap-1">
          <Pressable onPress={handleCheckedChange}>
            <Text className={`text-base font-medium ${isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {cleanTitle(action.title)}
            </Text>
          </Pressable>
          
          <View className="flex-row flex-wrap items-center gap-2">
            {isSystemAction && 'goalTitle' in action && (
              <View className="flex-row items-center gap-1">
                <Target size={12} className="text-muted-foreground" />
                <Text className="text-xs text-muted-foreground">{action.goalTitle}</Text>
              </View>
            )}
            {/* Fix: Only show End Time if it exists AND is different from start time (to hide duration for tasks/isolate) */}
            {(action.startTime || action.endTime) && (
              <Text className="text-xs text-muted-foreground">
                {action.startTime}{action.endTime && action.endTime !== action.startTime ? ` - ${action.endTime}` : ''}
              </Text>
            )}
          </View>
          
           <View className="flex-row items-center justify-between mt-2">
             <View className="flex-row items-center gap-2">
                <View className="bg-secondary px-2 py-0.5 rounded-md">
                    <Text className="text-xs text-secondary-foreground">{formattedDate}</Text>
                </View>
                
                {action.linkedApp && (
                    <Pressable onPress={() => Linking.openURL(action.linkedApp!)} className="p-1">
                        <Link2 size={16} className="text-muted-foreground" />
                    </Pressable>
                )}

                {isCompleted && (
                    <View className="border border-input px-2 py-0.5 rounded-md">
                        <Text className="text-xs text-muted-foreground">{successPercentage}%</Text>
                    </View>
                )}
             </View>
             
             {onDelete && (
                <TouchableOpacity onPress={onDelete} className="p-1">
                    <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
             )}
           </View>
        </View>
      </View>

      {isCompleted && (
        <View className="mt-4 pl-8">
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={successPercentage}
            onValueChange={handleSliderChange}
            minimumTrackTintColor="hsl(200 80% 60%)" // primary
            maximumTrackTintColor="#000000"
          />
        </View>
      )}
    </View>
  );
}
