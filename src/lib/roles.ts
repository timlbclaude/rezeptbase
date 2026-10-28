// Bekannte Nur-Lese-Konten. Aktuell keines: der Review-Zugang wurde am 23.08.2026
// samt seiner Ausnahmen in den Policies entfernt.
// WICHTIG: Die Sicherheit erzwingt der Server über Row Level Security –
// diese Liste steuert nur die Oberfläche (Buttons deaktivieren, Hinweise).
import type { Session } from '@supabase/supabase-js'

const READ_ONLY_IDS: string[] = []

export function isReadOnlySession(session: Session | null): boolean {
  return READ_ONLY_IDS.includes(session?.user?.id ?? '')
}

export const READ_ONLY_MSG =
  'Dieses Konto besitzt nur Leserechte. Änderungen können nicht gespeichert werden.'
