-- ==============================================================================
-- LAMLA Guide AI - Production Database Schema (Supabase PostgreSQL)
-- Slogan: "It's Never Too Late To Study."
-- Built for students across Ghana (Senior High School, University, Colleges, Professional)
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. PROFILES (Extends Supabase auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    phone_number TEXT DEFAULT '',
    educational_level TEXT NOT NULL DEFAULT 'shs', 
    -- 'shs', 'university', 'college', 'professional', 'other'
    institution TEXT DEFAULT '',
    program_of_study TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'student', 
    -- 'student', 'admin'
    plan_id TEXT NOT NULL DEFAULT 'free', 
    -- 'free', 'standard', 'premium'
    plan_expires_at TIMESTAMPTZ,
    streak_days INT NOT NULL DEFAULT 0,
    total_study_minutes INT NOT NULL DEFAULT 0,
    points INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies: Private to owner, with admin access
CREATE POLICY "Users can view own profile or admin can view all"
    ON public.profiles FOR SELECT
    USING (
        auth.uid() = id 
        OR (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    );

CREATE POLICY "Users can update their own profile." 
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Prevent ordinary users from self-promoting to admin or altering plan_id
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.role IS DISTINCT FROM OLD.role) OR 
       (NEW.plan_id IS DISTINCT FROM OLD.plan_id) OR 
       (NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at) THEN
       
        IF (auth.uid() IS NOT NULL) AND NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        ) THEN
            RAISE EXCEPTION 'Unauthorized: Only platform administrators can modify user roles or subscription tiers.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_privileges();

-- -----------------------------------------------------------------------------
-- 2. AUTOMATIC PROFILE CREATION TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        email, 
        full_name, 
        educational_level, 
        institution, 
        program_of_study, 
        role, 
        plan_id
    )
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'educational_level', 'shs'),
        COALESCE(new.raw_user_meta_data->>'institution', ''),
        COALESCE(new.raw_user_meta_data->>'program_of_study', ''),
        COALESCE(new.raw_user_meta_data->>'role', 'student'),
        'free'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 3. DOCUMENTS (Lecture slides, PDFs, notes, photos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_url TEXT,
    file_type TEXT NOT NULL, 
    -- 'pdf', 'pptx', 'docx', 'image', 'txt'
    file_size_bytes BIGINT DEFAULT 0,
    slide_or_page_count INT DEFAULT 1,
    extracted_text TEXT DEFAULT '',
    structured_data JSONB DEFAULT '{}'::jsonb, 
    -- slide-by-slide titles, text, notes, key concepts
    processing_status TEXT NOT NULL DEFAULT 'pending', 
    -- 'pending', 'processing', 'completed', 'failed'
    processing_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own documents"
    ON public.documents FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. SUMMARIES & STUDY NOTES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    style TEXT NOT NULL DEFAULT 'Exam-Oriented',
    content TEXT NOT NULL,
    key_points JSONB DEFAULT '[]'::jsonb,
    slide_references JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own summaries"
    ON public.summaries FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.study_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subject TEXT DEFAULT '',
    content TEXT NOT NULL,
    formulae JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.study_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own study notes"
    ON public.study_notes FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5. QUIZZES & PRACTICE QUESTIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'intermediate', 
    -- 'easy', 'intermediate', 'difficult'
    question_type TEXT NOT NULL DEFAULT 'mcq',
    -- 'mcq', 'true_false', 'short_answer'
    reveal_mode TEXT NOT NULL DEFAULT 'on_submit',
    -- 'immediate', 'on_submit'
    time_limit_minutes INT NOT NULL DEFAULT 15,
    passing_score INT NOT NULL DEFAULT 70,
    total_questions INT NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own quizzes"
    ON public.quizzes FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'mcq',
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_answer TEXT NOT NULL,
    marking_guide TEXT DEFAULT '',
    explanation TEXT NOT NULL,
    source_reference TEXT DEFAULT '',
    order_index INT NOT NULL DEFAULT 0
);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access questions for their quizzes"
    ON public.quiz_questions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.quizzes q
            WHERE q.id = quiz_questions.quiz_id
            AND q.user_id = auth.uid()
        )
    );

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    score_percentage NUMERIC NOT NULL,
    total_questions INT NOT NULL,
    correct_count INT NOT NULL,
    answers_submitted JSONB NOT NULL DEFAULT '{}'::jsonb,
    time_taken_seconds INT NOT NULL DEFAULT 0,
    passed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own quiz attempts"
    ON public.quiz_attempts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 6. FLASHCARDS (Active Recall & Spaced Repetition)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flashcard_decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subject TEXT DEFAULT '',
    card_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own flashcard decks"
    ON public.flashcard_decks FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    slide_reference TEXT DEFAULT '',
    mastery_level INT NOT NULL DEFAULT 0, 
    -- 0=new, 1=learning, 2=mastered
    next_review_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access cards for their decks"
    ON public.flashcards FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.flashcard_decks d
            WHERE d.id = flashcards.deck_id
            AND d.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- 7. AI TUTOR SESSIONS & CHAT HISTORY
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutor_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    topic TEXT NOT NULL DEFAULT 'General Study Assistance',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.tutor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their tutor sessions"
    ON public.tutor_sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.tutor_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.tutor_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL, 
    -- 'user', 'assistant'
    content TEXT NOT NULL,
    slide_citations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.tutor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their tutor messages"
    ON public.tutor_messages FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 8. SUBSCRIPTION REQUESTS (WhatsApp / Mobile Money Offline Flow)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL, 
    -- 'standard', 'premium'
    amount_ghs NUMERIC NOT NULL,
    student_whatsapp TEXT NOT NULL,
    payment_reference TEXT DEFAULT '',
    network TEXT DEFAULT 'MTN Mobile Money', 
    -- 'MTN Mobile Money', 'Telecel Cash', 'AT Money'
    status TEXT NOT NULL DEFAULT 'pending', 
    -- 'pending', 'approved', 'rejected'
    admin_notes TEXT DEFAULT '',
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

-- Students can view and create their own subscription requests
CREATE POLICY "Students can view their subscription requests"
    ON public.subscription_requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Students can submit subscription requests"
    ON public.subscription_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can view and update all subscription requests
CREATE POLICY "Admins can view all subscription requests"
    ON public.subscription_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    );

CREATE POLICY "Admins can update subscription requests"
    ON public.subscription_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    );

-- -----------------------------------------------------------------------------
-- 9. ADMIN ROLES & HELPER FUNCTION
-- -----------------------------------------------------------------------------
-- Function for founder to elevate an account to administrator (Strictly Admin only)
CREATE OR REPLACE FUNCTION public.make_user_admin(target_email TEXT)
RETURNS TEXT AS $$
DECLARE
    target_id UUID;
BEGIN
    IF (auth.uid() IS NOT NULL) AND NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only super administrators can invoke this function.';
    END IF;

    SELECT id INTO target_id FROM public.profiles WHERE email = target_email;
    IF target_id IS NULL THEN
        RETURN 'Error: User profile not found for email ' || target_email;
    END IF;

    UPDATE public.profiles 
    SET role = 'admin', plan_id = 'premium', updated_at = now()
    WHERE id = target_id;

    RETURN 'Success: ' || target_email || ' is now an Administrator and Premium user.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for admin to approve a student subscription (Strictly Admin only)
CREATE OR REPLACE FUNCTION public.approve_subscription_request(request_id UUID)
RETURNS TEXT AS $$
DECLARE
    req RECORD;
BEGIN
    IF (auth.uid() IS NOT NULL) AND NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only platform administrators can approve subscriptions.';
    END IF;

    SELECT * INTO req FROM public.subscription_requests WHERE id = request_id;
    IF req IS NULL THEN
        RETURN 'Error: Request not found';
    END IF;

    -- Update request status
    UPDATE public.subscription_requests
    SET status = 'approved', reviewed_at = now()
    WHERE id = request_id;

    -- Upgrade student profile plan
    UPDATE public.profiles
    SET 
        plan_id = req.plan_id,
        plan_expires_at = now() + INTERVAL '30 days',
        updated_at = now()
    WHERE id = req.user_id;

    RETURN 'Success: Student upgraded to ' || req.plan_id || ' for 30 days.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for administrator to manually change user subscription plan and validity months
CREATE OR REPLACE FUNCTION public.set_user_subscription(
    target_email TEXT, 
    target_plan TEXT, 
    duration_months INT DEFAULT 1
)
RETURNS TEXT AS $$
DECLARE
    target_id UUID;
    new_expiry TIMESTAMPTZ;
BEGIN
    IF (auth.uid() IS NOT NULL) AND NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only platform administrators can manage subscriptions.';
    END IF;

    SELECT id INTO target_id FROM public.profiles WHERE email = target_email;
    IF target_id IS NULL THEN
        RETURN 'Error: User profile not found for email ' || target_email;
    END IF;

    -- Calculate expiration date
    IF target_plan = 'free' OR duration_months <= 0 THEN
        new_expiry := NULL;
    ELSE
        new_expiry := now() + (duration_months || ' months')::INTERVAL;
    END IF;

    -- Update student profile
    UPDATE public.profiles
    SET 
        plan_id = target_plan,
        plan_expires_at = new_expiry,
        updated_at = now()
    WHERE id = target_id;

    RETURN 'Success: ' || target_email || ' set to ' || UPPER(target_plan) || 
           CASE 
               WHEN new_expiry IS NOT NULL THEN ' (Valid until ' || to_char(new_expiry, 'YYYY-MM-DD HH24:MI') || ' UTC)'
               ELSE ' (Permanent / Free)'
           END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 10. HIGH-SCALE PERFORMANCE INDEXES (100k to 1M+ Users & Massive File Sets)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_xp_points ON public.profiles (xp_points DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_id ON public.profiles (plan_id);
CREATE INDEX IF NOT EXISTS idx_profiles_institution ON public.profiles (institution);
CREATE INDEX IF NOT EXISTS idx_profiles_educational_level ON public.profiles (educational_level);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents (user_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_user_created ON public.documents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON public.documents (processing_status);

CREATE INDEX IF NOT EXISTS idx_summaries_document_id ON public.summaries (document_id);
CREATE INDEX IF NOT EXISTS idx_summaries_user_id ON public.summaries (user_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_document_id ON public.study_notes (document_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_user_id ON public.study_notes (user_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_subject ON public.study_notes (subject);

CREATE INDEX IF NOT EXISTS idx_quizzes_document_id ON public.quizzes (document_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON public.quizzes (user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_order ON public.quiz_questions (quiz_id, order_index);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_created_at ON public.quiz_attempts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_flashcard_decks_document_id ON public.flashcard_decks (document_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_user_id ON public.flashcard_decks (user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_deck_id ON public.flashcards (deck_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON public.flashcards (next_review_at);

CREATE INDEX IF NOT EXISTS idx_mistakes_user_id ON public.mistake_notebook (user_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_document_id ON public.mistake_notebook (document_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_status ON public.mistake_notebook (status);

CREATE INDEX IF NOT EXISTS idx_sub_requests_user_id ON public.subscription_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_sub_requests_status ON public.subscription_requests (status);


