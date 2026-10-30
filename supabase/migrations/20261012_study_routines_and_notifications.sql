-- ==============================================================================
-- LAMLA Guide AI - Study Routines, Spaced Repetition & Notification Architecture
-- Slogan: "It's Never Too Late To Study."
-- ==============================================================================

-- 1. STUDY ROUTINES & HABIT PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.study_routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    daily_question_target INT DEFAULT 10,
    preferred_study_time TIME DEFAULT '19:00:00',
    reminder_enabled BOOLEAN DEFAULT true,
    browser_push_enabled BOOLEAN DEFAULT false,
    email_reminders_enabled BOOLEAN DEFAULT false,
    streak_freeze_credits INT DEFAULT 2,
    streak_freeze_used_at TIMESTAMPTZ,
    exam_date DATE,
    exam_subject TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_user_study_routine UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.study_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own study routine"
    ON public.study_routines
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. DAILY STUDY LOGS (FOR CONSISTENCY HEATMAP & GOAL PROGRESS)
CREATE TABLE IF NOT EXISTS public.study_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    study_date DATE NOT NULL DEFAULT CURRENT_DATE,
    questions_answered INT DEFAULT 0,
    minutes_spent INT DEFAULT 0,
    sessions_reviewed TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_user_study_date UNIQUE(user_id, study_date)
);

ALTER TABLE public.study_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and update their own study logs"
    ON public.study_logs
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. SPACED REPETITION REVISION QUEUE
CREATE TABLE IF NOT EXISTS public.revision_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    session_title TEXT NOT NULL,
    interval_stage INT DEFAULT 1, -- 1: Day 1, 2: Day 3, 3: Day 7, 4: Day 14, 5: Day 30
    next_revision_date DATE NOT NULL,
    last_reviewed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'skipped'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.revision_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own revision schedules"
    ON public.revision_schedules
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. IN-APP NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.in_app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'study_reminder', -- 'study_reminder', 'streak_shield', 'exam_countdown', 'milestone'
    action_url TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own in-app notifications"
    ON public.in_app_notifications
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_study_logs_user_date ON public.study_logs(user_id, study_date);
CREATE INDEX IF NOT EXISTS idx_revision_schedules_user_date ON public.revision_schedules(user_id, next_revision_date);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_read ON public.in_app_notifications(user_id, read);
