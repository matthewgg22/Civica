import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE: root entry point for the isolated SNAP experience.
struct SNAPEntryView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var planVM: PlanViewModel
    @EnvironmentObject private var repsVM: MyRepsViewModel
    @StateObject private var viewModel = SNAPApplicationViewModel()
    @State private var hasTrackedEntryView = false
    private let zipStateResolver = USZipStateResolver()
    let showsCloseButton: Bool
    let initialStateCode: String?
    let initialZipCode: String?

    init(
        showsCloseButton: Bool = false,
        initialStateCode: String? = nil,
        initialZipCode: String? = nil
    ) {
        self.showsCloseButton = showsCloseButton
        self.initialStateCode = initialStateCode
        self.initialZipCode = initialZipCode
    }

    private var headerLocationCity: String {
        let resolvedCity = repsVM.resolvedLocationSelection?.city?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !resolvedCity.isEmpty { return resolvedCity }
        return planVM.userAddress.city.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var headerLocationZip: String? {
        let addressZip = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
        if addressZip.count == 5 { return addressZip }

        let resolvedZip = String((repsVM.resolvedLocationSelection?.postalCode ?? "").filter(\.isNumber).prefix(5))
        if resolvedZip.count == 5 { return resolvedZip }

        let fallback = String(planVM.zip.filter(\.isNumber).prefix(5))
        return fallback.count == 5 ? fallback : nil
    }

    private var headerLocationStateCode: String? {
        if let resolved = normalizedUSStateCode(from: repsVM.resolvedStateCode) {
            return resolved
        }
        if let detected = normalizedUSStateCode(from: repsVM.detectedStateCode) {
            return detected
        }
        if let entered = normalizedUSStateCode(from: planVM.userAddress.state) {
            return entered
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
        return "Set your address in My Reps"
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

                    if let submittedAt = viewModel.submittedAt {
                        NavigationLink {
                            SNAPStepContainerView(viewModel: viewModel, onClose: nil)
                                .navigationTitle("SNAP Eligibility Questionnaire")
                                .navigationBarTitleDisplayMode(.inline)
                                .onAppear {
                                    viewModel.jumpToDraftStep(.nextSteps)
                                }
                        } label: {
                            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                                Text("SNAP prep status")
                                    .font(CivicaTypography.sectionHeader)
                                    .foregroundStyle(CivicaColors.ink)

                                HStack(spacing: CivicaSpacing.sm) {
                                    Text("Status:")
                                        .font(CivicaTypography.subheadStrong)
                                        .foregroundStyle(CivicaColors.graphite)
                                    Text("Prep checklist completed")
                                        .font(CivicaTypography.subheadBold)
                                        .foregroundStyle(CivicaColors.accentTeal)
                                }

                                HStack(spacing: CivicaSpacing.sm) {
                                    Text("Date:")
                                        .font(CivicaTypography.subheadStrong)
                                        .foregroundStyle(CivicaColors.graphite)
                                    Text(statusDateText(from: submittedAt))
                                        .font(CivicaTypography.subheadStrong)
                                        .foregroundStyle(CivicaColors.ink)
                                }

                                Text("Open next steps")
                                    .font(CivicaTypography.subheadStrong)
                                    .foregroundStyle(CivicaColors.brickPrimary)
                            }
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
                    }

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
        .onAppear {
            applyAddressGeofencePrefill()

            guard !hasTrackedEntryView else { return }
            hasTrackedEntryView = true
            SNAPAnalytics.trackEntryViewed()
        }
        .onChange(of: headerLocationStateCode) { _ in
            applyAddressGeofencePrefill()
        }
        .onChange(of: headerLocationZip) { _ in
            applyAddressGeofencePrefill()
        }
        .onDisappear {
            viewModel.trackAbandonmentIfNeeded()
        }
    }

    private func applyAddressGeofencePrefill() {
        let preferredStateCode = headerLocationStateCode ?? initialStateCode
        let preferredZipCode = headerLocationZip ?? initialZipCode
        viewModel.applyLocationPrefill(
            stateCode: preferredStateCode,
            zipCode: preferredZipCode
        )
    }

    private func statusDateText(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

#Preview {
    SNAPEntryView()
        .environmentObject(PlanViewModel())
        .environmentObject(MyRepsViewModel())
}
