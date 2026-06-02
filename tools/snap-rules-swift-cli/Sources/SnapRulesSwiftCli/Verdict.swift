// Verdict composer — independent Swift port from Python source-of-truth
// `backend/civic_api/snap/rules/federal.py` + 7 CFR 273 regulatory text.
//
// Matches the TS composer's gate order. When TS and this Swift port both
// pass for a profile, the regulatory encoding is robust. When they
// disagree, one port has a bug — localized by which side matches the
// oracle.

import Foundation

enum Verdict: String, Codable { case APPROVE, DENY }

struct VerdictResult: Codable {
    var verdict: Verdict?
    var benefit: Double?
    var reason: String?
    var not_implemented_surfaces: [String]?

    init(verdict: Verdict? = nil, benefit: Double? = nil, reason: String? = nil, not_implemented_surfaces: [String]? = nil) {
        self.verdict = verdict
        self.benefit = benefit
        self.reason = reason
        self.not_implemented_surfaces = not_implemented_surfaces
    }
}

private func skip(_ surfaces: [String], _ reason: String) -> VerdictResult {
    VerdictResult(verdict: nil, benefit: nil, reason: reason, not_implemented_surfaces: surfaces)
}
private func deny(_ reason: String?) -> VerdictResult {
    VerdictResult(verdict: .DENY, benefit: nil, reason: reason)
}
private func approve(_ benefit: Double, _ reason: String) -> VerdictResult {
    VerdictResult(verdict: .APPROVE, benefit: benefit, reason: reason)
}

private let OBBBA_EFFECTIVE = {
    var c = DateComponents()
    c.year = 2025; c.month = 11; c.day = 1
    c.timeZone = TimeZone(identifier: "UTC")
    return Calendar(identifier: .gregorian).date(from: c)!
}()

// ─── Immigration ─────────────────────────────────────────────────────────

func memberImmigrationEligible(_ m: Member, asOf: Date) -> Bool {
    let imm = m.immigration ?? "citizen"
    if imm == "citizen" || imm == "cofa" { return true }
    if imm == "lpr" {
        let bar = m.five_yr_bar ?? "n/a"
        if bar == "n/a" { return true }
        if bar.hasPrefix("exempt:") { return true }
        if Double(bar) != nil { return false }
        return true
    }
    if imm == "refugee" { return asOf < OBBBA_EFFECTIVE }
    if imm.hasPrefix("removed_status:") { return false }
    if imm == "undocumented" { return false }
    return false
}

// ─── Gates ───────────────────────────────────────────────────────────────

private func evalImmigration(_ facts: Facts, asOf: Date) -> (passes: Bool, reason: String?) {
    let eligible = facts.household.filter { memberImmigrationEligible($0, asOf: asOf) }
    if eligible.isEmpty {
        return (false, "no_eligible_household_member [7 CFR 273.4; FNA 6(f)]")
    }
    return (true, nil)
}

private func evalDisqualifications(_ facts: Facts, state: String, asOf: Date) throws -> (passes: Bool, reason: String?) {
    let policy = try statePolicyFor(state)
    let activeWarrant = facts.active_warrant == true
    var disqualifiedIds: [String] = []

    for m in facts.household {
        for tag in (m.disqual ?? []) {
            if tag == "lottery" {
                return (false, "household_lottery_disqualification [7 CFR 272.17]: \(m.member_id)")
            }
            if tag == "drug_felony" {
                if policy.drugFelonyBan {
                    return (false, "drug_felony_state_ban [7 CFR 273.11(m)]: \(m.member_id)")
                }
                continue
            }
            if tag.hasPrefix("ipv:") {
                disqualifiedIds.append(m.member_id)
                continue
            }
            if tag == "fleeing_felon" {
                if activeWarrant { disqualifiedIds.append(m.member_id) }
                continue
            }
        }
    }
    let remaining = facts.household.filter {
        !disqualifiedIds.contains($0.member_id) && memberImmigrationEligible($0, asOf: asOf)
    }
    if remaining.isEmpty {
        return (false, "no_eligible_member_after_disqualifications [7 CFR 273.16; 273.11]")
    }
    return (true, nil)
}

private func evalComposition(_ facts: Facts) -> (passes: Bool, reason: String?) {
    if facts.must_combine_with_parent == true {
        return (false, "mandatory_combination_under22 [7 CFR 273.1(a)]")
    }
    if let pct = facts.coresident_income_pct, pct > 165 {
        return (false, "coresident_income_over_165pct [7 CFR 273.1(b)]: \(pct)% FPL")
    }
    if facts.shares_meals == true,
       facts.household.contains(where: { $0.role == "boarder" }) {
        return (false, "boarder_not_independent_household [7 CFR 273.1(a)]")
    }
    return (true, nil)
}

private struct CategoricalResult {
    let path: String  // "pure_cash" | "none"
    let skipAssetTest: Bool
    let skipGrossTest: Bool
}

private func evalCategorical(_ facts: Facts) -> CategoricalResult {
    switch facts.cat_elig {
    case "pure_SSI", "pure_PA", "pure_TANF":
        return CategoricalResult(path: "pure_cash", skipAssetTest: true, skipGrossTest: true)
    default:
        return CategoricalResult(path: "none", skipAssetTest: false, skipGrossTest: false)
    }
}

private func evalStudent(_ facts: Facts) -> (passes: Bool, reason: String?) {
    let atRisk = facts.household.filter {
        $0.age >= 18 && $0.age <= 49 && $0.student == "he_halftime_subject"
    }
    if atRisk.isEmpty { return (true, nil) }
    for m in atRisk {
        if let s = m.student, s.hasPrefix("he_exempt:") { continue }
        return (false, "ineligible_student [7 CFR 273.5]: \(m.member_id)")
    }
    return (true, nil)
}

private func evalAbawd(_ facts: Facts, asOf: Date) -> (passes: Bool, reason: String?) {
    let veteranHomelessExempt = asOf < OBBBA_EFFECTIVE
    let ceiling = asOf < OBBBA_EFFECTIVE ? 49 : 64

    for m in facts.household {
        let wc = m.work_class ?? ""
        if wc == "gen_work_subject" || wc.hasPrefix("exempt:") { continue }

        if wc.hasPrefix("abawd_exempt:") {
            let reason = String(wc.dropFirst("abawd_exempt:".count))
            if reason == "veteran_homeless" && !veteranHomelessExempt {
                // Exemption removed post-OBBBA → fall through to time-limit.
            } else { continue }
        } else if wc != "abawd_subject" { continue }

        if m.age < 18 || m.age > ceiling { continue }
        let used = m.abawd_months_used ?? 0
        if used >= 3 {
            return (false, "abawd_time_limit_exhausted [7 CFR 273.24]: \(m.member_id) used \(used) months")
        }
    }
    return (true, nil)
}

private func grossIncomeTest(_ facts: Facts, state: String, asOf: Date) throws -> (passes: Bool, reason: String?) {
    let size = householdSize(facts)
    let fpl = try fplMonthly(size: size, asOf: asOf)
    let policy = try statePolicyFor(state)
    let ratio: Double = (policy.bbce && policy.bbceThresholdPct != nil) ? policy.bbceThresholdPct! / 100.0 : GROSS_INCOME_TEST_RATIO
    let threshold = roundDollar(fpl * ratio)
    let gross = roundDollar(aggregateIncome(facts).gross)
    let passes = gross <= threshold
    return (passes, passes ? nil : "gross_income_over_\(Int(ratio * 100))pct_fpl [7 CFR 273.9(a)(1)]")
}

private func assetTest(_ facts: Facts, state: String, asOf: Date) throws -> (passes: Bool, waived: Bool, reason: String?) {
    let policy = try statePolicyFor(state)
    if policy.assetWaiver { return (true, true, "state asset waiver") }
    guard let cassets = facts.assets.asNumber else {
        return (true, true, "no countable assets")
    }
    let isED = hasElderlyOrDisabled(facts)
    let limit = try assetLimitFor(isED: isED, asOf: asOf)
    let passes = cassets <= limit
    return (passes, false, passes ? nil : "assets_over_limit [7 CFR 273.8]: \(cassets) > \(limit)")
}

// ─── Benefit calc ────────────────────────────────────────────────────────

private struct BenefitDetail {
    let benefit: Double
    let net: Double
}

private func computeBenefit(_ facts: Facts, state: String, asOf: Date) throws -> BenefitDetail {
    let snap = try snapshotFor(asOf)
    let policy = try statePolicyFor(state)
    let inc = aggregateIncome(facts)
    let size = householdSize(facts)
    let isED = hasElderlyOrDisabled(facts)

    let eid = roundDollar(inc.earned * snap.earnedIncomeDeductionRate)
    let sd = try standardDeductionFor(size: size, asOf: asOf)
    let depCare = facts.deductions.dependent_care ?? 0
    let rawMedical = facts.deductions.medical_unreimbursed ?? 0
    let medical = (isED && rawMedical > snap.medicalFloor) ? rawMedical - snap.medicalFloor : 0.0
    let childSupport = facts.deductions.child_support_paid ?? 0
    let otherDed = depCare + medical + childSupport

    var adjIncome = inc.gross - eid - sd - otherDed
    if adjIncome < 0 { adjIncome = 0 }

    let homeless = facts.shelter.homeless_deduction == true
    var excessShelter = 0.0
    if homeless {
        excessShelter = snap.homelessDeduction
    } else {
        guard let suaTable = policy.suaByTier else {
            throw NSError(domain: "BenefitCalc", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "SUA not authored for \(state)"])
        }
        let suaVal = suaTable[facts.shelter.sua_tier] ?? 0
        let internet = (asOf < OBBBA_EFFECTIVE) ? (facts.shelter.internet ?? 0) : 0
        let shelterAmt = facts.shelter.rent + suaVal + internet
        let rawExcess = shelterAmt - 0.5 * adjIncome
        if rawExcess < 0 { excessShelter = 0 }
        else if isED { excessShelter = rawExcess }
        else { excessShelter = min(rawExcess, snap.shelterCap) }
    }

    var net = adjIncome - excessShelter
    if net < 0 { net = 0 }

    let thirtyPctNet = roundDollar(net * 0.30)
    let maxAllot = try maxAllotmentFor(size: size, asOf: asOf)
    var benefit = maxAllot - thirtyPctNet
    if benefit < 0 { benefit = 0 }
    if size <= 2 && benefit >= 0 && benefit < snap.minimumBenefit {
        benefit = snap.minimumBenefit
    }
    benefit = roundDollar(benefit)
    return BenefitDetail(benefit: benefit, net: net)
}

// ─── Composer ────────────────────────────────────────────────────────────

func composeVerdict(_ facts: Facts, state: String, asOf: Date) -> VerdictResult {
    let policy: StatePolicy
    do { policy = try statePolicyFor(state) }
    catch {
        return skip(["state-policy-not-loaded"], "unknown state \(state)")
    }

    if facts.shelter.sua_tier != .none && facts.shelter.homeless_deduction != true && policy.suaByTier == nil {
        return skip(["shelter.sua.\(facts.shelter.sua_tier.rawValue)"], "SUA not authored for state \(state)")
    }

    let imm = evalImmigration(facts, asOf: asOf)
    if !imm.passes { return deny(imm.reason) }

    do {
        let disq = try evalDisqualifications(facts, state: state, asOf: asOf)
        if !disq.passes { return deny(disq.reason) }
    } catch {
        return skip(["disqualifications-error"], "\(error)")
    }

    let comp = evalComposition(facts)
    if !comp.passes { return deny(comp.reason) }

    let cat = evalCategorical(facts)
    let stu = evalStudent(facts)
    if !stu.passes { return deny(stu.reason) }

    let abawd = evalAbawd(facts, asOf: asOf)
    if !abawd.passes { return deny(abawd.reason) }

    var bbceConferred = false
    do {
        if !cat.skipGrossTest && !hasElderlyOrDisabled(facts) {
            let gross = try grossIncomeTest(facts, state: state, asOf: asOf)
            if !gross.passes { return deny(gross.reason) }
            if policy.bbce { bbceConferred = true }
        }
    } catch {
        return skip(["gross-income-error"], "\(error)")
    }

    do {
        let asset = try assetTest(facts, state: state, asOf: asOf)
        if !cat.skipAssetTest && !asset.passes { return deny(asset.reason) }
    } catch {
        return skip(["asset-test-error"], "\(error)")
    }

    do {
        let detail = try computeBenefit(facts, state: state, asOf: asOf)
        if !cat.skipGrossTest && !bbceConferred {
            let size = householdSize(facts)
            let fpl = try fplMonthly(size: size, asOf: asOf)
            let netThreshold = roundDollar(fpl * NET_INCOME_TEST_RATIO)
            let actualNet = roundDollar(detail.net)
            if actualNet > netThreshold {
                return deny("net_income_over_100pct_fpl [7 CFR 273.9(a)(2)]")
            }
        }
        return approve(detail.benefit, cat.path == "pure_cash" ? "approved via pure_cash" : "approved")
    } catch {
        return skip(["benefit-calc-error"], "\(error)")
    }
}
