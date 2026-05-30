import CivicaDesignSystem
import SwiftUI

// DEPRECATED — use SNAPApplyHandoffView instead. See MarketplaceFlowView.swift for context.
// Screen 4 — Apply via Handshake with consent checklist.
// DR3-6: verified-data list + explicit "we don't share your benefit amount" line.
// DR3-7: fallback to employer career URL when Handshake is unavailable.
struct ApplyHandoffSheet: View {
    let job: MarketplaceJob
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    let onHandoffLogged: () -> Void   // fires after either CTA so Argyle webhook still triggers recalc

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue
    private var language: CivicaLanguage { CivicaLanguage(rawValue: languageRaw) ?? .english }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                    header
                    consentList
                    privacyLine
                    ctaStack
                }
                .padding(CivicaSpacing.lg)
            }
            .background(CivicaColors.paper)
            .navigationTitle(SNAPMarketplaceStrings.applyingTo(employerName: job.employerName, language: language))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(SNAPMarketplaceStrings.cancelButton.value(in: language)) { dismiss() }
                        .foregroundStyle(CivicaColors.amberPrimary)
                }
            }
        }
    }

    // MARK: - Private

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPMarketplaceStrings.wellShareWith(employerName: job.employerName, language: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
            Text(SNAPMarketplaceStrings.handshakeEmployerSystem.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var consentList: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            consentRow(label: "Your name and contact info", source: "Plaid-verified")
            consentRow(label: "Class schedule (availability)", source: "Canvas-connected")
            consentRow(label: "SNAP enrollment status", source: "Your application")
        }
    }

    private func consentRow(label: LocalizedStringKey, source: LocalizedStringKey) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(CivicaColors.amberPrimary)
                .imageScale(.large)
                .font(.body)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                Text(source)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            }
        }
    }

    private var privacyLine: some View {
        Text(SNAPMarketplaceStrings.dontShareBenefitAmount.value(in: language))
            .font(CivicaTypography.footnote)
            .foregroundStyle(CivicaColors.graphite)
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                    .fill(CivicaColors.surfacePrimary)
            )
    }

    private var ctaStack: some View {
        VStack(spacing: CivicaSpacing.md) {
            if job.handshakeJobURL != nil {
                Button(action: openHandshake) {
                    Text(SNAPMarketplaceStrings.applyOnHandshake.value(in: language))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(CivicaPrimaryCTAButtonStyle())
                .accessibilityIdentifier("marketplace.handoff.apply_handshake")
            }

            if let fallback = job.fallbackCareerURL {
                Button(action: { openFallback(fallback) }) {
                    Text(job.handshakeJobURL != nil
                         ? "Or apply on employer's site"
                         : "Apply on employer's site")
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(CivicaSecondaryCTAButtonStyle())
                .accessibilityIdentifier("marketplace.handoff.apply_fallback")
            }
        }
    }

    private func openHandshake() {
        guard let url = job.handshakeJobURL else { return }
        onHandoffLogged()
        openURL(url)
        dismiss()
    }

    private func openFallback(_ url: URL) {
        onHandoffLogged()
        openURL(url)
        dismiss()
    }
}

#Preview {
    ApplyHandoffSheet(
        job: MarketplaceJob(
            id: "2", title: "Dining Services", employerName: "Campus Dining",
            type: .w2, scheduleDescription: "16 hr/wk · $17/hr · T/Th evenings",
            monthlyAmountUSD: 1_179, pillText: "Counts as income",
            handshakeJobURL: URL(string: "https://app.joinhandshake.com/jobs/1"),
            fallbackCareerURL: URL(string: "https://dining.example.edu/jobs"),
            projectedBenefitUSD: 214, currentBenefitUSD: 292
        ),
        onHandoffLogged: {}
    )
}
