import Foundation

// Strings for the SNAP Voice intake feature, including the OBBBA Q5
// distress-prompt confirmation gate. Every visible string keyed for
// English + Spanish per HANDOFF #4 Spanish parity gate.

enum SNAPVoiceStrings {

    // MARK: - Distress confirmation sheet

    static let distressSheetTitle = CivicaText(
        "We noticed something in what you shared",
        es: "Notamos algo en lo que compartiste",
        zh: "我们注意到你分享的内容里有些情况"
    )
    static let distressSheetBody = CivicaText(
        "It sounds like you may be going through a difficult time. You don't have to be alone.",
        es: "Parece que puedes estar pasando por un momento difícil. No tienes que estar solo/a.",
        zh: "听起来你可能正在经历一段艰难的时期。你不必独自面对。"
    )
    static let distressHotline988 = CivicaText(
        "988 Suicide & Crisis Lifeline",
        es: "Línea de Crisis y Suicidio 988",
        zh: "988 自杀与危机生命专线"
    )
    static let distressHotline988Sub = CivicaText(
        "Call or text 988, available 24/7",
        es: "Llama o envía un mensaje al 988, disponible las 24 horas",
        zh: "拨打或发短信至 988,全天 24 小时服务"
    )
    static let distressHotline211 = CivicaText(
        "211 — Social services",
        es: "211 — Servicios sociales",
        zh: "211 — 社会服务"
    )
    static let distressHotline211Sub = CivicaText(
        "Call or text 211 for food, shelter, and support",
        es: "Llama o envía un mensaje al 211 para comida, refugio y apoyo",
        zh: "拨打或发短信至 211,获取食物、住所和支持"
    )
    static let distressContinue = CivicaText(
        "Continue with my application",
        es: "Continuar con mi solicitud",
        zh: "继续我的申请"
    )
    static let distressPause = CivicaText(
        "Save and come back later",
        es: "Guardar y volver más tarde",
        zh: "保存并稍后再来"
    )
}
