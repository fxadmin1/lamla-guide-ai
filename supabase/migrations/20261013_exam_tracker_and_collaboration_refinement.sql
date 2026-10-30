-- ==============================================================================
-- LAMLA Guide AI - Production Migration: Real Exam Tracker & Collaborative Groups
-- Slogan: "It's Never Too Late To Study."
-- ==============================================================================

-- 1. REAL USER-CREATED EXAMINATION TRACKER
CREATE TABLE IF NOT EXISTS public.exam_trackers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    course_code TEXT NOT NULL,
    exam_title TEXT NOT NULL,
    exam_datetime TIMESTAMPTZ NOT NULL,
    target_grade TEXT DEFAULT 'A',
    weight_percentage INT DEFAULT 40,
    topics TEXT[] DEFAULT '{}',
    completed_topics TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.exam_trackers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own exams"
    ON public.exam_trackers
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_exam_trackers_user ON public.exam_trackers(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_trackers_date ON public.exam_trackers(exam_datetime);

-- 2. PERSISTENT MULTI-TURN PERSONAL AI TUTOR MESSAGES
CREATE TABLE IF NOT EXISTS public.session_tutor_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    action_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.session_tutor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their tutor messages"
    ON public.session_tutor_messages
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tutor_msg_session ON public.session_tutor_messages(session_id, created_at);

-- 3. CLASS GROUPS: CHAT MESSAGES WITH ATTACHMENTS & VOICE NOTES
CREATE TABLE IF NOT EXISTS public.circle_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.class_circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    author_role TEXT DEFAULT 'member', -- 'owner', 'assistant_admin', 'member'
    content TEXT,
    attachment_url TEXT,
    attachment_type TEXT, -- 'image', 'document', 'voice_note'
    is_pinned BOOLEAN DEFAULT false,
    reactions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.circle_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view messages in their circles"
    ON public.circle_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.circle_members cm
            WHERE cm.circle_id = circle_messages.circle_id
              AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can post messages to their circles"
    ON public.circle_messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.circle_members cm
            WHERE cm.circle_id = circle_messages.circle_id
              AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Authors or admins can update messages"
    ON public.circle_messages
    FOR UPDATE
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.circle_members cm
            WHERE cm.circle_id = circle_messages.circle_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('owner', 'assistant_admin')
        )
    );

CREATE INDEX IF NOT EXISTS idx_circle_messages_circle ON public.circle_messages(circle_id, created_at DESC);

-- 4. CLASS GROUPS: SHARED DOCUMENT / ASSIGNMENT WORKSPACE
CREATE TABLE IF NOT EXISTS public.circle_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.class_circles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    last_edited_by_name TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.circle_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view shared assignments"
    ON public.circle_assignments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.circle_members cm
            WHERE cm.circle_id = circle_assignments.circle_id
              AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can create and update shared assignments"
    ON public.circle_assignments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.circle_members cm
            WHERE cm.circle_id = circle_assignments.circle_id
              AND cm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.circle_members cm
            WHERE cm.circle_id = circle_assignments.circle_id
              AND cm.user_id = auth.uid()
        )
    );

-- 5. CLASS GROUPS: ACADEMIC WHITEBOARD STATE
CREATE TABLE IF NOT EXISTS public.circle_whiteboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID UNIQUE NOT NULL REFERENCES public.class_circles(id) ON DELETE CASCADE,
    elements JSONB DEFAULT '[]'::jsonb,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.circle_whiteboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can access circle whiteboard"
    ON public.circle_whiteboards
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.circle_members cm
            WHERE cm.circle_id = circle_whiteboards.circle_id
              AND cm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.circle_members cm
            WHERE cm.circle_id = circle_whiteboards.circle_id
              AND cm.user_id = auth.uid()
        )
    );

-- 6. CLASS GROUPS: LIVE STUDY MEETINGS & SYNCHRONIZED VIEWER
CREATE TABLE IF NOT EXISTS public.circle_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.class_circles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    active_participants TEXT[] DEFAULT '{}',
    current_material_url TEXT,
    current_slide_index INT DEFAULT 1,
    temporary_files TEXT[] DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ
);

ALTER TABLE public.circle_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view and participate in meetings"
    ON public.circle_meetings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.circle_members cm
            WHERE cm.circle_id = circle_meetings.circle_id
              AND cm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.circle_members cm
            WHERE cm.circle_id = circle_meetings.circle_id
              AND cm.user_id = auth.uid()
        )
    );
