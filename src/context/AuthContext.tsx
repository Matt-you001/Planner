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
// import * as AppleAuthentication from 'expo-apple-authentication';

const GOOGLE_WEB_CLIENT_ID = '1081960231146-12en6go2743j8tq496kem93hi26g4tbd.apps.googleusercontent.com';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
 signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  subscriptionTier: 'free' | 'premium';
  upgradeToPremium: () => void;
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
  subscriptionTier: 'free',
  upgradeToPremium: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'premium'>('free');

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
    });
  }, []);

  useEffect(() => {
    // Load subscription status from storage
    AsyncStorage.getItem('subscriptionTier').then(val => {
        if (val === 'premium') setSubscriptionTier('premium');
    });
  }, []);

  const upgradeToPremium = () => {
    // In a real app, this would trigger a purchase flow
    setSubscriptionTier('premium');
    AsyncStorage.setItem('subscriptionTier', 'premium');
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
      await signOut(auth);
      setUser(null);
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
        setIsLoading(false);
      } else {
        // User is signed out
        setUser(null);
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
      subscriptionTier,
      upgradeToPremium
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
