// Rezeptbase – einmaliger Datenumzug: eingebettete Bilder (data-URL in
// recipes.image_url) nach Supabase Storage (Bucket recipe-images), je Rezept
// ein grosses Bild (max. 1200 px) und ein Thumbnail (max. 320 px).
//
// Läuft in GitHub Actions (Workflow migrate-images.yml) mit dem Service-Role-Key;
// idempotent: bearbeitet nur Rezepte, deren image_url noch mit "data:" beginnt.
//
// Benötigte Umgebungsvariablen:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   DRY_RUN=1  → nur zählen und auflisten, nichts schreiben
import sharp from 'sharp';

const url = process.env.SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const dryRun = process.env.DRY_RUN === '1';
const BUCKET = 'recipe-images';

if (!url || !key) {
  console.error('FEHLER: SUPABASE_URL und/oder SUPABASE_SERVICE_ROLE_KEY fehlen.');
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

interface Row { id: string; user_id: string; image_url: string }

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} – ${(await res.text()).slice(0, 200)}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

async function upload(path: string, body: Buffer): Promise<void> {
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'image/jpeg', 'Cache-Control': 'max-age=31536000', 'x-upsert': 'false' },
    body: new Uint8Array(body),
  });
  if (!res.ok) throw new Error(`Upload ${path}: HTTP ${res.status} – ${(await res.text()).slice(0, 200)}`);
}

const rows = await rest<Row[]>('recipes?select=id,user_id,image_url&image_url=like.data:*&order=created_at.asc');
console.log(`${rows.length} Rezept(e) mit eingebettetem Bild${dryRun ? ' (Probelauf)' : ''}`);

let ok = 0, failed = 0;
for (const r of rows) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(r.image_url);
  if (!m) { console.warn(`  ${r.id}: unbekanntes data-URL-Format – übersprungen`); failed++; continue; }
  const src = Buffer.from(m[2] ?? '', 'base64');
  try {
    const full = await sharp(src).rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const thumb = await sharp(src).rotate().resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
    const base = `${r.user_id}/${r.id}/${Date.now().toString(36)}m`;
    console.log(`  ${r.id}: ${Math.round(src.length / 1024)} KB → ${Math.round(full.length / 1024)} KB + ${Math.round(thumb.length / 1024)} KB`);
    if (dryRun) { ok++; continue; }
    await upload(`${base}.jpg`, full);
    await upload(`${base}-thumb.jpg`, thumb);
    const pub = `${url}/storage/v1/object/public/${BUCKET}/${base}`;
    await rest(`recipes?id=eq.${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ image_url: `${pub}.jpg`, thumb_url: `${pub}-thumb.jpg` }),
    });
    ok++;
  } catch (e) {
    console.error(`  ${r.id}: FEHLER – ${(e as Error).message}`);
    failed++;
  }
}
console.log(`Fertig: ${ok} umgezogen, ${failed} fehlgeschlagen.`);
process.exit(failed ? 1 : 0);
