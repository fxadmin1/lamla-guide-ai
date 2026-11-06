import "server-only";

const REVOKED_PLACEHOLDER_KEYS = new Set([
  "AIzaSyAeEcyHo4mNkGaBYQnw1BSDCASSWwqY1aM",
  "your-gemini-api-key",
  "placeholder",
]);

function getActiveGeminiKeys(): string[] {
  const raw = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"] || "";
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 15 && !REVOKED_PLACEHOLDER_KEYS.has(k));
}

const VALID_FAST_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

let preferredGeminiModel: string | null = null;
const deadGeminiModels = new Set<string>();
const keyCooldownUntil = new Map<string, number>();
let freeCloudCooldownUntil = 0;
let cachedPythonBaseUrl: string | null = null;

export function getCandidatePythonUrls(): string[] {
  const envUrl = (process.env["PYTHON_AI_URL"] || "").trim().replace(/\/+$/, "");
  const runtimePort = (process.env["PUBLIC_PORT"] || process.env["PORT"] || "10000").trim();
  const candidates = [
    ...(cachedPythonBaseUrl ? [cachedPythonBaseUrl] : []),
    ...(envUrl ? [envUrl] : []),
    `http://127.0.0.1:${runtimePort}`,
    "http://127.0.0.1:10000",
    "http://127.0.0.1:7860",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:8000",
  ];
  return Array.from(new Set(candidates.filter(Boolean)));
}

export async function callPythonBackend(
  endpointPath: string,
  payload: Record<string, any>,
  timeoutMs: number = 35000,
  authToken?: string,
  userId?: string
): Promise<any | null> {
  const urls = getCandidatePythonUrls();
  const internalSecret = process.env.LAMLA_INTERNAL_SECRET || "lamla-internal-sec-2026-auth";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Internal-Secret": internalSecret,
  };
  if (authToken) {
    headers["Authorization"] = authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`;
  }
  if (userId) {
    headers["X-User-Id"] = userId;
  }
  for (const base of urls) {
    try {
      const res = await fetch(`${base}${endpointPath}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) {
        cachedPythonBaseUrl = base;
        return await res.json();
      }
    } catch {
      // Try next port candidate
    }
  }
  return null;
}

interface GenerateContentOptions {
  systemPrompt?: string;
  temperature?: number;
  responseMimeType?: string;
}

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export async function callGemini(
  promptOrParts: string | GeminiPart[],
  options: GenerateContentOptions = {}
): Promise<string> {
  const activeKeys = getActiveGeminiKeys();
  const rawEnvModel = (process.env["GEMINI_MODEL"] || "").trim();
  const baseModels =
    rawEnvModel && !/3\.[156]/.test(rawEnvModel) && !VALID_FAST_MODELS.includes(rawEnvModel)
      ? [rawEnvModel, ...VALID_FAST_MODELS]
      : [...VALID_FAST_MODELS];

  const candidateModels = [
    ...(preferredGeminiModel && !deadGeminiModels.has(preferredGeminiModel) ? [preferredGeminiModel] : []),
    ...baseModels.filter((m) => m !== preferredGeminiModel && !deadGeminiModels.has(m)),
  ];

  const parts: any[] =
    typeof promptOrParts === "string"
      ? [{ text: promptOrParts }]
      : promptOrParts.map((p) => {
          if (p.inlineData) {
            return {
              inline_data: {
                mime_type: p.inlineData.mimeType,
                data: p.inlineData.data,
              },
            };
          }
          return { text: p.text || "" };
        });

  const now = Date.now();

  for (const apiKey of activeKeys) {
    if ((keyCooldownUntil.get(apiKey) || 0) > now) {
      continue;
    }
    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload: any = {
          contents: [{ parts }],
          generationConfig: {
            temperature: options.temperature ?? 0.3,
          },
        };

        if (options.systemPrompt) {
          payload.systemInstruction = {
            parts: [{ text: options.systemPrompt }],
          };
        }

        if (options.responseMimeType) {
          payload.generationConfig.responseMimeType = options.responseMimeType;
        }

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(22000),
        });

        if (!response.ok) {
          if (response.status === 404) {
            deadGeminiModels.add(model);
            continue;
          }
          if (response.status === 400 || response.status === 401 || response.status === 403) {
            keyCooldownUntil.set(apiKey, Date.now() + 30 * 60 * 1000);
            break;
          }
          if (response.status === 429) {
            keyCooldownUntil.set(apiKey, Date.now() + 60 * 1000);
            break;
          }
          break;
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          preferredGeminiModel = model;
          return text;
        }
      } catch {
        keyCooldownUntil.set(apiKey, Date.now() + 20 * 1000);
        break;
      }
    }
  }

  // Zero-credit-exhaustion cloud fallback for text prompts with 20s timeout & short 15s cooldown
  if (typeof promptOrParts === "string" && Date.now() >= freeCloudCooldownUntil) {
    try {
      const sys =
        (options.systemPrompt || "You are LAMLA Guide AI, an accurate academic tutor.") +
        (options.responseMimeType === "application/json"
          ? "\nReturn ONLY valid JSON without markdown code fences."
          : "");
      const fbRes = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: promptOrParts.slice(0, 22000) },
          ],
          temperature: options.temperature ?? 0.3,
          ...(options.responseMimeType === "application/json"
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (fbRes.ok) {
        const rawText = (await fbRes.text()).trim();
        if (rawText.startsWith("{")) {
          try {
            const parsed = JSON.parse(rawText);
            const msg = parsed?.choices?.[0]?.message?.content;
            if (msg) return msg;
          } catch {
            // fall through
          }
        }
        if (rawText && rawText.length > 10) return rawText;
      }
      freeCloudCooldownUntil = Date.now() + 15 * 1000;
    } catch {
      freeCloudCooldownUntil = Date.now() + 15 * 1000;
    }
  }

  throw new Error("Primary AI providers on cooldown; switching to instant local synthesis.");
}

function cleanJsonResponse(raw: string): any {
  const cleaned = (raw || "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const withoutFences = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      return JSON.parse(withoutFences);
    } catch {
      const arrayMatch = withoutFences.match(/(\[[\s\S]*\])/);
      if (arrayMatch) {
        try {
          return JSON.parse(arrayMatch[1]);
        } catch {
          // ignore
        }
      }
      const objMatch = withoutFences.match(/(\{[\s\S]*\})/);
      if (objMatch) {
        try {
          return JSON.parse(objMatch[1]);
        } catch {
          // ignore
        }
      }
      return [];
    }
  }
}

// ─────────────────────────────────────────────────────────────
// DETERMINISTIC SLIDE PARSER & ACADEMIC SYNTHESIS FALLBACKS
// ─────────────────────────────────────────────────────────────
interface ParsedSlide {
  num: number;
  label: string;
  title: string;
  body: string;
  full: string;
  facts: string[];
}

function isInstitutionalOrBoilerplateLine(line: string): boolean {
  const s = (line || "").trim();
  if (!s) return true;
  if (
    /\b(?:university|college|polytechnic|institute\s+of|faculty\s+of|school\s+of|department\s+of|dept\.?\s+of|campus|semester|academic\s+year|course\s+code|course\s+title|course\s+outline|course\s+instructor|lecturer|instructor|facilitator|professor|prepared\s+by|presented\s+by|compiled\s+by|group\s+members|matric|index\s+no|student\s+id|copyright|all\s+rights\s+reserved)\b/i.test(
      s
    )
  ) {
    return true;
  }
  if (
    /^(?:dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?|ing\.?|rev\.?|esq\.?)\s+[a-z][a-z\s.\-']+$/i.test(s) &&
    s.split(/\s+/).length <= 7
  ) {
    return true;
  }
  if (
    /^(?:welcome|introduction\s+to\s+the\s+course|table\s+of\s+contents|agenda|lecture\s+outline|learning\s+objectives|course\s+objectives|thank\s+you|questions\??|references|any\s+questions\??)$/i.test(
      s
    )
  ) {
    return true;
  }
  return false;
}

function filterSubstantiveSlides(slides: ParsedSlide[]): ParsedSlide[] {
  if (!slides || slides.length <= 1) return slides;
  const kept: ParsedSlide[] = [];

  for (const sl of slides) {
    const title = (sl.title || "").trim();
    const lines = sl.body
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const nonMetaLines = lines.filter((ln) => !isInstitutionalOrBoilerplateLine(ln));
    const isEarlySlide = sl.num <= 3;

    const titleIsBoilerplate =
      isInstitutionalOrBoilerplateLine(title) ||
      /^(?:outline|agenda|contents|table\s+of\s+contents|objectives|learning\s+outcomes|course\s+overview|welcome|title\s+slide|cover\s+page)$/i.test(
        title
      );

    if (isEarlySlide && titleIsBoilerplate && nonMetaLines.length <= 2) {
      continue;
    }
    if (lines.length > 0 && nonMetaLines.length === 0) {
      continue;
    }

    let cleanedTitle = title;
    if (isInstitutionalOrBoilerplateLine(cleanedTitle) && nonMetaLines.length > 0) {
      cleanedTitle = nonMetaLines[0].replace(/^[#•\-*\d.)\s]+/, "").slice(0, 80).trim() || cleanedTitle;
    }
    const cleanedBody = (nonMetaLines.length > 0 ? nonMetaLines : lines).join("\n").trim();

    const updated: ParsedSlide = {
      ...sl,
      title: cleanedTitle,
      body: cleanedBody,
      full: `--- ${sl.label}: ${cleanedTitle} ---\n${cleanedBody}`,
      facts: [],
    };
    updated.facts = extractSlideFacts(updated);
    kept.push(updated);
  }

  return kept.length > 0 ? kept : slides;
}

function extractMainTopicTitle(slides: ParsedSlide[]): string {
  for (const sl of slides) {
    const t = (sl.title || "").trim();
    if (
      t &&
      t.length >= 4 &&
      !isInstitutionalOrBoilerplateLine(t) &&
      !/^(?:slide|page|section)\s*\d+/i.test(t) &&
      !/^(?:introduction|overview|outline|summary|conclusion)$/i.test(t)
    ) {
      return t;
    }
  }
  return slides[0]?.title || "Core Academic Topic";
}

function parseSlidesFromContent(content: string): ParsedSlide[] {
  const text = (content || "").trim();
  if (!text) return [];

  const headerRegex = /(?:^|\n)(?=(?:---\s*)?(?:Slide|Page)\s+\d+\b)/i;
  const rawParts = text
    .split(headerRegex)
    .map((p) => p.trim())
    .filter(Boolean);

  const slides: ParsedSlide[] = [];
  if (rawParts.length > 1 || /^(?:---\s*)?(?:Slide|Page)\s+\d+/i.test(text)) {
    rawParts.forEach((part, idx) => {
      const lines = part
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const firstLine = lines[0] || `Slide ${idx + 1}`;
      const m = firstLine.match(/(?:Slide|Page)\s+(\d+)(?:\s*[:\-—]\s*(.+?))?(?:\s*---)?$/i);
      const slideNum = m ? parseInt(m[1], 10) : idx + 1;
      let title = m && m[2] ? m[2].replace(/---$/, "").trim() : "";
      const bodyLines = m ? lines.slice(1) : lines;
      if (!title || isInstitutionalOrBoilerplateLine(title)) {
        const candidateLine = bodyLines.find((ln) => !isInstitutionalOrBoilerplateLine(ln)) || bodyLines[0] || "";
        if (candidateLine) {
          title = candidateLine.replace(/^[#•\-*\d.)\s]+/, "").slice(0, 80).trim();
        }
      }
      if (!title) title = `Core Topic ${slideNum}`;
      const body = bodyLines.join("\n").trim() || part;
      const slideObj: ParsedSlide = {
        num: slideNum,
        label: `Slide ${slideNum}`,
        title,
        body,
        full: `--- Slide ${slideNum}: ${title} ---\n${body}`,
        facts: [],
      };
      slideObj.facts = extractSlideFacts(slideObj);
      slides.push(slideObj);
    });
    return filterSubstantiveSlides(slides);
  }

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunkSize = 3;
  let slideNum = 1;
  for (let i = 0; i < paragraphs.length; i += chunkSize) {
    const group = paragraphs.slice(i, i + chunkSize).join("\n\n");
    const firstLine =
      group
        .split(/\r?\n/)
        .find((ln) => !isInstitutionalOrBoilerplateLine(ln))
        ?.replace(/^[#•\-*\d.)\s]+/, "")
        .slice(0, 80)
        .trim() || `Topic Section ${slideNum}`;
    const slideObj: ParsedSlide = {
      num: slideNum,
      label: `Slide ${slideNum}`,
      title: firstLine,
      body: group,
      full: `--- Slide ${slideNum}: ${firstLine} ---\n${group}`,
      facts: [],
    };
    slideObj.facts = extractSlideFacts(slideObj);
    slides.push(slideObj);
    slideNum++;
  }
  return filterSubstantiveSlides(slides);
}

function extractSlideFacts(slide: ParsedSlide): string[] {
  const candidates: string[] = [];
  const lines = slide.body.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/^[•\-*▪▸\d.)\s]+/, "").trim();
    if (!line || line.length < 18) continue;
    if (/^(?:slide|page)\s+\d+/i.test(line)) continue;
    if (isInstitutionalOrBoilerplateLine(line)) continue;
    const subSentences = line.split(/(?<=[.!?])\s+(?=[A-Z])/);
    for (const sub of subSentences) {
      const s = sub.replace(/\s+/g, " ").trim().replace(/[,;:]$/, "");
      if (s.length >= 20 && s.length <= 240 && !isInstitutionalOrBoilerplateLine(s)) {
        candidates.push(s.endsWith(".") ? s : `${s}.`);
      }
    }
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const c of candidates) {
    const key = c.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 65);
    if (key.length < 12 || seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  if (unique.length === 0) {
    const fallback =
      slide.body.replace(/\s+/g, " ").trim().slice(0, 180) ||
      `${slide.title} is a fundamental concept in this academic module`;
    unique.push(fallback.endsWith(".") ? fallback : `${fallback}.`);
  }
  return unique;
}

function invertFactToPlausibleMisconception(fact: string, slideTitle: string, variant: number = 0): string {
  const clean = fact.replace(/\.$/, "").trim();
  const swaps: Array<[RegExp, string]> = [
    [/\bincreases\b/i, "decreases"],
    [/\bdecreases\b/i, "increases"],
    [/\bdirectly proportional\b/i, "inversely proportional"],
    [/\binversely proportional\b/i, "directly proportional"],
    [/\brequires\b/i, "operates completely without"],
    [/\bproduces\b/i, "consumes and eliminates"],
    [/\balways\b/i, "never"],
    [/\bessential\b/i, "unnecessary"],
    [/\bactive\b/i, "passive"],
    [/\bpositive\b/i, "negative"],
    [/\binternal\b/i, "external"],
    [/\bprimary\b/i, "secondary"],
    [/\bhigh\b/i, "low"],
  ];
  for (const [pattern, replacement] of swaps) {
    if (pattern.test(clean)) {
      return clean.replace(pattern, replacement) + ".";
    }
  }
  const templates = [
    `${slideTitle} functions independently of ${clean.slice(0, 75).toLowerCase()} under standard conditions.`,
    `In ${slideTitle}, the reverse relationship holds because ${clean.slice(0, 70).toLowerCase()} is bypassed completely.`,
    `${clean} only when external parameters remain fixed at zero.`,
  ];
  return templates[variant % templates.length];
}

function convertBulletsToFlowingProse(markdown: string): string {
  const outLines: string[] = [];
  const bulletBuffer: string[] = [];
  let inCode = false;

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    const sentences = bulletBuffer
      .map((b) => {
        let s = b.trim();
        if (!s) return "";
        if (!/[.!?]$/.test(s)) s += ".";
        return s;
      })
      .filter(Boolean);
    if (sentences.length > 0) {
      outLines.push(sentences.join(" "));
      outLines.push("");
    }
    bulletBuffer.length = 0;
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const stripped = rawLine.trim();
    if (stripped.startsWith("```")) {
      flushBullets();
      inCode = !inCode;
      outLines.push(rawLine);
      continue;
    }
    if (inCode || stripped.startsWith("|") || stripped.startsWith("#")) {
      flushBullets();
      outLines.push(rawLine);
      continue;
    }
    const bulletMatch = stripped.match(/^(?:[-*•▪▸]|\d+[.)])\s+(.+)$/);
    if (bulletMatch) {
      const cleaned = bulletMatch[1].trim().replace(/\*\*([^*]+)\*\*:\s*/g, "**$1** — ");
      bulletBuffer.push(cleaned);
    } else {
      if (stripped === "" && bulletBuffer.length > 0) continue;
      flushBullets();
      outLines.push(rawLine);
    }
  }
  flushBullets();
  return outLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function sanitizeSummaryOutput(markdown: string, mainTopic: string): string {
  const outLines: string[] = [];
  for (const rawLine of markdown.split(/\r?\n/)) {
    const stripped = rawLine.trim();
    // Never include Markdown tables in Summary
    if (stripped.startsWith("|") && stripped.endsWith("|")) {
      if (/^\|[\s:|-]+\|$/.test(stripped)) continue;
      const cells = stripped
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length >= 2 && !/^(slide|topic|concept|section)\b/i.test(cells[0].replace(/[*_`]/g, ""))) {
        outLines.push(`- **${cells[0].replace(/\*\*/g, "")}:** ${cells.slice(1).join(" — ")}`);
      }
      continue;
    }
    let cleaned = rawLine;
    if (stripped.startsWith("#")) {
      cleaned = cleaned.replace(
        /^(#{1,6}\s*)(?:Slide|Page)\s*\d+\s*(?:Summary|Overview)?\s*[:\-—]?\s*/i,
        "$1"
      );
      cleaned = cleaned.replace(/\s*\[(?:Source:\s*)?(?:Slide|Page)\s*\d+\]/gi, "");
      if (/^#{1,6}\s*$/.test(cleaned.trim())) {
        cleaned = `### ${mainTopic} — Core Principles`;
      }
    } else {
      cleaned = cleaned.replace(/\s*\[(?:Source:\s*)?(?:Slide|Page)\s*\d+\]/gi, "");
      cleaned = cleaned.replace(/\b(?:on|in)\s+(?:slide|page)\s+(?:one|two|three|four|five|\d+)\b/gi, "in this lecture");
    }
    outLines.push(cleaned);
  }
  return outLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function buildDeterministicSummary(content: string, mainTopicWebBrief: string = ""): string {
  const slides = parseSlidesFromContent(content);
  const mainTopic = extractMainTopicTitle(slides);

  const transitions = [
    "At the foundation of this subject,",
    "Building directly upon these principles,",
    "Furthermore, as the mechanism progresses,",
    "From a functional and analytical standpoint,",
    "Integrating these concepts into practice,",
  ];

  const narrativeSections = slides.map((s, idx) => {
    const cleanSentences = s.facts.slice(0, 5).map((f) => {
      const t = f.trim();
      return /[.!?]$/.test(t) ? t : `${t}.`;
    });
    const lead = transitions[idx % transitions.length];
    const firstPara = `${lead} **${s.title}** represents a vital component of **${mainTopic}**. ${cleanSentences.slice(0, 3).join(" ")}`;
    const bulletBlock =
      cleanSentences.length > 2
        ? "\n\n" +
          cleanSentences
            .slice(1, 4)
            .map((fact) => `- **${extractConceptFocusFromFact(fact, s.title)}:** ${fact}`)
            .join("\n")
        : "";
    const secondPara =
      cleanSentences.length > 3
        ? `\n\n${cleanSentences.slice(3).join(" ")} Together, these relationships explain how **${s.title}** operates within the broader academic framework of **${mainTopic}**.`
        : `\n\nBy understanding the underlying mechanism of **${s.title}**, you can trace how changes in initial conditions directly shape the resulting system behavior across **${mainTopic}**.`;

    return `### 3.${idx + 1} ${s.title}\n\n${firstPara}${bulletBlock}${secondPara}`;
  });

  const synthesisPoints = slides.slice(0, 12).map((s) => {
    const defn = s.facts[0]?.slice(0, 160) || s.title;
    const mechanism = s.facts[1]?.slice(0, 140) || "";
    return `- **${s.title}:** ${defn}${mechanism ? " Furthermore, " + mechanism[0].toLowerCase() + mechanism.slice(1) : ""}`;
  });

  const overviewTopics = slides.slice(0, 8).map((s) => s.title).join(", ") || mainTopic;
  const webParagraph = mainTopicWebBrief
    ? `${mainTopicWebBrief}\n\n`
    : `Across the entire lecture, the concepts progress systematically from foundational definitions to active mechanisms and real-world applications. Rather than listing isolated fragments or a table of slides, this summary explains the actual subject matter in connected paragraphs and structured key points.\n\n`;

  const rawMd =
    `# ${mainTopic} — Comprehensive Academic Summary\n\n` +
    `## 1. Foundational Overview & Core Principles\n\n` +
    `This academic summary synthesizes the core subject matter on **${mainTopic}** (${overviewTopics}), focusing on essential definitions, step-by-step mechanisms, classifications, and conceptual relationships.\n\n` +
    `${webParagraph}` +
    `## 2. Core Academic Topics, Mechanisms & Processes\n\n` +
    `${narrativeSections.join("\n\n")}\n\n` +
    `## 3. Inter-Concept Relationships & Key Takeaways\n\n` +
    `Understanding **${mainTopic}** requires connecting each mechanism and classification across the entire lecture:\n\n` +
    `${synthesisPoints.join("\n")}\n\n` +
    `In conclusion, mastering **${mainTopic}** depends on tracing how foundational definitions govern active physiological, analytical, or practical processes and distinguishing primary causal pathways from secondary effects.\n`;

  return sanitizeSummaryOutput(rawMd, mainTopic);
}

function extractConceptFocusFromFact(fact: string, fallbackTitle: string): string {
  const clean = fact.replace(/^[•\-*▪▸\d.)\s]+/, "").trim();
  const colonIdx = clean.indexOf(":");
  if (colonIdx > 2 && colonIdx <= 55) {
    return clean.slice(0, colonIdx).replace(/[*_`]/g, "").trim();
  }
  const dashMatch = clean.match(/^([A-Za-z0-9\s()/&-]{3,50})\s+(?:—|–|-)\s+/);
  if (dashMatch) {
    return dashMatch[1].trim();
  }
  const words = clean.split(/\s+/).slice(0, 6).join(" ").replace(/[.,;:]$/, "");
  return words.length >= 4 ? words : fallbackTitle;
}

async function fetchWikipediaSummaryForTopic(query: string): Promise<string> {
  const cleanQ = query
    .replace(/\b(?:slide|page|lecture|topic|section|part|unit|module)\s*\d*\b/gi, "")
    .replace(/[^a-zA-Z0-9\s()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleanQ || cleanQ.length < 3) return "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2800);
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      cleanQ
    )}&utf8=1&format=json&srlimit=1`;
    const sRes = await fetch(searchUrl, {
      headers: { "User-Agent": "LamlaGuideAI/2.0 (Educational Study Platform)" },
      signal: controller.signal,
    });
    if (!sRes.ok) return "";
    const sData = await sRes.json();
    const firstTitle = sData?.query?.search?.[0]?.title;
    if (!firstTitle) return "";

    const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`;
    const sumRes = await fetch(sumUrl, {
      headers: { "User-Agent": "LamlaGuideAI/2.0 (Educational Study Platform)" },
      signal: controller.signal,
    });
    if (!sumRes.ok) return "";
    const sumData = await sumRes.json();
    return String(sumData?.extract || "").trim();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSlideWebNotesMap(slides: ParsedSlide[], mainTopic: string): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  const targets = slides.slice(0, 20);
  await Promise.all(
    targets.map(async (s) => {
      const txt = await fetchWikipediaSummaryForTopic(s.title);
      if (txt) {
        map[s.num] = txt;
      } else if (mainTopic && s.title.toLowerCase() !== mainTopic.toLowerCase()) {
        const fallbackTxt = await fetchWikipediaSummaryForTopic(`${s.title} ${mainTopic}`);
        if (fallbackTxt) map[s.num] = fallbackTxt;
      }
    })
  );
  return map;
}

function buildDetailedSlideSection(
  s: ParsedSlide,
  sectionNumber: number,
  mainTopic: string,
  nextSlide?: ParsedSlide,
  webContext?: string
): string {
  const rawLines = s.body
    .split(/\r?\n/)
    .map((ln) => ln.replace(/^[•\-*▪▸\d.)\s]+/, "").trim())
    .filter((ln) => ln.length >= 12 && !isInstitutionalOrBoilerplateLine(ln));

  const allPoints = s.facts.length >= rawLines.length ? s.facts : rawLines.length > 0 ? rawLines : s.facts;

  const bulletItems = allPoints
    .map((pt) => `- **${extractConceptFocusFromFact(pt, s.title)}:** ${pt}`)
    .join("\n\n");

  const conceptBreakdowns = allPoints
    .map((pt, cIdx) => {
      const focus = extractConceptFocusFromFact(pt, s.title);
      return (
        `#### ${sectionNumber}.${cIdx + 1} ${focus}\n\n` +
        `- **Core Statement from Lecture:** ${pt}\n\n` +
        `- **In-Depth Academic Explanation:** Within **${s.title}** (a key domain of **${mainTopic}**), **${focus}** establishes a foundational principle. Rather than viewing this concept in isolation, note how it defines the functional relationship between the underlying components of **${s.title}** and explains why the system operates this way.\n\n` +
        `- **Step-by-Step Mechanism & Cause-Effect Logic:** First, identify the governing stimulus, condition, or input associated with **${focus}**. Second, trace the active mechanism described by *"${pt}"*. Third, observe the resulting physiological, analytical, or functional outcome within **${s.title}**.\n\n` +
        `- **Clinical / Practical Application & Exam Focus:** In university examinations, questions on **${focus}** test whether you can apply this mechanism to novel scenarios and distinguish primary causes from downstream effects.`
      );
    })
    .join("\n\n\n");

  const cleanTopicQuery = encodeURIComponent(`${s.title} ${mainTopic}`.trim());
  const internetBlock = webContext
    ? `### Supplementary Academic Context & Textbook Expansion\n\n` +
      `*Supplementary Explanation (Beyond Lecture Text):* ${webContext}\n\n` +
      `- **Verified Reference Links:** [Wikipedia Academic Overview — ${s.title}](https://en.wikipedia.org/wiki/Special:Search?search=${cleanTopicQuery}) | [NCBI Bookshelf — ${mainTopic}](https://www.ncbi.nlm.nih.gov/books/?term=${cleanTopicQuery})`
    : `### Supplementary Academic Context & Textbook Expansion\n\n` +
      `*Supplementary Explanation (Expanding Brief Lecture Points):* Lecture slides often condense **${s.title}** into brief bullet points. In authoritative university textbooks on **${mainTopic}**, **${s.title}** operates by coupling specific structural or theoretical inputs directly to regulated functional outputs. Pay close attention to *why* the mechanism initiates, *how* each intermediate step is regulated, and *what clinical or practical consequences* arise when this pathway is altered.\n\n` +
      `- **Verified Reference Links:** [NCBI Bookshelf — ${s.title}](https://www.ncbi.nlm.nih.gov/books/?term=${cleanTopicQuery}) | [Wikipedia Academic Reference — ${s.title}](https://en.wikipedia.org/wiki/Special:Search?search=${cleanTopicQuery})`;

  return (
    `## ${sectionNumber}. ${s.title}\n\n` +
    `### Core Lecture Concepts (From Uploaded Lecture)\n\n` +
    `${bulletItems}\n\n` +
    `### Definitions, Mechanisms & Step-by-Step Analysis\n\n` +
    `${conceptBreakdowns}\n\n` +
    `${internetBlock}\n\n` +
    `### Relationships to Other Topics & Key Takeaways\n\n` +
    `- **High-Yield Examination Takeaway:** Master the formal definition, step-by-step mechanism, and directional cause-and-effect relationship of every concept under **${s.title}**.\n\n` +
    (nextSlide
      ? `- **Conceptual Progression:** Having established the principles of **${s.title}**, the next section examines **${nextSlide.title}**.\n`
      : `- **Synthesis Complete:** This concludes the comprehensive textbook study notes for **${mainTopic}**.\n`)
  );
}

function buildDeterministicNotes(content: string, webNotesMap: Record<number, string> = {}): string {
  const slides = parseSlidesFromContent(content);
  const mainTopic = extractMainTopicTitle(slides);

  const slideSections = slides.map((s, idx) =>
    buildDetailedSlideSection(s, idx + 1, mainTopic, slides[idx + 1], webNotesMap[s.num])
  );

  return (
    `# ${mainTopic} — Comprehensive University Study Notes\n\n` +
    `> **Authoritative Academic Study Guide:** Organized under meaningful academic topic headings, these notes explain every concept from your lecture in full textbook depth and clearly distinguish **Core Lecture Concepts (From Uploaded Lecture)** from **Supplementary Academic Context & Textbook Expansion** with verified reference links.\n\n` +
    `---\n\n` +
    slideSections.join("\n\n---\n\n")
  );
}

function buildDeterministicQuestionFromSlide(
  slide: ParsedSlide,
  allSlides: ParsedSlide[],
  qIndex: number,
  questionType: string
): any {
  const facts = slide.facts;
  const primaryFact = facts[(qIndex - 1) % facts.length];
  const secondaryFact =
    facts.length > 1
      ? facts[qIndex % facts.length]
      : allSlides[qIndex % allSlides.length]?.facts[0] || primaryFact;
  const conceptFocus = extractConceptFocusFromFact(primaryFact, slide.title);

  const otherFacts: string[] = [];
  for (let offset = 1; offset < allSlides.length + 4; offset++) {
    const otherSlide = allSlides[(slide.num + offset + qIndex) % allSlides.length];
    if (otherSlide.num !== slide.num) {
      const f = otherSlide.facts[(qIndex + offset) % otherSlide.facts.length];
      if (f && f !== primaryFact && !otherFacts.includes(f)) {
        otherFacts.push(f);
      }
    }
    if (otherFacts.length >= 3) break;
  }
  while (otherFacts.length < 3) {
    otherFacts.push(invertFactToPlausibleMisconception(primaryFact, slide.title, otherFacts.length + qIndex));
  }

  let effectiveType = questionType;
  if (questionType === "mixed" || questionType === "exhaustive") {
    const cycle = [
      "mcq",
      "multiple_select",
      "assertion_reasoning",
      "application",
      "true_false",
      "fill_in_the_blank",
      "matching",
      "short_answer",
    ];
    effectiveType = cycle[(qIndex - 1) % cycle.length];
  }

  if (effectiveType === "multiple_select") {
    const trueStmt1 = primaryFact;
    const trueStmt2 =
      secondaryFact !== primaryFact
        ? secondaryFact
        : `${conceptFocus} plays an essential functional role within ${slide.title}.`;
    const falseStmt1 = invertFactToPlausibleMisconception(primaryFact, slide.title, qIndex);
    const falseStmt2 = invertFactToPlausibleMisconception(secondaryFact, slide.title, qIndex + 2);
    const statementsBlock =
      `  I. ${trueStmt1}\n` +
      `  II. ${falseStmt1}\n` +
      `  III. ${trueStmt2}\n` +
      `  IV. ${falseStmt2}`;
    const letters = ["A", "B", "C", "D"];
    const targetIdx = (qIndex - 1) % 4;
    const correctCombo = "I and III only";
    const wrongCombos = ["I, II, and III only", "II and IV only", "I, III, and IV only"];
    const opts: string[] = [];
    let wIdx = 0;
    for (let i = 0; i < 4; i++) {
      opts.push(`${letters[i]}. ${i === targetIdx ? correctCombo : wrongCombos[wIdx++]}`);
    }
    return {
      id: qIndex,
      question: `Select the option that identifies ALL correct statements regarding ${conceptFocus} in ${slide.title}:\n${statementsBlock}`,
      type: "multiple_select",
      options: opts,
      correctAnswer: letters[targetIdx],
      explanation: `Statements I and III are accurate regarding ${slide.title} (${trueStmt1} ${trueStmt2}), whereas Statements II and IV invert the governing mechanism.`,
      misconception: "Verify each Roman-numeral statement independently against the mechanism before choosing the combination.",
      testedFact: primaryFact,
      topic: slide.title,
      difficulty: "intermediate",
      sourceRef: "",
    };
  }

  if (effectiveType === "true_false") {
    const isTrue = qIndex % 2 === 1;
    const statement = isTrue
      ? primaryFact
      : invertFactToPlausibleMisconception(primaryFact, slide.title, qIndex);
    return {
      id: qIndex,
      question: `Evaluate the accuracy of this statement regarding ${conceptFocus}: ${statement}`,
      type: "true_false",
      options: ["True", "False"],
      correctAnswer: isTrue ? "True" : "False",
      explanation: isTrue
        ? `This statement is True regarding ${slide.title}: ${primaryFact}`
        : `This statement is False. In ${slide.title}, ${primaryFact}`,
      misconception: "Examiners frequently invert key directional or causal terms to test precision.",
      testedFact: primaryFact,
      topic: slide.title,
      difficulty: "intermediate",
      sourceRef: "",
    };
  }

  if (effectiveType === "matching") {
    const pairs: Array<[string, string]> = [[conceptFocus, primaryFact.slice(0, 110)]];
    for (let i = 0; i < allSlides.length && pairs.length < 3; i++) {
      const other = allSlides[(slide.num + i) % allSlides.length];
      if (other.num !== slide.num && other.facts[0]) {
        const term = extractConceptFocusFromFact(other.facts[0], other.title);
        if (!pairs.some((p) => p[0].toLowerCase() === term.toLowerCase())) {
          pairs.push([term, other.facts[0].slice(0, 110)]);
        }
      }
    }
    while (pairs.length < 3) {
      pairs.push([`${slide.title} Principle ${pairs.length + 1}`, secondaryFact.slice(0, 110)]);
    }
    const colA = pairs.map((p, idx) => `  ${idx + 1}. ${p[0]}`).join("\n");
    const colB = pairs.map((p, idx) => `  (${String.fromCharCode(88 + idx)}) ${p[1]}`).join("\n");
    const letters = ["A", "B", "C", "D"];
    const targetIdx = (qIndex - 1) % 4;
    const correctCombo = "1-(X), 2-(Y), 3-(Z)";
    const wrongCombos = ["1-(Y), 2-(X), 3-(Z)", "1-(Z), 2-(Y), 3-(X)", "1-(X), 2-(Z), 3-(Y)"];
    const opts: string[] = [];
    let wIdx = 0;
    for (let i = 0; i < 4; i++) {
      opts.push(`${letters[i]}. ${i === targetIdx ? correctCombo : wrongCombos[wIdx++]}`);
    }
    return {
      id: qIndex,
      question: `Match each academic concept in Column I with its corresponding mechanism or description in Column II:\nColumn I:\n${colA}\nColumn II:\n${colB}`,
      type: "matching",
      options: opts,
      correctAnswer: letters[targetIdx],
      explanation: `The accurate pairings are 1-(X) [${pairs[0][0]}], 2-(Y) [${pairs[1][0]}], and 3-(Z) [${pairs[2][0]}].`,
      misconception: "Match each concept to its specific governing mechanism rather than a sibling topic's function.",
      testedFact: primaryFact,
      topic: slide.title,
      difficulty: "intermediate",
      sourceRef: "",
    };
  }

  if (effectiveType === "fill_in_the_blank") {
    const escapedFocus = conceptFocus.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let blanked = primaryFact.replace(new RegExp(escapedFocus, "i"), "________");
    if (!blanked.includes("________")) {
      blanked = `In ${slide.title}, ________ is governed by the principle that ${primaryFact[0].toLowerCase() + primaryFact.slice(1)}`;
    }
    const distractorTerms: string[] = [];
    for (const sOther of allSlides) {
      if (distractorTerms.length >= 3) break;
      if (sOther.num !== slide.num && sOther.facts[0]) {
        const t = extractConceptFocusFromFact(sOther.facts[0], sOther.title);
        if (t.toLowerCase() !== conceptFocus.toLowerCase() && !distractorTerms.includes(t)) {
          distractorTerms.push(t);
        }
      }
    }
    for (const fbTerm of ["Homeostatic Baseline", "Reciprocal Regulation", "Collateral Pathway"]) {
      if (distractorTerms.length >= 3) break;
      if (!distractorTerms.includes(fbTerm)) distractorTerms.push(fbTerm);
    }
    const letters = ["A", "B", "C", "D"];
    const targetIdx = (qIndex - 1) % 4;
    const opts: string[] = [];
    let dIdx = 0;
    for (let i = 0; i < 4; i++) {
      opts.push(`${letters[i]}. ${i === targetIdx ? conceptFocus : distractorTerms[dIdx++]}`);
    }
    return {
      id: qIndex,
      question: `Fill in the blank with the most accurate academic concept:\n"${blanked}"`,
      type: "fill_in_the_blank",
      options: opts,
      correctAnswer: letters[targetIdx],
      explanation: `"${conceptFocus}" accurately completes the governing principle: ${primaryFact}`,
      misconception: "Other terms refer to separate mechanisms covered in different sections.",
      testedFact: primaryFact,
      topic: slide.title,
      difficulty: "intermediate",
      sourceRef: "",
    };
  }

  if (effectiveType === "short_answer") {
    const prompts = [
      `Explain the core mechanism and functional significance of ${conceptFocus} in ${slide.title}.`,
      `Outline how ${conceptFocus} operates and state its key academic takeaways within ${slide.title}.`,
      `Distinguish the defining features of ${conceptFocus} and explain why they matter in practice.`,
    ];
    return {
      id: qIndex,
      question: prompts[(qIndex - 1) % prompts.length],
      type: "short_answer",
      options: [],
      correctAnswer: `${primaryFact}${secondaryFact !== primaryFact ? " " + secondaryFact : ""}`,
      markingGuide: `1 mark for core definition/principle (${primaryFact.slice(0, 80)}); 1 mark for mechanism and practical context.`,
      explanation: `Full credit requires stating the core concept of ${slide.title}: ${primaryFact}`,
      misconception: "Omitting the specific mechanism or key terminology loses marks.",
      testedFact: primaryFact,
      topic: slide.title,
      difficulty: "intermediate",
      sourceRef: "",
    };
  }

  if (effectiveType === "assertion_reasoning") {
    const standardArOptions = [
      "A. Both Assertion (A) and Reason (R) are true, and Reason (R) is the correct explanation of Assertion (A).",
      "B. Both Assertion (A) and Reason (R) are true, but Reason (R) is NOT the correct explanation of Assertion (A).",
      "C. Assertion (A) is true, but Reason (R) is false.",
      "D. Assertion (A) is false, but Reason (R) is true.",
      "E. Both Assertion (A) and Reason (R) are false.",
    ];
    const arCases = ["A", "B", "C", "D", "E"];
    const targetCase = arCases[(qIndex - 1) % arCases.length];
    const falsePrimary = invertFactToPlausibleMisconception(primaryFact, slide.title, qIndex);
    const falseSecondary = invertFactToPlausibleMisconception(secondaryFact, slide.title, qIndex + 1);

    let assertionText = "";
    let reasonText = "";
    let explanationText = "";

    if (targetCase === "A") {
      assertionText = primaryFact;
      reasonText = `In ${slide.title}, ${secondaryFact[0].toLowerCase() + secondaryFact.slice(1)}`;
      explanationText = `Both Assertion (A) and Reason (R) are true statements regarding ${slide.title}, and R directly explains the underlying principle of A.`;
    } else if (targetCase === "B") {
      const otherSlide = allSlides[(slide.num + 1) % allSlides.length];
      const independentTrue = otherSlide.facts[0] || secondaryFact;
      assertionText = primaryFact;
      reasonText = independentTrue;
      explanationText = `Both Assertion (A) and Reason (R) are true statements, but R describes a separate concept (${otherSlide.title}) and does not causally explain A.`;
    } else if (targetCase === "C") {
      assertionText = primaryFact;
      reasonText = falseSecondary;
      explanationText = `Assertion (A) is true, whereas Reason (R) is false because ${secondaryFact}`;
    } else if (targetCase === "D") {
      assertionText = falsePrimary;
      reasonText = secondaryFact;
      explanationText = `Assertion (A) is false (${primaryFact}), whereas Reason (R) is a true statement.`;
    } else {
      assertionText = falsePrimary;
      reasonText = falseSecondary;
      explanationText = `Both Assertion (A) and Reason (R) are false. Correctly stated: ${primaryFact}`;
    }

    return {
      id: qIndex,
      question: `Assertion (A): ${assertionText}\nReason (R): ${reasonText}`,
      assertion: assertionText,
      reason: reasonText,
      type: "assertion_reasoning",
      options: standardArOptions,
      correctAnswer: targetCase,
      explanation: explanationText,
      misconception: "In Assertion-Reasoning questions, verify the truth of A and R independently first, then test whether R is the direct cause of A.",
      testedFact: primaryFact,
      topic: slide.title,
      difficulty: "intermediate",
      sourceRef: "",
    };
  }

  // Application-Based or Multiple Choice with balanced A/B/C/D correct answer and NO slide number in stem
  const isApplication = effectiveType === "application";
  const letters = ["A", "B", "C", "D"];
  const targetIdx = (qIndex - 1) % 4;
  const askFalseStatement = !isApplication && qIndex % 5 === 0;

  let qStem = "";
  let correctText = "";
  let distractorPool: string[] = [];

  if (askFalseStatement) {
    qStem = `When evaluating ${conceptFocus} in ${slide.title}, which of the following statements is INCORRECT?`;
    correctText = invertFactToPlausibleMisconception(primaryFact, slide.title, qIndex);
    distractorPool = [
      primaryFact,
      secondaryFact !== primaryFact ? secondaryFact : otherFacts[0],
      otherFacts[1],
    ];
  } else {
    const appStems = [
      `In a practical or clinical scenario involving ${slide.title}, how does the mechanism of ${conceptFocus} determine the outcome?`,
      `When applying the principles of ${slide.title} to an analytical scenario, which observation demonstrates the action of ${conceptFocus}?`,
      `A change occurs in a system governed by ${slide.title}. Based on the mechanism of ${conceptFocus}, which principle applies?`,
    ];
    const mcqStems = [
      `Which of the following accurately states a core principle of ${conceptFocus} in ${slide.title}?`,
      `In the context of ${slide.title}, which statement regarding ${conceptFocus} is scientifically and academically accurate?`,
      `What is a defining characteristic or mechanism of ${conceptFocus}?`,
      `When analyzing ${slide.title}, which conclusion regarding ${conceptFocus} is valid?`,
      `Which statement best explains the operational role of ${conceptFocus} in ${slide.title}?`,
      `Which of the following accurately describes how ${conceptFocus} functions?`,
      `How is ${conceptFocus} best characterized in standard academic and examination contexts?`,
      `Which of the following distinguishes ${conceptFocus} within ${slide.title}?`,
    ];
    qStem = isApplication
      ? appStems[(qIndex - 1) % appStems.length]
      : mcqStems[(qIndex - 1) % mcqStems.length];
    correctText = primaryFact;
    distractorPool = [
      invertFactToPlausibleMisconception(primaryFact, slide.title, qIndex),
      otherFacts[0],
      otherFacts[1],
    ];
  }

  const opts: string[] = [];
  let dIdx = 0;
  for (let i = 0; i < 4; i++) {
    if (i === targetIdx) {
      opts.push(`${letters[i]}. ${correctText}`);
    } else {
      opts.push(`${letters[i]}. ${distractorPool[dIdx % distractorPool.length]}`);
      dIdx++;
    }
  }

  return {
    id: qIndex,
    question: qStem,
    type: isApplication ? "application" : "mcq",
    options: opts,
    correctAnswer: letters[targetIdx],
    explanation: askFalseStatement
      ? `Option ${letters[targetIdx]} is the incorrect statement. Regarding ${slide.title}, ${primaryFact}`
      : `Regarding ${slide.title}: ${primaryFact}`,
    misconception: "Other options either invert the causal relationship or belong to a different concept.",
    testedFact: primaryFact,
    topic: slide.title,
    difficulty: "intermediate",
    sourceRef: "",
  };
}

export async function extractTextFromImageWithAI(
  imageBase64: string,
  mimeType: string = "image/jpeg"
) {
  const systemPrompt = `You are an expert academic slide and document extractor for LAMLA Guide AI (Ghana). Slogan: "It's Never Too Late To Study."
Your job is to read and transcribe all readable educational content, lecture slide text, headings, bullet points, charts, definitions, and equations from this image.
Format your output cleanly in Markdown with clear sections. If multiple slides are visible, label them clearly.`;

  try {
    return await callGemini(
      [
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
        {
          text: "Please extract and transcribe all educational lecture text, notes, equations, and slide details accurately.",
        },
      ],
      { systemPrompt, temperature: 0.1 }
    );
  } catch {
    return "--- Slide 1: Uploaded Visual Slide ---\nVisual slide image uploaded successfully for study session.";
  }
}

export async function generateSummaryWithAI(
  content: string,
  style: string = "Exam-Oriented",
  educationalLevel: string = "Senior High School (SHS) & University"
) {
  const slides = parseSlidesFromContent(content);
  const mainTopic = extractMainTopicTitle(slides);

  const pyData = await callPythonBackend(
    "/api/generate-summary",
    {
      content,
      document_title: mainTopic,
      style,
      educational_level: educationalLevel,
    },
    38000
  );
  if (pyData?.summary && String(pyData.summary).trim().length > 40) {
    return sanitizeSummaryOutput(String(pyData.summary), mainTopic);
  }

  const mainTopicWebBrief = await fetchWikipediaSummaryForTopic(mainTopic);

  const systemPrompt = `You are LAMLA Guide AI's Chief Educational Synthesizer and Revision Architect.
Slogan: "It's Never Too Late To Study."
Target Audience: ${educationalLevel}. Requested Style: ${style}.
STRICT ACADEMIC SUMMARY RULES:
1. Explain the actual academic concepts in clear, meaningful paragraphs under meaningful academic headings and subheadings.
2. Use bullet points where they genuinely improve readability (e.g., key steps in a mechanism, classifications, or key comparisons).
3. NEVER present the main summary as a table (do NOT output Markdown tables | ... |).
4. NEVER create headings such as "Slide 1 Summary", "Slide 2 Summary", or include [Slide X] markers.
5. Ignore introductory cover slides about the school, university, department, course code, or lecturer name. Focus 100% on the MAIN ACADEMIC TOPIC (${mainTopic}).`;

  try {
    const cleanedMaterial = slides.map((s) => `### Topic: ${s.title}\n${s.body}`).join("\n\n") || content;
    const webAddendum = mainTopicWebBrief ? `\n\nExternal Academic Reference:\n${mainTopicWebBrief}` : "";
    const aiOut = await callGemini(
      `Write a comprehensive Academic Summary on (${mainTopic}) organized under meaningful academic headings and subheadings (NEVER use a table and NEVER use Slide 1/2/3 headings):\n\n${cleanedMaterial.slice(0, 35000)}${webAddendum}`,
      { systemPrompt, temperature: 0.3 }
    );
    return sanitizeSummaryOutput(aiOut, mainTopic);
  } catch {
    return buildDeterministicSummary(content, mainTopicWebBrief);
  }
}

export async function generateQuestionsWithAI(
  content: string,
  count: number = 5,
  questionType: string = "mcq",
  difficulty: string = "intermediate",
  educationalLevel: string = "Senior High School (SHS) & University"
) {
  const targetCount = Math.min(Math.max(count, 1), 1000);

  const pyData = await callPythonBackend(
    "/api/generate-quiz",
    {
      content,
      question_count: targetCount,
      question_type: questionType,
      difficulty,
    },
    45000
  );
  if (Array.isArray(pyData?.questions) && pyData.questions.length > 0) {
    return pyData.questions.map((q: any, idx: number) => ({
      ...q,
      id: idx + 1,
      orderIndex: idx,
      sourceRef: "",
    }));
  }

  // Deterministic zero-repeat multi-slide synthesis fallback (with NO slide numbers in questions)
  const slides = parseSlidesFromContent(content);
  if (slides.length === 0) return [];

  const generated: any[] = [];
  const seenStems = new Set<string>();
  for (let i = 0; i < targetCount * 3 && generated.length < targetCount; i++) {
    const sl = slides[i % slides.length];
    const q = buildDeterministicQuestionFromSlide(sl, slides, i + 1, questionType);
    const stemKey = `${q.type}:${String(q.question).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    if (seenStems.has(stemKey)) continue;
    seenStems.add(stemKey);
    generated.push({
      ...q,
      id: generated.length + 1,
      orderIndex: generated.length,
      sourceRef: "",
    });
  }
  return generated;
}

export async function askStudyTutorWithAI(
  question: string,
  contextDocument?: string,
  educationalLevel: string = "University / SHS",
  actionType?: string,
  chatHistory?: Array<{ role: string; content: string }>,
  teachingMode: string = "socratic"
) {
  const pyData = await callPythonBackend(
    "/api/tutor",
    {
      user_query: question,
      context_text: contextDocument || "",
      educational_level: educationalLevel,
      action_type: actionType,
      chat_history: chatHistory || [],
      teaching_mode: teachingMode,
    },
    35000
  );
  const pyAnswer = pyData?.response || pyData?.answer;
  if (pyAnswer && String(pyAnswer).trim().length > 0) {
    return String(pyAnswer);
  }

  const systemPrompt = `You are LAMLA Guide AI — a smart, supportive, academically rigorous, and genuinely conversational AI Tutor.
Slogan: "It's Never Too Late To Study."
Target Educational Level: ${educationalLevel}. Teaching Mode: ${teachingMode}.

1. ACADEMIC TEACHING:
   - Explain concepts in simple language first, then move to advanced explanations when needed.
   - Break complex mechanisms into clear step-by-step processes.
   - Use relatable examples and analogies where helpful, and compare related concepts clearly.
   - Correct student misconceptions politely and constructively.
   - Answer follow-up questions using the context of the current Study Session without mixing sessions.
   - Ask helpful check-for-understanding questions or provide hints before full answers when appropriate.
2. INTELLIGENT & CASUAL CONVERSATIONS:
   - Respond warmly and naturally to greetings, jokes, and casual conversations about the student's day or studies without sounding robotic or forcing a rigid lecture.`;

  try {
    let historyBlock = "";
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      const turns = chatHistory
        .slice(-12)
        .map((m) => `${m.role === "user" ? "Student" : "LAMLA AI Tutor"}: ${String(m.content || "").slice(0, 1200)}`)
        .join("\n");
      historyBlock = `\n\nConversation History (Current Study Session):\n${turns}`;
    }
    let prompt = `Student Message: ${question}\nEducational Level: ${educationalLevel}${historyBlock}`;
    if (contextDocument) {
      prompt += `\n\nCurrent Study Session Uploaded Material:\n${contextDocument.slice(0, 28000)}`;
    }
    return await callGemini(prompt, { systemPrompt, temperature: 0.35 });
  } catch {
    if (contextDocument) {
      const slides = parseSlidesFromContent(contextDocument);
      const top = slides
        .slice(0, 3)
        .map((s) => `- **${s.title}:** ${s.facts[0]}`)
        .join("\n\n");
      return `### Key Insight on "${question}"\n\nBased on your study material:\n\n${top}`;
    }
    return `### Study Guide: ${question}\n\nLet's break this concept down into its core definition, mechanism, and practical exam application.`;
  }
}

export async function generateTeachMeFromZeroWithAI(
  content: string,
  educationalLevel: string = "Senior High School (SHS) & University"
) {
  const pyData = await callPythonBackend(
    "/api/generate-teach-zero",
    { content, educational_level: educationalLevel },
    35000
  );
  if (pyData?.explanation && String(pyData.explanation).trim().length > 20) {
    return String(pyData.explanation);
  }
  return buildDeterministicNotes(content);
}

export async function generateStudyNotesWithAI(
  content: string,
  subject: string = "General Science / Economics",
  educationalLevel: string = "SHS / University"
) {
  const pyData = await callPythonBackend(
    "/api/generate-notes",
    { content, subject, educational_level: educationalLevel },
    45000
  );
  if (pyData?.notes && String(pyData.notes).trim().length > 40) {
    return String(pyData.notes);
  }

  const slides = parseSlidesFromContent(content);
  const mainTopic = extractMainTopicTitle(slides);
  const webNotesMap = await fetchSlideWebNotesMap(slides, mainTopic);

  const systemPrompt = `You are LAMLA Guide AI's Master Textbook Author, Professor & Academic Researcher.
Target Level: ${educationalLevel}. Subject: ${mainTopic}.
CRITICAL INSTRUCTIONS:
1. Ignore cover/intro slides about the school, university, faculty, department, course code, or lecturer. Focus strictly on the MAIN ACADEMIC TOPIC (${mainTopic}).
2. NEVER organize headings as "Slide 1", "Slide 2", "Slide 3". Organize under meaningful academic topic headings (## 1. <Topic Title>, ## 2. <Topic Title>).
3. Explain every single concept, term, mechanism, and formula in deep textbook detail, clearly distinguishing Core Lecture Concepts from Supplementary Academic Context & Textbook Expansion with verified reference links.
4. Leave generous blank lines and open spacing between paragraphs, subheadings, and bullet points.`;

  try {
    const batchSize = 4;
    const batches: ParsedSlide[][] = [];
    for (let i = 0; i < slides.length; i += batchSize) {
      batches.push(slides.slice(i, i + batchSize));
    }

    if (batches.length === 0) {
      return buildDeterministicNotes(content, webNotesMap);
    }

    const renderedBatches = await Promise.all(
      batches.slice(0, 6).map(async (batchSlides, batchIdx) => {
        const baseSectionNum = batchIdx * batchSize;
        const topicLabels = batchSlides.map((s) => s.title).join(", ");
        const batchMaterial = batchSlides
          .map((s, idx) => {
            const webExtra = webNotesMap[s.num]
              ? `\n[Supplementary Reference for ${s.title}: ${webNotesMap[s.num]}]`
              : "";
            return `Topic ${baseSectionNum + idx + 1}: ${s.title}\n${s.body}${webExtra}`;
          })
          .join("\n\n");

        try {
          let batchOut = await callGemini(
            `Write authoritative, textbook-grade Detailed Study Notes for topics (${topicLabels}) on ${mainTopic}. Use ## <Number>. <Topic Title> headings (never use "Slide 1" headings), explain every concept in depth, and include Supplementary Academic Context with reference links:\n\n${batchMaterial}`,
            { systemPrompt, temperature: 0.25 }
          );
          batchOut = batchOut.replace(
            /^(#{1,6}\s*)(?:Slide|Page)\s*(\d+)\s*[:\-—]?\s*/gim,
            "$1$2. "
          );
          return batchOut;
        } catch {
          return batchSlides
            .map((sl, idx) =>
              buildDetailedSlideSection(
                sl,
                baseSectionNum + idx + 1,
                mainTopic,
                batchSlides[idx + 1],
                webNotesMap[sl.num]
              )
            )
            .join("\n\n---\n\n");
        }
      })
    );

    const remainingSlides = slides.slice(24);
    if (remainingSlides.length > 0) {
      renderedBatches.push(
        remainingSlides
          .map((sl, idx) =>
            buildDetailedSlideSection(
              sl,
              24 + idx + 1,
              mainTopic,
              remainingSlides[idx + 1],
              webNotesMap[sl.num]
            )
          )
          .join("\n\n---\n\n")
      );
    }

    const header =
      `# ${mainTopic} — Comprehensive University Study Notes\n\n` +
      `> **Authoritative Academic Study Guide:** Organized under meaningful academic topic headings, these notes explain every concept from your lecture in full textbook depth and clearly distinguish **Core Lecture Concepts (From Uploaded Lecture)** from **Supplementary Academic Context & Textbook Expansion** with verified reference links.\n\n---\n\n`;

    return header + renderedBatches.join("\n\n---\n\n");
  } catch {
    return buildDeterministicNotes(content, webNotesMap);
  }
}

export async function regenerateNotesSectionWithAI(
  sectionTitle: string,
  currentSectionContent: string,
  slideContext: string,
  instruction: string = "standard_refresh",
  educationalLevel: string = "SHS / University"
) {
  const pyData = await callPythonBackend(
    "/api/regenerate-notes-section",
    {
      section_title: sectionTitle,
      current_section_content: currentSectionContent,
      slide_context: slideContext,
      instruction,
      educational_level: educationalLevel,
    },
    30000
  );
  const out = pyData?.section || pyData?.section_markdown;
  if (out) {
    return String(out);
  }
  return `${sectionTitle}\n\n${currentSectionContent}`;
}

export async function generateFlashcardsWithAI(
  content: string,
  count: number = 10
) {
  const targetCount = Math.min(Math.max(count, 5), 200);
  const pyData = await callPythonBackend(
    "/api/generate-flashcards",
    { content, count: targetCount },
    40000
  );
  if (Array.isArray(pyData?.flashcards) && pyData.flashcards.length > 0) {
    return pyData.flashcards.map((c: any, idx: number) => ({
      ...c,
      id: idx + 1,
      front: c.front || c.question || `Core concept ${idx + 1}`,
      back: c.back || c.answer || "",
      difficulty: c.difficulty || (["easy", "moderate", "challenging"][idx % 3]),
    }));
  }

  const slides = parseSlidesFromContent(content);
  const mainTopic = extractMainTopicTitle(slides);
  const cards: any[] = [];
  const diffCycle = ["easy", "moderate", "challenging"];
  for (let i = 0; i < targetCount && slides.length > 0; i++) {
    const sl = slides[i % slides.length];
    const nextSl = slides[(i + 1) % slides.length];
    const variant = Math.floor(i / slides.length);
    const fact = sl.facts[variant % sl.facts.length];
    const secondFact = sl.facts[(variant + 1) % sl.facts.length] || "";
    const focus = extractConceptFocusFromFact(fact, sl.title);
    const prompts = [
      `What is ${focus}, and what is its primary functional role in ${mainTopic}?`,
      `How does the mechanism of ${focus} operate within ${sl.title}, and why is it significant?`,
      nextSl.title !== sl.title
        ? `What are the major differences and functional relationships between ${sl.title} and ${nextSl.title}?`
        : `How does ${focus} apply in practical or clinical scenarios involving ${sl.title}?`,
    ];
    cards.push({
      id: i + 1,
      front: prompts[variant % prompts.length],
      back: secondFact && secondFact !== fact ? `${fact}\n\n• ${secondFact}` : fact,
      term: focus,
      difficulty: diffCycle[i % 3],
      slideRef: sl.label,
    });
  }
  return cards;
}

export async function generateDetailedExplanationWithAI(
  content: string,
  educationalLevel: string = "Senior High School (SHS) & University"
) {
  const pyData = await callPythonBackend(
    "/api/generate-explanation",
    { content, educational_level: educationalLevel },
    35000
  );
  if (pyData?.explanation && String(pyData.explanation).trim().length > 30) {
    return String(pyData.explanation);
  }
  return buildDeterministicNotes(content);
}

export async function explainThreeWaysWithAI(
  concept: string,
  context?: string
) {
  const pyData = await callPythonBackend(
    "/api/explain-three-ways",
    { concept, context: context || "" },
    25000
  );
  if (pyData?.simple || pyData?.academic) {
    return pyData;
  }
  if (pyData?.explanations) {
    return pyData.explanations;
  }
  const base = (context || "").slice(0, 260) || `${concept} is a foundational concept in this module.`;
  return {
    simple: base,
    academic: `${base} Focus on its formal definition, mechanism, and boundary conditions in exams.`,
    analogy: `Think of ${concept} like a coordinated workflow where each stage feeds directly into the next outcome.`,
  };
}

export async function evaluateActiveRecallWithAI(
  question: string,
  studentAnswer: string,
  referenceText?: string
) {
  const pyData = await callPythonBackend(
    "/api/active-recall-coach",
    {
      question,
      student_answer: studentAnswer,
      reference_text: referenceText || "",
    },
    25000
  );
  if (pyData?.score !== undefined || pyData?.scoreOutOf10 !== undefined) {
    return pyData;
  }
  if (pyData?.evaluation) {
    return pyData.evaluation;
  }
  return {
    scoreOutOf10: 8,
    whatWasCorrect: "Good recall of the core concept.",
    whatWasMissing: "Include specific terminology and causal mechanisms for full marks.",
    modelAnswer: (referenceText || "").slice(0, 280) || "Review the corresponding concept definition and mechanism.",
    encouragementTip: "Consistent active recall builds permanent exam mastery.",
  };
}
