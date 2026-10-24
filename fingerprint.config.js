// What counts towards the EAS Update runtime fingerprint. An update only reaches
// builds whose fingerprint matches, so anything listed here that changes after a
// store build silently strands later over-the-air updates.
//
// package.json scripts and eas.json (excluded via .fingerprintignore) are build
// and release tooling, not native code, but both used to shift the runtime:
// adding a submit profile and an npm script each did, in October 2026.
/** @type {import('expo/fingerprint').Config} */
const config = {
  sourceSkips: [
    'PackageJsonAndroidAndIosScriptsIfNotContainRun', // the default
    'PackageJsonScriptsAll',
  ],
};
module.exports = config;
