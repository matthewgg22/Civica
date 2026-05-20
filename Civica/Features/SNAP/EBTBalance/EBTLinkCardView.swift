import CivicaDesignSystem
import SwiftUI

// The unlinked-state surface for the Check EBT Balance feature: the
// "connect your card" explainer plus a simulated link form. Shown by
// EBTBalanceRootView when the store's linkState is .unlinked or
// .linking.
//
// Demo scope: nothing here talks to a real EBT system. The card-number
// field accepts any input and is never stored — tapping "Link my card"
// just drives EBTBalanceStore.link(), which waits briefly and flips to
// the linked dashboard. The security copy ("what Civica never stores")
// mirrors what a real integration's trust story would need to be.

struct EBTLinkCardView: View {
    @ObservedObject var store: EBTBalanceStore
    let language: CivicaLanguage

    @State private var cardNumber: String = ""

    private var isLinking: Bool { store.linkState == .linking }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                header
                securityCard
                linkForm
                demoDisclosure
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(EBTBalanceStrings.linkEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(EBTBalanceStrings.linkTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
            Text(EBTBalanceStrings.linkBody.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Security card

    private var securityCard: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: "lock.shield")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(CivicaColors.accentTeal)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(EBTBalanceStrings.linkSecurityEyebrow.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.2)
                Text(EBTBalanceStrings.linkSecurityBody.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
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
    }

    // MARK: - Link form

    private var linkForm: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            stateRow
            cardNumberField
            linkButton
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

    // Demo scope is California only, so the state is fixed rather than
    // a picker — shown for parity with what a real multi-state link
    // form would collect.
    private var stateRow: some View {
        HStack {
            Text(EBTBalanceStrings.linkStateLabel.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
            Spacer()
            Text(EBTBalanceStrings.linkStateValue.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
        }
        .accessibilityElement(children: .combine)
    }

    private var cardNumberField: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(EBTBalanceStrings.linkCardFieldLabel.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
            TextField("", text: $cardNumber)
                .keyboardType(.numberPad)
                .font(CivicaTypography.body.monospacedDigit())
                .disabled(isLinking)
                .padding(CivicaSpacing.md)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .fill(CivicaColors.surfaceSecondary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .strokeBorder(CivicaColors.hairline, lineWidth: 1)
                )
                .onChange(of: cardNumber) { _, newValue in
                    cardNumber = String(newValue.filter(\.isNumber).prefix(19))
                }
        }
    }

    private var linkButton: some View {
        Button {
            Task { await store.link() }
        } label: {
            HStack(spacing: CivicaSpacing.sm) {
                if isLinking {
                    ProgressView()
                        .tint(CivicaColors.onPrimaryText)
                    Text(EBTBalanceStrings.linkingProgress.value(in: language))
                } else {
                    Text(EBTBalanceStrings.linkCTA.value(in: language))
                }
            }
            .font(CivicaTypography.subheadStrong)
            .foregroundStyle(CivicaColors.onPrimaryText)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .fill(CivicaColors.pinePrimary)
            )
        }
        .buttonStyle(.plain)
        .disabled(isLinking)
        .padding(.top, CivicaSpacing.xs)
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
