// Stabiler Platzhalter für kaputte/nicht ladbare Rezeptbilder.
// Statt einer leeren Fläche erscheint eine neutrale Kachel.
export const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">' +
      '<rect width="400" height="300" fill="#E3E3E8"/>' +
      '<g stroke="#8E8E93" stroke-width="9" fill="none" stroke-linecap="round">' +
      '<path d="M150 195h100"/>' +
      '<path d="M162 195v-35a38 38 0 0 1 76 0v35"/>' +
      '<path d="M200 128v-16"/>' +
      '</g></svg>',
  )

export function onImgError(e) {
  e.currentTarget.onerror = null
  e.currentTarget.src = PLACEHOLDER
}
