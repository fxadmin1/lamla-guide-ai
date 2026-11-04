import "server-only";

const GEMINI_API_KEYS = (process.env.GEMINI_API_KEY || "AIzaSyAeEcyHo4mNkGaBYQnw1BSDCASSWwqY1aM")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);
const RAW_ENV_MODEL = (process.env.GEMINI_MODEL || "").trim();
const VALID_FAST_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-1.5-flash",
];
let preferredGeminiModel: string | null = null;
const deadGeminiModels = new Set<string>();
const keyCooldownUntil = new Map<string, number>();
let freeCloudCooldownUntil = 0;

interface GenerateContentOptions {
  systemPrompt?: string;
  temperature?: number;
  responseMimeType?: string;
}

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64 encoded string without data:image/png;base64, prefix
  };
}

export async function callGemini(
  promptOrParts: string | GeminiPart[],
  options: GenerateContentOptions = {}
) {
  const baseModels =
    RAW_ENV_MODEL && !/3\.[156]/.test(RAW_ENV_MODEL) && !VALID_FAST_MODELS.includes(RAW_ENV_MODEL)
      ? [RAW_ENV_MODEL, ...VALID_FAST_MODELS]
      : [...VALID_FAST_MODELS];

  const candidateModels = [
    ...(preferredGeminiModel && !deadGeminiModels.has(preferredGeminiModel) ? [preferredGeminiModel] : []),
    ...baseModels.filter((m) => m !== preferredGeminiModel && !deadGeminiModels.has(m)),
  ];

  const parts: any[] = typeof promptOrParts === "string"
    ? [{ text: promptOrParts }]
    : promptOrParts.map(p => {
        if (p.inlineData) {
          return {
            inline_data: {
              mime_type: p.inlineData.mimeType,
              data: p.inlineData.data,
            }
          };
        }
        return { text: p.text || "" };
      });

  let lastError: any = null;
  const now = Date.now();

  for (const apiKey of GEMINI_API_KEYS) {
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
          signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
          if (response.status === 404) {
            deadGeminiModels.add(model);
            continue;
          }
          if (response.status === 400 || response.status === 401 || response.status === 403) {
            keyCooldownUntil.set(apiKey, Date.now() + 15 * 60 * 1000);
            lastError = new Error(`Gemini key unavailable (${response.status}) on ${model}`);
            break;
          }
          if (response.status === 429) {
            keyCooldownUntil.set(apiKey, Date.now() + 90 * 1000);
            lastError = new Error(`Gemini quota (${response.status}) on ${model}`);
            break;
          }
          const errorText = await response.text();
          lastError = new Error(`Gemini API error (${response.status}) on ${model}: ${errorText.slice(0, 120)}`);
          break;
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          preferredGeminiModel = model;
          return text;
        }
      } catch (err) {
        keyCooldownUntil.set(apiKey, Date.now() + 60 * 1000);
        lastError = err;
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

  throw lastError || new Error("All AI providers failed to generate content.");
}

function cleanJsonResponse(raw: string): any {
  const cleaned = raw.trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const withoutFences = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      return JSON.parse(withoutFences);
    } catch {
      // Regex search for array [ ... ]
      const arrayMatch = withoutFences.match(/(\[[\s\S]*\])/);
      if (arrayMatch) {
        try {
          return JSON.parse(arrayMatch[1]);
        } catch {
          // ignore
        }
      }
      // Regex search for object { ... }
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

export async function extractTextFromImageWithAI(
  imageBase64: string,
  mimeType: string = "image/jpeg"
) {
  const systemPrompt = `You are an expert academic slide and document extractor for LAMLA Guide AI (Ghana). Slogan: "It's Never Too Late To Study."
Your job is to read and transcribe all readable educational content, lecture slide text, headings, bullet points, charts, definitions, and equations from this image.
Format your output cleanly in Markdown with clear sections. If multiple slides are visible, label them clearly.`;

  return callGemini([
    {
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    },
    {
      text: "Please extract and transcribe all educational lecture text, notes, equations, and slide details accurately.",
    },
  ], { systemPrompt, temperature: 0.1 });
}

// ─────────────────────────────────────────────────────────────
// 1. THEASTUDY-GRADE MASTER STUDY SUMMARY (DEEP & COMPREHENSIVE)
// ─────────────────────────────────────────────────────────────
export async function generateSummaryWithAI(
  content: string,
  style: string = "Exam-Oriented",
  educationalLevel: string = "Senior High School (SHS) & University"
) {
  const systemPrompt = `You are LAMLA Guide AI's Chief Educational Synthesizer and Revision Architect.
Slogan: "It's Never Too Late To Study."
Purpose: COMPREHENSIVE CONCEPTUAL OVERVIEW & HIGH-YIELD REVISION SUMMARY.
Target Audience: ${educationalLevel} students in Ghana.
Requested Style: ${style}.

CORE PEDAGOGICAL MANDATE:
1. GATHER THE WHOLE CONCEPT: Synthesize the complete overarching idea, thesis, and conceptual framework across all slides or images from start to finish. A student must immediately grasp what the entire lecture is fundamentally about, how all subtopics connect together into one unified picture, and why it matters.
2. CRISP & ACCESSIBLE: Break down complex terminology into clear, accessible language without omitting essential academic rigour, formulas, or slide citations.
3. AIRY, ATTRACTIVE FORMATTING: Use generous spacing between paragraphs, clean bullet points, distinct headings, and structured comparison tables so the text breathes and looks beautiful to read.

REQUIRED MASTER STUDY KIT STRUCTURE:
# 🧭 COMPREHENSIVE CONCEPTUAL OVERVIEW: THE COMPLETE PICTURE

## 1. 🌐 The Big Picture & Complete Conceptual Framework
- In 2-3 engaging, well-spaced paragraphs, explain the overarching concept and unified narrative of these slides/images from beginning to end.
- What fundamental problem or question does this material address? How does the first slide connect to the final slide?

## 2. 🏛️ Core Pillars & Key Thematic Breakdown
- Break down the 3-5 foundational pillars that make up this entire topic.
- Explain each pillar concisely with slide references (e.g. \`[Slide 3]\`) and open, airy bullet points.

## 3. 🔑 High-Yield Glossary & Examinable Definitions (Quick Reference Table)
- Structured Markdown table:
| Key Term / Formula / Law | Core Definition & Practical Role | Exam Tip & Slide Reference |

## 4. 📊 Visual Concept Diagram & Process Roadmap
- Provide a clean ASCII flowchart inside a \`\`\`flowchart code block illustrating the overarching workflow, cycle, hierarchy, or step-by-step mechanism:
\`\`\`flowchart
[Input / Primary Concept] ---> [Key Mechanism / Transform] ---> [Outcome / Real-World Implication]
\`\`\`

## 5. 💡 Intuitive Real-World Analogy
- Provide a memorable, relatable analogy (drawn from everyday intuition or Ghanaian life where suitable) that makes the whole concept instantly intuitive.

## 6. ⚠️ High-Priority Exam Pitfalls & Examiner Traps
- Highlight the exact traps examiners set (in WASSCE, semester exams, or licensure) and common mistakes students make.

## 7. 🚀 60-Second Rapid Review Checkpoints
- 5 quick self-test questions with 1-sentence model answers to test complete understanding.

Format with clean Markdown bolding, tables, generous paragraph breaks, and clear headings.`;

  const userPrompt = `Please synthesize the complete comprehensive conceptual overview and Master Study Kit for all slides/pages in this material:\n\n${content}`;
  return callGemini(userPrompt, { systemPrompt, temperature: 0.3 });
}

// ─────────────────────────────────────────────────────────────
// 2. BLOOM'S TAXONOMY QUESTION GENERATION ENGINE (UP TO 150 QS)
// ─────────────────────────────────────────────────────────────
async function generateQuestionsBatch(
  content: string,
  count: number,
  questionType: string,
  difficulty: string,
  educationalLevel: string,
  startIndex: number
): Promise<any[]> {
  let typeInstructions = "";
  if (questionType === "true_false") {
    typeInstructions = `True/False statements testing conceptual accuracy.
options: ["True", "False"].
correctAnswer: "True" or "False".`;
  } else if (questionType === "short_answer") {
    typeInstructions = `Short answer questions requiring structured explanation or calculation.
options: [].
correctAnswer: Model concise answer (2-3 sentences or formula).
markingGuide: Explicit mark breakdown (e.g., '1 mark for identifying X, 1 mark for calculating Y').`;
  } else if (questionType === "assertion_reasoning") {
    typeInstructions = `Assertion–Reasoning Examination Questions:
Every question MUST feature an Assertion statement (A) and a Reason statement (R).
Question text format:
Assertion (A): [Statement]
Reason (R): [Statement]

options: Exactly 5 standardized options strictly in this order:
[
  "A. Both Assertion (A) and Reason (R) are true, and Reason (R) is the correct explanation of Assertion (A).",
  "B. Both Assertion (A) and Reason (R) are true, but Reason (R) is NOT the correct explanation of Assertion (A).",
  "C. Assertion (A) is true, but Reason (R) is false.",
  "D. Assertion (A) is false, but Reason (R) is true.",
  "E. Both Assertion (A) and Reason (R) are false."
]
correctAnswer: Strictly the single letter "A", "B", "C", "D", or "E".
Include:
- "assertion": Statement for Assertion (A)
- "reason": Statement for Reason (R)
- "explanation": Complete rationale explaining the truth value of A and R and whether R causally explains A.`;
  } else if (questionType in ["mixed", "exhaustive"]) {
    typeInstructions = `EXHAUSTIVE MULTI-FORMAT SLIDE CONTENT DRILL ENGINE:
You must extract the examinable information directly from the provided material and test every critical statement:
- Definitions, terms, and meanings
- Every important statement, bullet point, fact, and number
- Classifications, types, functions, and properties
- Mechanisms, steps, sequences, and stages
- Comparisons, differences, and exceptions
- Tables, diagram annotations, and labels

Generate a varied, high-yield mixture across these direct formats:
1. "true_false": Conceptual True/False statements testing accuracy (options: ["True", "False"], correctAnswer: "True" or "False").
2. "mcq": Multiple Choice Questions testing core facts with 4 plausible distractors representing real student traps (options: ["A. ...", "B. ...", "C. ...", "D. ..."], correctAnswer: "A"|"B"|"C"|"D").
3. "assertion_reasoning": Assertion (A) and Reason (R) testing causal reasoning (5 options A-E, correctAnswer: "A"|"B"|"C"|"D"|"E").
4. "fill_in_the_blank": Direct recall with key term or phrase missing as '_______' (options: 4 choices, correctAnswer: "A"|"B"|"C"|"D").
5. "direct_recall": Direct questions testing specific bullet points, functions, or facts.
6. "list_enumeration": Questions testing components, types, or items in a list.
7. "sequence_ordering": Testing chronological steps or process order.
8. "comparison": Testing differences between concepts on the slide.

CRITICAL: Every question MUST include:
- "testedFact": The exact fact, statement, or bullet point from the slide tested.
- "sourceRef": Exact slide or page reference (e.g. "Found in: Slide 3").
- "explanation": Concise pedagogical explanation.
- "misconception": Distractor trap or examiner pitfall.`;
  } else {
    typeInstructions = `Multiple Choice Questions (MCQs):
options: Exactly 4 plausible options labeled ["A. ...", "B. ...", "C. ...", "D. ..."].
correctAnswer: Strictly the single letter "A", "B", "C", or "D".
CRITICAL DISTRACTOR RULE:
Every incorrect option (distractor) MUST represent a real, plausible student mistake, calculation error, or common misconception.
Do NOT use 'None of the above', 'All of the above', or absurd joke choices.`;
  }

  const typeSchemaVal = (questionType === "mixed" || questionType === "exhaustive") ? '"true_false" or "mcq" or "assertion_reasoning" or "fill_in_the_blank" or "direct_recall"' : `"${questionType}"`;

  const systemPrompt = `You are LAMLA Guide AI's Rapid Examination Engine.
Slogan: "It's Never Too Late To Study."
Target Audience: ${educationalLevel} students in Ghana.
Difficulty: ${difficulty}.
Question Type: ${questionType}.

BLOOM'S COGNITIVE TAXONOMY:
Ensure a balanced mix of Recall, Understanding, and Application.

${typeInstructions}

EXPLANATION MANDATE (FAST & HIGH-YIELD):
Keep explanations sharp, educational, and quick to read (2-3 sentences total):
- "explanation": 1-2 concise sentences explaining why the correct answer is right and the underlying principle.
- "misconception": 1 concise sentence highlighting the common distractor trap or misconception students fall into.
- "testedFact": The exact slide statement, definition, or bullet point tested.
- "sourceRef": Exact slide or section reference (e.g. "Found in: Slide 12").

Respond ONLY with a valid JSON array of objects without markdown fences.
Schema:
[
  {
    "id": ${startIndex},
    "question": "Clear, academically rigorous question...",
    "type": ${typeSchemaVal},
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correctAnswer": "A",
    "markingGuide": "Marking scheme (if short answer)",
    "explanation": "Core pedagogical principle...",
    "misconception": "Common student pitfall or distractor trap...",
    "testedFact": "Photosynthesis produces glucose and oxygen from carbon dioxide and water",
    "topic": "Core topic name",
    "difficulty": "${difficulty}",
    "cognitiveLevel": "Application",
    "sourceRef": "Found in: Slide 12"
  }
]`;

  const promptTypeDesc = (questionType === "mixed" || questionType === "exhaustive") ? "an exhaustive mix of True/False, Multiple Choice, and Direct Recall questions" : `${questionType} questions`;
  const userPrompt = `Generate ${count} distinct ${difficulty} ${promptTypeDesc} strictly from this study material (starting numbering at ${startIndex}):\n\n${content}`;

  const jsonText = await callGemini(userPrompt, {
    systemPrompt,
    temperature: 0.25,
    responseMimeType: "application/json",
  });

  const parsed = cleanJsonResponse(jsonText);
  if (Array.isArray(parsed)) {
    // Balanced target placement across A, B, C, D
    const targetIndices = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];
    for (let j = targetIndices.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [targetIndices[j], targetIndices[k]] = [targetIndices[k], targetIndices[j]];
    }

    const standardArOptions = [
      "A. Both Assertion (A) and Reason (R) are true, and Reason (R) is the correct explanation of Assertion (A).",
      "B. Both Assertion (A) and Reason (R) are true, but Reason (R) is NOT the correct explanation of Assertion (A).",
      "C. Assertion (A) is true, but Reason (R) is false.",
      "D. Assertion (A) is false, but Reason (R) is true.",
      "E. Both Assertion (A) and Reason (R) are false."
    ];

    return parsed.map((q, idx) => {
      const isAR = q.type === "assertion_reasoning" || questionType === "assertion_reasoning";
      const isTF = !isAR && (q.type === "true_false" || (Array.isArray(q.options) && q.options.length === 2));
      const isMCQ = !isAR && !isTF && (questionType in ["mcq", "mixed", "exhaustive"] || q.type === "mcq") && Array.isArray(q.options) && q.options.length === 4;

      if (isAR) {
        q.type = "assertion_reasoning";
        q.options = standardArOptions;
        const caMatch = String(q.correctAnswer || "A").trim().match(/^([A-E])/i);
        q.correctAnswer = caMatch ? caMatch[1].toUpperCase() : "A";
      } else if (isTF) {
        q.type = "true_false";
        q.options = ["True", "False"];
        const caRaw = String(q.correctAnswer || "True").trim().toLowerCase();
        q.correctAnswer = caRaw.includes("f") ? "False" : "True";
      } else if (isMCQ) {
        const letters = ["A", "B", "C", "D"];
        const prefixes = ["A. ", "B. ", "C. ", "D. "];
        const rawOpts = q.options.map((opt: any) => String(opt || "").replace(/^[A-D][\.\)]\s*/i, "").trim());
        
        const caMatch = String(q.correctAnswer || "A").trim().match(/^([A-D])/i);
        const caLetter = caMatch ? caMatch[1].toUpperCase() : "A";
        const caIdx = Math.max(0, letters.indexOf(caLetter));
        const correctOptText = rawOpts[caIdx] || rawOpts[0];

        let distractors = rawOpts.filter((_: string, j: number) => j !== caIdx);
        if (distractors.length < 3) {
          distractors = rawOpts.filter((opt: string) => opt !== correctOptText);
        }
        for (let j = distractors.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [distractors[j], distractors[k]] = [distractors[k], distractors[j]];
        }

        const targetIdx = targetIndices[idx % targetIndices.length];
        const newOpts: string[] = new Array(4);
        newOpts[targetIdx] = correctOptText;
        let dPtr = 0;
        for (let k = 0; k < 4; k++) {
          if (!newOpts[k]) {
            newOpts[k] = distractors[dPtr] || `Option ${letters[k]}`;
            dPtr++;
          }
        }

        q.type = "mcq";
        q.correctAnswer = letters[targetIdx];
        q.options = newOpts.map((optText: string, i: number) => prefixes[i] + optText);
      } else if (Array.isArray(q.options) && q.options.length > 0) {
        const caMatch = String(q.correctAnswer || "A").trim().match(/^([A-E])/i);
        if (caMatch) {
          q.correctAnswer = caMatch[1].toUpperCase();
        }
      }
      return {
        ...q,
        id: startIndex + idx,
        orderIndex: startIndex + idx - 1,
      };
    });
  }
  return [];
}

export async function generateQuestionsWithAI(
  content: string,
  count: number = 5,
  questionType: string = "mcq", // 'mcq', 'true_false', 'short_answer'
  difficulty: string = "intermediate", // 'easy', 'intermediate', 'difficult'
  educationalLevel: string = "Senior High School (SHS) & University"
) {
  // Supports large question banks up to 1000 questions based on user selection
  const targetCount = Math.min(Math.max(count, 1), 1000);

  // If 25 or fewer, generate in a single prompt
  if (targetCount <= 25) {
    const qs = await generateQuestionsBatch(content, targetCount, questionType, difficulty, educationalLevel, 1);
    return qs.map((q, idx) => ({ ...q, id: idx + 1, orderIndex: idx }));
  }

  // If > 25, batch generate in chunks of 25 to avoid LLM token truncation
  const batchSize = 25;
  const numBatches = Math.ceil(targetCount / batchSize);
  const allQuestions: any[] = [];

  for (let i = 0; i < numBatches; i++) {
    const currentCount = Math.min(batchSize, targetCount - allQuestions.length);
    if (currentCount <= 0) break;
    const batch = await generateQuestionsBatch(
      content,
      currentCount,
      questionType,
      difficulty,
      educationalLevel,
      allQuestions.length + 1
    );
    allQuestions.push(...batch);
  }

  return allQuestions.slice(0, targetCount).map((q, idx) => ({
    ...q,
    id: idx + 1,
    orderIndex: idx,
  }));
}

async function fetchAcademicContext(query: string): Promise<string | null> {
  try {
    const cleaned = query.replace(/[^a-zA-Z0-9\s]/g, "").trim();
    const tokens = cleaned.split(/\s+/).slice(0, 4);
    if (!tokens.length) return null;
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(tokens.join("_"))}`;
    const res = await fetch(url, { headers: { "User-Agent": "LAMLAGuideAI/1.0 (academic-tutor)" } });
    if (res.ok) {
      const data = await res.json();
      if (data.extract) {
        return `Authoritative External Academic Reference (${data.title}): ${data.extract}`;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function askStudyTutorWithAI(
  question: string,
  contextDocument?: string,
  educationalLevel: string = "University / SHS",
  actionType?: string,
  chatHistory?: Array<{ role: string; content: string }>,
  teachingMode: string = "socratic"
) {
  const casualGreetings = new Set(["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "how are you", "who are you", "thanks", "thank you", "ok", "okay", "cool", "great", "nice"]);
  const cleanQ = question.trim().toLowerCase();
  const isCasual = casualGreetings.has(cleanQ) || (cleanQ.split(/\s+/).length <= 2 && ["what's up", "help me", "start"].includes(cleanQ));

  let academicRef = "";
  if (!isCasual) {
    const ref = await fetchAcademicContext(question);
    if (ref) {
      academicRef = `\n\n${ref}`;
    }
  }

  const actionInstructions: Record<string, string> = {
    explain_simply: "The student clicked 'Explain Simply'. Focus extra heavily on crystal-clear intuitive analogies without heavy academic jargon.",
    step_by_step: "The student clicked 'Explain Step by Step'. Provide a thorough, chronological breakdown of each phase/step.",
    give_example: "The student clicked 'Give an Example'. Provide 2 vivid real-world clinical/practical examples illustrating this principle.",
    compare_concepts: "The student clicked 'Compare Concepts'. Highlight key contrasts, trade-offs, and easily confused points.",
    test_understanding: "The student clicked 'Test My Understanding'. Provide 2 high-yield diagnostic check questions with complete answers.",
    create_questions: "The student clicked 'Create Practice Questions'. Provide 3 exam-style multiple-choice or short-answer questions with citations.",
    draw_visualize: "The student clicked 'Draw & Visualize'. Draw a clean, accurate, fully labeled `<svg>` diagram inside a ```svg code block (`viewBox=\"0 0 760 360\"`, `#ffffff` background, crisp `#0f172a` labels) plus a numbered legend."
  };

  const actionInstruction = actionType ? actionInstructions[actionType] || "" : "";

  const systemPrompt = `You are LAMLA Guide AI's Personal Conversational AI Study Mentor & Visual Illustrator.
Slogan: "It's Never Too Late To Study."
Target Educational Level: ${educationalLevel}.

CORE RULES:
1. ANSWER ANY QUESTION WITHOUT RESTRICTION:
   - Answer BOTH questions about the student's uploaded slides (citing \`[Slide X]\` where relevant) AND any question completely outside the slides (any academic subject, science, math, coding, medicine, economics, or general knowledge).
   - NEVER refuse a question because it is outside the uploaded slides.
2. DIRECT, NATURAL & CLEAR:
   - Respond warmly to casual greetings without forcing lectures.
   - Give direct, clear answers immediately for academic questions.
3. VISUALIZATION & DRAWING:
   - Whenever the student asks to draw, sketch, diagram, visualize, or show an image of a concept (or when a schematic clarifies a structural/graph/process concept), include a clean, accurate, standalone labeled \`<svg>\` diagram inside a \`\`\`svg code block (\`xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 360" width="100%"\`, white \`#ffffff\` canvas, \`#2563eb\` accents, \`#0f172a\` non-overlapping labels) and explain each labeled part.
${actionInstruction ? `\nSPECIAL ACTION FOCUS: ${actionInstruction}` : ""}`;

  let historyText = "";
  if (chatHistory && chatHistory.length > 0) {
    const turns = chatHistory.slice(-6).map((msg) => {
      const role = msg.role === "assistant" ? "AI Tutor" : "Student";
      return `${role}: ${msg.content}`;
    });
    historyText = `\n\nPrevious Conversation:\n${turns.join("\n")}`;
  }

  let prompt = `Student Message / Request: ${question}\nEducational Level: ${educationalLevel}${historyText}${academicRef}`;
  if (contextDocument) {
    prompt += `\n\nReference Material from Student's Uploaded Slides:\n${contextDocument.slice(0, 32000)}`;
  }

  return callGemini(prompt, { systemPrompt, temperature: 0.35 });
}

export async function generateTeachMeFromZeroWithAI(
  content: string,
  educationalLevel: string = "Senior High School (SHS) & University"
) {
  const systemPrompt = `You are LAMLA Guide AI's Master Explainer.
Slogan: "It's Never Too Late To Study."
Purpose: TEACH ME FROM ZERO — BUILD FOUNDATIONAL UNDERSTANDING & VISUAL MASTERY.
Target Audience: ${educationalLevel} students in Ghana who find this topic difficult or are learning it for the very first time.

PEDAGOGICAL MANDATE:
1. Assume the student has ZERO prior knowledge. Explain everything into deep, crystal-clear, patient detail from absolute scratch.
2. Avoid confusing jargon without defining it immediately in everyday words.
3. Every basic student learns best visually: YOU MUST INCLUDE BOTH A COLOURFUL SVG CONCEPT DIAGRAM AND AN ASCII FLOWCHART.
4. Use relatable everyday Ghanaian analogies (trotro, Waakye/Jollof cooking, Makola/Kejetia market, Mobile Money/MoMo, football) that make the concept click immediately.

REQUIRED STRUCTURE:
# 🌟 TEACH ME FROM ZERO: UNDERSTAND FROM SCRATCH

## 1. 🧭 The Big Picture: Why Does This Exist?
- In 2-3 friendly, encouraging paragraphs, explain why humans/scientists/economists discovered or invented this concept.
- What real-world problem does it solve?

## 2. 🎨 Visual Concept Diagram (Colourful SVG Illustration)
MANDATORY FOR BASIC/VISUAL LEARNERS: Provide a valid, complete, standalone, colorful SVG diagram wrapped in a \`\`\`svg code block:
- Must have: viewBox="0 0 760 260" (or suitable dimensions), xmlns="http://www.w3.org/2000/svg", width="100%".
- Use vibrant, modern SVG graphics:
  * Gradients (<defs><linearGradient id="g1">...) using bright colors (Indigo #6366f1 to Cyan #06b6d4, Emerald #10b981 to Teal #14b8a6, Amber #f59e0b to Orange #f97316).
  * Rounded cards (<rect rx="14"...>), drop shadows, crisp readable labels (<text font-family="sans-serif"...>).
  * Clear directional paths or arrows (<marker id="arrow"...><path marker-end="url(#arrow)"...>) showing the flow from Input -> Core Process -> Final Result.

## 3. 🗺️ Step-by-Step Visual Process Roadmap
Enclose a clean ASCII/Unicode flowchart in a \`\`\`flowchart code block:
[Stage 1: Input / Origin] ──▶ [Stage 2: Core Mechanism] ──▶ [Stage 3: Result / Product]

## 4. 🧱 Foundational Building Blocks (Jargon-Free)
- Break down the 3-4 essential terms into crystal clear everyday definitions with zero confusion.

## 5. ⚙️ How It Actually Works: Step-by-Step
- Walk through the core mechanism or concept one step at a time as if showing a friend in person.
- Cite slide context where relevant (e.g. [Slide 3]).

## 6. 🇬🇭 The Relatable Ghanaian Everyday Analogy
- Provide an extended, memorable, culturally relatable analogy (e.g., trotro routes, Makola market trade, banku cooking, football tactics, MoMo transfers) that cements the mechanism permanently in memory.

## 7. 📊 Visual Summary & Comparison Table
- Provide a clean markdown table comparing: What Goes In vs. What Happens vs. What Comes Out, or Concept vs. Real-Life Everyday Counterpart.

## 8. 🛑 The "Aha!" Moment & Common Misunderstandings
- What do most students get wrong, and what simple insight makes it suddenly click?

## 9. 🎯 3-Question Confidence Check
- 3 intuitive conceptual questions with clear, encouraging answers explaining WHY.`;

  const userPrompt = `Please teach this material completely from scratch for a beginner student:\n\n${content}`;
  return callGemini(userPrompt, { systemPrompt, temperature: 0.35 });
}

export async function generateStudyNotesWithAI(
  content: string,
  subject: string = "General Science / Economics",
  educationalLevel: string = "SHS / University"
) {
  const systemPrompt = `You are LAMLA Guide AI's Master Note Architect & Chief Senior Examiner in Ghana.
Slogan: "It's Never Too Late To Study."
Subject Target: "${subject}" for "${educationalLevel}".

MANDATORY 11-DIMENSION COMPREHENSIVE STUDY NOTES ARCHITECTURE:
You must provide deeply explained, rigorous notes that thoroughly explain every major concept, classification, mechanism, and slide fact. Do NOT produce a brief summary.

Produce a multi-tier learning progression for every major topic:
(1) Clear Everyday Intro -> (2) Rigorous Academic Description -> (3) Vivid Ghanaian Real-World Analogy -> (4) Worked Concrete Example -> (5) Common Traps & Misconceptions.

REQUIRED 11-SECTION DOCUMENT STRUCTURE:
# 📖 COMPREHENSIVE EXAMINATION-GRADE MASTER STUDY NOTES

## 1. 🎯 Syllabus Alignment & Learning Objectives
- 4-6 specific examinable competencies students must demonstrate.

## 2. 🏛️ Core Conceptual Framework & Mental Models
- Deep conceptual overview explaining why this subject exists and its architectural pillars.

## 3. 🔑 Exhaustive Definitions, Mathematical Laws, & Principles
- Rigorous reference table with Term, Academic Definition, Key Formula/Unit, and Exam Significance.

## 4. ⚙️ Step-by-Step Detailed Mechanisms & Sequences (Covering Every Slide)
- Systematic slide-by-slide or subtopic breakdown detailing inputs, steps, transformations, and outputs.

## 5. 📊 Comparative Analysis & Trade-off Tables
- Markdown table comparing key concepts, mechanisms, or classes with clear distinctions.

## 6. 💡 Vivid Real-World Analogies (Intuitive Anchors)
- Memorable, culturally relatable analogies (everyday Ghanaian life, market trade, MoMo, trotro, or sports) cementing abstract ideas.

## 7. 🧪 Concrete Worked Examples & Problem Walkthroughs
- Full problem statement, step-by-step model solution, and examiner commentary.

## 8. 🗺️ Visual ASCII Process Map & Architecture Diagram
- ASCII flowchart inside a \`\`\`flowchart block showing system flow.

## 9. ⚠️ Common Examiner Traps, Misconceptions & Pitfalls
- Specific traps examiners set and common mistakes made by students.

## 10. 📝 Standard Examination Questions (Bloom's Taxonomy)
- 3 varied exam-style questions (Recall, Conceptual Application, Assertion-Reasoning) with model marking schemes.

## 11. 📌 Slide Source Reference Index
- Quick cross-reference map connecting concepts to specific slide numbers.

SOURCE GROUNDING & CITATION RULES:
- Include explicit clickable slide citations (e.g. \`[Source: Slide 1]\`, \`[Source: Slide 2]\`, \`[Source: Page 3]\`) throughout the notes whenever explaining concepts, formulas, definitions, or mechanisms from those slides so students can immediately verify against their lecturer's source slides.`;

  const prompt = `Convert the following study material into comprehensive, examination-grade master study notes covering all slides:\n\n${content}`;
  return callGemini(prompt, { systemPrompt, temperature: 0.25 });
}

export async function regenerateNotesSectionWithAI(
  sectionTitle: string,
  currentSectionContent: string,
  slideContext: string,
  instruction: string = "standard_refresh",
  educationalLevel: string = "SHS / University"
) {
  const styleInstructions: Record<string, string> = {
    deeper_rigor: "DEEPER ACADEMIC RIGOR & MECHANISMS: Provide maximum conceptual depth, formal scientific or mathematical mechanisms, exact formulas/statutes, governing principles, and lecturer exam traps.",
    simpler_analogy: "SIMPLER INTUITIVE EXPLANATION & ANALOGIES: Break down abstract concepts into first-principles intuition, visual flowcharts, and vivid relatable everyday analogies so anyone can grasp it immediately.",
    standard_refresh: "EXHAUSTIVE BALANCED MASTER NOTES: Provide thorough, well-structured, syllabus-aligned study notes with clear definitions, mechanisms, comparison tables, and exam traps."
  };
  const promptStyle = styleInstructions[instruction] || styleInstructions.standard_refresh;

  const systemPrompt = `You are LAMLA Guide AI's Master Note Architect & Senior Examiner in Ghana.
Slogan: "It's Never Too Late To Study."
Target Educational Level: "${educationalLevel}".
Task: REGENERATE SPECIFIC STUDY NOTES SECTION GROUNDED IN SLIDES.

STYLE MANDATE: ${promptStyle}

GROUNDING & CITATION RULES:
1. Ground every claim directly in the provided slide context. Never invent facts not present in the slides.
2. Include direct slide citations (e.g. \`[Source: Slide X]\`) whenever referencing material from specific slides.
3. Use clean markdown formatting (bold terms, bullet points, markdown tables, or process flowcharts where helpful).
4. Return ONLY the complete regenerated section starting with the section heading: ${sectionTitle}.`;

  const prompt = `Regenerate the following study notes section:

SECTION TITLE: ${sectionTitle}

CURRENT CONTENT TO IMPROVE:
${currentSectionContent}

SOURCE SLIDE CONTEXT:
${slideContext.slice(0, 30000)}

Please output the improved, comprehensive, and source-grounded replacement for this section:`;

  return callGemini(prompt, { systemPrompt, temperature: 0.25 });
}

export async function generateFlashcardsBatch(
  content: string,
  count: number = 10,
  startIndex: number = 1
) {
  const systemPrompt = `You are LAMLA Guide AI's Active Recall Flashcard Engine (inspired by spaced repetition science).
Extract ${count} distinct, high-yield active recall flashcards from the provided material, starting with ID ${startIndex}.
Each flashcard must test a single core term, definition, formula, mechanism, or principle.
Respond ONLY with a valid JSON array of objects without markdown formatting.
Schema:
[
  {
    "id": ${startIndex},
    "front": "Active recall question, concept prompt, or scenario",
    "back": "Clear, concise definition or answer with memory hook",
    "term": "Key terminology tested",
    "slideRef": "Slide 3 / Key Section"
  }
]`;

  const userPrompt = `Create ${count} high-yield active-recall flashcards based strictly on this material (start ID ${startIndex}):\n\n${content}`;
  const jsonText = await callGemini(userPrompt, {
    systemPrompt,
    temperature: 0.2,
    responseMimeType: "application/json",
  });

  const parsed = cleanJsonResponse(jsonText);
  return Array.isArray(parsed) ? parsed : [];
}

export async function generateFlashcardsWithAI(
  content: string,
  count: number = 10
) {
  const targetCount = Math.min(Math.max(count, 5), 200);

  if (targetCount <= 25) {
    const cards = await generateFlashcardsBatch(content, targetCount, 1);
    return cards.map((c, idx) => ({ ...c, id: idx + 1 }));
  }

  // Batch generate in chunks of 25 to prevent token limits
  const batchSize = 25;
  const numBatches = Math.ceil(targetCount / batchSize);
  const allCards: any[] = [];
  const seenTerms = new Set<string>();

  for (let i = 0; i < numBatches; i++) {
    const currentCount = Math.min(batchSize, targetCount - allCards.length);
    if (currentCount <= 0) break;
    const batch = await generateFlashcardsBatch(content, currentCount, allCards.length + 1);
    for (const card of batch) {
      const termKey = String(card.term || card.front || "").toLowerCase().trim();
      if (!seenTerms.has(termKey)) {
        seenTerms.add(termKey);
        allCards.push(card);
      }
    }
  }

  return allCards.slice(0, targetCount).map((c, idx) => ({ ...c, id: idx + 1 }));
}

export async function generateDetailedExplanationWithAI(
  content: string,
  educationalLevel: string = "Senior High School (SHS) & University"
) {
  const systemPrompt = `You are LAMLA Guide AI's Socratic Master Teacher. Motto: "It's Never Too Late To Study."
Provide an in-depth, intuitive, step-by-step conceptual explanation of the provided slide deck or lecture material for ${educationalLevel} students in Ghana.
Break down difficult ideas into simple building blocks, use clear real-world analogies, explain WHY things happen, highlight crucial examinable details, and provide step-by-step reasoning for every slide.`;

  const userPrompt = `Provide a comprehensive step-by-step conceptual explanation of these lecture slides/notes:\n\n${content}`;
  return callGemini(userPrompt, { systemPrompt, temperature: 0.35 });
}

export async function explainThreeWaysWithAI(
  concept: string,
  context?: string
) {
  const systemPrompt = `You are LAMLA Guide AI's Socratic Explainer. Motto: "It's Never Too Late To Study."
Explain the academic concept in three distinct pedagogical modalities:
1. 'simple': Intuitive, jargon-free explanation suitable for a beginner or 10-year-old.
2. 'academic': Precise, rigorous academic explanation meeting West African Senior High / University standards.
3. 'analogy': A vivid, culturally relatable real-world Ghanaian analogy (e.g., market, trotro, football, cooking, local trade).
Return valid JSON without markdown fences:
{
  "simple": "...",
  "academic": "...",
  "analogy": "..."
}`;

  const prompt = `Concept: ${concept}\nContext: ${context || ""}`;
  const jsonText = await callGemini(prompt, {
    systemPrompt,
    temperature: 0.3,
    responseMimeType: "application/json",
  });
  return cleanJsonResponse(jsonText);
}

export async function evaluateActiveRecallWithAI(
  question: string,
  studentAnswer: string,
  referenceText?: string
) {
  const systemPrompt = `You are LAMLA Guide AI's Active Recall Examiner.
Evaluate the student's recalled answer against the true concept or reference slide.
Provide constructive feedback:
1. Score out of 100.
2. What key terminology was correctly remembered.
3. What crucial points or nuances were missed.
4. Correct high-yield memory cue.
Return valid JSON without markdown fences:
{
  "score": 85,
  "verdict": "Solid Recall / Needs Review / Mastered",
  "correct_elements": ["..."],
  "missing_elements": ["..."],
  "feedback": "...",
  "memory_hook": "..."
}`;

  const prompt = `Question: ${question}\nStudent Answer: ${studentAnswer}\nReference Context: ${referenceText || ""}`;
  const jsonText = await callGemini(prompt, {
    systemPrompt,
    temperature: 0.2,
    responseMimeType: "application/json",
  });
  return cleanJsonResponse(jsonText);
}

