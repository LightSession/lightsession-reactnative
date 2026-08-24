import NativeLightSession from './NativeLightSession';
import {reportedUrls} from './internal';

/**
 * Records the HTTP requests the app makes, from JavaScript.
 *
 * ## Why here and not in the native networking
 *
 * React Native has no HTTP client of its own to hand an interceptor to. `fetch` is the
 * `whatwg-fetch` polyfill over `XMLHttpRequest`, which descends into OkHttp on Android and
 * `RCTHTTPRequestHandler` on iOS.
 *
 * Android would take our OkHttp interceptor through `OkHttpClientProvider`, cleanly. iOS has no
 * equivalent: `RCTSetCustomNSURLSessionConfigurationProvider` hands over a *configuration*, not a
 * delegate — the delegate is `RCTHTTPRequestHandler` itself — which leaves `URLProtocol` (it
 * re-issues every request it intercepts) or swizzling (it has to be right about a private
 * implementation on every future OS). Both were rejected for the native SDKs and are not better
 * here.
 *
 * So the seam is `XMLHttpRequest`, and because `fetch` is built on it, one wrapper catches `fetch`,
 * `axios`, and anything else written on top of either. One implementation, both platforms, no
 * native trickery — and the two platforms cannot disagree, which they would with two.
 *
 * ## What crosses the bridge
 *
 * The URL, whole. Collapsing the path, dropping the query, choosing the sample and computing the
 * weight all happen natively, in the code that is already tested there. A JavaScript copy of those
 * rules would be a third implementation of a set whose subtle cases were found the hard way — an
 * email is not a file extension — and implementations that almost agree split one endpoint into two
 * rows.
 *
 * ## What this cannot see, stated rather than discovered
 *
 * Requests the *native* side makes on its own: an `<Image>` fetching a URL, another native module
 * doing its own HTTP. What a customer wants to see are their API calls, which come from JavaScript,
 * but the gap is real.
 *
 * And the duration is measured here, so it includes time the request spent waiting on a busy JS
 * thread. That is arguably the honest number — it is what the person waited — but it is not the
 * pure time on the wire, and a screen doing heavy work will read slower than a network trace would.
 */

/** Undoes {@link captureNetwork}. Returned rather than exported so there is only one to hold. */
export type StopCapturing = () => void;

interface Tracked {
  method: string;
  url: string;
  startedAt: number;
  requestBytes: number;
}

/**
 * A weak side-table rather than a property on the request.
 *
 * Writing our fields onto the caller's `XMLHttpRequest` would be visible to them, could collide
 * with a library doing the same, and would keep the entry alive as long as they held the object. A
 * `WeakMap` is invisible and lets a request that is dropped mid-flight be collected with its entry.
 */
const tracked = new WeakMap<XMLHttpRequest, Tracked>();

let installed: StopCapturing | null = null;

/**
 * The dev server's URL, or `null` in a release build.
 *
 * Read through a `try` because the module is React Native's internal and has moved between
 * versions. A miss costs some development-time noise, not a broken app.
 */
function devServerUrl(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const getDevServer = require('react-native/Libraries/Core/Devtools/getDevServer');
    const url = (getDevServer.default ?? getDevServer)()?.url;
    return typeof url === 'string' && url.length > 0 ? url : null;
  } catch {
    return null;
  }
}

/**
 * Whether a request is ours or the toolchain's rather than the app's.
 *
 * Two things get skipped, and the first was found by looking at what actually arrived:
 *
 * **The dev server.** React Native talks to Metro over `XMLHttpRequest` — `/symbolicate` for every
 * stack trace, and the hot-reload channel. Those are the toolchain, not the app, and left in they
 * put `POST 10.0.2.2/symbolicate` at the top of the endpoint list of anyone reading their dashboard
 * while developing. Measured: it was the *only* thing captured on a screen that makes no requests
 * of its own.
 *
 * **Our own ingest and API.** Nothing routes there through `XMLHttpRequest` today — the SDKs upload
 * natively — so this is defence rather than a fix. It costs a string compare and removes the one
 * shape of bug that would be genuinely confusing: a measurement that measures itself, growing with
 * every batch it sends.
 */
function isOurs(url: string): boolean {
  const dev = devServerUrl();
  if (dev && url.startsWith(dev)) return true;
  for (const own of reportedUrls()) {
    if (own && url.startsWith(own)) return true;
  }
  return false;
}

/**
 * How many bytes a request body is, without consuming it.
 *
 * Only a string and a few length-bearing shapes are measured. Nothing is read, iterated or
 * stringified: `JSON.stringify` on a caller's object would cost real time on every request, and
 * reading a stream would consume the body the app is about to send — which is exactly the failure
 * the native interceptors are written to avoid. Unknown is `0`, and the server reads `0` as unknown
 * rather than as empty.
 */
function bodyLength(body: unknown): number {
  if (typeof body === 'string') return body.length;
  if (body && typeof body === 'object') {
    const sized = body as {size?: unknown; byteLength?: unknown};
    if (typeof sized.size === 'number') return sized.size;
    if (typeof sized.byteLength === 'number') return sized.byteLength;
  }
  return 0;
}

/**
 * Starts recording the app's HTTP requests. Call once, after `init`.
 *
 * ```ts
 * LightSession.init({ apiKey: '…', ingestUrl: '…', apiUrl: '…', captureNetwork: true });
 * LightSession.captureNetwork();
 * ```
 *
 * Two steps on purpose, matching the native SDKs: the config flag arms the recording and this puts
 * us in the path. Either one alone records nothing, so being in an app's network path is never
 * something that happened by default.
 *
 * Calling twice is a no-op — the second call returns the first's stop function rather than wrapping
 * a wrapper, which would report every request twice.
 */
export function captureNetwork(): StopCapturing {
  if (installed) return installed;

  // `globalThis`, not `global`: the second is a Node type that a consumer's `tsconfig` may not
  // include, and this file has to typecheck inside an app's own build, not only inside ours. Found
  // by installing the package into an RN app and running its `tsc`.
  const OriginalXHR = globalThis.XMLHttpRequest;
  if (!OriginalXHR) return () => {};

  const proto = OriginalXHR.prototype;
  const originalOpen = proto.open;
  const originalSend = proto.send;

  proto.open = function open(this: XMLHttpRequest) {
    // Recorded before calling through, because `open` is where the method and URL are stated and
    // `XMLHttpRequest` exposes neither afterwards. Done first so a throw from the original leaves
    // no half-tracked request behind.
    // eslint-disable-next-line prefer-rest-params
    const args = arguments as unknown as [string, string];
    tracked.set(this, {
      method: typeof args[0] === 'string' ? args[0] : '',
      url: typeof args[1] === 'string' ? args[1] : '',
      startedAt: 0,
      requestBytes: 0,
    });
    // eslint-disable-next-line prefer-rest-params, @typescript-eslint/no-explicit-any
    return originalOpen.apply(this, arguments as any);
  } as typeof proto.open;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proto.send = function send(this: XMLHttpRequest, body?: any) {
    const entry = tracked.get(this);
    // Checked on `send` rather than on `open`, so the URL is the one that will actually be
    // requested and the skip costs nothing for a request that is never sent.
    if (entry && entry.url && !isOurs(entry.url)) {
      entry.startedAt = Date.now();
      entry.requestBytes = bodyLength(body);

      // One flag rather than relying on which event fires first. A timeout is followed by
      // `loadend`, and an abort's `readyState` is not the same across implementations — a report
      // that depended on either would double-count on one platform and miss on another.
      let reported = false;

      const report = (failure: string) => {
        if (reported) return;
        reported = true;
        const durationMs = Date.now() - entry.startedAt;
        // `0` when the request never got an answer, which is what the native side and the server
        // both read as a failure.
        const status = typeof this.status === 'number' ? this.status : 0;

        let responseBytes = 0;
        try {
          // The declared length, never the body. Reading `responseText` to measure it would copy
          // every response on the JS thread, and for a blob or an arraybuffer it throws.
          const declared = this.getResponseHeader('content-length');
          if (declared) responseBytes = parseInt(declared, 10) || 0;
        } catch {
          /* headers are unavailable on an aborted request */
        }

        NativeLightSession.recordRequest(
          entry.method,
          entry.url,
          status,
          durationMs,
          entry.requestBytes,
          responseBytes,
          failure,
        );
      };

      // The four terminal events, each naming its own outcome. `loadend` alone would be one
      // listener, but it cannot say *how* the request ended, and the difference between a timeout
      // and a cancelled request is exactly what somebody reading the endpoint list needs.
      //
      // Every handler is wrapped: this code sits in the path of the app's own requests, and a
      // throw here must never reach them.
      const guard = (failure: string) => () => {
        try {
          report(failure);
        } catch {
          /* never throw into the app's request */
        }
      };
      this.addEventListener('load', guard(''));
      this.addEventListener('error', guard('io'));
      this.addEventListener('timeout', guard('timeout'));
      this.addEventListener('abort', guard('cancelled'));
    }
    // eslint-disable-next-line prefer-rest-params, @typescript-eslint/no-explicit-any
    return originalSend.apply(this, arguments as any);
  } as typeof proto.send;

  installed = () => {
    proto.open = originalOpen;
    proto.send = originalSend;
    installed = null;
  };
  return installed;
}
