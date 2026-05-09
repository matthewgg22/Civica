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
                            .font(.caption.weight(.semibold))
                            .foregroundColor(isSelected ? .white : VoteNowColors.textPrimary)
                            .lineLimit(1)
                            .padding(.horizontal, CivicaSpacing.md)
                            .padding(.vertical, CivicaSpacing.sm)
                            .background(isSelected ? VoteNowColors.ctaBlue : VoteNowColors.surfacePrimary)
                            .clipShape(Capsule())
                            .overlay(
                                Capsule()
                                    .stroke(isSelected ? VoteNowColors.ctaBlue : VoteNowColors.borderSubtle, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(issue.displayName)
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }
            .padding(.horizontal, 2)
            .padding(.vertical, 2)
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
        VStack(alignment: .leading, spacing: 10) {
            Text(senatorName)
                .font(.headline)
            IssueCodePickerView(selectedIssue: $selectedIssue)

            Text(
                CallScriptGenerator.script(
                    for: senatorName,
                    issue: selectedIssue ?? fixedIssue,
                    assignedCommittees: assignedCommittees
                )
            )
            .font(.subheadline)
            .foregroundColor(VoteNowColors.textPrimary)
            .padding(10)
            .background(VoteNowColors.infoSurfaceBlue)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
        }
        .padding()
        .background(VoteNowColors.brandSoftBlue.opacity(0.25))
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
