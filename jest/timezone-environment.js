const ReactNativeEnv = require("@react-native/jest-preset/jest/react-native-env");

// Test files see a sandboxed copy of process.env, so TZ has to be set out
// here on the real one. Node re-reads TZ on assignment, and a worker runs one
// test file at a time, so each file gets its project's zone.
module.exports = class TimeZoneEnvironment extends ReactNativeEnv {
  constructor(config, context) {
    super(config, context);
    process.env.TZ = config.projectConfig.globals.__TEST_TZ__;
  }
};
