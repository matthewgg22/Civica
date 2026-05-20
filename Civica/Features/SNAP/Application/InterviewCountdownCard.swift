import CivicaDesignSystem
import SwiftUI

// Cost-of-delay countdown for the waiting room. Pulls the user's
// estimated monthly benefit from SNAPEstimatorResultStore and the
// interview date from SNAPApplicationStatusStore.interviewScheduledFor,
// computes a per-day value, and renders one line:
//
//   "Your interview is in 9 days. Once approved, you'd receive
//    about $16/day."
//
// No live ticking — recomputed on view appear and on scene-active.
// Hides itself if either input is nil so the waiting room stays
// quiet when the underlying data isn't ready.

struct InterviewCountdownCard: View {
    let interviewDate: Date
    let monthlyBenefit: Decimal
    let language: CivicaLanguage

    @Environment(\.scenePhase) private var scenePhase
    @State private var now: Date = Date()

    private var daysUntil: Int {
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: now)
        let startOfInterviewDay = calendar.startOfDay(for: interviewDate)
        let components = calendar.dateComponents([.day], from: startOfToday, to: startOfInterviewDay)
        return max(0, components.day ?? 0)
    }

    private var dailyValue: Decimal {
        let raw = monthlyBenefit / 30
        var rounded = Decimal()
        var copy = raw
        NSDecimalRound(&rounded, &copy, 0, .plain)
        return rounded
    }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(InterviewCountdownStrings.eyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.pinePrimary)
                .textCase(.uppercase)
                .kerning(1.2)

            Text(headlineLine)
                .font(CivicaTypography.cardTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)

            Text(deltaLine)
                .font(CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.brickSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .onAppear { now = Date() }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active { now = Date() }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(headlineLine). \(deltaLine)")
    }

    private var headlineLine: String {
        switch language {
        case .english:
            if daysUntil == 0 { return "Your interview is today." }
            if daysUntil == 1 { return "Your interview is tomorrow." }
            return "Your interview is in \(daysUntil) days."
        case .spanish:
            if daysUntil == 0 { return "Tu entrevista es hoy." }
            if daysUntil == 1 { return "Tu entrevista es mañana." }
            return "Tu entrevista es en \(daysUntil) días."
        }
    }

    private var deltaLine: String {
        let amount = NSDecimalNumber(decimal: dailyValue).intValue
        switch language {
        case .english:
            return "Once approved, you'd receive about $\(amount)/day."
        case .spanish:
            return "Una vez aprobado, recibirías cerca de $\(amount)/día."
        }
    }
}

// MARK: - Date capture

/// Inline date+time entry card shown on the waiting room when
/// status is .interviewScheduled but interviewScheduledFor is nil.
/// Save commits the date to the status store; the Coach view picks
/// it up on next appear and schedules the 24h-before notification.
struct InterviewDateCaptureCard: View {
    let language: CivicaLanguage
    let onSave: (Date) -> Void

    @State private var draft: Date = defaultDraft()

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(InterviewCountdownStrings.dateCaptureTitle.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)

            Text(InterviewCountdownStrings.dateCaptureBody(
                stateCode: SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode,
                language: language
            ))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)

            DatePicker(
                "",
                selection: $draft,
                in: Date()...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .labelsHidden()
            .datePickerStyle(.compact)
            .tint(CivicaColors.pinePrimary)

            CivicaPrimaryButton(
                InterviewCountdownStrings.dateCaptureSave.value(in: language),
                action: { onSave(draft) }
            )
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private static func defaultDraft() -> Date {
        let calendar = Calendar.current
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        var components = calendar.dateComponents([.year, .month, .day], from: tomorrow)
        components.hour = 10
        components.minute = 0
        return calendar.date(from: components) ?? tomorrow
    }
}

// MARK: - Copy

enum InterviewCountdownStrings {
    static let eyebrow = CivicaText(
        "Your interview",
        es: "Tu entrevista"
    )

    static let dateCaptureTitle = CivicaText(
        "When is your interview?",
        es: "¿Cuándo es tu entrevista?"
    )

    /// "Enter the date and time from your <agency> confirmation letter."
    /// State-conditioned via SNAPAgencyDirectory so the active state's
    /// agency name shows in the interview-prep flow. Defaults to launch
    /// state when no draft state is in scope yet.
    static func dateCaptureBody(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyShortName(for: stateCode, language: language)
        switch language {
        case .english:
            return "Enter the date and time from your \(agency) confirmation letter. We'll remind you the day before."
        case .spanish:
            return "Ingresa la fecha y hora de tu carta de confirmación de \(agency). Te recordaremos el día anterior."
        }
    }

    static let dateCaptureSave = CivicaText(
        "Save interview date",
        es: "Guardar fecha"
    )
}

#if DEBUG
struct InterviewCountdownCard_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: CivicaSpacing.lg) {
            InterviewCountdownCard(
                interviewDate: Date().addingTimeInterval(9 * 24 * 60 * 60),
                monthlyBenefit: 480,
                language: .english
            )
            InterviewDateCaptureCard(language: .english, onSave: { _ in })
        }
        .padding()
        .background(CivicaColors.paper)
    }
}
#endif
