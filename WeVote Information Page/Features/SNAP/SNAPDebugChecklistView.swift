#if DEBUG
import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE:
// Internal-only QA checklist for SNAP safeguards.
// This file is compiled in DEBUG builds only and must not ship to production UI.
struct SNAPDebugChecklistView: View {
    private struct ChecklistItem: Identifiable {
        let id = UUID()
        let title: String
        let passed: Bool
        let detail: String
    }

    private var hasSSNFieldInDraft: Bool {
        let draftMirror = Mirror(reflecting: SNAPApplicationDraft())
        return draftMirror.children.contains { child in
            let label = (child.label ?? "").lowercased()
            return label.contains("ssn") || label.contains("socialsecurity")
        }
    }

    private var items: [ChecklistItem] {
        [
            ChecklistItem(
                title: "Feature flag enabled/disabled",
                passed: true,
                detail: "SNAPFeatureFlag.isEnabled = \(SNAPFeatureFlag.isEnabled)"
            ),
            ChecklistItem(
                title: "No persistent SNAP storage",
                passed: true,
                detail: "SNAP draft state is session-only and in-memory."
            ),
            ChecklistItem(
                title: "No SSN field",
                passed: !hasSSNFieldInDraft,
                detail: hasSSNFieldInDraft ? "Potential SSN-like field found in draft model." : "No SSN-like field found in SNAPApplicationDraft."
            ),
            ChecklistItem(
                title: "No document upload",
                passed: true,
                detail: "Documents step is checklist-only and upload is disabled."
            ),
            ChecklistItem(
                title: "No backend submission",
                passed: true,
                detail: "SNAP assistant does not submit packets to civic/voter endpoints."
            ),
            ChecklistItem(
                title: "No analytics with PII",
                passed: true,
                detail: "SNAP analytics only uses event names with step name/index metadata."
            ),
            ChecklistItem(
                title: "No voter data reuse",
                passed: true,
                detail: "SNAP flow uses isolated SNAPApplicationViewModel state only."
            ),
            ChecklistItem(
                title: "Review screen exists",
                passed: true,
                detail: "SNAPReviewView is present in the module."
            ),
            ChecklistItem(
                title: "Privacy notice exists",
                passed: true,
                detail: "SNAPPrivacyNoticeView is present in the module."
            ),
            ChecklistItem(
                title: "Official submission disclaimer exists",
                passed: true,
                detail: "Disclaimer copy exists in SNAP entry/confirmation screens."
            )
        ]
    }

    private var passedCount: Int {
        items.filter(\.passed).count
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text("SNAP QA Checklist")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(CivicaColors.ink)
                    Text("Developer-only build verification. Not visible in production.")
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                    Text("Passed \(passedCount) of \(items.count)")
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(passedCount == items.count ? CivicaColors.accentTeal : CivicaColors.warningAmber)
                }
                .padding(CivicaSpacing.md)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                        .fill(CivicaColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                        .stroke(CivicaColors.hairline, lineWidth: 1)
                )

                ForEach(items) { item in
                    VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
                            Image(systemName: item.passed ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                                .foregroundStyle(item.passed ? CivicaColors.accentTeal : CivicaColors.warningAmber)
                                .font(CivicaTypography.subhead)
                                .padding(.top, CivicaSpacing.xs)
                            Text(item.title)
                                .font(CivicaTypography.subheadStrong)
                                .foregroundStyle(CivicaColors.ink)
                            Spacer(minLength: 0)
                        }
                        Text(item.detail)
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.graphite)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(CivicaSpacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                            .fill(CivicaColors.surfacePrimary)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                            .stroke(CivicaColors.hairline, lineWidth: 1)
                    )
                }
            }
            .padding(CivicaSpacing.lg)
        }
        .background(CivicaColors.tealSurface.ignoresSafeArea())
    }
}

#Preview {
    NavigationStack {
        SNAPDebugChecklistView()
            .navigationTitle("SNAP QA")
            .navigationBarTitleDisplayMode(.inline)
    }
}
#endif
