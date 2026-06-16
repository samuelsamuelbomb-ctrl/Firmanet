@echo off
cd /d C:\Users\p\Downloads\swift-watch-main\swift-watch-main
echo Checking packages...
if not exist node_modules\@react-navigation\native (
  echo Installing packages...
  call npm install --no-optional react-native @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context @react-native-async-storage/async-storage lucide-react-native expo-location expo-secure-store @tanstack/react-query zustand
  echo Install complete!
)
echo Starting Expo...
npx expo start --tunnel
pause