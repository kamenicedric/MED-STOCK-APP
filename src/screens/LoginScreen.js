import { useState } from 'react';
import {
  Alert,
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
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

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

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Champs manquants', 'Veuillez renseigner votre email et votre mot de passe.');
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert('Erreur de connexion', error.message);
    } catch (err) {
      Alert.alert('Erreur inattendue', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const mail = email.trim();
    if (!mail) {
      Alert.alert('Email requis', 'Saisissez votre email, puis appuyez sur « Mot de passe oublié ? »');
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(mail);
      if (error) {
        Alert.alert('Erreur', error.message);
        return;
      }
      Alert.alert(
        'Email envoyé',
        'Si un compte existe avec cet email, vous allez recevoir un lien pour réinitialiser votre mot de passe.',
      );
    } catch (err) {
      Alert.alert('Erreur', err.message ?? 'Impossible d’envoyer l’email.');
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
        {/* Logo + branding */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>✚</Text>
          </View>
          <Text style={styles.appName}>MED-STOCK</Text>
          <Text style={styles.tagline}>Gestion de Stock Pharmacie Simplifiée</Text>
        </View>

        {/* Carte blanche formulaire */}
        <View style={styles.card}>
          <View style={styles.avatarPlaceholder} />
          <Text style={styles.cardTitle}>Profil Pharmacien</Text>

          <Text style={styles.label}>Email du Pharmacien</Text>
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

          <Text style={styles.label}>Mot de Passe</Text>
          <View style={styles.inputRow}>
            <Lock size={18} color={COLORS.label} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="********"
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

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={[styles.button, loading && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Connexion...' : 'SE CONNECTER'}
            </Text>
            <Text style={styles.buttonArrow}>→</Text>
          </Pressable>

          <Pressable style={styles.forgotLink} onPress={handleForgotPassword} disabled={loading}>
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </Pressable>

          <View style={styles.signupRow}>
            <Text style={styles.signupLabel}>Pas de compte Med-Stock ? </Text>
            <Pressable onPress={() => navigation.navigate('Register')}>
              <Text style={styles.signupLink}>Inscrivez votre pharmacie</Text>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
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
    paddingTop: 32,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarPlaceholder: {
    position: 'absolute',
    top: -28,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0E0E0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
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
  forgotLink: {
    alignSelf: 'center',
    marginTop: 12,
  },
  forgotText: {
    fontSize: 12,
    color: COLORS.link,
    textDecorationLine: 'underline',
  },
  signupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
  },
  signupLabel: {
    fontSize: 12,
    color: COLORS.subtitle,
  },
  signupLink: {
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
