// XRPL helpers — pure utilities safe for both client and server.
const DROPS_PER_XRP = 1_000_000;

export function xrpToDrops(xrp: number): number {
  return Math.round(xrp * DROPS_PER_XRP);
}

export function dropsToXrp(drops: number | bigint | string): string {
  const n = typeof drops === "bigint" ? Number(drops) : Number(drops);
  return (n / DROPS_PER_XRP).toFixed(6);
}

// Quick syntactic check for an r-address. Strict validation lives server-side
// via the `xrpl` package.
export function isLikelyXrplAddress(addr: string): boolean {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr);
}

export const XRPL_NETWORK_LABEL =
  (typeof process !== "undefined" && process.env?.XRPL_NETWORK?.includes("altnet"))
    ? "Testnet"
    : "Mainnet";
