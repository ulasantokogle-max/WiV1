-- WiV1 staging security hardening: pin trigger function search_path.
-- This keeps updated_at behavior intact and avoids mutable search_path warnings.
alter function public.set_updated_at() set search_path = '';
