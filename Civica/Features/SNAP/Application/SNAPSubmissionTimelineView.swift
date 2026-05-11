import CivicaDesignSystem
import SwiftUI

// HANDOFF FormSuccessBoard: "No celebration screen. A timeline."
//
// The most-asked question after submitting any benefits application
// is "did it go through, and when do I hear back?" Civica answers
// both, by date, with no marketing chrome — no confetti, no
// exclamation points, no "we're so excited."
//
// Surfaces in the waiting room the moment status flips to
// .submittedToState. Once the state acts (documentsRequested,
// interviewScheduled), the waiting room takes over with action
// banners and this view steps aside. Subsequent re-entries while
// still .submittedToState keep showing this — it's the answer to
// "is anything happening?" until something actually does.

struct SNAPSubmissionTimelineView: View {
    let submittedAt: Date
    let language: CivicaLanguage
    /// True when the SNAP draft indicates a minor in the household,
    /// gating the "while you wait" cross-program teaser. False hides
    /// the WIC card and the layout collapses to one footer card.
    let showsWICTeaser: Bool
    let onOpenWICTeaser: () -> Void
    let onContactSupport: () -> Void

    private static let supportPhone = "(617) 555-0142"

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
            headline
            timeline
            footerCards
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

    // MARK: - Headline

    private var headline: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPSubmissionTimelineStrings.eyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(SNAPSubmissionTimelineStrings.headline.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
            Text(SNAPSubmissionTimelineStrings.subhead.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Timeline

    private var timeline: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(stations.enumerated()), id: \.element.id) { index, station in
                stationRow(station, isLast: index == stations.count - 1)
            }
        }
    }

    private func stationRow(_ station: Station, isLast: Bool) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            VStack(spacing: 0) {
                stationDot(state: station.state)
                if !isLast {
                    Rectangle()
                        .fill(CivicaColors.hairline)
                        .frame(width: 1.5)
                        .frame(minHeight: 36)
                        .padding(.top, 4)
                }
            }
            .frame(width: 14)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(station.when)
                    .font(CivicaTypography.captionStrong.monospacedDigit())
                    .foregroundStyle(station.state == .done ? CivicaColors.brickPrimary : CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.2)
                Text(station.title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(station.body)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.bottom, isLast ? 0 : CivicaSpacing.md)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(station.when). \(station.title). \(station.body)")
    }

    @ViewBuilder
    private func stationDot(state: Station.State) -> some View {
        switch state {
        case .done:
            Circle()
                .fill(CivicaColors.brickPrimary)
                .frame(width: 14, height: 14)
        case .now:
            Circle()
                .fill(CivicaColors.ink)
                .frame(width: 14, height: 14)
        case .upcoming:
            Circle()
                .strokeBorder(CivicaColors.graphite.opacity(0.4), lineWidth: 1.5)
                .frame(width: 14, height: 14)
        }
    }

    // MARK: - Footer cards

    private var footerCards: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            if showsWICTeaser {
                footerCard(
                    label: SNAPSubmissionTimelineStrings.whileWaitLabel.value(in: language),
                    body: SNAPSubmissionTimelineStrings.whileWaitBody.value(in: language),
                    cta: SNAPSubmissionTimelineStrings.whileWaitCTA.value(in: language),
                    action: onOpenWICTeaser
                )
            }
            footerCard(
                label: SNAPSubmissionTimelineStrings.somethingWrongLabel.value(in: language),
                body: somethingWrongBody,
                cta: nil,
                action: onContactSupport
            )
        }
    }

    private func footerCard(label: String, body: String, cta: String?, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(label)
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.2)
                Text(body)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let cta {
                    Text(cta)
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.brickPrimary)
                        .padding(.top, CivicaSpacing.xs)
                }
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.paper)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel(label: label, body: body, cta: cta))
    }

    /// Strips trailing arrow glyphs from CTA copy so VoiceOver doesn't
    /// announce "right arrow" after every footer-card tap target.
    private func accessibilityLabel(label: String, body: String, cta: String?) -> String {
        var components = [label, body]
        if let cta {
            let stripped = cta
                .replacingOccurrences(of: "→", with: "")
                .trimmingCharacters(in: .whitespaces)
            if !stripped.isEmpty {
                components.append(stripped)
            }
        }
        return components.joined(separator: ". ")
    }

    // MARK: - Stations

    private var stations: [Station] {
        let formatter = DateFormatter()
        formatter.locale = language == .spanish ? Locale(identifier: "es") : Locale(identifier: "en_US")
        formatter.dateFormat = language == .spanish ? "d 'de' MMM" : "MMM d"

        let today = SNAPSubmissionTimelineStrings.todayLabel.value(in: language)
        let withinSeven = SNAPSubmissionTimelineStrings.windowSevenDays.value(in: language)
        let withinThirty = SNAPSubmissionTimelineStrings.windowThirtyDays.value(in: language)
        let firstDeposit = SNAPSubmissionTimelineStrings.windowFirstDeposit.value(in: language)

        return [
            Station(
                id: "submitted",
                when: "\(today) · \(formatter.string(from: submittedAt))",
                title: SNAPSubmissionTimelineStrings.stationSubmittedTitle.value(in: language),
                body: SNAPSubmissionTimelineStrings.stationSubmittedBody.value(in: language),
                state: .done
            ),
            Station(
                id: "agency_review",
                when: withinSeven,
                title: SNAPSubmissionTimelineStrings.stationReviewTitle.value(in: language),
                body: SNAPSubmissionTimelineStrings.stationReviewBody.value(in: language),
                state: .now
            ),
            Station(
                id: "decision_letter",
                when: withinThirty,
                title: SNAPSubmissionTimelineStrings.stationDecisionTitle.value(in: language),
                body: SNAPSubmissionTimelineStrings.stationDecisionBody.value(in: language),
                state: .upcoming
            ),
            Station(
                id: "first_deposit",
                when: firstDeposit,
                title: SNAPSubmissionTimelineStrings.stationDepositTitle.value(in: language),
                body: SNAPSubmissionTimelineStrings.stationDepositBody.value(in: language),
                state: .upcoming
            ),
        ]
    }

    private var somethingWrongBody: String {
        let template = SNAPSubmissionTimelineStrings.somethingWrongBody.value(in: language)
        return template.replacingOccurrences(of: "%@", with: Self.supportPhone)
    }

    fileprivate struct Station {
        enum State { case done, now, upcoming }
        let id: String
        let when: String
        let title: String
        let body: String
        let state: State
    }
}

// MARK: - Strings

enum SNAPSubmissionTimelineStrings {

    static let eyebrow = CivicaText(
        "Submission · what happens next",
        es: "Envío · qué pasa ahora"
    )
    static let headline = CivicaText(
        "Your SNAP application is in. Here's what we expect to happen, by when.",
        es: "Tu solicitud de SNAP fue enviada. Esto es lo que esperamos que pase, y cuándo."
    )
    static let subhead = CivicaText(
        "Massachusetts DTA owns the next steps. We'll text you the moment anything changes.",
        es: "El DTA de Massachusetts maneja los próximos pasos. Te enviaremos un mensaje cuando algo cambie."
    )

    // MARK: - Station window labels

    static let todayLabel = CivicaText(
        "Today",
        es: "Hoy"
    )
    static let windowSevenDays = CivicaText(
        "Within 7 days",
        es: "Dentro de 7 días"
    )
    static let windowThirtyDays = CivicaText(
        "Within 30 days",
        es: "Dentro de 30 días"
    )
    static let windowFirstDeposit = CivicaText(
        "Day 1 of EBT",
        es: "Día 1 de EBT"
    )

    // MARK: - Stations

    static let stationSubmittedTitle = CivicaText(
        "Submitted",
        es: "Enviada"
    )
    static let stationSubmittedBody = CivicaText(
        "Sent to Massachusetts DTA through dtaconnect.eohhs.mass.gov. You should also see it listed under \"My Applications\" in your DTA Connect account.",
        es: "Enviada al DTA de Massachusetts a través de dtaconnect.eohhs.mass.gov. También debes verla en \"Mis Solicitudes\" de tu cuenta de DTA Connect."
    )
    static let stationReviewTitle = CivicaText(
        "Agency review",
        es: "Revisión de la agencia"
    )
    static let stationReviewBody = CivicaText(
        "A DTA caseworker reads your application and may call to confirm details. Their numbers usually start with (617) or (508) — we'll never ask you for payment.",
        es: "Un asesor del DTA lee tu solicitud y puede llamarte para confirmar detalles. Sus números empiezan con (617) o (508) — nunca te pediremos pago."
    )
    static let stationDecisionTitle = CivicaText(
        "Decision letter",
        es: "Carta de decisión"
    )
    static let stationDecisionBody = CivicaText(
        "DTA sends a letter by mail and we'll text you. If approved, an EBT card is mailed within 5 business days.",
        es: "El DTA envía una carta por correo y te enviaremos un mensaje. Si te aprueban, la tarjeta EBT llega por correo dentro de 5 días hábiles."
    )
    static let stationDepositTitle = CivicaText(
        "First deposit",
        es: "Primer depósito"
    )
    static let stationDepositBody = CivicaText(
        "Your monthly amount lands the day your case is approved. After that, the same date each month.",
        es: "Tu cantidad mensual llega el día que tu caso es aprobado. Después, la misma fecha cada mes."
    )

    // MARK: - Footer cards

    static let whileWaitLabel = CivicaText(
        "While you wait",
        es: "Mientras esperas"
    )
    static let whileWaitBody = CivicaText(
        "You may also qualify for WIC — extra food vouchers for kids under 5. Want us to point you at the state's page?",
        es: "También podrías calificar para WIC — vales adicionales para niños menores de 5. ¿Quieres que te llevemos a la página del estado?"
    )
    static let whileWaitCTA = CivicaText(
        "See what WIC covers →",
        es: "Ver lo que cubre WIC →"
    )

    static let somethingWrongLabel = CivicaText(
        "If something goes wrong",
        es: "Si algo sale mal"
    )
    /// Body interpolates the support phone (e.g. "(617) 555-0142").
    /// Use `String(format:)`-style %@ placeholder so the localized
    /// template stays in this enum.
    static let somethingWrongBody = CivicaText(
        "Text us at %@ with your case info. A real person responds within one business day.",
        es: "Envíanos un mensaje al %@ con la información de tu caso. Una persona real responde dentro de un día hábil."
    )
}

#if DEBUG
struct SNAPSubmissionTimelineView_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(spacing: CivicaSpacing.lg) {
                SNAPSubmissionTimelineView(
                    submittedAt: Date(),
                    language: .english,
                    showsWICTeaser: true,
                    onOpenWICTeaser: {},
                    onContactSupport: {}
                )
                SNAPSubmissionTimelineView(
                    submittedAt: Date(),
                    language: .spanish,
                    showsWICTeaser: false,
                    onOpenWICTeaser: {},
                    onContactSupport: {}
                )
            }
            .padding()
        }
        .background(CivicaColors.paper)
    }
}
#endif
