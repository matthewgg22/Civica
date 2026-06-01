import CivicaDesignSystem
import SwiftUI

// IA-5 of iOS audit 2026-05-29.
//
// Read-only display of the submitted SNAP packet, opened from the
// "Review what you submitted" next-step card on SNAPDecisionDeniedView.
// No edit controls — the goal is for the user to verify what the
// county actually saw, not to rework answers in-place. The CTA at the
// bottom reapplies with the same answers (the draft is preserved by
// the live key in SNAPApplicationDraftStore; nothing here clears it).
//
// Surface kept intentionally simple — a card per section with one
// line of summary text. The full per-section breakdown lives in the
// existing SNAPReviewDraftFlowView which is edit-capable; we deliberately
// don't re-use it here because the contract is different (review vs.
// review-and-edit).

struct SNAPApplicationPacketReviewView: View {
    let language: CivicaLanguage
    let onReapply: () -> Void

    @State private var draft: SNAPApplicationDraft = .init()
    @State private var loaded: Bool = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                sections
                reapplyCTA
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear(perform: loadDraftIfNeeded)
    }

    // MARK: - Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPStatusHomeStrings.deniedReviewPacketTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .accessibilityAddTraits(.isHeader)
                .fixedSize(horizontal: false, vertical: true)

            Text(SNAPStatusHomeStrings.deniedReviewPacketBody.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var sections: some View {
        VStack(spacing: CivicaSpacing.md) {
            summaryCard(
                title: householdTitle,
                value: householdSummary
            )
            summaryCard(
                title: incomeTitle,
                value: incomeSummary
            )
            summaryCard(
                title: expensesTitle,
                value: expensesSummary
            )
            summaryCard(
                title: documentsTitle,
                value: documentsSummary
            )
        }
    }

    private func summaryCard(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(title)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
            Text(value)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title). \(value)")
    }

    private var reapplyCTA: some View {
        Button(action: onReapply) {
            Text(SNAPStatusHomeStrings.deniedReviewReapplyCTA.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.onPrimaryText)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .fill(CivicaColors.pinePrimary)
                )
        }
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Draft loading

    private func loadDraftIfNeeded() {
        guard !loaded else { return }
        loaded = true
        if let persisted = SNAPApplicationDraftStore().load() {
            self.draft = persisted.draft
        }
    }

    // MARK: - Section summaries
    //
    // Plain-text summaries: one line per section is the goal.
    // When a value is unknown we fall back to a localized "Not on
    // file" string so the card never goes blank.

    private var notOnFile: String {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return "Not on file"
        case .spanish: return "No registrado"
        }
    }

    private var householdTitle: String {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return "Household"
        case .spanish: return "Hogar"
        }
    }

    private var householdSummary: String {
        let size = draft.household.householdSize ?? notOnFile
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return "Household size: \(size)"
        case .spanish: return "Tamaño del hogar: \(size)"
        }
    }

    private var incomeTitle: String {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return "Income"
        case .spanish: return "Ingresos"
        }
    }

    private var incomeSummary: String {
        guard let gross = draft.income.grossMonthlyIncome else {
            switch language {
            case .english, .mandarin, .vietnamese, .tagalog: return "Monthly income: \(notOnFile)"
            case .spanish: return "Ingreso mensual: \(notOnFile)"
            }
        }
        let formatted = currencyString(gross)
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return "Monthly income: \(formatted)"
        case .spanish: return "Ingreso mensual: \(formatted)"
        }
    }

    private var expensesTitle: String {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return "Expenses"
        case .spanish: return "Gastos"
        }
    }

    private var expensesSummary: String {
        guard let rent = draft.expenses.monthlyRentOrHousing else {
            switch language {
            case .english, .mandarin, .vietnamese, .tagalog: return "Monthly rent or housing: \(notOnFile)"
            case .spanish: return "Renta o vivienda mensual: \(notOnFile)"
            }
        }
        let formatted = currencyString(rent)
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return "Monthly rent or housing: \(formatted)"
        case .spanish: return "Renta o vivienda mensual: \(formatted)"
        }
    }

    private var documentsTitle: String {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return "Documents"
        case .spanish: return "Documentos"
        }
    }

    private var documentsSummary: String {
        let count = draft.documentsChecklist.documentsAvailable.count
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog:
            return count == 1 ? "1 document on file" : "\(count) documents on file"
        case .spanish:
            return count == 1 ? "1 documento registrado" : "\(count) documentos registrados"
        }
    }

    private func currencyString(_ amount: Decimal) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale(identifier: language == .spanish ? "es_US" : "en_US")
        formatter.maximumFractionDigits = 2
        return formatter.string(from: amount as NSDecimalNumber) ?? "\(amount)"
    }
}

#if DEBUG
struct SNAPApplicationPacketReviewView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            SNAPApplicationPacketReviewView(language: .english, onReapply: {})
        }
    }
}
#endif
