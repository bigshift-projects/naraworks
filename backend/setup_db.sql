-- 1. Create the proposals table with 'naraworks_' prefix
CREATE TABLE IF NOT EXISTS public.naraworks_proposals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    toc JSONB,
    status TEXT DEFAULT 'draft' NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.naraworks_proposals ENABLE ROW LEVEL SECURITY;

-- 3. Create a policy to allow all access for now (Development)
-- Note: In production, you should restrict this to authenticated users
CREATE POLICY "Allow all access to naraworks_proposals" ON public.naraworks_proposals
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 5. Create the knowledge base table
CREATE TABLE IF NOT EXISTS public.naraworks_knowledge (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    filename TEXT NOT NULL,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Enable RLS for knowledge table
ALTER TABLE public.naraworks_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to naraworks_knowledge" ON public.naraworks_knowledge
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 7. Enable realtime for knowledge table
ALTER PUBLICATION supabase_realtime ADD TABLE public.naraworks_knowledge;
