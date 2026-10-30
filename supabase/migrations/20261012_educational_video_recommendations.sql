-- Migration: 20261012_educational_video_recommendations.sql
-- Educational Video Recommendations & External Research Cache for LAMLA Guide AI
-- Slogan: "It's Never Too Late To Study."

CREATE TABLE IF NOT EXISTS public.educational_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_title TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    youtube_url TEXT NOT NULL,
    topic TEXT NOT NULL,
    relevance_reason TEXT NOT NULL,
    duration TEXT DEFAULT '',
    verified BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.educational_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own educational video recommendations"
    ON public.educational_videos FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_educational_videos_doc_id 
    ON public.educational_videos(document_id);
