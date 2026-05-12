import CivicaDesignSystem
import SwiftUI

// Recertification Companion dashboard.
//
// Composes four features (Phantom Recert, Expiration Calendar,
// Just-in-Time Reminders, Procedural Appeal) into a single home view.
// Surfaced from CivicaEntryView when RecertCompanionFeatureFlag is on,
// and from CivicaRootView when SNAPApplicationStatusStore.status is
// .recertDue.
//
// Scaffolded in Step 2. Sub-feature CTAs are wired in subsequent steps.

struct RecertCompanionRoot: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                // Sub-feature surfaces are inserted in later steps:
                //  - Recert-date card + edit affordance (Step 3)
                //  - Phantom Recert entry tile (Step 5)
                //  - Expiration calendar preview (Step 3)
                //  - Reminders permission card (Step 4)
                //  - Appeal CTA (Step 6, only when status == .decisionDenied)
                Spacer(minLength: CivicaSpacing.xl)
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(RecertCompanionStrings.homeTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            RecertCompanionAnalytics.trackHomeViewed()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(RecertCompanionStrings.homeTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(RecertCompanionStrings.homeSubtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

#if DEBUG
struct RecertCompanionRoot_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            RecertCompanionRoot()
        }
    }
}
#endif
