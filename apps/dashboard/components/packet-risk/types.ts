export type Defensibility = "strong" | "moderate" | "weak" | "not-scored";

export type RiskFlow = {
  id: string;
  label: string;
  weight: number;
  defensibility: Defensibility;
  points: number | null;
  detail: string;
  evidence: { label: string; value: string }[];
  actionable: boolean;
  impactIfImproved: number | null;
};

export type RiskAction = {
  id: string;
  n: number;
  title: string;
  flowLabel: string;
  weight: number;
  impact: number;
  timeEst: string;
  actor: string;
  body: string;
  cta: string;
  ctaSub: string;
};
