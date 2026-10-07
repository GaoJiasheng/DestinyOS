// Initialize Expo's native runtime before headless tasks and locale polyfills.
import 'expo';
import './lib/monitoring';
import './lib/diagnostics/startup';
import './lib/intl';
import './lib/engagement/background';
import { Platform } from 'react-native';
import { registerAndroidWidgets } from './native/android/widget';
if (Platform.OS === 'android') registerAndroidWidgets();
import 'expo-router/entry';
