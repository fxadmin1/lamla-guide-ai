-- ==============================================================================
-- LAMLA Guide AI - Presentation Studio (.pptx AI Slide Generator)
-- Slogan: "It's Never Too Late To Study."
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.presentations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    slide_count INT DEFAULT 6,
    theme TEXT DEFAULT 'midnight_gold', -- 'midnight_gold', 'academic_sapphire', 'emerald_scholar', 'crimson_exec'
    slides_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    pptx_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own presentations"
    ON public.presentations
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_presentations_user_id ON public.presentations(user_id);
