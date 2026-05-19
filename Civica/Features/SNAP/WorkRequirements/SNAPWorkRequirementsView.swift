import CivicaDesignSystem
import SwiftUI

// MARK: - Models

/// Per-member fields for the OBBBA work-requirements evaluator.
/// Corresponds to `isTribalMember` and `isEnrolledInQualifyingProgram`
/// in the enrollment API's work-requirements payload.
struct WorkRequirementsMember: Identifiable {
    let id = UUID()
    var displayName: String
    var age: Int
    var isTribalMember: Bool
    var isEnrolledInQualifyingProgram: Bool
}

// MARK: - View

/// Navigator-only screen for reviewing household-member work-requirements
/// fields before evaluating SNAP OBBBA compliance.
///
/// Captures two new fields per member:
///   - `isTribalMember`                 → Native American exemption (OBBBA §2619(a)(3))
///   - `isEnrolledInQualifyingProgram`  → SNAP E&T, drug/alcohol tx, community MH
///
/// Wire `packetId` and `apiClient` from the navigator flow.
/// Both are optional so previews compile without injection.
struct SNAPWorkRequirementsView: View {

    let packetId: String
    let apiClient: (any EnrollmentAPIClient)?

    init(
        packetId: String = "",
        apiClient: (any EnrollmentAPIClient)? = nil
    ) {
        self.packetId = packetId
        self.apiClient = apiClient
    }

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    @State private var members: [WorkRequirementsMember] = [
        WorkRequirementsMember(displayName: "Member 1",
                               age: 30,
                               isTribalMember: false,
                               isEnrolledInQualifyingProgram: false),
        WorkRequirementsMember(displayName: "Member 2",
                               age: 30,
                               isTribalMember: false,
                               isEnrolledInQualifyingProgram: false),
    ]

    @State private var isEvaluating = false
    @State private var evaluationResult: WorkRequirementsEvaluation?
    @State private var evaluationError: String?

    // MARK: - Strings (via SNAPWorkRequirementsStrings — see companion file)

    private var pageTitle: String {
        SNAPWorkRequirementsStrings.pageTitle.value(in: language)
    }

    private var sectionHeaderText: String {
        SNAPWorkRequirementsStrings.sectionHeader.value(in: language)
    }

    private var tribalMemberLabel: String {
        SNAPWorkRequirementsStrings.tribalMemberLabel.value(in: language)
    }

    private var qualifyingProgramLabel: String {
        SNAPWorkRequirementsStrings.qualifyingProgramLabel.value(in: language)
    }

    private var qualifyingProgramSubtitle: String {
        SNAPWorkRequirementsStrings.qualifyingProgramSubtitle.value(in: language)
    }

    private var evaluateLabel: String {
        SNAPWorkRequirementsStrings.evaluateButton.value(in: language)
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xxl) {
                membersSection
                evaluateButton
                if let result = evaluationResult {
                    resultCard(result)
                }
                if let errorMessage = evaluationError {
                    errorView(errorMessage)
                }
                Spacer(minLength: CivicaSpacing.xl)
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(pageTitle)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Members section

    private var membersSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            Text(sectionHeaderText)
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)

            ForEach($members) { $member in
                memberCard(member: $member)
            }
        }
    }

    private func memberCard(member: Binding<WorkRequirementsMember>) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Member name header
            Text(member.wrappedValue.displayName)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.top, CivicaSpacing.lg)
                .padding(.bottom, CivicaSpacing.md)

            Divider()
                .overlay(CivicaColors.hairline)

            // Tribal member toggle
            Toggle(isOn: member.isTribalMember) {
                Text(tribalMemberLabel)
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
            }
            .tint(CivicaColors.accentTeal)
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.md)

            Divider()
                .overlay(CivicaColors.hairline)

            // Qualifying program toggle
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Toggle(isOn: member.isEnrolledInQualifyingProgram) {
                    VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                        Text(qualifyingProgramLabel)
                            .font(CivicaTypography.body)
                            .foregroundStyle(CivicaColors.ink)
                        Text(qualifyingProgramSubtitle)
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.graphite)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .tint(CivicaColors.accentTeal)
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.md)
        }
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                .stroke(CivicaColors.hairline, lineWidth: 1)
        )
    }

    // MARK: - Evaluate button

    private var evaluateButton: some View {
        Button {
            Task {
                isEvaluating = true
                evaluationError = nil
                defer { isEvaluating = false }
                let apiMembers = members.map { m in
                    WorkRequirementsHouseholdMember(
                        id: m.id.uuidString,
                        age: m.age,
                        isTribalMember: m.isTribalMember ? true : nil,
                        isEnrolledInQualifyingProgram: m.isEnrolledInQualifyingProgram ? true : nil
                    )
                }
                do {
                    evaluationResult = try await apiClient?.evaluateWorkRequirements(
                        packetId: packetId,
                        members: apiMembers
                    )
                } catch {
                    evaluationError = error.localizedDescription
                }
            }
        } label: {
            Group {
                if isEvaluating {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(CivicaColors.onPrimaryText)
                } else {
                    Text(evaluateLabel)
                        .font(CivicaTypography.subheadStrong)
                }
            }
            .foregroundStyle(CivicaColors.onPrimaryText)
            .frame(maxWidth: .infinity)
            .frame(minHeight: 56)
        }
        .background(CivicaColors.brickPrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
        .disabled(isEvaluating)
    }

    // MARK: - Result card

    private func resultCard(_ result: WorkRequirementsEvaluation) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(result.isSubject
                 ? SNAPWorkRequirementsStrings.resultSubject.value(in: language)
                 : SNAPWorkRequirementsStrings.resultNotSubject.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)

            if let status = result.complianceStatus {
                HStack(spacing: CivicaSpacing.xs) {
                    Text(SNAPWorkRequirementsStrings.resultCompliance.value(in: language) + ":")
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.graphite)
                    Text(status)
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.ink)
                }
            }

            if let exemption = result.exemptionType {
                HStack(spacing: CivicaSpacing.xs) {
                    Text(SNAPWorkRequirementsStrings.resultExemption.value(in: language) + ":")
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.graphite)
                    Text(exemption)
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.ink)
                }
            }

            Text(SNAPWorkRequirementsStrings.resultCitations.value(in: language) + ": \(result.citations.count)")
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                .stroke(CivicaColors.hairline, lineWidth: 1)
        )
    }

    // MARK: - Error view

    private func errorView(_ message: String) -> some View {
        let prefix = SNAPWorkRequirementsStrings.evaluationErrorPrefix.value(in: language)
        return Text("\(prefix): \(message)")
            .font(CivicaTypography.body)
            .foregroundStyle(Color.red)
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.red.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous))
    }
}

// MARK: - Preview

#if DEBUG
#Preview("English") {
    NavigationStack {
        SNAPWorkRequirementsView()
    }
}

#Preview("Spanish") {
    NavigationStack {
        SNAPWorkRequirementsView()
    }
    .onAppear {
        UserDefaults.standard.set(CivicaLanguage.spanish.rawValue,
                                  forKey: CivicaLanguage.defaultStorageKey)
    }
}

#Preview("With mock client") {
    NavigationStack {
        SNAPWorkRequirementsView(
            packetId: "mock-packet-123",
            apiClient: MockEnrollmentAPIClient()
        )
    }
}
#endif
