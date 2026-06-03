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
        es: "¿Tuviste respuesta de CalFresh?",
        zh: "CalFresh 给你回复了吗?"
    )
    static let pushBody = CivicaText(
        "Two minutes to tell us. Helps us help the next applicant.",
        es: "Dos minutos para contarnos. Ayuda al siguiente solicitante.",
        zh: "花两分钟告诉我们。可以帮我们更好地帮下一位申请人。"
    )

    // MARK: - Prompt screen

    static let promptTitle = CivicaText(
        "Your CalFresh decision",
        es: "Tu decisión de CalFresh",
        zh: "你的 CalFresh 决定"
    )
    static let promptSubtitle = CivicaText(
        "If you got mail or a call from the county, let us know what they said.",
        es: "Si recibiste carta o llamada del condado, cuéntanos qué dijeron.",
        zh: "如果县里给你寄了信或打了电话,告诉我们他们说了什么。"
    )

    static let buttonApproved = CivicaText(
        "Approved",
        es: "Aprobado",
        zh: "已批准"
    )
    static let buttonDenied = CivicaText(
        "Denied",
        es: "Denegado",
        zh: "被拒绝"
    )
    static let buttonNotYet = CivicaText(
        "Not yet",
        es: "Aún no",
        zh: "还没有"
    )

    // MARK: - After-submit confirmation

    /// Approved confirmation. Amount is a placeholder until navigator
    /// confirms — keep the trailing "then." so the line lands with the
    /// brand voice cadence used in brand_voice.md's Approved example.
    static let afterApproved = CivicaText(
        "Got it. $[amount]/month starting this month, then.",
        es: "Anotado. $[amount]/mes a partir de este mes.",
        zh: "知道了。那就从这个月开始,每月 $[amount]。"
    )
    static let afterDenied = CivicaText(
        "Got it. If you want to appeal, we'll help — open the Appeal section.",
        es: "Anotado. Si quieres apelar, te ayudamos — abre la sección de Apelación.",
        zh: "知道了。如果你想申诉,我们会帮你 — 打开「申诉」部分。"
    )
    static let afterNotYet = CivicaText(
        "We'll check back in 7 days.",
        es: "Te preguntamos de nuevo en 7 días.",
        zh: "我们 7 天后再问你。"
    )

    // MARK: - Soft permission pre-prompt (only shown if push perm
    // hasn't been granted from the recert flow yet)

    static let permissionTitle = CivicaText(
        "Let us ask once when your decision is due",
        es: "Permítenos preguntarte una vez cuando llegue la decisión",
        zh: "等你的决定快到了,让我们问你一次"
    )
    static let permissionBody = CivicaText(
        "One notification, about two weeks after your packet goes to the county. No promotions, no nags.",
        es: "Una notificación, unas dos semanas después de que tu paquete llegue al condado. Sin promociones, sin insistencia.",
        zh: "一条通知,在你的材料送到县里大约两周后。没有推广,也不会反复打扰。"
    )
    static let permissionAccept = CivicaText(
        "Allow",
        es: "Permitir",
        zh: "允许"
    )
    static let permissionSkip = CivicaText(
        "Not now",
        es: "Ahora no",
        zh: "暂时不要"
    )
}
