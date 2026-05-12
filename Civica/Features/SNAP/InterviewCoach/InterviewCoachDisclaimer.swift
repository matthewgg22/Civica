import SwiftUI
import CivicaDesignSystem

// EXPERIMENTAL SILOED MODULE: shared legal disclaimer for the Interview
// Coach surfaces.
//
// Two visual variants. `.standard` is a multi-line footer with
// Massachusetts Legal Aid + DTA pointers, used on the entry hub,
// question detail, and feedback views where the user has time to read.
// `.compact` is a single-line strip used in the practice session
// header, where vertical space is precious and the user is mid-task.
//
// Both render in the user's chosen language via InterviewCoachStrings.
// Phrasing is conservative until MLRI / GBLS sign-off on the question
// bank lands; revisit then.
struct InterviewCoachDisclaimer: View {
    enum Variant {
        case standard
        case compact
    }

    let language: CivicaLanguage
    var variant: Variant = .standard

    var body: some View {
        switch variant {
        case .standard:
            Text(InterviewCoachStrings.disclaimerBody.value(in: language))
                .font(CivicaTypography.caption)
                .foregroundStyle(CivicaColors.graphite)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .padding(CivicaSpacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .fill(CivicaColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .stroke(CivicaColors.hairline, lineWidth: 1)
                )
                .accessibilityLabel(InterviewCoachStrings.disclaimerBody.value(in: language))

        case .compact:
            Text(InterviewCoachStrings.disclaimerCompact.value(in: language))
                .font(CivicaTypography.caption)
                .foregroundStyle(CivicaColors.graphite)
                .padding(.horizontal, CivicaSpacing.md)
                .padding(.vertical, CivicaSpacing.xs)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(CivicaColors.tealSurface.opacity(0.3))
                .accessibilityLabel(InterviewCoachStrings.disclaimerCompact.value(in: language))
        }
    }
}
