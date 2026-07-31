import NativeLightSession from './NativeLightSession';

/**
 * The whole public API, and it is small on purpose.
 *
 * Both native SDKs read React Native's view tree directly. RN renders to real Android Views and to real UIKit
 * views, and both SDKs classify by superclass rather than by class name — so the wireframe, the masking, the
 * touch heatmap and the replay frames all work with nothing crossing the bridge. Measured on a stock RN app on
 * each platform: the wireframe comes out legible and every `Text` arrives masked.
 *
 * The one thing neither platform can know is which screen you are on. An RN app is a single Activity on Android
 * and a single view controller on iOS, and its screens are a JavaScript concern either way. That is what this
 * library is for.
 *
 * React Navigation support lives in `lightsession-react-native/navigation` rather than here, so an app
 * using a different navigator — or calling [setScreen] itself — never imports it.
 */

export interface LightSessionOptions {
  /** The project's key. */
  apiKey: string;
  /** Base URL of the ingest service, no trailing slash. */
  ingestUrl: string;
  /** Base URL of the product API, no trailing slash. */
  apiUrl: string;

  /** Record replay frames at all. On by default. */
  enableReplay?: boolean;
  /**
   * Cover text before a captured screen leaves the device. **On by default**, and worth leaving on:
   * text is where the sensitive content is, and RN text is covered without this library knowing
   * anything about React Native — `ReactTextView` descends from `TextView`, which is what the mask
   * scanner matches.
   */
  maskText?: boolean;
  /** Cover images too. Off by default: it hides every icon and logo along with the photos. */
  maskImages?: boolean;

  /** Upgrade a screen's wireframe to a real screenshot once it settles. On by default. */
  captureRealScreens?: boolean;
  trackTabs?: boolean;
  trackModals?: boolean;
  /** Off if you would rather not ask for a location at all. */
  collectLocation?: boolean;

  /**
   * Whether recording starts immediately. On by default.
   *
   * Turn it off to record one flow rather than everything, then call [startRecording] when the flow
   * begins and [stopRecording] when it ends.
   */
  startRecordingOnInit?: boolean;

  /** Milliseconds between replay frames on a screen that is not being touched. */
  captureIntervalMs?: number;

  /**
   * Print what the SDK is doing.
   *
   * Declared because the iOS bridge already read it and nothing said so: a flag the native side honours and the
   * types do not mention is a flag nobody can find. Off by default — a library that writes unattributed lines
   * into an app's console is one its developer comes to resent.
   */
  verbose?: boolean;
  /** Must match the ingest service's idle timeout, or sessions split or run together. */
  sessionTimeoutMs?: number;
}

/**
 * Starts the SDK. Call this once, before the app renders.
 *
 * ```tsx
 * import LightSession from 'lightsession-react-native';
 *
 * LightSession.init({
 *   apiKey: '…',
 *   ingestUrl: 'https://ingest.example.com',
 *   apiUrl: 'https://api.example.com',
 * });
 * ```
 *
 * All of it is JavaScript: there is no `MainApplication` to edit and no Gradle line to add, because
 * the native module is autolinked and takes its Application context from React itself.
 *
 * One honest limitation. This runs when the JS bundle runs, so anything shown *before* that — a native
 * splash — is not recorded. Initialising on the native side still catches it, at the cost of the Kotlin
 * this exists to avoid; ask if you need that and it can be offered as an option rather than a
 * requirement.
 *
 * Calling it twice does nothing: the SDK keeps the first configuration.
 */
export function init(options: LightSessionOptions): void {
  NativeLightSession.init(options);
}

/** Reports the current screen. Repeats are ignored natively, so calling it often is free. */
export function setScreen(name: string): void {
  NativeLightSession.setScreen(name);
}

export function identify(
  userId: string,
  traits: Record<string, unknown> = {},
): void {
  NativeLightSession.identify(userId, traits);
}

export function reset(): void {
  NativeLightSession.reset();
}

export function startRecording(): void {
  NativeLightSession.startRecording();
}

export function stopRecording(): void {
  NativeLightSession.stopRecording();
}

export function isRecording(): boolean {
  return NativeLightSession.isRecording();
}

/** A part of a screen that is a place of its own: a modal, a tab, a wizard step. */
export function setSubScreen(name: string): void {
  NativeLightSession.setSubScreen(name);
}

export function clearSubScreen(name: string): void {
  NativeLightSession.clearSubScreen(name);
}

export default {
  init,
  setScreen,
  identify,
  reset,
  startRecording,
  stopRecording,
  isRecording,
  setSubScreen,
  clearSubScreen,
};
