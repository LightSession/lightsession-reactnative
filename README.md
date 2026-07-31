# lightsession-react-native

Session recording and screen mapping for React Native, on **Android and iOS**.

Integrating it is JavaScript only. There is no `MainApplication.kt` to edit, no Gradle line to add and
no Kotlin anywhere in your app: the native module is autolinked and takes its Application context from
React itself.

```tsx
// index.js — before registerComponent, so the recorder is running when the first screen renders.
import LightSession from 'lightsession-react-native';

LightSession.init({
  apiKey: '…',
  ingestUrl: 'https://ingest.example.com',
  apiUrl: 'https://api.example.com',
});
```

Then, if you use React Navigation:

```tsx
import {NavigationContainer} from '@react-navigation/native';
import {useLightSessionNavigation} from 'lightsession-react-native/navigation';

const tracking = useLightSessionNavigation();
return <NavigationContainer {...tracking}>{/* … */}</NavigationContainer>;
```

`useLightSessionNavigation` returns `{ref, onReady, onStateChange}` — the three props React
Navigation's own screen-tracking guide uses. Public API, not internals, so it does not break when
their internals move. An app on a different navigator calls `setScreen(name)` itself and skips that
import entirely.

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

A stock RN 0.86 app with three screens (`Home`, `Form`, `List`) on a React Navigation stack, recorded
end to end against a local backend:

| Question | Result |
| --- | --- |
| Are the screens identified? | **Yes** — three screens, each `kind = REACT_NATIVE` |
| Is the wireframe legible, or a grey slab? | **Legible** — one skeleton per screen |
| Does the real-screen capture arrive? | **Yes** — one screenshot per screen |
| Is masking applied to RN text? | **Yes**, with no RN-specific code |
| Are flows built? | **Yes** — `Home → Form → List` |
| Are touches recorded? | **Yes** — 17 interactions (3 taps, 14 swipes) in one run |
| Do replay frames arrive? | **Yes** — 431 frames |
| Do buttons read as buttons? | **No**, as predicted — see below |

That last one is a confirmed prediction of failure and worth keeping in writing: RN has no
`android.widget.Button`, so a `Pressable` classifies as a container. It is drawn and masked correctly;
it is simply not *labelled* a button in the wireframe. A gap that is understood is not the same as one
a customer discovers.

## What had to change in the SDK

Two real bugs, both of which the Android path could hide and React Native could not. Both are fixed in
`com.lightsession:lightsession-android:0.13.0`, which this package requires.

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

- **`identify` records the user id on iOS and drops the traits**, and logs that it did. Android stores both.
- **The `LightSession` pod is not published anywhere yet.** `npm install` followed by `pod install` cannot
  resolve it: the example works because its Podfile points at the SDK by path. This is the one thing that stops
  the iOS half from being usable outside this repository, and it is a publishing decision rather than code.
- **A native splash shown before the JS bundle runs is not recorded**, because `init` runs when the
  bundle runs. Initialising in `MainApplication` still catches it, at the cost of the Kotlin this
  package exists to avoid; it can be offered as an option rather than a requirement.
- **No tests yet.** The evidence above is measurement on a device, which is the right kind of evidence
  for "does the platform cooperate" and the wrong kind for "does this keep working".

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
  `implementation "com.lightsession:lightsession-android"`. Vendoring a copy of an SDK is a second thing to keep
  in step, and it never is. `LightSession` is not on a public spec repo yet, so the example's Podfile takes it
  by path — there is nothing clever about that and nothing hidden.

## Layout

- `src/` — the public API. `index.tsx` is the typed surface, `NativeLightSession.ts` the codegen spec,
  `navigation.tsx` the React Navigation helper (a separate module so it is only imported when used).
- `android/` — the TurboModule. Thin delegation with no state of its own; two copies of one truth is
  how they come to disagree.
- `example/` — an RN app whose `MainApplication.kt` is the template's, **untouched**. That is the
  proof, not a convenience.
