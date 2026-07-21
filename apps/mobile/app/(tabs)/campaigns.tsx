import { Text, View } from "react-native";

export default function CampaignsScreen() {
  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: "#f9f9f7" }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>Campaigns</Text>
      <Text style={{ marginTop: 12, color: "#52514e", lineHeight: 22 }}>
        Read + pause/resume campaigns — M4.
      </Text>
    </View>
  );
}
