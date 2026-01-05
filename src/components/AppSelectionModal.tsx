import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, Image, ActivityIndicator, Platform, Alert, TextInput } from 'react-native';
// import { LauncherKit } from 'react-native-launcher-kit'; 
import MattOnahModule from '../../modules/InstalledApps'; // Import our custom local module
import { X, Search } from 'lucide-react-native';
import { styled } from 'nativewind';

interface AppSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (appPackage: string) => void;
}

interface AppData {
  label: string;
  packageName: string;
  icon?: string;
}

export default function AppSelectionModal({ visible, onClose, onSelect }: AppSelectionModalProps) {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualInput, setManualInput] = useState('');

  // TEMPORARY: Since we cannot list apps without native module build success,
  // we will provide a manual input fallback and a few common examples.
  const commonApps: AppData[] = [
      { label: 'WhatsApp', packageName: 'com.whatsapp' },
      { label: 'Instagram', packageName: 'com.instagram.android' },
      { label: 'YouTube', packageName: 'com.google.android.youtube' },
      { label: 'Gmail', packageName: 'com.google.android.gm' },
      { label: 'Chrome', packageName: 'com.android.chrome' },
      { label: 'Maps', packageName: 'com.google.android.apps.maps' },
      { label: 'Spotify', packageName: 'com.spotify.music' },
      { label: 'Twitter/X', packageName: 'com.twitter.android' },
  ];

  useEffect(() => {
    if (visible) {
      loadApps();
    }
  }, [visible]);

  const loadApps = async () => {
    setLoading(true);
    try {
        if (Platform.OS !== 'web') {
            // Use our custom module
            // console.log("Attempting to fetch apps via MattOnahModule...");
            const installedApps = MattOnahModule.getInstalledApps();
            // console.log(`Fetched ${installedApps.length} apps.`);
            
            if (installedApps.length > 0) {
                const sortedApps = installedApps.sort((a, b) => a.label.localeCompare(b.label));
                setApps(sortedApps);
            } else {
                // console.log("Native module returned empty list, falling back.");
                setApps(commonApps);
            }
        } else {
            setApps(commonApps);
        }
    } catch (error) {
        console.error("Failed to load apps:", error);
        // Alert.alert("Debug Error", `Native Module Failed: ${error}`);
        // Fallback to manual list if native call fails
        setApps(commonApps);
    } finally {
        setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl h-[80%] p-4">
            <View className="flex-row items-center justify-between mb-4 border-b border-gray-100 pb-4">
                <Text className="text-xl font-bold text-gray-900">Link an App</Text>
                <TouchableOpacity onPress={onClose} className="p-2 bg-gray-100 rounded-full">
                    <X size={20} color="gray" />
                </TouchableOpacity>
            </View>

            <View className="mb-4">
                <Text className="text-sm text-gray-500 mb-2">Or enter package name/URL manually:</Text>
                <View className="flex-row gap-2">
                    <TextInput 
                        className="flex-1 border border-gray-300 rounded-lg p-3"
                        placeholder="e.g. com.example.app or https://..."
                        value={manualInput}
                        onChangeText={setManualInput}
                    />
                    <TouchableOpacity 
                        className="bg-sky-500 justify-center px-4 rounded-lg"
                        onPress={() => {
                            if(manualInput) {
                                onSelect(manualInput);
                                onClose();
                            }
                        }}
                    >
                        <Text className="text-white font-bold">Use</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <Text className="font-bold text-gray-900 mb-2">Popular Apps</Text>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#0ea5e9" />
                    <Text className="mt-4 text-gray-500">Loading your apps...</Text>
                </View>
            ) : (
                <FlatList
                    data={apps}
                    keyExtractor={(item) => item.packageName}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            className="flex-row items-center p-3 border-b border-gray-50 active:bg-gray-50"
                            onPress={() => {
                                onSelect(item.packageName);
                                onClose();
                            }}
                        >
                            {item.icon && (
                                <Image 
                                    source={{ uri: `data:image/png;base64,${item.icon}` }} 
                                    style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }} 
                                />
                            )}
                            <View>
                                <Text className="text-base font-semibold text-gray-900">{item.label}</Text>
                                <Text className="text-xs text-gray-500">{item.packageName}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <Text className="text-center text-gray-500 mt-10">No apps found.</Text>
                    }
                />
            )}
        </View>
      </View>
    </Modal>
  );
}
