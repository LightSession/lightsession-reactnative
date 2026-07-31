import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * The native surface, as React Native's codegen sees it.
 *
 * Deliberately thin. Everything the SDKs do on their own — capturing frames, drawing wireframes, masking text,
 * recording touches — needs nothing from JavaScript, because React Native renders to real platform views and
 * both SDKs read those directly. Measured on each: the wireframe of an RN screen comes out legible and every
 * `Text` arrives masked, with no bridge involved.
 *
 * What neither platform can know is which screen you are on. An RN app is one Activity on Android and one view
 * controller on iOS, and every screen inside it is a JavaScript concern no lifecycle callback hears about. So
 * that is what crosses the bridge, and almost nothing else.
 *
 * The rest of the methods are here because they are things only the app knows *when* to do — who the
 * user is, when a flow worth recording starts — not because native cannot do them.
 */
export interface Spec extends TurboModule {
  /**
   * Starts the SDK, from JavaScript, so an app never edits its `MainApplication`.
   *
   * The Application context comes from the module's own `ReactApplicationContext`, so nothing has to
   * be threaded in — which is what makes a zero-native-code integration possible at all.
   *
   * `Object` rather than a typed shape on purpose: this is the codegen boundary, and every field is
   * optional except three. The typed surface lives in `index.tsx`, which is what an app actually
   * reads, and keeping the generated signature loose means adding a config field later does not
   * regenerate a Kotlin abstract method and break the build of anyone mid-upgrade.
   */
  init(config: Object): void;

  /**
   * Reports the screen the app is on. Safe to call with the screen already showing; the SDK ignores
   * a repeat, which is what makes it safe to wire straight to a navigator that re-emits state on
   * every re-render.
   */
  setScreen(name: string): void;

  /** Attributes everything recorded on this install, including what came before, to one person. */
  identify(userId: string, traits: Object): void;

  /** The counterpart to `identify`. Call before signing out, not after. */
  reset(): void;

  startRecording(): void;
  stopRecording(): void;
  isRecording(): boolean;

  /** Declares part of a screen as a screen of its own — a modal, a tab, a wizard step. */
  setSubScreen(name: string): void;
  clearSubScreen(name: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('LightSession');
