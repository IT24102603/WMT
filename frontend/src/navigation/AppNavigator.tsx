import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { GpaScreen } from "../screens/GpaScreen";
import { TasksScreen } from "../screens/TasksScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#5b8def",
    background: "#121826",
    card: "#1a2233",
    text: "#e8edf5",
    border: "#2a3548",
  },
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#1a2233" },
        headerTintColor: "#e8edf5",
        tabBarStyle: { backgroundColor: "#1a2233", borderTopColor: "#2a3548" },
        tabBarActiveTintColor: "#5b8def",
        tabBarInactiveTintColor: "#8b9cb8",
      }}
    >
      <Tabs.Screen name="Dashboard" component={DashboardScreen} />
      <Tabs.Screen name="GPA" component={GpaScreen} />
      <Tabs.Screen name="Tasks" component={TasksScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: "#121826", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#5b8def" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#1a2233" }, headerTintColor: "#e8edf5" }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: "UniNavigator" }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Create account" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
