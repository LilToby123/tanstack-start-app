
-- Profiles (XRPL address-keyed users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xrpl_address TEXT UNIQUE NOT NULL,
  destination_tag INTEGER UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE public.dtag_seq START 1000001;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Balances in drops (1 XRP = 1,000,000 drops)
CREATE TABLE public.balances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  drops BIGINT NOT NULL DEFAULT 0 CHECK (drops >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "balances_self_read" ON public.balances FOR SELECT USING (auth.uid() = user_id);

-- Deposits (credited from on-chain)
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tx_hash TEXT UNIQUE NOT NULL,
  drops BIGINT NOT NULL,
  ledger_index BIGINT NOT NULL,
  network TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deposits_self_read" ON public.deposits FOR SELECT USING (auth.uid() = user_id);

-- Withdrawals
CREATE TYPE public.withdrawal_status AS ENUM ('pending','sent','failed');
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_address TEXT NOT NULL,
  drops BIGINT NOT NULL CHECK (drops > 0),
  tx_hash TEXT,
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawals_self_read" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id);

-- Server seed (provably fair) per user, rotated on reveal
CREATE TABLE public.server_seeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seed TEXT NOT NULL,
  seed_hash TEXT NOT NULL,
  client_seed TEXT NOT NULL DEFAULT '',
  nonce INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  revealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX server_seeds_user_active ON public.server_seeds(user_id) WHERE active;
ALTER TABLE public.server_seeds ENABLE ROW LEVEL SECURITY;
-- Only seed_hash visible via dedicated function; deny direct reads
CREATE POLICY "server_seeds_no_select" ON public.server_seeds FOR SELECT USING (false);

-- Bets
CREATE TABLE public.bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  wager_drops BIGINT NOT NULL CHECK (wager_drops > 0),
  payout_drops BIGINT NOT NULL DEFAULT 0,
  multiplier NUMERIC(10,4) NOT NULL DEFAULT 0,
  outcome JSONB NOT NULL,
  seed_id UUID REFERENCES public.server_seeds(id),
  nonce INTEGER NOT NULL,
  client_seed TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bets_user_idx ON public.bets(user_id, created_at DESC);
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bets_self_read" ON public.bets FOR SELECT USING (auth.uid() = user_id);
-- Public can read recent bets feed (without identifying info via view later if needed)
CREATE POLICY "bets_public_feed" ON public.bets FOR SELECT USING (true);

-- Lottery rounds + tickets
CREATE TABLE public.lottery_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_at TIMESTAMPTZ NOT NULL,
  ticket_price_drops BIGINT NOT NULL,
  pot_drops BIGINT NOT NULL DEFAULT 0,
  winner_user_id UUID REFERENCES public.profiles(id),
  winning_ticket UUID,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lottery_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lottery_public_read" ON public.lottery_rounds FOR SELECT USING (true);

CREATE TABLE public.lottery_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.lottery_rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lottery_tickets_round_idx ON public.lottery_tickets(round_id);
ALTER TABLE public.lottery_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lottery_tickets_public_read" ON public.lottery_tickets FOR SELECT USING (true);

-- Trigger: auto-create profile + balance + initial seed on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_addr TEXT;
  v_dtag INTEGER;
BEGIN
  v_addr := COALESCE(NEW.raw_user_meta_data->>'xrpl_address', '');
  v_dtag := nextval('public.dtag_seq');
  INSERT INTO public.profiles (id, xrpl_address, destination_tag, display_name)
  VALUES (NEW.id, v_addr, v_dtag, NEW.raw_user_meta_data->>'display_name');
  INSERT INTO public.balances (user_id, drops) VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
