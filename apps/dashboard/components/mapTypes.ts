export type MapMode = "packets" | "risk";

export type CountyRiskStats = {
  scored: number;
  avgScore: number | null;
  high: number;
  medium: number;
  low: number;
};

export type PacketRiskEntry = { tier: string; score: number | null };
