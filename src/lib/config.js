// Supabase-Projektdaten (der anon-Key ist öffentlich und darf im Repo liegen;
// der Zugriff wird durch Row Level Security geschützt).
// Wird in Phase 1 nach dem Anlegen des Supabase-Projekts befüllt.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
