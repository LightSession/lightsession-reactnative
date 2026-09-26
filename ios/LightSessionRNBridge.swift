import Foundation
import LightSession

/// Ten lines that exist because of one build constraint, and it is worth naming rather than wondering about.
///
/// The TurboModule has to be Objective-C++: the protocol React Native's codegen produces is in a header that
/// refuses to compile as anything else. And Objective-C++ can reach the Swift of *its own* pod but not of a
/// different one — a static CocoaPods library's Swift compatibility header is not public, and `@import` needs
/// C++ modules, which React Native's build has off.
///
/// So the hop happens here, inside this package's pod: Swift to Swift across modules, which is ordinary, and
/// then Objective-C++ to this, which is the same-pod case that works. Two attempts came before it —
/// `#import <LightSession/LightSession-Swift.h>` (file not found) and `@import LightSession` (modules
/// disabled) — and the third is the one the platform actually supports.
///
/// Nothing is translated here but errors. `LightSessionBridge` in the SDK does the dictionary reading and is tested
/// there; duplicating it would put two readings of one config a rename apart.
@objc(LSRNBridge)
public final class LSRNBridge: NSObject {
    @objc public static func start(_ config: [String: Any], verbose: Bool) {
        LightSessionBridge.start(config, verbose: verbose)
    }

    @objc public static func setScreen(_ name: String) { LightSessionBridge.setScreen(name) }
    @objc public static func setSubScreen(_ name: String) { LightSessionBridge.setSubScreen(name) }
    @objc public static func clearSubScreen(_ name: String) { LightSessionBridge.clearSubScreen(name) }
    @objc public static func identify(_ userId: String) { LightSessionBridge.identify(userId) }
    @objc public static func reset() { LightSessionBridge.reset() }
    @objc public static func startRecording() { LightSessionBridge.startRecording() }
    @objc public static func stopRecording() { LightSessionBridge.stopRecording() }
    @objc public static var isRecording: Bool { LightSessionBridge.isRecording }

    @objc public static func recordRequest(
        _ method: String,
        url: String,
        statusCode: Int,
        durationMillis: Double,
        requestBytes: Double,
        responseBytes: Double,
        error: String
    ) {
        LightSessionBridge.recordRequest(
            method: method,
            url: url,
            statusCode: statusCode,
            durationMillis: durationMillis,
            requestBytes: requestBytes,
            responseBytes: responseBytes,
            error: error
        )
    }

    /// One JavaScript error. The frames arrive as dictionaries, the shape the codegen gives an array of
    /// objects, and become the SDK's `ErrorFrame` here — the one translation this file does, because the
    /// SDK takes errors typed and has no dictionary reading for them to forward to.
    ///
    /// The thread is `js`: it is where the error was thrown, whatever thread this runs on.
    @objc public static func recordError(
        _ type: String,
        message: String?,
        frames: [[String: Any]],
        handled: Bool,
        mechanism: String,
        attributes: [String: Any]
    ) {
        LightSession.recordError(
            type: type,
            message: message,
            frames: frames.map { frame in
                ErrorFrame(
                    module: frame["module"] as? String ?? "",
                    function: frame["function"] as? String ?? "",
                    file: (frame["file"] as? String).flatMap { $0.isEmpty ? nil : $0 },
                    line: (frame["line"] as? NSNumber)?.intValue,
                    inApp: (frame["inApp"] as? NSNumber)?.boolValue ?? false
                )
            },
            handled: handled,
            mechanism: mechanism,
            thread: "js",
            attributes: attributes
        )
    }
}
