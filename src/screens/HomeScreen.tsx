import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, Layout, Mail, Lock, X, LogIn, User as UserIcon, Apple, Settings } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user, isLoading, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, logout } = useAuth();
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modals close
  useEffect(() => {
    if (!showLoginModal && !showSignUpModal && !showForgotPasswordModal) {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFirstName('');
      setLastName('');
      setIsSubmitting(false);
    }
  }, [showLoginModal, showSignUpModal, showForgotPasswordModal]);

  // Auto-redirect if user is logged in
  useEffect(() => {
    if (user && !isLoading) {
       // Navigate to the Dashboard tab instead of replacing MainTabs
       navigation.navigate('Dashboard');
    }
  }, [user, isLoading, navigation]);

  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      await signInWithGoogle();
      // Navigation will happen automatically via user state change or user clicking "Continue"
      // But typically we want to auto-redirect if successful
      navigation.navigate('Dashboard');
    } catch (e: any) {
      if (e.code === 'auth/operation-not-allowed') {
          Alert.alert("Configuration Error", "Google Sign-In is not enabled in the Firebase Console. Please enable it in the Authentication > Sign-in method tab.");
      } else if (e.code === 'auth/popup-closed-by-user') {
          // User closed popup, no need to alert error
          console.log("User closed sign-in popup");
      } else {
          Alert.alert("Sign In Failed", e.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }
    try {
      setIsSubmitting(true);
      await signInWithEmail(email, password);
      setShowLoginModal(false);
      navigation.navigate('Dashboard');
    } catch (e: any) {
      if (e.code === 'auth/operation-not-allowed') {
          Alert.alert("Configuration Error", "Email/Password Sign-In is not enabled in the Firebase Console. Please enable it in the Authentication > Sign-in method tab.");
      } else if (e.code === 'auth/invalid-credential') {
          Alert.alert("Login Failed", "Invalid email or password.");
      } else {
          Alert.alert("Login Failed", e.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignUp = async () => {
    if (!email || !password || !firstName || !lastName) {
      Alert.alert("Error", "Please enter name, email and password");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    if (password.length < 6) {
        Alert.alert("Error", "Password should be at least 6 characters");
        return;
    }
    try {
      setIsSubmitting(true);
      await signUpWithEmail(email, password, `${firstName} ${lastName}`);
      // Navigation handles auto-redirect
    } catch (e: any) {
      if (e.code === 'auth/operation-not-allowed') {
          Alert.alert("Configuration Error", "Email/Password Sign-Up is not enabled in the Firebase Console. Please enable it in the Authentication > Sign-in method tab.");
      } else if (e.code === 'auth/email-already-in-use') {
          Alert.alert("Sign Up Failed", "This email is already in use.");
      } else {
          Alert.alert("Sign Up Failed", e.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
      if (!email) {
          Alert.alert("Error", "Please enter your email address");
          return;
      }
      try {
          setIsSubmitting(true);
          await resetPassword(email);
          Alert.alert("Success", "Password reset email sent! Check your inbox and spam folder.");
          setShowForgotPasswordModal(false);
          setShowLoginModal(true); // Switch back to login
      } catch (e: any) {
          Alert.alert("Error", e.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  if (isLoading) {
      return (
          <SafeAreaView className="flex-1 bg-white items-center justify-center">
              <ActivityIndicator size="large" color="#0ea5e9" />
          </SafeAreaView>
      );
  }

  return (
    <SafeAreaView className="flex-1 bg-white items-center justify-center p-6 relative">
      {user && (
            <TouchableOpacity 
                className="absolute top-10 right-4 p-3 rounded-full bg-sky-500 shadow-md z-50"
                onPress={() => navigation.navigate('Settings')}
            >
                <Settings size={24} color="white" />
            </TouchableOpacity>
      )}

      <View className="items-center mb-10 w-full relative">

        {/* Logo */}
        <View className="bg-sky-500 p-6 rounded-3xl mb-6 shadow-lg shadow-sky-200">
            <Layout size={64} color="white" />
        </View>
        
        <Text className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">
          The Planner
        </Text>
        
        <Text className="text-center text-lg text-gray-500 leading-7 max-w-xs mb-8">
          A modern planner to help you define your vision and execute the daily systems to achieve it.
        </Text>

        {user ? (
            <View className="w-full items-center">
                <Text className="mb-4 text-gray-600">Welcome back, {user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'User'}</Text>
                <TouchableOpacity 
                    className="w-full flex-row items-center justify-center bg-sky-500 py-4 px-6 rounded-xl active:bg-sky-600 shadow-md shadow-sky-200 mb-4"
                    onPress={() => {
                        console.log("Navigating to Dashboard...");
                        navigation.navigate('Dashboard');
                    }}
                >
                    <Text className="text-white font-bold text-lg mr-2">Go to Dashboard</Text>
                    <ArrowRight size={20} color="white" />
                </TouchableOpacity>
                
                {/* Settings button moved to top right of container */}
                {/* <TouchableOpacity 
                    className="absolute top-4 right-4 p-2 rounded-full bg-gray-100"
                    onPress={() => navigation.navigate('Settings')}
                >
                    <Settings size={24} color="gray" />
                </TouchableOpacity> */}

                <TouchableOpacity onPress={logout}>
                    <Text className="text-red-500 font-medium">Sign Out</Text>
                </TouchableOpacity>
            </View>
        ) : (
            <View className="w-full gap-4">
                {/* Google Sign In */}
                <TouchableOpacity 
                    className="w-full flex-row items-center justify-center bg-white border border-gray-300 py-4 px-6 rounded-xl active:bg-gray-50 shadow-sm"
                    onPress={handleGoogleSignIn}
                    disabled={isSubmitting}
                >
                    {/* Fake Google Icon (Text for now or use generic globe/layout) */}
                    <View className="mr-3">
                        <Text className="font-bold text-xl">G</Text>
                    </View>
                    <Text className="text-gray-700 font-bold text-lg">Sign in with Google</Text>
                </TouchableOpacity>

                {/* Apple Sign In - Only on iOS or if supported */}
                {Platform.OS === 'ios' && (
                    <TouchableOpacity 
                        className="w-full flex-row items-center justify-center bg-black border border-gray-300 py-4 px-6 rounded-xl active:opacity-80 shadow-sm"
                        onPress={handleAppleSignIn}
                        disabled={isSubmitting}
                    >
                        <Apple size={24} color="white" className="mr-3" />
                        <Text className="text-white font-bold text-lg ml-2">Sign in with Apple</Text>
                    </TouchableOpacity>
                )}

                <View className="flex-row items-center">
                    <View className="flex-1 h-[1px] bg-gray-200" />
                    <Text className="mx-4 text-gray-400">or</Text>
                    <View className="flex-1 h-[1px] bg-gray-200" />
                </View>

                {/* Email Sign Up */}
                <TouchableOpacity 
                    className="w-full flex-row items-center justify-center bg-sky-500 py-4 px-6 rounded-xl active:bg-sky-600 shadow-md shadow-sky-200"
                    onPress={() => setShowSignUpModal(true)}
                    disabled={isSubmitting}
                >
                    <Mail size={20} color="white" className="mr-2" />
                    <Text className="text-white font-bold text-lg ml-2">Create an Account</Text>
                </TouchableOpacity>

                {/* Login Link */}
                <View className="flex-row justify-center mt-4">
                    <Text className="text-gray-500 text-base">Already have an account? </Text>
                    <TouchableOpacity onPress={() => setShowLoginModal(true)}>
                        <Text className="text-sky-600 font-bold text-base">Log In</Text>
                    </TouchableOpacity>
                </View>
            </View>
        )}
      </View>

      {/* Login Modal */}
      <Modal visible={showLoginModal} animationType="slide" transparent onRequestClose={() => setShowLoginModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
            <View className="flex-1 justify-end bg-black/50">
                <View className="bg-white rounded-t-3xl p-6 h-[80%]">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-2xl font-bold text-gray-900">Welcome Back</Text>
                        <TouchableOpacity onPress={() => setShowLoginModal(false)}>
                            <X size={24} color="gray" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView>
                        <View className="gap-4">
                            <View>
                                <Text className="mb-2 font-medium text-gray-700">Email</Text>
                                <View className="flex-row items-center border border-gray-300 rounded-xl px-4 bg-gray-50 focus:border-sky-500 focus:bg-white">
                                    <Mail size={20} color="gray" />
                                    <TextInput 
                                        className="flex-1 p-4 text-gray-900 text-base"
                                        placeholder="Enter your email"
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="mb-2 font-medium text-gray-700">Password</Text>
                                <View className="flex-row items-center border border-gray-300 rounded-xl px-4 bg-gray-50 focus:border-sky-500 focus:bg-white">
                                    <Lock size={20} color="gray" />
                                    <TextInput 
                                        className="flex-1 p-4 text-gray-900 text-base"
                                        placeholder="Enter your password"
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                    />
                                </View>
                            </View>

                            <TouchableOpacity 
                                onPress={() => {
                                    setShowLoginModal(false);
                                    setShowForgotPasswordModal(true);
                                }}
                                className="self-end"
                            >
                                <Text className="text-sky-600 font-medium">Forgot Password?</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                className="w-full bg-sky-500 py-4 rounded-xl mt-4 items-center shadow-lg shadow-sky-200"
                                onPress={handleEmailSignIn}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-bold text-lg">Log In</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sign Up Modal */}
      <Modal visible={showSignUpModal} animationType="slide" transparent onRequestClose={() => setShowSignUpModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
            <View className="flex-1 justify-end bg-black/50">
                <View className="bg-white rounded-t-3xl p-6 h-[85%]">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-2xl font-bold text-gray-900">Create Account</Text>
                        <TouchableOpacity onPress={() => setShowSignUpModal(false)}>
                            <X size={24} color="gray" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView>
                        <View className="gap-4 mb-6">
                            <View>
                                <Text className="mb-2 font-medium text-gray-700">First Name</Text>
                                <View className="flex-row items-center border border-gray-300 rounded-xl px-4 bg-gray-50 focus:border-sky-500 focus:bg-white">
                                    <UserIcon size={20} color="gray" />
                                    <TextInput 
                                        className="flex-1 p-4 text-gray-900 text-base"
                                        placeholder="Enter your first name"
                                        value={firstName}
                                        onChangeText={setFirstName}
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="mb-2 font-medium text-gray-700">Last Name</Text>
                                <View className="flex-row items-center border border-gray-300 rounded-xl px-4 bg-gray-50 focus:border-sky-500 focus:bg-white">
                                    <UserIcon size={20} color="gray" />
                                    <TextInput 
                                        className="flex-1 p-4 text-gray-900 text-base"
                                        placeholder="Enter your last name"
                                        value={lastName}
                                        onChangeText={setLastName}
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="mb-2 font-medium text-gray-700">Email</Text>
                                <View className="flex-row items-center border border-gray-300 rounded-xl px-4 bg-gray-50 focus:border-sky-500 focus:bg-white">
                                    <Mail size={20} color="gray" />
                                    <TextInput 
                                        className="flex-1 p-4 text-gray-900 text-base"
                                        placeholder="Enter your email"
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="mb-2 font-medium text-gray-700">Password</Text>
                                <View className="flex-row items-center border border-gray-300 rounded-xl px-4 bg-gray-50 focus:border-sky-500 focus:bg-white">
                                    <Lock size={20} color="gray" />
                                    <TextInput 
                                        className="flex-1 p-4 text-gray-900 text-base"
                                        placeholder="Create a password"
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="mb-2 font-medium text-gray-700">Confirm Password</Text>
                                <View className="flex-row items-center border border-gray-300 rounded-xl px-4 bg-gray-50 focus:border-sky-500 focus:bg-white">
                                    <Lock size={20} color="gray" />
                                    <TextInput 
                                        className="flex-1 p-4 text-gray-900 text-base"
                                        placeholder="Confirm your password"
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry
                                    />
                                </View>
                            </View>

                            <TouchableOpacity 
                                className="w-full bg-sky-500 py-4 rounded-xl mt-4 items-center shadow-lg shadow-sky-200"
                                onPress={handleEmailSignUp}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-bold text-lg">Sign Up</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Forgot Password Modal */}
      <Modal visible={showForgotPasswordModal} animationType="slide" transparent onRequestClose={() => setShowForgotPasswordModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
            <View className="flex-1 justify-end bg-black/50">
                <View className="bg-white rounded-t-3xl p-6 h-[50%]">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-2xl font-bold text-gray-900">Reset Password</Text>
                        <TouchableOpacity onPress={() => setShowForgotPasswordModal(false)}>
                            <X size={24} color="gray" />
                        </TouchableOpacity>
                    </View>

                    <Text className="text-gray-500 mb-6">
                        Enter your email address and we'll send you a link to reset your password.
                    </Text>

                    <View className="gap-4">
                        <View>
                            <Text className="mb-2 font-medium text-gray-700">Email</Text>
                            <View className="flex-row items-center border border-gray-300 rounded-xl px-4 bg-gray-50 focus:border-sky-500 focus:bg-white">
                                <Mail size={20} color="gray" />
                                <TextInput 
                                    className="flex-1 p-4 text-gray-900 text-base"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                        </View>

                        <TouchableOpacity 
                            className="w-full bg-sky-500 py-4 rounded-xl mt-4 items-center shadow-lg shadow-sky-200"
                            onPress={handleForgotPassword}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white font-bold text-lg">Send Reset Link</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            className="items-center mt-2"
                            onPress={() => {
                                setShowForgotPasswordModal(false);
                                setShowLoginModal(true);
                            }}
                        >
                            <Text className="text-gray-500">Back to Login</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}
