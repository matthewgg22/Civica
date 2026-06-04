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
        es: "Reinscríbete rápidamente",
        zh: "快速重新申请"
    )

    static let cardTitleClosedRecently = CivicaText(
        "Your SNAP case closed recently",
        es: "Tu caso de SNAP se cerró recientemente",
        zh: "你的 SNAP 案件最近已关闭"
    )

    static let cardBodyWithDays = CivicaText(
        "Your case closed %d days ago. We saved your answers — you can re-enroll without redoing the full application.",
        es: "Tu caso se cerró hace %d días. Guardamos tus respuestas — puedes reinscribirte sin volver a hacer toda la solicitud.",
        zh: "你的案件已关闭 %d 天。我们保存了你的回答——你可以重新申请,无需重新填写整份申请。"
    )

    static let cardPrimaryCTA = CivicaText(
        "Start re-enrollment",
        es: "Iniciar reinscripción",
        zh: "开始重新申请"
    )

    static let cardDismissCTA = CivicaText(
        "Not now",
        es: "Ahora no",
        zh: "暂不"
    )

    // MARK: - Confirmation

    static let confirmTitle = CivicaText(
        "Re-enroll from your last application?",
        es: "¿Reinscribirte desde tu última solicitud?",
        zh: "用你上次的申请重新申请吗?"
    )

    static let confirmBody = CivicaText(
        "We'll pre-fill your answers from before. You can review and update anything that's changed, then submit. Documents will need to be re-uploaded — they may have expired.",
        es: "Pre-llenaremos tus respuestas de antes. Puedes revisar y actualizar lo que haya cambiado, y luego enviar. Tendrás que subir los documentos de nuevo — pueden haber caducado.",
        zh: "我们会用你之前的回答预先填好。你可以查看并更新有变化的地方,然后提交。文件需要重新上传——之前的可能已经过期。"
    )

    static let confirmContinue = CivicaText(
        "Continue",
        es: "Continuar",
        zh: "继续"
    )

    static let confirmCancel = CivicaText(
        "Cancel",
        es: "Cancelar",
        zh: "取消"
    )

    // MARK: - Status / errors

    static let loading = CivicaText(
        "Setting up your application…",
        es: "Preparando tu solicitud…",
        zh: "正在准备你的申请……"
    )

    static let errorTitle = CivicaText(
        "Couldn't start re-enrollment",
        es: "No pudimos iniciar la reinscripción",
        zh: "无法开始重新申请"
    )

    static let errorRetryCTA = CivicaText(
        "Try again",
        es: "Reintentar",
        zh: "重试"
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
