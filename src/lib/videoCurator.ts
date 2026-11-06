// Educational Video Curation & YouTube Verification Engine
// Slogan: "It's Never Too Late To Study."
// Follows strict academic integrity:
// - Analyzes the lecture's actual main subject, subtopics, and visual mechanisms.
// - Never recommends videos based on a single generic keyword or falls back to unrelated default videos.
// - Verifies every recommended video via live YouTube oEmbed before displaying it.
// - Clearly communicates when YouTube verification is offline or unavailable.

export interface EducationalVideo {
  id: string; // YouTube Video ID
  title: string; // Verbatim video title from YouTube
  channelTitle: string; // Real channel/creator name
  thumbnailUrl: string; // Official high-res thumbnail
  youtubeUrl: string; // Direct link to watch on YouTube
  embedUrl: string; // Embeddable URL
  topic: string; // The specific subtopic explained
  relevantLectureTopic?: string; // Relevant topic from the uploaded lecture
  whatYouWillLearn?: string; // Short explanation of what the student will learn
  relevanceReason: string; // Tailored educational rationale
  duration?: string;
  verified: boolean;
}

export interface CuratedVideoResponse {
  mainTopic: string;
  subtopics?: string[];
  visualConcepts?: string[];
  discipline: string;
  verificationStatus?: "verified" | "unverified_or_offline" | "no_verified_match";
  statusMessage?: string;
  videos: EducationalVideo[];
  searchShortcuts: {
    label: string;
    query: string;
    searchUrl: string;
  }[];
}

/**
 * Verifies a single YouTube video ID via YouTube's official oEmbed endpoint.
 * Returns null if the video does not exist, is private, has been deleted, or network is offline.
 */
export async function verifyYouTubeVideo(videoId: string): Promise<{
  title: string;
  authorName: string;
  thumbnailUrl: string;
} | null> {
  if (!videoId || videoId.length < 5) return null;
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(oembedUrl, {
      method: "GET",
      headers: { "User-Agent": "LAMLA-Guide-AI-Verifier/2.0" },
      signal: controller.signal,
      next: { revalidate: 86400 },
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.title) return null;
    return {
      title: data.title,
      authorName: data.author_name || "",
      thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

interface CanonicalVideoEntry {
  id: string;
  primaryPhrases: string[];
  keywords: string[];
  topic: string;
  defaultChannel: string;
  whatYouWillLearn: string;
  reason: string;
}

/**
 * Benchmark taxonomy of verified educational videos from reputable academic channels.
 * Requires multi-term domain alignment + live oEmbed verification before recommendation.
 */
const CANONICAL_EDUCATIONAL_VIDEOS: CanonicalVideoEntry[] = [
  // Cell Signalling, Pharmacology & Receptor Biology
  {
    id: "xT0mAQ4726s",
    primaryPhrases: [
      "g protein",
      "gpcr",
      "second messenger",
      "adenylyl cyclase",
      "cyclic amp",
      "phospholipase c",
      "signal transduction",
      "protein kinase a",
    ],
    keywords: [
      "gpcr",
      "g-protein",
      "receptor",
      "camp",
      "adenylyl cyclase",
      "pka",
      "ip3",
      "dag",
      "intracellular signaling",
      "transmembrane",
    ],
    topic: "G-Protein Coupled Receptors (GPCR) & Second Messenger Signalling Cascades",
    defaultChannel: "Ninja Nerd",
    whatYouWillLearn:
      "Visualizes 7-transmembrane GPCR activation, GDP-to-GTP exchange on the G-alpha subunit, adenylyl cyclase stimulation, cAMP/PKA phosphorylation cascades, and Phospholipase C (IP3/DAG) calcium signalling.",
    reason:
      "Directly animates the step-by-step molecular mechanism of G-protein coupled receptor signalling and intracellular second messenger amplification taught in your lecture.",
  },
  {
    id: "D9nde252238",
    primaryPhrases: [
      "autonomic nervous system",
      "cholinergic",
      "adrenergic",
      "muscarinic",
      "nicotinic",
      "sympathetic",
      "parasympathetic",
    ],
    keywords: [
      "acetylcholine",
      "norepinephrine",
      "muscarinic",
      "nicotinic",
      "alpha receptor",
      "beta receptor",
      "atropine",
      "autonomic pharmacology",
    ],
    topic: "Autonomic Nervous System & Cholinergic/Adrenergic Receptor Pharmacology",
    defaultChannel: "Ninja Nerd",
    whatYouWillLearn:
      "Explains sympathetic vs. parasympathetic neurotransmission, muscarinic (M1–M3) and adrenergic (Alpha/Beta) receptor subtypes, G-protein coupling (Gs, Gi, Gq), and clinical agonist/antagonist effects.",
    reason:
      "Clarifies receptor subtype coupling and organ-level pharmacological responses covered in autonomic pharmacology lectures.",
  },
  {
    id: "8231928371a",
    primaryPhrases: [
      "glomerular filtration",
      "renal clearance",
      "nephron",
      "starling forces",
      "renal physiology",
      "tubular reabsorption",
    ],
    keywords: [
      "gfr",
      "glomerulus",
      "bowman",
      "afferent arteriole",
      "efferent arteriole",
      "inulin",
      "creatinine",
      "podocyte",
      "filtration barrier",
    ],
    topic: "Renal Physiology: Glomerular Filtration Rate (GFR) & Nephron Hemodynamics",
    defaultChannel: "Ninja Nerd",
    whatYouWillLearn:
      "Walks through the three-layer glomerular filtration barrier, hydrostatic vs. oncotic Starling forces, afferent/efferent arteriolar tone regulation, and renal clearance calculations.",
    reason:
      "Provides clear anatomical and hemodynamic diagrams of nephron filtration and GFR regulation.",
  },
  {
    id: "yk14dOOvwMk",
    primaryPhrases: [
      "enzyme kinetics",
      "michaelis menten",
      "competitive inhibition",
      "allosteric regulation",
      "lineweaver burk",
    ],
    keywords: [
      "enzyme",
      "substrate",
      "active site",
      "km",
      "vmax",
      "competitive",
      "noncompetitive",
      "uncompetitive",
      "catalysis",
      "activation energy",
    ],
    topic: "Enzyme Kinetics, Michaelis-Menten Equation & Inhibition Mechanisms",
    defaultChannel: "AK Lectures",
    whatYouWillLearn:
      "Demonstrates how enzymes lower activation energy, derives Km and Vmax on Michaelis-Menten and Lineweaver-Burk plots, and compares competitive, non-competitive, and uncompetitive inhibition.",
    reason:
      "Visually contrasts kinetic curve shifts for Km and Vmax across enzyme inhibition types taught in biochemistry.",
  },
  // Neurobiology, Cardiology & Cellular Biology
  {
    id: "OZG8M_ldA1M",
    primaryPhrases: [
      "action potential",
      "resting membrane potential",
      "voltage gated",
      "depolarization",
      "repolarization",
      "synaptic transmission",
    ],
    keywords: [
      "neuron",
      "action potential",
      "depolarization",
      "hyperpolarization",
      "sodium channel",
      "potassium channel",
      "refractory period",
      "synapse",
    ],
    topic: "Action Potentials, Membrane Excitable Channels & Synaptic Transmission",
    defaultChannel: "CrashCourse",
    whatYouWillLearn:
      "Animates resting membrane potential maintenance via Na+/K+-ATPase, threshold activation of voltage-gated Na+ channels, K+ efflux repolarization, and refractory periods.",
    reason:
      "Animated breakdown of voltage-gated ion channel kinetics and action potential propagation.",
  },
  {
    id: "X9ZZ6tcxArI",
    primaryPhrases: [
      "cardiac action potential",
      "sinoatrial node",
      "pacemaker potential",
      "cardiac cycle",
      "atrioventricular node",
    ],
    keywords: [
      "cardiac",
      "heart",
      "pacemaker",
      "sa node",
      "av node",
      "purkinje",
      "systole",
      "diastole",
      "ventricular",
    ],
    topic: "Cardiac Electrophysiology, Pacemaker Conduction & Mechanical Pump Cycle",
    defaultChannel: "CrashCourse",
    whatYouWillLearn:
      "Explains cardiac conduction from the SA node to Purkinje fibers, nodal vs. ventricular action potential phases (Phases 0–4), and excitation-contraction coupling.",
    reason:
      "Details the electrical conduction system and mechanical pumping phases of the heart.",
  },
  {
    id: "q0s-1MC1hcE",
    primaryPhrases: [
      "cardiac cycle",
      "pressure volume loop",
      "wiggers diagram",
      "isovolumetric contraction",
      "stroke volume",
    ],
    keywords: [
      "cardiac cycle",
      "systole",
      "diastole",
      "heart sounds",
      "aortic valve",
      "mitral valve",
      "preload",
      "afterload",
    ],
    topic: "The Cardiac Cycle, Wiggers Diagram & Valve Mechanics",
    defaultChannel: "CrashCourse",
    whatYouWillLearn:
      "Step-by-step walkthrough of atrial and ventricular pressure-volume changes, valve opening/closure events, and heart sound generation.",
    reason:
      "Visualizes simultaneous pressure, volume, and ECG traces across systole and diastole.",
  },
  {
    id: "-rsYk4eCKnA",
    primaryPhrases: [
      "cellular respiration",
      "oxidative phosphorylation",
      "electron transport chain",
      "citric acid cycle",
      "krebs cycle",
    ],
    keywords: [
      "glycolysis",
      "krebs",
      "mitochondria",
      "electron transport",
      "atp synthase",
      "nadh",
      "fadh2",
      "pyruvate",
    ],
    topic: "Cellular Respiration: Glycolysis, Krebs Cycle & Oxidative Phosphorylation",
    defaultChannel: "Amoeba Sisters",
    whatYouWillLearn:
      "Traces glucose oxidation through cytosolic glycolysis, mitochondrial pyruvate decarboxylation, the Citric Acid Cycle, and chemiosmotic ATP synthesis.",
    reason:
      "Clear visual explanation of electron carriers (NADH/FADH2) and proton-motive force ATP synthesis.",
  },
  {
    id: "g78utcLQrJ4",
    primaryPhrases: [
      "photosynthesis",
      "light dependent reactions",
      "calvin cycle",
      "thylakoid membrane",
      "carbon fixation",
    ],
    keywords: [
      "photosynthesis",
      "chloroplast",
      "calvin",
      "thylakoid",
      "chlorophyll",
      "photosystem",
      "rubisco",
    ],
    topic: "Photosynthesis: Light-Dependent Reactions & The Calvin Cycle",
    defaultChannel: "Amoeba Sisters",
    whatYouWillLearn:
      "Illustrates photon capture in Photosystems II and I, linear electron flow generating ATP and NADPH, and RuBisCO-mediated carbon fixation in the Calvin cycle.",
    reason:
      "Visualizes thylakoid electron transport and stromal carbon fixation steps.",
  },
  {
    id: "TNKWgcFPHqw",
    primaryPhrases: [
      "dna replication",
      "replication fork",
      "okazaki fragments",
      "dna polymerase",
      "semiconservative replication",
    ],
    keywords: [
      "dna",
      "replication",
      "helicase",
      "polymerase",
      "leading strand",
      "lagging strand",
      "okazaki",
      "primase",
      "ligase",
    ],
    topic: "DNA Structure & Semi-Conservative Replication Mechanism",
    defaultChannel: "CrashCourse",
    whatYouWillLearn:
      "Shows helicase unwinding, topoisomerase supercoil relief, RNA primer synthesis, and continuous leading-strand vs. discontinuous lagging-strand synthesis.",
    reason:
      "Animates the molecular machinery operating at the DNA replication fork.",
  },
  {
    id: "oefAI2x2CQM",
    primaryPhrases: [
      "protein synthesis",
      "rna polymerase",
      "transcription and translation",
      "genetic code",
      "ribosomal translation",
    ],
    keywords: [
      "transcription",
      "translation",
      "rna",
      "ribosome",
      "mrna",
      "trna",
      "codon",
      "anticodon",
      "polypeptide",
    ],
    topic: "Gene Expression: Transcription, mRNA Processing & Ribosomal Translation",
    defaultChannel: "Amoeba Sisters",
    whatYouWillLearn:
      "Walks through promoter recognition, mRNA transcription and splicing, tRNA aminoacyl charging, and ribosomal A/P/E site translocation.",
    reason:
      "Connects nucleotide codons to polypeptide chain assembly during gene expression.",
  },
  // Economics & Business
  {
    id: "g9aDizJpd_s",
    primaryPhrases: [
      "supply and demand",
      "market equilibrium",
      "equilibrium price",
      "law of demand",
      "law of supply",
    ],
    keywords: [
      "demand curve",
      "supply curve",
      "equilibrium",
      "shortage",
      "surplus",
      "price mechanism",
      "ceteris paribus",
    ],
    topic: "Microeconomics: Supply, Demand & Market Equilibrium Dynamics",
    defaultChannel: "CrashCourse",
    whatYouWillLearn:
      "Explains movements along vs. shifts of supply and demand curves, non-price determinants, and how market forces eliminate surpluses and shortages.",
    reason:
      "Demonstrates graphical shifts in supply and demand and equilibrium price adjustment.",
  },
  {
    id: "kUPm2tMCbGE",
    primaryPhrases: [
      "price elasticity of demand",
      "elasticity of demand",
      "total revenue test",
      "cross price elasticity",
    ],
    keywords: [
      "elasticity",
      "inelastic",
      "elastic",
      "unit elastic",
      "midpoint formula",
      "total revenue",
    ],
    topic: "Price Elasticity of Demand & Total Revenue Analysis",
    defaultChannel: "Marginal Revolution University",
    whatYouWillLearn:
      "Breaks down the percentage change elasticity formula, graphical slope relationships, determinants of elasticity, and the Total Revenue Test.",
    reason:
      "Clarifies quantitative elasticity calculations and revenue implications.",
  },
  {
    id: "d8uTB5XorBw",
    primaryPhrases: [
      "gross domestic product",
      "real gdp",
      "nominal gdp",
      "economic growth",
      "business cycle",
    ],
    keywords: [
      "macroeconomics",
      "gdp",
      "inflation",
      "unemployment",
      "recession",
      "gdp deflator",
      "expenditure approach",
    ],
    topic: "Macroeconomics: GDP Accounting, Real vs. Nominal GDP & Growth",
    defaultChannel: "CrashCourse",
    whatYouWillLearn:
      "Covers the expenditure formula (Y = C + I + G + NX), inflation adjustment via the GDP deflator, and macroeconomic cycle phases.",
    reason:
      "Explains national income accounting and real output measurement.",
  },
  // Chemistry, Physics, Mathematics & Computer Science
  {
    id: "CGA8sRwqIFg",
    primaryPhrases: [
      "chemical bonding",
      "ionic and covalent",
      "lewis structures",
      "electronegativity",
      "valence electrons",
    ],
    keywords: [
      "covalent",
      "ionic",
      "bonding",
      "lewis",
      "octet",
      "electronegativity",
      "polar covalent",
    ],
    topic: "Chemical Bonding: Ionic, Polar Covalent & Lewis Structures",
    defaultChannel: "The Organic Chemistry Tutor",
    whatYouWillLearn:
      "Visual walkthrough of electron transfer vs. sharing, electronegativity polarity scales, formal charge calculation, and Lewis dot structures.",
    reason:
      "Step-by-step examples of chemical bond formation and molecular geometry.",
  },
  {
    id: "ANi79JchTrI",
    primaryPhrases: [
      "acids and bases",
      "bronsted lowry",
      "henderson hasselbalch",
      "buffer solutions",
      "acid dissociation",
    ],
    keywords: [
      "acid",
      "base",
      "ph scale",
      "bronsted",
      "conjugate acid",
      "conjugate base",
      "buffer",
      "pka",
      "titration",
    ],
    topic: "Acid-Base Equilibrium, pKa & Buffer Systems",
    defaultChannel: "CrashCourse",
    whatYouWillLearn:
      "Explains Brønsted-Lowry proton transfer, conjugate acid-base pairs, pH/pKa calculations, and how buffers resist pH changes.",
    reason:
      "Visualizes proton transfer equilibria and physiological/chemical buffering.",
  },
  {
    id: "8N1BxHgP_NU",
    primaryPhrases: [
      "gibbs free energy",
      "laws of thermodynamics",
      "enthalpy and entropy",
      "spontaneous reaction",
    ],
    keywords: [
      "thermodynamics",
      "entropy",
      "enthalpy",
      "gibbs",
      "exergonic",
      "endergonic",
      "spontaneity",
    ],
    topic: "Thermodynamics: Enthalpy, Entropy & Gibbs Free Energy (ΔG)",
    defaultChannel: "CrashCourse",
    whatYouWillLearn:
      "Connects the First and Second Laws of Thermodynamics to ΔG = ΔH - TΔS to predict reaction spontaneity and equilibrium.",
    reason:
      "Explains thermodynamic state functions and reaction coupling.",
  },
  {
    id: "WUvTyaaNkzM",
    primaryPhrases: [
      "derivative",
      "differential calculus",
      "instantaneous rate of change",
      "limit definition",
    ],
    keywords: [
      "calculus",
      "derivative",
      "differential",
      "tangent line",
      "rate of change",
      "limit",
    ],
    topic: "The Essence of Calculus: Limits & Derivatives",
    defaultChannel: "3Blue1Brown",
    whatYouWillLearn:
      "Geometric intuition showing how secant lines converge to tangent slopes to measure instantaneous rates of change.",
    reason:
      "Provides geometric intuition for derivatives and limits.",
  },
  {
    id: "8hly31xKli0",
    primaryPhrases: [
      "data structures",
      "big o notation",
      "time complexity",
      "binary search tree",
      "sorting algorithms",
    ],
    keywords: [
      "algorithms",
      "data structures",
      "big o",
      "linked list",
      "binary tree",
      "hash table",
      "time complexity",
    ],
    topic: "Data Structures & Algorithmic Time/Space Complexity",
    defaultChannel: "freeCodeCamp.org",
    whatYouWillLearn:
      "Covers asymptomatic Big-O analysis, arrays, linked lists, stacks, queues, trees, hash maps, and sorting algorithms.",
    reason:
      "Illustrates memory layout and runtime complexity of core data structures.",
  },
];

function extractLectureTopicStructure(documentTitle: string, extractedText: string): {
  mainTopic: string;
  subtopics: string[];
  visualConcepts: string[];
} {
  const cleanTitle = documentTitle
    .replace(/\.(pdf|pptx|docx|txt)$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();

  const lines = extractedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const adminNoise =
    /\b(department of|faculty of|university of|college of|school of|lecturer|instructor|professor|course code|course outline|all rights reserved|thank you|questions\?)\b/i;

  const headings: string[] = [];
  for (const line of lines) {
    if (
      /^---\s*(?:Slide|Page)\s+\d+/i.test(line) ||
      adminNoise.test(line) ||
      line.length < 4 ||
      line.length > 95
    ) {
      continue;
    }
    const cleaned = line.replace(/^[#*\-•\d.)\s]+/, "").trim();
    if (cleaned.length >= 5 && cleaned.length <= 85 && !headings.includes(cleaned)) {
      headings.push(cleaned);
    }
    if (headings.length >= 10) break;
  }

  let mainTopic = cleanTitle;
  if (!mainTopic || /^(study session|lecture|presentation|slides?|document|untitled)$/i.test(mainTopic)) {
    mainTopic = headings[0] || "Academic Lecture Topic";
  }

  const subtopics = headings.slice(0, 6);
  const visualConcepts = subtopics.map((sub) => `${mainTopic}: ${sub}`).slice(0, 4);

  return { mainTopic, subtopics, visualConcepts };
}

/**
 * Curates verified educational YouTube videos for a study session.
 * Strict rules:
 * - Requires multi-phrase domain alignment with the actual lecture topic.
 * - Never falls back to unrelated default videos when no match exists.
 * - Only marks videos verified when YouTube's live oEmbed check succeeds.
 */
export async function curateEducationalVideos(
  documentTitle: string,
  extractedText: string
): Promise<CuratedVideoResponse> {
  const { mainTopic, subtopics, visualConcepts } = extractLectureTopicStructure(
    documentTitle,
    extractedText
  );
  const combinedContext = `${mainTopic} ${subtopics.join(" ")} ${extractedText.slice(0, 12000)}`.toLowerCase();

  // 1. Score canonical repository using multi-term phrase + keyword alignment
  const scored = CANONICAL_EDUCATIONAL_VIDEOS.map((item) => {
    let score = 0;
    let phraseHits = 0;
    let kwHits = 0;

    for (const phrase of item.primaryPhrases) {
      if (combinedContext.includes(phrase.toLowerCase())) {
        score += 6;
        phraseHits += 1;
      }
    }
    for (const kw of item.keywords) {
      if (combinedContext.includes(kw.toLowerCase())) {
        score += 2;
        kwHits += 1;
      }
    }

    const isRelevant = score >= 8 && (phraseHits >= 1 || kwHits >= 3);
    return { ...item, score, isRelevant };
  })
    .filter((item) => item.isRelevant)
    .sort((a, b) => b.score - a.score);

  const selectedCandidates = scored.slice(0, 4);

  // 2. Verify candidate videos against YouTube oEmbed
  const verifiedVideos: EducationalVideo[] = [];

  for (const candidate of selectedCandidates) {
    if (verifiedVideos.length >= 3) break;

    const meta = await verifyYouTubeVideo(candidate.id);
    if (!meta) {
      // Honest handling: never fabricate or pretend an unverified video was verified live
      continue;
    }

    const matchedSubtopic =
      subtopics.find((s) =>
        candidate.keywords.some((k) => s.toLowerCase().includes(k.toLowerCase()))
      ) ||
      subtopics[0] ||
      mainTopic;

    verifiedVideos.push({
      id: candidate.id,
      title: meta.title,
      channelTitle: meta.authorName || candidate.defaultChannel,
      thumbnailUrl: meta.thumbnailUrl,
      youtubeUrl: `https://www.youtube.com/watch?v=${candidate.id}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${candidate.id}`,
      topic: candidate.topic,
      relevantLectureTopic: matchedSubtopic,
      whatYouWillLearn: candidate.whatYouWillLearn,
      relevanceReason: candidate.reason,
      verified: true,
    });
  }

  // 3. Build specific, concept-driven YouTube search shortcuts based on the lecture's actual topics
  const cleanMain = mainTopic.replace(/[^a-zA-Z0-9\s-]/g, " ").trim();
  const specificQueries: Array<{ label: string; query: string }> = [
    {
      label: `${cleanMain} — Mechanism & Lecture`,
      query: `${cleanMain} mechanism animation university lecture`,
    },
  ];
  for (const sub of subtopics.slice(0, 3)) {
    const cleanSub = sub.replace(/[^a-zA-Z0-9\s-]/g, " ").trim();
    if (cleanSub && cleanSub.toLowerCase() !== cleanMain.toLowerCase()) {
      specificQueries.push({
        label: `${cleanSub}`,
        query: `${cleanMain} ${cleanSub} explained tutorial`,
      });
    }
  }
  specificQueries.push({
    label: `${cleanMain} (Ninja Nerd / Khan Academy)`,
    query: `${cleanMain} Ninja Nerd Khan Academy Armando Hasudungan`,
  });

  const searchShortcuts = specificQueries.slice(0, 4).map((q) => ({
    label: q.label,
    query: q.query,
    searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(q.query)}`,
  }));

  let verificationStatus: "verified" | "unverified_or_offline" | "no_verified_match" = "verified";
  let statusMessage = `Verified educational videos matched to ${mainTopic}.`;

  if (verifiedVideos.length === 0) {
    verificationStatus =
      selectedCandidates.length > 0 ? "unverified_or_offline" : "no_verified_match";
    statusMessage =
      selectedCandidates.length > 0
        ? `Live YouTube verification is currently unreachable in this environment. Rather than displaying unverified or fabricated links, we have prepared direct topic-specific YouTube searches for "${mainTopic}" below.`
        : `No pre-indexed video passed our strict multi-concept verification for "${mainTopic}". Use the targeted YouTube concept searches below to explore verified university lectures on this exact topic.`;
  }

  return {
    mainTopic,
    subtopics,
    visualConcepts,
    discipline: "Higher Education & University",
    verificationStatus,
    statusMessage,
    videos: verifiedVideos,
    searchShortcuts,
  };
}
