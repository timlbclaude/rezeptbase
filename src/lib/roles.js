// Bekannte Nur-Lese-Konten. Aktuell keines: der Review-Zugang wurde am 23.08.2026
// samt seiner Ausnahmen in den Policies entfernt.
// WICHTIG: Die Sicherheit erzwingt der Server über Row Level Security –
// diese Liste steuert nur die Oberfläche (Buttons deaktivieren, Hinweise).
const READ_ONLY_IDS = []

export function isReadOnlySession(session) {
  return READ_ONLY_IDS.includes(session?.user?.id)
}

export const READ_ONLY_MSG =
  'Dieses Konto besitzt nur Leserechte. Änderungen können nicht gespeichert werden.'
