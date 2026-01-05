# End in Mind - Mobile App

This is a React Native (Expo) mobile application for "End in Mind".

## Standalone Project
This project is **completely standalone**. You can move this `mobile-app` folder anywhere on your computer, and it will work independently of the web project.

## Prerequisites
- Node.js installed
- npm or yarn

## Setup
1. Open this folder in your terminal.
2. Install dependencies:
   ```bash
   npm install
   ```

## Running the App
Start the Expo development server:
```bash
npx expo start
```

- **Scan the QR code** with the **Expo Go** app on your Android or iOS device.
- Or press `a` to run on Android Emulator.
- Or press `i` to run on iOS Simulator (macOS only).

## Project Structure
- **App.js**: Main entry point and Navigation.
- **src/firebase**: Firebase configuration and hooks.
- **src/screens**: App screens (Dashboard, Plans, AI Coach).
- **src/components**: Reusable UI components.
- **src/context**: Global state (Authentication).

## Tech Stack
- **Expo**: React Native framework.
- **NativeWind**: Tailwind CSS for React Native.
- **Firebase**: Backend for Auth and Database (Firestore).
- **React Navigation**: Routing and navigation.
