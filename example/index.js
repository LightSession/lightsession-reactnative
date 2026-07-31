/**
 * @format
 */

import { AppRegistry } from 'react-native';
import {Platform} from 'react-native';
import LightSession from 'lightsession-react-native';
import App from './App';
import { name as appName } from './app.json';

// Before `registerComponent`, so the recorder is running by the time the first screen renders.
//
// This is the entire native-side integration: nothing. `MainApplication.kt` is the React Native
// template's, untouched — the module is autolinked and takes its Application context from React
// itself. That is what the package is for.
LightSession.init({
  apiKey: 'dev-key',
  // 10.0.2.2 is the host machine as seen from the Android emulator.
  // The Android emulator reaches the host at 10.0.2.2; the iOS simulator shares the host's own
  // network stack, so it is 127.0.0.1. One config object, two platforms.
  ingestUrl: Platform.OS === 'ios' ? 'http://127.0.0.1:5055' : 'http://10.0.2.2:5055',
  apiUrl: Platform.OS === 'ios' ? 'http://127.0.0.1:3002' : 'http://10.0.2.2:3002',
  // On by default, passed explicitly because this example exists partly to show that RN text is
  // covered without the library knowing anything about React Native.
  maskText: true,
});

AppRegistry.registerComponent(appName, () => App);
