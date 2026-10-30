// LAMLA Guide AI — Natural Educational Audio & Text-to-Speech Engine
// Zero-cost architecture: Prioritizes browser Natural/Neural voices with graceful standard fallbacks.
// Slogan: "It's Never Too Late To Study."

export interface SpeechChunk {
  id: number;
  rawText: string;
  speechText: string;
  sectionHeading?: string;
  wordCount: number;
}

export interface VoiceOption {
  voice: SpeechSynthesisVoice;
  name: string;
  lang: string;
  isNatural: boolean;
  tier: "natural" | "standard" | "other";
  displayName: string;
}

export interface EducationalPronunciationRule {
  pattern: RegExp;
  replacement: string;
}

// Comprehensive phonetic and educational terminology dictionary
// Expands abbreviations, Latin terms, medical/scientific nomenclature, symbols, and formulas
// so that synthesis speaks smoothly and naturally without stumbling.
const PRONUNCIATION_RULES: EducationalPronunciationRule[] = [
  // ─── Common Latin & Academic Abbreviations ───
  { pattern: /\be\.g\.,?\s*/gi, replacement: "for example, " },
  { pattern: /\bi\.e\.,?\s*/gi, replacement: "that is, " },
  { pattern: /\betc\.?\b/gi, replacement: "et cetera" },
  { pattern: /\bvs\.?\b/gi, replacement: "versus" },
  { pattern: /\bv\.\s+/gi, replacement: "versus " },
  { pattern: /\bca\.\s*/gi, replacement: "approximately " },
  { pattern: /\bet al\.?\b/gi, replacement: "and colleagues" },
  { pattern: /\bibid\.?\b/gi, replacement: "in the same source" },
  { pattern: /\bw\/\s*/gi, replacement: "with " },
  { pattern: /\bw\/o\s*/gi, replacement: "without " },

  // ─── Core Biological & Biochemical Terminology ───
  { pattern: /\bDNA\b/g, replacement: "D-N-A" },
  { pattern: /\bRNA\b/g, replacement: "R-N-A" },
  { pattern: /\bmRNA\b/g, replacement: "messenger R-N-A" },
  { pattern: /\btRNA\b/g, replacement: "transfer R-N-A" },
  { pattern: /\brRNA\b/g, replacement: "ribosomal R-N-A" },
  { pattern: /\bcDNA\b/g, replacement: "complementary D-N-A" },
  { pattern: /\bATP\b/g, replacement: "A-T-P" },
  { pattern: /\bADP\b/g, replacement: "A-D-P" },
  { pattern: /\bAMP\b/g, replacement: "A-M-P" },
  { pattern: /\bNADH\b/g, replacement: "N-A-D-H" },
  { pattern: /\bNADPH\b/g, replacement: "N-A-D-P-H" },
  { pattern: /\bFADH2\b/gi, replacement: "F-A-D-H-two" },
  { pattern: /\bCO2\b|CO₂/g, replacement: "carbon dioxide" },
  { pattern: /\bH2O\b|H₂O/g, replacement: "water" },
  { pattern: /\bO2\b|O₂/g, replacement: "oxygen gas" },
  { pattern: /\bNaCl\b/g, replacement: "sodium chloride" },
  { pattern: /\bHCl\b/g, replacement: "hydrochloric acid" },
  { pattern: /\bH2SO4\b|H₂SO₄/g, replacement: "sulfuric acid" },
  { pattern: /\bCaCO3\b|CaCO₃/g, replacement: "calcium carbonate" },
  { pattern: /\bpH\b/g, replacement: "p-H" },
  { pattern: /\bpKa\b/g, replacement: "p-K-a" },

  // ─── Ionic and Molecular Charges ───
  { pattern: /\bCa2\+\b|Ca²⁺/g, replacement: "calcium two-plus ions" },
  { pattern: /\bNa\+\b|Na⁺/g, replacement: "sodium ions" },
  { pattern: /\bK\+\b|K⁺/g, replacement: "potassium ions" },
  { pattern: /\bCl-\b|Cl⁻/g, replacement: "chloride ions" },
  { pattern: /\bMg2\+\b|Mg²⁺/g, replacement: "magnesium ions" },
  { pattern: /\bFe2\+\b|Fe²⁺/g, replacement: "iron two ions" },
  { pattern: /\bFe3\+\b|Fe³⁺/g, replacement: "iron three ions" },
  { pattern: /\bH\+\b|H⁺/g, replacement: "hydrogen ions" },
  { pattern: /\bOH-\b|OH⁻/g, replacement: "hydroxide ions" },

  // ─── Units and Scientific Measurements ───
  { pattern: /(\d+)\s*mg\/dL/gi, replacement: "$1 milligrams per deciliter" },
  { pattern: /(\d+)\s*mmol\/L/gi, replacement: "$1 millimoles per liter" },
  { pattern: /(\d+)\s*mmHg/gi, replacement: "$1 millimeters of mercury" },
  { pattern: /(\d+)\s*(?:μm|um)\b/gi, replacement: "$1 micrometers" },
  { pattern: /(\d+)\s*nm\b/gi, replacement: "$1 nanometers" },
  { pattern: /(\d+)\s*(?:μg|ug)\b/gi, replacement: "$1 micrograms" },
  { pattern: /(\d+)\s*mg\b/gi, replacement: "$1 milligrams" },
  { pattern: /(\d+)\s*kg\b/gi, replacement: "$1 kilograms" },
  { pattern: /(\d+)\s*mL\b/gi, replacement: "$1 milliliters" },
  { pattern: /(\d+)\s*bpm\b/gi, replacement: "$1 beats per minute" },
  { pattern: /(\d+)\s*bp\b/gi, replacement: "$1 base pairs" },
  { pattern: /(\d+)\s*kbp\b/gi, replacement: "$1 kilobase pairs" },
  { pattern: /(\d+)\s*°C\b/g, replacement: "$1 degrees Celsius" },
  { pattern: /(\d+)\s*°F\b/g, replacement: "$1 degrees Fahrenheit" },
  { pattern: /(\d+)\s*%/g, replacement: "$1 percent" },

  // ─── Ghanaian & Regional Currency and Exam Abbreviations ───
  { pattern: /\bGH[S₵]\s*(\d+(?:\.\d+)?)/gi, replacement: "$1 Ghana Cedis" },
  { pattern: /\bWASSCE\b/gi, replacement: "W-A-S-S-C-E" },
  { pattern: /\bSHS\b/gi, replacement: "S-H-S" },
  { pattern: /\bBECE\b/gi, replacement: "B-E-C-E" },

  // ─── Mathematical & Logic Symbols ───
  { pattern: /\s*≠\s*/g, replacement: " is not equal to " },
  { pattern: /\s*≤\s*/g, replacement: " is less than or equal to " },
  { pattern: /\s*≥\s*/g, replacement: " is greater than or equal to " },
  { pattern: /\s*±\s*/g, replacement: " plus or minus " },
  { pattern: /\s*≈\s*/g, replacement: " is approximately equal to " },
  { pattern: /\s*→\s*|\s*-->\s*|\s*->\s*/g, replacement: ", which leads to, " },
  { pattern: /\s*⇌\s*/g, replacement: " is in dynamic equilibrium with " },
  { pattern: /\s*∆\s*|\s*Δ\s*/g, replacement: " change in " },

  // ─── Clinical / Anatomical Pronunciations ───
  { pattern: /\bCNS\b/g, replacement: "central nervous system" },
  { pattern: /\bPNS\b/g, replacement: "peripheral nervous system" },
  { pattern: /\bGI\b\s+tract/gi, replacement: "gastrointestinal tract" },
  { pattern: /\bBP\b/g, replacement: "blood pressure" },
  { pattern: /\bECG\b|\bEKG\b/g, replacement: "E-C-G" },
  { pattern: /\bWBC\b/g, replacement: "white blood cells" },
  { pattern: /\bRBC\b/g, replacement: "red blood cells" },
];

/**
 * Preprocesses text for natural educational speech synthesis:
 * 1. Strips Markdown syntax (bold, headings, links, tables, code blocks, callouts).
 * 2. Strips raw emojis and decorative characters so engines don't pronounce character codes.
 * 3. Applies educational phonetic substitutions for symbols, formulas, and units.
 * 4. Verbalizes slide references naturally (e.g. [Slide 2] -> "referenced on slide 2").
 * 5. Normalizes punctuation for clear sentence rhythm, natural cadence, and breath pauses.
 */
export function preprocessEducationalSpeech(rawText: string): string {
  if (!rawText) return "";

  let text = rawText;

  // 1. Remove markdown code blocks, inline SVG drawings & diagram fences
  text = text.replace(/```[\s\S]*?```/g, " Diagram reference omitted. ");
  text = text.replace(/<svg[\s\S]*?<\/svg>/gi, " Diagram reference omitted. ");
  text = text.replace(/`([^`]+)`/g, "$1");

  // 2. Strip images and links (verbalize link text cleanly)
  text = text.replace(/!\[.*?\]\(.*?\)/g, "");
  text = text.replace(/\[([^\]]+)\]\(.*?\)/g, "$1");

  // 3. Naturalize slide references: [Slide X] -> "as shown on slide X"
  text = text.replace(/\[\s*Slide\s+(\d+)\s*\]/gi, "as referenced on slide $1, ");
  text = text.replace(/\[\s*Page\s+(\d+)\s*\]/gi, "on page $1, ");

  // 4. Clean markdown callouts (> [!NOTE], > [!TIP], etc.)
  text = text.replace(/>\s*\[!(?:NOTE|IMPORTANT|TIP)\]\s*/gi, "Important note: ");
  text = text.replace(/>\s*\[!(?:WARNING|CAUTION)\]\s*/gi, "Caution: ");
  text = text.replace(/^>\s*/gm, "");

  // 5. Convert markdown headers into smooth natural spoken transition cues
  text = text.replace(/^#{1,2}\s+(.+)$/gm, "\nSection: $1.\n");
  text = text.replace(/^#{3,6}\s+(.+)$/gm, "\nTopic: $1.\n");

  // 6. Convert list item markers into smooth spoken pauses without saying "bullet"
  // Do NOT leave bullet symbols (•, -, *) in speech text as some speech synthesizers announce them!
  text = text.replace(/^[\s]*[-*+]\s+/gm, "\n");
  text = text.replace(/^[\s]*(\d+)\.\s+/gm, "\nPoint $1, ");

  // 7. Remove bold, italics, strikethrough markdown decorators
  text = text.replace(/\*\*(.*?)\*\*/g, "$1");
  text = text.replace(/\*(.*?)\*/g, "$1");
  text = text.replace(/__(.*?)__/g, "$1");
  text = text.replace(/_(.*?)_/g, "$1");
  text = text.replace(/~~(.*?)~~/g, "$1");

  // 8. Clean markdown horizontal rules and separators (---, ***, ===)
  text = text.replace(/^[-*_]{3,}\s*$/gm, "");

  // 9. Clean markdown table borders
  text = text.replace(/^[-\s|:]+$/gm, "");
  text = text.replace(/\|/g, ", ");

  // 10. Strip emojis and decorative symbols so speech synthesis doesn't announce symbol names
  // Matches standard Unicode emojis, Dingbats, and decorative shapes
  text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, "");
  text = text.replace(/[•●■◆▶►★☆✓✗✔✕💡🎯🪜🌐❓⚠️🇬🇭]/g, "");

  // 11. Apply educational phonetic and pronunciation dictionary
  for (const rule of PRONUNCIATION_RULES) {
    text = text.replace(rule.pattern, rule.replacement);
  }

  // 12. Normalize remaining punctuation to prevent reading literal punctuation names
  text = text.replace(/[–—]/g, ", "); // Convert en/em dashes to natural comma pauses
  text = text.replace(/--+/g, ", ");
  text = text.replace(/["""]/g, '"');
  text = text.replace(/[''']/g, "'");
  text = text.replace(/\s*([,;:?.!])\s*/g, "$1 "); // Clean spacing around punctuation
  text = text.replace(/\.{3,}/g, "..."); // Natural pause
  text = text.replace(/\s+/g, " ");
  text = text.replace(/\n\s*\n/g, "\n\n");

  return text.trim();
}

/**
 * Splits educational text into natural, digestible speech chunks.
 * Avoids cutting sentences in half and keeps chunks between 120-220 characters
 * for optimal cadence, zero Chrome timeout stalls, and accurate sentence navigation.
 */
export function createSpeechChunks(
  text: string,
  sectionHeading?: string
): SpeechChunk[] {
  if (!text) return [];

  // Split into raw paragraphs first
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: SpeechChunk[] = [];
  let chunkId = 1;
  let currentHeading = sectionHeading || "";

  for (const paragraph of paragraphs) {
    // Detect section headers
    if (paragraph.startsWith("Section:") || paragraph.startsWith("Topic:")) {
      currentHeading = paragraph.replace(/^(Section|Topic):\s*/, "").replace(/\.$/, "");
    }

    // Split paragraph by sentence boundaries (. ! ? ; or bullet points)
    // Matches sentence endings followed by whitespace or end of string
    const sentenceRegex = /[^.!?;\n]+[.!?;\n]+(?:\s+|$)|[^.!?;\n]+$/g;
    const rawSentences = paragraph.match(sentenceRegex) || [paragraph];

    let accumulator = "";

    for (const rawSentence of rawSentences) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;

      // If accumulator already has content and adding this sentence exceeds target size (~180 chars)
      if (accumulator && accumulator.length + sentence.length > 180) {
        const speechProcessed = preprocessEducationalSpeech(accumulator);
        if (speechProcessed.length > 0) {
          chunks.push({
            id: chunkId++,
            rawText: accumulator,
            speechText: speechProcessed,
            sectionHeading: currentHeading || undefined,
            wordCount: accumulator.split(/\s+/).filter(Boolean).length,
          });
        }
        accumulator = sentence;
      } else {
        accumulator = accumulator ? `${accumulator} ${sentence}` : sentence;
      }
    }

    if (accumulator.trim()) {
      const speechProcessed = preprocessEducationalSpeech(accumulator);
      if (speechProcessed.length > 0) {
        chunks.push({
          id: chunkId++,
          rawText: accumulator,
          speechText: speechProcessed,
          sectionHeading: currentHeading || undefined,
          wordCount: accumulator.split(/\s+/).filter(Boolean).length,
        });
      }
    }
  }

  return chunks;
}

/**
 * Detects and sorts available system voices into:
 * 1. Tier 1: Natural & Neural Voices (Edge Natural, Google, macOS Siri/Enhanced)
 * 2. Tier 2: Standard English Voices (David, Zira, Mark, Alex)
 * 3. Tier 3: Other Voices
 */
export function getAvailableVoices(): VoiceOption[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [];
  }

  const rawVoices = window.speechSynthesis.getVoices();
  if (!rawVoices || rawVoices.length === 0) return [];

  const naturalKeywords = [
    "natural",
    "neural",
    "online",
    "google",
    "enhanced",
    "premium",
    "multilingual",
    "studio",
    "jenny",
    "guy",
    "aria",
    "samantha",
    "daniel",
  ];

  const processed: VoiceOption[] = rawVoices.map((voice) => {
    const lowerName = voice.name.toLowerCase();
    const isNatural = naturalKeywords.some((kw) => lowerName.includes(kw));
    const isEnglish = voice.lang.toLowerCase().startsWith("en");

    let tier: "natural" | "standard" | "other" = "other";
    if (isNatural && isEnglish) {
      tier = "natural";
    } else if (isEnglish) {
      tier = "standard";
    }

    // Clean up friendly display name
    let cleanName = voice.name
      .replace(/Microsoft\s+/i, "")
      .replace(/Online\s*\(Natural\)\s*-\s*/i, "(Natural) ")
      .replace(/Google\s+/i, "Google ");

    const displayName = isNatural
      ? `🌟 ${cleanName}`
      : `${cleanName} (${voice.lang})`;

    return {
      voice,
      name: voice.name,
      lang: voice.lang,
      isNatural,
      tier,
      displayName,
    };
  });

  // Sort: Natural English voices first, then standard English, then others
  return processed.sort((a, b) => {
    if (a.tier === "natural" && b.tier !== "natural") return -1;
    if (a.tier !== "natural" && b.tier === "natural") return 1;
    if (a.tier === "standard" && b.tier === "other") return -1;
    if (a.tier === "other" && b.tier === "standard") return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Selects the optimal default voice from available voices:
 * Prioritizes high-clarity natural voices (e.g., Jenny Natural, Google US English).
 */
export function getDefaultVoice(voices: VoiceOption[]): VoiceOption | null {
  if (!voices || voices.length === 0) return null;

  // 1. Look for top natural English voices
  const preferredNaturalNames = [
    "jenny",
    "guy",
    "aria",
    "google us english",
    "google uk english female",
    "samantha",
    "daniel",
  ];

  for (const pref of preferredNaturalNames) {
    const found = voices.find(
      (v) =>
        v.tier === "natural" &&
        v.name.toLowerCase().includes(pref)
    );
    if (found) return found;
  }

  // 2. Any natural voice
  const anyNatural = voices.find((v) => v.tier === "natural");
  if (anyNatural) return anyNatural;

  // 3. Any standard English voice
  const anyEnglish = voices.find((v) => v.tier === "standard");
  if (anyEnglish) return anyEnglish;

  // 4. Fallback to first voice
  return voices[0] || null;
}
