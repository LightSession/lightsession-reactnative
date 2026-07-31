const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration for an example app that consumes the library beside it.
 *
 * The library is a `file:..` dependency, so `node_modules/lightsession-react-native` is a symlink
 * pointing *outside* this project. Metro watches only its own root, so without `watchFolders` the
 * import fails with "could not be found within the project" — which reads like a missing package
 * rather than a resolver that was never told where to look.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const libraryRoot = path.resolve(__dirname, '..');

const appModules = path.resolve(__dirname, 'node_modules');

const config = {
  watchFolders: [libraryRoot],
  resolver: {
    // Where to look when resolving an import made *from inside the library*. The library has no
    // `node_modules` of its own — it should not; `react` and `react-native` are peer dependencies, and
    // a second copy of either is the classic way to get two Reacts and a hook that throws about
    // invalid state. So its imports resolve against the app's tree, which is the one that must be
    // single.
    nodeModulesPaths: [appModules],

    // Mapped explicitly rather than left to symlink following, which Metro has done inconsistently
    // across versions — and when it fails, it fails at bundle time, long after the build looked fine.
    extraNodeModules: {
      'lightsession-react-native': libraryRoot,
      react: path.resolve(appModules, 'react'),
      'react-native': path.resolve(appModules, 'react-native'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
