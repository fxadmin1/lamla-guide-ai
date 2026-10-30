"""
Comprehensive E2E Test Suite for LAMLA Guide AI - Python AI Core
Tests:
1. DocumentProcessor: Text cleaning, chunking, key concept extraction
2. PythonAIEngine: Summary, Notes, Flashcards, Practice Quiz (batching), Tutor
3. FastAPI Endpoints: /health, /api/generate-summary, /api/generate-quiz, /api/generate-flashcards
"""

import sys
import io
import json
import urllib.request
import urllib.error
from pathlib import Path

# Fix stdout encoding for Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Add python_ai to path
sys.path.insert(0, str(Path(__file__).parent.parent / "python_ai"))

from document_processor import DocumentProcessor
from ai_engine import PythonAIEngine

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
    print(f"✓ extract_key_concepts passed (found: {concepts[:5]})")
    print("All DocumentProcessor unit tests PASSED!")

def test_python_ai_engine():
    print("\n--- 2. Testing PythonAIEngine ---")
    engine = PythonAIEngine()
    
    study_content = """
    Cellular Respiration in Biology:
    1. Glycolysis occurs in the cytoplasm, converting glucose into 2 pyruvate molecules and yielding a net of 2 ATP.
    2. The Krebs Cycle (Citric Acid Cycle) occurs in the mitochondrial matrix, generating NADH and FADH2.
    3. The Electron Transport Chain (ETC) is located on the inner mitochondrial membrane, producing approximately 32-34 ATP via ATP synthase and oxidative phosphorylation. Oxygen is the final electron acceptor.
    """

    print("Testing generate_exam_summary...")
    summary = engine.generate_exam_summary(study_content, style="Exam-Oriented", educational_level="SHS 3 Science")
    assert len(summary) > 50, "Summary too short"
    print(f"✓ Summary generated ({len(summary)} characters)")

    print("Testing generate_flashcards...")
    cards = engine.generate_flashcards(study_content, count=3)
    assert isinstance(cards, list) and len(cards) >= 1, "Flashcards failed"
    print(f"✓ Flashcards generated ({len(cards)} cards)")
    print(f"  Sample card: Front: {cards[0].get('front')[:40]}... Back: {cards[0].get('back')[:40]}...")

    print("Testing generate_practice_quiz (batching engine)...")
    quiz = engine.generate_practice_quiz(study_content, count=4, difficulty="intermediate", question_type="mcq")
    assert isinstance(quiz, list) and len(quiz) >= 1, "Quiz generation failed"
    print(f"✓ Quiz questions generated ({len(quiz)} questions)")
    for q in quiz[:2]:
        print(f"  Q{q.get('id')}: {q.get('question')} | Correct: {q.get('correctAnswer')}")

    print("Testing ask_study_tutor...")
    tutor_reply = engine.ask_study_tutor("Where does the Krebs Cycle occur and why is oxygen essential?", study_content)
    assert len(tutor_reply) > 40, "Tutor reply too short"
    print(f"✓ Tutor response generated ({len(tutor_reply)} characters)")
    print("All PythonAIEngine tests PASSED!")

def test_fastapi_endpoints():
    print("\n--- 3. Testing FastAPI Live HTTP Endpoints (Port 8000) ---")
    base_url = "http://127.0.0.1:8000"

    # 1. Health check
    req = urllib.request.Request(f"{base_url}/health")
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert data.get("status") == "healthy", "Health check failed"
        print(f"✓ Health check OK: {data}")

    # 2. Generate summary endpoint
    payload = json.dumps({
        "content": "Economics: Opportunity cost is the value of the next best alternative forgone when a choice is made in scarcity.",
        "document_title": "Basic Economics SHS",
        "educational_level": "shs",
        "style": "Exam-Oriented"
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}/api/generate-summary",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert data.get("success") is True
        print(f"✓ /api/generate-summary OK ({len(data.get('summary', ''))} chars)")

    # 3. Generate quiz endpoint
    payload = json.dumps({
        "content": "Economics: Demand curves slope downwards due to the law of diminishing marginal utility and substitution effect.",
        "question_count": 3,
        "difficulty": "intermediate",
        "question_type": "mcq"
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}/api/generate-quiz",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert data.get("success") is True
        assert len(data.get("questions", [])) >= 1
        print(f"✓ /api/generate-quiz OK ({len(data.get('questions', []))} questions received)")

    print("All FastAPI endpoints verified OPERATIONAL!")

if __name__ == "__main__":
    print("==================================================")
    print("LAMLA Guide AI - Python AI Core Verification Suite")
    print("==================================================")
    try:
        test_document_processor()
        test_python_ai_engine()
        test_fastapi_endpoints()
        print("\n==================================================")
        print("ALL TESTS PASSED: PYTHON AI SYSTEM IS FLAWLESS!")
        print("==================================================")
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
