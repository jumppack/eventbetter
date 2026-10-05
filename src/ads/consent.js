import { AdsConsent, AdsConsentPrivacyOptionsRequirementStatus } from "react-native-google-mobile-ads";

// Google's UMP consent flow. Shows the consent form when the user's region
// requires it (EEA/UK, US states) and the AdMob privacy message is published;
// otherwise it resolves straight away. Never throws: on failure ads simply
// stay off.
export async function gatherConsent() {
  try {
    return await AdsConsent.gatherConsent();
  } catch (e) {
    console.warn("Ad consent failed", e);
    return AdsConsent.getConsentInfo().catch(() => null);
  }
}

export async function privacyOptionsRequired() {
  try {
    const info = await AdsConsent.getConsentInfo();
    return info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  } catch {
    return false;
  }
}

// "Manage ad privacy choices" in Settings.
export function showPrivacyOptions() {
  return AdsConsent.showPrivacyOptionsForm();
}
