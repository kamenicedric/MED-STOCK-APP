import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { Home, Package, BarChart2 } from 'lucide-react-native';
import { supabase } from './src/lib/supabase';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import StockScreen from './src/screens/StockScreen';
import QuickSaleScreen from './src/screens/QuickSaleScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import AddProductChoiceScreen from './src/screens/AddProductChoiceScreen';
import AddProductManualScreen from './src/screens/AddProductManualScreen';
import AddProductScanScreen from './src/screens/AddProductScanScreen';
import AddProductOCRScreen from './src/screens/AddProductOCRScreen';
import ReportsDetailScreen from './src/screens/ReportsDetailScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';

const styles = StyleSheet.create({
  app: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
});

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1976D2',
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#EEEEEE',
        },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tab.Screen
        name="Accueil"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Home size={size ?? 24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Stock"
        component={StockScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Package size={size ?? 24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Rapports"
        component={ReportsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <BarChart2 size={size ?? 24} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session ?? null);
      setInitializing(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (initializing) {
    return (
      <SafeAreaProvider style={styles.app}>
        <SafeAreaView style={styles.app} edges={['top', 'left', 'right']}>
          <ActivityIndicator size="large" color="#1976D2" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="QuickSale" component={QuickSaleScreen} />
            <Stack.Screen name="AddProductChoice" component={AddProductChoiceScreen} />
            <Stack.Screen name="AddProductManual" component={AddProductManualScreen} />
            <Stack.Screen name="AddProductScan" component={AddProductScanScreen} />
            <Stack.Screen name="AddProductOCR" component={AddProductOCRScreen} />
            <Stack.Screen name="ReportsDetail" component={ReportsDetailScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

