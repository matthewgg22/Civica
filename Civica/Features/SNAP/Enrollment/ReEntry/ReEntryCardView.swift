import CivicaDesignSystem
import SwiftUI

// The re-entry assist card surface (G2-3, Unrath retention pillar).
//
// Renders only when ReEntryStore.state is .candidate — the host view
// (cold-start home, debug menu, etc.) can `if case` on the store's
// state to decide whether to mount this view at all.
//
// Visual: low-pressure prompt, ink-on-paper, primary CTA + dismiss.
// Confirmation uses SwiftUI `.confirmationDialog` so the warning about
// document re-upload lands before the network call.
//
// Out of scope for v1: no animation tuning, no badge styling for
// "Type-1 risk" — that's G4 territory once the retention scorer is
// wired through the gateway.

struct ReEntryCardView: View {
    @ObservedObject var store: ReEntryStore
    let language: CivicaLanguage
    /// Invoked when the user successfully completes re-enrollment.
    /// Host navigates to the new packet's intake flow.
    let onCompleted: (ReEnrollResponse.Packet) -> Void

    @State private var showingConfirm = false

    var body: some View {
        Group {
            switch store.state {
            case .candidate(let suggestion):
                if let prior = suggestion.prior_packet {
                    cardContent(
                        daysSinceClose: suggestion.days_since_close ?? 0,
                        priorPacket: prior
                    )
                } else {
                    EmptyView()
                }
            case .enrolling, .loading:
                loadingContent
            case .error(let message):
                errorContent(message: message)
            case .idle, .noCandidate, .completed:
                EmptyView()
            }
        }
        .task { await store.loadSuggestion() }
        .onChange(of: store.state) { _, newState in
            if case let .completed(packet, _) = newState {
                onCompleted(packet)
            }
        }
    }

    // MARK: - Variants

    @ViewBuilder
    private func cardContent(
        daysSinceClose: Int,
        priorPacket: ReEntrySuggestionResponse.PriorPacket
    ) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(ReEntryStrings.cardEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)

            Text(ReEntryStrings.cardTitleClosedRecently.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)

            Text(formattedBody(daysSinceClose: daysSinceClose))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: CivicaSpacing.sm) {
                Button {
                    showingConfirm = true
                } label: {
                    Text(ReEntryStrings.cardPrimaryCTA.value(in: language))
                        .font(CivicaTypography.bodyStrong)
                        .foregroundStyle(CivicaColors.paper)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, CivicaSpacing.sm)
                }
                .background(CivicaColors.pinePrimary)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                Button {
                    store.dismiss()
                } label: {
                    Text(ReEntryStrings.cardDismissCTA.value(in: language))
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.graphite)
                        .padding(.vertical, CivicaSpacing.sm)
                        .padding(.horizontal, CivicaSpacing.md)
                }
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .confirmationDialog(
            ReEntryStrings.confirmTitle.value(in: language),
            isPresented: $showingConfirm,
            titleVisibility: .visible
        ) {
            Button(ReEntryStrings.confirmContinue.value(in: language)) {
                Task { await store.confirmReEnroll() }
            }
            Button(ReEntryStrings.confirmCancel.value(in: language), role: .cancel) {}
        } message: {
            Text(ReEntryStrings.confirmBody.value(in: language))
        }
    }

    private var loadingContent: some View {
        HStack(spacing: CivicaSpacing.sm) {
            ProgressView()
            Text(ReEntryStrings.loading.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    @ViewBuilder
    private func errorContent(message: String) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(ReEntryStrings.errorTitle.value(in: language))
                .font(CivicaTypography.bodyStrong)
                .foregroundStyle(CivicaColors.ink)

            Text(message)
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .lineLimit(2)

            Button {
                store.reset()
                Task { await store.loadSuggestion() }
            } label: {
                Text(ReEntryStrings.errorRetryCTA.value(in: language))
                    .font(CivicaTypography.bodyStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Helpers

    private func formattedBody(daysSinceClose: Int) -> String {
        let template = ReEntryStrings.cardBodyWithDays.value(in: language)
        return String(format: template, daysSinceClose)
    }
}
