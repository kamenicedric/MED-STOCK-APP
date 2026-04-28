import { useState, useCallback, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ChevronLeft, Banknote, Plus, Minus } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

const COLORS = {
  bg: '#F5F5F5',
  white: '#FFFFFF',
  title: '#212121',
  subtitle: '#757575',
  green: '#2E7D32',
  red: '#C62828',
  border: '#EEEEEE',
};

const SCAN_PAUSE_MS = 1800;

export default function QuickSaleScreen() {
  const navigation = useNavigation();
  const [cart, setCart] = useState([]);
  const [productsWithStock, setProductsWithStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [scanPaused, setScanPaused] = useState(false);
  const pauseTimeoutRef = useRef(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const loadProductsWithStock = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        setProductsWithStock([]);
        return;
      }
      const { data: products } = await supabase
        .from('products')
        .select('id, name, barcode')
        .eq('user_id', user.id);

      const { data: lots } = await supabase
        .from('inventory_lots')
        .select('product_id, quantity, expiry_date, sale_price')
        .eq('user_id', user.id)
        .gt('quantity', 0)
        .order('expiry_date', { ascending: true });

      const byProduct = {};
      (lots || []).forEach((lot) => {
        const id = lot.product_id;
        if (!byProduct[id]) {
          byProduct[id] = { totalQty: 0, salePrice: Number(lot.sale_price) || 0 };
        }
        byProduct[id].totalQty += lot.quantity;
      });

      const list = (products || [])
        .filter((p) => (byProduct[p.id]?.totalQty ?? 0) > 0)
        .map((p) => ({
          id: p.id,
          name: p.name,
          barcode: p.barcode,
          stock: byProduct[p.id].totalQty,
          unit_price: byProduct[p.id].salePrice,
        }));
      setProductsWithStock(list);
    } catch (e) {
      console.warn('QuickSale loadProducts:', e);
      setProductsWithStock([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProductsWithStock();
      return () => {
        if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      };
    }, [loadProductsWithStock]),
  );

  const addToCart = (product) => {
    const existing = cart.find((c) => c.product_id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) return;
      setCart(
        cart.map((c) =>
          c.product_id === product.id
            ? { ...c, quantity: c.quantity + 1 }
            : c,
        ),
      );
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          name: product.name,
          quantity: 1,
          unit_price: product.unit_price,
          maxStock: product.stock,
        },
      ]);
    }
  };

  const updateQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product_id !== productId) return c;
          const q = c.quantity + delta;
          if (q <= 0) return null;
          if (q > (c.maxStock ?? 999)) return c;
          return { ...c, quantity: q };
        })
        .filter(Boolean),
    );
  };

  const total = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const handleBarcodeScanned = useCallback(
    ({ data }) => {
      if (scanPaused) return;
      const code = String(data || '').trim();
      if (!code) return;
      const product = productsWithStock.find(
        (p) => p.barcode && String(p.barcode).trim() === code,
      );
      if (product) {
        addToCart(product);
        setScanPaused(true);
        if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = setTimeout(() => setScanPaused(false), SCAN_PAUSE_MS);
      } else {
        Alert.alert(
          'Code inconnu',
          `Aucun produit en stock avec le code « ${code} ». Ajoutez le code-barres au produit dans le Stock.`,
        );
      }
    },
    [scanPaused, productsWithStock, cart],
  );

  const handleValidate = async () => {
    if (cart.length === 0) {
      Alert.alert('Panier vide', 'Ajoutez au moins un produit au panier.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      Alert.alert('Session expirée', 'Veuillez vous reconnecter.');
      return;
    }

    const { data: lotsCheck } = await supabase
      .from('inventory_lots')
      .select('product_id, quantity')
      .eq('user_id', user.id)
      .gt('quantity', 0);
    const stockByProduct = {};
    (lotsCheck || []).forEach((l) => {
      stockByProduct[l.product_id] = (stockByProduct[l.product_id] ?? 0) + l.quantity;
    });
    const insufficient = cart.find((c) => (stockByProduct[c.product_id] ?? 0) < c.quantity);
    if (insufficient) {
      Alert.alert(
        'Stock insuffisant',
        `Il n'y a plus assez de stock pour « ${insufficient.name} ». Actualisez le panier ou réduisez la quantité.`,
      );
      return;
    }

    setValidating(true);
    try {
      const { data: saleRow, error: saleError } = await supabase
        .from('sales')
        .insert({ user_id: user.id, total_amount: total })
        .select('id')
        .single();

      if (saleError) {
        Alert.alert('Erreur', saleError.message);
        return;
      }
      const saleId = saleRow.id;

      for (const item of cart) {
        await supabase.from('sale_items').insert({
          sale_id: saleId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        });
      }

      for (const item of cart) {
        const { data: lots } = await supabase
          .from('inventory_lots')
          .select('id, quantity')
          .eq('product_id', item.product_id)
          .eq('user_id', user.id)
          .gt('quantity', 0)
          .order('expiry_date', { ascending: true });

        let remaining = item.quantity;
        for (const lot of lots || []) {
          if (remaining <= 0) break;
          const take = Math.min(lot.quantity, remaining);
          const newQty = lot.quantity - take;
          remaining -= take;
          await supabase
            .from('inventory_lots')
            .update({ quantity: newQty })
            .eq('id', lot.id);
        }
      }

      Alert.alert(
        'Vente enregistrée',
        `Total: ${total.toLocaleString('fr-FR')} FCFA`,
        [
          {
            text: 'OK',
            onPress: () => {
              setCart([]);
              navigation.goBack();
            },
          },
        ],
      );
    } catch (err) {
      Alert.alert('Erreur', err.message ?? 'Impossible d\'enregistrer la vente.');
    } finally {
      setValidating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#212121" />
        </Pressable>
        <Text style={styles.headerTitle}>NOUVELLE VENTE RAPIDE</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.scannerArea}>
          {!cameraPermission?.granted ? (
            <View style={styles.scanPlaceholder}>
              <Text style={styles.scanHint}>
                Scannez le code-barres pour ajouter au panier
              </Text>
              <Pressable style={styles.cameraPermBtn} onPress={requestCameraPermission}>
                <Text style={styles.cameraPermBtnText}>Autoriser la caméra</Text>
              </Pressable>
            </View>
          ) : (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={scanPaused ? undefined : handleBarcodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e', 'qr'],
              }}
            />
          )}
          {scanPaused && cameraPermission?.granted && (
            <View style={styles.scanPausedOverlay}>
              <Text style={styles.scanPausedText}>Produit ajouté · Rescan dans 1 s</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>En stock — touchez + pour ajouter</Text>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={COLORS.green} />
          </View>
        ) : productsWithStock.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              Aucun produit en stock. Ajoutez des médicaments depuis l’onglet Stock.
            </Text>
          </View>
        ) : (
          productsWithStock.slice(0, 15).map((p) => (
            <View key={p.id} style={styles.productRow}>
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.productMeta}>
                  {p.stock} en stock · {Number(p.unit_price).toLocaleString('fr-FR')} FCFA
                </Text>
              </View>
              <Pressable
                style={styles.addBtn}
                onPress={() => addToCart(p)}
              >
                <Plus size={20} color="#FFF" />
              </Pressable>
            </View>
          ))
        )}

        <View style={styles.panierCard}>
          <Text style={styles.panierTitle}>Panier actuel</Text>
          {cart.length === 0 ? (
            <Text style={styles.panierEmpty}>Vide</Text>
          ) : (
            cart.map((item) => (
              <View key={item.product_id} style={styles.panierRow}>
                <Text style={styles.panierLine}>
                  {item.quantity} x {item.name} | {Number(item.unit_price).toLocaleString('fr-FR')} FCFA
                </Text>
                <View style={styles.qtyButtons}>
                  <Pressable
                    style={[styles.qtyBtn, styles.qtyBtnMinus]}
                    onPress={() => updateQty(item.product_id, -1)}
                  >
                    <Minus size={16} color={COLORS.red} />
                  </Pressable>
                  <Pressable
                    style={[styles.qtyBtn, styles.qtyBtnPlus]}
                    onPress={() => updateQty(item.product_id, 1)}
                  >
                    <Plus size={16} color="#FFF" />
                  </Pressable>
                </View>
              </View>
            ))
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL:</Text>
            <Text style={styles.totalValue}>
              {total.toLocaleString('fr-FR')} FCFA
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.validateBtn, (validating || cart.length === 0) && styles.validateBtnDisabled]}
          onPress={handleValidate}
          disabled={validating || cart.length === 0}
        >
          {validating ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.validateText}>VALIDER LA VENTE ET ENCAISSER</Text>
              <Banknote size={20} color="#FFF" style={styles.validateIcon} />
            </>
          )}
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
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.title,
    letterSpacing: 0.3,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  scannerArea: {
    height: 220,
    backgroundColor: '#37474F',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  scanPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  scanHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 12,
  },
  cameraPermBtn: {
    backgroundColor: COLORS.green,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  cameraPermBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  scanPausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanPausedText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.title,
    marginBottom: 10,
  },
  loadingWrap: { paddingVertical: 12, alignItems: 'center' },
  emptyWrap: { paddingVertical: 12 },
  emptyText: { fontSize: 13, color: COLORS.subtitle },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productInfo: { flex: 1, marginRight: 12 },
  productName: { fontSize: 14, fontWeight: '600', color: COLORS.title },
  productMeta: { fontSize: 12, color: COLORS.subtitle, marginTop: 2 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panierCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  panierTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.title,
    marginBottom: 12,
  },
  panierEmpty: { fontSize: 13, color: COLORS.subtitle, marginBottom: 12 },
  panierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  panierLine: {
    flex: 1,
    fontSize: 13,
    color: COLORS.title,
  },
  qtyButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnMinus: {
    borderWidth: 1,
    borderColor: COLORS.red,
  },
  qtyBtnPlus: {
    backgroundColor: COLORS.green,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: COLORS.title },
  totalValue: { fontSize: 18, fontWeight: '700', color: COLORS.title },
  footer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  validateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.green,
    paddingVertical: 14,
    borderRadius: 12,
  },
  validateBtnDisabled: { opacity: 0.6 },
  validateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  validateIcon: { marginLeft: 10 },
});
