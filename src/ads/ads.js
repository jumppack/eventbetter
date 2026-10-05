import Constants from "expo-constants";
import { useEffect, useState } from "react";
import mobileAds, { TestIds } from "react-native-google-mobile-ads";

import admob from "../config/admob.json";
import { gatherConsent } from "./consent";

// Ads are isolated on purpose: nothing in src/ads may import calendar, auth or
// account code, and no Google user data (calendar data, titles, email, name)
// is ever passed to the ad SDK. Google's API Services User Data Policy forbids
// it and OAuth verification checks it. ads.isolation.test.js enforces this.

const useRealAds = !__DEV__ && Constants.expoConfig?.extra?.adsProduction === true;

export const BANNER_UNIT_ID = useRealAds ? admob.production.bannerUnitId : TestIds.ADAPTIVE_BANNER;

let started = null;

// Consent first, then the SDK; no ad is requested before both finish.
export function startAds() {
  started ??= (async () => {
    const info = await gatherConsent();
    if (!info?.canRequestAds) return false;
    await mobileAds().initialize();
    return true;
  })().catch((e) => {
    console.warn("Ads failed to start", e);
    return false;
  });
  return started;
}

export function useAdsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    startAds().then((ok) => alive && setReady(ok));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}
