import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ChevronLeft } from 'lucide-react-native';

const COLORS = {
  bg: '#000',
  white: '#FFFFFF',
  subtitle: 'rgba(255,255,255,0.8)',
};

export default function AddProductScanScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = useCallback(
    ({ type, data }) => {
      if (scanned) return;
      setScanned(true);
      Alert.alert(
        'Code scanné',
        `Type: ${type}\nDonnées: ${data}\n\nRemplir le formulaire avec ce code ?`,
        [
          { text: 'Annuler', onPress: () => setScanned(false) },
          {
            text: 'OK',
            onPress: () =>
              navigation.navigate('AddProductManual', {
                prefilled: { barcode: String(data) },
              }),
          },
        ]
      );
    },
    [scanned, navigation]
  );

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Chargement des permissions…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.white} />
          </Pressable>
          <Text style={styles.headerTitle}>Scanner le code</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.text}>
            L'accès à la caméra est nécessaire pour scanner les codes-barres.
          </Text>
          <Pressable style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Autoriser la caméra</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Scanner le code-barres / QR</Text>
      </View>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: [
            'qr',
            'ean13',
            'ean8',
            'code128',
            'code39',
            'upc_a',
            'upc_e',
          ],
        }}
      />
      <View style={styles.footer}>
        <Text style={styles.hint}>
          Visez le code-barres ou le QR code sur la boîte
        </Text>
        {scanned && (
          <Pressable
            style={styles.rescanBtn}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.rescanBtnText}>Scanner à nouveau</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  camera: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  text: { color: COLORS.subtitle, textAlign: 'center', marginBottom: 16 },
  permBtn: {
    backgroundColor: '#1976D2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  permBtnText: { color: '#FFF', fontWeight: '600' },
  footer: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
  },
  hint: { color: COLORS.subtitle, fontSize: 14 },
  rescanBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#1976D2',
    borderRadius: 10,
  },
  rescanBtnText: { color: '#FFF', fontWeight: '600' },
});
