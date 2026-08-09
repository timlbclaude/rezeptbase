// Rezeptbase – Edge Function "import-recipe"
// Nimmt eine URL (YouTube/Shorts/Kochseite) oder Rohtext entgegen,
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
    if (tracksMatch) {
      const tracks = JSON.parse(tracksMatch[1]);
      const pick =
        tracks.find((t: any) => t.languageCode?.startsWith("de")) ||
        tracks.find((t: any) => t.languageCode?.startsWith("en")) ||
        tracks[0];
      if (pick?.baseUrl) {
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
    }
  } catch (_) { /* Transkript ist optional */ }

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
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });
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
      steps: { type: "array", items: { type: "string" }, description: "Kochschritte auf Deutsch, je ein vollständiger Schritt" },
    },
    required: ["erkannt", "title", "base_servings", "category", "ingredients", "steps"],
  },
};

async function extractWithClaude(content: string): Promise<any> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt (Supabase Secret)");
  const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-5";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      tools: [RECIPE_TOOL],
      tool_choice: { type: "tool", name: "rezept_speichern" },
      messages: [{
        role: "user",
        content:
          "Extrahiere aus der folgenden Quelle ein Kochrezept. Übersetze alles ins Deutsche. " +
          "Mengen als Zahlen (Brüche wie '1/2' als 0.5). Wenn die Quelle kein Rezept enthält, setze erkannt=false.\n\n---\n\n" +
          content.slice(0, 150000),
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API Fehler (HTTP ${res.status}): ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  const toolUse = (data.content ?? []).find((b: any) => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude hat kein strukturiertes Rezept geliefert");
  return toolUse.input;
}

// ---------- Handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt" }, 405);

  try {
    const { url, text } = await req.json();
    let source;

    if (text && text.trim().length > 20) {
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
        } else {
          source.source_type = "web";
        }
      }
    } else if (url) {
      const id = youtubeId(url);
      source = id ? await fetchYouTube(url, id) : await fetchWebsite(url);
    } else {
      return json({ error: "Bitte eine URL oder Text angeben" }, 400);
    }

    if (!source.content || source.content.trim().length < 30) {
      return json({
        error: "Die Quelle konnte nicht ausgelesen werden (z.B. Video ohne Untertitel/Beschreibung). Bitte füge das Rezept als Text ein.",
        needs_manual: true,
      }, 422);
    }

    const recipe = await extractWithClaude(source.content);
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
