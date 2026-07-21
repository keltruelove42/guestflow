import { Text, View } from "react-native";

function Placeholder({ title, blurb }: { title: string; blurb: string }) {
  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: "#f9f9f7" }}>
      <Text style={{ fontSize: 22, fontWeight: "600", color: "#0b0b0b" }}>{title}</Text>
      <Text style={{ marginTop: 12, fontSize: 15, lineHeight: 22, color: "#52514e" }}>
        {blurb}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  return (
    <Placeholder
      title="Home"
      blurb="KPIs, needs-attention, and activity feed land in M4. Web app is the primary surface for M0–M3."
    />
  );
}
