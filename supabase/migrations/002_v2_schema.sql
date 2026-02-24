-- Migration 002: v2.0 schema cleanup
-- Remove server-side session state (replaced by client-side Skills)
-- Remove insights table (merged into memories as learning/research_finding types)

DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.insights CASCADE;
DROP TYPE IF EXISTS public.session_status CASCADE;
