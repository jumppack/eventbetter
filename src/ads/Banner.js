import { useState } from "react";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";

import { BANNER_UNIT_ID, useAdsReady } from "./ads";

// Takes no props on purpose: nothing about the user or their events
// reaches the ad request, so there are no keywords or content URLs either.
// Renders nothing until consent allows ads, or if no ad loads.
export function Banner() {
  const ready = useAdsReady();
  const [failed, setFailed] = useState(false);
  if (!ready || failed || !BANNER_UNIT_ID) return null;

  return (
    <BannerAd
      unitId={BANNER_UNIT_ID}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      onAdFailedToLoad={() => setFailed(true)}
    />
  );
}
