-- ==============================================================================
-- LAMLA Guide AI - Production Security & Isolation Hardening Migration
-- Slogan: "It's Never Too Late To Study."
-- ==============================================================================

-- 1. FIX PROFILES PRIVACY & RLS POLICIES
-- Drop insecure "viewable by everyone" policy
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or admin can view all" ON public.profiles;

CREATE POLICY "Users can view own profile or admin can view all"
    ON public.profiles FOR SELECT
    USING (
        auth.uid() = id 
        OR (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    );

-- 2. PREVENT USERS FROM PROMOTING THEMSELVES OR MANIPULATING SUBSCRIPTIONS
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if role, plan_id, or plan_expires_at was changed
    IF (NEW.role IS DISTINCT FROM OLD.role) OR 
       (NEW.plan_id IS DISTINCT FROM OLD.plan_id) OR 
       (NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at) THEN
       
        -- Allow change ONLY if the calling user is an existing admin, or if called by Postgres service_role
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

-- 3. SECURE ADMINISTRATIVE RPC FUNCTIONS
-- Ensure make_user_admin can only be called by an existing admin or service role
CREATE OR REPLACE FUNCTION public.make_user_admin(target_email TEXT)
RETURNS TEXT AS $$
DECLARE
    target_id UUID;
BEGIN
    -- Authorization gate
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

-- Ensure set_user_subscription can only be called by an existing admin or service role
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
    -- Authorization gate
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

-- 4. STORAGE RLS POLICIES FOR 'study-materials'
-- Ensure users can only upload, read, and delete their own study materials in storage
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('study-materials', 'study-materials', false, 1073741824) -- 1 GB limit
ON CONFLICT (id) DO UPDATE SET file_size_limit = 1073741824;

DROP POLICY IF EXISTS "Users can upload their own study materials" ON storage.objects;
CREATE POLICY "Users can upload their own study materials"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'study-materials' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can view their own study materials" ON storage.objects;
CREATE POLICY "Users can view their own study materials"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'study-materials' 
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
        )
    );

DROP POLICY IF EXISTS "Users can delete their own study materials" ON storage.objects;
CREATE POLICY "Users can delete their own study materials"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'study-materials' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
