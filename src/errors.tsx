import NativeLightSession from './NativeLightSession';

/**
 * JavaScript errors, reported in their own terms.
 *
 * Before this a JavaScript error reached the dashboard only when it killed the app, and then as the
 * native exception React Native kills it with: `com.facebook.react.common.JavascriptException` on
 * Android, `RCTFatalException: Unhandled JS Exception: …` on iOS. The server groups an error on its
 * type and its frames, so on Android every JavaScript crash of an app was one group — the type and
 * the frames are React Native's — and on iOS, where the message is part of the name, every message was
 * a group of its own. Neither carried a single JavaScript frame. And an error the app survived — a
 * promise nobody caught, a render an error boundary took over — never arrived at all.
 *
 * ## Where it listens
 *
 * React Native's `ExceptionsManager.handleException`, which is its own funnel for errors. What
 * escapes an event handler or a timer arrives there from the global handler, and what escapes a
 * render arrives there from React's uncaught-error callback — directly, without going near the
 * global handler. That second path is the commonest crash a React app has, and it is why
 * `ErrorUtils.setGlobalHandler`, the hook everyone reaches for, is not enough on its own: it never
 * sees a component that threw.
 *
 * The module is React Native's internal, read through a `try` like the dev server is in
 * `network.tsx`; React Native's Metro config makes a module that is not there a runtime miss rather
 * than a build failure. The wrapper reports and then calls what was there, with the same arguments,
 * so the red box, the console and the crash all happen exactly as they did.
 *
 * ## A crash, and the native crash after it
 *
 * In a release build React Native ends the process over an error nothing caught, by throwing a
 * native exception right after this has run. So a fatal error in release is reported as a crash —
 * `handled: false` — and it has to be on disk before the native exception is thrown, which is why the
 * bridge call is synchronous. The native SDK takes a crash reported this way as the death that
 * follows it, and does not record the native exception a second time.
 *
 * In development the same error opens the red box and the app keeps running, so there it is an error,
 * not a crash.
 */

// Module-scoped rather than global, so it cannot collide with a declaration the app's own types make.
declare const __DEV__: boolean;

/** Strings, numbers and booleans; the native side drops anything else rather than stringifying it. */
export type ErrorAttributes = Record<string, string | number | boolean>;

/** How an error reached us, sent as `mechanism`. */
type Mechanism =
  | 'global_handler'
  | 'react_render'
  | 'error_boundary'
  | 'unhandled_rejection';

/** One frame, in the shape the SDKs' `ErrorFrame` takes. */
type Frame = {
  module: string;
  function: string;
  file?: string;
  line?: number;
  inApp: boolean;
};

/** A frame as React Native's own stack parser returns it. */
type ParsedFrame = {
  methodName?: string | null;
  file?: string | null;
  lineNumber?: number | null;
};

type ExceptionsManager = {
  handleException?: (error: unknown, isFatal: boolean) => void;
};

type RejectionOptions = {
  allRejections?: boolean;
  onUnhandled?: (id: number, rejection: unknown) => void;
  onHandled?: (id: number, rejection?: unknown) => void;
};

/** What a native error keeps of a message; the rest is cut there anyway, and need not cross. */
const MAX_TEXT = 2048;

let installed = false;
let crashReported = false;

/**
 * Set while React Native's own rejection warning runs. It builds an `Error` of its own and hands it
 * to `handleException`, and that one is the rejection a second time, already reported.
 */
let forwardingRejection = false;

/** Installs the listeners. Idempotent, like `init`. */
export function installErrorCapture(): void {
  if (installed) return;
  installed = true;
  listenToExceptionsManager();
  trackRejections();
}

/**
 * Reports one error. Never throws: this runs inside React Native's own error path, and an exception
 * from here would replace the error being reported with one of ours.
 *
 * @param fatal whether React Native treats the error as fatal. It is a crash only in a release build,
 *   see the module doc.
 */
export function reportError(
  error: unknown,
  mechanism: Mechanism,
  fatal: boolean,
  attributes: ErrorAttributes = {},
): void {
  try {
    const crash = fatal && !__DEV__;
    if (crash) {
      // One per process. React Native reports only the first fatal error as well; the rest arrive
      // while the process is already on its way down.
      if (crashReported) return;
      crashReported = true;
    }
    const described = describe(error);
    NativeLightSession.recordError(
      described.type,
      described.message,
      described.frames,
      !crash,
      mechanism,
      {...described.attributes, ...attributes},
    );
  } catch {
    // Nothing to do: see above.
  }
}

function listenToExceptionsManager(): void {
  let manager: ExceptionsManager | undefined;
  try {
    const module = require('react-native/Libraries/Core/ExceptionsManager');
    manager = module?.default ?? module;
  } catch {
    return;
  }
  const original = manager?.handleException;
  if (!manager || typeof original !== 'function') return;

  manager.handleException = function (this: unknown, error: unknown, isFatal: boolean) {
    if (!forwardingRejection) {
      reportError(error, mechanismOf(error, isFatal), isFatal === true);
    }
    return original.call(this, error, isFatal);
  };
}

/**
 * Where an error that reached `handleException` came from. A component error carries the component
 * stack React attached to it, and is fatal only when no error boundary caught it.
 */
function mechanismOf(error: unknown, isFatal: boolean): Mechanism {
  const isComponentError =
    typeof error === 'object' && error !== null && (error as {isComponentError?: unknown}).isComponentError === true;
  if (!isComponentError) return 'global_handler';
  return isFatal ? 'react_render' : 'error_boundary';
}

/**
 * Unhandled promise rejections, which React Native does not report at all in a release build.
 *
 * Hermes only, which is React Native's engine by default. Hermes keeps one rejection tracker and
 * enabling it replaces whatever was there, so in development — where React Native already enabled it,
 * to warn about rejections — its options are called from ours and the warning stays. If they cannot
 * be read, nothing is replaced: a rejection then arrives the way React Native's warning hands it over.
 *
 * A tracker another library enabled before `init` is replaced the same way, and there is no calling
 * it from ours: Hermes has no way to ask what is installed. Whichever library enables tracking last
 * is the one that hears rejections.
 */
function trackRejections(): void {
  const hermes = (globalThis as {HermesInternal?: any}).HermesInternal;
  if (
    typeof hermes?.hasPromise !== 'function' ||
    !hermes.hasPromise() ||
    typeof hermes.enablePromiseRejectionTracker !== 'function'
  ) {
    return;
  }

  let warning: RejectionOptions | undefined;
  if (__DEV__) {
    warning = reactNativeRejectionOptions();
    if (!warning) return;
  }

  hermes.enablePromiseRejectionTracker({
    allRejections: true,
    onUnhandled: (id: number, rejection: unknown) => {
      reportError(rejection, 'unhandled_rejection', false);
      if (warning?.onUnhandled) {
        forwardingRejection = true;
        try {
          warning.onUnhandled(id, rejection);
        } finally {
          forwardingRejection = false;
        }
      }
    },
    onHandled: (id: number, rejection?: unknown) => warning?.onHandled?.(id, rejection),
  });
}

function reactNativeRejectionOptions(): RejectionOptions | undefined {
  try {
    const module = require('react-native/Libraries/promiseRejectionTrackingOptions');
    const options = module?.default ?? module;
    return typeof options?.onUnhandled === 'function' ? options : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The error in the SDKs' terms: its type, its message and its frames.
 *
 * The type is the error's `name` — `TypeError` — which is what React Native prints and what the server
 * groups on. A value that is not an `Error` — `throw 'text'`, `Promise.reject(404)` — has no name and no
 * stack, and its type says what kind of value was thrown instead.
 */
function describe(error: unknown): {
  type: string;
  message: string;
  frames: Frame[];
  attributes: ErrorAttributes;
} {
  if (!(error instanceof Error)) {
    return {type: kindOf(error), message: bounded(textOf(error)), frames: [], attributes: {}};
  }
  const attributes: ErrorAttributes = {};
  // Which component threw, for an error in a render: React attaches the component stack, and it is
  // the only place a release build names the screen's own components.
  const componentStack = (error as {componentStack?: unknown}).componentStack;
  if (typeof componentStack === 'string' && componentStack.trim().length > 0) {
    attributes['react.component_stack'] = bounded(componentStack.trim());
  }
  return {
    type: typeof error.name === 'string' && error.name.length > 0 ? error.name : 'Error',
    message: bounded(typeof error.message === 'string' ? error.message : ''),
    frames: framesOf(error),
    attributes,
  };
}

/**
 * The stack, through React Native's own parser — the frames its red box shows and its native
 * exception carries, Hermes's `address at` form included.
 *
 * No frame is marked as the app's. A release bundle is one file, and nothing in it tells the app's
 * functions from React's or a library's; the server groups on the first frames of any origin when none
 * is marked, which here is the throw site and its callers.
 */
function framesOf(error: Error): Frame[] {
  if (typeof error.stack !== 'string' || error.stack.length === 0) return [];
  let parsed: ParsedFrame[];
  try {
    const module = require('react-native/Libraries/Core/Devtools/parseErrorStack');
    const parse = module?.default ?? module;
    parsed = typeof parse === 'function' ? parse(error.stack) : [];
  } catch {
    return [];
  }
  const frames: Frame[] = [];
  for (const entry of Array.isArray(parsed) ? parsed : []) {
    const file = fileOf(entry?.file);
    frames.push({
      module: '',
      function: typeof entry?.methodName === 'string' && entry.methodName.length > 0 ? entry.methodName : '?',
      ...(file ? {file} : {}),
      ...(typeof entry?.lineNumber === 'number' ? {line: entry.lineNumber} : {}),
      inApp: false,
    });
  }
  return frames;
}

/**
 * The bundle's name without its path and query: `index.android.bundle`, `main.jsbundle`. In
 * development it is the dev server's URL, whose query runs to a few hundred characters of flags —
 * and on Android it starts with `//&` rather than `?`, which is how React Native hands the URL to
 * Hermes. Measured: split on `?` alone, the name sent was `&platform=android&dev=true&…`.
 */
function fileOf(file: string | null | undefined): string | undefined {
  if (typeof file !== 'string' || file.length === 0) return undefined;
  const path = file.split('?')[0].split('//&')[0];
  const name = path.slice(path.lastIndexOf('/') + 1);
  return name.length > 0 ? name : undefined;
}

function kindOf(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  const name = (value as {constructor?: {name?: unknown}}).constructor?.name;
  return typeof name === 'string' && name.length > 0 ? name : typeof value;
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    const json = JSON.stringify(value);
    if (typeof json === 'string') return json;
  } catch {
    // A cycle, or a value that refuses: its string form below.
  }
  return String(value);
}

function bounded(text: string): string {
  return text.length <= MAX_TEXT ? text : text.slice(0, MAX_TEXT);
}
