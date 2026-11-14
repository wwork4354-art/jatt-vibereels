import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const REELS_MEDIA_BUCKET = 'reels-media';

function cleanEnvValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^["']+|["']+$/g, '').trim();
}

function normalizeSupabaseUrl(raw: string): string {
  const cleaned = cleanEnvValue(raw);
  if (!cleaned) return '';
  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }
  // Support domain-only values like "xyzcompany.supabase.co"
  if (/^[a-z0-9.-]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(cleaned)) {
    return `https://${cleaned}`;
  }
  return cleaned;
}

function isValidHttpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      Boolean(parsed.hostname) &&
      parsed.hostname.includes('.')
    );
  } catch {
    return false;
  }
}

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const rawSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = cleanEnvValue(rawSupabaseAnonKey);

const hasValidConfig =
  isValidHttpUrl(supabaseUrl) &&
  !/^https?:\/\/supabase\.co\/?$/i.test(supabaseUrl) &&
  !supabaseUrl.includes('YOUR_') &&
  !supabaseUrl.includes('MY_') &&
  Boolean(supabaseAnonKey) &&
  !supabaseAnonKey.includes('...') &&
  !supabaseAnonKey.includes('YOUR_') &&
  !supabaseAnonKey.includes('MY_');

let client: SupabaseClient | null = null;

if (hasValidConfig) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.warn('Supabase client initialization skipped:', err);
    client = null;
  }
}

export const supabase: SupabaseClient | null = client;
export const isSupabaseConfigured: boolean = Boolean(client);
