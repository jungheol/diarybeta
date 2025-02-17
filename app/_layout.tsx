import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex:1 }}>
      <Stack screenOptions={{ headerShown: false }}> 
      {/* 🔥 모든 화면에서 헤더 숨기기 */}
      </Stack>
    </GestureHandlerRootView>
  );
}
