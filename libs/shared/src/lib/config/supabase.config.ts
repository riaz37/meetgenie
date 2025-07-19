import { createClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export const getSupabaseConfig = (): SupabaseConfig => {
  const url = process.env['SUPABASE_URL'] || '';
  const anonKey = process.env['SUPABASE_ANON_KEY'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      'Missing required Supabase environment variables: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  return {
    url,
    anonKey,
    serviceRoleKey,
  };
};

// Client for frontend use (with anon key)
export const createSupabaseClient = () => {
  const config = getSupabaseConfig();
  return createClient(config.url, config.anonKey);
};

// Admin client for backend services (with service role key)
export const createSupabaseAdminClient = () => {
  const config = getSupabaseConfig();
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
