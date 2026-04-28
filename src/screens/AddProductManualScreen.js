import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
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

export default function AddProductManualScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const prefilled = route.params?.prefilled ?? {};
  const editProductId = route.params?.editProductId ?? null;
  const isEditMode = Boolean(editProductId);

  const [name, setName] = useState(prefilled.name ?? '');
  const [form, setForm] = useState(prefilled.form ?? '');
  const [dosage, setDosage] = useState(prefilled.dosage ?? '');
  const [barcode, setBarcode] = useState(prefilled.barcode ?? '');
  const [quantity, setQuantity] = useState(prefilled.quantity ?? '');
  const [expiryDate, setExpiryDate] = useState(prefilled.expiryDate ?? '');
  const [purchasePrice, setPurchasePrice] = useState(prefilled.purchasePrice ?? '');
  const [salePrice, setSalePrice] = useState(prefilled.salePrice ?? '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const nameTrim = name.trim();
    if (!nameTrim) {
      Alert.alert('Champ requis', 'Le nom du produit est obligatoire.');
      return;
    }

    if (isEditMode) {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
          Alert.alert('Session expirée', 'Veuillez vous reconnecter.');
          return;
        }
        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: nameTrim,
            form: form.trim() || null,
            dosage: dosage.trim() || null,
            barcode: barcode.trim() || null,
            min_threshold: 5,
          })
          .eq('id', editProductId)
          .eq('user_id', user.id);
        if (updateError) {
          Alert.alert('Erreur', updateError.message);
          return;
        }
        Alert.alert('Produit modifié', 'Les informations du médicament ont été mises à jour.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } catch (err) {
        Alert.alert('Erreur', err.message ?? 'Une erreur est survenue.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Quantité invalide', 'Saisissez une quantité valide (nombre ≥ 0).');
      return;
    }
    if (!expiryDate.trim()) {
      Alert.alert('Champ requis', 'La date de péremption est obligatoire.');
      return;
    }
    const saleVal = salePrice.trim() ? parseFloat(salePrice.replace(',', '.')) : 0;
    if (isNaN(saleVal) || saleVal < 0) {
      Alert.alert('Prix invalide', 'Le prix de vente doit être un nombre ≥ 0.');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) {
        Alert.alert('Session expirée', 'Veuillez vous reconnecter.');
        return;
      }

      const { data: productRow, error: productError } = await supabase
        .from('products')
        .insert({
          user_id: userId,
          name: nameTrim,
          form: form.trim() || null,
          dosage: dosage.trim() || null,
          barcode: barcode.trim() || null,
          min_threshold: 5,
        })
        .select('id')
        .single();

      if (productError) {
        Alert.alert(
          'Erreur',
          productError.message.includes('relation')
            ? 'Les tables Supabase (products, inventory_lots) n\'existent pas encore. Créez-les depuis le dashboard Supabase.'
            : productError.message,
        );
        return;
      }

      const productId = productRow?.id;
      if (!productId) {
        Alert.alert('Erreur', 'Impossible de créer le produit.');
        return;
      }

      let expiry = expiryDate.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
        const m = expiry.match(/(\d{1,2})\/(\d{4})/);
        if (m) expiry = `${m[2]}-${m[1].padStart(2, '0')}-01`;
        else expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      }
      const purchase = purchasePrice.trim() ? parseFloat(purchasePrice.replace(',', '.')) : null;

      const { error: lotError } = await supabase.from('inventory_lots').insert({
        product_id: productId,
        user_id: userId,
        quantity: qty,
        expiry_date: expiry,
        purchase_price: purchase,
        sale_price: saleVal,
      });

      if (lotError) {
        Alert.alert('Erreur lot', lotError.message);
        return;
      }

      Alert.alert('Produit ajouté', 'Le médicament a été enregistré dans le stock.', [
        {
          text: 'OK',
          onPress: () =>
            navigation.reset({
              index: 0,
              routes: [
                {
                  name: 'MainTabs',
                  state: {
                    index: 1,
                    routes: [
                      { name: 'Accueil' },
                      { name: 'Stock' },
                      { name: 'Rapports' },
                    ],
                  },
                },
              ],
            }),
        },
      ]);
    } catch (err) {
      Alert.alert('Erreur', err.message ?? 'Une erreur est survenue.');
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
        <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.title} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditMode ? 'Modifier le produit' : 'Saisie manuelle'}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>Nom du produit *</Text>
        <TextInput
          style={styles.input}
          placeholder="ex: Paracétamol 500mg"
          placeholderTextColor={COLORS.subtitle}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Forme galénique</Text>
        <TextInput
          style={styles.input}
          placeholder="ex: Comprimé, Gélule, Sirop"
          placeholderTextColor={COLORS.subtitle}
          value={form}
          onChangeText={setForm}
        />

        <Text style={styles.label}>Dosage</Text>
        <TextInput
          style={styles.input}
          placeholder="ex: 500mg"
          placeholderTextColor={COLORS.subtitle}
          value={dosage}
          onChangeText={setDosage}
        />

        <Text style={styles.label}>Code-barres</Text>
        <TextInput
          style={styles.input}
          placeholder="Optionnel"
          placeholderTextColor={COLORS.subtitle}
          value={barcode}
          onChangeText={setBarcode}
          keyboardType="number-pad"
        />

        {!isEditMode && (
          <>
        <Text style={styles.label}>Quantité *</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor={COLORS.subtitle}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Date de péremption *</Text>
        <TextInput
          style={styles.input}
          placeholder="ex: 2026-12-31 ou 12/2026"
          placeholderTextColor={COLORS.subtitle}
          value={expiryDate}
          onChangeText={setExpiryDate}
        />

        <Text style={styles.label}>Prix d'achat (FCFA)</Text>
        <TextInput
          style={styles.input}
          placeholder="Optionnel"
          placeholderTextColor={COLORS.subtitle}
          value={purchasePrice}
          onChangeText={setPurchasePrice}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Prix de vente (FCFA) *</Text>
        <TextInput
          style={styles.input}
          placeholder="ex: 1500 (obligatoire)"
          placeholderTextColor={COLORS.subtitle}
          value={salePrice}
          onChangeText={setSalePrice}
          keyboardType="decimal-pad"
        />
          </>
        )}

        <Pressable
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveBtnText}>
            {loading ? 'Enregistrement...' : isEditMode ? 'Enregistrer les modifications' : 'Enregistrer le produit'}
          </Text>
        </Pressable>
        <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 24 },
  label: { fontSize: 12, color: COLORS.subtitle, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.title,
    marginBottom: 14,
  },
  saveBtn: {
    backgroundColor: COLORS.button,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
