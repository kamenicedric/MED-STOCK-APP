import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Building2, User, MapPin, Phone, Camera, LogOut } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

const COLORS = {
  bg: '#F5F5F5',
  white: '#FFFFFF',
  title: '#212121',
  subtitle: '#757575',
  primary: '#1976D2',
  button: '#F05A28',
  border: '#EEEEEE',
  inputBg: '#FAFAFA',
};

const AVATAR_BUCKET = 'avatars';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const [pharmacyName, setPharmacyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [location, setLocation] = useState('');
  const [notificationPhone, setNotificationPhone] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [avatarBase64, setAvatarBase64] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('pharmacy_name, owner_name, location, notification_phone, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (data) {
        setPharmacyName(data.pharmacy_name ?? '');
        setOwnerName(data.owner_name ?? '');
        setLocation(data.location ?? '');
        setNotificationPhone(data.notification_phone ?? '');
        setAvatarUrl(data.avatar_url ?? null);
      }
    } catch (e) {
      console.warn('EditProfile load:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès aux photos pour choisir une image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
      setAvatarBase64(result.assets[0].base64 ?? null);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez la caméra pour prendre une photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
      setAvatarBase64(result.assets[0].base64 ?? null);
    }
  };

  const showImageOptions = () => {
    Alert.alert('Photo de profil', 'Choisir une option', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Prendre une photo', onPress: takePhoto },
      { text: 'Choisir depuis la galerie', onPress: pickImage },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  const handleSave = async () => {
    if (!pharmacyName?.trim()) {
      Alert.alert('Champ requis', 'Le nom de la pharmacie est obligatoire.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        Alert.alert('Session expirée', 'Veuillez vous reconnecter.');
        setSaving(false);
        return;
      }

      let finalAvatarUrl = avatarUrl || null;

      if (avatarUri) {
        try {
          const contentType = avatarUri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
          const ext = contentType === 'image/png' ? 'png' : 'jpg';
          const path = `${user.id}/avatar.${ext}`;
          const base64 = avatarBase64;
          if (!base64) {
            console.warn('Avatar base64 missing (base64 not provided by picker).');
          } else {
            const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: contentType });

          const { error: uploadError } = await supabase.storage
            .from(AVATAR_BUCKET)
            .upload(path, blob, { upsert: true, contentType });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
            finalAvatarUrl = (urlData?.publicUrl ?? '') + '?t=' + Date.now();
          } else {
            console.warn('Upload avatar:', uploadError);
          }
          }
        } catch (uploadErr) {
          console.warn('Upload photo:', uploadErr);
        }
      }

      const payload = {
        id: user.id,
        pharmacy_name: pharmacyName.trim(),
        owner_name: ownerName.trim() || null,
        location: location.trim() || null,
        notification_phone: notificationPhone.trim() || null,
        avatar_url: finalAvatarUrl,
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' })
        .select('id')
        .single();

      if (error) {
        Alert.alert('Erreur d\'enregistrement', error.message);
        setSaving(false);
        return;
      }
      Alert.alert('Profil enregistré', 'Vos modifications ont été enregistrées.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Erreur', err?.message ?? 'Une erreur est survenue.');
    } finally {
      setSaving(false);
    }
  };

  const displayUri = avatarUri || (avatarUrl ? (avatarUrl.startsWith('http') ? avatarUrl : undefined) : undefined);
  const showInitials = !displayUri;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.title} />
          </Pressable>
          <Text style={styles.headerTitle}>Modifier mon profil</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable style={styles.avatarWrap} onPress={showImageOptions}>
            {displayUri ? (
              <Image
                key={displayUri}
                source={{ uri: displayUri }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {(ownerName || pharmacyName || 'P').slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Camera size={18} color="#FFF" />
            </View>
          </Pressable>
          <Text style={styles.avatarHint}>Appuyez pour changer la photo</Text>

          <Text style={styles.label}>Nom de la pharmacie *</Text>
          <View style={styles.inputRow}>
            <Building2 size={18} color={COLORS.subtitle} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="ex: Pharmacie Santé"
              placeholderTextColor={COLORS.subtitle}
              value={pharmacyName}
              onChangeText={setPharmacyName}
            />
          </View>

          <Text style={styles.label}>Nom du responsable</Text>
          <View style={styles.inputRow}>
            <User size={18} color={COLORS.subtitle} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="ex: Jean Dupont"
              placeholderTextColor={COLORS.subtitle}
              value={ownerName}
              onChangeText={setOwnerName}
            />
          </View>

          <Text style={styles.label}>Ville / Adresse</Text>
          <View style={styles.inputRow}>
            <MapPin size={18} color={COLORS.subtitle} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="ex: Dakar"
              placeholderTextColor={COLORS.subtitle}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <Text style={styles.label}>Téléphone (notifications WhatsApp)</Text>
          <View style={styles.inputRow}>
            <Phone size={18} color={COLORS.subtitle} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="ex: 659823902"
              placeholderTextColor={COLORS.subtitle}
              value={notificationPhone}
              onChangeText={setNotificationPhone}
              keyboardType="phone-pad"
            />
          </View>

          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Text>
          </Pressable>

          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={20} color={COLORS.white} style={styles.logoutIcon} />
            <Text style={styles.logoutBtnText}>Se déconnecter</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.title },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 24 },
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: 8,
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 50 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#BBDEFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: { fontSize: 28, fontWeight: '700', color: COLORS.primary },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: { fontSize: 12, color: COLORS.subtitle, textAlign: 'center', marginBottom: 24 },
  label: { fontSize: 12, color: COLORS.subtitle, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    marginBottom: 14,
    minHeight: 48,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: COLORS.title, paddingVertical: 10 },
  saveBtn: {
    backgroundColor: COLORS.button,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#757575',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 24,
  },
  logoutIcon: { marginRight: 8 },
  logoutBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
