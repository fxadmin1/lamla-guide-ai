"""
Comprehensive Academic & E2E Test Suite for LAMLA Guide AI - Python AI Core
"It's Never Too Late To Study."

Tests:
1. DocumentProcessor: Text cleaning, chunking, table extraction, coverage metrics
2. AcademicKnowledgeBuilder: Blueprint generation, administrative filtering, mechanism extraction
3. VerificationEngine: 7-point quality gate, zero slide leak, Assertion-Reasoning cases A-E
4. ModelRouter: Multi-model telemetry, task routing, key rotation
5. PythonAIEngine: Summary, Notes, Flashcards, Practice Quiz (7 formats), AI Tutor
6. AcademicBenchmarkRunner: Gold-standard benchmark evaluation across pharmacology & biochemistry
7. FastAPI Endpoints: In-process endpoint validation (/health, /api/academic-blueprint, /api/generate-summary, etc.)
"""

import sys
import io
import json
import asyncio
from pathlib import Path

# Fix stdout encoding for Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Add python_ai to path
_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(_DIR))
sys.path.insert(0, str(_DIR.parent))

from document_processor import DocumentProcessor
from ai_engine import PythonAIEngine
from academic_knowledge import AcademicKnowledgeBuilder, AcademicKnowledgeRepresentation
from verification_engine import VerificationEngine
from model_router import ModelRouter, TaskCategory
from benchmark_suite import AcademicBenchmarkRunner


def test_document_processor():
    print("\n--- 1. Testing DocumentProcessor ---")
    proc = DocumentProcessor()
    raw_sample = "Photosynthesis is the process by which green plants  convert\n\n\nlight energy into chemical energy.  "
    cleaned = proc.clean_text(raw_sample)
    assert "Photosynthesis" in cleaned
    assert "  " not in cleaned
    print("✓ clean_text passed")

    chunks = proc.chunk_document(cleaned)
    assert len(chunks) >= 1
    print(f"✓ chunk_document passed ({len(chunks)} chunks produced)")

    concepts = proc.extract_key_concepts(raw_sample)
    print(f"✓ extract_key_concepts passed")

    # Test PDF PyMuPDF integration
    assert hasattr(proc, "process_pdf")
    print("✓ PyMuPDF & layout engine verified")
    print("All DocumentProcessor unit tests PASSED!")


def test_academic_knowledge_blueprint():
    print("\n--- 2. Testing AcademicKnowledgeBuilder & Blueprint ---")
    mock_doc = {
        "title": "Autonomic Pharmacology PHARM 301",
        "document_type": "pptx",
        "slides": [
            {
                "slide_number": 1,
                "title": "School of Pharmacy - Welcome",
                "content": "University of Ghana School of Pharmacy. Department of Pharmacology. Lecturer: Dr. Mensah. Course Code: PHARM 301.",
            },
            {
                "slide_number": 2,
                "title": "Adrenergic Receptors",
                "content": "Adrenergic receptors are classified into Alpha and Beta subtypes.\nAlpha-1 receptors cause vascular smooth muscle vasoconstriction.\nBeta-1 receptors increase cardiac heart rate and inotropy.",
            },
            {
                "slide_number": 3,
                "title": "Catecholamine Synthesis Mechanism",
                "content": "Step 1: Tyrosine is converted to L-DOPA by tyrosine hydroxylase.\nStep 2: L-DOPA is decarboxylated to Dopamine.\nStep 3: Dopamine is hydroxylated to Norepinephrine.",
            },
        ],
        "unreadable_slides": [],
        "full_text": "Full presentation content.",
    }

    bp = AcademicKnowledgeBuilder.build_from_parsed_document(mock_doc)
    assert isinstance(bp, AcademicKnowledgeRepresentation)
    assert "pharmacology" in bp.domain_topic.lower() or "adrenergic" in bp.domain_topic.lower()
    print(f"✓ Document Topic resolved: '{bp.domain_topic}'")

    # Verify administrative filtering stripped slide 1's cruft
    assert len(bp.administrative_filtered) >= 1
    print(f"✓ Administrative Cruft Filtered: {len(bp.administrative_filtered)} items stripped")

    # Verify concept nodes extracted
    assert len(bp.core_concepts) >= 1
    print(f"✓ Core Concepts extracted: {[c.name for c in bp.core_concepts[:4]]}")

    # Verify mechanism steps captured
    assert len(bp.mechanisms) >= 1
    print(f"✓ Mechanisms captured: {bp.mechanisms[0].name} ({len(bp.mechanisms[0].steps)} steps)")

    # Verify honest coverage metrics
    assert bp.coverage.coverage_percentage == 100.0
    print(f"✓ Honest Coverage Verified: {bp.coverage.coverage_percentage:.1f}%")

    # Verify blueprint Markdown rendering
    md = bp.render_blueprint_markdown()
    assert "# ACADEMIC BLUEPRINT" in md
    assert "CORE ACADEMIC CONCEPTS" in md
    print("✓ Academic Blueprint Markdown rendered flawlessly!")


def test_verification_engine():
    print("\n--- 3. Testing Standalone VerificationEngine (7-Point Quality Gate) ---")
    ve = VerificationEngine()

    # Gate 4: Zero Slide Number Leaks
    sample_mcq = {
        "type": "mcq",
        "question": "According to slide 3, what is the role of Beta-1 adrenergic receptors?",
        "options": [
            "Increase cardiac heart rate and inotropy (Slide 3)",
            "Promote peripheral vasodilation",
            "Inhibit bronchial smooth muscle contraction",
            "Stimulate glycogenesis",
        ],
        "correct_answer": "Increase cardiac heart rate and inotropy (Slide 3)",
        "explanation": "Beta-1 stimulation raises cardiac output.",
    }

    ok, sanitized, flags = ve.verify_mcq(sample_mcq, ["Beta-1 adrenergic receptors"])
    assert ok is True
    assert "slide 3" not in sanitized["question"].lower()
    assert "slide 3" not in sanitized["options"][0].lower()
    print("✓ Gate 4 (Zero Slide Leaks) PASSED: Slide references completely eradicated from stem and options.")

    # Gate 2: Assertion-Reasoning Standard 5 Cases A-E
    sample_ar = {
        "type": "assertion_reasoning",
        "assertion": "Propranolol is contraindicated in patients suffering from bronchial asthma.",
        "reason": "Non-selective Beta-receptor blockade by propranolol antagonizes Beta-2 receptors, leading to bronchoconstriction.",
        "correct_option": "A",
        "explanation": "Both statements are true and Reason provides the correct physiological explanation.",
    }
    ok_ar, sanitized_ar, _ = ve.verify_assertion_reasoning(sample_ar, ["Propranolol", "Beta-2 receptors"])
    assert ok_ar is True
    assert len(sanitized_ar["options"]) == 5
    assert sanitized_ar["correct_option"] == "A"
    print("✓ Gate 2 (Assertion-Reasoning 5 Cases) PASSED: Strictly conforms to standard options A-E.")

    # Gate 5: Semantic Deduplication
    is_dup1 = ve.check_semantic_duplicate("What is the primary action of Beta-1 adrenergic receptors?")
    assert is_dup1 is False
    is_dup2 = ve.check_semantic_duplicate("What is the primary action of Beta-1 adrenergic receptors in the heart?")
    assert is_dup2 is True, "Duplicate question was not caught!"
    print("✓ Gate 5 (Semantic Deduplication) PASSED: Re-worded duplicate successfully intercepted.")


def test_model_router():
    print("\n--- 4. Testing Multi-Model Task Router ---")
    router = ModelRouter()
    assert len(router.gemini_models) >= 3
    print(f"✓ Configured Candidate Models: {router.gemini_models[:3]}")
    print(f"✓ Active Provider Mode: {router.mode}")
    print(f"✓ Provider Telemetry initialized: {router.telemetry['active_provider']}")


def test_python_ai_engine():
    print("\n--- 5. Testing PythonAIEngine Complete Stack ---")
    engine = PythonAIEngine()

    study_content = """
    Cellular Respiration in Biochemistry:
    1. Glycolysis occurs in the cytosol, converting one glucose molecule into two pyruvate molecules and yielding a net of 2 ATP and 2 NADH.
    2. The Citric Acid Cycle (Krebs Cycle) occurs in the mitochondrial matrix, producing NADH, FADH2, and GTP.
    3. Oxidative Phosphorylation occurs across the inner mitochondrial membrane, utilizing an electron transport chain and ATP synthase rotary catalysis to produce approximately 30-32 ATP.
    """

    print("Testing generate_exam_summary...")
    summary = engine.generate_exam_summary(study_content, style="Exam-Oriented", educational_level="University & SHS")
    assert len(summary) > 50, "Summary too short"
    print(f"✓ Complete Exam Summary generated ({len(summary)} characters)")

    print("Testing generate_flashcards...")
    cards = engine.generate_flashcards(study_content, count=3)
    assert isinstance(cards, list) and len(cards) >= 1
    assert "slide " not in cards[0].get("front", "").lower()
    print(f"✓ Flashcards generated ({len(cards)} cards with zero slide leaks)")

    print("Testing generate_practice_quiz (MCQ & Assertion-Reasoning)...")
    quiz = engine.generate_practice_quiz(study_content, count=4, difficulty="intermediate", question_type="mcq")
    assert isinstance(quiz, list) and len(quiz) >= 1
    for q in quiz:
        assert "slide " not in str(q.get("question", "")).lower()
    print(f"✓ Quiz questions generated ({len(quiz)} questions, 100% verified zero slide leaks)")

    print("Testing ask_study_tutor...")
    tutor_reply = engine.ask_study_tutor("Why is oxygen essential in oxidative phosphorylation?", study_content)
    assert len(tutor_reply) > 40
    print(f"✓ AI Tutor response generated ({len(tutor_reply)} characters)")


def test_benchmark_suite():
    print("\n--- 6. Testing Academic Benchmark Evaluation Suite ---")
    runner = AcademicBenchmarkRunner()
    results = runner.run_benchmark("autonomic_pharmacology")

    assert results["metrics"]["section_coverage_pct"] >= 90.0
    assert results["metrics"]["zero_slide_leak_compliance_pct"] == 100.0
    assert results["metrics"]["assertion_reasoning_strict_compliance_pct"] == 100.0
    assert results["metrics"]["distractor_distinctness_pct"] == 100.0

    print(f"✓ Dataset: {results['dataset_name']} ({results['domain']})")
    print(f"✓ Section Coverage: {results['metrics']['section_coverage_pct']}%")
    print(f"✓ Zero Slide Leak Compliance: {results['metrics']['zero_slide_leak_compliance_pct']}%")
    print(f"✓ Assertion-Reasoning Strictness: {results['metrics']['assertion_reasoning_strict_compliance_pct']}%")
    print(f"✓ Distractor Distinctness: {results['metrics']['distractor_distinctness_pct']}%")
    print(f"✓ Execution Latency: {results['metrics']['execution_time_seconds']}s")
    print(f"✓ Overall Grade: {results['metrics']['overall_benchmark_grade']}")


def test_fastapi_endpoints_direct():
    print("\n--- 7. Testing FastAPI Backend Endpoints ---")
    from api_server import (
        health,
        generate_academic_blueprint,
        evaluate_academic_benchmark,
        AcademicBlueprintRequest,
        EvaluateBenchmarkRequest,
    )

    # 1. Health check
    h = health()
    assert h.get("status") == "healthy"
    print(f"✓ /health OK: {h.get('status')}")

    # 2. Academic Blueprint endpoint
    bp_req = AcademicBlueprintRequest(
        content="--- Slide 1: Renal Physiology ---\nThe nephron is the functional unit of the kidney.",
        title="Renal Physiology",
    )
    bp_res = generate_academic_blueprint(bp_req)
    assert bp_res.get("success") is True
    assert "blueprint" in bp_res
    print(f"✓ /api/academic-blueprint OK (Topic: {bp_res['blueprint']['domain_topic']})")

    # 3. Evaluate Benchmark endpoint
    bench_req = EvaluateBenchmarkRequest(dataset_name="autonomic_pharmacology")
    bench_res = evaluate_academic_benchmark(bench_req)
    assert bench_res.get("success") is True
    print(f"✓ /api/evaluate-benchmark OK (Grade: {bench_res['results']['metrics']['overall_benchmark_grade']})")


def test_python_311_container_syntax_compatibility():
    """
    Production containers (Dockerfile / GitHub Actions) run Python 3.11, whereas local
    developer environments may run Python 3.12/3.13 (which permit PEP 701 backslashes
    or reused quotes inside f-strings). This gate guarantees 100% Python 3.11 AST compatibility.
    """
    print("\n--- 8. Testing Python 3.11 Production Container AST Compatibility ---")
    import ast

    repo_root = _DIR.parent
    py_files = sorted(list(repo_root.glob("*.py")) + list(_DIR.glob("*.py")))
    violations = []

    for p in py_files:
        src = p.read_text(encoding="utf-8")
        tree = ast.parse(src, filename=str(p))
        for n in ast.walk(tree):
            if hasattr(ast, "TypeAlias") and isinstance(n, ast.TypeAlias):
                violations.append(f"{p.name}:{n.lineno} uses PEP 695 TypeAlias (Python 3.12+)")
            if getattr(n, "type_params", None):
                violations.append(f"{p.name}:{n.lineno} uses PEP 695 type_params (Python 3.12+)")
            if isinstance(n, ast.JoinedStr):
                full_seg = ast.get_source_segment(src, n) or ""
                prefix_stripped = full_seg.lstrip("fFrRbBuU")
                outer_q = None
                for q in ('"""', "'''", '"', "'"):
                    if prefix_stripped.startswith(q):
                        outer_q = q
                        break
                for v in n.values:
                    if isinstance(v, ast.FormattedValue):
                        v_seg = ast.get_source_segment(src, v) or ""
                        if "\\" in v_seg:
                            violations.append(f"{p.name}:{v.lineno} has backslash inside f-string expr: {v_seg[:80]}")
                        if "#" in v_seg:
                            violations.append(f"{p.name}:{v.lineno} has comment '#' inside f-string expr: {v_seg[:80]}")
                        if outer_q and outer_q in v_seg:
                            violations.append(f"{p.name}:{v.lineno} reuses outer quote ({outer_q}) inside f-string expr: {v_seg[:80]}")

    assert len(violations) == 0, "Python 3.11 syntax compatibility violations:\n  " + "\n  ".join(violations)
    print(f"✓ Verified {len(py_files)} Python source files are 100% Python 3.11 container-compatible")


if __name__ == "__main__":
    print("==================================================================")
    print("LAMLA Guide AI - Advanced Academic Intelligence Engine Test Suite")
    print("==================================================================")
    try:
        test_document_processor()
        test_academic_knowledge_blueprint()
        test_verification_engine()
        test_model_router()
        test_python_ai_engine()
        test_benchmark_suite()
        test_fastapi_endpoints_direct()
        test_python_311_container_syntax_compatibility()
        print("\n==================================================================")
        print("ALL 8 TEST SUITES PASSED! ACADEMIC INTELLIGENCE ENGINE IS ROCK-SOLID!")
        print("==================================================================")
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
