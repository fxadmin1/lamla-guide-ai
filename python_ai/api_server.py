"""
LAMLA Guide AI - Python FastAPI High-Performance Backend Service
"It's Never Too Late To Study."

Handles slide parsing (.pptx), PDF documents (.pdf), Word (.docx),
multimodal vision OCR, AI study notes, practice exams, active recall coach,
and configurable AI Provider selection (Local Only, Free Configured, Hybrid, Hosted).
"""

import os
import json
import time
import asyncio
import hashlib
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
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
    from academic_knowledge import AcademicKnowledgeBuilder, AcademicKnowledgeRepresentation
    from benchmark_suite import AcademicBenchmarkRunner
    from auth_validator import get_authenticated_user, get_optional_authenticated_user, verify_resource_ownership
except ImportError:
    from python_ai.document_processor import DocumentProcessor
    from python_ai.ai_engine import PythonAIEngine
    from python_ai.live_quiz_hub import router as live_quiz_router
    from python_ai.web_enrichment import schedule_background_enrichment, build_labeled_concept_svg, research_topic_from_web
    from python_ai.academic_knowledge import AcademicKnowledgeBuilder, AcademicKnowledgeRepresentation
    from python_ai.benchmark_suite import AcademicBenchmarkRunner
    from python_ai.auth_validator import get_authenticated_user, get_optional_authenticated_user, verify_resource_ownership

app = FastAPI(
    title="LAMLA Guide AI - Python AI Core",
    description="Multimodal Slide & Document Processing API for Ghanaian Students",
    version="1.1.0"
)

# Enable hardened CORS for Next.js web application, custom domains, and secure cloud origins
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|.*lamlaguide.*|.*\.onrender\.com|.*\.hf\.space|.*\.koyeb\.app|.*\.dpdns\.org|.*\.duckdns\.org|.*\.is-a\.dev|.*\.eu\.org|.*\.pp\.ua)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# In-Memory Anti-DDoS Sliding Window Rate Limiter & OWASP Security Headers
# ─────────────────────────────────────────────────────────────────────────────
import threading

class RateLimiter:
    _history: dict[str, list[float]] = {}
    _lock = threading.Lock()
    _last_clean: float = 0.0

    def _cleanup_old(self, now: float):
        if now - self._last_clean < 30.0:
            return
        self._last_clean = now
        cutoff = now - 60.0
        stale_keys = [k for k, timestamps in self._history.items() if not any(t > cutoff for t in timestamps)]
        for k in stale_keys:
            self._history.pop(k, None)

    def is_allowed(self, ip: str, path: str) -> tuple[bool, int]:
        with self._lock:
            now = time.monotonic()
            self._cleanup_old(now)
            cutoff = now - 60.0

            if any(path.startswith(p) for p in ("/api/ai", "/api/upload-and-parse", "/api/documents/process", "/api/documents/extract")):
                limit = 150  # 150 heavy requests per minute per IP (supports campus Wi-Fi NAT)
            elif any(path.startswith(p) for p in ("/api/auth", "/auth/login", "/auth/signup")):
                limit = 40  # 40 auth attempts per minute
            elif path.startswith("/api/study-groups"):
                limit = 120  # 120 group operations per minute
            else:
                limit = 600  # 600 general page / API requests per minute

            key = f"{ip}:{limit}"
            timestamps = [t for t in self._history.get(key, []) if t > cutoff]

            if len(timestamps) >= limit:
                return False, 60

            timestamps.append(now)
            self._history[key] = timestamps
            return True, 0


RATE_LIMITER = RateLimiter()
STATIC_EXTS = (".js", ".css", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".mp4", ".webm", ".wav", ".mp3")
STATIC_PREFIXES = ("/_next/static/", "/icons/", "/feature_showcase_", "/status_cards_")


def _get_client_ip(request: Request) -> str:
    for h in ("cf-connecting-ip", "x-real-ip", "x-forwarded-for"):
        val = request.headers.get(h)
        if val:
            return val.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    "X-XSS-Protection": "1; mode=block",
    "X-Permitted-Cross-Domain-Policies": "none",
    "Content-Security-Policy": (
        "default-src 'self' https: data: blob:; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; "
        "worker-src 'self' blob:; "
        "style-src 'self' 'unsafe-inline' https:; "
        "img-src 'self' data: blob: https:; "
        "media-src 'self' data: blob: https:; "
        "frame-src 'self' https: data: blob:; "
        "connect-src 'self' https: wss: ws: http://127.0.0.1:* http://localhost:*; "
        "font-src 'self' data: https:; "
        "frame-ancestors 'self'; "
        "base-uri 'self'; "
        "form-action 'self';"
    ),
}

@app.middleware("http")
async def security_and_rate_limit_middleware(request: Request, call_next):
    raw_path = request.url.path
    is_static = any(raw_path.startswith(p) for p in STATIC_PREFIXES) or raw_path.endswith(STATIC_EXTS)

    if not is_static and raw_path not in ("/health", "/api/health"):
        ip = _get_client_ip(request)
        allowed, retry_after = RATE_LIMITER.is_allowed(ip, raw_path)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded. Please wait a moment before sending more requests.",
                    "code": "RATE_LIMIT_EXCEEDED",
                    "retry_after_seconds": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

    response = await call_next(request)

    for k, v in SECURITY_HEADERS.items():
        response.headers[k] = v

    if "server" in response.headers:
        del response.headers["server"]
    if "x-powered-by" in response.headers:
        del response.headers["x-powered-by"]

    if is_static:
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif raw_path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"

    return response

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
def set_provider_mode(
    req: ProviderModeRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: Administrator permissions required to change platform AI mode.")
    valid = ["local_only", "free_configured", "manual_hybrid", "hosted_ai"]
    if req.mode.lower() not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid mode. Choose from: {valid}")
    ai_engine.set_mode(req.mode.lower())
    return {
        "success": True,
        "new_mode": ai_engine.mode,
        "active_model": ai_engine.active_model_name,
        "set_by": user.get("email") or user["id"],
    }

_PARSE_CACHE: Dict[str, Dict[str, Any]] = {}
_MAX_PARSE_CACHE = 80


@app.post("/api/upload-and-parse")
async def upload_and_parse(
    file: UploadFile = File(...),
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    """
    Zero-storage-bloat high-capacity document parser (.pptx, .pdf, .docx, .txt, images up to 1GB).
    - Strictly authenticated and user-isolated
    - Ephemeral user-scoped temp directory with immediate cleanup in `finally:`
    - User-scoped parsing cache prevents cross-student data leakage
    - Automatically triggers background internet knowledge & diagram enrichment on the extracted topics
    """
    import tempfile
    import uuid
    import re as _re

    user_id = user["id"]
    MAX_UPLOAD_BYTES = 1536 * 1024 * 1024  # 1.5 GB maximum for large slide decks, videos & PDFs
    ALLOWED_EXTS = {"pptx", "pdf", "docx", "doc", "txt", "md", "jpg", "jpeg", "png", "webp"}

    raw_filename = file.filename or "uploaded_file"
    # Prevent path traversal attacks (e.g. ../ or absolute paths)
    clean_filename = os.path.basename(raw_filename).replace("..", "").strip() or "uploaded_file"
    ext = clean_filename.rsplit(".", 1)[-1].lower() if "." in clean_filename else ""

    if ext not in ALLOWED_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format .{ext}. Allowed formats: {', '.join(sorted(ALLOWED_EXTS))}",
        )

    safe_suffix = f".{ext}" if ext.isalnum() and len(ext) <= 8 else ".tmp"
    user_temp_dir = os.path.join(tempfile.gettempdir(), "lamla_users", user_id)
    os.makedirs(user_temp_dir, exist_ok=True)
    temp_path = os.path.join(user_temp_dir, f"lamla_up_{uuid.uuid4().hex}{safe_suffix}")

    try:
        file_hasher = hashlib.sha256()
        total_read = 0
        with open(temp_path, "wb") as buffer:
            while True:
                chunk = await file.read(512 * 1024)  # Stream in 512 KB blocks for fast 1GB+ throughput
                if not chunk:
                    break
                total_read += len(chunk)
                if total_read > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=400,
                        detail="File exceeds the maximum upload limit of 1.5 GB.",
                    )
                buffer.write(chunk)
                file_hasher.update(chunk)

        file_size = total_read
        # User-scoped cache key guarantees Student A and Student B never share parsed caches
        user_doc_hash = f"{user_id}:doc_extracted_{file_hasher.hexdigest()}"

        if user_doc_hash in _PARSE_CACHE:
            cached_data = dict(_PARSE_CACHE[user_doc_hash])
            cached_data["title"] = clean_filename
            cached_data["file_size_bytes"] = file_size
            schedule_background_enrichment(
                cached_data.get("full_text", ""),
                clean_filename,
                cached_data.get("key_concepts"),
            )
            return {"success": True, "data": cached_data, "deduplicated": True}
            schedule_background_enrichment(
                cached_data.get("full_text", ""),
                clean_filename,
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
            result = await asyncio.to_thread(processor.process_text, text_content, clean_filename)
        elif ext in ["jpg", "jpeg", "png", "webp"]:
            result = await asyncio.to_thread(processor.process_image, temp_path, clean_filename)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported format .{ext}. Supported formats: {', '.join(sorted(ALLOWED_EXTS))}"
            )

        result["title"] = clean_filename
        result["file_size_bytes"] = file_size

        # Build unified Academic Blueprint representation
        try:
            blueprint = AcademicKnowledgeBuilder.build_from_parsed_document(result, domain_hint=clean_filename)
            result["academic_blueprint"] = blueprint.to_dict()
        except Exception:
            pass

        # Store compact representation in bounded parse cache (avoid holding huge duplicate page arrays in RAM)
        compact_cached = {
            "document_type": result.get("document_type"),
            "title": clean_filename,
            "total_slides": result.get("total_slides") or result.get("total_pages") or result.get("total_sections") or 1,
            "total_pages": result.get("total_pages") or result.get("total_slides") or 1,
            "full_text": result.get("full_text", ""),
            "key_concepts": result.get("key_concepts", []),
            "file_size_bytes": file_size,
        }
        if len(_PARSE_CACHE) >= _MAX_PARSE_CACHE:
            for old_k in list(_PARSE_CACHE.keys())[:20]:
                _PARSE_CACHE.pop(old_k, None)
        _PARSE_CACHE[user_doc_hash] = compact_cached

        # Trigger automatic internet research & visual diagram enrichment in background!
        schedule_background_enrichment(
            result.get("full_text", ""),
            clean_filename,
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
def enrich_content_endpoint(
    req: EnrichContentRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    """Triggers background internet enrichment for pasted notes or restored study sessions (user-isolated)."""
    schedule_background_enrichment(req.content, req.title or "", user_id=user["id"])
    return {"success": True, "scheduled": True}


@app.get("/api/concept-visual")
def concept_visual_endpoint(q: str = "Core Concept"):
    """Returns a clean, labeled SVG schematic for any concept on demand (public)."""
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
def generate_summary(
    req: AnalyzeRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    try:
        summary_text = ai_engine.generate_exam_summary(
            req.content,
            style=req.style,
            educational_level=req.educational_level,
            user_id=user["id"],
        )
        return {
            "success": True,
            "title": req.document_title,
            "style": req.style,
            "summary": summary_text,
            "handled_by": ai_engine.active_model_name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-explanation")
def generate_explanation(
    req: ExplanationRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    try:
        text = ai_engine.generate_detailed_explanation(req.content, educational_level=req.educational_level)
        return {
            "success": True,
            "explanation": text,
            "handled_by": ai_engine.active_model_name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-notes")
def generate_notes(
    req: NotesRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    try:
        notes = ai_engine.generate_study_notes(
            req.content,
            subject=req.subject,
            educational_level=req.educational_level,
            user_id=user["id"],
        )
        return {
            "success": True,
            "notes": notes,
            "handled_by": ai_engine.active_model_name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/regenerate-notes-section")
def regenerate_notes_section(
    req: RegenerateNotesSectionRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    try:
        content = ai_engine.regenerate_notes_section(
            section_title=req.section_title,
            current_section_content=req.current_section_content,
            slide_context=req.slide_context,
            instruction=req.instruction or "standard_refresh",
            educational_level=req.educational_level or "Senior High School (SHS) & University",
        )
        return {
            "success": True,
            "section_title": req.section_title,
            "content": content,
            "handled_by": ai_engine.active_model_name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/curate-videos")
def curate_videos(
    req: CurateVideosRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    try:
        from python_ai.video_curator import curate_videos_for_text
        res = curate_videos_for_text(req.title, req.content, user_id=user["id"])
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/study-scheduler/plan")
def study_scheduler_plan(
    req: ExamPlanRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    try:
        from python_ai.study_scheduler import generate_exam_study_plan
        res = generate_exam_study_plan(req.exam_subject, req.exam_date, req.topics)
        return {"success": True, **res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/study-scheduler/spaced-repetition")
def study_scheduler_spaced(
    req: SpacedRepetitionRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    try:
        from python_ai.study_scheduler import calculate_spaced_repetition
        res = calculate_spaced_repetition(req.interval_stage, req.base_date)
        return {"success": True, **res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/study-scheduler/streak-health")
def study_scheduler_streak(
    req: StreakHealthRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    try:
        from python_ai.study_scheduler import evaluate_streak_health
        res = evaluate_streak_health(req.last_active_date, req.current_streak, req.streak_freezes_left)
        return {"success": True, **res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-teach-zero")
def generate_teach_zero(
    req: TeachZeroRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    try:
        notes = ai_engine.generate_teach_me_from_zero(req.content, educational_level=req.educational_level)
        return {
            "success": True,
            "teach_zero": notes,
            "handled_by": ai_engine.active_model_name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-flashcards")
def generate_flashcards(
    req: FlashcardsRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    try:
        cards = ai_engine.generate_flashcards(req.content, count=req.count or 10, user_id=user["id"])
        return {
            "success": True,
            "total_requested": req.count or 10,
            "total_generated": len(cards),
            "flashcards": cards,
            "handled_by": ai_engine.active_model_name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-quiz")
def generate_quiz(
    req: QuizRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    try:
        questions = ai_engine.generate_practice_quiz(
            content=req.content,
            count=req.question_count,
            difficulty=req.difficulty,
            question_type=req.question_type or "mcq",
            focus_weak_topics=req.focus_weak_topics,
            user_id=user["id"],
        )
        return {
            "success": True,
            "total_questions": len(questions),
            "questions": questions,
            "handled_by": ai_engine.active_model_name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/explain-three-ways")
def explain_three_ways_endpoint(
    req: ThreeWaysRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    try:
        explanations = ai_engine.explain_three_ways(req.concept, context=req.context or "")
        return {
            "success": True,
            "concept": req.concept,
            "explanations": explanations,
            "handled_by": ai_engine.active_model_name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/active-recall-coach")
def active_recall_coach_endpoint(
    req: ActiveRecallCoachRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    try:
        evaluation = ai_engine.active_recall_coach_evaluate(
            question=req.question,
            student_answer=req.student_answer,
            reference_text=req.reference_text or "",
        )
        return {
            "success": True,
            "evaluation": evaluation,
            "handled_by": ai_engine.active_model_name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tutor")
def ai_tutor_dialogue(
    req: TutorRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    try:
        response = ai_engine.ask_study_tutor(
            query=req.user_query,
            context=req.context_text,
            educational_level=req.educational_level or "University / SHS",
            action_type=req.action_type,
            chat_history=req.chat_history or [],
            teaching_mode=req.teaching_mode or "socratic",
            user_id=user["id"],
        )
        return {
            "success": True,
            "answer": response,
            "handled_by": ai_engine.active_model_name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AcademicBlueprintRequest(BaseModel):
    content: str
    title: Optional[str] = "Academic Presentation"

@app.post("/api/academic-blueprint")
def generate_academic_blueprint(
    req: AcademicBlueprintRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    """
    Returns the unified multi-dimensional academic knowledge representation
    including concepts, mechanisms, comparisons, structures, coverage, and markdown rendering.
    User-isolated.
    """
    try:
        raw_doc = processor.process_text(req.content, req.title or "Presentation")
        bp = AcademicKnowledgeBuilder.build_from_parsed_document(raw_doc, domain_hint=req.title or "")
        return {
            "success": True,
            "blueprint": bp.to_dict(),
            "rendered_markdown": bp.render_blueprint_markdown(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class EvaluateBenchmarkRequest(BaseModel):
    dataset_name: Optional[str] = "autonomic_pharmacology"

@app.post("/api/evaluate-benchmark")
def evaluate_academic_benchmark(
    req: EvaluateBenchmarkRequest,
    user: Dict[str, Any] = Depends(get_authenticated_user),
):
    """
    Runs automated academic evaluation across benchmark datasets (Autonomic Pharmacology,
    Cellular Respiration, Macroeconomics) measuring coverage %, zero-slide leak compliance,
    assertion-reasoning strictness, distractor plausibility, and speed.
    """
    try:
        runner = AcademicBenchmarkRunner(ai_engine=ai_engine)
        if req.dataset_name and req.dataset_name.lower() == "all":
            results = runner.run_all_benchmarks()
        else:
            results = runner.run_benchmark(req.dataset_name or "autonomic_pharmacology")
        return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_server:app", host="127.0.0.1", port=8000, reload=True)
