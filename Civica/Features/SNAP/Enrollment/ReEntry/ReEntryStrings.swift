import Foundation

// User-facing copy for the re-entry assist card and confirmation flow.
//
// Every CivicaText MUST have both .en and .es — ReEntryStringParityTests
// enforces this in CI. Add new strings to `static let all` so the parity
// guard discovers them.
//
// Voice: warm, low-pressure, agency-respecting. We're nudging a household
// that just lost benefits — not selling them anything. Avoid "welcome
// back!" cheer. Lead with the practical: their info is on file, re-enroll
// is fast.

enum ReEntryStrings {
    // MARK: - Card surface

    static let cardEyebrow = CivicaText(
        "Re-enroll quickly",
        es: "Reinscríbete rápidamente"
    )

    static let cardTitleClosedRecently = CivicaText(
        "Your SNAP case closed recently",
        es: "Tu caso de SNAP se cerró recientemente"
    )

    static let cardBodyWithDays = CivicaText(
        "Your case closed %d days ago. We saved your answers — you can re-enroll without redoing the full application.",
        es: "Tu caso se cerró hace %d días. Guardamos tus respuestas — puedes reinscribirte sin volver a hacer toda la solicitud."
    )

    static let cardPrimaryCTA = CivicaText(
        "Start re-enrollment",
        es: "Iniciar reinscripción"
    )

    static let cardDismissCTA = CivicaText(
        "Not now",
        es: "Ahora no"
    )

    // MARK: - Confirmation

    static let confirmTitle = CivicaText(
        "Re-enroll from your last application?",
        es: "¿Reinscribirte desde tu última solicitud?"
    )

    static let confirmBody = CivicaText(
        "We'll pre-fill your answers from before. You can review and update anything that's changed, then submit. Documents will need to be re-uploaded — they may have expired.",
        es: "Pre-llenaremos tus respuestas de antes. Puedes revisar y actualizar lo que haya cambiado, y luego enviar. Tendrás que subir los documentos de nuevo — pueden haber caducado."
    )

    static let confirmContinue = CivicaText(
        "Continue",
        es: "Continuar"
    )

    static let confirmCancel = CivicaText(
        "Cancel",
        es: "Cancelar"
    )

    // MARK: - Status / errors

    static let loading = CivicaText(
        "Setting up your application…",
        es: "Preparando tu solicitud…"
    )

    static let errorTitle = CivicaText(
        "Couldn't start re-enrollment",
        es: "No pudimos iniciar la reinscripción"
    )

    static let errorRetryCTA = CivicaText(
        "Try again",
        es: "Reintentar"
    )

    // MARK: - Parity registry (required by ReEntryStringParityTests)

    static let all: [CivicaText] = [
        cardEyebrow,
        cardTitleClosedRecently,
        cardBodyWithDays,
        cardPrimaryCTA,
        cardDismissCTA,
        confirmTitle,
        confirmBody,
        confirmContinue,
        confirmCancel,
        loading,
        errorTitle,
        errorRetryCTA,
    ]
}
