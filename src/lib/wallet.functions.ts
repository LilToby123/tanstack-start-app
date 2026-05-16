import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isLikelyXrplAddress } from "./xrpl";

export const getMyVault = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: balance }] = await Promise.all([
      supabase.from("profiles").select("xrpl_address, destination_tag, display_name").eq("id", userId).maybeSingle(),
      supabase.from("balances").select("drops").eq("user_id", userId).maybeSingle(),
    ]);
    return {
      profile: profile ?? null,
      drops: balance?.drops ? Number(balance.drops) : 0,
      houseAddress: process.env.HOUSE_WALLET_ADDRESS ?? "",
      network: process.env.XRPL_NETWORK?.includes("altnet") ? "Testnet" : "Mainnet",
    };
  });

const MIN_WITHDRAW_DROPS = 1_000_000; // 1 XRP
const NETWORK_FEE_DROPS = 12;          // standard XRPL fee

const WithdrawInput = z.object({
  to_address: z.string().refine(isLikelyXrplAddress, "Invalid XRPL address"),
  drops: z.number().int().min(MIN_WITHDRAW_DROPS),
  destination_tag: z.number().int().min(0).max(4_294_967_295).optional(),
});

export const requestWithdraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => WithdrawInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const seed = process.env.HOUSE_WALLET_SEED;
    const network = process.env.XRPL_NETWORK ?? "wss://s.altnet.rippletest.net:51233";
    if (!seed) return { ok: false as const, error: "House wallet not configured" };

    // 1) Atomic-ish balance check + deduct (gross = drops + fee)
    const totalCost = data.drops + NETWORK_FEE_DROPS;
    const { data: bal } = await supabaseAdmin
      .from("balances")
      .select("drops")
      .eq("user_id", userId)
      .single();
    const current = bal ? Number(bal.drops) : 0;
    if (current < totalCost) return { ok: false as const, error: "Insufficient balance (incl. network fee)" };

    await supabaseAdmin
      .from("balances")
      .update({ drops: current - totalCost, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    const { data: row, error: insErr } = await supabaseAdmin
      .from("withdrawals")
      .insert({ user_id: userId, to_address: data.to_address, drops: data.drops, status: "pending" })
      .select("id")
      .single();
    if (insErr || !row) {
      // refund
      await supabaseAdmin.from("balances").update({ drops: current }).eq("user_id", userId);
      return { ok: false as const, error: "Could not record withdrawal" };
    }

    // 2) Submit on-chain
    try {
      const { Client, Wallet } = await import("xrpl");
      const client = new Client(network);
      await client.connect();
      try {
        const wallet = Wallet.fromSeed(seed);
        const tx: Record<string, unknown> = {
          TransactionType: "Payment",
          Account: wallet.classicAddress,
          Destination: data.to_address,
          Amount: String(data.drops),
        };
        if (data.destination_tag !== undefined) tx.DestinationTag = data.destination_tag;

        const prepared = await client.autofill(tx as never);
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);
        const meta = (result.result.meta as { TransactionResult?: string } | undefined);
        const ok = meta?.TransactionResult === "tesSUCCESS";

        await supabaseAdmin
          .from("withdrawals")
          .update({
            status: ok ? "sent" : "failed",
            tx_hash: result.result.hash,
            error: ok ? null : meta?.TransactionResult ?? "Unknown failure",
          })
          .eq("id", row.id);

        if (!ok) {
          await supabaseAdmin
            .from("balances")
            .update({ drops: current })
            .eq("user_id", userId);
          return { ok: false as const, error: `On-chain failure: ${meta?.TransactionResult}` };
        }

        return { ok: true as const, tx_hash: result.result.hash, new_balance_drops: current - totalCost };
      } finally {
        await client.disconnect();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown XRPL error";
      await supabaseAdmin
        .from("withdrawals")
        .update({ status: "failed", error: msg })
        .eq("id", row.id);
      await supabaseAdmin.from("balances").update({ drops: current }).eq("user_id", userId);
      return { ok: false as const, error: msg };
    }
  });
