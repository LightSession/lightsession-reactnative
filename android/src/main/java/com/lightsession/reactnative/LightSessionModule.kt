package com.lightsession.reactnative

import android.app.Application
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import com.lightsession.LightSession
import com.lightsession.LightSessionConfig

/**
 * The bridge, and it is thin because almost nothing needs to cross it.
 *
 * React Native renders to real Android Views, and the SDK reads those directly — so the wireframe, the
 * masking, the touch heatmap and the replay frames all work with no JavaScript involved at all.
 * Measured on a stock RN app: the wireframe of an RN screen comes out legible and every `Text` arrives
 * masked.
 *
 * What the platform genuinely cannot know is **which screen you are on**. An RN app is one Activity
 * hosting everything, so no lifecycle callback, FragmentManager or NavController distinguishes its
 * screens. That single fact is why this module exists; the rest of the methods are here because only
 * the app knows *when* to call them, not because native could not.
 *
 * Every method is a straight delegation with no state of its own. State kept here would be a second
 * copy of something the SDK already owns, and two copies of one truth is how they come to disagree.
 */
@ReactModule(name = LightSessionModule.NAME)
class LightSessionModule(context: ReactApplicationContext) :
    NativeLightSessionSpec(context) {

    override fun getName(): String = NAME

    /**
     * Starts the SDK from JavaScript, so an app integrating this never touches its `MainApplication`.
     *
     * The Application comes from the React context, which is why this can exist at all — the SDK needs
     * one to register lifecycle callbacks, and asking the app to pass it would put us back in Kotlin.
     *
     * Two fields are decided here rather than exposed:
     *
     *  * `screensReportedByHost` is forced on. By definition a React Native app names its own screens,
     *    so leaving it as a choice offers a decision with one correct answer — and getting it wrong
     *    puts a node named after the Activity at the top of every session, permanently.
     *  * `wireframeMode` is left at its default, because RN renders to real Android Views and the
     *    rectangle path reads them correctly. Measured: the wireframe of an RN screen comes out
     *    legible, with every `Text` masked.
     *
     * Late by construction, and worth being honest about: this runs when the JS bundle runs, so a
     * splash shown before that is not recorded. Initialising in `MainApplication` still catches it —
     * at the cost of the Kotlin this exists to avoid.
     */
    override fun init(config: ReadableMap?) {
        val map = config ?: run {
            Log.w(NAME, "init called with no config; ignored")
            return
        }

        val application = reactApplicationContext.applicationContext as? Application ?: run {
            // Not reachable in a normal app, and not worth a crash if it ever is: a recorder that
            // cannot start should let the app keep running.
            Log.e(NAME, "no Application context; LightSession not started")
            return
        }

        val apiKey = map.stringOrNull("apiKey")
        val ingestUrl = map.stringOrNull("ingestUrl")
        val apiUrl = map.stringOrNull("apiUrl")
        if (apiKey == null || ingestUrl == null || apiUrl == null) {
            // Named individually, because "invalid config" sends the reader to check all three.
            Log.e(
                NAME,
                "init needs apiKey, ingestUrl and apiUrl; missing: " +
                    listOfNotNull(
                        "apiKey".takeIf { apiKey == null },
                        "ingestUrl".takeIf { ingestUrl == null },
                        "apiUrl".takeIf { apiUrl == null },
                    ).joinToString(", "),
            )
            return
        }

        val defaults = LightSessionConfig(apiKey, ingestUrl, apiUrl)
        val settings = LightSessionConfig(
            apiKey = apiKey,
            ingestUrl = ingestUrl,
            apiUrl = apiUrl,
            // Every optional field falls back to the SDK's own default rather than to a literal
            // repeated here. A second copy of a default is a second thing to update, and it goes
            // stale silently — the reader sees a number and cannot tell it is out of date.
            enableReplay = map.boolOr("enableReplay", defaults.enableReplay),
            maskText = map.boolOr("maskText", defaults.maskText),
            maskImages = map.boolOr("maskImages", defaults.maskImages),
            captureRealScreens = map.boolOr("captureRealScreens", defaults.captureRealScreens),
            trackTabs = map.boolOr("trackTabs", defaults.trackTabs),
            trackModals = map.boolOr("trackModals", defaults.trackModals),
            collectLocation = map.boolOr("collectLocation", defaults.collectLocation),
            startRecordingOnInit =
                map.boolOr("startRecordingOnInit", defaults.startRecordingOnInit),
            captureIntervalMs = map.longOr("captureIntervalMs", defaults.captureIntervalMs),
            sessionTimeoutMs = map.longOr("sessionTimeoutMs", defaults.sessionTimeoutMs),
            // Off by default in the SDK, and left that way here. The JavaScript side also has to
            // install its interceptor before anything is recorded, so this is one of two switches
            // rather than the only one — same shape as the native integration.
            captureNetwork = map.boolOr("captureNetwork", defaults.captureNetwork),
            networkSampleRate =
                map.doubleOr("networkSampleRate", defaults.networkSampleRate),
            // Not a choice. See the kdoc.
            screensReportedByHost = true,
        )

        // On the main thread, because a TurboModule method does not run there.
        //
        // React Native calls native modules on the bridge's own thread, and `LightSession.init`
        // registers a `ProcessLifecycleOwner` observer — `LifecycleRegistry.addObserver` enforces the
        // main thread and throws otherwise. From JavaScript that surfaces as a red screen on launch,
        // so the failure is loud rather than silent; it is still a failure that only appears once the
        // integration is the one this package is for.
        //
        // Hopped here rather than inside the SDK: the SDK's contract is that init happens where an
        // `Application.onCreate` happens, which is the main thread. It is this bridge that changed the
        // thread, so it is this bridge's job to change it back.
        runOnMain { LightSession.getInstance().init(application, settings) }
    }

    /**
     * One request, from JavaScript.
     *
     * Not hopped to the main thread, unlike [init], and that is deliberate: this runs once per
     * request and the SDK's recording path is built to be called from a network thread — hopping
     * would put every request the app makes onto the main thread's queue, which is the opposite of
     * what a measurement should cost.
     *
     * `Double` for the numbers because that is what the codegen gives for a JavaScript `number`.
     * Rounded rather than truncated, so a 118.7 ms request is not reported as 118.
     */
    override fun recordRequest(
        method: String?,
        url: String?,
        statusCode: Double,
        durationMs: Double,
        requestBytes: Double,
        responseBytes: Double,
        error: String?,
    ) {
        if (method.isNullOrBlank() || url.isNullOrBlank()) return
        LightSession.getInstance().recordRequest(
            method = method,
            url = url,
            statusCode = statusCode.toInt(),
            durationMs = Math.round(durationMs),
            requestBytes = Math.round(requestBytes),
            responseBytes = Math.round(responseBytes),
            error = error ?: "",
        )
    }

    /** Runs now if already on the main thread, and posts if not. */
    private inline fun runOnMain(crossinline block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block()
        else Handler(Looper.getMainLooper()).post { block() }
    }

    private fun ReadableMap.stringOrNull(key: String): String? =
        if (hasKey(key) && !isNull(key)) getString(key)?.trim()?.takeIf { it.isNotEmpty() } else null

    private fun ReadableMap.boolOr(key: String, fallback: Boolean): Boolean =
        if (hasKey(key) && !isNull(key)) getBoolean(key) else fallback

    /**
     * A JavaScript number is a double, so a duration arrives as one and has to come back as a Long.
     *
     * Reading it as an Int would silently wrap anything past ~24 days of milliseconds, which is not a
     * duration anyone configures — but the same read is used for intervals, and a wrong number here
     * changes how often the screen is captured.
     */
    private fun ReadableMap.doubleOr(key: String, fallback: Double): Double =
        if (hasKey(key) && !isNull(key)) getDouble(key) else fallback

    private fun ReadableMap.longOr(key: String, fallback: Long): Long =
        if (hasKey(key) && !isNull(key)) getDouble(key).toLong() else fallback

    /**
     * Reports the current screen.
     *
     * Safe to call with the screen already showing: the SDK drops a repeat, which is what makes it
     * safe to wire straight to a navigator that re-emits state on every re-render.
     */
    override fun setScreen(name: String) {
        LightSession.getInstance().setScreen(name)
    }

    override fun identify(userId: String, traits: ReadableMap?) {
        LightSession.getInstance().identify(userId, traits?.toHashMap() ?: emptyMap<String, Any?>())
    }

    override fun reset() {
        LightSession.getInstance().reset()
    }

    override fun startRecording() {
        LightSession.getInstance().startRecording()
    }

    override fun stopRecording() {
        LightSession.getInstance().stopRecording()
    }

    override fun isRecording(): Boolean = LightSession.getInstance().isRecording

    override fun setSubScreen(name: String) {
        LightSession.getInstance().setSubScreen(name)
    }

    override fun clearSubScreen(name: String) {
        LightSession.getInstance().clearSubScreen(name)
    }

    companion object {
        const val NAME = "LightSession"
    }
}
