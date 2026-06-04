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
    /// USPS state code for the user's active draft. Drives the
    /// agency name and the caseworker area-codes mentioned in the
    /// timeline copy. Nil falls back to the launch state.
    let stateCode: String?
    let onOpenWICTeaser: () -> Void
    let onContactSupport: () -> Void

    init(
        submittedAt: Date,
        language: CivicaLanguage,
        showsWICTeaser: Bool,
        stateCode: String? = nil,
        onOpenWICTeaser: @escaping () -> Void,
        onContactSupport: @escaping () -> Void
    ) {
        self.submittedAt = submittedAt
        self.language = language
        self.showsWICTeaser = showsWICTeaser
        self.stateCode = stateCode
        self.onOpenWICTeaser = onOpenWICTeaser
        self.onContactSupport = onContactSupport
    }

    private var supportPhone: String {
        // First area code of the state plus a Civica-owned vanity
        // pattern so the displayed number renders correctly per region.
        let codes = SNAPAgencyDirectory.caseworkerAreaCodes(for: stateCode)
        let prefix = codes.first ?? "(800)"
        return "\(prefix) 555-0142"
    }

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
            Text(SNAPSubmissionTimelineStrings.subhead(stateCode: stateCode, language: language))
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
                    // Done stations -> teal (positive past milestone),
                    // matching the dot. Upcoming + now lean graphite
                    // so the gold "now" dot stays the eye anchor.
                    .foregroundStyle(station.state == .done ? CivicaColors.amberPrimary : CivicaColors.graphite)
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
        // Done = positive past milestone -> teal
        case .done:
            Circle()
                .fill(CivicaColors.amberPrimary)
                .frame(width: 14, height: 14)
        // Now = "you are here right now" -> gold focus
        case .now:
            Circle()
                .fill(CivicaColors.wheatPop)
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
                        .foregroundStyle(CivicaColors.pinePrimary)
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
        switch language {
        case .spanish:
            formatter.locale = Locale(identifier: "es")
            formatter.dateFormat = "d 'de' MMM"
        case .mandarin:
            formatter.locale = Locale(identifier: "zh_Hans")
            formatter.dateFormat = "M月d日"
        case .english, .vietnamese, .tagalog:
            formatter.locale = Locale(identifier: "en_US")
            formatter.dateFormat = "MMM d"
        }

        let today = SNAPSubmissionTimelineStrings.todayLabel.value(in: language)
        let withinSeven = SNAPSubmissionTimelineStrings.windowSevenDays.value(in: language)
        let withinThirty = SNAPSubmissionTimelineStrings.windowThirtyDays.value(in: language)
        let firstDeposit = SNAPSubmissionTimelineStrings.windowFirstDeposit.value(in: language)

        return [
            Station(
                id: "submitted",
                when: "\(today) · \(formatter.string(from: submittedAt))",
                title: SNAPSubmissionTimelineStrings.stationSubmittedTitle.value(in: language),
                body: SNAPSubmissionTimelineStrings.stationSubmittedBody(stateCode: stateCode, language: language),
                state: .done
            ),
            Station(
                id: "agency_review",
                when: withinSeven,
                title: SNAPSubmissionTimelineStrings.stationReviewTitle.value(in: language),
                body: SNAPSubmissionTimelineStrings.stationReviewBody(stateCode: stateCode, language: language),
                state: .now
            ),
            Station(
                id: "decision_letter",
                when: withinThirty,
                title: SNAPSubmissionTimelineStrings.stationDecisionTitle.value(in: language),
                body: SNAPSubmissionTimelineStrings.stationDecisionBody(stateCode: stateCode, language: language),
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
        return template.replacingOccurrences(of: "%@", with: supportPhone)
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
        es: "Envío · qué pasa ahora",
        zh: "已提交 · 接下来会发生什么",
        vi: "Đã gửi · điều gì xảy ra tiếp theo",
        tl: "Naipasa na · ano ang susunod"
    )
    static let headline = CivicaText(
        "Your SNAP application is in. Here's what we expect to happen, by when.",
        es: "Tu solicitud de SNAP fue enviada. Esto es lo que esperamos que pase, y cuándo.",
        zh: "你的 SNAP 申请已经提交。以下是我们预计接下来会发生的事，以及大概的时间。",
        vi: "Đơn xin SNAP của bạn đã được gửi. Đây là những gì chúng tôi dự kiến sẽ xảy ra, và khi nào.",
        tl: "Naipasa na ang iyong SNAP application. Ito ang inaasahan naming mangyayari, at kung kailan."
    )
    static func subhead(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        switch language {
        case .english:
            return "\(agency) owns the next steps. We'll text you the moment anything changes."
        case .spanish:
            return "\(agency) maneja los próximos pasos. Te enviaremos un mensaje cuando algo cambie."
        case .mandarin:
            return "接下来的步骤由 \(agency) 负责。一有任何变化，我们会立刻发短信告诉你。"
        case .vietnamese:
            return "\(agency) phụ trách các bước tiếp theo. Chúng tôi sẽ nhắn tin cho bạn ngay khi có bất kỳ thay đổi nào."
        case .tagalog:
            return "\(agency) ang humahawak sa mga susunod na hakbang. Mag-te-text kami sa iyo agad kapag may nagbago."
        }
    }

    // MARK: - Station window labels

    static let todayLabel = CivicaText(
        "Today",
        es: "Hoy",
        zh: "今天",
        vi: "Hôm nay",
        tl: "Ngayon"
    )
    static let windowSevenDays = CivicaText(
        "Within 7 days",
        es: "Dentro de 7 días",
        zh: "7 天内",
        vi: "Trong vòng 7 ngày",
        tl: "Sa loob ng 7 araw"
    )
    static let windowThirtyDays = CivicaText(
        "Within 30 days",
        es: "Dentro de 30 días",
        zh: "30 天内",
        vi: "Trong vòng 30 ngày",
        tl: "Sa loob ng 30 araw"
    )
    static let windowFirstDeposit = CivicaText(
        "Day 1 of EBT",
        es: "Día 1 de EBT",
        zh: "EBT 第 1 天",
        vi: "Ngày 1 của EBT",
        tl: "Araw 1 ng EBT"
    )

    // MARK: - Stations

    static let stationSubmittedTitle = CivicaText(
        "Submitted",
        es: "Enviada",
        zh: "已提交",
        vi: "Đã gửi",
        tl: "Naipasa na"
    )
    static func stationSubmittedBody(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalURL = SNAPAgencyDirectory.portalShortURL(for: stateCode)
        let portalRef = portal.isEmpty ? "the state portal" : "\(portal) (\(portalURL))"
        let portalRefES = portal.isEmpty ? "el portal estatal" : "\(portal) (\(portalURL))"
        let portalRefZH = portal.isEmpty ? "州政府门户网站" : "\(portal)（\(portalURL)）"
        let portalRefVI = portal.isEmpty ? "cổng thông tin tiểu bang" : "\(portal) (\(portalURL))"
        switch language {
        case .english:
            return "Sent to \(agency) through \(portalRef). You should also see it listed under \"My Applications\" in your \(portal.isEmpty ? "portal" : portal) account."
        case .spanish:
            return "Enviada a \(agency) a través de \(portalRefES). También debes verla en \"Mis Solicitudes\" de tu cuenta de \(portal.isEmpty ? "portal" : portal)."
        case .mandarin:
            return "已通过 \(portalRefZH) 发送给 \(agency)。你也应该能在 \(portal.isEmpty ? "门户网站" : portal) 账户的「我的申请」里看到这份记录。"
        case .vietnamese:
            return "Đã gửi đến \(agency) qua \(portalRefVI). Bạn cũng sẽ thấy đơn này trong mục \u{201C}Đơn của tôi\u{201D} trên tài khoản \(portal.isEmpty ? "cổng thông tin" : portal) của bạn."
        case .tagalog:
            return "Naipadala sa \(agency) sa pamamagitan ng \(portalRef). Makikita mo rin ito sa \u{201C}My Applications\u{201D} sa iyong \(portal.isEmpty ? "portal" : portal) account."
        }
    }
    static let stationReviewTitle = CivicaText(
        "Agency review",
        es: "Revisión de la agencia",
        zh: "机构审核",
        vi: "Cơ quan xét duyệt",
        tl: "Pagsusuri ng ahensya"
    )
    static func stationReviewBody(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyShortName(for: stateCode, language: language)
        let codes = SNAPAgencyDirectory.caseworkerAreaCodesInline(for: stateCode, language: language)
        let codesPhrase: String
        if !codes.isEmpty {
            codesPhrase = language == .english
                ? " Their numbers usually start with \(codes)."
                : " Sus números empiezan con \(codes)."
        } else {
            codesPhrase = ""
        }
        let codesPhraseZH: String
        if !codes.isEmpty {
            codesPhraseZH = "他们的电话号码通常以 \(codes) 开头。"
        } else {
            codesPhraseZH = ""
        }
        let codesPhraseVI: String
        if !codes.isEmpty {
            codesPhraseVI = " Số điện thoại của họ thường bắt đầu bằng \(codes)."
        } else {
            codesPhraseVI = ""
        }
        let codesPhraseTL: String
        if !codes.isEmpty {
            codesPhraseTL = " Karaniwang nagsisimula sa \(codes) ang kanilang mga numero."
        } else {
            codesPhraseTL = ""
        }
        switch language {
        case .english:
            return "A \(agency) caseworker reads your application and may call to confirm details.\(codesPhrase) We'll never ask you for payment."
        case .spanish:
            return "Un asesor de \(agency) lee tu solicitud y puede llamarte para confirmar detalles.\(codesPhrase) Nunca te pediremos pago."
        case .mandarin:
            return "\(agency) 的工作人员会查看你的申请，可能会打电话来核对细节。\(codesPhraseZH)我们绝不会向你收费。"
        case .vietnamese:
            return "Một nhân viên phụ trách hồ sơ của \(agency) sẽ đọc đơn của bạn và có thể gọi điện để xác nhận thông tin.\(codesPhraseVI) Chúng tôi sẽ không bao giờ yêu cầu bạn trả tiền."
        case .tagalog:
            return "Babasahin ng caseworker ng \(agency) ang iyong application at maaaring tumawag para kumpirmahin ang mga detalye.\(codesPhraseTL) Hindi ka namin kailanman hihingan ng bayad."
        }
    }
    static let stationDecisionTitle = CivicaText(
        "Decision letter",
        es: "Carta de decisión",
        zh: "决定信",
        vi: "Thư quyết định",
        tl: "Sulat ng desisyon"
    )
    static func stationDecisionBody(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyShortName(for: stateCode, language: language)
        switch language {
        case .english:
            return "\(agency) sends a letter by mail and we'll text you. If approved, an EBT card is mailed within 5 business days."
        case .spanish:
            return "\(agency) envía una carta por correo y te enviaremos un mensaje. Si te aprueban, la tarjeta EBT llega por correo dentro de 5 días hábiles."
        case .mandarin:
            return "\(agency) 会寄一封信给你，我们也会发短信通知你。如果获批，EBT 卡会在 5 个工作日内寄出。"
        case .vietnamese:
            return "\(agency) sẽ gửi một lá thư qua đường bưu điện và chúng tôi sẽ nhắn tin cho bạn. Nếu được chấp thuận, thẻ EBT sẽ được gửi qua bưu điện trong vòng 5 ngày làm việc."
        case .tagalog:
            return "Magpapadala ang \(agency) ng sulat sa koreo at mag-te-text kami sa iyo. Kapag naaprubahan, ipapadala sa koreo ang EBT card sa loob ng 5 business days."
        }
    }
    static let stationDepositTitle = CivicaText(
        "First deposit",
        es: "Primer depósito",
        zh: "第一次入账",
        vi: "Lần nạp đầu tiên",
        tl: "Unang deposito"
    )
    static let stationDepositBody = CivicaText(
        "Your monthly amount lands the day your case is approved. After that, the same date each month.",
        es: "Tu cantidad mensual llega el día que tu caso es aprobado. Después, la misma fecha cada mes.",
        zh: "你的每月金额会在案件获批当天到账。之后，每个月的同一天入账。",
        vi: "Số tiền hằng tháng của bạn sẽ vào tài khoản ngay trong ngày hồ sơ được chấp thuận. Sau đó, cùng một ngày mỗi tháng.",
        tl: "Darating ang iyong buwanang halaga sa araw na maaprubahan ang iyong kaso. Pagkatapos noon, parehong petsa bawat buwan."
    )

    // MARK: - Footer cards

    static let whileWaitLabel = CivicaText(
        "While you wait",
        es: "Mientras esperas",
        zh: "等待期间",
        vi: "Trong khi bạn chờ",
        tl: "Habang naghihintay ka"
    )
    static let whileWaitBody = CivicaText(
        "You may also qualify for WIC — extra food vouchers for kids under 5. Want us to point you at the state's page?",
        es: "También podrías calificar para WIC — vales adicionales para niños menores de 5. ¿Quieres que te llevemos a la página del estado?",
        zh: "你可能也符合 WIC 的资格 —— 为 5 岁以下小孩提供的额外食物券。要我们带你去州政府的页面看看吗？",
        vi: "Bạn cũng có thể đủ điều kiện nhận WIC — phiếu thực phẩm bổ sung cho trẻ dưới 5 tuổi. Bạn có muốn chúng tôi chỉ cho bạn trang của tiểu bang không?",
        tl: "Maaari ka ring maging kwalipikado para sa WIC — dagdag na food vouchers para sa mga batang wala pang 5 taong gulang. Gusto mo bang ituro namin sa iyo ang page ng estado?"
    )
    static let whileWaitCTA = CivicaText(
        "See what WIC covers →",
        es: "Ver lo que cubre WIC →",
        zh: "看看 WIC 包含什么 →",
        vi: "Xem WIC bao gồm những gì →",
        tl: "Tingnan kung ano ang saklaw ng WIC →"
    )

    static let somethingWrongLabel = CivicaText(
        "If something goes wrong",
        es: "Si algo sale mal",
        zh: "如果出了问题",
        vi: "Nếu có gì đó không ổn",
        tl: "Kung may mali"
    )
    /// Body interpolates the support phone (e.g. "(617) 555-0142").
    /// Use `String(format:)`-style %@ placeholder so the localized
    /// template stays in this enum.
    static let somethingWrongBody = CivicaText(
        "Text us at %@ with your case info. A real person responds within one business day.",
        es: "Envíanos un mensaje al %@ con la información de tu caso. Una persona real responde dentro de un día hábil.",
        zh: "发短信到 %@，告诉我们你的案件信息。会有真人在一个工作日内回复你。",
        vi: "Nhắn tin cho chúng tôi theo số %@ kèm thông tin hồ sơ của bạn. Một người thật sẽ trả lời trong vòng một ngày làm việc.",
        tl: "I-text mo kami sa %@ kasama ang impormasyon ng iyong kaso. May totoong tao na sasagot sa loob ng isang business day."
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
