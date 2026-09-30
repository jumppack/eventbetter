import { requireNativeModule } from "expo-modules-core";

// Android only. See GoogleAuthModule.kt for the native side.
export default requireNativeModule("GoogleAuth");
