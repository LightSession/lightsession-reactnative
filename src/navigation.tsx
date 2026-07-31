import {useRef} from 'react';
import {createNavigationContainerRef} from '@react-navigation/native';

import {setScreen} from './index';

/**
 * React Navigation support, in its own module so it is only imported by apps that use it.
 *
 * Everything here rests on two props React Navigation documents for exactly this purpose — `onReady`
 * and `onStateChange`, the ones their own screen-tracking guide uses. Public API, not internals, so
 * this does not break when their internals move. That matters: reading a navigator's private state is
 * how integrations rot.
 */

export interface NavigationTracking {
  ref: ReturnType<typeof createNavigationContainerRef>;
  onReady: () => void;
  onStateChange: () => void;
}

/**
 * Props to spread onto `NavigationContainer`.
 *
 * ```tsx
 * const tracking = useLightSessionNavigation();
 * return (
 *   <NavigationContainer {...tracking}>
 *     …
 *   </NavigationContainer>
 * );
 * ```
 *
 * **Both** callbacks matter, and `onReady` is the one people leave out. `onStateChange` does not fire
 * for the screen the app *opens* on, so wiring only that loses the entry point of every session — and
 * the entry point is the one screen you can be sure every user saw.
 *
 * The ref is created here rather than asked for, because a caller who has to create and thread one is
 * a caller who can thread it wrongly. An app that already keeps its own ref should pass that instead
 * and call [setScreen] from its own `onStateChange`; the ref is the only reason this hook exists
 * rather than a plain object.
 *
 * `getCurrentRoute()` returns the deepest active route, so a screen inside a nested navigator reports
 * as itself rather than as the tab containing it — which is the same distinction the Android SDK draws
 * between a nested Compose NavHost's destinations and the screen hosting them.
 */
export function useLightSessionNavigation(): NavigationTracking {
  // Created once. A ref rebuilt on re-render would detach the container from the thing being read.
  const refHolder = useRef<ReturnType<typeof createNavigationContainerRef>>();
  if (!refHolder.current) {
    refHolder.current = createNavigationContainerRef();
  }
  const ref = refHolder.current;

  // Guarded here as well as natively. The native side ignores a repeat, so this is not needed for
  // correctness — it is here to keep a re-render from crossing the bridge dozens of times a second on
  // a screen with an animation driving state.
  const lastReported = useRef<string | null>(null);

  const report = () => {
    if (!ref.isReady()) return;
    const name = ref.getCurrentRoute()?.name;
    if (!name || name === lastReported.current) return;
    lastReported.current = name;
    setScreen(name);
  };

  return {ref, onReady: report, onStateChange: report};
}
