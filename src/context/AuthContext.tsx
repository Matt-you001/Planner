import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  updateProfile, 
  signInWithCredential
} from 'firebase/auth';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase/index';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { BillingService } from '../lib/BillingService';
// import * as AppleAuthentication from 'expo-apple-authentication';

const GOOGLE_WEB_CLIENT_ID = '1081960231146-12en6go2743j8tq496kem93hi26g4tbd.apps.googleusercontent.com';
const SUBSCRIPTION_CACHE_KEY = 'subscriptionTierCache';
// Temporary testing override. Set to true when paid subscriptions are ready to enforce again.
const PREMIUM_GATING_ENABLED = false;

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
 signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  isSubscriptionLoading: boolean;
  subscriptionTier: 'free' | 'premium';
  isPremiumGatingEnabled: boolean;
  upgradeToPremium: () => Promise<void>;
  restorePremiumPurchases: () => Promise<void>;
  refreshSubscriptionStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  isLoading: true,
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signUpWithEmail: async () => {},
  signInWithEmail: async () => {},
  resetPassword: async () => {},
  logout: async () => {},
  isSubscriptionLoading: false,
  subscriptionTier: 'premium',
  isPremiumGatingEnabled: PREMIUM_GATING_ENABLED,
  upgradeToPremium: async () => {},
  restorePremiumPurchases: async () => {},
  refreshSubscriptionStatus: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'premium'>(
    PREMIUM_GATING_ENABLED ? 'free' : 'premium'
  );

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
    });
  }, []);

  useEffect(() => {
    if (!PREMIUM_GATING_ENABLED) {
      setSubscriptionTier('premium');
      AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, 'premium');
      return;
    }

    // Load subscription status from storage
    AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY).then(val => {
        if (val === 'premium') setSubscriptionTier('premium');
    });
  }, []);

  const applySubscriptionTier = async (tier: 'free' | 'premium') => {
    const effectiveTier = PREMIUM_GATING_ENABLED ? tier : 'premium';
    setSubscriptionTier(effectiveTier);
    await AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, effectiveTier);
  };

  const syncSubscriptionFromRevenueCat = async (currentUser: User | null) => {
    if (!PREMIUM_GATING_ENABLED) {
      await applySubscriptionTier('premium');
      return;
    }

    if (!currentUser || !BillingService.isSupported()) {
      await applySubscriptionTier('free');
      return;
    }

    if (!BillingService.isConfiguredForCurrentPlatform()) {
      await applySubscriptionTier('free');
      return;
    }

    setIsSubscriptionLoading(true);
    try {
      const customerInfo = await BillingService.syncUser(currentUser.uid);
      await applySubscriptionTier(BillingService.hasPremium(customerInfo) ? 'premium' : 'free');
    } catch (error) {
      console.error('Failed to sync subscription status', error);
    } finally {
      setIsSubscriptionLoading(false);
    }
  };

  const refreshSubscriptionStatus = async () => {
    if (!user) return;
    await syncSubscriptionFromRevenueCat(user);
  };

  const upgradeToPremium = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in before starting a subscription.');
      return;
    }

    if (!BillingService.isSupported()) {
      Alert.alert('Not Supported Here', 'Subscriptions can only be purchased from the mobile app on iOS or Android.');
      return;
    }

    if (!BillingService.isConfiguredForCurrentPlatform()) {
      Alert.alert(
        'RevenueCat Setup Needed',
        'Add your RevenueCat API key to the app environment before testing real subscriptions.'
      );
      return;
    }

    setIsSubscriptionLoading(true);
    try {
      await BillingService.initialize(user.uid);
      // Let an Android Alert finish dismissing before presenting RevenueCat's native paywall.
      await new Promise(resolve => setTimeout(resolve, 300));
      const customerInfo = await BillingService.presentPremiumPaywall();
      const hasPremium = BillingService.hasPremium(customerInfo);
      await applySubscriptionTier(hasPremium ? 'premium' : 'free');

      if (hasPremium) {
        Alert.alert('Premium Activated', 'Your premium subscription is now active.');
      }
    } catch (error: any) {
      console.error('Premium purchase failed', error);

      if (error?.userCancelled) {
        return;
      }

      Alert.alert('Purchase Failed', error?.message || 'We could not complete the premium purchase.');
    } finally {
      setIsSubscriptionLoading(false);
    }
  };

  const restorePremiumPurchases = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in before restoring purchases.');
      return;
    }

    if (!BillingService.isSupported()) {
      Alert.alert('Not Supported Here', 'Purchase restore is only available on iOS or Android.');
      return;
    }

    if (!BillingService.isConfiguredForCurrentPlatform()) {
      Alert.alert(
        'RevenueCat Setup Needed',
        'Add your RevenueCat API key to the app environment before restoring purchases.'
      );
      return;
    }

    setIsSubscriptionLoading(true);
    try {
      await BillingService.initialize(user.uid);
      const customerInfo = await BillingService.restorePurchases();
      const hasPremium = BillingService.hasPremium(customerInfo);
      await applySubscriptionTier(hasPremium ? 'premium' : 'free');

      Alert.alert(
        hasPremium ? 'Purchases Restored' : 'No Active Premium Found',
        hasPremium
          ? 'Your premium subscription has been restored successfully.'
          : 'We could not find an active premium subscription to restore.'
      );
    } catch (error: any) {
      console.error('Restore purchases failed', error);
      Alert.alert('Restore Failed', error?.message || 'We could not restore purchases right now.');
    } finally {
      setIsSubscriptionLoading(false);
    }
  };

  // Auth Methods
  const signInWithGoogle = async () => {
    try {
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } else {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const signInResult = await GoogleSignin.signIn();
        const idToken = signInResult.data?.idToken || signInResult.idToken;

        if (!idToken) {
          throw new Error('No ID token found');
        }

        const googleCredential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, googleCredential);
      }
    } catch (error: any) {
      console.error("Google Sign In Error", error);

      if (error?.code === '12500' || error?.message?.includes('DEVELOPER_ERROR')) {
        Alert.alert(
          "Configuration Error",
          "Google Sign-In needs a valid Firebase/Google setup. Check the Android SHA certificate and Web Client ID."
        );
      } else if (error?.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert("Sign In Failed", error?.message || "Google Sign-In failed.");
      }

      throw error;
    }
  };

  const signInWithApple = async () => {
     /*
     try {
         const rawNonce = Math.random().toString(36).substring(2, 10);
         const requestedScopes = [
           AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
           AppleAuthentication.AppleAuthenticationScope.EMAIL,
         ];
     
         const nonce = await Crypto.digestStringAsync(
           Crypto.CryptoDigestAlgorithm.SHA256,
           rawNonce
         );
     
         const appleCredential = await AppleAuthentication.signInAsync({
           requestedScopes: requestedScopes,
           nonce: nonce,
         });
     
         const { identityToken } = appleCredential;
     
         if (!identityToken) {
           throw new Error('Apple Sign-In failed - no identify token returned');
         }
     
         const provider = new OAuthProvider('apple.com');
         const credential = provider.credential({
           idToken: identityToken,
           rawNonce: rawNonce,
         });
     
         await signInWithCredential(auth, credential);
     } catch (error: any) {
         if (error.code === 'ERR_REQUEST_CANCELED') {
              console.log('User canceled Apple Sign-In');
         } else {
              console.error("Apple Sign In Error", error);
              throw error;
         }
     }
     */
     Alert.alert("Not Available", "Apple Sign-In is currently disabled.");
   };

  const signUpWithEmail = async (email: string, pass: string, name?: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      if (name && result.user) {
          await updateProfile(result.user, { displayName: name });
          // Force refresh user state to ensure displayName is propagated
          await result.user.reload();
          if (auth.currentUser) {
            setUser({ ...auth.currentUser });
          }
      }
    } catch (error) {
      console.error("Sign Up Error", error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error("Sign In Error", error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Reset Password Error", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (Platform.OS !== 'web') {
        await GoogleSignin.signOut();
      }
      if (BillingService.isSupported()) {
        await BillingService.logout();
      }
      await signOut(auth);
      setUser(null);
      await applySubscriptionTier('free');
    } catch (error) {
      console.error("Sign Out Error", error);
    }
  };

  useEffect(() => {
    let mounted = true;

    // We no longer auto-sign in anonymously immediately, 
    // unless we decide that's the desired "Guest" behavior.
    // For now, let's wait for onAuthStateChanged to resolve existing session.
    
    // Ensure persistence is handled correctly (React Native uses AsyncStorage by default with Firebase JS SDK)
    // No explicit call needed usually, but good to know onAuthStateChanged handles it.

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!mounted) return;
      
      if (currentUser) {
        setUser(currentUser);
        syncSubscriptionFromRevenueCat(currentUser);
        setIsLoading(false);
      } else {
        // User is signed out
        setUser(null);
        applySubscriptionTier('free');
        setIsLoading(false);
      }
    });

    // Fallback if firebase is unresponsive (network issues)
    const timeoutId = setTimeout(() => {
        if (mounted && isLoading) {
            console.warn("Auth check timed out (no user found), stopping loading state");
            setIsLoading(false);
        }
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading,
      signInWithGoogle,
      signInWithApple,
      signUpWithEmail,
      signInWithEmail,
      resetPassword,
      logout,
      isSubscriptionLoading,
      subscriptionTier,
      isPremiumGatingEnabled: PREMIUM_GATING_ENABLED,
      upgradeToPremium,
      restorePremiumPurchases,
      refreshSubscriptionStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
