import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE: root entry point for the isolated SNAP experience.
struct SNAPEntryView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = SNAPApplicationViewModel()
    @State private var hasTrackedEntryView = false
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue
    private let zipStateResolver = USZipStateResolver()
    let showsCloseButton: Bool
    let initialStateCode: String?
    let initialZipCode: String?

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    init(
        showsCloseButton: Bool = false,
        initialStateCode: String? = nil,
        initialZipCode: String? = nil
    ) {
        self.showsCloseButton = showsCloseButton
        self.initialStateCode = initialStateCode
        self.initialZipCode = initialZipCode
    }

    // Location resolution: in the Civica app there is no shared address
    // store yet (the VoteNow app had PlanViewModel + MyRepsViewModel for
    // this). For now, location comes only from the `initialStateCode` /
    // `initialZipCode` init params; ZIP-derived state is the fallback.
    // TODO: wire a Civica-side address store and prefill from it.

    private var headerLocationCity: String { "" }

    private var headerLocationZip: String? {
        guard let initialZipCode else { return nil }
        let digits = String(initialZipCode.filter(\.isNumber).prefix(5))
        return digits.count == 5 ? digits : nil
    }

    private var headerLocationStateCode: String? {
        if let initialStateCode {
            let trimmed = initialStateCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            if trimmed.count == 2 { return trimmed }
        }
        if let zip = headerLocationZip {
            return zipStateResolver.stateCode(for: zip)
        }
        return nil
    }

    private var headerLocationSubtitle: String {
        let city = headerLocationCity
        let state = headerLocationStateCode
        let zip = headerLocationZip

        if !city.isEmpty, let state, let zip {
            return "\(city), \(state) (\(zip))"
        }
        if !city.isEmpty, let state {
            return "\(city), \(state)"
        }
        if let state, let zip {
            return "\(state) (\(zip))"
        }
        if let zip {
            return zip
        }
        if let state {
            return state
        }
        return "Set your address"
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 0) {
                    PageHeader(title: "Gov Applications")
                    HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                        Text(headerLocationSubtitle)
                            .font(CivicaTypography.subheadStrong)
                            .foregroundColor(CivicaColors.graphite)
                            .lineLimit(1)
                            .minimumScaleFactor(0.84)

                        Spacer(minLength: 8)

                        Button {
                            NotificationCenter.default.post(name: .openMyInfoPanel, object: nil)
                        } label: {
                            Text("Edit location")
                                .font(CivicaTypography.supportStrong)
                                .italic()
                                .foregroundColor(CivicaColors.brickPrimary)
                                .lineLimit(1)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.leading, 72)
                    .padding(.top, -6)
                }
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.top, CivicaSpacing.sm)
                .padding(.bottom, CivicaSpacing.sm)
                .background(CivicaColors.tealSurface)

                VStack(spacing: CivicaSpacing.lg) {
                    NavigationLink {
                        SNAPEstimatorFlowView(language: language)
                            .navigationBarTitleDisplayMode(.inline)
                    } label: {
                        HStack(spacing: CivicaSpacing.md) {
                            Image(systemName: "dollarsign.circle.fill")
                                .font(.system(size: 28))
                                .foregroundStyle(CivicaColors.brickPrimary)
                                .frame(width: 48, height: 48)
                                .background(
                                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                                        .fill(CivicaColors.brickPrimary.opacity(0.12))
                                )

                            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                                Text(SNAPBenefitEstimatorStrings.entryCardTitle.value(in: language))
                                    .font(CivicaTypography.sectionHeader)
                                    .foregroundStyle(CivicaColors.ink)
                                Text(SNAPBenefitEstimatorStrings.entryCardSubtitle.value(in: language))
                                    .font(CivicaTypography.footnoteStrong)
                                    .foregroundStyle(CivicaColors.graphite)
                                    .lineLimit(2)
                            }

                            Spacer()

                            Image(systemName: "chevron.right")
                                .foregroundStyle(CivicaColors.graphite)
                        }
                        .padding(CivicaSpacing.md)
                        .background(
                            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                                .fill(CivicaColors.surfacePrimary)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                                .stroke(CivicaColors.hairline, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)

                    NavigationLink {
                        SNAPEligibilityIntroView(viewModel: viewModel)
                            .navigationBarTitleDisplayMode(.inline)
                    } label: {
                        VStack(spacing: CivicaSpacing.md) {
                            ZStack {
                                RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                                    .fill(CivicaColors.surfacePrimary)
                                    .frame(width: 156, height: 156)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                                            .stroke(CivicaColors.hairline, lineWidth: 1)
                                    )

                                Image("SNAPOfficialLogo")
                                    .resizable()
                                    .scaledToFit()
                                    .frame(width: 124, height: 124)
                            }
                            .shadow(color: CivicaColors.brickPrimary.opacity(0.14), radius: 8, x: 0, y: 4)

                            Text("Supplemental Nutrition\nAssistance Program")
                                .font(CivicaTypography.sectionHeader)
                                .foregroundStyle(CivicaColors.ink)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.vertical, CivicaSpacing.xs)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    Text(SNAPCopy.globalDisclaimer)
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)

                    NavigationLink {
                        FindHelpRootView()
                    } label: {
                        HStack(spacing: CivicaSpacing.md) {
                            Image(systemName: "map.fill")
                                .font(.system(size: 28))
                                .foregroundStyle(CivicaColors.brickPrimary)
                                .frame(width: 48, height: 48)
                                .background(
                                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                                        .fill(CivicaColors.brickPrimary.opacity(0.12))
                                )

                            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                                Text("find_help.entry_card.title")
                                    .font(CivicaTypography.sectionHeader)
                                    .foregroundStyle(CivicaColors.ink)
                                Text("find_help.entry_card.subtitle")
                                    .font(CivicaTypography.footnoteStrong)
                                    .foregroundStyle(CivicaColors.graphite)
                                    .lineLimit(2)
                            }

                            Spacer()

                            Image(systemName: "chevron.right")
                                .foregroundStyle(CivicaColors.graphite)
                        }
                        .padding(CivicaSpacing.md)
                        .background(
                            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                                .fill(CivicaColors.surfacePrimary)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                                .stroke(CivicaColors.hairline, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)

                    if SNAPFeatureFlag.isConversationEnabled {
                        recoveryEntryCard
                    }

                    // Post-submission status used to push the legacy
                    // SNAPStepContainerView's "next steps" view here.
                    // Status routing now lives in CivicaRootView via
                    // SNAPApplicationStatusStore; this card is no
                    // longer needed.

                    #if DEBUG
                    if SNAPFeatureFlag.showDebugEntry {
                        NavigationLink {
                            SNAPDebugChecklistView()
                                .navigationTitle("SNAP QA Checklist")
                                .navigationBarTitleDisplayMode(.inline)
                        } label: {
                            Label("Developer QA checklist", systemImage: "checklist")
                                .font(CivicaTypography.subheadStrong)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(CivicaSpacing.md)
                                .background(
                                    RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                                        .fill(CivicaColors.surfacePrimary)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                                        .stroke(CivicaColors.hairline, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                        .padding(.top, CivicaSpacing.sm)
                    }
                    #endif

                    Spacer()
                }
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.top, CivicaSpacing.lg)
                .padding(.bottom, CivicaSpacing.lg)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .background(CivicaColors.tealSurface)
            }
            .background(CivicaColors.tealSurface.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if showsCloseButton {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Close") {
                            viewModel.trackAbandonmentIfNeeded()
                            dismiss()
                        }
                    }
                }
            }
        }
        .toolbarBackground(CivicaColors.tealSurface, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .preferredColorScheme(.light)
        .onAppear {
            applyAddressGeofencePrefill()

            guard !hasTrackedEntryView else { return }
            hasTrackedEntryView = true
            SNAPAnalytics.trackEntryViewed()
        }
        .onDisappear {
            viewModel.trackAbandonmentIfNeeded()
        }
    }

    /// "Continue an earlier application" — magic-link / OTP recovery
    /// for someone who reinstalled, switched phones, or wiped their
    /// device. Only shown when the conversation flag is on (the static
    /// draft flow keeps its work in @AppStorage; nothing to recover).
    private var recoveryEntryCard: some View {
        NavigationLink {
            SNAPRecoveryFlowView(
                language: language,
                onRecovered: { _ in
                    // Phase D wrap-up: when the recovery endpoint
                    // returns a session, hand it to the conversation
                    // view model so the user lands back in the
                    // transcript at the right turn. Today the response
                    // shape is wired but no caller consumes it — the
                    // step is a no-op until the conversation flow
                    // accepts an injected session.
                },
                onClose: {}
            )
        } label: {
            HStack(spacing: CivicaSpacing.md) {
                Image(systemName: "key.fill")
                    .font(.system(size: 24))
                    .foregroundStyle(CivicaColors.brickPrimary)
                    .frame(width: 48, height: 48)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                            .fill(CivicaColors.brickPrimary.opacity(0.12))
                    )

                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(SNAPRecoveryStrings.entryLinkTitle.value(in: language))
                        .font(CivicaTypography.sectionHeader)
                        .foregroundStyle(CivicaColors.ink)
                    Text(SNAPRecoveryStrings.entryLinkSubtitle.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .lineLimit(2)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .foregroundStyle(CivicaColors.graphite)
            }
            .padding(CivicaSpacing.md)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                    .fill(CivicaColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                    .stroke(CivicaColors.hairline, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func applyAddressGeofencePrefill() {
        let preferredStateCode = headerLocationStateCode ?? initialStateCode
        let preferredZipCode = headerLocationZip ?? initialZipCode
        viewModel.applyLocationPrefill(
            stateCode: preferredStateCode,
            zipCode: preferredZipCode
        )
    }

}

#Preview {
    SNAPEntryView()
}
