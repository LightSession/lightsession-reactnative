# @lightsession/react-native

Session recording and screen mapping for React Native, on **Android and iOS**.

| Package | npm | React Native | Android API | iOS |
| --- | --- | --- | --- | --- |
| `@lightsession/react-native` | [![npm](https://img.shields.io/npm/v/@lightsession/react-native?style=for-the-badge&color=green)](https://www.npmjs.com/package/@lightsession/react-native) | 0.76+ | 26 | 15.0 |

```sh
npm install @lightsession/react-native
cd ios && pod install
```

The floors come from the native SDKs this wraps — [Android](https://central.sonatype.com/artifact/io.lightsession/lightsession-android)
and [iOS](https://cocoapods.org/pods/LightSession) — and a library's minimum is a ceiling on
everyone who consumes it, so both are kept as low as their code allows. React Native 0.76 is where
the new architecture became the default, which is what this module's TurboModule needs.

Integrating it is JavaScript only. There is no `MainApplication.kt` to edit, no Gradle line to add and
no Kotlin anywhere in your app: the native module is autolinked and takes its Application context from
React itself.

```tsx
// index.js — before registerComponent, so the recorder is running when the first screen renders.
import LightSession from '@lightsession/react-native';

LightSession.init({
  apiKey: '…',
  ingestUrl: 'https://ingest.example.com',
  apiUrl: 'https://api.example.com',
});
```

Then, if you use React Navigation:

```tsx
import {NavigationContainer} from '@react-navigation/native';
import {useLightSessionNavigation} from '@lightsession/react-native/navigation';

const tracking = useLightSessionNavigation();
return <NavigationContainer {...tracking}>{/* … */}</NavigationContainer>;
```

`useLightSessionNavigation` returns `{ref, onReady, onStateChange}` — the three props React
Navigation's own screen-tracking guide uses. Public API, not internals, so it does not break when
their internals move. An app on a different navigator calls `setScreen(name)` itself and skips that
import entirely.

JavaScript errors report themselves, with their own type, message and frames: what escapes an event
handler, a timer or a render, what an error boundary caught, and a promise rejection nothing handled.
Each is then handed on to React Native unchanged, so the red box and the crash happen as before. An
error your code catches can be reported too:

```tsx
try {
  await checkout();
} catch (error) {
  LightSession.captureException(error, {step: 'payment'});
  showRetry();
}
```

`captureErrors: false` in `init` turns error capture off, the native crash capture included.

## Why this exists, and why it is small

The Android SDK maps screens by watching the platform: an Activity resumes, a `NavHostFragment`
changes destination, a Compose `NavController` reports one. React Native defeats all three. An RN app
is **one Activity** hosting a single root view, and every screen inside it is a JavaScript concern the
platform never hears about.

Screen identity is the *only* thing that has to cross the bridge. Everything else works untouched,
because RN renders to real Android Views and the SDK classifies them by superclass rather than by
class name:

```kotlin
if (view is EditText)  return INPUT
if (view is TextView)  return TEXT
if (view is ImageView) return IMAGE
if (view is ViewGroup) return CONTAINER
```

`ReactTextView` descends from `TextView`, `ReactEditText` from `EditText`, `ReactImageView` from
`ImageView`. So the wireframe scan, the masking, the touch heatmap and the replay frames have no
reason to know they are looking at a React Native app — and measurement says they do not.

## What was measured

The example app — screens of text, a form, a list, a web page, tabs, a nested stack, a modal route,
a Modal, an Alert, a declared panel and a screen that throws in each place a JavaScript error can
come from — walked end to end against a local backend, as a release build on an Android emulator
(`io.lightsession:lightsession-android` 0.39.1) and on an iOS simulator (`LightSession` 0.8.1):

| Question | Android | iOS |
| --- | --- | --- |
| Are the screens identified, as React Native? | **Yes** — every one `REACT_NATIVE` | **Yes**, the panel and the Modal included |
| Is the wireframe legible, or a grey slab? | **Legible** | **Legible** |
| Does the real-screen capture arrive? | **Yes**, one per screen | **Yes**, one per screen |
| Is RN text covered, with no RN-specific code? | **Yes** — the form's fields included | **Yes** |
| Is a web page covered? | **Yes**, whole | **Yes**, whole |
| Do replay frames arrive? | **Yes** | **Yes** |
| Are touches recorded? | **Yes** — 17 in an earlier run by hand; this walk was scripted | |
| Are the app's requests recorded? | **Yes** — path collapsed, query dropped | **Yes** |
| Are JavaScript errors reported as JavaScript errors? | **Yes** — type, message, frames | **Yes** |
| Does a JavaScript crash arrive once? | **No** on 0.39.1 — also as `JavascriptException`; once on the SDK that counts it once | **No** on 0.8.1 — also as `RCTFatalException`; likewise |
| Do buttons read as buttons? | **No**, as predicted — see below | |

That last one is a confirmed prediction of failure and worth keeping in writing: RN has no
`android.widget.Button`, so a `Pressable` classifies as a container. It is drawn and masked correctly;
it is simply not *labelled* a button in the wireframe. A gap that is understood is not the same as one
a customer discovers.

The web page is the case that decided the SDK versions this package requires. A WebView draws its page
itself, so nothing on it is a view the mask scan can read; with the Android SDK this package pinned
until then, 0.28.0, the page's name, address and card digits were legible in the screen map's stored
screenshot. From 0.37.0 a web view is covered whole.

## What had to change in the SDK

Two real bugs, both of which the Android path could hide and React Native could not, fixed in the
Android SDK's 0.13.0 — long since passed; this package requires 0.39.1 on Android and 0.8 on iOS.

1. **The wireframe was captured before the app existed.** The skeleton was generated 238 ms *before*
   `Running "example"` appeared in the log, producing a blank frame. The first attempted fix settled
   4 ms earlier and produced a PNG of byte-identical size — caught only by comparing file sizes, not
   by looking at the image. The capture now waits on the same settle detector Compose uses, and counts
   *drawing* leaves rather than any view, because a window is never empty: it always has furniture.

2. **A late-initialising SDK recorded no touches at all.** `Application.ActivityLifecycleCallbacks`
   do not replay, and JS-side init happens after the Activity has already resumed — so nothing ran
   `onActivityResumed`. Recovering the Activity reference was not enough: that callback also installs
   the window callback and the touch interceptor. Screens were named correctly and the sessions looked
   healthy, with zero interactions. It is now one `attachTo(activity)` called from both paths.

## Honest limitations

- **A JavaScript error's frames are the bundle's, not your source files'.** Hermes keeps function names in a
  release build, so each frame is named — `addToCart`, `OrderSummary` — but it points into one bundle with
  no source file or line, and no frame is marked as the app's own, because nothing in a bundle tells the
  app's functions from React's. The server groups on the first frames, so two errors of one type thrown from
  two functions that share a name, two `onPress` handlers, share a group. Reading the frames back to source
  files needs the build's source map, and that is not done yet.
- **Unhandled rejections are tracked through Hermes**, React Native's engine by default, and not on JSC.
  Hermes keeps one rejection tracker: a tracker another library enabled before `init` is replaced, and
  whichever library enables tracking last is the one that hears rejections.
- **`identify` records the user id on iOS and drops the traits**, and logs that it did. Android stores both.
- **A native splash shown before the JS bundle runs is not recorded**, because `init` runs when the
  bundle runs. Initialising in `MainApplication` still catches it, at the cost of the Kotlin this
  package exists to avoid; it can be offered as an option rather than a requirement.
- **No tests beyond CI building the example.** CI compiles the example on both platforms with its
  JavaScript bundled, which catches a native side that no longer builds and an import that no longer
  resolves; the evidence above is measurement on a device, the right kind for "does the platform
  cooperate" and the wrong kind for "does this keep working".

## The iOS half

The same shape as the Android half, and the same reason for existing: iOS cannot name a React Native screen
either. `UIViewController.viewDidAppear` fires once for the whole app, because the whole app is one controller.

```swift
// ios/LightSessionModule.mm — the entire native surface
- (void)init:(NSDictionary *)config {
    NSMutableDictionary *settings = [config mutableCopy];
    settings[@"screensReportedByHost"] = @YES;
    settings[@"reportedScreenKind"] = @"REACT_NATIVE";
    [LightSessionBridge start:settings verbose:…];
}
```

Two details worth knowing, because both were decisions rather than defaults:

- **`reportedScreenKind` is forced to `REACT_NATIVE`.** `setScreen` has two kinds of caller — a SwiftUI app and
  this — and neither the call nor the SDK can tell which is on the other end. Without this a screen reported
  through the bridge arrived labelled `SWIFTUI`, which is a lie that reads as a bug. The word matches Android's,
  so one app's two builds land on one node in the graph rather than on two that differ only by platform.
- **This pod depends on the SDK, it does not contain it.** `s.dependency "LightSession"`, mirroring Android's
  `implementation "io.lightsession:lightsession-android"`. Vendoring a copy of an SDK is a second thing to keep
  in step, and it never is. `LightSession` comes from CocoaPods trunk, so an app adds nothing to its Podfile.

## Layout

- `src/` — the public API. `index.tsx` is the typed surface, `NativeLightSession.ts` the codegen spec,
  `navigation.tsx` the React Navigation helper (a separate module so it is only imported when used),
  `errors.tsx` the JavaScript error capture.
- `android/` — the TurboModule. Thin delegation with no state of its own; two copies of one truth is
  how they come to disagree.
- `example/` — an RN app whose `MainApplication.kt` is the template's, **untouched**. That is the
  proof, not a convenience.
