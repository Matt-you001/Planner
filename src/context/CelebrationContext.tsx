import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { X } from 'lucide-react-native';

type CelebrationType = 'activity_done' | 'all_daily_done' | 'goal_completed' | null;

interface CelebrationContextType {
  celebrate: (type: CelebrationType, message?: string) => void;
}

const CelebrationContext = createContext<CelebrationContextType>({
  celebrate: () => {},
});

export const CelebrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [celebrationType, setCelebrationType] = useState<CelebrationType>(null);
  const [message, setMessage] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);

  const celebrate = useCallback((type: CelebrationType, msg: string = '') => {
    setCelebrationType(type);
    setMessage(msg);
    setIsVisible(true);

    // Auto-hide simple celebrations
    if (type === 'activity_done') {
      setTimeout(() => {
        setIsVisible(false);
        setCelebrationType(null);
      }, 2500);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setCelebrationType(null);
  };

  return (
    <CelebrationContext.Provider value={{ celebrate }}>
      {children}
      <Modal visible={isVisible} transparent animationType="fade">
        <View style={styles.container}>
          {/* Confetti for major achievements */}
          {(celebrationType === 'all_daily_done' || celebrationType === 'goal_completed') && (
            <ConfettiCannon 
              count={200} 
              origin={{x: -10, y: 0}} 
              autoStart={true} 
              fadeOut={true}
            />
          )}
          
          {/* Confetti for simple tasks (less intense) */}
          {celebrationType === 'activity_done' && (
            <ConfettiCannon 
              count={50} 
              origin={{x: -10, y: 0}} 
              autoStart={true} 
              fadeOut={true}
            />
          )}

          <View style={styles.card}>
            {celebrationType !== 'activity_done' && (
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                    <X size={24} color="#666" />
                </TouchableOpacity>
            )}
            
            <Text style={styles.title}>
              {celebrationType === 'goal_completed' ? '🎉 Goal Achieved! 🎉' : 
               celebrationType === 'all_daily_done' ? '🌟 Day Complete! 🌟' : 
               'Great Job! 👍'}
            </Text>
            
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>
        </View>
      </Modal>
    </CelebrationContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0ea5e9', // Sky-500
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#4b5563', // Gray-600
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
  }
});

export const useCelebration = () => useContext(CelebrationContext);
