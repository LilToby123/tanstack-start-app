# XRPL Game + Tools Platform — Build Plan

## Important upfront notes

1. **Legal**: Real-money games of chance are regulated in most jurisdictions. You typically need a gambling license (Curaçao, Anjouan, Malta, etc.) before accepting mainnet deposits from real users. I'll build the platform; you handle licensing/ToS/geo-blocking before going live.
2. **Custody risk**: Holding user XRP means running a hot wallet. We'll architect it so the house seed lives only in Lovable Cloud secrets, never in the frontend. I strongly recommend launching on **XRPL Testnet first** (same code, free XRP from faucet) and flipping a config flag to mainnet once audited.
3. **Provably fair**: Each game round will commit a server-seed hash before the bet and reveal the seed after, so players can verify the RNG.

## Phase 1 — Foundation (this build)

**Stack**
- TanStack Start frontend + Lovable Cloud (Postgres, auth, server functions)
- `xrpl` JS library for XRPL interaction
- Xaman (xumm-sdk) for wallet sign-in + deposit signing via QR/deeplink
- Network toggle: testnet (default) ↔ mainnet via env flag

**Auth & wallet**
- Sign-in with Xaman (SignIn payload → verifies XRPL address)
- User row keyed by XRPL r-address
- Balance ledger held off-chain in Postgres (credits XRP after on-chain deposit confirmed)

**Deposit flow**
- Each user gets a unique destination tag for the house wallet
- Background poller (cron-style server route) watches house wallet, credits balances by destination tag
- Withdrawals: user requests → server signs Payment from house wallet → records txid

**Games (4 mechanics)**
1. **Coin flip** — 2× payout, 49% win rate (1% house edge)
2. **Dice** — pick under/over a number 2–98, payout = 99/chance
3. **Crash** — multiplier rises, cash out before crash; provably-fair crash point
4. **Lottery** — hourly draw, ticket buy-in, winner takes pot minus rake

All games use HMAC(server_seed, client_seed:nonce) for RNG; pre-commit hash, post-reveal seed.

**XRPL Tools tab**
- Address explorer (balance, recent tx, trust lines)
- Token (IOU) lookup
- Send XRP (signs via connected Xaman)
- Trust line manager

## Phase 2 (future, not in this build)
- Leaderboards, referral system, chat
- More games (roulette, plinko, blackjack)
- NFT integration
- Mainnet launch + audit

## Technical architecture

```
Frontend (TanStack Start)
  ├── routes/index.tsx          → landing
  ├── routes/games/             → coin, dice, crash, lottery
  ├── routes/tools/             → explorer, send, trustlines
  ├── routes/wallet.tsx         → balance, deposit, withdraw
  └── routes/_authenticated/    → requires Xaman sign-in

Lovable Cloud
  ├── tables: users, balances, deposits, withdrawals,
  │           bets, game_rounds, server_seeds, lottery_tickets
  ├── server fns: signInXaman, placeBet, requestWithdraw,
  │               buyTicket, revealSeed
  └── public route: /api/public/xrpl-poller (cron-callable)

Secrets (Lovable Cloud)
  ├── HOUSE_WALLET_SEED         (mainnet & testnet)
  ├── XUMM_API_KEY / XUMM_SECRET
  └── XRPL_NETWORK              (wss://s.altnet.rippletest.net:51233 by default)
```

## What I'll do first (this turn)

1. Enable Lovable Cloud
2. Install `xrpl` and `xumm-sdk`
3. Build the design system + landing page with hero, game previews, tools section
4. Scaffold the route tree (games, tools, wallet, authenticated layout)
5. Database tables + RLS
6. Coin flip game end-to-end (testnet) as the reference implementation
7. Xaman sign-in + deposit/withdraw plumbing

Dice, crash, lottery, and the tools pages will follow in next iterations once you've confirmed the foundation works.

## Confirmation needed
- OK to **default to testnet** with a mainnet toggle, rather than going straight to mainnet? (Strongly recommended.)
- Do you have a **Xaman developer account** (xumm.app/developer) for API keys? If not, I'll build the UI and request the secrets when needed.
- Brand/name for the platform? Color vibe (neon casino, minimal fintech, dark/gold luxury)?