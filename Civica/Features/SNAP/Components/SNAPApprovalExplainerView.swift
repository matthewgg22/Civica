import CivicaDesignSystem
import SwiftUI

// JR-4 of the iOS product audit (2026-05-29).
//
// Read-only "what being on CalFresh means for you" page presented as a
// sheet from `SNAPApprovalBannerCard`'s "What this means for you" action.
// Short, factual, non-celebratory — household-budget impact, EBT usage,
// work-requirements reminder. Mirrors the pattern of SNAPDataPrivacyView
// (informational sheet, no state, dismissable).

struct SNAPApprovalExplainerView: View {
    let language: CivicaLanguage
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                    headerBlock
                    bullet(
                        title: SNAPApprovalExplainerStrings.budgetTitle,
                        body: SNAPApprovalExplainerStrings.budgetBody
                    )
                    bullet(
                        title: SNAPApprovalExplainerStrings.ebtTitle,
                        body: SNAPApprovalExplainerStrings.ebtBody
                    )
                    bullet(
                        title: SNAPApprovalExplainerStrings.workTitle,
                        body: SNAPApprovalExplainerStrings.workBody
                    )
                    bullet(
                        title: SNAPApprovalExplainerStrings.renewalTitle,
                        body: SNAPApprovalExplainerStrings.renewalBody
                    )
                    Spacer(minLength: CivicaSpacing.lg)
                }
                .padding(CivicaSpacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(CivicaColors.paper.ignoresSafeArea())
            .navigationTitle(SNAPApprovalExplainerStrings.navTitle.value(in: language))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(SNAPApprovalExplainerStrings.doneCTA.value(in: language)) {
                        dismiss()
                    }
                }
            }
        }
    }

    private var headerBlock: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPApprovalExplainerStrings.headerTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .accessibilityAddTraits(.isHeader)
            Text(SNAPApprovalExplainerStrings.headerBody.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func bullet(title: CivicaText, body: CivicaText) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(title.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            Text(body.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

enum SNAPApprovalExplainerStrings {
    static let navTitle = CivicaText("CalFresh", es: "CalFresh")
    static let doneCTA = CivicaText("Done", es: "Listo")

    static let headerTitle = CivicaText(
        "What being on CalFresh means",
        es: "Lo que significa estar en CalFresh"
    )
    static let headerBody = CivicaText(
        "A short overview of how CalFresh works day-to-day so you know what to expect.",
        es: "Un resumen breve de cómo funciona CalFresh día a día para que sepas qué esperar."
    )

    static let budgetTitle = CivicaText(
        "Your monthly food budget",
        es: "Tu presupuesto mensual para comida"
    )
    static let budgetBody = CivicaText(
        "Your CalFresh benefit is loaded onto your EBT card every month on the same date. It's calculated from your household size, income, and certain expenses.",
        es: "Tu beneficio de CalFresh se carga en tu tarjeta EBT cada mes en la misma fecha. Se calcula según el tamaño de tu hogar, ingresos y ciertos gastos."
    )

    static let ebtTitle = CivicaText(
        "Using your EBT card",
        es: "Cómo usar tu tarjeta EBT"
    )
    static let ebtBody = CivicaText(
        "Use it like a debit card at most grocery stores and many farmers' markets. It covers groceries and seeds — not hot prepared food, alcohol, or non-food items.",
        es: "Úsala como una tarjeta de débito en la mayoría de las tiendas y muchos mercados de agricultores. Cubre alimentos y semillas — no comida caliente preparada, alcohol ni artículos no alimentarios."
    )

    static let workTitle = CivicaText(
        "Work and reporting",
        es: "Trabajo y reportes"
    )
    static let workBody = CivicaText(
        "If your income or household size changes, report it to your county. Some adults have work requirements — your approval notice will say if that applies to you.",
        es: "Si tus ingresos o el tamaño de tu hogar cambian, repórtalo a tu condado. Algunos adultos tienen requisitos de trabajo — tu aviso de aprobación indicará si te aplica."
    )

    static let renewalTitle = CivicaText(
        "Renewing each year",
        es: "Renovación cada año"
    )
    static let renewalBody = CivicaText(
        "Your benefits last about a year before you renew. We'll remind you when it's time and pre-fill what we already have.",
        es: "Tus beneficios duran aproximadamente un año antes de la renovación. Te recordaremos cuando sea el momento y pre-llenaremos lo que ya tenemos."
    )
}

#if DEBUG
struct SNAPApprovalExplainerView_Previews: PreviewProvider {
    static var previews: some View {
        SNAPApprovalExplainerView(language: .english)
    }
}
#endif
