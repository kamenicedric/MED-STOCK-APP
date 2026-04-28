import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Camera, ScanText } from 'lucide-react-native';

const COLORS = {
  bg: '#F5F5F5',
  white: '#FFFFFF',
  title: '#212121',
  subtitle: '#757575',
  primary: '#1976D2',
  button: '#F05A28',
  border: '#EEEEEE',
};

export default function AddProductOCRScreen() {
  const navigation = useNavigation();
  const [imageUri, setImageUri] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'L\'accès à la caméra est nécessaire pour photographier le médicament.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setExtractedText('');
    }
  };

  const extractText = async () => {
    if (!imageUri) return;
    setLoading(true);
    setExtractedText('');
    try {
      const apiUrl = process.env.EXPO_PUBLIC_OCR_API_URL;
      if (apiUrl) {
        const formData = new FormData();
        formData.append('image', {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'photo.jpg',
        });
        const res = await fetch(apiUrl, {
          method: 'POST',
          body: formData,
          headers: { Accept: 'application/json' },
        });
        const data = await res.json();
        const text = data?.text ?? data?.result ?? '';
        setExtractedText(text.trim() || 'Saisissez le nom du produit dans le champ ci‑dessous.');
      } else {
        setExtractedText(
          'Saisissez le nom du médicament dans le champ ci‑dessous (ex. : Paracétamol 500 mg).',
        );
      }
    } catch (err) {
      setExtractedText(
        'Saisissez le nom du médicament dans le champ ci‑dessous.',
      );
    } finally {
      setLoading(false);
    }
  };

  const goToManual = () => {
    const name = extractedText.trim();
    if (!name) {
      Alert.alert(
        'Saisie requise',
        'Saisissez le nom du produit (ou une partie du texte détecté) avant de continuer.',
      );
      return;
    }
    navigation.navigate('AddProductManual', {
      prefilled: { name },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.title} />
        </Pressable>
        <Text style={styles.headerTitle}>Détection de texte (IA)</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!imageUri ? (
          <Pressable style={styles.captureCard} onPress={takePhoto}>
            <Camera size={48} color={COLORS.primary} />
            <Text style={styles.captureTitle}>Prendre une photo</Text>
            <Text style={styles.captureDesc}>
              Photographiez la boîte ou l\'étiquette du médicament pour extraire le nom et les infos
            </Text>
          </Pressable>
        ) : (
          <>
            <View style={styles.imageWrap}>
              <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
            </View>
            <Pressable style={styles.retakeBtn} onPress={takePhoto}>
              <Text style={styles.retakeBtnText}>Reprendre une photo</Text>
            </Pressable>

            <View style={styles.extractSection}>
              <Pressable
                style={[styles.extractBtn, loading && styles.extractBtnDisabled]}
                onPress={extractText}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <View style={styles.extractBtnInner}>
                    <ScanText size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.extractBtnText}>Extraire le texte (IA)</Text>
                  </View>
                )}
              </Pressable>

              <Text style={styles.label}>Texte détecté / Nom du produit</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Le texte extrait apparaîtra ici, ou saisissez le nom du médicament"
                placeholderTextColor={COLORS.subtitle}
                value={extractedText}
                onChangeText={setExtractedText}
                multiline
                numberOfLines={4}
              />

              <Pressable
                style={[styles.useBtn, (!extractedText.trim() && styles.useBtnDisabled)]}
                onPress={goToManual}
                disabled={!extractedText.trim()}
              >
                <Text style={styles.useBtnText}>Créer le produit avec ce texte</Text>
              </Pressable>
            </View>
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.title },
  scrollContent: { padding: 20 },
  captureCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  captureTitle: { fontSize: 18, fontWeight: '700', color: COLORS.title, marginTop: 16 },
  captureDesc: {
    fontSize: 14,
    color: COLORS.subtitle,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  imageWrap: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    minHeight: 200,
  },
  image: { width: '100%', height: 240 },
  retakeBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  retakeBtnText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  extractSection: { marginTop: 8 },
  extractBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  extractBtnDisabled: { opacity: 0.7 },
  extractBtnInner: { flexDirection: 'row', alignItems: 'center' },
  extractBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  label: { fontSize: 12, color: COLORS.subtitle, marginBottom: 6 },
  textArea: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    fontSize: 15,
    color: COLORS.title,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  useBtn: {
    backgroundColor: COLORS.button,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  useBtnDisabled: { opacity: 0.5 },
  useBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
