import Foundation

// Codable structs mirroring packages/snap-rules/data/{state}.json.
// H-web silo owns the canonical JSON authoring; iOS bundles a copy
// produced by the "Sync SNAP Rules JSON" build phase script.
//
// JSON top-level schema:
//   state_code    — two-letter USPS code (e.g. "CA")
//   version       — semver of this rule file
//   as_of_date    — ISO-8601 date the rules were authored
//   document_requirements[] — ordered; see DocumentRequirement
//   flags[]       — contextual nudges; see Flag
//
// Expression DSL used in required_when / trigger_when:
//   {"always": true}
//   {"never":  true}
//   {"field": "<path>", "eq":  <bool|number|string>}
//   {"field": "<path>", "gt":  <number>}   // strictly greater
//   {"field": "<path>", "lt":  <number>}   // strictly less
//   {"field": "<path>", "gte": <number>}
//   {"field": "<path>", "lte": <number>}
//   {"field": "<path>", "isSet": true}     // field is non-nil
//   {"and": [<Expr>, ...]}
//   {"or":  [<Expr>, ...]}
//   {"not": <Expr>}
//
// Supported field paths (evaluate against SNAPApplicationDraft):
//   household.hasElderlyOrDisabled
//   household.hasMinorInHousehold
//   studentStatus.enrolledInHigherEd
//   studentStatus.enrolledHalfTime
//   studentStatus.works20PlusHours
//   studentStatus.inWorkStudy
//   expenses.monthlyRentOrHousing
//   expenses.monthlyMedical
//   expenses.monthlyChildcare
//   expenses.paysUtilitiesSeparately
//   income.grossMonthlyIncome

struct SNAPRules: Codable, Equatable {
    let stateCode: String
    let version: String
    let asOfDate: String
    let documentRequirements: [DocumentRequirement]
    let flags: [Flag]

    enum CodingKeys: String, CodingKey {
        case stateCode = "state_code"
        case version
        case asOfDate = "as_of_date"
        case documentRequirements = "document_requirements"
        case flags
    }

    struct DocumentRequirement: Codable, Equatable {
        let category: String
        let labelEn: String
        let labelEs: String
        let helperEn: String
        let helperEs: String
        let requiredWhen: RulesExpression
        let isRequired: Bool

        enum CodingKeys: String, CodingKey {
            case category
            case labelEn = "label_en"
            case labelEs = "label_es"
            case helperEn = "helper_en"
            case helperEs = "helper_es"
            case requiredWhen = "required_when"
            case isRequired = "is_required"
        }
    }

    struct Flag: Codable, Equatable {
        let key: String
        let triggerWhen: RulesExpression
        let labelEn: String
        let labelEs: String
        let contextEn: String
        let contextEs: String

        enum CodingKeys: String, CodingKey {
            case key
            case triggerWhen = "trigger_when"
            case labelEn = "label_en"
            case labelEs = "label_es"
            case contextEn = "context_en"
            case contextEs = "context_es"
        }
    }
}

// MARK: - Rules Expression DSL

// Recursive enum; `indirect` needed for .and, .or, and .not branches.
indirect enum RulesExpression: Codable, Equatable {
    case always
    case never
    case field(path: String, op: FieldOp)
    case and([RulesExpression])
    case or([RulesExpression])
    case not(RulesExpression)

    enum FieldOp: Equatable {
        case eq(JSONPrimitive)
        case gt(Double)
        case lt(Double)
        case gte(Double)
        case lte(Double)
        case isSet
    }

    private enum CodingKeys: String, CodingKey {
        case always, never, field, eq, gt, lt, gte, lte, isSet, and, or, not
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if c.contains(.always) {
            self = .always
        } else if c.contains(.never) {
            self = .never
        } else if c.contains(.and) {
            self = .and(try c.decode([RulesExpression].self, forKey: .and))
        } else if c.contains(.or) {
            self = .or(try c.decode([RulesExpression].self, forKey: .or))
        } else if c.contains(.not) {
            self = .not(try c.decode(RulesExpression.self, forKey: .not))
        } else if c.contains(.field) {
            let path = try c.decode(String.self, forKey: .field)
            let op: FieldOp
            if c.contains(.eq) {
                op = .eq(try c.decode(JSONPrimitive.self, forKey: .eq))
            } else if c.contains(.gt) {
                op = .gt(try c.decode(Double.self, forKey: .gt))
            } else if c.contains(.lt) {
                op = .lt(try c.decode(Double.self, forKey: .lt))
            } else if c.contains(.gte) {
                op = .gte(try c.decode(Double.self, forKey: .gte))
            } else if c.contains(.lte) {
                op = .lte(try c.decode(Double.self, forKey: .lte))
            } else if c.contains(.isSet) {
                op = .isSet
            } else {
                throw DecodingError.dataCorruptedError(
                    forKey: .field, in: c,
                    debugDescription: "field expression missing operator (eq, gt, lt, gte, lte, isSet)"
                )
            }
            self = .field(path: path, op: op)
        } else {
            throw DecodingError.dataCorrupted(.init(
                codingPath: decoder.codingPath,
                debugDescription: "unrecognised RulesExpression shape — expected always/never/field/and/or/not"
            ))
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .always:
            try c.encode(true, forKey: .always)
        case .never:
            try c.encode(true, forKey: .never)
        case .and(let exprs):
            try c.encode(exprs, forKey: .and)
        case .or(let exprs):
            try c.encode(exprs, forKey: .or)
        case .not(let expr):
            try c.encode(expr, forKey: .not)
        case .field(let path, let op):
            try c.encode(path, forKey: .field)
            switch op {
            case .eq(let v):  try c.encode(v, forKey: .eq)
            case .gt(let v):  try c.encode(v, forKey: .gt)
            case .lt(let v):  try c.encode(v, forKey: .lt)
            case .gte(let v): try c.encode(v, forKey: .gte)
            case .lte(let v): try c.encode(v, forKey: .lte)
            case .isSet:      try c.encode(true, forKey: .isSet)
            }
        }
    }
}

// MARK: - JSON Primitive

// Scalar value type used in .eq comparisons. Bool must be decoded
// before Double — JSONDecoder otherwise coerces true/false to 1.0/0.0.
enum JSONPrimitive: Codable, Equatable {
    case bool(Bool)
    case number(Double)
    case string(String)

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let b = try? c.decode(Bool.self)   { self = .bool(b);   return }
        if let n = try? c.decode(Double.self) { self = .number(n); return }
        if let s = try? c.decode(String.self) { self = .string(s); return }
        throw DecodingError.typeMismatch(
            JSONPrimitive.self,
            .init(codingPath: decoder.codingPath,
                  debugDescription: "expected Bool, Double, or String for JSONPrimitive")
        )
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .bool(let b):   try c.encode(b)
        case .number(let n): try c.encode(n)
        case .string(let s): try c.encode(s)
        }
    }
}

// MARK: - Loader

enum SNAPRulesLoader {

    enum LoadError: Error, LocalizedError {
        case fileNotFound(stateCode: String)
        case decodingFailed(stateCode: String, underlying: Error)

        var errorDescription: String? {
            switch self {
            case .fileNotFound(let s):
                return "SNAPRules: no bundle resource named 'snap_rules_\(s.lowercased()).json' — "
                    + "ensure the 'Sync SNAP Rules JSON' build phase has run."
            case .decodingFailed(let s, let e):
                return "SNAPRules: failed to decode rules for '\(s)': \(e.localizedDescription)"
            }
        }
    }

    /// Loads the document-checklist rules for `stateCode` from `bundle`.
    ///
    /// Production callers pass `bundle: .main` (the default).
    /// Tests pass `Bundle(for: type(of: self))` after including the JSON
    /// files in the CivicaTests target, or build SNAPRules inline.
    ///
    /// Resource naming: `snap_rules_ca.json`, `snap_rules_ma.json` —
    /// copied into the bundle root by the "Sync SNAP Rules JSON" build
    /// phase, which mirrors packages/snap-rules/data/*.json.
    static func load(stateCode: String, bundle: Bundle = .main) throws -> SNAPRules {
        let resourceName = "snap_rules_\(stateCode.lowercased())"
        guard let url = bundle.url(forResource: resourceName, withExtension: "json") else {
            throw LoadError.fileNotFound(stateCode: stateCode)
        }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(SNAPRules.self, from: data)
        } catch let err as LoadError {
            throw err
        } catch {
            throw LoadError.decodingFailed(stateCode: stateCode, underlying: error)
        }
    }
}
