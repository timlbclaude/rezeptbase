import { notify } from './notify.js'

// Übersetzt technische Fehler (Supabase/Netzwerk) in verständliches Deutsch.
// Rohe Datenbank-Meldungen erscheinen nie in der Oberfläche.
export function translateError(error) {
  const msg = String(error?.message ?? '')
  const code = String(error?.code ?? '')
  if (code === '42501' || /row-level security/i.test(msg))
    return 'Dieses Konto besitzt nur Leserechte. Änderungen können nicht gespeichert werden.'
  if (code === 'PGRST303' || /jwt expired|invalid.*token/i.test(msg))
    return 'Deine Sitzung ist abgelaufen – bitte lade die App neu und melde dich an.'
  if (/failed to fetch|networkerror|load failed|fetch/i.test(msg))
    return 'Keine Verbindung – die Änderung wurde nicht gespeichert.'
  if (code === '23514' || /violates check constraint/i.test(msg))
    return 'Der Wert ist ungültig und wurde nicht gespeichert.'
  return 'Speichern fehlgeschlagen. Bitte versuche es erneut.'
}

// Führt EINEN Schreibvorgang aus (beliebiger supabase-Builder, awaitbar).
// Bei Fehlern: Toast mit verständlicher Meldung, technische Details nur in
// der Konsole. Rückgabe: { ok, data, message } – Aufrufer machen bei
// ok=false ihren optimistischen Zustand rückgängig.
export async function runWrite(builder, { silent = false } = {}) {
  try {
    const { data, error } = await builder
    if (error) {
      console.error('[Rezeptbase] Schreibfehler:', error)
      const message = translateError(error)
      if (!silent) notify(message)
      return { ok: false, data: null, message }
    }
    return { ok: true, data, message: null }
  } catch (e) {
    console.error('[Rezeptbase] Schreibfehler:', e)
    const message = translateError(e)
    if (!silent) notify(message)
    return { ok: false, data: null, message }
  }
}
