// Supabase-Projektdaten (der anon-Key ist öffentlich und darf im Repo liegen;
// der Zugriff wird durch Row Level Security geschützt).
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
