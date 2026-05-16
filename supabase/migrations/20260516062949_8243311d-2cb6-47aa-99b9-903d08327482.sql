
DROP TABLE IF EXISTS public.lottery_tickets CASCADE;
DROP TABLE IF EXISTS public.lottery_rounds CASCADE;

DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
DROP POLICY IF EXISTS profiles_public_read ON public.profiles;
CREATE POLICY profiles_public_read ON public.profiles FOR SELECT USING (true);

ALTER TABLE public.bets REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
