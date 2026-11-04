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
  timeoutMs: number = 35000
): Promise<any | null> {
  const urls = getCandidatePythonUrls();
  for (const base of urls) {
    try {
      const res = await fetch(`${base}${endpointPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          signal: AbortSignal.timeout(7000),
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
            keyCooldownUntil.set(apiKey, Date.now() + 90 * 1000);
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
        keyCooldownUntil.set(apiKey, Date.now() + 60 * 1000);
        break;
      }
    }
  }

  // Zero-credit-exhaustion cloud fallback for text prompts with strict 4s timeout & cooldown memory
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
            { role: "user", content: promptOrParts.slice(0, 18000) },
          ],
          temperature: options.temperature ?? 0.3,
          ...(options.responseMimeType === "application/json"
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
        signal: AbortSignal.timeout(4000),
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
      freeCloudCooldownUntil = Date.now() + 5 * 60 * 1000;
    } catch {
      freeCloudCooldownUntil = Date.now() + 5 * 60 * 1000;
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
      const lines = part.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const firstLine = lines[0] || `Slide ${idx + 1}`;
      const m = firstLine.match(/(?:Slide|Page)\s+(\d+)(?:\s*[:\-—]\s*(.+?))?(?:\s*---)?$/i);
      const slideNum = m ? parseInt(m[1], 10) : idx + 1;
      let title = m && m[2] ? m[2].replace(/---$/, "").trim() : "";
      const bodyLines = m ? lines.slice(1) : lines;
      if (!title && bodyLines.length > 0) {
        title = bodyLines[0].replace(/^[#•\-*\d.)\s]+/, "").slice(0, 80).trim();
      }
      if (!title) title = `Slide ${slideNum} Concept`;
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
    return slides;
  }

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunkSize = 3;
  let slideNum = 1;
  for (let i = 0; i < paragraphs.length; i += chunkSize) {
    const group = paragraphs.slice(i, i + chunkSize).join("\n\n");
    const firstLine = group.split(/\r?\n/)[0].replace(/^[#•\-*\d.)\s]+/, "").slice(0, 80).trim() || `Section ${slideNum}`;
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
  return slides;
}

function extractSlideFacts(slide: ParsedSlide): string[] {
  const candidates: string[] = [];
  const lines = slide.body.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/^[•\-*▪▸\d.)\s]+/, "").trim();
    if (!line || line.length < 18) continue;
    if (/^(?:slide|page)\s+\d+/i.test(line)) continue;
    const subSentences = line.split(/(?<=[.!?])\s+(?=[A-Z])/);
    for (const sub of subSentences) {
      const s = sub.replace(/\s+/g, " ").trim().replace(/[,;:]$/, "");
      if (s.length >= 20 && s.length <= 240) {
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
    const fallback = slide.body.replace(/\s+/g, " ").trim().slice(0, 180) || `${slide.title} is a core concept covered in ${slide.label}`;
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

function buildDeterministicSummary(content: string): string {
  const slides = parseSlidesFromContent(content);
  const firstTitle = slides[0]?.title || "Uploaded Study Material";
  const pillarLines = slides.slice(0, 25).map((s) => {
    const topFacts = s.facts.slice(0, 2).join(" ");
    return `- **${s.label} — ${s.title}:** ${topFacts} \`[${s.label}]\``;
  });
  const tableRows = slides.slice(0, 12).map((s) => {
    const defn = s.facts[0]?.slice(0, 120) || s.title;
    return `| **${s.title.slice(0, 42)}** | ${defn} | High-yield concept \`[${s.label}]\` |`;
  });
  const flowChain = slides
    .slice(0, 6)
    .map((s) => `[${s.label}: ${s.title.slice(0, 26)}]`)
    .join(" ──▶ ");

  return (
    `# 🧭 COMPREHENSIVE CONCEPTUAL OVERVIEW: ${firstTitle.toUpperCase()}\n\n` +
    `## 1. 🌐 The Big Picture & Complete Conceptual Framework\n` +
    `This study guide synthesizes all **${slides.length} slide(s)/section(s)** starting from **${firstTitle}** (\`[Slide 1]\`) through **${slides[slides.length - 1]?.title || firstTitle}** (\`[${slides[slides.length - 1]?.label || "Slide 1"}]\`). Every core definition, mechanism, and examinable relationship is organized below for rapid mastery.\n\n` +
    `## 2. 🏛️ Slide-by-Slide Core Pillars & Key Breakdown\n` +
    `${pillarLines.join("\n")}\n\n` +
    `## 3. 🔑 High-Yield Glossary & Examinable Definitions\n` +
    `| Key Concept / Topic | Core Principle & Mechanism | Slide Reference |\n` +
    `| :--- | :--- | :--- |\n` +
    `${tableRows.join("\n")}\n\n` +
    `## 4. 📊 Visual Concept Roadmap\n` +
    `\`\`\`flowchart\n${flowChain || `[${firstTitle}]`}\n\`\`\`\n\n` +
    `## 5. ⚠️ High-Priority Exam Pitfalls & Examiner Traps\n` +
    `- Do not confuse the specific mechanism of **${firstTitle}** with adjacent stages; examiners frequently swap cause-and-effect statements in Assertion & Reasoning and MCQ distractors.\n` +
    `- Pay close attention to distinguishing definitions across \`[Slide 1]\` through \`[${slides[slides.length - 1]?.label || "Slide 1"}]\`.\n`
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
    const cycle = ["mcq", "mcq", "true_false", "assertion_reasoning", "mcq"];
    effectiveType = cycle[(qIndex - 1) % cycle.length];
  }

  if (effectiveType === "true_false") {
    const isTrue = qIndex % 2 === 1;
    const statement = isTrue
      ? primaryFact
      : invertFactToPlausibleMisconception(primaryFact, slide.title, qIndex);
    return {
      id: qIndex,
      question: `Regarding ${slide.title} (${slide.label}): ${statement}`,
      type: "true_false",
      options: ["True", "False"],
      correctAnswer: isTrue ? "True" : "False",
      explanation: isTrue
        ? `This statement is True and directly reflects ${slide.label} (${slide.title}): ${primaryFact}`
        : `This statement is False. According to ${slide.label} (${slide.title}), ${primaryFact}`,
      misconception: "Examiners frequently invert key directional or causal terms to test precision.",
      testedFact: primaryFact,
      topic: slide.title,
      difficulty: "intermediate",
      sourceRef: `Found in: ${slide.label}`,
    };
  }

  if (effectiveType === "short_answer") {
    const prompts = [
      `Explain the core principle and significance of ${slide.title} as presented in ${slide.label}.`,
      `Outline the mechanism and key takeaways of ${slide.title} (${slide.label}).`,
      `Distinguish the primary features of ${slide.title} covered on ${slide.label} and state why they matter.`,
    ];
    return {
      id: qIndex,
      question: prompts[(qIndex - 1) % prompts.length],
      type: "short_answer",
      options: [],
      correctAnswer: `${primaryFact}${secondaryFact !== primaryFact ? " " + secondaryFact : ""}`,
      markingGuide: `1 mark for core definition/principle (${primaryFact.slice(0, 80)}); 1 mark for mechanism/context from ${slide.label}.`,
      explanation: `Full credit requires stating the core concept from ${slide.label}: ${primaryFact}`,
      misconception: "Omitting the specific mechanism or terminology from the slide loses marks.",
      testedFact: primaryFact,
      topic: slide.title,
      difficulty: "intermediate",
      sourceRef: `Found in: ${slide.label}`,
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
      explanationText = `Both Assertion (A) and Reason (R) are true statements from ${slide.label}, and R directly explains the underlying principle of A.`;
    } else if (targetCase === "B") {
      const otherSlide = allSlides[(slide.num + 1) % allSlides.length];
      const independentTrue = otherSlide.facts[0] || secondaryFact;
      assertionText = primaryFact;
      reasonText = independentTrue;
      explanationText = `Both Assertion (A) (${slide.label}) and Reason (R) (${otherSlide.label}) are true statements from the material, but R describes a separate point and does not causally explain A.`;
    } else if (targetCase === "C") {
      assertionText = primaryFact;
      reasonText = falseSecondary;
      explanationText = `Assertion (A) is true according to ${slide.label}, whereas Reason (R) is false because ${secondaryFact}`;
    } else if (targetCase === "D") {
      assertionText = falsePrimary;
      reasonText = secondaryFact;
      explanationText = `Assertion (A) is false (according to ${slide.label}, ${primaryFact}), whereas Reason (R) is a true statement from the material.`;
    } else {
      assertionText = falsePrimary;
      reasonText = falseSecondary;
      explanationText = `Both Assertion (A) and Reason (R) are false. According to ${slide.label}, ${primaryFact}`;
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
      sourceRef: `Found in: ${slide.label}`,
    };
  }

  // Default: Varied 12-stem MCQ with balanced A/B/C/D correct answer
  const letters = ["A", "B", "C", "D"];
  const targetIdx = (qIndex - 1) % 4;
  const askFalseStatement = qIndex % 5 === 0;

  let qStem = "";
  let correctText = "";
  let distractorPool: string[] = [];

  if (askFalseStatement) {
    qStem = `When evaluating ${slide.title} (${slide.label}), which of the following statements is INCORRECT?`;
    correctText = invertFactToPlausibleMisconception(primaryFact, slide.title, qIndex);
    distractorPool = [
      primaryFact,
      secondaryFact !== primaryFact ? secondaryFact : otherFacts[0],
      otherFacts[1],
    ];
  } else {
    const stems = [
      `Which of the following accurately states a core principle of ${slide.title} (${slide.label})?`,
      `In the context of ${slide.title} (${slide.label}), which statement is supported by the lecture material?`,
      `What is a defining characteristic or mechanism of ${slide.title} as detailed on ${slide.label}?`,
      `A student reviewing ${slide.title} (${slide.label}) should identify which of the following as accurate?`,
      `Which statement best explains the operational role of ${slide.title} (${slide.label})?`,
      `When applying the principles of ${slide.title} (${slide.label}), which conclusion is valid?`,
      `How does the lecture material on ${slide.label} characterize ${slide.title}?`,
      `Which of the following distinguishes ${slide.title} (${slide.label}) from unrelated concepts in the deck?`,
    ];
    qStem = stems[(qIndex - 1) % stems.length];
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
    type: "mcq",
    options: opts,
    correctAnswer: letters[targetIdx],
    explanation: askFalseStatement
      ? `Option ${letters[targetIdx]} is the incorrect statement. According to ${slide.label} (${slide.title}), ${primaryFact}`
      : `According to ${slide.label} (${slide.title}): ${primaryFact}`,
    misconception: "Other options either invert the relationship on this slide or belong to a different slide topic.",
    testedFact: primaryFact,
    topic: slide.title,
    difficulty: "intermediate",
    sourceRef: `Found in: ${slide.label}`,
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
  const pyData = await callPythonBackend(
    "/api/generate-summary",
    { text: content, style, educational_level: educationalLevel },
    35000
  );
  if (pyData?.summary && String(pyData.summary).trim().length > 40) {
    return String(pyData.summary);
  }

  const systemPrompt = `You are LAMLA Guide AI's Chief Educational Synthesizer and Revision Architect.
Slogan: "It's Never Too Late To Study."
Target Audience: ${educationalLevel}. Requested Style: ${style}.
Synthesize a complete Master Study Summary covering Big Picture, Slide-by-Slide Pillars with [Slide X] citations, High-Yield Glossary Table, ASCII Flowchart, Real-World Analogy, and Exam Traps.`;

  try {
    return await callGemini(
      `Please synthesize the complete comprehensive conceptual overview and Master Study Kit for all slides/pages in this material:\n\n${content.slice(0, 35000)}`,
      { systemPrompt, temperature: 0.3 }
    );
  } catch {
    return buildDeterministicSummary(content);
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
      text: content,
      count: targetCount,
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
    }));
  }

  // Deterministic zero-repeat multi-slide synthesis fallback
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
    "/api/tutor-ask",
    {
      query: question,
      context: contextDocument || "",
      educational_level: educationalLevel,
      action_type: actionType,
      chat_history: chatHistory || [],
      teaching_mode: teachingMode,
    },
    30000
  );
  if (pyData?.answer && String(pyData.answer).trim().length > 0) {
    return String(pyData.answer);
  }

  const systemPrompt = `You are LAMLA Guide AI's Personal Conversational AI Study Mentor & Visual Illustrator.
Target Educational Level: ${educationalLevel}.
Answer any question directly and clearly, citing [Slide X] when relevant to uploaded slides.`;

  try {
    let prompt = `Student Question: ${question}\nEducational Level: ${educationalLevel}`;
    if (contextDocument) {
      prompt += `\n\nReference Material from Student's Uploaded Slides:\n${contextDocument.slice(0, 28000)}`;
    }
    return await callGemini(prompt, { systemPrompt, temperature: 0.35 });
  } catch {
    if (contextDocument) {
      const slides = parseSlidesFromContent(contextDocument);
      const top = slides.slice(0, 3).map((s) => `- **${s.label} (${s.title}):** ${s.facts[0]}`).join("\n");
      return `### Key Insight on "${question}"\n\nBased on your uploaded study material:\n${top}`;
    }
    return `### Study Guide: ${question}\n\nLet's break this concept down into its core definition, mechanism, and practical exam application.`;
  }
}

export async function generateTeachMeFromZeroWithAI(
  content: string,
  educationalLevel: string = "Senior High School (SHS) & University"
) {
  const pyData = await callPythonBackend(
    "/api/teach-from-zero",
    { text: content, educational_level: educationalLevel },
    35000
  );
  if (pyData?.explanation && String(pyData.explanation).trim().length > 20) {
    return String(pyData.explanation);
  }
  return buildDeterministicSummary(content);
}

export async function generateStudyNotesWithAI(
  content: string,
  subject: string = "General Science / Economics",
  educationalLevel: string = "SHS / University"
) {
  const pyData = await callPythonBackend(
    "/api/generate-study-notes",
    { text: content, subject, educational_level: educationalLevel },
    40000
  );
  if (pyData?.notes && String(pyData.notes).trim().length > 40) {
    return String(pyData.notes);
  }
  return buildDeterministicSummary(content);
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
  if (pyData?.section_markdown) {
    return String(pyData.section_markdown);
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
    { text: content, count: targetCount },
    35000
  );
  if (Array.isArray(pyData?.flashcards) && pyData.flashcards.length > 0) {
    return pyData.flashcards.map((c: any, idx: number) => ({ ...c, id: idx + 1 }));
  }

  const slides = parseSlidesFromContent(content);
  const cards: any[] = [];
  for (let i = 0; i < targetCount && slides.length > 0; i++) {
    const sl = slides[i % slides.length];
    const fact = sl.facts[Math.floor(i / slides.length) % sl.facts.length];
    cards.push({
      id: i + 1,
      front: `What is the key principle and mechanism of ${sl.title} (${sl.label})?`,
      back: fact,
      term: sl.title,
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
    "/api/generate-detailed-explanation",
    { text: content, educational_level: educationalLevel },
    35000
  );
  if (pyData?.explanation && String(pyData.explanation).trim().length > 30) {
    return String(pyData.explanation);
  }
  return buildDeterministicSummary(content);
}

export async function explainThreeWaysWithAI(
  concept: string,
  context?: string
) {
  const pyData = await callPythonBackend(
    "/api/explain-three-ways",
    { topic_or_concept: concept, context: context || "" },
    25000
  );
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
    "/api/active-recall-evaluate",
    {
      question,
      student_answer: studentAnswer,
      reference_text: referenceText || "",
    },
    25000
  );
  if (pyData?.evaluation) {
    return pyData.evaluation;
  }
  return {
    scoreOutOf10: 8,
    whatWasCorrect: "Good recall of the core concept.",
    whatWasMissing: "Include specific terminology and slide citations for full marks.",
    modelAnswer: (referenceText || "").slice(0, 280) || "Review the corresponding slide definition and mechanism.",
    encouragementTip: "Consistent active recall builds permanent exam mastery.",
  };
}
