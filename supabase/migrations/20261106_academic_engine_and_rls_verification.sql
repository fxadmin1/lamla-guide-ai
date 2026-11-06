-- ==============================================================================
-- LAMLA Guide AI — Safe Non-Destructive Production Migration (v2.4.0)
-- Date: 2026-11-06
-- Purpose:
--   1. Preserve 100% of existing student accounts, uploaded documents, summaries,
--      detailed notes, flashcard decks, quiz attempts, and tutor conversations.
--   2. Ensure quiz tables support all 8 examination formats (mcq, multiple_select,
--      assertion_reasoning, true_false, matching, fill_in_the_blank, short_answer,
--      application, mixed) without restrictive legacy CHECK constraints.
--   3. Verify Row Level Security (RLS) and composite ownership indexes across all
--      multi-user study tables.
-- ==============================================================================

BEGIN;

-- 1. Safely drop any legacy restrictive question_type CHECK constraints if present
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT con.conname, rel.relname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname IN ('quizzes', 'quiz_questions')
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%question_type%'
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.relname, r.conname);
    END LOOP;
END $$;

-- 2. Ensure optional metadata columns exist non-destructively
ALTER TABLE IF EXISTS public.quiz_questions
    ADD COLUMN IF NOT EXISTS marking_guide TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS source_reference TEXT DEFAULT '';

ALTER TABLE IF EXISTS public.flashcards
    ADD COLUMN IF NOT EXISTS slide_reference TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS mastery_level INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 3. Enforce Row Level Security (RLS) on every multi-user table
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.study_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.flashcard_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tutor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tutor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscription_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'session_tutor_messages'
    ) THEN
        EXECUTE 'ALTER TABLE public.session_tutor_messages ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- 4. Ensure composite ownership & lookup indexes for fast multi-user isolation
CREATE INDEX IF NOT EXISTS idx_documents_user_created ON public.documents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_summaries_doc_user ON public.summaries(document_id, user_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_doc_user ON public.study_notes(document_id, user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_doc_user ON public.flashcard_decks(document_id, user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_doc_user ON public.quizzes(document_id, user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz ON public.quiz_attempts(user_id, quiz_id);

COMMIT;
