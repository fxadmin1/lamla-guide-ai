-- ==============================================================================
-- LAMLA Guide AI - Class Circles & Peer Collaboration Migration
-- Slogan: "It's Never Too Late To Study."
-- ==============================================================================

-- 1. CLASS CIRCLES (COURSE STUDY GROUPS)
CREATE TABLE IF NOT EXISTS public.class_circles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    course_code TEXT NOT NULL, -- e.g. "ECON 201", "BIOL 101"
    institution TEXT DEFAULT 'University / Senior High School',
    description TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invite_code TEXT UNIQUE NOT NULL,
    member_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.class_circles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view class circles"
    ON public.class_circles
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create class circles"
    ON public.class_circles
    FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their class circles"
    ON public.class_circles
    FOR UPDATE
    USING (auth.uid() = created_by);

-- 2. CIRCLE MEMBERSHIP
CREATE TABLE IF NOT EXISTS public.circle_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.class_circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member', -- 'admin', 'member'
    joined_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_circle_membership UNIQUE(circle_id, user_id)
);

ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of circles"
    ON public.circle_members
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can join circles"
    ON public.circle_members
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave circles"
    ON public.circle_members
    FOR DELETE
    USING (auth.uid() = user_id);

-- 3. SHARED STUDY DECKS & SESSIONS
CREATE TABLE IF NOT EXISTS public.shared_decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.class_circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    course_code TEXT NOT NULL,
    notes_summary TEXT,
    questions_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.shared_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view decks in their circles"
    ON public.shared_decks
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can share decks to circles"
    ON public.shared_decks
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 4. CIRCLE DISCUSSIONS & PEER Q&A
CREATE TABLE IF NOT EXISTS public.circle_discussions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.class_circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    question TEXT NOT NULL,
    tutor_explanation TEXT,
    is_resolved BOOLEAN DEFAULT false,
    upvotes INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.circle_discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view circle discussions"
    ON public.circle_discussions
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can post questions in circles"
    ON public.circle_discussions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_class_circles_code ON public.class_circles(course_code);
CREATE INDEX IF NOT EXISTS idx_circle_members_user ON public.circle_members(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_decks_circle ON public.shared_decks(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_discussions_circle ON public.circle_discussions(circle_id);
