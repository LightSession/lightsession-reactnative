// Re-export so apps can write `lightsession-react-native/navigation`, the path the README documents.
//
// A file rather than an `exports` map: package exports depend on Metro's
// `unstable_enablePackageExports`, which is not on in every project, and a subpath that resolves only
// under some bundler configurations is worse than one that always resolves.
module.exports = require('./src/navigation');
