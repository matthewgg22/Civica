import Foundation

// Per-state eligibility data loaded from a bundled JSON profile —
// `snap_eligibility_<state>.json` under Civica/Features/SNAP/SNAPRules/.
//
// This is the data half of SNAPStateRuleEngine. The logic half lives
// in JsonDrivenStateRules (default JSON-driven implementation) and
// per-state Swift overrides (CAStateRules' LPIE check, etc.). New
// states without state-specific logic need only a JSON profile + a
// one-line registry entry — no Swift conformer required.
//
// Mirrors the same bundle-loading pattern as SNAPRulesLoader (which
// handles document-checklist + flag rules). Kept separate from
// SNAPRulesLoader because the document-checklist source-of-truth
// lives in packages/snap-rules/ and is synced into the iOS bundle
// by a build phase; eligibility-data source-of-truth currently lives
// directly under Civica/ and is iOS-only. If/when the TS engine
// needs the same eligibility data, move source to packages/.

struct StateRuleProfile: Codable, Equatable {
    let stateCode: String
    let displayName: String
    let version: String
    let asOfDate: String
    let sourceCitations: [String: String]?
    let bbce: BBCEConfig?
    let sua: SUAConfig?
    let abawd: ABAWDConfig
    let rmp: RMPConfig
    let categoricalEligibility: CategoricalEligibilityConfig?

    enum CodingKeys: String, CodingKey {
        case stateCode = "state_code"
        case displayName = "display_name"
        case version
        case asOfDate = "as_of_date"
        case sourceCitations = "source_citations"
        case bbce
        case sua
        case abawd
        case rmp
        case categoricalEligibility = "categorical_eligibility"
    }

    // MARK: - BBCE

    struct BBCEConfig: Codable, Equatable {
        /// When false, the state has not opted into BBCE — gross income
        /// limit falls back to federal 130% FPL.
        let enabled: Bool
        /// Threshold as % of FPL (most BBCE states: 200; some: 130, 165, 185).
        let thresholdFplPct: Int
        /// "FFY" (Oct-Sep, used by CA + most states) or "calendar"
        /// (Feb-Jan, used by MA after the HHS calendar-year update).
        let fplBasis: String
        let snapshots: [Snapshot]

        enum CodingKeys: String, CodingKey {
            case enabled
            case thresholdFplPct = "threshold_fpl_pct"
            case fplBasis = "fpl_basis"
            case snapshots
        }

        struct Snapshot: Codable, Equatable {
            let effectiveFrom: String
            let expiresOn: String
            let versionSuffix: String
            /// Index 0 unused; indices 1-8 = HH size monthly thresholds.
            let perSize: [Decimal]
            let perAdditional: Decimal

            enum CodingKeys: String, CodingKey {
                case effectiveFrom = "effective_from"
                case expiresOn = "expires_on"
                case versionSuffix = "version_suffix"
                case perSize = "per_size"
                case perAdditional = "per_additional"
            }
        }
    }

    // MARK: - SUA

    struct SUAConfig: Codable, Equatable {
        let snapshots: [Snapshot]

        struct Snapshot: Codable, Equatable {
            let effectiveFrom: String
            let expiresOn: String
            let versionSuffix: String
            let heatingCooling: Decimal
            let nonHeating: Decimal
            let phoneOnly: Decimal

            enum CodingKeys: String, CodingKey {
                case effectiveFrom = "effective_from"
                case expiresOn = "expires_on"
                case versionSuffix = "version_suffix"
                case heatingCooling = "heating_cooling"
                case nonHeating = "non_heating"
                case phoneOnly = "phone_only"
            }
        }
    }

    // MARK: - ABAWD

    struct ABAWDConfig: Codable, Equatable {
        /// When false, the FNS waiver list has not been loaded for this
        /// state — `abawdWaiverActive` returns nil (data unknown) rather
        /// than asserting false (no waiver). The engine surfaces this as
        /// a stale-rules notice rather than risking incorrect ABAWD
        /// verdicts.
        let waiversLoaded: Bool
        let waivers: [Waiver]

        enum CodingKeys: String, CodingKey {
            case waiversLoaded = "waivers_loaded"
            case waivers
        }

        struct Waiver: Codable, Equatable {
            /// 5-digit FIPS county code.
            let fipsCode: String
            let effectiveFrom: String
            let expiresOn: String
            let source: String?

            enum CodingKeys: String, CodingKey {
                case fipsCode = "fips_code"
                case effectiveFrom = "effective_from"
                case expiresOn = "expires_on"
                case source
            }
        }
    }

    // MARK: - RMP

    struct RMPConfig: Codable, Equatable {
        /// Whether the state participates in the Restaurant Meals Program
        /// (7 CFR 273.10(g)). Most states do not.
        let operated: Bool
        /// 5-digit FIPS county codes where RMP is active. Empty array +
        /// operated=true means the state operates RMP statewide.
        let participatingCountiesFips: [String]

        enum CodingKeys: String, CodingKey {
            case operated
            case participatingCountiesFips = "participating_counties_fips"
        }
    }

    // MARK: - Categorical eligibility

    struct CategoricalEligibilityConfig: Codable, Equatable {
        /// When true, the BBCE outcome is surfaced as the categorical
        /// path when the federal cash-recipient path does not match.
        let bbcePathEnabled: Bool

        enum CodingKeys: String, CodingKey {
            case bbcePathEnabled = "bbce_path_enabled"
        }
    }
}

// MARK: - Loader

enum StateRuleProfileLoader {

    enum LoadError: Error, LocalizedError {
        case fileNotFound(stateCode: String)
        case decodingFailed(stateCode: String, underlying: Error)

        var errorDescription: String? {
            switch self {
            case .fileNotFound(let s):
                return "StateRuleProfile: no bundle resource named "
                    + "'snap_eligibility_\(s.lowercased()).json' — ensure the JSON "
                    + "file exists under Civica/Features/SNAP/SNAPRules/."
            case .decodingFailed(let s, let e):
                return "StateRuleProfile: failed to decode profile for '\(s)': "
                    + e.localizedDescription
            }
        }
    }

    /// Loads the eligibility profile for `stateCode` from `bundle`.
    /// Production callers pass `bundle: .main` (the default); tests
    /// pass a test bundle after including the JSON in the test target.
    ///
    /// Resource naming: `snap_eligibility_ca.json`, `snap_eligibility_ma.json` —
    /// auto-included as bundle resources by the synchronized Civica/ root
    /// group; no build-phase wiring required.
    static func load(stateCode: String, bundle: Bundle = .main) throws -> StateRuleProfile {
        let resourceName = "snap_eligibility_\(stateCode.lowercased())"
        guard let url = bundle.url(forResource: resourceName, withExtension: "json") else {
            throw LoadError.fileNotFound(stateCode: stateCode)
        }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(StateRuleProfile.self, from: data)
        } catch let err as LoadError {
            throw err
        } catch {
            throw LoadError.decodingFailed(stateCode: stateCode, underlying: error)
        }
    }
}

// MARK: - Snapshot date helpers

extension StateRuleProfile.BBCEConfig.Snapshot {
    func contains(_ date: Date) -> Bool {
        guard let from = Self.iso(effectiveFrom), let to = Self.iso(expiresOn) else {
            return false
        }
        return date >= from && date <= to
    }

    var expiresOnDate: Date? { Self.iso(expiresOn) }

    private static func iso(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f.date(from: s)
    }
}

extension StateRuleProfile.SUAConfig.Snapshot {
    func contains(_ date: Date) -> Bool {
        guard let from = Self.iso(effectiveFrom), let to = Self.iso(expiresOn) else {
            return false
        }
        return date >= from && date <= to
    }

    var expiresOnDate: Date? { Self.iso(expiresOn) }

    private static func iso(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f.date(from: s)
    }
}

extension StateRuleProfile.ABAWDConfig.Waiver {
    func covers(fipsCode code: String, asOf date: Date) -> Bool {
        guard fipsCode == code,
              let from = Self.iso(effectiveFrom),
              let to = Self.iso(expiresOn) else {
            return false
        }
        return date >= from && date <= to
    }

    private static func iso(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f.date(from: s)
    }
}
