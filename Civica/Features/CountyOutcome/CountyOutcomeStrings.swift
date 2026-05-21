import Foundation

// User-visible strings for the Applicant-side County Outcome module.
// EN + ES at parity. Voice rules per docs/brand_voice.md:
//   - Name the moment, the next action, the time horizon.
//   - No exclamation points, no emoji, no "sorry" / "unfortunately".
//   - Use the user's words (CalFresh — California's SNAP name).

enum CountyOutcomeStrings {
    // MARK: - Push notification (fires +14d after handoff)

    static let pushTitle = CivicaText(
        "Did you hear back from CalFresh?",
        es: "¿Tuviste respuesta de CalFresh?"
    )
    static let pushBody = CivicaText(
        "Two minutes to tell us. Helps us help the next applicant.",
        es: "Dos minutos para contarnos. Ayuda al siguiente solicitante."
    )

    // MARK: - Prompt screen

    static let promptTitle = CivicaText(
        "Your CalFresh decision",
        es: "Tu decisión de CalFresh"
    )
    static let promptSubtitle = CivicaText(
        "If you got mail or a call from the county, let us know what they said.",
        es: "Si recibiste carta o llamada del condado, cuéntanos qué dijeron."
    )

    static let buttonApproved = CivicaText(
        "Approved",
        es: "Aprobado"
    )
    static let buttonDenied = CivicaText(
        "Denied",
        es: "Denegado"
    )
    static let buttonNotYet = CivicaText(
        "Not yet",
        es: "Aún no"
    )

    // MARK: - After-submit confirmation

    /// Approved confirmation. Amount is a placeholder until navigator
    /// confirms — keep the trailing "then." so the line lands with the
    /// brand voice cadence used in brand_voice.md's Approved example.
    static let afterApproved = CivicaText(
        "Got it. $[amount]/month starting this month, then.",
        es: "Anotado. $[amount]/mes a partir de este mes."
    )
    static let afterDenied = CivicaText(
        "Got it. If you want to appeal, we'll help — open the Appeal section.",
        es: "Anotado. Si quieres apelar, te ayudamos — abre la sección de Apelación."
    )
    static let afterNotYet = CivicaText(
        "We'll check back in 7 days.",
        es: "Te preguntamos de nuevo en 7 días."
    )

    // MARK: - Soft permission pre-prompt (only shown if push perm
    // hasn't been granted from the recert flow yet)

    static let permissionTitle = CivicaText(
        "Let us ask once when your decision is due",
        es: "Permítenos preguntarte una vez cuando llegue la decisión"
    )
    static let permissionBody = CivicaText(
        "One notification, about two weeks after your packet goes to the county. No promotions, no nags.",
        es: "Una notificación, unas dos semanas después de que tu paquete llegue al condado. Sin promociones, sin insistencia."
    )
    static let permissionAccept = CivicaText(
        "Allow",
        es: "Permitir"
    )
    static let permissionSkip = CivicaText(
        "Not now",
        es: "Ahora no"
    )
}
