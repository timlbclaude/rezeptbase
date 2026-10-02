// Bilddateien im Browser verkleinern und als JPEG kodieren.
// Wird an zwei Stellen gebraucht:
//  - Foto-Import (Kochbuchseite fotografieren → base64 für die KI)
//  - Rezeptbild in der Bearbeiten-Maske (→ data-URL, direkt im Rezept gespeichert)
// Moderne Browser (iOS 13.4+, Chrome 81+) richten Fotos dabei automatisch
// anhand der EXIF-Orientierung auf.

export function fileToJpegDataUrl(file, maxDim = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden')) }
    img.src = url
  })
}
