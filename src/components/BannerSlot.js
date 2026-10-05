import { StyleSheet, View } from "react-native";

import { Banner } from "../ads/Banner";

// Anchored at the bottom of the list screen; the screen's safe area already
// keeps it clear of the system navigation bar.
export function BannerSlot() {
  return (
    <View style={styles.slot}>
      <Banner />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignItems: "center" },
});
