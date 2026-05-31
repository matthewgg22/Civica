import CivicaDesignSystem
import SwiftUI
import UIKit

/// Full-screen state views the FindHelp root falls through to when the
/// happy-path map can't render: loading, empty, transport error, and a
/// shared "human path" call-the-DTA-hotline row. Extracted so the root
/// view stays focused on permission + sheet orchestration.

/// HANDOFF board B4 — "Reading the local directory…" with a progress
/// bar inside a paper card, not a plain spinner. Names the work being
/// done so the wait feels concrete.
struct FindHelpLoadingView: View {
    let language: CivicaLanguage

    var body: some View {
        VStack(spacing: CivicaSpacing.lg) {
            LoadingWaveDots()
            Text(language == .spanish ? "Buscando lugares cercanos…" : "Finding nearby locations…")
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Three dots that bounce up in a rolling wave — more character than
/// a plain spinner and immediately recognisable as "working".
private struct LoadingWaveDots: View {
    @State private var animating = false

    var body: some View {
        HStack(spacing: 10) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(CivicaColors.pinePrimary)
                    .frame(width: 11, height: 11)
                    .offset(y: animating ? -10 : 0)
                    .civicaAnimation(
                        .easeInOut(duration: 0.45)
                            .repeatForever(autoreverses: true)
                            .delay(Double(index) * 0.14),
                        value: animating
                    )
            }
        }
        .onAppear { animating = true }
    }
}

/// HANDOFF board B3 — "Nothing within 5 miles" + radius-expand CTA +
/// always-visible human path. Empty state always offers a real next
/// step, never a dead end.
struct FindHelpEmptyView: View {
    let language: CivicaLanguage
    let currentRadiusKm: Double
    let onExpandRadius: () -> Void

    var body: some View {
        VStack(spacing: CivicaSpacing.lg) {
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Image(systemName: "mappin.slash")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
                Text(FindHelpStrings.emptyTitleFormatted(
                    miles: milesFromRadius(currentRadiusKm),
                    language: language
                ))
                .font(CivicaTypography.cardTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                Text(FindHelpStrings.emptyBody.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                if currentRadiusKm < FindHelpStore.expandedRadiusKm {
                    Button(action: onExpandRadius) {
                        Text(FindHelpStrings.emptyExpandCTA.value(in: language))
                            .font(CivicaTypography.subheadStrong)
                            .foregroundStyle(CivicaColors.onPrimaryText)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(
                                RoundedRectangle(cornerRadius: CivicaRadius.control)
                                    .fill(CivicaColors.pinePrimary)
                            )
                    }
                    .padding(.top, CivicaSpacing.sm)
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

            FindHelpHumanPathRow(language: language)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

/// Rich fallback for transport-layer failures (DNS, no connection).
/// Mirrors the empty-state skeleton — title, body, primary retry,
/// zip-fallback escape hatch, always-visible human-path row — so the
/// user always has a next step.
struct FindHelpTransportErrorView: View {
    let language: CivicaLanguage
    let onRetry: () -> Void
    let onUseZipInstead: () -> Void

    var body: some View {
        VStack(spacing: CivicaSpacing.lg) {
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Image(systemName: "wifi.slash")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
                Text(FindHelpStrings.transportErrorTitle.value(in: language))
                    .font(CivicaTypography.cardTitle)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(FindHelpStrings.transportErrorBody.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)

                Button(action: onRetry) {
                    Text(FindHelpStrings.transportErrorRetryCTA.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.onPrimaryText)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(
                            RoundedRectangle(cornerRadius: CivicaRadius.control)
                                .fill(CivicaColors.pinePrimary)
                        )
                }
                .padding(.top, CivicaSpacing.sm)

                Button(action: onUseZipInstead) {
                    Text(FindHelpStrings.permissionZipCTA.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.pinePrimary)
                        .underline()
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, CivicaSpacing.xs)
                }
                .buttonStyle(.plain)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )

            FindHelpHumanPathRow(language: language)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

/// Generic error view for non-transport failures. Plain centered
/// message; reached only when an error doesn't qualify for the richer
/// transport-error treatment.
struct FindHelpErrorMessageView: View {
    let message: String

    var body: some View {
        VStack(spacing: CivicaSpacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .imageScale(.large)
                .font(.body)
                .foregroundStyle(CivicaColors.destructive)
            Text(message)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.graphite)
                .multilineTextAlignment(.center)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Always-visible "call a human" row pinned beneath empty / transport-
/// error cards. The phone number opens via the `tel:` scheme. The spec
/// calls this out as mandatory on every dead-end state — there is
/// always a non-digital path forward.
struct FindHelpHumanPathRow: View {
    let language: CivicaLanguage

    var body: some View {
        Button {
            if let url = URL(string: "tel:8773822363") {
                UIApplication.shared.open(url)
            }
        } label: {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "phone.fill")
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .accessibilityHidden(true)
                Text(FindHelpStrings.emptyHumanLineLabel.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Spacer(minLength: CivicaSpacing.sm)
                Text(FindHelpStrings.emptyHumanLineNumber)
                    .font(CivicaTypography.subheadStrong.monospacedDigit())
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .underline()
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
        .buttonStyle(.plain)
        .accessibilityLabel("\(FindHelpStrings.emptyHumanLineLabel.value(in: language)). \(FindHelpStrings.emptyHumanLineNumber)")
    }
}

/// Convert km to miles for user-facing copy. 8 km → 5 miles, 40 km →
/// 25 miles. Rounded to the nearest whole mile.
func milesFromRadius(_ km: Double) -> Int {
    Int((km * 0.6213712).rounded())
}
