import { Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { startAds } from "../ads/ads";
import { Background } from "../components/Glass";
import { SessionProvider, useSession } from "../components/SessionProvider";
import { SubscriptionsProvider } from "../components/SubscriptionsProvider";
import { useTheme } from "../components/theme";

function RootStack() {
  const { status } = useSession();
  const theme = useTheme();

  // Themed, so there's no white flash between the splash screen and the
  // first real screen.
  if (status === "loading") {
    return (
      <Background>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.buttonFrom} size="large" />
        </View>
      </Background>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg[0] } }}>
      <Stack.Protected guard={status === "ready"}>
        <Stack.Screen name="index" />
        <Stack.Screen name="add" />
        <Stack.Screen name="edit/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="licenses" />
      </Stack.Protected>
      <Stack.Protected guard={status === "needsCalendar"}>
        <Stack.Screen name="calendar-access" />
      </Stack.Protected>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // Consent (and the form, where the law requires it) runs once at launch,
  // before any ad is requested.
  useEffect(() => {
    startAds();
  }, []);

  return (
    <SessionProvider>
      <SubscriptionsProvider>
        <RootStack />
      </SubscriptionsProvider>
    </SessionProvider>
  );
}
