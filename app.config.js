// Extends app.json. AdMob IDs are public (they ship inside the app), but real
// ones must only be used in production builds; every other build, including
// development and preview, uses Google's test app so test traffic never
// reaches the real account.
const admob = require("./src/config/admob.json");

const production = process.env.EAS_BUILD_PROFILE === "production";

module.exports = ({ config }) => {
  const androidAppId = production ? admob.production.androidAppId : admob.test.androidAppId;
  if (production && !admob.production.androidAppId) {
    throw new Error("Set production.androidAppId in src/config/admob.json before a production build.");
  }

  return {
    ...config,
    plugins: [
      ...config.plugins,
      // Measurement waits until the consent flow has run.
      ["react-native-google-mobile-ads", { androidAppId, delayAppMeasurementInit: true }],
    ],
    extra: { ...config.extra, adsProduction: production },
  };
};
