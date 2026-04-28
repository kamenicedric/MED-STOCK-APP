-- ============================================================
-- MIGRATIONS SUPABASE POUR MED-STOCK
-- À exécuter dans le SQL Editor de ton projet Supabase
-- (en plus des tables et RLS que tu as déjà créés)
-- ============================================================

-- 1. TRIGGER : Créer un profil (pharmacy_name, location, notification_phone) à l'inscription
--    Les champs nom_pharmacie, ville et telephone sont envoyés depuis l'app (RegisterScreen).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, pharmacy_name, owner_name, location, notification_phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom_pharmacie', 'Ma Pharmacie'),
    NEW.raw_user_meta_data->>'owner_name',
    COALESCE(NEW.raw_user_meta_data->>'ville', ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'telephone'), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. RLS manquant pour sale_items (accès via la vente qui appartient à l'utilisateur)
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own sale items"
  ON sale_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
      AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
      AND s.user_id = auth.uid()
    )
  );

-- 3. Colonne pour notifications WhatsApp (numéro fournisseur / responsable)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_phone TEXT;

COMMENT ON COLUMN profiles.notification_phone IS 'Numéro WhatsApp pour envoi des alertes (rupture, péremption), format international sans +';

-- 3b. Photo de profil (URL après upload dans Storage)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3c. RLS sur profiles : une seule politique pour tout (lecture + écriture sur son propre profil)
--    Exécute les DROP un par un (certains noms peuvent ne pas exister, c'est normal).
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can only access their own data" ON profiles;
DROP POLICY IF EXISTS "profiles_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_select_insert_update_own" ON profiles;
DROP POLICY IF EXISTS "Enable read access for users based on id" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;

CREATE POLICY "profiles_select_insert_update_own"
  ON profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Créer le bucket "avatars" dans Supabase Dashboard > Storage (public, pour lire les photos).
-- Politique : authenticated peuvent uploader dans avatars/{user_id}/*

-- 4. (Optionnel) Mise à jour du profil existant si les métadonnées changent
--    Utile si l'utilisateur met à jour son profil depuis l'app plus tard.
-- CREATE OR REPLACE FUNCTION public.sync_profile_metadata()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   UPDATE public.profiles
--   SET
--     pharmacy_name = COALESCE(NEW.raw_user_meta_data->>'nom_pharmacie', pharmacy_name),
--     location = COALESCE(NEW.raw_user_meta_data->>'ville', location)
--   WHERE id = NEW.id;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
-- DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
-- CREATE TRIGGER on_auth_user_updated
--   AFTER UPDATE ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.sync_profile_metadata();
