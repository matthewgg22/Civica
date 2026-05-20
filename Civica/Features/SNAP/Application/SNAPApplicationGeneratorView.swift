import CivicaDesignSystem
import SwiftUI
import UIKit

// EXPERIMENTAL SILOED MODULE: terminal step of the SNAP conversation
// flow. Generates the application summary PDF and surfaces it via the
// system share sheet so the user can save to Files, email, AirDrop,
// or send to a benefits navigator.
//
// Pairs with SNAPApplicationWalkthroughView below the share button —
// the user gets the PDF AND the in-app guidance for completing the
// official application in DTA Connect. Skipping either leaves the user
// stranded.

struct SNAPApplicationGeneratorView: View {
    @StateObject var viewModel: SNAPApplicationGeneratorViewModel
    @State private var isShareSheetPresented = false

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    private var stateCode: String? {
        SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode
    }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            header
            statusCard
            actionRow
            SNAPApplicationWalkthroughView(
                stateCode: stateCode
            )
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.paper)
        .navigationTitle(SNAPApplicationGeneratorStrings.title.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if case .idle = viewModel.phase {
                await viewModel.generate()
            }
        }
        .sheet(isPresented: $isShareSheetPresented) {
            if case .ready(let url) = viewModel.phase {
                SNAPShareSheet(items: [url])
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPApplicationGeneratorStrings.title.value(in: language))
                .font(CivicaTypography.cardTitle)
                .foregroundColor(CivicaColors.ink)
            Text(SNAPApplicationGeneratorStrings.subtitle(stateCode: stateCode, language: language))
                .font(CivicaTypography.subhead)
                .foregroundColor(CivicaColors.graphite)
        }
    }

    @ViewBuilder
    private var statusCard: some View {
        switch viewModel.phase {
        case .idle, .generating:
            HStack(spacing: CivicaSpacing.sm) {
                ProgressView()
                Text(SNAPApplicationGeneratorStrings.generating.value(in: language))
                    .font(CivicaTypography.subhead)
                    .foregroundColor(CivicaColors.graphite)
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        case .ready:
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "doc.text.fill")
                    .foregroundColor(CivicaColors.accentTeal)
                    .accessibilityHidden(true)
                Text(SNAPApplicationGeneratorStrings.ready.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundColor(CivicaColors.ink)
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.statusSuccessSurface)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        case .error(let message):
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(CivicaColors.warningAmber)
                    .accessibilityHidden(true)
                Text(message)
                    .font(CivicaTypography.subhead)
                    .foregroundColor(CivicaColors.ink)
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.statusErrorSurface)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        }
    }

    @ViewBuilder
    private var actionRow: some View {
        switch viewModel.phase {
        case .ready:
            Button {
                isShareSheetPresented = true
            } label: {
                Label(SNAPApplicationGeneratorStrings.saveOrShare.value(in: language), systemImage: "square.and.arrow.up")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, CivicaSpacing.sm)
                    .background(CivicaColors.pinePrimary)
                    .foregroundColor(CivicaColors.onPrimaryText)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
            }
        case .error:
            Button {
                Task { await viewModel.generate() }
            } label: {
                Text(SNAPApplicationGeneratorStrings.tryAgain.value(in: language))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, CivicaSpacing.sm)
                    .background(CivicaColors.secondaryButtonFill)
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.control)
                            .strokeBorder(CivicaColors.secondaryButtonBorder)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                    .foregroundColor(CivicaColors.ink)
            }
        case .idle, .generating:
            EmptyView()
        }
    }
}

// MARK: - Share sheet

private struct SNAPShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
