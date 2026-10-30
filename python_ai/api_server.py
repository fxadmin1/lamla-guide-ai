"""
LAMLA Guide AI - Python FastAPI High-Performance Backend Service
"It's Never Too Late To Study."

Handles slide parsing (.pptx), PDF documents (.pdf), Word (.docx),
multimodal vision OCR, AI study notes, practice exams, active recall coach,
and configurable AI Provider selection (Local Only, Free Configured, Hybrid, Hosted).
"""

import os
import json
import asyncio
import hashlib
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import sys
from pathlib import Path

_THIS_DIR = Path(__file__).parent.resolve()
_ROOT_DIR = _THIS_DIR.parent
sys.path.insert(0, str(_THIS_DIR))

# Auto-load .env and .env.local so Python & Next.js share identical credentials
for _env_name in (".env", ".env.local"):
    _env_file = _ROOT_DIR / _env_name
    if _env_file.exists():
        for _line in _env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
            _s = _line.strip()
            if not _s or _s.startswith("#") or "=" not in _s:
                continue
            _k, _v = _s.split("=", 1)
            _k = _k.strip()
            _v = _v.strip().strip('"').strip("'")
            if _k and _k not in os.environ:
                os.environ[_k] = _v

try:
    from document_processor import DocumentProcessor
    from ai_engine import PythonAIEngine
    from live_quiz_hub import router as live_quiz_router
    from web_enrichment import schedule_background_enrichment, build_labeled_concept_svg, research_topic_from_web
except ImportError:
    from python_ai.document_processor import DocumentProcessor
    from python_ai.ai_engine import PythonAIEngine
    from python_ai.live_quiz_hub import router as live_quiz_router
    from python_ai.web_enrichment import schedule_background_enrichment, build_labeled_concept_svg, research_topic_from_web

app = FastAPI(
    title="LAMLA Guide AI - Python AI Core",
    description="Multimodal Slide & Document Processing API for Ghanaian Students",
    version="1.1.0"
)

# Enable CORS for Next.js web application
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

processor = DocumentProcessor()
ai_engine = PythonAIEngine()
app.include_router(live_quiz_router)

class AnalyzeRequest(BaseModel):
    content: str
    document_title: Optional[str] = "Lecture Material"
    educational_level: Optional[str] = "shs"
    style: Optional[str] = "Exam-Oriented"

class QuizRequest(BaseModel):
    content: str
    question_count: Optional[int] = 5
    difficulty: Optional[str] = "intermediate"
    question_type: Optional[str] = "mcq"
    focus_weak_topics: Optional[List[str]] = None

class FlashcardsRequest(BaseModel):
    content: str
    count: Optional[int] = 10

class NotesRequest(BaseModel):
    content: str
    subject: Optional[str] = "General Science"
    educational_level: Optional[str] = "Senior High School (SHS)"

class ExplanationRequest(BaseModel):
    content: str
    educational_level: Optional[str] = "Senior High School (SHS) & University"

class TutorRequest(BaseModel):
    user_query: str
    context_text: str
    chat_history: Optional[List[dict]] = []
    educational_level: Optional[str] = "University / SHS"
    action_type: Optional[str] = None
    teaching_mode: Optional[str] = "socratic"

class TeachZeroRequest(BaseModel):
    content: str
    educational_level: Optional[str] = "Senior High School (SHS) & University"

class ThreeWaysRequest(BaseModel):
    concept: str
    context: Optional[str] = ""

class ActiveRecallCoachRequest(BaseModel):
    question: str
    student_answer: str
    reference_text: Optional[str] = ""

class ProviderModeRequest(BaseModel):
    mode: str # "local_only", "free_configured", "manual_hybrid", "hosted_ai"

class RegenerateNotesSectionRequest(BaseModel):
    section_title: str
    current_section_content: str
    slide_context: str
    instruction: Optional[str] = "standard_refresh"
    educational_level: Optional[str] = "Senior High School (SHS) & University"

class CurateVideosRequest(BaseModel):
    title: str
    content: str

class ExamPlanRequest(BaseModel):
    exam_subject: str
    exam_date: str
    topics: Optional[List[str]] = None

class SpacedRepetitionRequest(BaseModel):
    interval_stage: int
    base_date: Optional[str] = None

class StreakHealthRequest(BaseModel):
    last_active_date: Optional[str] = None
    current_streak: int = 0
    streak_freezes_left: int = 2

@app.get("/health")
@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "LAMLA Guide AI Unified Python Engine",
        "slogan": "It's Never Too Late To Study.",
        "provider_mode": ai_engine.mode,
        "active_model": ai_engine.active_model_name,
        "local_model": ai_engine.local_model,
        "unified": True,
    }

@app.get("/api/provider-status")
def provider_status():
    import urllib.request
    ollama_online = False
    try:
        with urllib.request.urlopen(f"{ai_engine.ollama_endpoint}/api/tags", timeout=2) as resp:
            if resp.status == 200:
                ollama_online = True
    except Exception:
        ollama_online = False

    return {
        "mode": ai_engine.mode,
        "active_model": ai_engine.active_model_name,
        "ollama_endpoint": ai_engine.ollama_endpoint,
        "ollama_online": ollama_online,
        "local_model_target": ai_engine.local_model,
        "zero_paid_api_enforced": ai_engine.mode == "local_only"
    }

@app.post("/api/set-provider-mode")
def set_provider_mode(req: ProviderModeRequest):
    valid = ["local_only", "free_configured", "manual_hybrid", "hosted_ai"]
    if req.mode.lower() not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid mode. Choose from: {valid}")
    ai_engine.set_mode(req.mode.lower())
    return {
        "success": True,
        "new_mode": ai_engine.mode,
        "active_model": ai_engine.active_model_name
    }

_PARSE_CACHE: Dict[str, Dict[str, Any]] = {}
_MAX_PARSE_CACHE = 80


@app.post("/api/upload-and-parse")
async def upload_and_parse(file: UploadFile = File(...)):
    """
    Zero-storage-bloat high-capacity document parser (.pptx, .pdf, .docx, .txt, images up to 1GB).
    - Streams chunks in 1 MB blocks directly to an ephemeral temp file so RAM stays low
    - Deduplicates identical uploads in O(1) via SHA-256 content hash
    - Immediately deletes the raw binary file in `finally:` so millions of uploads never fill disk storage
    - Automatically triggers background internet knowledge & diagram enrichment on the extracted topics
    """
    import tempfile
    import uuid
    import re as _re

    filename = file.filename or "uploaded_file"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    safe_suffix = f".{ext}" if ext.isalnum() and len(ext) <= 8 else ".tmp"
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, f"lamla_up_{uuid.uuid4().hex}{safe_suffix}")

    try:
        file_hasher = hashlib.sha256()
        with open(temp_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                buffer.write(chunk)
                file_hasher.update(chunk)

        file_size = os.path.getsize(temp_path)
        doc_hash = f"doc_extracted_{file_hasher.hexdigest()}"

        # Rapid SHA-256 deduplication across millions of uploads
        if doc_hash in _PARSE_CACHE:
            cached_data = dict(_PARSE_CACHE[doc_hash])
            cached_data["title"] = filename
            cached_data["file_size_bytes"] = file_size
            schedule_background_enrichment(
                cached_data.get("full_text", ""),
                filename,
                cached_data.get("key_concepts"),
            )
            return {"success": True, "data": cached_data, "deduplicated": True}

        # Offload CPU-heavy file extraction to worker thread so concurrent live quizzes & AI stay fast
        if ext == "pptx":
            result = await asyncio.to_thread(processor.process_pptx, temp_path)
        elif ext == "pdf":
            result = await asyncio.to_thread(processor.process_pdf, temp_path)
        elif ext in ["docx", "doc"]:
            result = await asyncio.to_thread(processor.process_docx, temp_path)
        elif ext in ["txt", "md"]:
            with open(temp_path, "r", encoding="utf-8", errors="ignore") as f:
                text_content = f.read()
            result = await asyncio.to_thread(processor.process_text, text_content, filename)
        elif ext in ["jpg", "jpeg", "png", "webp"]:
            result = await asyncio.to_thread(processor.process_image, temp_path, filename)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported format .{ext}. Supported formats: .pptx, .pdf, .docx, .txt, .md, images"
            )

        result["title"] = filename
        result["file_size_bytes"] = file_size

        # Store compact representation in bounded parse cache (avoid holding huge duplicate page arrays in RAM)
        compact_cached = {
            "document_type": result.get("document_type"),
            "title": filename,
            "total_slides": result.get("total_slides") or result.get("total_pages") or result.get("total_sections") or 1,
            "total_pages": result.get("total_pages") or result.get("total_slides") or 1,
            "full_text": result.get("full_text", ""),
            "key_concepts": result.get("key_concepts", []),
            "file_size_bytes": file_size,
        }
        if len(_PARSE_CACHE) >= _MAX_PARSE_CACHE:
            for old_k in list(_PARSE_CACHE.keys())[:20]:
                _PARSE_CACHE.pop(old_k, None)
        _PARSE_CACHE[doc_hash] = compact_cached

        # Trigger automatic internet research & visual diagram enrichment in background!
        schedule_background_enrichment(
            result.get("full_text", ""),
            filename,
            result.get("key_concepts"),
        )

        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse document: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


class EnrichContentRequest(BaseModel):
    title: Optional[str] = ""
    content: str


@app.post("/api/enrich-content")
def enrich_content_endpoint(req: EnrichContentRequest):
    """Triggers background internet enrichment for pasted notes or restored study sessions."""
    schedule_background_enrichment(req.content, req.title or "")
    return {"success": True, "scheduled": True}


@app.get("/api/concept-visual")
def concept_visual_endpoint(q: str = "Core Concept"):
    """Returns a clean, labeled SVG schematic for any concept on demand."""
    from fastapi.responses import Response as FastAPIResponse
    web_res = research_topic_from_web(q, include_images=False)
    title = web_res.get("source_title") or q
    summary = web_res.get("summary_text", "")
    labels = []
    if summary:
        sentences = [s.strip() for s in summary.replace("\n", " ").split(". ") if len(s.strip()) > 12]
        labels = [s[:36] for s in sentences[:4]]
    svg_xml = build_labeled_concept_svg(title, labels or None, "Labeled Concept Diagram")
    return FastAPIResponse(content=svg_xml, media_type="image/svg+xml")

@app.post("/api/generate-summary")
def generate_summary(req: AnalyzeRequest):
    try:
        summary_text = ai_engine.generate_exam_summary(req.content, style=req.style, educational_level=req.educational_level)
        return {
            "success": True,
            "title": req.document_title,
            "style": req.style,
            "summary": summary_text,
            "handled_by": ai_engine.active_model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-explanation")
def generate_explanation(req: ExplanationRequest):
    try:
        text = ai_engine.generate_detailed_explanation(req.content, educational_level=req.educational_level)
        return {
            "success": True,
            "explanation": text,
            "handled_by": ai_engine.active_model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-notes")
def generate_notes(req: NotesRequest):
    try:
        notes = ai_engine.generate_study_notes(req.content, subject=req.subject, educational_level=req.educational_level)
        return {
            "success": True,
            "notes": notes,
            "handled_by": ai_engine.active_model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/regenerate-notes-section")
def regenerate_notes_section(req: RegenerateNotesSectionRequest):
    try:
        content = ai_engine.regenerate_notes_section(
            section_title=req.section_title,
            current_section_content=req.current_section_content,
            slide_context=req.slide_context,
            instruction=req.instruction or "standard_refresh",
            educational_level=req.educational_level or "Senior High School (SHS) & University"
        )
        return {
            "success": True,
            "section_title": req.section_title,
            "content": content,
            "handled_by": ai_engine.active_model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/curate-videos")
def curate_videos(req: CurateVideosRequest):
    try:
        from python_ai.video_curator import curate_videos_for_text
        res = curate_videos_for_text(req.title, req.content)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/study-scheduler/plan")
def study_scheduler_plan(req: ExamPlanRequest):
    try:
        from python_ai.study_scheduler import generate_exam_study_plan
        res = generate_exam_study_plan(req.exam_subject, req.exam_date, req.topics)
        return {"success": True, **res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/study-scheduler/spaced-repetition")
def study_scheduler_spaced(req: SpacedRepetitionRequest):
    try:
        from python_ai.study_scheduler import calculate_spaced_repetition
        res = calculate_spaced_repetition(req.interval_stage, req.base_date)
        return {"success": True, **res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/study-scheduler/streak-health")
def study_scheduler_streak(req: StreakHealthRequest):
    try:
        from python_ai.study_scheduler import evaluate_streak_health
        res = evaluate_streak_health(req.last_active_date, req.current_streak, req.streak_freezes_left)
        return {"success": True, **res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-teach-zero")
def generate_teach_zero(req: TeachZeroRequest):
    try:
        notes = ai_engine.generate_teach_me_from_zero(req.content, educational_level=req.educational_level)
        return {
            "success": True,
            "teach_zero": notes,
            "handled_by": ai_engine.active_model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-flashcards")
def generate_flashcards(req: FlashcardsRequest):
    try:
        cards = ai_engine.generate_flashcards(req.content, count=req.count or 10)
        return {
            "success": True,
            "total_requested": req.count or 10,
            "total_generated": len(cards),
            "flashcards": cards,
            "handled_by": ai_engine.active_model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-quiz")
def generate_quiz(req: QuizRequest):
    try:
        questions = ai_engine.generate_practice_quiz(
            content=req.content,
            count=req.question_count,
            difficulty=req.difficulty,
            question_type=req.question_type or "mcq",
            focus_weak_topics=req.focus_weak_topics
        )
        return {
            "success": True,
            "total_questions": len(questions),
            "questions": questions,
            "handled_by": ai_engine.active_model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/explain-three-ways")
def explain_three_ways_endpoint(req: ThreeWaysRequest):
    try:
        explanations = ai_engine.explain_three_ways(req.concept, context=req.context or "")
        return {
            "success": True,
            "concept": req.concept,
            "explanations": explanations,
            "handled_by": ai_engine.active_model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/active-recall-coach")
def active_recall_coach_endpoint(req: ActiveRecallCoachRequest):
    try:
        evaluation = ai_engine.active_recall_coach_evaluate(
            question=req.question,
            student_answer=req.student_answer,
            reference_text=req.reference_text or ""
        )
        return {
            "success": True,
            "evaluation": evaluation,
            "handled_by": ai_engine.active_model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tutor")
def ai_tutor_dialogue(req: TutorRequest):
    try:
        response = ai_engine.ask_study_tutor(
            query=req.user_query,
            context=req.context_text,
            educational_level=req.educational_level or "University / SHS",
            action_type=req.action_type,
            chat_history=req.chat_history or [],
            teaching_mode=req.teaching_mode or "socratic"
        )
        return {
            "success": True,
            "answer": response,
            "handled_by": ai_engine.active_model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_server:app", host="127.0.0.1", port=8000, reload=True)
