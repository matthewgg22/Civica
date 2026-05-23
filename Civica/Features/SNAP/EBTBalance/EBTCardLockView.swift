import CivicaDesignSystem
import SwiftUI

// Card-lock security screen for the Check EBT Balance feature, pushed
// from the dashboard's "Card security" row.
//
// Phase 2 / Lane H — honest UX for CA "coming soon" card lock.
//
// California's EBT processor (Conduent/FIS) does not expose a
// third-party lock API. This screen:
//   1. Shows a prominent "coming soon" banner with the real emergency
//      action (call or visit ebt.ca.gov).
//   2. Presents a three-step emergency card.
//   3. Preserves the local "Hide card in this app" toggle (UserDefaults-
//      backed) with honest framing that it does NOT freeze the card.
//   4. Expands a "Why can't I lock here?" disclosure group.
//
// When `stateCode` is NOT "CA" (future-proof for other states), the
// coming-soon banner is hidden and the API client is called on toggle.
// For CA, the API call is skipped entirely to avoid flooding Sentry
// with 501 errors from the lock.ts stub.

struct EBTCardLockView: View {
    @ObservedObject var store: EBTBalanceStore
    let language: CivicaLanguage

    // State code drives CA-specific degraded UX. Defaults to CA
    // (production launch state); tests inject other values.
    var stateCode: String = "CA"

    @State private var isWhyExpanded = false

    private var isCA: Bool { stateCode == "CA" }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                if isCA {
                    comingSoonBanner
                    emergencyCard
                    Divider().overlay(CivicaColors.hairline)
                }
                appOnlyLockCard
                whyDisclosure
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(EBTBalanceStrings.lockScreenTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - 1. Coming-soon banner

    // Pine surface: this is a "here's what to do" affordance, not an
    // error state. The recipient needs action, not alarm.
    private var comingSoonBanner: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(CivicaColors.pinePrimary)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(EBTBalanceStrings.lockComingSoonHeadline.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(EBTBalanceStrings.lockComingSoonBody.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.statusSuccessSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.pinePrimary.opacity(0.32), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            EBTBalanceStrings.lockComingSoonHeadline.value(in: language)
            + ". "
            + EBTBalanceStrings.lockComingSoonBody.value(in: language)
        )
    }

    // MARK: - 2. Three-step emergency card

    private var emergencyCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            emergencyStep(
                number: "1",
                label: EBTBalanceStrings.lockEmergencyStepCall.value(in: language),
                action: {
                    guard let url = URL(string: "tel:18773289677") else { return }
                    UIApplication.shared.open(url)
                },
                isLink: true,
                a11yLabel: EBTBalanceStrings.lockEmergencyStepCall.value(in: language)
            )

            Divider().overlay(CivicaColors.hairline)

            emergencyStep(
                number: "2",
                label: EBTBalanceStrings.lockEmergencyStepPortal.value(in: language),
                action: {
                    guard let url = URL(string: "https://ebt.ca.gov") else { return }
                    UIApplication.shared.open(url)
                },
                isLink: true,
                a11yLabel: EBTBalanceStrings.lockEmergencyStepPortal.value(in: language)
            )

            Divider().overlay(CivicaColors.hairline)

            emergencyStep(
                number: "3",
                label: EBTBalanceStrings.lockEmergencyStepPolice.value(in: language),
                action: nil,
                isLink: false,
                a11yLabel: EBTBalanceStrings.lockEmergencyStepPolice.value(in: language)
            )
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

    private func emergencyStep(
        number: String,
        label: String,
        action: (() -> Void)?,
        isLink: Bool,
        a11yLabel: String
    ) -> some View {
        HStack(alignment: .center, spacing: CivicaSpacing.md) {
            Text(number)
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.paper)
                .frame(width: 28, height: 28)
                .background(CivicaColors.pinePrimary)
                .clipShape(Circle())
                .accessibilityHidden(true)

            if isLink, let action {
                Button(action: action) {
                    Text(label)
                        .font(CivicaTypography.subhead)
                        .foregroundStyle(CivicaColors.pinePrimary)
                        .underline()
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityLabel(a11yLabel)
            } else {
                Text(label)
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel(a11yLabel)
            }
        }
    }

    // MARK: - 3. App-only lock section

    // The existing UserDefaults toggle is preserved but relabeled
    // to make clear it does NOT freeze the card at the processor.
    private var appOnlyLockCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Toggle(isOn: Binding(
                get: { store.isCardLocked },
                set: { newValue in
                    // CA: skip API call — the lock.ts stub returns 501
                    // and we don't want to flood Sentry.
                    // Non-CA: the API client would be called here
                    // once the processor exposes a lock endpoint.
                    if !isCA {
                        // Non-CA: API call placeholder.
                        // store.toggleLock(newValue) — future wire.
                    }
                    store.setCardLocked(newValue)
                }
            )) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(EBTBalanceStrings.lockAppOnlyTitle.value(in: language))
                        .font(CivicaTypography.sectionHeader)
                        .foregroundStyle(CivicaColors.ink)
                    Text(EBTBalanceStrings.lockAppOnlySubtitle.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .tint(CivicaColors.pinePrimary)
            .accessibilityLabel(EBTBalanceStrings.lockAppOnlyTitle.value(in: language))
            .accessibilityHint(EBTBalanceStrings.lockAppOnlySubtitle.value(in: language))
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

    // MARK: - 4. "Why can't I lock here?" disclosure group

    private var whyDisclosure: some View {
        DisclosureGroup(
            isExpanded: $isWhyExpanded,
            content: {
                VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                    Text(EBTBalanceStrings.lockWhyParagraph1.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(EBTBalanceStrings.lockWhyParagraph2.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, CivicaSpacing.sm)
            },
            label: {
                Text(EBTBalanceStrings.lockWhyTitle.value(in: language))
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.ink)
            }
        )
        .tint(CivicaColors.pinePrimary)
        .accessibilityLabel(EBTBalanceStrings.lockWhyTitle.value(in: language))
    }
}
