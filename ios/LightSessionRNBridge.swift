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
/// Nothing is translated here. `LightSessionBridge` in the SDK does the dictionary reading and is tested there;
/// duplicating it would put two readings of one config a rename apart.
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
}
