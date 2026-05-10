import CivicaDesignSystem
import SwiftUI

struct IssueCodePickerView: View {
    @Binding var selectedIssue: IssueCode?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: CivicaSpacing.sm) {
                ForEach(IssueCode.allCases) { issue in
                    let isSelected = selectedIssue == issue
                    Button {
                        selectedIssue = issue
                    } label: {
                        Text(issue.displayName)
                            .font(CivicaTypography.captionStrong)
                            .foregroundColor(isSelected ? .white : CivicaColors.ink)
                            .lineLimit(1)
                            .padding(.horizontal, CivicaSpacing.md)
                            .padding(.vertical, CivicaSpacing.sm)
                            .background(isSelected ? CivicaColors.brickPrimary : CivicaColors.surfacePrimary)
                            .clipShape(Capsule())
                            .overlay(
                                Capsule()
                                    .stroke(isSelected ? CivicaColors.brickPrimary : CivicaColors.hairline, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(issue.displayName)
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }
            .padding(.horizontal, CivicaSpacing.xs)
            .padding(.vertical, CivicaSpacing.xs)
        }
    }
}

private struct IssueCodePickerPreviewWrapper: View {
    let senatorName: String
    let assignedCommittees: [String]
    let fixedIssue: IssueCode

    @State private var selectedIssue: IssueCode?

    init(senatorName: String, assignedCommittees: [String], fixedIssue: IssueCode) {
        self.senatorName = senatorName
        self.assignedCommittees = assignedCommittees
        self.fixedIssue = fixedIssue
        _selectedIssue = State(initialValue: fixedIssue)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(senatorName)
                .font(CivicaTypography.sectionHeader)
            IssueCodePickerView(selectedIssue: $selectedIssue)

            Text(
                CallScriptGenerator.script(
                    for: senatorName,
                    issue: selectedIssue ?? fixedIssue,
                    assignedCommittees: assignedCommittees
                )
            )
            .font(CivicaTypography.subhead)
            .foregroundColor(CivicaColors.ink)
            .padding(CivicaSpacing.sm)
            .background(CivicaColors.tealSurface)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
        }
        .padding()
        .background(CivicaColors.tealSurface.opacity(0.25))
    }
}

#Preview("Murphy / Foreign Affairs") {
    IssueCodePickerPreviewWrapper(
        senatorName: "Senator Chris Murphy",
        assignedCommittees: [
            "Foreign Relations",
            "Appropriations",
            "Health, Education, Labor, and Pensions",
        ],
        fixedIssue: .foreign_affairs
    )
}

#Preview("Padilla / LGBTQ+ Rights") {
    IssueCodePickerPreviewWrapper(
        senatorName: "Senator Alex Padilla",
        assignedCommittees: [
            "Judiciary",
            "Budget",
            "Environment and Public Works",
        ],
        fixedIssue: .lgbtq
    )
}

#Preview("Generic / Fallback") {
    IssueCodePickerPreviewWrapper(
        senatorName: "Senator Generic",
        assignedCommittees: [],
        fixedIssue: .foreign_affairs
    )
}
