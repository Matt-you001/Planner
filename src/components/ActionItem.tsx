import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Linking, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { format, isToday, isPast } from 'date-fns';
import { Link2, Target, Check, X, Trash2 } from 'lucide-react-native';
import type { System, Task, WithId } from '../lib/types';
import { useCelebration } from '../context/CelebrationContext';
import { styled } from 'nativewind';

type Action = WithId<System> | WithId<Task>;

type ActionItemProps = {
  action: Action;
  onActionChange: (newValues: { isCompleted?: boolean; successPercentage?: number; status?: 'completed' | 'missed' | 'pending' }) => void;
  onDelete?: () => void;
};

const HIDE_DELAY = 30 * 60 * 1000; // 30 minutes

export default function ActionItem({ action, onActionChange, onDelete }: ActionItemProps) {
  const { celebrate } = useCelebration();
  const [isVisible, setIsVisible] = useState(true);

  // We map 'isCompleted' and 'successPercentage' to our UI status
  // If isCompleted is true:
  //   - successPercentage >= 50 => DONE (Green Check)
  //   - successPercentage < 50 => MISSED (Red X)
  // Or we can rely on a new 'status' field if we add it, but let's infer for backward compatibility
  // Ideally, 'Missed' implies completed=true but success=0.
  
  const isDone = action.isCompleted && (action.successPercentage || 0) >= 50;
  const isMissed = action.isCompleted && (action.successPercentage || 0) < 50;
  const isPending = !action.isCompleted;

  useEffect(() => {
    if (action.isCompleted) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, HIDE_DELAY);
      return () => clearTimeout(timer);
    }
  }, [action.isCompleted]);

  const handleDone = () => {
    // If already done, toggle off? Or do nothing? Usually toggle off to pending.
    if (isDone) {
        onActionChange({ isCompleted: false, successPercentage: 0 });
    } else {
        onActionChange({ isCompleted: true, successPercentage: 100 });
        celebrate('activity_done', `Completed: ${action.title}`);
    }
  };

  const handleMissed = () => {
      // If already missed, toggle off to pending
      if (isMissed) {
          onActionChange({ isCompleted: false, successPercentage: 0 });
      } else {
          // Mark as completed but with 0% success (or logically "missed")
          onActionChange({ isCompleted: true, successPercentage: 0 });
      }
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
    return title.replace(/^(Cue|Habit|Stack|Reward):\s*/i, '');
  };

  return (
    <View className={`mb-4 rounded-lg border border-border bg-card p-4 shadow-sm ${action.isCompleted ? 'bg-gray-50' : ''}`}>
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
            <Text className={`text-base font-medium ${action.isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
              {cleanTitle(action.title)}
            </Text>
          
          <View className="flex-row flex-wrap items-center gap-2">
            {isSystemAction && 'goalTitle' in action && (
              <View className="flex-row items-center gap-1">
                <Target size={12} className="text-muted-foreground" />
                <Text className="text-xs text-muted-foreground">{action.goalTitle}</Text>
              </View>
            )}
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
             </View>
           </View>
        </View>

        {/* Right Column: Buttons & Delete */}
        <View className="items-end">
             <View className="flex-row gap-2 mt-1">
                <TouchableOpacity 
                    onPress={handleDone}
                    className={`px-3 py-1.5 rounded-full border ${isDone ? 'bg-green-500 border-green-500' : 'bg-transparent border-gray-300'}`}
                >
                    <Text className={`text-xs font-bold ${isDone ? 'text-white' : 'text-gray-500'}`}>Done</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={handleMissed}
                    className={`px-3 py-1.5 rounded-full border ${isMissed ? 'bg-red-500 border-red-500' : 'bg-transparent border-gray-300'}`}
                >
                    <Text className={`text-xs font-bold ${isMissed ? 'text-white' : 'text-gray-500'}`}>Missed</Text>
                </TouchableOpacity>
            </View>

             {onDelete && (
                <TouchableOpacity onPress={onDelete} className="p-2 mt-2">
                    <Trash2 size={18} color="#ef4444" />
                </TouchableOpacity>
             )}
        </View>
      </View>
    </View>
  );
}
