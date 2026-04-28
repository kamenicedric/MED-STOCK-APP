import { useState, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as ExpoSharing from 'expo-sharing';
import { supabase } from '../lib/supabase';

const COLORS = {
  bg: '#F5F5F5',
  white: '#FFFFFF',
  title: '#212121',
  subtitle: '#757575',
  primary: '#1976D2',
  success: '#2E7D32',
  border: '#EEEEEE',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function ReportsScreen() {
  const navigation = useNavigation();
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [yesterdayRevenue, setYesterdayRevenue] = useState(0);
  const [lowStock, setLowStock] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();
      const yesterdayEnd = new Date(todayStart);
      yesterdayEnd.setSeconds(-1);
      const yesterdayStart = new Date(yesterdayEnd);
      yesterdayStart.setHours(0, 0, 0, 0);

      const [
        { data: todayData },
        { data: yesterdayData },
        { data: lowStockData },
        { data: salesData },
      ] = await Promise.all([
        supabase
          .from('sales')
          .select('total_amount')
          .eq('user_id', user.id)
          .gte('created_at', todayIso),
        supabase
          .from('sales')
          .select('total_amount')
          .eq('user_id', user.id)
          .gte('created_at', yesterdayStart.toISOString())
          .lte('created_at', yesterdayEnd.toISOString()),
        supabase
          .from('alerts_stock_low')
          .select('name, total_stock, min_threshold')
          .eq('user_id', user.id)
          .limit(20),
        supabase
          .from('sales')
          .select('id, total_amount, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(15),
      ]);

      const sum = (arr) => (arr || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
      setTodayRevenue(sum(todayData));
      setYesterdayRevenue(sum(yesterdayData));
      setLowStock(lowStockData || []);
      setRecentSales(salesData || []);
    } catch (e) {
      console.warn('Reports load:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const percentDiff = yesterdayRevenue > 0
    ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
    : (todayRevenue > 0 ? 100 : 0);

  const shareListeAchat = () => {
    const lines = ['*Liste d\'achat — Produits à recommander*\n'];
    if (lowStock.length === 0) {
      lines.push('Aucun produit en alerte pour le moment.');
    } else {
      lowStock.forEach((p) => {
        lines.push(`• ${p.name} — Stock: ${p.total_stock ?? 0} (seuil: ${p.min_threshold ?? 0})`);
      });
    }
    const message = lines.join('\n');
    Share.share({ message, title: 'Liste d\'achat Med-Stock' }).catch((e) => {
      if (e.message?.includes('cancel') || e.code === 'ECANCELED') return;
      Alert.alert('Erreur', 'Impossible de partager.');
    });
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const diffText = yesterdayRevenue > 0
        ? `${percentDiff >= 0 ? '+' : ''}${percentDiff}% vs hier`
        : 'Premier jour';
      const lowStockRows = lowStock
        .map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>${p.total_stock ?? 0}</td><td>${p.min_threshold ?? 0}</td><td>Stock faible</td></tr>`)
        .join('');
      const salesRows = recentSales
        .map((s) => `<tr><td>${formatDate(s.created_at)} ${formatTime(s.created_at)}</td><td>${Number(s.total_amount).toLocaleString('fr-FR')} FCFA</td></tr>`)
        .join('');

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Rapport Med-Stock</title>
  <style>
    body { font-family: sans-serif; padding: 16px; color: #212121; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .sub { font-size: 12px; color: #757575; margin-bottom: 16px; }
    .card { background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    .card h2 { font-size: 12px; color: #757575; margin: 0 0 4px 0; }
    .card .value { font-size: 22px; font-weight: bold; }
    .card .badge { font-size: 12px; color: #2e7d32; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; font-size: 12px; }
    th { color: #757575; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Rapport Med-Stock</h1>
  <p class="sub">Généré le ${formatDate(new Date().toISOString())} à ${formatTime(new Date().toISOString())}</p>

  <div class="card">
    <h2>Chiffre d'affaires du jour</h2>
    <div class="value">${todayRevenue.toLocaleString('fr-FR')} FCFA</div>
    <div class="badge">${diffText}</div>
  </div>

  <div class="card">
    <h2>Produits à recommander (liste d'achat)</h2>
    <table>
      <tr><th>Produit</th><th>Stock</th><th>Seuil</th><th>Statut</th></tr>
      ${lowStockRows || '<tr><td colspan="4">Aucun</td></tr>'}
    </table>
  </div>

  <div class="card">
    <h2>Dernières ventes</h2>
    <table>
      <tr><th>Date / Heure</th><th>Total</th></tr>
      ${salesRows || '<tr><td colspan="2">Aucune vente</td></tr>'}
    </table>
  </div>
</body>
</html>
      `.trim();

      const { uri } = await Print.printToFileAsync({
        html,
        width: 595,
        height: 842,
        base64: false,
      });

      const canShare = await ExpoSharing.isAvailableAsync();
      if (canShare) {
        await ExpoSharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Exporter le rapport PDF',
        });
      } else {
        Alert.alert('PDF généré', 'Le fichier a été généré. Partage non disponible sur cet appareil.');
      }
    } catch (err) {
      Alert.alert('Erreur', err.message ?? 'Impossible de générer le PDF.');
    } finally {
      setExporting(false);
    }
  };

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rapports & Statistiques</Text>
        <Text style={styles.headerSub}>Données en direct depuis Supabase</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Chiffre d'affaires du jour</Text>
              <Text style={styles.cardValue}>
                {todayRevenue.toLocaleString('fr-FR')} FCFA
              </Text>
              <Text style={styles.cardBadge}>
                {yesterdayRevenue > 0
                  ? `${percentDiff >= 0 ? '+' : ''}${percentDiff}% vs hier`
                  : todayRevenue > 0
                    ? 'Premier enregistrement du jour'
                    : 'Aucune vente aujourd\'hui'}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Produits à recommander (liste d'achat)</Text>
              {lowStock.length === 0 ? (
                <Text style={styles.lineText}>Aucun produit en alerte.</Text>
              ) : (
                lowStock.slice(0, 10).map((p, i) => (
                  <View key={i} style={styles.line}>
                    <Text style={styles.lineText} numberOfLines={1}>
                      {p.name} — {p.total_stock ?? 0} en stock (seuil: {p.min_threshold ?? 0})
                    </Text>
                    <Text style={styles.lineBadge}>Stock faible</Text>
                  </View>
                ))
              )}
              <Pressable style={styles.linkBtn} onPress={shareListeAchat}>
                <Text style={styles.linkWhatsapp}>📤 Partager la liste d'achat (WhatsApp, etc.)</Text>
              </Pressable>
              <Pressable
                style={styles.linkBtn}
                onPress={handleExportPdf}
                disabled={exporting}
              >
                <Text style={styles.link}>
                  {exporting ? 'Génération…' : 'Exporter le rapport en PDF'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Historique des ventes</Text>
              {recentSales.length === 0 ? (
                <Text style={styles.lineText}>Aucune vente.</Text>
              ) : (
                recentSales.slice(0, 8).map((s) => (
                  <View key={s.id} style={styles.line}>
                    <Text style={styles.lineText}>
                      {formatTime(s.created_at)} — {formatDate(s.created_at)}
                    </Text>
                    <Text style={styles.lineValue}>
                      {Number(s.total_amount).toLocaleString('fr-FR')} FCFA
                    </Text>
                  </View>
                ))
              )}
              <Pressable
                style={styles.linkBtn}
                onPress={() => navigation.navigate('ReportsDetail')}
              >
                <Text style={styles.link}>Voir plus de détails</Text>
              </Pressable>
            </View>
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.title },
  headerSub: { fontSize: 12, color: COLORS.subtitle, marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  loadingWrap: { paddingVertical: 32, alignItems: 'center' },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardLabel: { fontSize: 12, color: COLORS.subtitle },
  cardValue: { fontSize: 24, fontWeight: '700', color: COLORS.title, marginTop: 4 },
  cardBadge: { fontSize: 12, color: COLORS.success, marginTop: 4 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.title, marginBottom: 12 },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lineText: { flex: 1, fontSize: 13, color: COLORS.subtitle },
  lineValue: { fontSize: 13, fontWeight: '600', color: COLORS.title },
  lineBadge: { fontSize: 12, fontWeight: '600', color: '#E65100' },
  linkBtn: { marginTop: 12 },
  link: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  linkWhatsapp: { fontSize: 14, fontWeight: '600', color: '#25D366' },
});
