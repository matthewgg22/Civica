import type { SUATier } from "@civica/snap-rules";

interface AddressVerification {
  deliverability: "deliverable" | "deliverable-missing-unit" | "undeliverable" | "unavailable";
  rdi: "Residential" | "Commercial" | "Unknown";
  advisory?: string;
}

interface RentVerification {
  claimed: number | null;
  fmr: number | null;
  ratio: number | null;
  flagged: boolean;
}

interface SuaTierVerification {
  claimed: SUATier | null;
  computed: SUATier | null;
  flagged: boolean;
  heap_flag: boolean;
}

interface IncomeVerification {
  reported_monthly: number | null;
  ocr_monthly: number | null;
  delta_pct: number | null;
  direction: "under" | "over" | "match" | "incomplete" | null;
  flagged: boolean;
  argyle_monthly: number | null;
}

export interface VerificationSummary {
  shelter: {
    address: AddressVerification;
    rent: RentVerification;
    sua_tier: SuaTierVerification;
  };
  income: IncomeVerification;
  obbba: {
    heap_flag: boolean;
    flag_reason: "obbba_heap_change" | null;
  };
}

const DELIVERY_BADGE: Record<AddressVerification["deliverability"], { label: string; cls: string }> = {
  deliverable: { label: "Deliverable", cls: "bg-teal/10 text-teal" },
  "deliverable-missing-unit": { label: "Missing unit", cls: "bg-amber/15 text-amber" },
  undeliverable: { label: "Undeliverable", cls: "bg-brick/10 text-brick" },
  unavailable: { label: "Not checked", cls: "bg-paper text-muted border border-hairline" },
};

const RDI_BADGE: Record<string, { label: string; cls: string }> = {
  Residential: { label: "Residential", cls: "bg-teal/10 text-teal" },
  Commercial: { label: "Commercial", cls: "bg-amber/15 text-amber" },
  Unknown: { label: "RDI unknown", cls: "bg-paper text-muted border border-hairline" },
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
}

function Chip({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-block text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-t border-hairline first:border-t-0">
      <p className="text-[13px] text-graphite shrink-0 w-36">{label}</p>
      <div className="flex-1 text-right">{children}</div>
    </div>
  );
}

function FlagDot({ flagged }: { flagged: boolean }) {
  if (!flagged) return null;
  return <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-amber align-middle" title="Flagged for review" />;
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted mb-2">{title}</p>
      {children}
    </div>
  );
}

export default function APIVerificationPanel({ summary }: { summary: VerificationSummary }) {
  const { shelter, income, obbba } = summary;
  const hasSuaData = shelter.sua_tier.claimed !== null;

  return (
    <div className="space-y-6">
      {/* Shelter */}
      <SubSection title="Shelter">
        {/* Address */}
        <Row label="Address">
          <div className="flex items-center gap-1.5 justify-end flex-wrap">
            <Chip {...DELIVERY_BADGE[shelter.address.deliverability]} />
            {shelter.address.rdi !== "Unknown" && (
              <Chip {...RDI_BADGE[shelter.address.rdi]} />
            )}
            {shelter.address.advisory && (
              <p className="text-[12px] text-amber w-full mt-1 text-right">{shelter.address.advisory}</p>
            )}
          </div>
        </Row>

        {/* Rent vs FMR */}
        <Row label="Rent vs HUD FMR">
          {shelter.rent.claimed === null && shelter.rent.fmr === null ? (
            <p className="text-[13px] text-muted italic">No rent data</p>
          ) : (
            <div>
              <p className="text-[13px] text-ink">
                {shelter.rent.claimed !== null ? `$${fmt(shelter.rent.claimed)}/mo claimed` : "—"}
                {shelter.rent.fmr !== null && (
                  <span className="text-muted"> · FMR ${fmt(shelter.rent.fmr)}</span>
                )}
                <FlagDot flagged={shelter.rent.flagged} />
              </p>
              {shelter.rent.ratio !== null && (
                <p className={`text-[12px] mt-0.5 ${shelter.rent.flagged ? "text-amber font-medium" : "text-muted"}`}>
                  {(shelter.rent.ratio * 100).toFixed(0)}% of FMR
                  {shelter.rent.flagged && " — exceeds 150%, verify lease"}
                </p>
              )}
            </div>
          )}
        </Row>

        {/* SUA Tier */}
        <Row label="SUA Tier">
          {!hasSuaData ? (
            <p className="text-[13px] text-muted italic">Utility questions not yet answered</p>
          ) : (
            <div>
              <p className="text-[13px] text-ink">
                {shelter.sua_tier.claimed ?? "—"}
                <FlagDot flagged={shelter.sua_tier.flagged} />
              </p>
              {shelter.sua_tier.heap_flag && (
                <p className="text-[12px] text-amber font-medium mt-0.5">
                  OBBBA: HEAP recipient may not auto-qualify for Full SUA
                </p>
              )}
            </div>
          )}
        </Row>
      </SubSection>

      {/* Income */}
      <SubSection title="Income">
        <Row label="Reported">
          <p className="text-[13px] text-ink">
            {income.reported_monthly !== null ? `$${fmt(income.reported_monthly)}/mo` : <span className="text-muted italic">—</span>}
          </p>
        </Row>
        <Row label="OCR (paystub)">
          {income.direction === "incomplete" ? (
            <p className="text-[13px] text-amber italic">Partial extraction — pay period missing</p>
          ) : income.ocr_monthly === null ? (
            <p className="text-[13px] text-muted italic">No paystub extraction</p>
          ) : (
            <div>
              <p className="text-[13px] text-ink">
                ${fmt(income.ocr_monthly)}/mo
                <FlagDot flagged={income.flagged} />
              </p>
              {income.delta_pct !== null && (
                <p className={`text-[12px] mt-0.5 ${income.flagged ? "text-amber font-medium" : "text-muted"}`}>
                  {fmtPct(income.delta_pct)} vs reported
                  {income.direction === "over" && " — OCR higher"}
                  {income.direction === "under" && " — OCR lower"}
                </p>
              )}
            </div>
          )}
        </Row>
        {income.argyle_monthly !== null && (
          <Row label="Argyle (payroll)">
            <p className="text-[13px] text-ink">${fmt(income.argyle_monthly)}/mo</p>
          </Row>
        )}
      </SubSection>

      {/* OBBBA Compliance */}
      <SubSection title="OBBBA Compliance">
        {!obbba.heap_flag ? (
          <p className="text-[13px] text-muted italic">No compliance flags</p>
        ) : (
          <div className="flex items-start gap-2 py-2">
            <span className="text-amber text-[16px] shrink-0">⚑</span>
            <div>
              <p className="text-[13px] font-semibold text-ink">HEAP / Full SUA conflict</p>
              <p className="text-[12px] text-graphite mt-0.5 leading-snug">
                HR 1 (2026) removes automatic Full SUA for HEAP recipients. Verify utility expenses directly before handoff.
              </p>
            </div>
          </div>
        )}
      </SubSection>
    </div>
  );
}
