import Foundation

// Strings for the SNAP Voice intake feature, including the OBBBA Q5
// distress-prompt confirmation gate. Every visible string keyed for
// English + Spanish per HANDOFF #4 Spanish parity gate.

enum SNAPVoiceStrings {

    // MARK: - Distress confirmation sheet

    static let distressSheetTitle = CivicaText(
        "We noticed something in what you shared",
        es: "Notamos algo en lo que compartiste"
    )
    static let distressSheetBody = CivicaText(
        "It sounds like you may be going through a difficult time. You don't have to be alone.",
        es: "Parece que puedes estar pasando por un momento difícil. No tienes que estar solo/a."
    )
    static let distressHotline988 = CivicaText(
        "988 Suicide & Crisis Lifeline",
        es: "Línea de Crisis y Suicidio 988"
    )
    static let distressHotline988Sub = CivicaText(
        "Call or text 988, available 24/7",
        es: "Llama o envía un mensaje al 988, disponible las 24 horas"
    )
    static let distressHotline211 = CivicaText(
        "211 — Social services",
        es: "211 — Servicios sociales"
    )
    static let distressHotline211Sub = CivicaText(
        "Call or text 211 for food, shelter, and support",
        es: "Llama o envía un mensaje al 211 para comida, refugio y apoyo"
    )
    static let distressContinue = CivicaText(
        "Continue with my application",
        es: "Continuar con mi solicitud"
    )
    static let distressPause = CivicaText(
        "Save and come back later",
        es: "Guardar y volver más tarde"
    )
}
