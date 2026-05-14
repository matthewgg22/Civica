import CivicaDesignSystem
import SwiftUI

// Entry surface for the Check EBT Balance feature (Propel-style
// balance dashboard). Phase 0: scaffold only — a titled screen the
// home-page tile can navigate to. Phases 1–4 layer in the hero
// balance card, mock card-linking flow, transaction history, and
// card-lock security.
//
// Demo scope: California only. The feature simulates a connected
// EBT account from fixtures; it does not integrate with a real
// state EBT system.

struct EBTBalanceRootView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                Text(EBTBalanceStrings.placeholderBody.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)

                Text(EBTBalanceStrings.demoDisclosure.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(EBTBalanceStrings.screenTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
    }
}

#if DEBUG
struct EBTBalanceRootView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            EBTBalanceRootView()
        }
    }
}
#endif
