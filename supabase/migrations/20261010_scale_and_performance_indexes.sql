-- =============================================================================
-- LAMLA GUIDE AI — HIGH-SCALE DATABASE OPTIMIZATIONS (100k - 1M+ USERS)
-- Slogan: "It's Never Too Late To Study."
-- =============================================================================

-- 1. PROFILES & COMMUNITY LEADERBOARD (O(1) / O(log N) indexed lookups)
CREATE INDEX IF NOT EXISTS idx_profiles_xp_points ON public.profiles (xp_points DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_id ON public.profiles (plan_id);
CREATE INDEX IF NOT EXISTS idx_profiles_institution ON public.profiles (institution);
CREATE INDEX IF NOT EXISTS idx_profiles_educational_level ON public.profiles (educational_level);

-- 2. DOCUMENTS (Lecture Slides, PDFs, Text Materials)
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents (user_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_user_created ON public.documents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON public.documents (processing_status);

-- 3. SUMMARIES & STUDY NOTES (Instant cascade joins)
CREATE INDEX IF NOT EXISTS idx_summaries_document_id ON public.summaries (document_id);
CREATE INDEX IF NOT EXISTS idx_summaries_user_id ON public.summaries (user_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_document_id ON public.study_notes (document_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_user_id ON public.study_notes (user_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_subject ON public.study_notes (subject);

-- 4. QUIZZES & SLIDE QUESTIONS (Fast non-stop drill lookups)
CREATE INDEX IF NOT EXISTS idx_quizzes_document_id ON public.quizzes (document_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON public.quizzes (user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_order ON public.quiz_questions (quiz_id, order_index);

-- 5. QUIZ ATTEMPTS & PROGRESS TRACKING
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_created_at ON public.quiz_attempts (created_at DESC);

-- 6. FLASHCARDS & SPACED REPETITION (SRS)
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_document_id ON public.flashcard_decks (document_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_user_id ON public.flashcard_decks (user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_deck_id ON public.flashcards (deck_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON public.flashcards (next_review_at);

-- 7. MISTAKE NOTEBOOK (Diagnostic queries)
CREATE INDEX IF NOT EXISTS idx_mistakes_user_id ON public.mistake_notebook (user_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_document_id ON public.mistake_notebook (document_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_status ON public.mistake_notebook (status);

-- 8. SUBSCRIPTION REQUESTS
CREATE INDEX IF NOT EXISTS idx_sub_requests_user_id ON public.subscription_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_sub_requests_status ON public.subscription_requests (status);
