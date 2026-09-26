require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# The iOS half of the package, and the mirror of `android/build.gradle`.
#
# The one line that matters is the dependency: this pod does not contain the SDK, it depends on it — exactly as
# the Android half depends on `io.lightsession:lightsession-android` from Maven Central rather than vendoring a
# copy. A second copy of an SDK is a second thing to keep in step, and it never is. `LightSession` comes from
# CocoaPods trunk, so an app adds nothing to its Podfile for it.
Pod::Spec.new do |s|
  s.name         = "lightsession-react-native"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/LightSession/lightsession-reactnative"
  s.license      = { :type => "Apache-2.0", :file => "LICENSE" }
  s.author       = "LightSession"
  s.platforms    = { :ios => "15.0" }
  s.source       = { :git => "https://github.com/LightSession/lightsession-reactnative.git", :tag => "#{s.version}" }

  # Named explicitly, because the pod's name has hyphens and the module name derived from it would not: the
  # Objective-C++ file imports "LightSessionReactNative-Swift.h" and that name has to be predictable.
  s.module_name  = "LightSessionReactNative"
  s.source_files = "ios/**/*.{h,m,mm,swift}"

  # Brings in React itself and, under the new architecture, the generated spec this module conforms to.
  install_modules_dependencies(s)

  # `~> 0.8.2`, com o patch escrito, e a diferenca nao e estilistica: no CocoaPods `~> 0.8`
  # significa `>= 0.8, < 1.0` e aceitaria qualquer minor futura, enquanto `~> 0.8.2` significa
  # `>= 0.8.2, < 0.9.0`.
  #
  # O minimo nao vem da ponte, que so precisa do que existe desde a 0.3.0, e sim do que o SDK passou
  # a fazer certo depois dela e que um app React Native deixava de receber enquanto isto ficou em
  # `~> 0.3.0`: a sessao termina quando o app vai para o background (0.4.0), e uma parte de uma tela
  # declarada com `setSubScreen` sai com o tipo da tela a que pertence (0.6.0) — medido no exemplo, o
  # painel e o Modal da tela Popups saiam como UIKIT. E, na 0.8.2, um crash de JavaScript conta uma
  # vez so, em vez de chegar de novo como o `RCTFatalException` com que o React Native encerra o app,
  # e a ponte le `captureErrors`, que antes descartava.
  s.dependency "LightSession", "~> 0.8.2"
end
