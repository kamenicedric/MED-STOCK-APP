import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Building2, MapPin, Phone, Mail, Lock, ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import logo from '../../assets/android-chrome-512x512.png';

const COLORS = {
  background: '#E8F4FC',
  card: '#FFFFFF',
  title: '#0D47A1',
  subtitle: '#546E7A',
  label: '#607D8B',
  inputBorder: '#B0BEC5',
  inputBg: '#F5F5F5',
  button: '#F05A28',
  buttonDisabled: '#FFAB91',
  link: '#1565C0',
  placeholder: '#9E9E9E',
};

export default function RegisterScreen() {
  const navigation = useNavigation();
  const [pharmacyName, setPharmacyName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!pharmacyName?.trim()) {
      Alert.alert('Champ manquant', 'Veuillez saisir le nom de votre pharmacie.');
      return;
    }
    if (!city?.trim()) {
      Alert.alert('Champ manquant', 'Veuillez saisir la ville.');
      return;
    }
    if (!email?.trim()) {
      Alert.alert('Champ manquant', 'Veuillez saisir votre email.');
      return;
    }
    if (!password) {
      Alert.alert('Champ manquant', 'Veuillez saisir un mot de passe.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Mot de passe faible', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les deux mots de passe ne correspondent pas.');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            nom_pharmacie: pharmacyName.trim(),
            ville: city.trim(),
            telephone: phone.trim() || undefined,
          },
        },
      });

      if (error) {
        Alert.alert('Erreur d\'inscription', error.message);
        return;
      }

      if (data?.user && !data.user.identities?.length) {
        Alert.alert(
          'Compte existant',
          'Un compte existe déjà avec cet email. Connectez-vous ou réinitialisez le mot de passe.',
        );
        return;
      }

      Alert.alert(
        'Inscription envoyée',
        'Vérifiez votre boîte mail pour confirmer votre compte, puis connectez-vous.',
        [{ text: 'OK', onPress: () => navigation.replace('Login') }],
      );
    } catch (err) {
      Alert.alert('Erreur inattendue', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={COLORS.title} />
        </Pressable>

        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Image source={logo} style={styles.logoImage} />
          </View>
          {/* <Text style={styles.appName}>MED-STOCK</Text> */}
          <Text style={styles.tagline}>Inscrivez votre pharmacie</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Créer un compte</Text>

          <Text style={styles.label}>Nom de la pharmacie</Text>
          <View style={styles.inputRow}>
            <Building2 size={18} color={COLORS.label} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="ex: Pharmacie Santé"
              placeholderTextColor={COLORS.placeholder}
              value={pharmacyName}
              onChangeText={setPharmacyName}
              autoCapitalize="words"
            />
          </View>

          <Text style={styles.label}>Ville</Text>
          <View style={styles.inputRow}>
            <MapPin size={18} color={COLORS.label} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="ex: Dakar"
              placeholderTextColor={COLORS.placeholder}
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
            />
          </View>

          <Text style={styles.label}>Téléphone</Text>
          <View style={styles.inputRow}>
            <Phone size={18} color={COLORS.label} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="ex: 6 59 82 39 02"
              placeholderTextColor={COLORS.placeholder}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <Text style={styles.label}>Email du pharmacien</Text>
          <View style={styles.inputRow}>
            <Mail size={18} color={COLORS.label} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="ex: moussa@sante.com"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.inputRow}>
            <Lock size={18} color={COLORS.label} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Minimum 6 caractères"
              placeholderTextColor={COLORS.placeholder}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={styles.eyeButton}
              hitSlop={12}
            >
              {showPassword ? (
                <EyeOff size={20} color={COLORS.label} />
              ) : (
                <Eye size={20} color={COLORS.label} />
              )}
            </Pressable>
          </View>

          <Text style={styles.label}>Confirmer le mot de passe</Text>
          <View style={styles.inputRow}>
            <Lock size={18} color={COLORS.label} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Répétez le mot de passe"
              placeholderTextColor={COLORS.placeholder}
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <Pressable
              onPress={() => setShowConfirmPassword((v) => !v)}
              style={styles.eyeButton}
              hitSlop={12}
            >
              {showConfirmPassword ? (
                <EyeOff size={20} color={COLORS.label} />
              ) : (
                <Eye size={20} color={COLORS.label} />
              )}
            </Pressable>
          </View>

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            style={[styles.button, loading && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Création en cours...' : 'CRÉER MON COMPTE'}
            </Text>
            <Text style={styles.buttonArrow}>→</Text>
          </Pressable>

          <View style={styles.signinRow}>
            <Text style={styles.signinLabel}>Déjà un compte ? </Text>
            <Pressable onPress={() => navigation.replace('Login')}>
              <Text style={styles.signinLink}>Se connecter</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.footer}>Propulsé par Supabase</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 16,
    zIndex: 10,
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#BBDEFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 32,
    color: COLORS.title,
    fontWeight: '700',
  },
  logoImage: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.title,
  },
  tagline: {
    fontSize: 13,
    color: COLORS.subtitle,
    marginTop: 4,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 18,
    textAlign: 'center',
  },
  label: {
    fontSize: 12,
    color: COLORS.label,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    paddingHorizontal: 12,
    marginBottom: 14,
    minHeight: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#212121',
    paddingVertical: 10,
  },
  eyeButton: {
    padding: 6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.button,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: COLORS.buttonDisabled,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  buttonArrow: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 8,
    fontWeight: '700',
  },
  signinRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
  },
  signinLabel: {
    fontSize: 12,
    color: COLORS.subtitle,
  },
  signinLink: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.link,
    textDecorationLine: 'underline',
  },
  footer: {
    fontSize: 10,
    color: '#90A4AE',
    marginTop: 24,
  },
});
