import Foundation
import Testing
@testable import Civica

// Cross-runtime fixture contract:
//
// The 4 primary cases below document the agreed inputs and expected
// required-document category lists that BOTH this iOS engine AND the
// TypeScript snap-rules engine (packages/snap-rules, H-web silo) must
// produce identically for the same inputs.
//
//   Case 1 — basic_household   → [identity, residence, income]
//   Case 2 — student           → [identity, residence, income, student]
//   Case 3 — shelter           → [identity, residence, income, shelter]
//   Case 4 — elderly_medical   → [identity, residence, income, medical]
//
// If either silo changes its condition logic, update both sides in the
// same coordinated PR and add/modify cases here accordingly.

struct SNAPRulesEngineTests {

    // MARK: - Shared fixture rules (mirrors snap_rules_ca.json exactly)

    private static let fixture = SNAPRules(
        stateCode: "CA",
        version: "1.0.0-stub",
        asOfDate: "2026-05-17",
        documentRequirements: [
            .init(
                category: "identity",
                labelEn: "Photo ID",
                labelEs: "Identificación con foto",
                helperEn: "Government-issued photo ID.",
                helperEs: "Identificación con foto emitida por el gobierno.",
                requiredWhen: .always,
                isRequired: true
            ),
            .init(
                category: "residence",
                labelEn: "Proof of address",
                labelEs: "Comprobante de domicilio",
                helperEn: "Utility bill or lease with your address.",
                helperEs: "Factura de servicios o contrato con su dirección.",
                requiredWhen: .always,
                isRequired: true
            ),
            .init(
                category: "income",
                labelEn: "Proof of income",
                labelEs: "Comprobante de ingresos",
                helperEn: "Recent pay stubs or benefit letter.",
                helperEs: "Talones de pago recientes o carta de beneficios.",
                requiredWhen: .always,
                isRequired: true
            ),
            .init(
                category: "shelter",
                labelEn: "Proof of shelter costs",
                labelEs: "Comprobante de gastos de vivienda",
                helperEn: "Lease or mortgage statement.",
                helperEs: "Contrato de arrendamiento o estado hipotecario.",
                requiredWhen: .field(path: "expenses.monthlyRentOrHousing", op: .gt(0)),
                isRequired: false
            ),
            .init(
                category: "student",
                labelEn: "Student enrollment verification",
                labelEs: "Verificación de matrícula estudiantil",
                helperEn: "Enrollment letter or transcript.",
                helperEs: "Carta de matrícula o expediente académico.",
                requiredWhen: .field(path: "studentStatus.enrolledInHigherEd", op: .eq(.bool(true))),
                isRequired: false
            ),
            .init(
                category: "medical",
                labelEn: "Medical expense documentation",
                labelEs: "Documentación de gastos médicos",
                helperEn: "Receipts or bills for monthly medical costs.",
                helperEs: "Recibos o facturas de gastos médicos mensuales.",
                requiredWhen: .and([
                    .field(path: "household.hasElderlyOrDisabled", op: .eq(.bool(true))),
                    .field(path: "expenses.monthlyMedical", op: .gt(0))
                ]),
                isRequired: false
            )
        ],
        flags: []
    )

    // MARK: - Case 1: basic household
    // TS contract: {} → ["identity", "residence", "income"]

    /// No special conditions — only the three always-required documents.
    @Test func basicHousehold_returnsAlwaysRequiredOnly() {
        let result = SNAPRulesEngine.evaluateChecklist(
            rules: Self.fixture,
            draft: SNAPApplicationDraft()
        )
        #expect(result.requiredItems.map(\.category) == ["identity", "residence", "income"])
    }

    // MARK: - Case 2: student
    // TS contract: { studentStatus.enrolledInHigherEd: true }
    //   → ["identity", "residence", "income", "student"]

    /// Enrollment in higher education appends the student category.
    @Test func student_addsStudentCategory() {
        var draft = SNAPApplicationDraft()
        draft.studentStatus.enrolledInHigherEd = true
        let result = SNAPRulesEngine.evaluateChecklist(rules: Self.fixture, draft: draft)
        #expect(result.requiredItems.map(\.category) == ["identity", "residence", "income", "student"])
    }

    // MARK: - Case 3: shelter
    // TS contract: { expenses.monthlyRentOrHousing: 800 }
    //   → ["identity", "residence", "income", "shelter"]

    /// Monthly rent > 0 appends the shelter category.
    @Test func shelter_addsShelterCategory() {
        var draft = SNAPApplicationDraft()
        draft.expenses.monthlyRentOrHousing = 800
        let result = SNAPRulesEngine.evaluateChecklist(rules: Self.fixture, draft: draft)
        #expect(result.requiredItems.map(\.category) == ["identity", "residence", "income", "shelter"])
    }

    // MARK: - Case 4: elderly + medical
    // TS contract: { household.hasElderlyOrDisabled: true, expenses.monthlyMedical: 50 }
    //   → ["identity", "residence", "income", "medical"]

    /// Elderly/disabled household with out-of-pocket medical expenses appends medical.
    @Test func elderlyMedical_addsMedicalCategory() {
        var draft = SNAPApplicationDraft()
        draft.household.hasElderlyOrDisabled = true
        draft.expenses.monthlyMedical = 50
        let result = SNAPRulesEngine.evaluateChecklist(rules: Self.fixture, draft: draft)
        #expect(result.requiredItems.map(\.category) == ["identity", "residence", "income", "medical"])
    }

    // MARK: - DSL edge cases

    /// Elderly flag alone — no medical expenses — must NOT include medical.
    /// The `and` combinator requires both conditions.
    @Test func elderly_withoutMedicalExpenses_omitsMedical() {
        var draft = SNAPApplicationDraft()
        draft.household.hasElderlyOrDisabled = true
        // monthlyMedical left nil
        let result = SNAPRulesEngine.evaluateChecklist(rules: Self.fixture, draft: draft)
        #expect(!result.requiredItems.map(\.category).contains("medical"))
    }

    /// Zero rent must NOT trigger shelter — condition is `gt(0)`, not `isSet`.
    @Test func zeroRent_omitsShelter() {
        var draft = SNAPApplicationDraft()
        draft.expenses.monthlyRentOrHousing = 0
        let result = SNAPRulesEngine.evaluateChecklist(rules: Self.fixture, draft: draft)
        #expect(!result.requiredItems.map(\.category).contains("shelter"))
    }

    // MARK: - Localisation

    /// Spanish locale returns the `label_es` / `helper_es` strings.
    @Test func spanishLocale_returnsSpanishStrings() {
        let result = SNAPRulesEngine.evaluateChecklist(
            rules: Self.fixture,
            draft: SNAPApplicationDraft(),
            locale: Locale(identifier: "es")
        )
        let labels = result.requiredItems.map(\.label)
        #expect(labels.contains("Identificación con foto"))
        #expect(labels.contains("Comprobante de domicilio"))
        #expect(labels.contains("Comprobante de ingresos"))
    }

    // MARK: - JSON round-trip

    /// Codable encode → decode must preserve the full fixture rules struct.
    /// Guards against accidental CodingKey or custom-decoder regressions.
    @Test func jsonRoundTrip_preservesRules() throws {
        let data = try JSONEncoder().encode(Self.fixture)
        let decoded = try JSONDecoder().decode(SNAPRules.self, from: data)
        #expect(decoded == Self.fixture)
    }
}
