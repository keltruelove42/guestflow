import { Text, View } from "react-native";

export default function SequencesScreen() {
  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: "#f9f9f7" }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>Follow-ups</Text>
      <Text style={{ marginTop: 12, color: "#52514e", lineHeight: 22 }}>
        Sequence cards + activate/pause — M4.
      </Text>
    </View>
  );
}
