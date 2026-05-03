import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "uninavigator_jwt";

export async function setToken(token: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (token == null) await AsyncStorage.removeItem(TOKEN_KEY);
    else await AsyncStorage.setItem(TOKEN_KEY, token);
    return;
  }
  if (token == null) {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") return AsyncStorage.getItem(TOKEN_KEY);
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return AsyncStorage.getItem(TOKEN_KEY);
  }
}
