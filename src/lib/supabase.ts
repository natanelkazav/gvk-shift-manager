import {
  createClient,
} from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env
    .VITE_SUPABASE_URL
    ?.trim();

const supabasePublishableKey =
  import.meta.env
    .VITE_SUPABASE_PUBLISHABLE_KEY
    ?.trim();

if (
  !supabaseUrl
) {
  throw new Error(
    'Missing VITE_SUPABASE_URL. Add it to the environment variables.',
  );
}

if (
  !supabasePublishableKey
) {
  throw new Error(
    'Missing VITE_SUPABASE_PUBLISHABLE_KEY. Add it to the environment variables.',
  );
}

export const supabase =
  createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      global: {
        headers: {
          apikey:
            supabasePublishableKey,
        },
      },

      auth: {
        persistSession:
          true,

        autoRefreshToken:
          true,

        detectSessionInUrl:
          true,
      },
    },
  );