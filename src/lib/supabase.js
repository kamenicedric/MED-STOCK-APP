import { createClient } from '@supabase/supabase-js';

// Utilise les variables d'environnement Expo (EXPO_PUBLIC_*) ou des placeholders pour éviter le crash
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

if (
  process.env.EXPO_PUBLIC_SUPABASE_URL == null ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY == null
) {
  console.warn(
    '[Supabase] Configurez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY (fichier .env ou app.config.js) pour activer l’authentification.',
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storage: typeof window === 'undefined' ? undefined : window.localStorage,
  },
});

