/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

// Stubbed at the public boundary, because the real module ends at TurboModuleRegistry and there is
// no bridge under Jest. `lightsession-react-native/navigation` stays real on purpose — it is plain
// JavaScript over React Navigation's public API, and its `setScreen` import resolves to this same
// mock, so the render below exercises the actual integration path an app uses.
jest.mock('lightsession-react-native', () => {
  const api = {
    init: jest.fn(),
    setScreen: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    isRecording: jest.fn(() => true),
    setSubScreen: jest.fn(),
    clearSubScreen: jest.fn(),
  };
  return {__esModule: true, default: api, ...api};
});

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
