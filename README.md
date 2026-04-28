# Med-Stock (MVP)

Application mobile de gestion de stock pour pharmacies (React Native + Expo + Supabase).

## Objectif

Permettre à une pharmacie de :
- gérer ses produits et ses lots (quantités, péremption, prix),
- enregistrer des ventes rapidement,
- suivre les alertes de stock/péremption,
- consulter des rapports et exporter en PDF,
- envoyer des alertes via WhatsApp.

## Stack technique

- **Frontend** : React Native (Expo SDK 54)
- **Navigation** : React Navigation (Stack + Bottom Tabs)
- **Backend** : Supabase (Auth + Postgres + Storage)
- **UI** : StyleSheet React Native (majoritaire) + config NativeWind présente
- **Fonctionnalités natives** :
  - `expo-camera` (scan code-barres/QR),
  - `expo-image-picker` (photo/OCR, photo profil),
  - `expo-print` + `expo-sharing` (PDF).

## Backend API (Express)

Le projet contient maintenant un backend Node.js/Express dans `backend/`.

### Dossier

```text
backend/
  package.json
  .env.example
  src/
    server.js
    supabaseAdmin.js
```

### Rôle du backend

- exposer des endpoints API centralisés,
- utiliser la clé `service_role` Supabase côté serveur (jamais côté mobile),
- préparer une architecture scalable (logs, sécurité API key, validation).

### Installation et lancement du backend

```bash
cd backend
npm install
cp .env.example .env
```

Puis configurer `.env` :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BACKEND_API_KEY` (optionnel mais recommandé)

Lancement :

```bash
npm run dev
```

### Endpoints disponibles

- `GET /health`
- `GET /api/profile/:userId`
- `PUT /api/profile/:userId`
- `GET /api/stock/:userId`
- `GET /api/reports/:userId/today`

Si `BACKEND_API_KEY` est défini, envoyer l’en-tête :

```http
x-api-key: <BACKEND_API_KEY>
```

## Lancement du projet

### 1) Installer les dépendances

```bash
npm install
```

### 2) Configurer les variables d’environnement

Créer `.env` (ou compléter) avec :

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

### 3) Démarrer l’app

```bash
npm start
```

En cas d’erreur Metro/cache:

```bash
npx expo start --clear
```

## Structure du projet

```text
med-stock-app/
  App.js
  supabase_migrations.sql
  src/
    lib/
      supabase.js
    screens/
      LoginScreen.js
      RegisterScreen.js
      HomeScreen.js
      StockScreen.js
      QuickSaleScreen.js
      ReportsScreen.js
      ReportsDetailScreen.js
      AddProductChoiceScreen.js
      AddProductManualScreen.js
      AddProductScanScreen.js
      AddProductOCRScreen.js
      EditProfileScreen.js
```

## Navigation et flux

- **Non connecté** :
  - `LoginScreen`
  - `RegisterScreen`
- **Connecté** :
  - Tabs principales : `Accueil`, `Stock`, `Rapports`
  - Écrans secondaires : `QuickSale`, ajout produit (3 modes), `ReportsDetail`, `EditProfile`

La session Supabase est écoutée dans `App.js` (`onAuthStateChange`) pour basculer automatiquement entre Auth et App.

## Écrans principaux (résumé)

- **Login** : connexion, mot de passe visible/masqué, mot de passe oublié (email reset Supabase).
- **Register** : création compte pharmacie + téléphone.
- **Home** : profil, alertes, ventes du jour, accès édition profil, envoi alertes WhatsApp, déconnexion.
- **Stock** : liste produits, recherche, statut stock/péremption, bouton modifier produit.
- **AddProductManual** : création et édition produit.
- **QuickSale** : scan code-barres + panier + validation vente + décrément FIFO des lots.
- **Reports** : CA du jour, produits à recommander, export PDF, partage liste.
- **EditProfile** : modification profil + photo (Storage bucket `avatars`) + déconnexion.

## Base de données Supabase

Le fichier `supabase_migrations.sql` contient les scripts additionnels du projet :
- trigger de création automatique de profil à l’inscription,
- colonnes profil (ex: `notification_phone`, `avatar_url`),
- politiques RLS utiles.

### Important côté Supabase

1. Vérifier que les tables métier existent (`profiles`, `products`, `inventory_lots`, `sales`, `sale_items`).
2. Exécuter `supabase_migrations.sql` dans le SQL Editor.
3. Créer le bucket Storage **`avatars`** (public) pour les photos de profil.
4. Vérifier les politiques RLS sur `profiles` (lecture/écriture uniquement sur sa propre ligne).

## Points d’attention pour les développeurs

- **Safe Area** : les écrans sont encapsulés avec `SafeAreaView`.
- **RLS** : si une mise à jour échoue côté app, vérifier d’abord les policies Supabase.
- **Cache Expo** : après gros changements, utiliser `npx expo start --clear`.
- **Compatibilité Expo** : rester aligné avec SDK 54 pour éviter les erreurs Babel/Metro.
- **Sécurité backend** : ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` dans le frontend.

## Améliorations recommandées

- Ajouter des tests (unitaires + e2e).
- Ajouter un écran de paramètres complet (profil, numéro WhatsApp, préférences).
- Renforcer la gestion offline (synchronisation locale robuste).
- Créer un vrai service OCR backend (au lieu du mode guidé manuel).

---

Si tu reprends ce projet : commence par valider `.env`, les migrations SQL, puis un run complet des flux Auth -> Profil -> Stock -> Vente -> Rapports.
