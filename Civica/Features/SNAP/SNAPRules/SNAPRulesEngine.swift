import Foundation

// MARK: - Output types

struct RequiredItem: Equatable {
    let category: String
    let label: String
    let helper: String
}

struct ActiveFlag: Equatable {
    let key: String
    let label: String
    let context: String
}

struct ChecklistResult: Equatable {
    let requiredItems: [RequiredItem]
    let activeFlags: [ActiveFlag]
}

// MARK: - Engine

enum SNAPRulesEngine {

    /// Evaluates the document-checklist rules for a given draft and returns
    /// the ordered list of required documents plus any active contextual flags.
    ///
    /// `locale` controls which language strings are returned (en / es).
    /// Falls back to English when the Spanish string is empty.
    ///
    /// Both runtimes (iOS + TypeScript dashboard) must return identical
    /// `requiredItems` categories for the same draft inputs. Fixture
    /// contract is documented in the PR and in SNAPRulesEngineTests.
    static func evaluateChecklist(
        rules: SNAPRules,
        draft: SNAPApplicationDraft,
        locale: Locale = .current
    ) -> ChecklistResult {
        let usesSpanish = locale.language.languageCode?.identifier == "es"

        let items: [RequiredItem] = rules.documentRequirements.compactMap { req in
            guard evaluate(req.requiredWhen, draft: draft) else { return nil }
            let label  = usesSpanish && !req.labelEs.isEmpty  ? req.labelEs  : req.labelEn
            let helper = usesSpanish && !req.helperEs.isEmpty ? req.helperEs : req.helperEn
            return RequiredItem(category: req.category, label: label, helper: helper)
        }

        let flags: [ActiveFlag] = rules.flags.compactMap { flag in
            guard evaluate(flag.triggerWhen, draft: draft) else { return nil }
            let label   = usesSpanish && !flag.labelEs.isEmpty   ? flag.labelEs   : flag.labelEn
            let context = usesSpanish && !flag.contextEs.isEmpty ? flag.contextEs : flag.contextEn
            return ActiveFlag(key: flag.key, label: label, context: context)
        }

        return ChecklistResult(requiredItems: items, activeFlags: flags)
    }

    // MARK: - Expression evaluation

    private static func evaluate(_ expr: RulesExpression, draft: SNAPApplicationDraft) -> Bool {
        switch expr {
        case .always:
            return true
        case .never:
            return false
        case .and(let exprs):
            return exprs.allSatisfy { evaluate($0, draft: draft) }
        case .or(let exprs):
            return exprs.contains { evaluate($0, draft: draft) }
        case .not(let inner):
            return !evaluate(inner, draft: draft)
        case .field(let path, let op):
            return evaluateField(path: path, op: op, draft: draft)
        }
    }

    private static func evaluateField(
        path: String,
        op: RulesExpression.FieldOp,
        draft: SNAPApplicationDraft
    ) -> Bool {
        switch op {
        case .eq(let expected):
            switch expected {
            case .bool(let b):   return fieldAsBool(path, draft) == b
            case .number(let n): return fieldAsDouble(path, draft) == n
            case .string(let s): return fieldAsString(path, draft) == s
            }
        case .gt(let t):
            guard let n = fieldAsDouble(path, draft) else { return false }
            return n > t
        case .lt(let t):
            guard let n = fieldAsDouble(path, draft) else { return false }
            return n < t
        case .gte(let t):
            guard let n = fieldAsDouble(path, draft) else { return false }
            return n >= t
        case .lte(let t):
            guard let n = fieldAsDouble(path, draft) else { return false }
            return n <= t
        case .isSet:
            return fieldIsSet(path, draft)
        }
    }

    // MARK: - Field accessors
    //
    // Hard-coded switch on path string — avoids Mirror reflection and
    // keeps the supported-paths contract visible and compile-checked.
    // Add new paths here whenever the JSON DSL is extended.

    private static func fieldAsBool(_ path: String, _ draft: SNAPApplicationDraft) -> Bool? {
        switch path {
        case "household.hasElderlyOrDisabled":   return draft.household.hasElderlyOrDisabled
        case "household.hasMinorInHousehold":    return draft.household.hasMinorInHousehold
        case "studentStatus.enrolledInHigherEd": return draft.studentStatus.enrolledInHigherEd
        case "studentStatus.enrolledHalfTime":   return draft.studentStatus.enrolledHalfTime
        case "studentStatus.works20PlusHours":   return draft.studentStatus.works20PlusHours
        case "studentStatus.inWorkStudy":        return draft.studentStatus.inWorkStudy
        case "expenses.paysUtilitiesSeparately": return draft.expenses.paysUtilitiesSeparately
        default:                                 return nil
        }
    }

    private static func fieldAsDouble(_ path: String, _ draft: SNAPApplicationDraft) -> Double? {
        switch path {
        case "expenses.monthlyRentOrHousing":
            return draft.expenses.monthlyRentOrHousing.map { NSDecimalNumber(decimal: $0).doubleValue }
        case "expenses.monthlyMedical":
            return draft.expenses.monthlyMedical.map { NSDecimalNumber(decimal: $0).doubleValue }
        case "expenses.monthlyChildcare":
            return draft.expenses.monthlyChildcare.map { NSDecimalNumber(decimal: $0).doubleValue }
        case "income.grossMonthlyIncome":
            return draft.income.grossMonthlyIncome.map { NSDecimalNumber(decimal: $0).doubleValue }
        default:
            return nil
        }
    }

    private static func fieldAsString(_ path: String, _ draft: SNAPApplicationDraft) -> String? {
        switch path {
        case "whereApplying.stateCode": return draft.whereApplying.stateCode
        default:                        return nil
        }
    }

    private static func fieldIsSet(_ path: String, _ draft: SNAPApplicationDraft) -> Bool {
        fieldAsBool(path, draft) != nil
            || fieldAsDouble(path, draft) != nil
            || fieldAsString(path, draft) != nil
    }
}
