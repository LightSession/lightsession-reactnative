require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# The iOS half of the package, and the mirror of `android/build.gradle`.
#
# The one line that matters is the dependency: this pod does not contain the SDK, it depends on it — exactly as
# the Android half depends on `com.lightsession:lightsession-android` from a Maven repository rather than
# vendoring a copy. A second copy of an SDK is a second thing to keep in step, and it never is.
#
# `LightSession` is not on a public spec repo yet, so an app takes it by path or by git until it is. The example
# app's Podfile shows the path form; there is nothing clever about it and nothing hidden.
Pod::Spec.new do |s|
  s.name         = "lightsession-react-native"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/lightsession/lightsession-react-native"
  s.license      = { :type => "Apache-2.0", :file => "LICENSE" }
  s.author       = "LightSession"
  s.platforms    = { :ios => "15.0" }
  s.source       = { :git => "https://github.com/lightsession/lightsession-react-native.git", :tag => "#{s.version}" }

  # Named explicitly, because the pod's name has hyphens and the module name derived from it would not: the
  # Objective-C++ file imports "LightSessionReactNative-Swift.h" and that name has to be predictable.
  s.module_name  = "LightSessionReactNative"
  s.source_files = "ios/**/*.{h,m,mm,swift}"

  # Brings in React itself and, under the new architecture, the generated spec this module conforms to.
  install_modules_dependencies(s)

  # `~> 0.3.0`, com o patch escrito, e a diferenca nao e estilistica: no CocoaPods `~> 0.3`
  # significa `>= 0.3, < 1.0` e aceitaria qualquer minor futura, enquanto `~> 0.3.0` significa
  # `>= 0.3.0, < 0.4.0`.
  #
  # Esta ponte chama `LightSessionBridge.recordRequest`, que nasceu na 0.3.0. A faixa anterior
  # (`~> 0.2`) permitia resolver a 0.2.5, onde esse simbolo nao existe — o app compilaria a ponte
  # contra um SDK sem ela e falharia no link, com um erro que nao menciona versao nenhuma.
  s.dependency "LightSession", "~> 0.3.0"
end
