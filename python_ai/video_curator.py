"""
LAMLA Guide AI - Topic-Aware Educational Video Research & YouTube Verification Engine
Slogan: "It's Never Too Late To Study."

Implements the 8-Step Topic-Aware YouTube Recommendation Pipeline:
1. Analyze the entire uploaded document using the Shared Academic Blueprint.
2. Identify its main academic subject.
3. Extract its major topics, subtopics, and mechanisms.
4. Determine the specific concepts that benefit most from visual teaching.
5. Construct specific academic YouTube search queries based on those concepts.
6. Search for genuine YouTube videos (live search + multi-discipline academic reference index).
7. Verify every candidate via YouTube's official oEmbed API and evaluate multi-term topic relevance
   (preferring reputable universities, medical educators, and established academic channels).
8. Recommend only verified, topic-relevant videos with:
   - Video title
   - Channel name
   - Direct YouTube link
   - Short explanation of what the student will learn
   - Relevant topic from the uploaded lecture
   If internet access or YouTube verification is unavailable, clearly communicate that rather than
   inventing results or recommending unrelated videos.
"""

import os
import re
import json
import urllib.request
import urllib.parse
from typing import List, Dict, Any, Optional, Tuple

try:
    from ai_engine import PythonAIEngine
except ImportError:
    from python_ai.ai_engine import PythonAIEngine


REPUTABLE_ACADEMIC_CHANNELS = {
    "ninja nerd",
    "osmosis",
    "osmosis from elsevier",
    "armando hasudungan",
    "khan academy",
    "khan academy medicine",
    "ak lectures",
    "crashcourse",
    "crash course",
    "mit opencourseware",
    "the organic chemistry tutor",
    "3blue1brown",
    "professor dave explains",
    "dirty medicine",
    "speed pharmacology",
    "medicosis perfectionalis",
    "alila medical media",
    "bozeman science",
    "amoeba sisters",
    "statquest with josh starmer",
    "marginal revolution university",
    "freecodecamp.org",
    "stanford",
    "yaleonnline",
    "harvard online",
    "oxford academic",
}


# Curated reference catalog of genuine educational YouTube videos across major academic domains.
# Note: A candidate from this catalog is ONLY recommended if:
#   (a) Multiple specific domain phrases/keywords match the uploaded lecture's blueprint, AND
#   (b) Live YouTube oEmbed verification confirms the video is accessible and retrieves its real metadata.
CURATED_ACADEMIC_CATALOG: List[Dict[str, Any]] = [
    # 1. Cell Signalling, GPCRs, G-Proteins, Adenylyl Cyclase & cAMP
    {
        "id": "xT0mAQ4726s",
        "domain_phrases": ["gpcr", "g-protein", "g protein", "adenylyl cyclase", "camp", "second messenger", "protein kinase a", "phospholipase c"],
        "required_min_matches": 2,
        "topic": "G-Protein Coupled Receptors (GPCR) & cAMP Signalling Pathway",
        "default_channel": "Ninja Nerd",
        "what_you_will_learn": "Visualizes 7-transmembrane GPCR activation, G-alpha GDP-to-GTP exchange, subunit dissociation, adenylyl cyclase stimulation, and cAMP/PKA second-messenger cascades.",
    },
    {
        "id": "ZBSo_GFN3qI",
        "domain_phrases": ["gpcr", "g-protein", "g protein", "adenylyl cyclase", "camp", "gq", "gs", "gi", "ip3", "dag"],
        "required_min_matches": 2,
        "topic": "Signal Transduction: Gs, Gi, and Gq Second Messenger Pathways",
        "default_channel": "Alila Medical Media",
        "what_you_will_learn": "Step-by-step animation comparing Gs/Gi modulation of adenylyl cyclase and cAMP with Gq activation of phospholipase C, IP3, and DAG.",
    },
    # 2. Autonomic Pharmacology & Nervous System Receptors
    {
        "id": "D96mSg2_h0c",
        "domain_phrases": ["autonomic", "sympathetic", "parasympathetic", "adrenergic", "cholinergic", "muscarinic", "nicotinic", "acetylcholine", "norepinephrine"],
        "required_min_matches": 2,
        "topic": "Autonomic Nervous System: Sympathetic vs Parasympathetic Pharmacology",
        "default_channel": "Ninja Nerd",
        "what_you_will_learn": "Explains preganglionic and postganglionic neurotransmitters, nicotinic and muscarinic (M1–M3) receptors, and alpha/beta adrenergic receptor mechanisms across target organs.",
    },
    {
        "id": "71pCilo8k4M",
        "domain_phrases": ["autonomic", "sympathetic", "parasympathetic", "cholinergic", "adrenergic", "muscarinic", "adrenoceptor"],
        "required_min_matches": 2,
        "topic": "Autonomic Nervous System Divisions & Neurotransmission",
        "default_channel": "CrashCourse",
        "what_you_will_learn": "Illustrates thoracolumbar sympathetic and craniosacral parasympathetic pathways, ganglionic synapses, and physiological organ responses.",
    },
    # 3. Renal Physiology, Nephron & Glomerular Filtration
    {
        "id": "8UVlXX-9x7Q",
        "domain_phrases": ["glomerular", "filtration", "gfr", "nephron", "bowman", "tubular reabsorption", "afferent", "efferent", "renal"],
        "required_min_matches": 2,
        "topic": "Renal Physiology: Glomerular Filtration Rate (GFR) & Starling Forces",
        "default_channel": "Ninja Nerd",
        "what_you_will_learn": "Demonstrates the glomerular filtration barrier, hydrostatic and oncotic Starling forces, afferent/efferent arteriolar regulation, and tubular reabsorption.",
    },
    # 4. Enzyme Kinetics & Inhibition (Michaelis-Menten, Competitive vs Noncompetitive)
    {
        "id": "aucKR14a0c4",
        "domain_phrases": ["enzyme", "competitive", "noncompetitive", "michaelis", "menten", "km", "vmax", "active site", "allosteric"],
        "required_min_matches": 2,
        "topic": "Enzyme Kinetics: Michaelis-Menten & Competitive vs Noncompetitive Inhibition",
        "default_channel": "Ninja Nerd",
        "what_you_will_learn": "Explains how competitive and noncompetitive inhibitors alter apparent Km and Vmax on Michaelis-Menten and Lineweaver-Burk plots.",
    },
    # 5. Cardiac Electrophysiology & Cardiac Cycle
    {
        "id": "pBg58FvV_m8",
        "domain_phrases": ["cardiac action potential", "pacemaker", "sa node", "ventricular", "phase 0", "phase 2", "depolarization"],
        "required_min_matches": 2,
        "topic": "Cardiac Action Potential & Pacemaker Electrophysiology",
        "default_channel": "Ninja Nerd",
        "what_you_will_learn": "Details Phases 0 through 4 of ventricular cardiomyocyte depolarization, L-type calcium plateau currents, and SA nodal pacemaker potentials.",
    },
    {
        "id": "IS9TD9fSvW8",
        "domain_phrases": ["cardiac cycle", "systole", "diastole", "heart sounds", "wiggers", "isovolumetric", "ventricular pressure"],
        "required_min_matches": 2,
        "topic": "The Cardiac Cycle, Wiggers Diagram & Valve Mechanics",
        "default_channel": "Ninja Nerd",
        "what_you_will_learn": "Walks through atrial and ventricular systole/diastole, isovolumetric contraction and relaxation, pressure-volume changes, and heart sounds.",
    },
    # 6. Neurobiology & Action Potentials
    {
        "id": "OZG8M_ldA1M",
        "domain_phrases": ["neuron", "action potential", "resting membrane potential", "voltage-gated sodium", "depolarization", "repolarization", "synapse"],
        "required_min_matches": 2,
        "topic": "Neuronal Action Potentials & Synaptic Transmission",
        "default_channel": "CrashCourse",
        "what_you_will_learn": "Visualizes resting membrane potential, threshold, voltage-gated Na+ and K+ channel kinetics, refractory periods, and saltatory conduction.",
    },
    # 7. Cellular Respiration & Photosynthesis
    {
        "id": "-rsYk4eCKnA",
        "domain_phrases": ["cellular respiration", "glycolysis", "krebs cycle", "citric acid cycle", "electron transport chain", "oxidative phosphorylation", "atp synthase"],
        "required_min_matches": 2,
        "topic": "Cellular Respiration: Glycolysis, Citric Acid Cycle & Oxidative Phosphorylation",
        "default_channel": "Amoeba Sisters",
        "what_you_will_learn": "Traces glucose oxidation through cytosolic glycolysis, mitochondrial Krebs cycle, and the inner-membrane electron transport chain.",
    },
    {
        "id": "g78utcLQrJ4",
        "domain_phrases": ["photosynthesis", "chloroplast", "calvin cycle", "light-dependent", "thylakoid", "photosystem", "rubisco"],
        "required_min_matches": 2,
        "topic": "Photosynthesis: Light Reactions & The Calvin Cycle",
        "default_channel": "Amoeba Sisters",
        "what_you_will_learn": "Explains light harvesting in thylakoid photosystems (ATP and NADPH generation) and carbon fixation in the Calvin cycle.",
    },
    # 8. Molecular Biology: DNA Replication & Gene Expression
    {
        "id": "TNKWgcFPHqw",
        "domain_phrases": ["dna replication", "helicase", "dna polymerase", "leading strand", "lagging strand", "okazaki", "primase"],
        "required_min_matches": 2,
        "topic": "DNA Structure & Semi-Conservative Replication",
        "default_channel": "CrashCourse",
        "what_you_will_learn": "Shows how helicase unwinds the double helix and how DNA polymerase synthesizes leading and lagging strands with Okazaki fragments.",
    },
    {
        "id": "oefAI2x2CQM",
        "domain_phrases": ["transcription", "translation", "rna polymerase", "ribosome", "mrna", "trna", "codon", "protein synthesis"],
        "required_min_matches": 2,
        "topic": "Protein Synthesis: Transcription & Translation",
        "default_channel": "Amoeba Sisters",
        "what_you_will_learn": "Illustrates mRNA transcription from a DNA template in the nucleus and polypeptide translation at the ribosome.",
    },
    # 9. Economics: Microeconomics & Macroeconomics
    {
        "id": "g9aDizJpd_s",
        "domain_phrases": ["supply and demand", "market equilibrium", "quantity demanded", "quantity supplied", "shortage", "surplus", "demand curve"],
        "required_min_matches": 2,
        "topic": "Supply, Demand & Market Equilibrium",
        "default_channel": "CrashCourse",
        "what_you_will_learn": "Explains the laws of demand and supply, shifts versus movements along curves, and how market equilibrium clears shortages and surpluses.",
    },
    {
        "id": "kUPm2tMCbGE",
        "domain_phrases": ["price elasticity", "elasticity of demand", "inelastic", "total revenue", "cross-price elasticity", "income elasticity"],
        "required_min_matches": 2,
        "topic": "Price Elasticity of Demand & Total Revenue Analysis",
        "default_channel": "Marginal Revolution University",
        "what_you_will_learn": "Demonstrates how to calculate price elasticity of demand, evaluate determinants of elasticity, and predict effects on total revenue.",
    },
    {
        "id": "d8uTB5XorBw",
        "domain_phrases": ["macroeconomics", "gross domestic product", "real gdp", "nominal gdp", "inflation", "business cycle", "unemployment"],
        "required_min_matches": 2,
        "topic": "Macroeconomic Indicators: GDP, Inflation & Growth",
        "default_channel": "CrashCourse",
        "what_you_will_learn": "Breaks down GDP expenditure components (C + I + G + NX), real versus nominal GDP adjustments, and macroeconomic cycles.",
    },
    # 10. Chemistry, Physics, Mathematics & Computer Science
    {
        "id": "CGA8sRwqIFg",
        "domain_phrases": ["covalent bond", "ionic bond", "chemical bonding", "lewis structure", "electronegativity", "octet rule", "valence electron"],
        "required_min_matches": 2,
        "topic": "Chemical Bonding: Ionic vs Polar and Nonpolar Covalent Bonds",
        "default_channel": "The Organic Chemistry Tutor",
        "what_you_will_learn": "Explains electron transfer versus sharing, electronegativity differences, and how to draw accurate Lewis structures.",
    },
    {
        "id": "WUvTyaaNkzM",
        "domain_phrases": ["calculus", "derivative", "differentiation", "instantaneous rate of change", "tangent line", "limit"],
        "required_min_matches": 2,
        "topic": "The Essence of Calculus: Derivatives & Rates of Change",
        "default_channel": "3Blue1Brown",
        "what_you_will_learn": "Provides geometric and visual intuition for limits, derivatives, and instantaneous rates of change.",
    },
]


def verify_youtube_video(video_id: str) -> Optional[Dict[str, str]]:
    """
    Verifies a YouTube video via YouTube's official oEmbed endpoint.
    Returns authentic metadata (title, author_name, thumbnail_url) ONLY if the video genuinely
    exists and is publicly accessible, or None if unavailable or offline.
    """
    if not video_id or not re.match(r"^[A-Za-z0-9_-]{8,15}$", video_id):
        return None
    if os.environ.get("LAMLA_OFFLINE_AI", "false").lower() in ("true", "1", "yes"):
        return None

    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": "LAMLA-Guide-AI-Verifier/2.0"})

    try:
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                title = str(data.get("title") or "").strip()
                author = str(data.get("author_name") or "").strip()
                if not title:
                    return None
                return {
                    "title": title,
                    "author_name": author,
                    "thumbnail_url": data.get("thumbnail_url", f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"),
                }
    except Exception:
        pass
    return None


def _extract_visual_teaching_concepts(blueprint: Dict[str, Any], title: str) -> List[Dict[str, str]]:
    """
    Determines the specific academic concepts in the uploaded lecture that benefit most
    from visual teaching (mechanisms, pathways, structures, diagrams, classifications).
    """
    main_topic = blueprint.get("main_topic") or title or "Core Academic Subject"
    slides = blueprint.get("substantive_slides") or []
    concept_records = blueprint.get("concept_records") or []

    visual_concepts: List[Dict[str, str]] = []
    seen_titles = set()

    # Prioritize slides that contain mechanisms, pathways, diagrams, or classifications
    for s in slides:
        s_title = re.sub(r"\s*[\(\[]\s*(?:Slide|Page)\s*\d+[\)\]]", "", str(s.get("title") or "")).strip()
        if not s_title or s_title.lower() in seen_titles:
            continue
        seen_titles.add(s_title.lower())
        body_low = str(s.get("body") or "").lower()
        has_visual_cue = any(
            k in body_low
            for k in (
                "pathway", "mechanism", "cycle", "receptor", "signalling", "signaling", "cascade",
                "structure", "diagram", "process", "filtration", "action potential", "inhibition",
                "classification", "subunit", "enzyme", "curve", "equilibrium",
            )
        )
        # Extract key terms from this slide's concept records
        slide_terms = [
            c["term"]
            for c in concept_records
            if c.get("slide_num") == s.get("num") and len(str(c.get("term", ""))) > 2
        ][:3]
        search_phrase = f"{main_topic} {s_title}" if main_topic.lower() not in s_title.lower() else s_title
        if slide_terms:
            search_phrase = f"{s_title} {' '.join(slide_terms[:2])}"

        visual_concepts.append({
            "lecture_topic": s_title,
            "search_query": f"{search_phrase} lecture mechanism explained",
            "priority": "high" if has_visual_cue else "normal",
            "summary_focus": ", ".join(slide_terms) if slide_terms else s_title,
        })

    # Sort high-priority visual/mechanistic topics first
    visual_concepts.sort(key=lambda x: 0 if x["priority"] == "high" else 1)

    if not visual_concepts:
        visual_concepts.append({
            "lecture_topic": main_topic,
            "search_query": f"{main_topic} university lecture explained",
            "priority": "high",
            "summary_focus": main_topic,
        })

    return visual_concepts[:6]


def _search_youtube_live_for_concept(search_query: str, lecture_topic: str, main_topic: str) -> List[Dict[str, Any]]:
    """
    Searches YouTube's public search page for a specific academic concept, extracts real video
    candidates, evaluates multi-term topical relevance and channel quality, and verifies via oEmbed.
    """
    if os.environ.get("LAMLA_OFFLINE_AI", "false").lower() in ("true", "1", "yes"):
        return []

    encoded_q = urllib.parse.quote_plus(search_query)
    search_url = f"https://www.youtube.com/results?search_query={encoded_q}"
    req = urllib.request.Request(
        search_url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=4.0) as resp:
            if resp.status != 200:
                return []
            html_text = resp.read().decode("utf-8", errors="ignore")
    except Exception:
        return []

    # Extract videoRenderer blocks or videoId patterns from ytInitialData
    video_ids: List[str] = []
    seen_ids = set()
    for m in re.finditer(r'"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"', html_text):
        vid = m.group(1)
        if vid not in seen_ids:
            seen_ids.add(vid)
            video_ids.append(vid)
        if len(video_ids) >= 6:
            break

    # Tokenize key academic terms from lecture_topic and main_topic for relevance verification
    stop_words = {"the", "and", "for", "with", "from", "into", "lecture", "explained", "overview", "introduction", "part", "mechanism"}
    target_tokens = {
        tok.lower()
        for tok in re.findall(r"[A-Za-z0-9\-]{3,}", f"{lecture_topic} {main_topic} {search_query}")
        if tok.lower() not in stop_words
    }

    verified_results: List[Dict[str, Any]] = []
    for vid in video_ids[:4]:
        meta = verify_youtube_video(vid)
        if not meta or not meta.get("title"):
            continue
        v_title = meta["title"]
        v_channel = meta["author_name"] or "Educational Channel"
        title_low = v_title.lower()
        chan_low = v_channel.lower()

        # Evaluate topic relevance: require at least 2 matching academic terms (or exact multi-word topic match)
        matched_tokens = [t for t in target_tokens if t in title_low]
        exact_topic_in_title = lecture_topic.lower()[:12] in title_low or main_topic.lower()[:12] in title_low
        if len(matched_tokens) < 2 and not exact_topic_in_title:
            continue

        is_reputable = any(rep in chan_low for rep in REPUTABLE_ACADEMIC_CHANNELS)
        relevance_score = len(matched_tokens) * 3 + (5 if is_reputable else 0) + (4 if exact_topic_in_title else 0)

        what_you_will_learn = (
            f"Teaches {lecture_topic} within {main_topic} (by {v_channel}), providing visual explanations of {', '.join(matched_tokens[:4])}."
        )
        verified_results.append({
            "id": vid,
            "title": v_title,
            "channel_title": v_channel,
            "channelTitle": v_channel,
            "thumbnail_url": meta["thumbnail_url"],
            "thumbnailUrl": meta["thumbnail_url"],
            "youtube_url": f"https://www.youtube.com/watch?v={vid}",
            "youtubeUrl": f"https://www.youtube.com/watch?v={vid}",
            "embed_url": f"https://www.youtube-nocookie.com/embed/{vid}",
            "embedUrl": f"https://www.youtube-nocookie.com/embed/{vid}",
            "topic": lecture_topic,
            "relevant_lecture_topic": lecture_topic,
            "relevantLectureTopic": lecture_topic,
            "relevance_reason": what_you_will_learn,
            "relevanceReason": what_you_will_learn,
            "what_you_will_learn": what_you_will_learn,
            "whatYouWillLearn": what_you_will_learn,
            "verified": True,
            "_score": relevance_score,
        })

    verified_results.sort(key=lambda x: x.get("_score", 0), reverse=True)
    return verified_results


def curate_videos_for_text(
    title: str,
    text: str = "",
    user_id: Optional[str] = None,
    content: str = "",
) -> Dict[str, Any]:
    """
    8-Step Topic-Aware YouTube Video Recommendation Engine:
    1. Analyzes the entire uploaded lecture via the Shared Academic Blueprint.
    2. Identifies the main academic subject and major subtopics/mechanisms.
    3. Extracts concepts that benefit from visual teaching and constructs specific search queries.
    4. Searches and verifies genuine YouTube videos (requiring multi-term topical relevance + live oEmbed verification).
    5. Never invents video titles/links and never falls back to unrelated default videos.
    """
    effective_text = text or content or ""
    engine = PythonAIEngine.get_instance()
    blueprint = engine.analyze_academic_presentation(effective_text or title, subject_hint=title, user_id=user_id)
    main_topic = blueprint.get("main_topic") or title or "Course Material"
    subtopics = [
        re.sub(r"\s*[\(\[]\s*(?:Slide|Page)\s*\d+[\)\]]", "", st).strip()
        for st in (blueprint.get("subtopics") or [])
    ]
    visual_concepts = _extract_visual_teaching_concepts(blueprint, main_topic)

    # Construct topic-specific YouTube search shortcuts based on the actual lecture concepts
    search_shortcuts: List[Dict[str, str]] = []
    seen_queries = set()
    for vc in visual_concepts[:4]:
        q_str = f"{vc['lecture_topic']} {main_topic}" if main_topic.lower() not in vc["lecture_topic"].lower() else vc["lecture_topic"]
        q_clean = re.sub(r"[^A-Za-z0-9\s\-]", " ", q_str).strip()
        q_clean = re.sub(r"\s+", " ", q_clean)
        if q_clean.lower() not in seen_queries:
            seen_queries.add(q_clean.lower())
            search_shortcuts.append({
                "label": f"{vc['lecture_topic'][:38]}",
                "query": f"{q_clean} lecture mechanism",
                "searchUrl": f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(q_clean + ' lecture mechanism')}",
            })

    # Add reputable channel search shortcuts tailored to the actual main topic
    clean_main = re.sub(r"[^A-Za-z0-9\s\-]", " ", main_topic).strip()
    for chan_label in ("Ninja Nerd", "Khan Academy", "ARMANDO / Osmosis"):
        chan_q = f"{clean_main} {chan_label.split('/')[0].strip()}"
        search_shortcuts.append({
            "label": f"{main_topic[:24]} ({chan_label})",
            "query": chan_q,
            "searchUrl": f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(chan_q)}",
        })

    verified_videos: List[Dict[str, Any]] = []
    seen_video_ids = set()

    # Step A: Score curated multi-discipline catalog using strict multi-phrase matching (never single-keyword)
    corpus_low = f"{main_topic} {' '.join(subtopics)} {(text or '')[:25000]}".lower()
    scored_catalog: List[Tuple[int, Dict[str, Any], str]] = []
    for item in CURATED_ACADEMIC_CATALOG:
        matched_phrases = [p for p in item["domain_phrases"] if p.lower() in corpus_low]
        min_req = item.get("required_min_matches", 2)
        if len(matched_phrases) >= min_req:
            # Map to the closest lecture subtopic
            best_subtopic = item["topic"]
            for vc in visual_concepts:
                if any(mp in vc["lecture_topic"].lower() for mp in matched_phrases):
                    best_subtopic = vc["lecture_topic"]
                    break
            scored_catalog.append((len(matched_phrases) * 4, item, best_subtopic))

    scored_catalog.sort(key=lambda x: x[0], reverse=True)

    for _, cand, matched_lecture_topic in scored_catalog[:4]:
        if len(verified_videos) >= 3:
            break
        if cand["id"] in seen_video_ids:
            continue
        meta = verify_youtube_video(cand["id"])
        if meta and meta.get("title"):
            seen_video_ids.add(cand["id"])
            v_title = meta["title"]
            v_chan = meta["author_name"] or cand["default_channel"]
            learn_desc = cand["what_you_will_learn"]
            verified_videos.append({
                "id": cand["id"],
                "title": v_title,
                "channel_title": v_chan,
                "channelTitle": v_chan,
                "thumbnail_url": meta["thumbnail_url"],
                "thumbnailUrl": meta["thumbnail_url"],
                "youtube_url": f"https://www.youtube.com/watch?v={cand['id']}",
                "youtubeUrl": f"https://www.youtube.com/watch?v={cand['id']}",
                "embed_url": f"https://www.youtube-nocookie.com/embed/{cand['id']}",
                "embedUrl": f"https://www.youtube-nocookie.com/embed/{cand['id']}",
                "topic": matched_lecture_topic,
                "relevant_lecture_topic": matched_lecture_topic,
                "relevantLectureTopic": matched_lecture_topic,
                "relevance_reason": learn_desc,
                "relevanceReason": learn_desc,
                "what_you_will_learn": learn_desc,
                "whatYouWillLearn": learn_desc,
                "verified": True,
            })

    # Step B: Perform live topic-aware YouTube search for specific visual concepts if < 3 verified videos
    if len(verified_videos) < 3:
        for vc in visual_concepts[:3]:
            if len(verified_videos) >= 3:
                break
            live_matches = _search_youtube_live_for_concept(
                vc["search_query"],
                vc["lecture_topic"],
                main_topic,
            )
            for lm in live_matches:
                if lm["id"] not in seen_video_ids and len(verified_videos) < 3:
                    seen_video_ids.add(lm["id"])
                    lm.pop("_score", None)
                    verified_videos.append(lm)

    # Honest reporting when live YouTube verification is unreachable or no verified video exists
    verification_status = "verified" if verified_videos else "unverified_or_offline"
    status_message = (
        f"Verified {len(verified_videos)} educational YouTube video(s) directly matching the topics in {main_topic}."
        if verified_videos
        else (
            f"Live YouTube verification is currently unavailable or no pre-verified video could be confirmed online for '{main_topic}'. "
            f"In accordance with strict academic honesty, unverified or fabricated videos are never shown. "
            f"Use the topic-specific YouTube search links below to open lessons for {', '.join(vc['lecture_topic'] for vc in visual_concepts[:3])}."
        )
    )

    return {
        "success": True,
        "main_topic": main_topic,
        "mainTopic": main_topic,
        "subtopics": subtopics[:10],
        "visual_concepts": [vc["lecture_topic"] for vc in visual_concepts],
        "verification_status": verification_status,
        "status_message": status_message,
        "videos": verified_videos[:3],
        "search_shortcuts": search_shortcuts,
        "searchShortcuts": search_shortcuts,
    }
