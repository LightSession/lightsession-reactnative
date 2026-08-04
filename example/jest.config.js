module.exports = {
  preset: '@react-native/jest-preset',
  // The preset transforms react-native itself and leaves the rest of node_modules alone, which was
  // right until React Navigation shipped untranspiled ESM: the `import` at the top of
  // @react-navigation/native/lib/module/index.js is a syntax error to Jest's CJS loader, and the
  // template's render test has never actually run in this example. These are the packages that need
  // Babel and now get it — everything else stays ignored.
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-screens|react-native-safe-area-context)/)',
  ],
  // The library is linked with `file:..`, so its sources live outside this directory and its imports
  // of react/react-native find no node_modules walking up from there. Metro solves this in
  // metro.config.js; this is Jest's version of the same answer — fall back to the example's own
  // node_modules.
  moduleDirectories: ['node_modules', '<rootDir>/node_modules'],
};
