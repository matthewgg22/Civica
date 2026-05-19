import CivicaDesignSystem
import SwiftUI

// MARK: - Models

/// Per-member fields for the OBBBA work-requirements evaluator.
/// Corresponds to `isTribalMember` and `isEnrolledInQualifyingProgram`
/// in the enrollment API's work-requirements payload.
struct WorkRequirementsMember: Identifiable {
    let id = UUID()
    var displayName: String
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
/// The "Evaluate" button currently stubs the POST; wire to
/// `EnrollmentAPIClient.evaluateWorkRequirements(...)` when the endpoint ships.
struct SNAPWorkRequirementsView: View {

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    @State private var members: [WorkRequirementsMember] = [
        WorkRequirementsMember(displayName: "Member 1",
                               isTribalMember: false,
                               isEnrolledInQualifyingProgram: false),
        WorkRequirementsMember(displayName: "Member 2",
                               isTribalMember: false,
                               isEnrolledInQualifyingProgram: false),
    ]

    @State private var isEvaluating = false

    // MARK: - Strings

    private var pageTitle: String {
        language == .spanish ? "Requisitos laborales" : "Work Requirements"
    }

    private var sectionHeaderText: String {
        language == .spanish ? "Miembros del hogar" : "Household Members"
    }

    private var tribalMemberLabel: String {
        language == .spanish ? "Miembro tribal inscrito" : "Enrolled tribal member"
    }

    private var qualifyingProgramLabel: String {
        language == .spanish ? "Inscrito en programa calificado" : "Enrolled in qualifying program"
    }

    private var qualifyingProgramSubtitle: String {
        language == .spanish
            ? "SNAP E&T, tratamiento por drogas/alcohol, o salud mental comunitaria"
            : "SNAP E&T, drug/alcohol treatment, or community mental health"
    }

    private var evaluateLabel: String {
        language == .spanish ? "Evaluar" : "Evaluate"
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xxl) {
                membersSection
                evaluateButton
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
            isEvaluating = true
            // TODO: wire to EnrollmentAPIClient.evaluateWorkRequirements(members)
            // when the /work-requirements endpoint ships. The payload shape is:
            //   members: [{ isTribalMember: Bool, isEnrolledInQualifyingProgram: Bool }]
            print("[SNAPWorkRequirementsView] evaluate tapped — members: \(members.map { ($0.displayName, $0.isTribalMember, $0.isEnrolledInQualifyingProgram) })")
            isEvaluating = false
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
#endif
