import CivicaDesignSystem
import SwiftUI

// Card-lock security screen for the Check EBT Balance feature, pushed
// from the dashboard's "Card security" row.
//
// The primary lock toggle is the Propel-style "keep your card locked
// when you're not shopping" protection; two secondary toggles narrow
// where the card can be used. All three persist via EBTBalanceStore.
//
// Demo scope: toggles drive the locked banner + status copy only —
// there is no real EBT card to lock. Phase 4.

struct EBTCardLockView: View {
    @ObservedObject var store: EBTBalanceStore
    let language: CivicaLanguage

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                demoBanner
                lockCard
                extrasCard
                demoDisclosure
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(EBTBalanceStrings.lockScreenTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Prominent demo-mode banner

    // Shown at the top of the lock screen at all times. The lock toggles
    // are the dangerous affordance here — a user who believes a demo
    // lock is real may skip reporting a stolen card. The banner names
    // the real action (CA EBT customer service) so it stays useful even
    // for a confused recipient.
    private var demoBanner: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(CivicaColors.warningAmber)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(EBTBalanceStrings.lockScreenDemoBannerTitle.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(EBTBalanceStrings.lockScreenDemoBannerBody.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.statusWarningSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.warningAmber, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }

    // MARK: - Primary lock card

    private var lockCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Toggle(isOn: Binding(
                get: { store.isCardLocked },
                set: { store.setCardLocked($0) }
            )) {
                HStack(spacing: CivicaSpacing.sm) {
                    Image(systemName: store.isCardLocked ? "lock.fill" : "lock.open")
                        .foregroundStyle(store.isCardLocked ? CivicaColors.pinePrimary : CivicaColors.graphite)
                        .accessibilityHidden(true)
                    Text(EBTBalanceStrings.lockToggleTitle.value(in: language))
                        .font(CivicaTypography.sectionHeader)
                        .foregroundStyle(CivicaColors.ink)
                }
            }
            .tint(CivicaColors.pinePrimary)

            Text(EBTBalanceStrings.lockToggleHelp.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)

            Divider().overlay(CivicaColors.hairline)

            Text(store.isCardLocked
                 ? EBTBalanceStrings.lockStatusOnLine.value(in: language)
                 : EBTBalanceStrings.lockStatusOffLine.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(store.isCardLocked ? CivicaColors.pinePrimary : CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .animation(.easeInOut(duration: 0.2), value: store.isCardLocked)
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

    // MARK: - Extra protection card

    private var extrasCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(EBTBalanceStrings.lockExtrasEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)

            toggleRow(
                title: EBTBalanceStrings.blockOutOfStateTitle.value(in: language),
                help: EBTBalanceStrings.blockOutOfStateHelp.value(in: language),
                isOn: Binding(
                    get: { store.blockOutOfState },
                    set: { store.setBlockOutOfState($0) }
                )
            )

            Divider().overlay(CivicaColors.hairline)

            toggleRow(
                title: EBTBalanceStrings.blockOnlineTitle.value(in: language),
                help: EBTBalanceStrings.blockOnlineHelp.value(in: language),
                isOn: Binding(
                    get: { store.blockOnline },
                    set: { store.setBlockOnline($0) }
                )
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

    private func toggleRow(title: String, help: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(help)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .tint(CivicaColors.pinePrimary)
    }

    // MARK: - Demo disclosure

    private var demoDisclosure: some View {
        HStack(spacing: CivicaSpacing.sm) {
            Image(systemName: "info.circle")
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
            Text(EBTBalanceStrings.demoDisclosure.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
