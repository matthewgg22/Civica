import { describe, it, expect } from "vitest";
import { classifyTenancy, type LeaseClassifierInput } from "../../src/flows/shared-lease/classifier";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseInput: LeaseClassifierInput = {
  intake: {
    lease_in_applicant_name: true,
    leaseholder_name: undefined,
    stated_monthly_rent: 1800,
    payment_method: "bank_transfer",
    address: "123 Main St, Oakland, CA 94601",
  },
  applicant_name: "Maria Gonzalez",
  household_size: 2,
  named_tenants_on_lease: 1,
  rent_transactions: [],
  has_lease_document: true,
};

// ---------------------------------------------------------------------------
// Primary tenancy (auto-flow)
// ---------------------------------------------------------------------------

describe("classifyTenancy — primary tenancy", () => {
  it("auto-flows a standard single-tenant lease", () => {
    const result = classifyTenancy(baseInput);
    expect(result.tenancy).toBe("primary_tenancy");
    expect(result.action).toBe("auto_flow");
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("auto-flows when named tenants match household size exactly", () => {
    const result = classifyTenancy({
      ...baseInput,
      named_tenants_on_lease: 2,
      household_size: 2,
    });
    expect(result.tenancy).toBe("primary_tenancy");
    expect(result.action).toBe("auto_flow");
  });

  it("auto-flows when corporate-shaped bank counterparty present", () => {
    const result = classifyTenancy({
      ...baseInput,
      rent_transactions: [
        { transaction_id: "t1", date: "2026-04-01", amount: 1800, name: "Bay Area Properties LLC" },
        { transaction_id: "t2", date: "2026-03-01", amount: 1800, name: "Bay Area Properties LLC" },
        { transaction_id: "t3", date: "2026-02-01", amount: 1800, name: "Bay Area Properties LLC" },
      ],
    });
    expect(result.tenancy).toBe("primary_tenancy");
    expect(result.action).toBe("auto_flow");
  });
});

// ---------------------------------------------------------------------------
// Sublease (navigator review)
// ---------------------------------------------------------------------------

describe("classifyTenancy — sublease", () => {
  it("routes to navigator when lease is not in applicant name", () => {
    const result = classifyTenancy({
      ...baseInput,
      intake: {
        ...baseInput.intake,
        lease_in_applicant_name: false,
        leaseholder_name: "Robert Chen",
      },
    });
    expect(result.tenancy).toBe("sublease");
    expect(result.action).toBe("navigator_review");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("routes to navigator for cash payment to non-leaseholder", () => {
    const result = classifyTenancy({
      ...baseInput,
      intake: {
        ...baseInput.intake,
        lease_in_applicant_name: false,
        leaseholder_name: "Someone Else",
        payment_method: "cash",
      },
    });
    expect(result.tenancy).toBe("sublease");
    expect(result.action).toBe("navigator_review");
    expect(result.signals.some((s) => s.includes("cash"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Shared tenancy — shelter must be allocated
// ---------------------------------------------------------------------------

describe("classifyTenancy — shared tenancy", () => {
  it("flags shared tenancy when lease lists more tenants than household", () => {
    const result = classifyTenancy({
      ...baseInput,
      named_tenants_on_lease: 3,
      household_size: 2,
    });
    expect(result.tenancy).toBe("shared_tenancy");
    expect(result.action).toBe("navigator_review");
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.signals.some((s) => s.includes("allocated"))).toBe(true);
  });

  it("flags shared tenancy when leaseholder name overlaps applicant name", () => {
    // "M. Gonzalez" vs "Maria Gonzalez" — name overlap
    const result = classifyTenancy({
      ...baseInput,
      intake: {
        ...baseInput.intake,
        lease_in_applicant_name: false,
        leaseholder_name: "Gonzalez",
      },
    });
    expect(result.tenancy).toBe("shared_tenancy");
    expect(result.action).toBe("navigator_review");
  });

  it("escalates when recurring rent goes to a person-shaped counterparty", () => {
    const result = classifyTenancy({
      ...baseInput,
      rent_transactions: [
        { transaction_id: "t1", date: "2026-04-01", amount: 900, name: "John Smith" },
        { transaction_id: "t2", date: "2026-03-01", amount: 900, name: "John Smith" },
        { transaction_id: "t3", date: "2026-02-01", amount: 900, name: "John Smith" },
      ],
    });
    // Person-shaped counterparty despite applicant-named lease → shared_tenancy escalation
    expect(result.action).toBe("navigator_review");
  });
});

// ---------------------------------------------------------------------------
// Informal housing (no lease)
// ---------------------------------------------------------------------------

describe("classifyTenancy — informal", () => {
  it("routes to informal intake when no lease document and no transactions", () => {
    const result = classifyTenancy({
      ...baseInput,
      has_lease_document: false,
      rent_transactions: [],
    });
    expect(result.tenancy).toBe("informal");
    expect(result.action).toBe("informal_housing_intake");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("routes to informal intake with lower confidence when transactions exist but no lease", () => {
    const result = classifyTenancy({
      ...baseInput,
      has_lease_document: false,
      rent_transactions: [
        { transaction_id: "t1", date: "2026-04-01", amount: 800, name: "Rosa Ramirez" },
      ],
    });
    expect(result.tenancy).toBe("informal");
    expect(result.action).toBe("informal_housing_intake");
    expect(result.confidence).toBeLessThan(0.85); // recurring txns = lower confidence than pure informal
  });
});

// ---------------------------------------------------------------------------
// Classifier version
// ---------------------------------------------------------------------------

describe("classifyTenancy — metadata", () => {
  it("includes classifier_version in all outputs", () => {
    const r1 = classifyTenancy(baseInput);
    const r2 = classifyTenancy({ ...baseInput, has_lease_document: false, rent_transactions: [] });
    expect(r1.classifier_version).toMatch(/shared-lease-classifier/);
    expect(r2.classifier_version).toBe(r1.classifier_version);
  });

  it("always populates signals array", () => {
    const result = classifyTenancy(baseInput);
    expect(Array.isArray(result.signals)).toBe(true);
    expect(result.signals.length).toBeGreaterThan(0);
  });
});
