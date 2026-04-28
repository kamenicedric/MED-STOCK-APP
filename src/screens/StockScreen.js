import { useState, useEffect, useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Search, Pencil, FileText, Filter } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

function getStatusStyle(status) {
  if (status === 'ok') return { bg: '#E8F5E9', text: '#2E7D32' };
  if (status === 'warning') return { bg: '#FFF3E0', text: '#E65100' };
  return { bg: '#FFEBEE', text: '#C62828' };
}

function getStatusLabel(status) {
  if (status === 'ok') return 'Stock OK';
  if (status === 'warning') return 'Stock faible';
  return 'Périmé !';
}

function computeStatus(totalQty, minThreshold, expiryDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = expiryDate ? new Date(expiryDate) : null;
  exp?.setHours(0, 0, 0, 0);
  const isExpired = exp && exp < today;
  const isLow = minThreshold != null && totalQty <= minThreshold;
  const nearExpiry = exp && !isExpired && (exp - today) / (24 * 60 * 60 * 1000) <= 90;
  if (isExpired || (isLow && totalQty === 0)) return 'danger';
  if (isLow || nearExpiry) return 'warning';
  return 'ok';
}

function formatExpiry(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const COLORS = {
  bg: '#F5F5F5',
  white: '#FFFFFF',
  title: '#212121',
  subtitle: '#757575',
  primary: '#1976D2',
  border: '#EEEEEE',
};

export default function StockScreen() {
  const navigation = useNavigation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  const loadStock = useCallback(async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        setProducts([]);
        return;
      }
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, form, dosage, min_threshold, barcode')
        .eq('user_id', user.id)
        .order('name');

      if (productsError) {
        setError(productsError.message);
        setProducts([]);
        return;
      }

      const { data: lotsData, error: lotsError } = await supabase
        .from('inventory_lots')
        .select('product_id, quantity, expiry_date')
        .eq('user_id', user.id);

      if (lotsError) {
        setError(lotsError.message);
        setProducts([]);
        return;
      }

      const byProduct = {};
      (lotsData || []).forEach((lot) => {
        const id = lot.product_id;
        if (!byProduct[id]) {
          byProduct[id] = { totalQty: 0, earliestExpiry: null };
        }
        byProduct[id].totalQty += lot.quantity ?? 0;
        const exp = lot.expiry_date;
        if (exp && (!byProduct[id].earliestExpiry || exp < byProduct[id].earliestExpiry)) {
          byProduct[id].earliestExpiry = exp;
        }
      });

      const list = (productsData || []).map((p) => {
        const agg = byProduct[p.id] || { totalQty: 0, earliestExpiry: null };
        const status = computeStatus(
          agg.totalQty,
          p.min_threshold ?? 5,
          agg.earliestExpiry,
        );
        return {
          id: p.id,
          name: p.name,
          form: p.form || '—',
          dosage: p.dosage || '',
          barcode: p.barcode,
          min_threshold: p.min_threshold,
          qty: agg.totalQty,
          expiry: agg.earliestExpiry,
          status,
        };
      });
      setProducts(list);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStock();
    }, [loadStock]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadStock();
  };

  const filtered = search.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.form && p.form.toLowerCase().includes(search.toLowerCase())),
      )
    : products;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>MS</Text>
          </View>
          <Text style={styles.brand}>MED-STOCK - Pharmacie</Text>
          <View style={styles.filterBlock}>
            <Filter size={20} color={COLORS.subtitle} />
            <Text style={styles.filterLabel}>Filtre</Text>
          </View>
        </View>
        <View style={styles.searchBar}>
          <Search size={18} color={COLORS.subtitle} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher dans le stock..."
            placeholderTextColor={COLORS.subtitle}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <Text style={styles.listTitle}>
        LISTE DES MÉDICAMENTS ({filtered.length})
      </Text>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                Aucun médicament. Appuyez sur « Ajouter Nouveau Produit ».
              </Text>
            </View>
          ) : (
            filtered.map((p) => {
              const statusStyle = getStatusStyle(p.status);
              return (
                <View key={p.id} style={styles.card}>
                  <View style={styles.thumb} />
                  <View style={styles.cardBody}>
                    <Text style={styles.productName}>{p.name}</Text>
                    <Text style={styles.details}>
                      Qty: {p.qty} | Exp: {formatExpiry(p.expiry)}
                    </Text>
                    <View style={styles.cardFooter}>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: statusStyle.bg },
                        ]}
                      >
                        <Text
                          style={[styles.badgeText, { color: statusStyle.text }]}
                        >
                          {getStatusLabel(p.status)}
                        </Text>
                      </View>
                      <View style={styles.actions}>
                        <Pressable
                          style={styles.actionBtn}
                          onPress={() =>
                            navigation.navigate('AddProductManual', {
                              editProductId: p.id,
                              prefilled: {
                                name: p.name,
                                form: p.form === '—' ? '' : p.form,
                                dosage: p.dosage || '',
                                barcode: p.barcode || '',
                              },
                            })
                          }
                        >
                          <Pencil size={16} color={COLORS.primary} />
                        </Pressable>
                        <Pressable style={styles.actionBtn}>
                          <FileText size={16} color={COLORS.subtitle} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      <View style={styles.fabWrap}>
        <Pressable
          style={styles.fab}
          onPress={() => navigation.navigate('AddProductChoice')}
        >
          <Text style={styles.fabText}>+ Ajouter Nouveau Produit</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#BBDEFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  brand: {
    flex: 1,
    fontSize: 12,
    color: COLORS.subtitle,
  },
  filterBlock: {
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 11,
    color: COLORS.subtitle,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.title,
    paddingVertical: 4,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.title,
    marginTop: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  errorWrap: {
    padding: 16,
    marginHorizontal: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#C62828',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyWrap: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.subtitle,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#E0E0E0',
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.title,
  },
  details: {
    fontSize: 12,
    color: COLORS.subtitle,
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    marginLeft: 'auto',
    gap: 8,
  },
  actionBtn: {
    padding: 4,
  },
  fabWrap: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fab: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  fabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
