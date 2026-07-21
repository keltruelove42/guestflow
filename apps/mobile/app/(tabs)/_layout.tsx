import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#fcfcfb" },
        headerTitleStyle: { fontWeight: "600" },
        tabBarActiveTintColor: "#2a78d6",
        tabBarStyle: { backgroundColor: "#fcfcfb" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarLabel: "Home" }} />
      <Tabs.Screen name="leads" options={{ title: "Leads", tabBarLabel: "Leads" }} />
      <Tabs.Screen name="campaigns" options={{ title: "Campaigns", tabBarLabel: "Campaigns" }} />
      <Tabs.Screen name="sequences" options={{ title: "Follow-ups", tabBarLabel: "Follow-ups" }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarLabel: "More" }} />
    </Tabs>
  );
}
