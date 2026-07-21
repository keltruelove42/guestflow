import { Text, View } from "react-native";

export default function MoreScreen() {
  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: "#f9f9f7" }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>More</Text>
      <Text style={{ marginTop: 12, color: "#52514e", lineHeight: 22 }}>
        Properties, integrations status, settings, and sign out — M4/M5.
      </Text>
    </View>
  );
}
