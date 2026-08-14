// Darstellung: 'system' folgt dem Gerät, 'light'/'dark' übersteuern.
// Gespeichert in localStorage, damit die Wahl dauerhaft bleibt.

const KEY = 'rezeptbase-theme'

export function getTheme() {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(t) {
  if (t === 'light' || t === 'dark') {
    document.documentElement.dataset.theme = t
  } else {
    t = 'system'
    delete document.documentElement.dataset.theme
  }
  try { localStorage.setItem(KEY, t) } catch { /* Privatmodus o.ä. */ }
}

// Beim App-Start: ?theme=dark|light erzwingt (Test), sonst gespeicherte Wahl.
export function initTheme() {
  const param = new URLSearchParams(window.location.search).get('theme')
  const t = param === 'light' || param === 'dark' ? param : getTheme()
  if (t === 'light' || t === 'dark') {
    document.documentElement.dataset.theme = t
  }
}
