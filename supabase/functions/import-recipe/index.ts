// Rezeptbase – Edge Function "import-recipe"
// Nimmt eine URL (YouTube/Shorts/TikTok/Kochseite) oder Rohtext entgegen,
// holt den Inhalt und lässt Claude ein strukturiertes Rezept extrahieren.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ---------- Robustheit: Timeout, Retry, Modell-Kette ----------

// fetch mit Zeitlimit und einem zweiten Versuch bei Netzwerkfehler/Timeout/5xx.
// Verhindert, dass eine hängende Kochseite den ganzen Import blockiert.
async function fetchRetry(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15000,
  attempts = 2,
): Promise<Response> {
  let lastErr = "";
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status >= 500 && i < attempts - 1) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      return res;
    } catch (e) {
      lastErr = (e as Error)?.name === "TimeoutError"
        ? `Zeitüberschreitung nach ${Math.round(timeoutMs / 1000)}s`
        : (e as Error)?.message ?? "Netzwerkfehler";
    }
  }
  throw new Error(`Seite nicht erreichbar (${lastErr})`);
}

// Modell-Kette: Wunschmodell aus Secret ANTHROPIC_MODEL, optionales Zweitmodell
// aus ANTHROPIC_MODEL_FALLBACK, danach fest hinterlegte Ausweichmodelle.
// Wird ein Modell von Anthropic abgeschaltet (Retirement), greift automatisch
// das nächste – der Import bricht dann nicht mehr komplett.
function modelChain(): string[] {
  const chain = [
    Deno.env.get("ANTHROPIC_MODEL"),
    Deno.env.get("ANTHROPIC_MODEL_FALLBACK"),
    "claude-sonnet-4-5",
    "claude-haiku-4-5",
  ].filter((m): m is string => !!m && m.trim().length > 0);
  return [...new Set(chain)];
}

// Ein Aufruf der Anthropic-API mit Modell-Fallback und Wiederholung:
// - unbekanntes/abgeschaltetes Modell (404, oder 400 mit "model" im Fehler) → nächstes Modell
// - Überlastung/Serverfehler (429/5xx) oder Timeout → kurz warten, ein zweiter Versuch
// - andere Fehler (z.B. ungültiger Key) → sofort mit klarer Meldung abbrechen
async function callAnthropic(body: Record<string, unknown>): Promise<any> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt (Supabase Secret)");
  const headers = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  };

  let lastError = "";
  for (const model of modelChain()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers,
          body: JSON.stringify({ ...body, model }),
          signal: AbortSignal.timeout(120000),
        });
      } catch (e) {
        lastError = `Netzwerk/Timeout: ${(e as Error)?.message ?? "unbekannt"}`;
        continue; // zweiter Versuch mit demselben Modell
      }
      if (res.ok) return await res.json();
      const errText = (await res.text()).slice(0, 300);
      lastError = `HTTP ${res.status}: ${errText}`;
      if (res.status === 404 || (res.status === 400 && /model/i.test(errText))) {
        break; // Modell existiert nicht (mehr) → nächstes Modell der Kette
      }
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1500));
        continue; // Überlastung → zweiter Versuch
      }
      throw new Error(`Claude API Fehler (${lastError})`);
    }
  }
  throw new Error(`Claude API Fehler – kein Modell der Kette erreichbar (${lastError})`);
}

// ---------- YouTube ----------

function youtubeId(url: string): string | null {
  const m =
    url.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/) ||
    null;
  return m ? m[1] : null;
}

async function fetchYouTube(url: string, id: string) {
  const isShort = url.includes("/shorts/");
  let title = "", author = "", description = "", transcript = "";
  const image = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

  try {
    const oe = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + id)}&format=json`,
    );
    if (oe.ok) {
      const j = await oe.json();
      title = j.title ?? "";
      author = j.author_name ?? "";
    }
  } catch (_) { /* optional */ }

  async function loadTranscript(tracks: any[]) {
    const pick =
      tracks.find((t: any) => t.languageCode?.startsWith("de")) ||
      tracks.find((t: any) => t.languageCode?.startsWith("en")) ||
      tracks[0];
    if (!pick?.baseUrl) return;
    const tr = await fetch(pick.baseUrl.replace(/\\u0026/g, "&") + "&fmt=json3");
    if (tr.ok) {
      const tj = await tr.json();
      transcript = (tj.events ?? [])
        .flatMap((e: any) => (e.segs ?? []).map((s: any) => s.utf8))
        .join("")
        .replace(/\n+/g, " ")
        .trim();
    }
  }

  // 0) Offizielle YouTube Data API (zuverlässig, benötigt Secret YOUTUBE_API_KEY)
  const ytKey = Deno.env.get("YOUTUBE_API_KEY");
  if (ytKey) {
    try {
      const yt = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${ytKey}`,
      );
      if (yt.ok) {
        const j = await yt.json();
        const sn = j.items?.[0]?.snippet;
        if (sn) {
          title = sn.title ?? title;
          author = sn.channelTitle ?? author;
          description = sn.description ?? "";
        }
      }
    } catch (_) { /* weiter mit anderen Strategien */ }
  }

  // 1) InnerTube-API mit mehreren Clients (funktioniert serverseitig oft besser als die Watch-Seite)
  const clients = [
    { clientName: "IOS", clientVersion: "19.09.3", deviceModel: "iPhone14,3", ua: "com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)" },
    { clientName: "ANDROID", clientVersion: "19.09.37", androidSdkVersion: 30, ua: "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip" },
  ];
  for (const c of clients) {
    if (description) break;
    try {
      const it = await fetch(
        "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": c.ua },
          body: JSON.stringify({
            context: { client: { ...c, ua: undefined, hl: "de" } },
            videoId: id,
            contentCheckOk: true,
            racyCheckOk: true,
          }),
        },
      );
      if (it.ok) {
        const j = await it.json();
        title = title || j.videoDetails?.title || "";
        author = author || j.videoDetails?.author || "";
        description = j.videoDetails?.shortDescription ?? "";
        const tracks = j.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
        if (tracks.length && !transcript) await loadTranscript(tracks);
      }
    } catch (_) { /* nächster Client */ }
  }

  // 2) Fallback: Watch-Seite scrapen
  if (!description && !transcript) {
    try {
      const page = await fetch(`https://www.youtube.com/watch?v=${id}&hl=de`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
          "Cookie": "CONSENT=YES+1; SOCS=CAI",
        },
      });
      const html = await page.text();

      const descMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
      if (descMatch) {
        description = JSON.parse('"' + descMatch[1] + '"');
      }

      const tracksMatch = html.match(/"captionTracks":(\[.*?\])/);
      if (tracksMatch) await loadTranscript(JSON.parse(tracksMatch[1]));
    } catch (_) { /* Transkript ist optional */ }
  }

  // 3) Letzte Stufe: Lese-Proxy (rendert die Seite und liefert Text zurück)
  if (!description && !transcript) {
    try {
      const jr = await fetch(`https://r.jina.ai/https://www.youtube.com/watch?v=${id}`, {
        headers: { "X-Return-Format": "text" },
      });
      if (jr.ok) {
        const text = (await jr.text()).slice(0, 20000);
        if (text.length > 200) description = "SEITENINHALT (gerendert):\n" + text;
      }
    } catch (_) { /* dann bleibt nur der manuelle Weg */ }
  }

  const content = [
    title && `VIDEOTITEL: ${title}`,
    author && `KANAL: ${author}`,
    description && `VIDEOBESCHREIBUNG:\n${description}`,
    transcript && `TRANSKRIPT:\n${transcript}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    content,
    source_type: isShort ? "short" : "youtube",
    video_embed_url: `https://www.youtube-nocookie.com/embed/${id}`,
    image_url: image,
  };
}

// ---------- TikTok ----------

function isTikTok(url: string): boolean {
  return /(?:www\.|vm\.|vt\.)?tiktok\.com\//.test(url);
}

// Kurzlinks (vm.tiktok.com/… , tiktok.com/t/…) zur vollen Video-URL auflösen
async function resolveTikTokUrl(url: string): Promise<string> {
  if (/tiktok\.com\/@[^/]+\/video\/\d+/.test(url)) return url;
  try {
    const r = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)" },
    });
    return r.url || url;
  } catch (_) {
    return url;
  }
}

// Vorschaubild herunterladen und als data-URL einbetten
// (TikTok-Thumbnail-URLs laufen nach ~2 Tagen ab und wären danach kaputt)
async function inlineImage(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length === 0 || buf.length > 250000) return null;
    const type = r.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    let bin = "";
    for (let i = 0; i < buf.length; i += 8192) {
      bin += String.fromCharCode(...buf.subarray(i, i + 8192));
    }
    return `data:${type};base64,${btoa(bin)}`;
  } catch (_) {
    return null;
  }
}

async function fetchTikTok(rawUrl: string) {
  const url = await resolveTikTokUrl(rawUrl);
  const oe = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  if (!oe.ok) {
    throw new Error(`TikTok-Video nicht erreichbar (HTTP ${oe.status}). Ist der Link öffentlich?`);
  }
  const j = await oe.json();
  const caption = j.title ?? "";
  const author = j.author_name ?? "";
  const id = (url.match(/video\/(\d{5,})/) || [])[1] ?? j.embed_product_id ?? null;
  const image_url = j.thumbnail_url ? await inlineImage(j.thumbnail_url) : null;

  const content = [
    caption && `TIKTOK-CAPTION (Videobeschreibung): ${caption}`,
    author && `KANAL: ${author}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    content,
    source_type: "tiktok",
    video_embed_url: id ? `https://www.tiktok.com/embed/v2/${id}` : null,
    image_url,
  };
}

// ---------- Instagram ----------

function isInstagram(url: string): boolean {
  // auch Formen wie instagram.com/<nutzer>/reel/<code>/ erkennen
  return /instagram\.com\/(?:[^/]+\/)?(reel|reels|p|tv)\//.test(url);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

async function fetchInstagram(url: string) {
  let caption = "", image: string | null = null;
  const code = (url.match(/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/) || [])[1] ?? null;
  try {
    // Instagram liefert Crawlern die OG-Metadaten (Caption + Bild)
    const r = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" },
    });
    if (r.ok) {
      const html = await r.text();
      const og = (p: string) => {
        const m =
          html.match(new RegExp(`<meta[^>]+property=["']og:${p}["'][^>]+content=["']([^"']*)["']`, "i")) ||
          html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:${p}["']`, "i"));
        return m ? decodeEntities(m[1]) : "";
      };
      caption = [og("title"), og("description")].filter(Boolean).join("\n");
      const img = og("image");
      if (img) image = await inlineImage(img);
    }
  } catch (_) { /* Websuche-Fallback greift */ }

  const content = caption.length >= 30
    ? `INSTAGRAM-REEL (Titel + Caption):\n${caption}\n\nQUELLE: ${url}`
    : `INSTAGRAM-REEL: ${url}\n(Die Caption konnte nicht ausgelesen werden – bitte per Websuche nach diesem Rezept suchen.)`;

  return {
    content,
    source_type: "instagram",
    video_embed_url: code ? `https://www.instagram.com/p/${code}/embed/` : null,
    image_url: image,
  };
}

// ---------- Webseite ----------

function findRecipeJsonLd(html: string): unknown | null {
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const m of scripts) {
    try {
      let data = JSON.parse(m[1].trim());
      const list = Array.isArray(data) ? data : data["@graph"] ?? [data];
      for (const item of Array.isArray(list) ? list : [list]) {
        const type = item?.["@type"];
        if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) return item;
      }
    } catch (_) { /* weiter suchen */ }
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWebsite(url: string) {
  // Mit Zeitlimit + einem zweiten Versuch (siehe fetchRetry oben)
  const res = await fetchRetry(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  }, 15000, 2);
  if (!res.ok) throw new Error(`Seite nicht erreichbar (HTTP ${res.status})`);
  const html = await res.text();

  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  let image_url = og ? og[1] : null;

  const ld = findRecipeJsonLd(html);
  let content: string;
  if (ld) {
    const r = ld as any;
    const img = r.image;
    if (!image_url && img) {
      image_url = typeof img === "string" ? img : Array.isArray(img) ? (typeof img[0] === "string" ? img[0] : img[0]?.url) : img.url ?? null;
    }
    content = "STRUKTURIERTE REZEPTDATEN (schema.org):\n" + JSON.stringify(r).slice(0, 20000);
  } else {
    content = "SEITENTEXT:\n" + stripHtml(html).slice(0, 18000);
  }
  return { content, source_type: "web", video_embed_url: null, image_url };
}

// ---------- Claude-Extraktion ----------

const RECIPE_TOOL = {
  name: "rezept_speichern",
  description: "Speichert das aus der Quelle extrahierte Rezept strukturiert ab.",
  input_schema: {
    type: "object",
    properties: {
      erkannt: { type: "boolean", description: "false, wenn die Quelle KEIN Rezept enthält" },
      title: { type: "string", description: "Rezepttitel auf Deutsch, prägnant" },
      description: { type: "string", description: "1-2 Sätze Kurzbeschreibung auf Deutsch" },
      base_servings: { type: "integer", description: "Portionen laut Quelle, sonst 4" },
      prep_time_min: { type: ["integer", "null"] },
      cook_time_min: { type: ["integer", "null"] },
      category: {
        type: "string",
        enum: ["Vorspeise", "Hauptgericht", "Beilage", "Dessert", "Frühstück", "Snack", "Getränk", "Backen"],
      },
      cuisine: { type: ["string", "null"], description: "z.B. Italienisch, Asiatisch, Deutsch" },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Zutat auf Deutsch, ohne Menge" },
            amount: { type: ["number", "null"], description: "Menge als Zahl, null wenn keine (z.B. 'nach Geschmack')" },
            unit: { type: ["string", "null"], description: "Einheit: g, kg, ml, l, EL, TL, Stück, Prise, Bund, Dose, Zehe ..." },
            is_scalable: { type: "boolean", description: "false bei 'nach Geschmack', 'zum Braten' o.ä." },
          },
          required: ["name", "amount", "unit", "is_scalable"],
        },
      },
      keywords: {
        type: "array",
        items: { type: "string" },
        description:
          "8-15 deutsche Suchbegriffe für dieses Rezept: Oberbegriffe (z.B. Teigwaren, Geflügel, Süßes), " +
          "Synonyme (Pasta/Nudeln, Hähnchen/Poulet), Hauptzutaten-Kategorien, Zubereitungsart (Ofen, Grill, One-Pot), " +
          "Besonderheiten (vegetarisch, scharf, schnell). Kleingeschrieben, einzelne Wörter oder kurze Begriffe.",
      },
      steps: {
        type: "array",
        description: "Kochschritte in Reihenfolge",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "Der Kochschritt auf Deutsch, vollständig formuliert" },
            timer_min: {
              type: ["number", "null"],
              description: "Minuten für einen Küchentimer, wenn der Schritt eine konkrete Wartezeit hat (köcheln, backen, ruhen …), sonst null",
            },
            zutaten: {
              type: ["string", "null"],
              description: "Die in diesem Schritt verwendeten Zutaten mit Menge, kurz (z.B. '2 EL Butter, 1 Zwiebel'), sonst null",
            },
          },
          required: ["text"],
        },
      },
    },
    required: ["erkannt", "title", "base_servings", "category", "ingredients", "steps", "keywords"],
  },
};

async function extractWithClaude(content: string, image?: { data: string; media_type: string }): Promise<any> {
  const prompt =
    "Extrahiere aus der folgenden Quelle ein Kochrezept. Übersetze alles ins Deutsche. " +
    "Mengen als Zahlen (Brüche wie '1/2' als 0.5). " +
    "WICHTIG zu Einheiten: Übernimm die Einheiten der Quelle. Feste Zutaten (Mehl, Zucker, Käse, Butter, Reis, getrocknete Tomaten u.ä.) NIEMALS in ml/Liter angeben – " +
    "verwende Gramm oder die Originaleinheit; amerikanische Cups bei festen Zutaten mit üblicher Dichte in Gramm umrechnen (1 Cup Mehl ≈ 120 g, Zucker ≈ 200 g, geriebener Käse ≈ 100 g). " +
    "Gib bei Schritten mit konkreter Wartezeit timer_min an und liste je Schritt die verwendeten Zutaten (zutaten). " +
    "Vergib 8-15 deutsche Suchbegriffe (keywords) inkl. Oberbegriffen und Synonymen (z.B. Teigwaren UND Pasta UND Nudeln). " +
    "Wenn die Quelle kein Rezept enthält, setze erkannt=false.\n\n---\n\n" +
    content.slice(0, 150000);

  const userContent = image
    ? [
        { type: "image", source: { type: "base64", media_type: image.media_type, data: image.data } },
        { type: "text", text: prompt },
      ]
    : prompt;

  const data = await callAnthropic({
    max_tokens: 4096,
    tools: [RECIPE_TOOL],
    tool_choice: { type: "tool", name: "rezept_speichern" },
    messages: [{ role: "user", content: userContent }],
  });
  const toolUse = (data.content ?? []).find((b: any) => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude hat kein strukturiertes Rezept geliefert");
  return toolUse.input;
}

// Fallback: Rezept per Websuche finden (wenn Video-Beschreibung kein Rezept enthält)
async function extractViaWebSearch(content: string): Promise<any | null> {
  try {
    const data = await callAnthropic({
      max_tokens: 6000,
      tools: [
        { type: "web_search_20250305", name: "web_search", max_uses: 3 },
        RECIPE_TOOL,
      ],
      messages: [{
        role: "user",
        content:
          "Das folgende Kochvideo (YouTube, TikTok oder Instagram) enthält das Rezept nicht oder nur unvollständig als Text. " +
          "Gib bei Schritten mit konkreter Wartezeit timer_min an und liste je Schritt die verwendeten Zutaten. " +
          "Suche im Web nach genau diesem Rezept (bevorzugt vom selben Koch/Kanal, sonst ein sehr ähnliches klassisches Rezept für dieses Gericht). " +
          "Übersetze alles ins Deutsche, Mengen als Zahlen. Feste Zutaten (Mehl, Zucker, Käse u.ä.) nie in ml angeben, sondern in Gramm bzw. der Originaleinheit (Cups mit üblicher Dichte in Gramm). " +
          "Rufe am Ende ZWINGEND das Tool rezept_speichern mit dem vollständigen Rezept auf. " +
          "Nur wenn du wirklich kein passendes Rezept findest, setze erkannt=false.\n\n---\n\n" +
          content.slice(0, 5000),
      }],
    });
    const toolUse = (data.content ?? []).find((b: any) => b.type === "tool_use" && b.name === "rezept_speichern");
    return toolUse ? toolUse.input : null;
  } catch (_) {
    // Websuche ist nur ein Bonus – bei Fehlern greift die normale Meldung
    return null;
  }
}

// Nur Schlagworte für ein BESTEHENDES Rezept erzeugen (Backfill / Nachpflege)
async function generateKeywords(info: any): Promise<string[]> {
  const KEYWORDS_TOOL = {
    name: "schlagworte_speichern",
    description: "Speichert die Suchbegriffe.",
    input_schema: {
      type: "object",
      properties: { keywords: (RECIPE_TOOL.input_schema.properties as any).keywords },
      required: ["keywords"],
    },
  };

  const data = await callAnthropic({
    max_tokens: 800,
    tools: [KEYWORDS_TOOL],
    tool_choice: { type: "tool", name: "schlagworte_speichern" },
    messages: [{
      role: "user",
      content:
        "Erzeuge 8-15 deutsche Suchbegriffe für dieses Rezept (Oberbegriffe wie Teigwaren/Geflügel, " +
        "Synonyme wie Pasta/Nudeln oder Hähnchen/Poulet, Hauptzutaten-Kategorien, Zubereitungsart, Besonderheiten):\n\n" +
        JSON.stringify(info).slice(0, 8000),
    }],
  });
  const toolUse = (data.content ?? []).find((b: any) => b.type === "tool_use");
  return toolUse?.input?.keywords ?? [];
}

// ---------- Handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt" }, 405);

  try {
    const { url, text, image_base64, image_type, keywords_for } = await req.json();

    // Backfill-Modus: nur Schlagworte für ein bestehendes Rezept
    if (keywords_for) {
      const keywords = await generateKeywords(keywords_for);
      return json({ keywords });
    }

    let source;

    if (image_base64 && typeof image_base64 === "string" && image_base64.length > 100) {
      source = {
        content: "REZEPT-FOTO (siehe Bild): Kochbuchseite, Notiz oder Screenshot.",
        source_type: "foto",
        video_embed_url: null,
        image_url: null,
        image: { data: image_base64, media_type: image_type ?? "image/jpeg" },
      };
    } else if (text && text.trim().length > 20) {
      source = {
        content: "MANUELL EINGEFÜGTER TEXT:\n" + text.slice(0, 50000),
        source_type: "manual",
        video_embed_url: null,
        image_url: null,
      };
      if (url) {
        const id = youtubeId(url);
        if (id) {
          source.source_type = url.includes("/shorts/") ? "short" : "youtube";
          source.video_embed_url = `https://www.youtube-nocookie.com/embed/${id}`;
          source.image_url = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
        } else if (isTikTok(url)) {
          source.source_type = "tiktok";
          try {
            const tt = await fetchTikTok(url);
            source.video_embed_url = tt.video_embed_url;
            source.image_url = tt.image_url;
          } catch (_) { /* Text reicht */ }
        } else if (isInstagram(url)) {
          source.source_type = "instagram";
          try {
            const ig = await fetchInstagram(url);
            source.video_embed_url = ig.video_embed_url;
            source.image_url = ig.image_url;
          } catch (_) { /* Text reicht */ }
        } else {
          source.source_type = "web";
        }
      }
    } else if (url) {
      const id = youtubeId(url);
      source = id
        ? await fetchYouTube(url, id)
        : isTikTok(url)
          ? await fetchTikTok(url)
          : isInstagram(url)
            ? await fetchInstagram(url)
            : await fetchWebsite(url);
    } else {
      return json({ error: "Bitte eine URL oder Text angeben" }, 400);
    }

    if (!source.content || source.content.trim().length < 30) {
      return json({
        error: "Die Quelle konnte nicht ausgelesen werden (z.B. Video ohne Untertitel/Beschreibung). Bitte füge das Rezept als Text ein.",
        needs_manual: true,
      }, 422);
    }

    let recipe = await extractWithClaude(source.content, (source as any).image);
    const isVideoSource = ["youtube", "short", "tiktok", "instagram"].includes(source.source_type);
    if (recipe.erkannt === false && isVideoSource) {
      const found = await extractViaWebSearch(source.content);
      if (found && found.erkannt !== false) {
        recipe = found;
        recipe.description = ((recipe.description ?? "") + " (Rezept per Websuche zum Video gefunden – bitte prüfen.)").trim();
      }
    } else if (isVideoSource && (!Array.isArray(recipe.steps) || recipe.steps.length < 2)) {
      // z.B. TikTok-Caption: Zutaten stehen im Text, die Schritte nur im Video
      const found = await extractViaWebSearch(source.content);
      if (found && found.erkannt !== false && Array.isArray(found.steps) && found.steps.length >= 2) {
        recipe.steps = found.steps;
        if (!recipe.prep_time_min) recipe.prep_time_min = found.prep_time_min ?? null;
        if (!recipe.cook_time_min) recipe.cook_time_min = found.cook_time_min ?? null;
        recipe.description = ((recipe.description ?? "") + " (Kochschritte per Websuche ergänzt – bitte prüfen.)").trim();
      }
    }
    if (recipe.erkannt === false) {
      return json({
        error: "In dieser Quelle wurde kein Rezept erkannt. Bitte prüfe den Link oder füge das Rezept als Text ein.",
        needs_manual: true,
      }, 422);
    }

    delete recipe.erkannt;
    return json({
      recipe: {
        ...recipe,
        source_url: url ?? null,
        source_type: source.source_type,
        video_embed_url: source.video_embed_url,
        image_url: source.image_url,
      },
    });
  } catch (e) {
    return json({ error: (e as Error).message ?? "Unbekannter Fehler" }, 500);
  }
});
