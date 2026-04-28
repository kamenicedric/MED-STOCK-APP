import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Keyboard, Scan, ScanText } from 'lucide-react-native';

const COLORS = {
  bg: '#F5F5F5',
  white: '#FFFFFF',
  title: '#212121',
  subtitle: '#757575',
  primary: '#1976D2',
  orange: '#F05A28',
  border: '#EEEEEE',
};

export default function AddProductChoiceScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.title} />
        </Pressable>
        <Text style={styles.headerTitle}>Ajouter un produit</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Choisissez comment ajouter le médicament au stock
        </Text>

        <Pressable
          style={styles.optionCard}
          onPress={() => navigation.navigate('AddProductManual')}
        >
          <View style={[styles.iconWrap, { backgroundColor: '#E3F2FD' }]}>
            <Keyboard size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.optionTitle}>Saisie manuelle</Text>
          <Text style={styles.optionDesc}>
            Remplir le formulaire (nom, forme, dosage, quantité, péremption)
          </Text>
        </Pressable>

        <Pressable
          style={styles.optionCard}
          onPress={() => navigation.navigate('AddProductScan')}
        >
          <View style={[styles.iconWrap, { backgroundColor: '#E8F5E9' }]}>
            <Scan size={28} color="#2E7D32" />
          </View>
          <Text style={styles.optionTitle}>Scanner le code-barres / QR</Text>
          <Text style={styles.optionDesc}>
            Flasher le code sur la boîte du médicament
          </Text>
        </Pressable>

        <Pressable
          style={styles.optionCard}
          onPress={() => navigation.navigate('AddProductOCR')}
        >
          <View style={[styles.iconWrap, { backgroundColor: '#FFF3E0' }]}>
            <ScanText size={28} color="#E65100" />
          </View>
          <Text style={styles.optionTitle}>Détection de texte (IA)</Text>
          <Text style={styles.optionDesc}>
            Prendre une photo du médicament pour extraire nom et infos
          </Text>
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
  backBtn: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.title,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.subtitle,
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.title,
    marginBottom: 6,
  },
  optionDesc: {
    fontSize: 13,
    color: COLORS.subtitle,
    lineHeight: 20,
  },
});
