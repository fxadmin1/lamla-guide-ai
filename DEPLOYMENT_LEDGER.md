# LAMLA Guide AI — Production Architecture & Version Ledger

## 1. Identified Production Architecture

| Layer | Production Component | Details |
| :--- | :--- | :--- |
| **Source Repository** | GitHub (`origin/main`) | `https://github.com/fxadmin1/lamla-guide-ai.git` |
| **Production Domain** | Render Web Service | `https://lamla-guide-ai.onrender.com` |
| **Container Runtime** | Unified Docker (`./Dockerfile`) | Single container running `python app.py` (FastAPI + internal Next.js `16.4.3` on `127.0.0.1`) |
| **Frontend Application** | Next.js `16.4.3` / React `19.3` | Served via unified FastAPI reverse proxy with PWA Service Worker (`public/sw.js`) |
| **Python AI Backend** | FastAPI (`python_ai/api_server.py`) | Same-origin `/api/*` & `/health` + `/api/version` + WebSocket Live Quiz Hub |
| **Database & Auth** | Supabase PostgreSQL + Auth | `https://lsisntjpiscwnwdqbebo.supabase.co` (Row Level Security enforced per `user_id`) |
| **CI/CD & Keep-Alive** | GitHub Actions + Render Docker | `.github/workflows/production-ci-cd.yml` & `.github/workflows/keep-alive-24-7.yml` |

---

## 2. Environment Separation Policy

- **Development (`.env.local`, gitignored & dockerignored)**:
  - Loaded only when `NODE_ENV != "production"`, `LAMLA_ENV != "production"`, and `RENDER != "true"`.
  - Excluded from Docker images via `.dockerignore`.
- **Production (Render Environment Variables)**:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public client config).
  - `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ADMIN_EMAIL` (server-only runtime secrets — never baked into `Dockerfile` or client bundles).
  - `LAMLA_LOW_MEM_BUILD=1` & `NODE_OPTIONS="--max-old-space-size=1536"` during Docker build; `LAMLA_PREBUILT=1` & `NODE_OPTIONS="--max-old-space-size=256"` at container runtime to stay well within Render Free's `512 MB` RAM limit.

---

## 3. Database Migrations Record (`supabase/migrations/`)

All migrations are non-destructive (`IF NOT EXISTS`, zero table resets, 100% student record preservation):

1. `20261009_security_and_storage.sql` — Core RLS policies and storage access controls.
2. `20261010_scale_and_performance_indexes.sql` — High-concurrency query indexes.
3. `20261012_educational_video_recommendations.sql` — Video recommendation caching schema.
4. `20261012_presentations_studio.sql` — Presentation metadata support.
5. `20261012_study_routines_and_notifications.sql` — Study routines & notification schedules.
6. `20261013_class_groups_and_collaboration.sql` — Study circles & live group quizzes.
7. `20261013_exam_tracker_and_collaboration_refinement.sql` — Exam readiness & `session_tutor_messages`.
8. `20261106_academic_engine_and_rls_verification.sql` — Ensures all 8 quiz formats (`mcq`, `multiple_select`, `assertion_reasoning`, `true_false`, `matching`, `fill_in_the_blank`, `short_answer`, `application`, `mixed`), optional metadata columns, composite ownership indexes, and strict RLS across every multi-user table.

---

## 4. Release & Version History

| Version | Commit | Date (UTC) | Scope & Verification Status |
| :--- | :--- | :--- | :--- |
| **`2.4.1`** | Latest (`HEAD`) | `2026-11-06` | Fixed Python 3.11 container startup `SyntaxError` in `python_ai/ai_engine.py:1707` (PEP 701 backslash inside f-string that passed on local Python 3.13 but crashed Render's `python:3.11-slim-bookworm` container on boot), added Python 3.11 AST gate to `test_system.py`, and added `python -m compileall` build-time gate to `Dockerfile`. |
| `2.4.0` | `f4da2c8` | `2026-11-06` | Production synchronization suite (`/api/version`, `/health` commit telemetry, Docker 512MB/low-memory build hardening, secret removal from `Dockerfile`, GitHub Actions `production-ci-cd.yml`, `verify_production_live.py`, non-destructive SQL migration `20261106`). |
| `2.3.1` | `6ae9e65` | `2026-11-06` | Frontend summary table-to-bullet sanitizer, textbook topic heading sanitizer, flashcard deck replacement, auth header fix on Smart Drill, Untimed quiz fix, PWA `lamla-cache-v4-20261106`. |
| `2.3.0` | `858d168` | `2026-11-06` | 5-feature academic intelligence upgrade (Summary, Detailed Notes, Flashcards, 8-format Quizzes, 8-step YouTube Curator). |
| `2.2.0` | `cc5470c` | `2026-11-06` | Multi-user data isolation, server-side Bearer JWT verification (`auth_validator.py`), per-user AI cache namespacing. |
| `2.1.0` | `e018cfd` / `1394f95` | `2026-11-06` | Shared Academic Blueprint, OCR/SmartArt/chart slide extraction, 7-point Verification Engine, Benchmark Suite. |
| `1.1.0` | `2cd3367` | `2026-11-05` | Pre-upgrade container observed on `https://lamla-guide-ai.onrender.com` prior to v2.4.0 Docker memory hardening / Render redeploy. |

---

## 5. Live Verification Command

Run at any time to verify both **infrastructure health** and **exact version/commit synchronization** on the live domain:

```bash
python python_ai/verify_production_live.py --url https://lamla-guide-ai.onrender.com --expected-version 2.4.0
```
