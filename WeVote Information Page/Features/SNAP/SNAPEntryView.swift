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
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(headerLocationSubtitle)
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(VoteNowColors.textSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.84)

                        Spacer(minLength: 8)

                        Button {
                            NotificationCenter.default.post(name: .openMyInfoPanel, object: nil)
                        } label: {
                            Text("Edit location")
                                .font(.callout.weight(.semibold))
                                .italic()
                                .foregroundColor(VoteNowColors.ctaBlue)
                                .lineLimit(1)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.leading, 72)
                    .padding(.top, -6)
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 8)
                .background(VoteNowColors.brandSoftBlue)

                VStack(spacing: 16) {
                    NavigationLink {
                        SNAPEligibilityIntroView(viewModel: viewModel)
                            .navigationBarTitleDisplayMode(.inline)
                    } label: {
                        VStack(spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(VoteNowColors.surfacePrimary)
                                    .frame(width: 156, height: 156)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                                            .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
                                    )

                                Image("SNAPOfficialLogo")
                                    .resizable()
                                    .scaledToFit()
                                    .frame(width: 124, height: 124)
                            }
                            .shadow(color: VoteNowColors.ctaBlue.opacity(0.14), radius: 8, x: 0, y: 4)

                            Text("Supplemental Nutrition\nAssistance Program")
                                .font(.headline)
                                .foregroundStyle(VoteNowColors.textPrimary)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.vertical, 4)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    Text(SNAPCopy.globalDisclaimer)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(VoteNowColors.textSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)

                    if let submittedAt = viewModel.submittedAt {
                        NavigationLink {
                            SNAPStepContainerView(viewModel: viewModel, onClose: nil)
                                .navigationTitle("SNAP Eligibility Questionnaire")
                                .navigationBarTitleDisplayMode(.inline)
                                .onAppear {
                                    viewModel.jumpToDraftStep(.nextSteps)
                                }
                        } label: {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("SNAP prep status")
                                    .font(.headline.weight(.semibold))
                                    .foregroundStyle(VoteNowColors.textPrimary)

                                HStack(spacing: 8) {
                                    Text("Status:")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(VoteNowColors.textSecondary)
                                    Text("Prep checklist completed")
                                        .font(.subheadline.weight(.bold))
                                        .foregroundStyle(VoteNowColors.successGreen)
                                }

                                HStack(spacing: 8) {
                                    Text("Date:")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(VoteNowColors.textSecondary)
                                    Text(statusDateText(from: submittedAt))
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(VoteNowColors.textPrimary)
                                }

                                Text("Open next steps")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(VoteNowColors.ctaBlue)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .background(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(VoteNowColors.surfacePrimary)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
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
                                .font(.subheadline.weight(.semibold))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(12)
                                .background(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .fill(VoteNowColors.surfacePrimary)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 8)
                    }
                    #endif

                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 16)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .background(VoteNowColors.brandSoftBlue)
            }
            .background(VoteNowColors.brandSoftBlue.ignoresSafeArea())
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
        .toolbarBackground(VoteNowColors.brandSoftBlue, for: .navigationBar)
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
