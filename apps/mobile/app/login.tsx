import { Text, View } from "react-native";

export default function LoginScreen() {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#f9f9f7" }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>Sign in</Text>
      <Text style={{ marginTop: 12, color: "#52514e" }}>
        Auth via Supabase lands with M4. Use the web app for demo login today.
      </Text>
    </View>
  );
}
