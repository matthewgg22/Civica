import CivicaDesignSystem
import SwiftUI

// CA state directory surface — fixed entries that connect the
// recipient directly to the agency that handles their EBT card
// (lost/stolen replacement, CalFresh application, county-office
// finder, fraud reporting). No backend dependency; the data lives
// in EBTAccountServicesDirectory.
//
// Navigation: surfaced from EBTBalanceDashboardView via a row at the
// bottom (small change vs. adding a new home tile). The hosting nav
// stack provides the title bar.

struct EBTAccountServicesView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                introBlock
                section(
                    header: EBTAccountServicesStrings.urgentSectionTitle,
                    entries: EBTAccountServicesDirectory.urgent,
                    tint: CivicaColors.amberPrimary
                )
                section(
                    header: EBTAccountServicesStrings.benefitsSectionTitle,
                    entries: EBTAccountServicesDirectory.benefits,
                    tint: CivicaColors.pinePrimary
                )
                section(
                    header: EBTAccountServicesStrings.reportingSectionTitle,
                    entries: EBTAccountServicesDirectory.reporting,
                    tint: CivicaColors.graphite
                )
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(EBTAccountServicesStrings.screenTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Intro

    private var introBlock: some View {
        Text(EBTAccountServicesStrings.intro.value(in: language))
            .font(CivicaTypography.body)
            .foregroundStyle(CivicaColors.graphite)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isStaticText)
    }

    // MARK: - Section

    private func section(
        header: CivicaText,
        entries: [EBTAccountServicesEntry],
        tint: Color
    ) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(header.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: CivicaSpacing.sm) {
                ForEach(entries) { entry in
                    entryRow(entry, tint: tint)
                }
            }
        }
    }

    // MARK: - Row

    @ViewBuilder
    private func entryRow(_ entry: EBTAccountServicesEntry, tint: Color) -> some View {
        let titleText = entry.title.value(in: language)
        let a11yLabel: String = {
            switch entry.action {
            case .call:
                return EBTAccountServicesStrings.callActionA11y(rowTitle: titleText, language: language)
            case .openURL:
                return EBTAccountServicesStrings.openLinkA11y(rowTitle: titleText, language: language)
            }
        }()

        if let url = entry.url {
            Link(destination: url) {
                rowContent(entry, tint: tint)
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(a11yLabel)
            .accessibilityHint(entry.help.value(in: language))
            .accessibilityAddTraits(.isLink)
        } else {
            rowContent(entry, tint: tint)
                .accessibilityElement(children: .combine)
        }
    }

    private func rowContent(_ entry: EBTAccountServicesEntry, tint: Color) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: entry.iconName)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 28, alignment: .center)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(entry.title.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(entry.help.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            Image(systemName: ctaChevron(for: entry.action))
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private func ctaChevron(for action: EBTAccountServicesEntry.Action) -> String {
        switch action {
        case .call:    return "phone.fill"
        case .openURL: return "arrow.up.right.square"
        }
    }
}

#if DEBUG
struct EBTAccountServicesView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            EBTAccountServicesView()
        }
    }
}
#endif
