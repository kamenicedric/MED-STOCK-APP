import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

const COLORS = {
  bg: '#F5F5F5',
  white: '#FFFFFF',
  title: '#212121',
  subtitle: '#757575',
  primary: '#1976D2',
  border: '#EEEEEE',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReportsDetailScreen() {
  const navigation = useNavigation();
  const [sales, setSales] = useState([]);
  const [itemsBySale, setItemsBySale] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;

      const { data: salesData } = await supabase
        .from('sales')
        .select('id, total_amount, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      setSales(salesData || []);

      if (!salesData?.length) {
        setItemsBySale({});
        return;
      }

      const ids = salesData.map((s) => s.id);
      const { data: itemsData } = await supabase
        .from('sale_items')
        .select('sale_id, quantity, unit_price, product_id, products ( name )')
        .in('sale_id', ids);

      const bySale = {};
      (itemsData || []).forEach((row) => {
        const sid = row.sale_id;
        if (!bySale[sid]) bySale[sid] = [];
        bySale[sid].push({
          name: row.products?.name ?? 'Produit',
          quantity: row.quantity,
          unit_price: row.unit_price,
        });
      });
      setItemsBySale(bySale);
    } catch (e) {
      console.warn('ReportsDetail load:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.title} />
        </Pressable>
        <Text style={styles.headerTitle}>Détails des ventes</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {sales.length === 0 ? (
            <Text style={styles.empty}>Aucune vente enregistrée.</Text>
          ) : (
            sales.map((sale) => {
              const items = itemsBySale[sale.id] || [];
              const isExpanded = expandedId === sale.id;
              return (
                <View key={sale.id} style={styles.card}>
                  <Pressable
                    style={styles.saleRow}
                    onPress={() => toggleExpand(sale.id)}
                  >
                    <View style={styles.saleLeft}>
                      <Text style={styles.saleDate}>
                        {formatDate(sale.created_at)} · {formatTime(sale.created_at)}
                      </Text>
                      {items.length > 0 && (
                        <Text style={styles.saleItemsPreview}>
                          {items.length} ligne(s)
                        </Text>
                      )}
                    </View>
                    <View style={styles.saleRight}>
                      <Text style={styles.saleTotal}>
                        {Number(sale.total_amount).toLocaleString('fr-FR')} FCFA
                      </Text>
                      {items.length > 0
                        ? isExpanded
                          ? <ChevronDown size={20} color={COLORS.subtitle} />
                          : <ChevronRight size={20} color={COLORS.subtitle} />
                        : null}
                    </View>
                  </Pressable>
                  {isExpanded && items.length > 0 && (
                    <View style={styles.itemsBlock}>
                      {items.map((item, i) => (
                        <View key={i} style={styles.itemRow}>
                          <Text style={styles.itemText}>
                            {item.quantity} x {item.name}
                          </Text>
                          <Text style={styles.itemPrice}>
                            {(item.quantity * item.unit_price).toLocaleString('fr-FR')} FCFA
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  empty: { fontSize: 14, color: COLORS.subtitle, textAlign: 'center', marginTop: 24 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  saleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  saleLeft: {},
  saleDate: { fontSize: 14, fontWeight: '600', color: COLORS.title },
  saleItemsPreview: { fontSize: 12, color: COLORS.subtitle, marginTop: 2 },
  saleRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saleTotal: { fontSize: 15, fontWeight: '700', color: COLORS.title },
  itemsBlock: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 12,
    paddingTop: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  itemText: { fontSize: 13, color: COLORS.subtitle },
  itemPrice: { fontSize: 13, fontWeight: '600', color: COLORS.title },
});
