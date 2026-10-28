// Rezeptbilder in Supabase Storage (Bucket recipe-images, öffentlich lesbar).
//
// Ablage je Rezept: <user_id>/<recipe_id>/<kennung>.jpg (grosses Bild, max. 1200 px)
//                   <user_id>/<recipe_id>/<kennung>-thumb.jpg (Listenbild, max. 320 px)
// Die Kennung ist je Upload neu, damit Browser- und Service-Worker-Cache nach
// einem Bildwechsel nicht das alte Bild zeigen. Externe Bildadressen (YouTube,
// Kochseiten) bleiben unverändert extern – nur eingebettete data-URLs und
// selbst gewählte Dateien landen im Storage.
import { supabase } from './supabase.ts'
import { fileToJpegDataUrl } from './imageFile.ts'

export const IMAGE_BUCKET = 'recipe-images'
const FULL_MAX = 1200
const THUMB_MAX = 320

export interface RecipeImageUrls {
  image_url: string
  thumb_url: string
}

export function isDataUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith('data:')
}

export function isStorageUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.includes(`/storage/v1/object/public/${IMAGE_BUCKET}/`)
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

// Pfad im Bucket aus einer öffentlichen URL ableiten (null, wenn fremde URL)
export function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!isStorageUrl(url)) return null
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`
  const i = (url as string).indexOf(marker)
  const path = (url as string).slice(i + marker.length).split('?')[0] ?? ''
  try { return decodeURIComponent(path) } catch { return path }
}

async function uploadBlob(path: string, blob: Blob): Promise<string> {
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}

// Quelle (Datei oder data-URL) in zwei JPEG-Varianten umrechnen und hochladen.
export async function uploadRecipeImage(
  userId: string,
  recipeId: string,
  source: Blob | string,
): Promise<RecipeImageUrls> {
  const blob = typeof source === 'string' ? await dataUrlToBlob(source) : source
  const [full, thumb] = await Promise.all([
    fileToJpegDataUrl(blob, FULL_MAX, 0.8).then(dataUrlToBlob),
    fileToJpegDataUrl(blob, THUMB_MAX, 0.75).then(dataUrlToBlob),
  ])
  const key = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  const base = `${userId}/${recipeId}/${key}`
  const [image_url, thumb_url] = await Promise.all([
    uploadBlob(`${base}.jpg`, full),
    uploadBlob(`${base}-thumb.jpg`, thumb),
  ])
  return { image_url, thumb_url }
}

// Alte Varianten entfernen (best effort – ein Fehler hier blockiert nichts).
export async function removeRecipeImages(urls: (string | null | undefined)[]): Promise<void> {
  const paths = urls.map(storagePathFromUrl).filter((p): p is string => Boolean(p))
  if (paths.length === 0) return
  try {
    await supabase.storage.from(IMAGE_BUCKET).remove(paths)
  } catch (e) {
    console.warn('[Rezeptbase] Bild konnte nicht gelöscht werden:', e)
  }
}

// Kompletten Rezeptordner leeren (beim Löschen eines Rezepts).
export async function removeRecipeFolder(userId: string, recipeId: string): Promise<void> {
  try {
    const prefix = `${userId}/${recipeId}`
    const { data } = await supabase.storage.from(IMAGE_BUCKET).list(prefix, { limit: 100 })
    const names = (data ?? []).map((o) => `${prefix}/${o.name}`)
    if (names.length) await supabase.storage.from(IMAGE_BUCKET).remove(names)
  } catch (e) {
    console.warn('[Rezeptbase] Bildordner konnte nicht geleert werden:', e)
  }
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}
