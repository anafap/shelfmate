const { withAppBuildGradle, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withLocalReleaseSigning(config) {
  config = withAndroidManifest(config, mod => {
    if (process.env.SHELFMATE_ALLOW_LOCAL_HTTP === '1') {
      mod.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    }
    return mod;
  });
  return withAppBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') throw new Error('ShelfMate signing expects the Expo Groovy Android template.');
    const marker = '// ShelfMate local release signing';
    const end = '// End ShelfMate local release signing';
    const startAt = mod.modResults.contents.indexOf(marker);
    if (startAt >= 0) {
      const endAt = mod.modResults.contents.indexOf(end, startAt);
      mod.modResults.contents = mod.modResults.contents.slice(0, startAt) + (endAt >= 0 ? mod.modResults.contents.slice(endAt + end.length) : '');
    }
    mod.modResults.contents += `
${marker}
def shelfmateSigningPath = System.getenv("SHELFMATE_SIGNING_PROPERTIES")
if (shelfmateSigningPath) {
    def shelfmateSigning = new Properties()
    file(shelfmateSigningPath).withInputStream { shelfmateSigning.load(it) }
    android.signingConfigs.create("shelfmateLocal") {
        storeFile file(shelfmateSigning.getProperty("storeFile"))
        storePassword shelfmateSigning.getProperty("storePassword")
        keyAlias shelfmateSigning.getProperty("keyAlias")
        keyPassword shelfmateSigning.getProperty("keyPassword")
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.shelfmateLocal
} else if (System.getenv("EAS_BUILD") != "true") {
    tasks.matching { it.name == "assembleRelease" || it.name == "bundleRelease" }.configureEach {
        doFirst { throw new GradleException("Set SHELFMATE_SIGNING_PROPERTIES to the ignored local signing properties file.") }
    }
}
// End ShelfMate local release signing
`;
    return mod;
  });
};
