#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

NS_ASSUME_NONNULL_BEGIN

/// The iOS half of the bridge.
///
/// Thin for the same reason the Android half is: almost nothing needs to cross. The iOS SDK reads UIKit
/// directly and React Native renders to UIKit views, so the wireframe, the masking, the touch heatmap and the
/// replay frames all work with no JavaScript involved.
///
/// What the platform cannot know is which screen you are on. A React Native app is one view controller hosting
/// everything, so `viewDidAppear` fires once for the whole app and never again. That single fact is why this
/// exists; the other methods are here because only the app knows *when* to call them.
///
/// Conformance to the generated `NativeLightSessionSpec` is declared in the implementation rather than here, on
/// purpose: the generated header is Objective-C++ only and refuses to be compiled any other way. Importing it
/// from this header would spread that constraint to anything that includes it.
@interface LightSessionModule : NSObject <RCTBridgeModule>
@end

NS_ASSUME_NONNULL_END
