"""
Comprehensive Automated Verification Suite for LAMLA Guide AI:
1. Summary (No tables, no 'Slide 1 Summary' headings, cohesive paragraphs + purposeful bullets)
2. Detailed Notes (Textbook depth > Summary, topic headings instead of 'Slide 1/2/3', lecturer vs supplementary distinction, verified reference links)
3. Flashcards (Concept-driven active recall, strict rejection of 'What is on slide one?' / 'Explain slide two' / vague 'Explain X')
4. Quizzes (All 8 examination formats: mcq, multiple_select, assertion_reasoning, true_false, matching, fill_in_the_blank, short_answer, application)
5. Intelligent YouTube Video Recommendations (8-step topic-aware pipeline via Shared Academic Blueprint, GPCR/cAMP signalling test, zero unrelated fallback videos, honest offline handling)
6. Shared Academic Blueprint & Document Coverage across 7 diverse lecture types (short, large, complex medical, diagrams, tables, scanned, incomplete text).
"""

import os
import re
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from python_ai.ai_engine import PythonAIEngine
from python_ai.video_curator import curate_videos_for_text


GPCR_MEDICAL_LECTURE = """
--- Slide 1: Cover Page ---
University of Ghana Medical School
Department of Pharmacology and Toxicology
Course Code: PHAR 301
Lecturer: Prof. K. Mensah
Academic Year: 2026/2027

--- Slide 2: G-Protein Coupled Receptors (GPCRs) & Heptahelical Architecture ---
G-protein coupled receptors (GPCRs) constitute the largest superfamily of cell-surface transmembrane receptors, characterized by seven alpha-helical transmembrane domains (7-TM).
The extracellular N-terminus and loops form the orthosteric ligand-binding pocket, whereas the intracellular loops (especially IL3) and C-terminus couple to heterotrimeric G-proteins composed of G-alpha, G-beta, and G-gamma subunits.
In the basal inactive state, the G-alpha subunit is bound to guanosine diphosphate (GDP) and remains associated with the obligate G-beta-gamma dimer.

--- Slide 3: Gs and Gi Signalling — Adenylyl Cyclase, cAMP & Protein Kinase A (PKA) ---
Agonist binding induces a conformational shift in the 7-TM bundle that acts as a guanine nucleotide exchange factor (GEF), catalyzing GDP release and GTP binding to G-alpha.
G-alpha-s (Gs) stimulates membrane-bound adenylyl cyclase, which converts adenosine triphosphate (ATP) into the second messenger 3',5'-cyclic adenosine monophosphate (cAMP).
Elevated intracellular cAMP binds to the regulatory subunits of Protein Kinase A (PKA), releasing active catalytic subunits that phosphorylate serine and threonine residues on downstream target proteins such as CREB and L-type calcium channels.
Conversely, G-alpha-i (Gi) inhibits adenylyl cyclase activity, decreasing intracellular cAMP levels and opening GIRK potassium channels via G-beta-gamma subunits.

--- Slide 4: Gq Signalling Cascade — Phospholipase C, IP3, DAG & Calcium Mobilization ---
[Diagram: Flowchart showing Gq-alpha-GTP activating Phospholipase C-beta -> PIP2 cleavage into IP3 (ER Ca2+ release) and DAG (PKC activation)]
Receptors coupled to G-alpha-q (Gq), including alpha-1 adrenergic and M1/M3 muscarinic receptors, activate membrane-bound Phospholipase C-beta (PLC-beta).
PLC-beta hydrolyzes phosphatidylinositol 4,5-bisphosphate (PIP2) into two distinct second messengers: inositol 1,4,5-trisphosphate (IP3) and diacylglycerol (DAG).
Soluble IP3 diffuses through the cytosol to bind ligand-gated IP3 receptors on the endoplasmic reticulum, triggering rapid Ca2+ efflux into the cytoplasm, while membrane-bound DAG works synergistically with Ca2+ to activate Protein Kinase C (PKC).

--- Slide 5: Receptor Desensitization, GRKs, Beta-Arrestin & Signal Termination ---
| Regulatory Component | Molecular Mechanism | Physiological Outcome |
| Intrinsic GTPase Activity | G-alpha hydrolyzes bound GTP back to GDP (accelerated by RGS proteins) | Reassociation of G-alpha-GDP with G-beta-gamma heterotrimer |
| GPCR Kinases (GRKs) | Phosphorylate agonist-occupied GPCR C-terminal serine/threonine residues | Creates high-affinity docking sites for beta-arrestin recruitment |
| Beta-Arrestin Binding | Sterically uncouples GPCR from G-proteins and recruits clathrin/AP2 | Receptor internalization via clathrin-coated pits and homologous desensitization |
| Phosphodiesterases (PDEs) | Hydrolyze 3',5'-cAMP into inactive 5'-AMP | Rapid termination of PKA second-messenger signalling |
"""


def test_1_summary_strict_academic_standards(engine: PythonAIEngine):
    print("\n[TEST 1] Testing Summary Generation (No Tables, No Slide Headings, Academic Depth)...")
    summary = engine.generate_exam_summary(
        GPCR_MEDICAL_LECTURE,
        document_title="GPCR Signalling & Second Messengers",
        style="Detailed Academic",
        educational_level="University",
        user_id="test-user-upgrade",
    )

    assert len(summary) > 600, f"Summary too short ({len(summary)} chars)"

    # Rule 1: NEVER present the main summary as a table
    table_lines = [
        ln for ln in summary.splitlines()
        if ln.strip().startswith("|") and ln.strip().endswith("|")
    ]
    assert len(table_lines) == 0, f"Summary must NEVER contain Markdown tables! Found: {table_lines[:2]}"

    # Rule 2: NEVER create headings such as "Slide 1 Summary", "Slide 2 Summary"
    slide_headings = re.findall(r"^#{1,6}\s*(?:Slide|Page)\s*\d+", summary, flags=re.IGNORECASE | re.MULTILINE)
    assert len(slide_headings) == 0, f"Summary must NEVER contain Slide X headings! Found: {slide_headings}"

    # Rule 3: NEVER include [Slide X] badges or "What is on slide one?"
    assert not re.search(r"\[(?:Source:\s*)?(?:Slide|Page)\s*\d+\]", summary, flags=re.IGNORECASE), (
        "Summary must not contain [Slide X] source tags!"
    )
    assert "what is on slide" not in summary.lower(), "Summary must not ask 'What is on slide...'"

    # Rule 4: Must skip lecturer/department metadata and explain actual GPCR concepts
    assert "prof. k. mensah" not in summary.lower(), "Summary wasted space on lecturer name!"
    assert "adenylyl cyclase" in summary.lower() or "camp" in summary.lower(), (
        "Summary failed to explain core cAMP / adenylyl cyclase mechanism!"
    )
    assert "phospholipase c" in summary.lower() or "ip3" in summary.lower(), (
        "Summary failed to explain Gq / PLC / IP3 pathway!"
    )
    print("  -> PASS: Summary is a genuine, multi-paragraph academic synthesis with zero tables and zero slide-number headings.")
    return summary


def test_2_detailed_notes_textbook_standards(engine: PythonAIEngine, summary_text: str):
    print("\n[TEST 2] Testing Detailed Notes (Textbook Depth, Topic Headings, Verified References)...")
    notes = engine.generate_study_notes(
        GPCR_MEDICAL_LECTURE,
        subject="Pharmacology & Cell Signalling",
        educational_level="University",
        user_id="test-user-upgrade",
    )

    # Rule 1: Detailed Notes must be substantially more comprehensive than Summary
    assert len(notes) > len(summary_text), (
        f"Detailed Notes ({len(notes)} chars) must be more comprehensive than Summary ({len(summary_text)} chars)!"
    )

    # Rule 2: NEVER organize headings as "Slide 1", "Slide 2", "Slide 3"
    bad_headings = re.findall(r"^#{1,6}\s*(?:Slide|Page)\s*\d+", notes, flags=re.IGNORECASE | re.MULTILINE)
    assert len(bad_headings) == 0, f"Detailed Notes must NEVER use 'Slide X' headings! Found: {bad_headings}"

    # Rule 3: Must use meaningful numbered academic topic headings (## 1. <Topic Title>)
    topic_headings = re.findall(r"^##\s+\d+\.\s+.+$", notes, flags=re.MULTILINE)
    assert len(topic_headings) >= 3, f"Expected numbered academic topic headings (## 1. <Topic>), found: {topic_headings}"

    # Rule 4: Must distinguish lecturer material from supplementary academic expansion & include verified reference links
    assert "Core Lecture Concepts" in notes, "Detailed Notes must clearly label Core Lecture Concepts!"
    assert "Supplementary Academic Context" in notes, (
        "Detailed Notes must clearly label Supplementary Academic Context & Textbook Expansion!"
    )
    assert "https://www.ncbi.nlm.nih.gov/books/" in notes or "https://www.guidetopharmacology.org" in notes, (
        "Detailed Notes must include genuine verified academic reference links!"
    )
    print(f"  -> PASS: Detailed Notes ({len(notes)} chars vs Summary {len(summary_text)} chars) uses topic headings and verified textbook references.")


def test_3_flashcards_strict_concept_questions(engine: PythonAIEngine):
    print("\n[TEST 3] Testing Flashcards (Concept-Driven Questions & Strict Banned-Prompt Rejection)...")
    # Verify banned presentation-structure questions are rejected by validator
    banned_examples = [
        ("What is discussed on slide one?", "G-protein coupled receptors are 7-TM receptors."),
        ("Explain slide two", "Gs activates adenylyl cyclase to produce cAMP."),
        ("What is the main point of slide three?", "Gq activates phospholipase C."),
        ("What does the lecturer explain on this slide?", "Beta-arrestin mediates receptor internalization."),
        ("Explain the content of this presentation", "This lecture covers GPCR signalling pathways."),
        ("Explain G-protein coupled receptors", "They are 7-TM receptors."),
    ]
    for bad_q, ans in banned_examples:
        assert not engine._is_valid_academic_flashcard(bad_q, ans), (
            f"Validator failed to reject banned flashcard prompt: '{bad_q}'"
        )

    cards = engine.generate_flashcards(
        GPCR_MEDICAL_LECTURE,
        count=12,
        user_id="test-user-upgrade",
    )
    assert len(cards) >= 8, f"Expected at least 8 flashcards, got {len(cards)}"

    for idx, card in enumerate(cards):
        front = card.get("front", "")
        back = card.get("back", "")
        assert engine._is_valid_academic_flashcard(front, back), (
            f"Generated flashcard #{idx + 1} failed academic validation: front='{front}' back='{back}'"
        )
        assert not re.search(r"\bslide\s+\d+\b", front, flags=re.IGNORECASE), (
            f"Flashcard front contains slide number: {front}"
        )
        assert not re.search(r"\[(?:Slide|Page)\s*\d+\]", back, flags=re.IGNORECASE), (
            f"Flashcard back contains [Slide X] reference: {back}"
        )

    print(f"  -> PASS: All {len(cards)} flashcards ask specific academic concept questions and all 6 banned patterns are strictly rejected.")


def test_4_quizzes_all_eight_formats(engine: PythonAIEngine):
    print("\n[TEST 4] Testing Quiz Generation Across All 8 Examination Formats...")
    required_formats = [
        "mcq",
        "multiple_select",
        "assertion_reasoning",
        "true_false",
        "matching",
        "fill_in_the_blank",
        "short_answer",
        "application",
    ]

    for fmt in required_formats:
        questions = engine.generate_practice_quiz(
            GPCR_MEDICAL_LECTURE,
            question_count=4,
            difficulty="intermediate",
            question_type=fmt,
            user_id="test-user-upgrade",
        )
        assert len(questions) == 4, f"Expected 4 questions for format '{fmt}', got {len(questions)}"
        seen_stems = set()
        for q in questions:
            assert q.get("type") == fmt, f"Expected type '{fmt}', got '{q.get('type')}'"
            stem = q.get("question", "")
            assert len(stem) >= 20, f"Question stem too short for {fmt}: {stem}"
            assert not re.search(r"\b(?:on|in)\s+slide\s+\d+\b", stem, flags=re.IGNORECASE), (
                f"Question stem mentions slide number: {stem}"
            )
            norm_stem = re.sub(r"[^a-z0-9]", "", stem.lower())
            assert norm_stem not in seen_stems, f"Duplicate question stem generated in '{fmt}'!"
            seen_stems.add(norm_stem)
            assert q.get("correctAnswer"), f"Missing correctAnswer in '{fmt}'"
            assert q.get("explanation") and len(q["explanation"]) >= 20, f"Missing/short explanation in '{fmt}'"

            if fmt == "multiple_select":
                assert "I." in stem and "II." in stem and "III." in stem, (
                    f"Multiple-select question must contain Roman numeral statements I, II, III: {stem}"
                )
                assert len(q.get("options", [])) == 4, "Multiple-select must have 4 combination options"

    # Also test mixed mode cycling all 8 formats
    mixed_questions = engine.generate_practice_quiz(
        GPCR_MEDICAL_LECTURE,
        question_count=8,
        difficulty="intermediate",
        question_type="mixed",
        user_id="test-user-upgrade",
    )
    mixed_types = {q.get("type") for q in mixed_questions}
    assert len(mixed_types) >= 6, f"Mixed quiz should span diverse formats, got: {mixed_types}"
    print(f"  -> PASS: All 8 quiz formats ({', '.join(required_formats)}) generated, verified, and deduplicated.")


def test_5_intelligent_youtube_recommendations():
    print("\n[TEST 5] Testing Intelligent 8-Step Topic-Aware YouTube Video Recommendations...")
    res = curate_videos_for_text(
        title="G-Protein Coupled Receptors & Second Messenger Signalling",
        content=GPCR_MEDICAL_LECTURE,
        user_id="test-user-upgrade",
    )

    main_topic = res.get("main_topic", "")
    subtopics = res.get("subtopics", [])
    visual_concepts = res.get("visual_concepts", [])
    shortcuts = res.get("searchShortcuts", [])
    videos = res.get("videos", [])
    status = res.get("verification_status")

    assert "gpcr" in main_topic.lower() or "g-protein" in main_topic.lower() or "signalling" in main_topic.lower(), (
        f"Expected GPCR main topic, got: {main_topic}"
    )
    assert len(subtopics) >= 3, f"Expected >= 3 extracted lecture subtopics, got: {subtopics}"
    assert len(visual_concepts) >= 2, f"Expected >= 2 visual concepts, got: {visual_concepts}"
    assert len(shortcuts) >= 2, "Expected specific YouTube search shortcuts"

    # Verify search queries are specific to GPCR / cAMP / PLC signalling, NOT generic or unrelated
    joined_queries = " ".join(s.get("query", "") for s in shortcuts).lower()
    assert any(term in joined_queries for term in ["gpcr", "g-protein", "adenylyl cyclase", "camp", "second messenger"]), (
        f"Search shortcuts are not specific to GPCR signalling: {shortcuts}"
    )

    # Verify zero unrelated fallback videos (e.g. Economics Supply & Demand)
    for v in videos:
        v_topic = (v.get("topic", "") + " " + v.get("title", "")).lower()
        assert "supply" not in v_topic and "demand" not in v_topic, (
            f"Unrelated fallback video recommended for GPCR lecture: {v}"
        )
        # Check all 5 mandatory fields when a verified video is present
        assert v.get("title"), "Missing video title"
        assert v.get("channel_title"), "Missing channel name"
        assert v.get("youtube_url", "").startswith("https://www.youtube.com/watch?v="), "Missing direct YouTube URL"
        assert v.get("what_you_will_learn"), "Missing 'what_you_will_learn' explanation"
        assert v.get("relevant_lecture_topic"), "Missing 'relevant_lecture_topic'"

    assert status in ("verified", "unverified_or_offline", "no_verified_match"), f"Unexpected status: {status}"
    if len(videos) == 0:
        assert res.get("status_message"), "Must provide honest status_message when offline/unverified!"

    print(
        f"  -> PASS: Video Curator analyzed main_topic='{main_topic}', "
        f"{len(subtopics)} subtopics, {len(visual_concepts)} visual concepts, "
        f"status='{status}', verified_videos={len(videos)}."
    )


def test_6_seven_diverse_lecture_types_and_coverage(engine: PythonAIEngine):
    print("\n[TEST 6] Testing Shared Academic Blueprint & Coverage Across All 7 Diverse Lecture Types...")

    # 1. Short lecture (3 slides)
    short_lecture = (
        "--- Slide 1: Enzyme Kinetics & Catalysis ---\n"
        "Enzymes accelerate biochemical reactions by lowering the Gibbs free energy of activation without altering equilibrium.\n\n"
        "--- Slide 2: Michaelis-Menten Kinetics ---\n"
        "Km equals the substrate concentration at half Vmax and reflects inverse affinity of the enzyme for its substrate.\n\n"
        "--- Slide 3: Competitive vs Non-Competitive Inhibition ---\n"
        "Competitive inhibitors bind the active site and increase apparent Km without changing Vmax, whereas non-competitive inhibitors bind an allosteric site and decrease Vmax."
    )

    # 2. Large lecture (42 slides)
    large_slides = []
    for i in range(1, 43):
        large_slides.append(
            f"--- Slide {i}: Renal Physiology & Nephron Segment {i} ---\n"
            f"In nephron functional module {i}, glomerular filtration rate (GFR) and tubular transport regulate plasma osmolality and Starling hydrostatic pressure gradients across segment {i}.\n"
            f"Active sodium-potassium ATPase pumps establish the electrochemical driving force for secondary active cotransport in segment {i}."
        )
    large_lecture = "\n\n".join(large_slides)

    # 3. Complex medical topic (GPCR_MEDICAL_LECTURE already defined)
    # 4. Slides with diagrams
    diagram_lecture = (
        "--- Slide 1: Cardiac Cycle & Wiggers Diagram ---\n"
        "[Diagram: Wiggers Diagram plotting Aortic Pressure, Left Ventricular Pressure, Left Ventricular Volume, ECG, and Heart Sounds S1/S2]\n"
        "Isovolumetric contraction begins at mitral valve closure (S1) and ends when left ventricular pressure exceeds aortic pressure (~80 mmHg).\n\n"
        "--- Slide 2: Ventricular Ejection & Isovolumetric Relaxation ---\n"
        "Closure of the aortic valve generates the second heart sound (S2) and marks the onset of isovolumetric relaxation."
    )

    # 5. Slides with tables
    table_lecture = (
        "--- Slide 1: Autonomic Receptor Subtypes Comparison Table ---\n"
        "| Receptor Subtype | G-Protein Coupling | Second Messenger Effect | Primary Physiological Response |\n"
        "| Alpha-1 Adrenergic | Gq | Increases IP3 and DAG via PLC-beta | Vascular smooth muscle vasoconstriction |\n"
        "| Beta-1 Adrenergic | Gs | Increases cAMP via Adenylyl Cyclase | Positive chronotropy and inotropy in SA node and myocardium |\n"
        "| Muscarinic M2 | Gi | Decreases cAMP and opens K+ channels | Parasympathetic bradycardia and decreased AV nodal conduction |"
    )

    # 6. Scanned document with OCR notice
    scanned_lecture = (
        "--- Slide 1: Action Potential Propagation ---\n"
        "Voltage-gated sodium channels open rapidly when membrane potential reaches threshold (-55 mV).\n\n"
        "--- Slide 2: Scanned Oscilloscope Trace ---\n"
        "[OCR Notice: Slide 2 contains scanned visual material that could not be transcribed automatically.]\n\n"
        "--- Slide 3: Refractory Periods ---\n"
        "The absolute refractory period prevents backward propagation because Na+ inactivation gates remain closed until repolarization."
    )

    # 7. Poorly formatted / incomplete text with heavy boilerplate
    incomplete_lecture = (
        "--- Slide 1: Title ---\n"
        "Department of Economics, Faculty of Social Sciences, Lecturer: Dr. A. Boateng, Course Outline\n\n"
        "--- Slide 2: Price Elasticity of Demand ---\n"
        "Price elasticity of demand measures the responsiveness of quantity demanded to a change in price (% change in Qd / % change in P).\n\n"
        "--- Slide 3: Fragmented Note ---\n"
        "Total revenue test: elastic demand -> price increase reduces total revenue."
    )

    lecture_suite = [
        ("short_lecture", short_lecture),
        ("large_lecture", large_lecture),
        ("complex_medical", GPCR_MEDICAL_LECTURE),
        ("diagram_lecture", diagram_lecture),
        ("table_lecture", table_lecture),
        ("scanned_lecture", scanned_lecture),
        ("incomplete_lecture", incomplete_lecture),
    ]

    for name, text in lecture_suite:
        bp = engine.analyze_academic_presentation(text, document_title=name, user_id="test-user-upgrade")
        cov = bp.get("coverage_report", {})
        assert cov.get("coverage_verified") is True, f"Coverage not verified for {name}!"
        assert cov.get("substantive_slides_analyzed", 0) >= 1, f"Zero substantive slides for {name}!"

        if name == "scanned_lecture":
            assert cov.get("ocr_or_incomplete_slides_count", 0) >= 1, (
                "Scanned lecture must report OCR/incomplete slide notice honestly!"
            )
            assert cov.get("honest_notice"), "Scanned lecture must populate honest_notice!"

        if name == "diagram_lecture":
            assert cov.get("diagram_slides_count", 0) >= 1, "Diagram lecture must detect diagram slides!"

        if name == "table_lecture":
            assert cov.get("table_slides_count", 0) >= 1, "Table lecture must detect table slides!"

        print(
            f"  -> Verified '{name}': total={cov.get('total_raw_slides')}, "
            f"substantive={cov.get('substantive_slides_analyzed')}, "
            f"diagrams={cov.get('diagram_slides_count')}, tables={cov.get('table_slides_count')}, "
            f"ocr_notices={cov.get('ocr_or_incomplete_slides_count')}"
        )


def main():
    print("=" * 76)
    print("LAMLA GUIDE AI — 5-FEATURE ACADEMIC UPGRADE & COVERAGE VERIFICATION SUITE")
    print("=" * 76)
    engine = PythonAIEngine.get_instance()
    # Use deterministic/local verification mode so tests execute deterministically & fast offline
    prev_mode = engine.mode
    engine.set_mode("local_only")
    try:
        summary_text = test_1_summary_strict_academic_standards(engine)
        test_2_detailed_notes_textbook_standards(engine, summary_text)
        test_3_flashcards_strict_concept_questions(engine)
        test_4_quizzes_all_eight_formats(engine)
        test_5_intelligent_youtube_recommendations()
        test_6_seven_diverse_lecture_types_and_coverage(engine)
    finally:
        engine.set_mode(prev_mode)

    print("\n" + "=" * 76)
    print("ALL 6 UPGRADE & QA SUITES PASSED (EXIT CODE 0)")
    print("=" * 76)


if __name__ == "__main__":
    main()
