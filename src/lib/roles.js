// Bekannte Nur-Lese-Konten (z. B. der Review-Zugang).
// WICHTIG: Die Sicherheit erzwingt der Server über Row Level Security –
// diese Liste steuert nur die Oberfläche (Buttons deaktivieren, Hinweise).
const READ_ONLY_IDS = ['8e60d3c4-c4c6-4390-8680-0db0df4fd231']

export function isReadOnlySession(session) {
  return READ_ONLY_IDS.includes(session?.user?.id)
}

export const READ_ONLY_MSG =
  'Dieses Konto besitzt nur Leserechte. Änderungen können nicht gespeichert werden.'
