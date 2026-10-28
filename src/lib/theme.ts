// Darstellung: 'system' folgt dem Gerät, 'light'/'dark' übersteuern.
// Gespeichert in localStorage, damit die Wahl dauerhaft bleibt.
import type { ThemeChoice } from './types.ts'

const KEY = 'rezeptbase-theme'

function isForced(t: string | null | undefined): t is 'light' | 'dark' {
  return t === 'light' || t === 'dark'
}

export function getTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY)
    return isForced(t) ? t : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(t: ThemeChoice): void {
  if (isForced(t)) {
    document.documentElement.dataset.theme = t
  } else {
    t = 'system'
    delete document.documentElement.dataset.theme
  }
  try { localStorage.setItem(KEY, t) } catch { /* Privatmodus o.ä. */ }
}

// Beim App-Start: ?theme=dark|light erzwingt (Test), sonst gespeicherte Wahl.
export function initTheme(): void {
  const param = new URLSearchParams(window.location.search).get('theme')
  const t = isForced(param) ? param : getTheme()
  if (isForced(t)) {
    document.documentElement.dataset.theme = t
  }
}
