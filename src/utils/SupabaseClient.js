import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const missingEnvVars = !supabaseUrl || !supabaseAnonKey;
if (missingEnvVars) {
    console.warn('Supabase credentials are missing. Cloud Sync will be disabled. Check your .env file.');
}

// Export a no-op stub when credentials are absent so the app loads without crashing.
// All cloud-sync paths check cloudUser.isLoggedIn before using supabase, so this is safe.
export const supabase = missingEnvVars
    ? {
        auth: {
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signInWithOAuth: async () => ({ data: null, error: new Error('Cloud Sync is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.') }),
            signOut: async () => {},
        },
    }
    : createClient(supabaseUrl, supabaseAnonKey);
