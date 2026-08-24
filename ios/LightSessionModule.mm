#import "LightSessionModule.h"

#import <LightSessionSpec/LightSessionSpec.h>

// This pod's own Swift, which is the only Swift Objective-C++ can reach here. `LSRNBridge` forwards to the
// SDK; see its comment for why the hop is necessary and what two shorter routes failed.
#import "LightSessionReactNative-Swift.h"

@interface LightSessionModule () <NativeLightSessionSpec>
@end

@implementation LightSessionModule

RCT_EXPORT_MODULE(LightSession)

/// Runs on the main thread, and that is not a preference.
///
/// React Native calls native modules on its own thread. Everything this SDK does reads or writes the view
/// hierarchy — installing the `viewDidAppear` hook, attaching a gesture recognizer, rendering a frame — and
/// UIKit requires the main thread for all of it. The Android half needed the same hop for the same reason,
/// where getting it wrong surfaced as a red screen on launch.
+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (dispatch_queue_t)methodQueue {
    return dispatch_get_main_queue();
}

/// Starts the SDK, from JavaScript, so an app integrating this never edits its `AppDelegate`.
///
/// Two fields are decided here rather than exposed:
///
///  * `screensReportedByHost` is forced on. A React Native app names its own screens by definition, and leaving
///    it as a choice offers a decision with one correct answer — getting it wrong puts a node named after the
///    hosting view controller at the top of every session, permanently.
///  * `reportedScreenKind` is `REACT_NATIVE`. Without it a screen reported through this bridge is recorded as
///    `SWIFTUI`, because that one call has two kinds of caller and cannot tell them apart. The word matches
///    what the Android SDK sends, so one app's two builds land on one node in the graph rather than on two
///    that differ only by platform.
///
/// The name is the codegen's, not a choice: a spec method called `init` becomes `-init:` here. Clang's `init`
/// family rules tolerate it because it takes an argument and returns void, and the generated protocol declares
/// exactly this.
- (void)init:(NSDictionary *)config {
    if (config == nil) {
        NSLog(@"[LightSession] init called with no config; ignored");
        return;
    }
    NSMutableDictionary *settings = [config mutableCopy];
    settings[@"screensReportedByHost"] = @YES;
    settings[@"reportedScreenKind"] = @"REACT_NATIVE";

    [LSRNBridge start:settings verbose:[config[@"verbose"] boolValue]];
}

/// Reports the current screen.
///
/// Safe to call with the screen already showing: the SDK drops a repeat, which is what makes it safe to wire
/// straight to a navigator that re-emits state on every re-render.
- (void)setScreen:(NSString *)name {
    [LSRNBridge setScreen:name];
}

- (void)identify:(NSString *)userId traits:(NSDictionary *)traits {
    // Traits are accepted and not forwarded, because the iOS SDK records who someone is and has nowhere yet to
    // put what else is known about them. Said out loud rather than dropped in silence.
    if (traits.count > 0) {
        NSLog(@"[LightSession] identify traits are not recorded on iOS yet; the user id is");
    }
    [LSRNBridge identify:userId];
}

- (void)reset {
    [LSRNBridge reset];
}

/// One switch across frames, touches and screen changes.
///
/// This used to log that it did nothing, which made the same JavaScript behave differently per platform — the
/// Android half has always implemented it. What is already buffered still goes out: it describes something that
/// happened while recording was on, and the moments just before someone stopped are usually why they did.
- (void)startRecording {
    [LSRNBridge startRecording];
}

- (void)stopRecording {
    [LSRNBridge stopRecording];
}

/// Whether anything is being recorded — not merely whether the SDK was configured, which is a different
/// question and the one this returned at first.
- (NSNumber *)isRecording {
    return @([LSRNBridge isRecording]);
}

/// A part of a screen that is a place of its own: a modal, a tab, a wizard step.
- (void)setSubScreen:(NSString *)name {
    [LSRNBridge setSubScreen:name];
}

- (void)clearSubScreen:(NSString *)name {
    [LSRNBridge clearSubScreen:name];
}

/// One HTTP request the app made, reported from JavaScript.
///
/// The URL crosses whole and the SDK parses it — collapsing the path, dropping the query, applying
/// the sample. A third implementation of those rules in JavaScript would be a third place for them
/// to drift.
///
/// `double` for every number because that is what a JavaScript number is; the SDK rounds. Nothing
/// is validated here beyond the two strings a nil would crash on: the SDK refuses a URL it cannot
/// read and clamps the rest, and duplicating those checks here would be two places to keep
/// agreeing.
- (void)recordRequest:(NSString *)method
                  url:(NSString *)url
           statusCode:(double)statusCode
           durationMs:(double)durationMs
         requestBytes:(double)requestBytes
        responseBytes:(double)responseBytes
                error:(NSString *)error {
    if (method.length == 0 || url.length == 0) {
        return;
    }
    [LSRNBridge recordRequest:method
                          url:url
                   statusCode:(NSInteger)statusCode
               durationMillis:durationMs
                 requestBytes:requestBytes
                responseBytes:responseBytes
                        error:error ?: @""];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeLightSessionSpecJSI>(params);
}

@end
