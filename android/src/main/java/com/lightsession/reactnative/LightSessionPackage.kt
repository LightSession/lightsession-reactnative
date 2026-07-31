package com.lightsession.reactnative

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Registers the module with React Native, and is found by autolinking.
 *
 * `BaseReactPackage` rather than the older `ReactPackage`: it hands modules over by name and lazily,
 * so the module is constructed when JavaScript first asks for it rather than at every app start. For a
 * recorder that is the difference between costing something on launch and costing nothing.
 */
class LightSessionPackage : BaseReactPackage() {

    override fun getModule(name: String, context: ReactApplicationContext): NativeModule? =
        if (name == LightSessionModule.NAME) LightSessionModule(context) else null

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
        mapOf(
            LightSessionModule.NAME to ReactModuleInfo(
                LightSessionModule.NAME,
                LightSessionModule.NAME,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule
                true,  // isTurboModule
            ),
        )
    }
}
