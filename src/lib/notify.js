// Kleiner globaler Toast-Kanal: notify() kann aus jedem Modul aufgerufen
// werden, die Toast-Komponente (in App.jsx eingebunden) zeigt die Meldung an.
export function notify(message, type = 'error') {
  window.dispatchEvent(new CustomEvent('rezeptbase:toast', { detail: { message, type } }))
}
