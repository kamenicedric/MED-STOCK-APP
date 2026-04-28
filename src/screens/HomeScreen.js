import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Share,
  Linking,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Camera, RefreshCw, MessageCircle, Pencil, LogOut } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

// Numéro WhatsApp par défaut pour les notifications (rupture de stock, péremption)
const DEFAULT_NOTIFICATION_PHONE = '659823902';

const COLORS = {
  bg: '#F5F5F5',
  white: '#FFFFFF',
  title: '#212121',
  subtitle: '#757575',
  accent: '#1976D2',
  buttonStart: '#FF5722',
  buttonEnd: '#E64A19',
  alertDanger: '#FFEBEE',
  alertWarning: '#FFF3E0',
  textDanger: '#C62828',
  textWarning: '#E65100',
};

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const [profile, setProfile] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasPromptedForAlerts = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        setLoading(false);
        return;
      }
      setUserEmail(user.email ?? '');

      const [profileRes, expiryRes, lowRes, salesRes] = await Promise.all([
        supabase.from('profiles').select('pharmacy_name, owner_name, notification_phone, avatar_url').eq('id', user.id).maybeSingle(),
        supabase.from('alerts_expiry').select('name, quantity, expiry_date').eq('user_id', user.id).limit(10),
        supabase.from('alerts_stock_low').select('name, total_stock, min_threshold').eq('user_id', user.id).limit(10),
        supabase
          .from('sales')
          .select('id, total_amount, created_at')
          .eq('user_id', user.id)
          .gte('created_at', new Date().toISOString().slice(0, 10))
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (expiryRes.data) setExpiryAlerts(expiryRes.data);
      if (lowRes.data) setLowStockAlerts(lowRes.data);
      if (salesRes.data) setRecentSales(salesRes.data);
    } catch (e) {
      console.warn('HomeScreen load:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const pharmacyName = profile?.pharmacy_name || 'Ma Pharmacie';
  const ownerName = profile?.owner_name || userEmail?.split('@')[0] || 'Pharmacien';
  const notificationPhone = (profile?.notification_phone?.replace(/\D/g, '') || DEFAULT_NOTIFICATION_PHONE).trim();

  const buildAlertsMessage = () => {
    const lines = [`*Alertes Med-Stock — ${pharmacyName}*\n`];
    if (expiryAlerts.length > 0) {
      lines.push('⚠️ *Médicaments en voie de péremption:*');
      expiryAlerts.forEach((a) => {
        lines.push(`• ${a.name} — Qté: ${a.quantity} — Péremption: ${formatDate(a.expiry_date)}`);
      });
      lines.push('');
    }
    if (lowStockAlerts.length > 0) {
      lines.push('📉 *Rupture / stock faible:*');
      lowStockAlerts.forEach((a) => {
        lines.push(`• ${a.name} — Stock: ${a.total_stock ?? 0} (seuil: ${a.min_threshold ?? 5})`);
      });
    }
    return lines.join('\n').trim() || 'Aucune alerte pour le moment.';
  };

  const handleShareAlerts = async () => {
    const message = buildAlertsMessage();
    try {
      await Share.share({
        message,
        title: 'Alertes stock Med-Stock',
      });
    } catch (e) {
      if (e.message?.includes('cancel') || e.code === 'ECANCELED') return;
      Alert.alert('Erreur', 'Impossible d\'ouvrir le partage.');
    }
  };

  const openWhatsAppWithAlerts = useCallback(() => {
    const lines = [`*Alertes Med-Stock — ${pharmacyName}*\n`];
    if (expiryAlerts.length > 0) {
      lines.push('⚠️ *Médicaments en voie de péremption:*');
      expiryAlerts.forEach((a) => {
        lines.push(`• ${a.name} — Qté: ${a.quantity} — Péremption: ${formatDate(a.expiry_date)}`);
      });
      lines.push('');
    }
    if (lowStockAlerts.length > 0) {
      lines.push('📉 *Rupture / stock faible:*');
      lowStockAlerts.forEach((a) => {
        lines.push(`• ${a.name} — Stock: ${a.total_stock ?? 0} (seuil: ${a.min_threshold ?? 5})`);
      });
    }
    const message = lines.join('\n').trim() || 'Aucune alerte pour le moment.';
    const phone = notificationPhone;
    if (!phone || phone.length < 8) return;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => Alert.alert('Erreur', 'Impossible d\'ouvrir WhatsApp.'));
  }, [pharmacyName, expiryAlerts, lowStockAlerts, notificationPhone]);

  const handleWhatsAppDirect = () => {
    openWhatsAppWithAlerts();
  };

  // Proposition automatique d'envoi des alertes par WhatsApp à l'ouverture (une fois par session)
  useEffect(() => {
    if (loading || hasPromptedForAlerts.current) return;
    const hasAlerts = expiryAlerts.length > 0 || lowStockAlerts.length > 0;
    if (!hasAlerts) return;
    hasPromptedForAlerts.current = true;
    const displayPhone = notificationPhone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
    Alert.alert(
      'Alertes stock',
      `Vous avez des alertes (rupture de stock ou péremption). Envoyer la notification par WhatsApp au ${displayPhone} ?`,
      [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Envoyer', onPress: openWhatsAppWithAlerts },
      ],
    );
  }, [loading, expiryAlerts.length, lowStockAlerts.length, notificationPhone, openWhatsAppWithAlerts]);

  const alerts = [
    ...expiryAlerts.map((a) => ({
      type: 'danger',
      text: `Périmption: ${a.name} - Qty: ${a.quantity} - Exp: ${formatDate(a.expiry_date)}`,
    })),
    ...lowStockAlerts.map((a) => ({
      type: 'warning',
      text: `Rupture / faible: ${a.name} - Stock: ${a.total_stock ?? 0} (seuil: ${a.min_threshold ?? 5})`,
    })),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.headerProfile} onPress={() => navigation.navigate('EditProfile')}>
            <View style={styles.avatar}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {(ownerName || 'P').slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.headerText}>
              <Text style={styles.brand}>MED-STOCK - {pharmacyName}</Text>
              <Text style={styles.greeting}>Bonjour, {ownerName}.</Text>
              <Text style={styles.tagline}>Gérez votre stock, sauvez des vies.</Text>
              <Text style={styles.editProfileHint}>Appuyez pour modifier le profil</Text>
            </View>
            <Pencil size={20} color={COLORS.subtitle} />
          </Pressable>
          <Pressable
            style={styles.logoutBtn}
            onPress={() => {
              Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Déconnecter', style: 'destructive', onPress: () => supabase.auth.signOut() },
              ]);
            }}
          >
            <LogOut size={22} color={COLORS.subtitle} />
          </Pressable>
        </View>

        <Pressable
          style={styles.ctaButton}
          onPress={() => navigation.navigate('QuickSale')}
        >
          <View>
            <Text style={styles.ctaSub}>Nouvelle opération</Text>
            <Text style={styles.ctaTitle}>NOUVELLE VENTE RAPIDE</Text>
          </View>
          <View style={styles.ctaIconWrap}>
            <Camera size={22} color="#FFF" />
          </View>
        </Pressable>

        <Text style={styles.sectionTitle}>
          ALERTES URGENTES ({alerts.length})
        </Text>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={COLORS.accent} />
          </View>
        ) : alerts.length === 0 ? (
          <View style={styles.alertCardWarning}>
            <Text style={styles.alertIconWarning}>✓</Text>
            <Text style={styles.alertText}>Aucune alerte pour le moment.</Text>
          </View>
        ) : (
          <>
            {alerts.slice(0, 5).map((a, i) => (
              <View
                key={i}
                style={
                  a.type === 'danger'
                    ? styles.alertCardDanger
                    : styles.alertCardWarning
                }
              >
                <Text
                  style={
                    a.type === 'danger'
                      ? styles.alertIcon
                      : styles.alertIconWarning
                  }
                >
                  ⚠
                </Text>
                <Text style={styles.alertText}>{a.text}</Text>
              </View>
            ))}
            <Pressable style={styles.whatsappButton} onPress={handleWhatsAppDirect}>
              <MessageCircle size={20} color="#FFF" style={styles.whatsappIcon} />
              <Text style={styles.whatsappButtonText}>
                Notifier par WhatsApp ({notificationPhone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')})
              </Text>
            </Pressable>
            <Pressable style={styles.shareLink} onPress={handleShareAlerts}>
              <Text style={styles.shareLinkText}>Ou partager à un autre contact</Text>
            </Pressable>
          </>
        )}

        <Text style={styles.sectionTitle}>Dernières Ventes (Aujourd'hui)</Text>
        {recentSales.length === 0 ? (
          <View style={styles.salesCard}>
            <Text style={styles.saleLine}>Aucune vente aujourd'hui.</Text>
          </View>
        ) : (
          <View style={styles.salesCard}>
            {recentSales.map((s) => (
              <Text key={s.id} style={styles.saleLine}>
                {formatTime(s.created_at)} | Total: {Number(s.total_amount).toLocaleString('fr-FR')} FCFA
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutBtn: {
    padding: 8,
    marginLeft: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#BBDEFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1565C0',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  editProfileHint: {
    fontSize: 11,
    color: COLORS.subtitle,
    marginTop: 4,
  },
  headerText: {
    flex: 1,
  },
  brand: {
    fontSize: 11,
    color: COLORS.subtitle,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.title,
  },
  tagline: {
    fontSize: 12,
    color: COLORS.subtitle,
    marginTop: 2,
  },
  syncBlock: {
    alignItems: 'center',
  },
  userName: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.subtitle,
    maxWidth: 60,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.buttonStart,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  ctaSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
  },
  ctaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  ctaIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.title,
    marginBottom: 10,
  },
  loadingWrap: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  alertCardDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.alertDanger,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  alertCardWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.alertWarning,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  alertIcon: {
    fontSize: 16,
    marginRight: 10,
    color: COLORS.textDanger,
  },
  alertIconWarning: {
    fontSize: 16,
    marginRight: 10,
    color: COLORS.textWarning,
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.title,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  whatsappIcon: { marginRight: 8 },
  whatsappButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  shareLink: { marginTop: 8, alignItems: 'center' },
  shareLinkText: { fontSize: 12, color: COLORS.accent, fontWeight: '500' },
  salesCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  saleLine: {
    fontSize: 13,
    color: COLORS.title,
    marginBottom: 6,
  },
});
