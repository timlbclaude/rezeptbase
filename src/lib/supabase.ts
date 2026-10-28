import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.ts'

export const isConfigured: boolean = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

// Ohne Konfiguration zeigt App.tsx einen Hinweis und ruft den Client nie auf;
// deshalb ist der Export hier bewusst nicht optional typisiert.
export const supabase: SupabaseClient<Database> = (isConfigured
  ? createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null) as SupabaseClient<Database>
