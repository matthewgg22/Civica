import PDFKit
import UIKit

// Generates a state-appropriate SNAP fair-hearing appeal letter as
// a printable PDF the user can save, sign by hand, and mail to
// their state hearing office. Federal SNAP guarantees the right
// to a fair hearing within 90 days of the denial notice
// (7 CFR 273.15) — this template names that right explicitly so
// the receiving hearing office can route the request.
//
// Unlike the application-summary packet, this letter is NOT
// driven by the SNAPApplicationDraft. We don't collect the user's
// legal name, mailing address, or case number in the orchestrator
// — they're filled in by hand on the printed letter before
// mailing. Field placeholders (underscores) leave room.
//
// State is supplied at render time so the recipient block, footer,
// and salutation match the user's active state. Defaults to the
// launch state (see SNAPAgencyDirectory.launchStateCode) when the
// caller has no state in scope.

enum SNAPAppealLetterPDFRenderer {

    enum RenderError: Error {
        case writeFailed
    }

    /// Render the appeal letter PDF in the active language. Caller
    /// owns the returned URL (writes to FileManager.temporaryDirectory;
    /// system reaps on its own schedule). `stateCode` is a 2-letter
    /// USPS code (CA, MA, …); nil falls back to the launch state.
    static func render(
        language: CivicaLanguage = .english,
        stateCode: String? = nil,
        today: Date = Date()
    ) throws -> URL {
        let effectiveState = stateCode ?? SNAPAgencyDirectory.launchStateCode
        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: pdfFormat(language: language))

        let filename = "civica-snap-appeal-\(UUID().uuidString.prefix(8)).pdf"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)

        do {
            try renderer.writePDF(to: url) { context in
                var y: CGFloat = 72  // 1-inch top margin
                context.beginPage()

                let strings = SNAPAppealLetterStrings.self
                let dateFormatter = DateFormatter()
                dateFormatter.dateStyle = .long
                dateFormatter.locale = language == .spanish
                    ? Locale(identifier: "es") : Locale(identifier: "en_US")

                // Date in top-right
                y = drawTopRightText(
                    dateFormatter.string(from: today),
                    pageRect: pageRect,
                    yStart: y,
                    font: .systemFont(ofSize: 11, weight: .regular)
                )
                y += 28

                // Recipient address block (left)
                y = drawLeftBlock(
                    lines: strings.recipientLines(language: language, stateCode: effectiveState),
                    pageRect: pageRect,
                    yStart: y,
                    font: .systemFont(ofSize: 11, weight: .regular)
                )
                y += 28

                // Subject line — semibold
                y = drawLeftBlock(
                    lines: [strings.subjectLine.value(in: language)],
                    pageRect: pageRect,
                    yStart: y,
                    font: .systemFont(ofSize: 11, weight: .semibold)
                )
                y += 20

                // Salutation
                y = drawLeftBlock(
                    lines: [strings.salutation(language: language, stateCode: effectiveState)],
                    pageRect: pageRect,
                    yStart: y,
                    font: .systemFont(ofSize: 11, weight: .regular)
                )
                y += 14

                // Body paragraphs
                for paragraph in strings.bodyParagraphs(language: language) {
                    y = drawWrappedText(
                        paragraph,
                        pageRect: pageRect,
                        yStart: y,
                        font: .systemFont(ofSize: 11, weight: .regular),
                        leading: 4
                    )
                    y += 14
                }

                // Fill-in info block
                y += 6
                y = drawLeftBlock(
                    lines: strings.fillInLines(language: language),
                    pageRect: pageRect,
                    yStart: y,
                    font: .systemFont(ofSize: 11, weight: .regular),
                    leading: 4
                )
                y += 18

                // Hearing-type checkboxes
                y = drawLeftBlock(
                    lines: strings.hearingPreferenceLines(language: language),
                    pageRect: pageRect,
                    yStart: y,
                    font: .systemFont(ofSize: 11, weight: .regular),
                    leading: 4
                )
                y += 18

                // Continued-benefits paragraph
                y = drawWrappedText(
                    strings.continuedBenefitsParagraph.value(in: language),
                    pageRect: pageRect,
                    yStart: y,
                    font: .systemFont(ofSize: 11, weight: .regular),
                    leading: 4
                )
                y += 28

                // Closing + signature
                y = drawLeftBlock(
                    lines: [
                        strings.closing.value(in: language),
                        "",
                        "_____________________________",
                        strings.signatureLabel.value(in: language),
                        "",
                        "\(strings.dateLabel.value(in: language)): _____________________________"
                    ],
                    pageRect: pageRect,
                    yStart: y,
                    font: .systemFont(ofSize: 11, weight: .regular),
                    leading: 4
                )

                // Footer disclosure
                let footerY = pageRect.height - 60
                drawWrappedText(
                    strings.footerDisclosure(language: language, stateCode: effectiveState, today: dateFormatter.string(from: today)),
                    pageRect: pageRect,
                    yStart: footerY,
                    font: .systemFont(ofSize: 8, weight: .regular),
                    color: .gray,
                    leading: 2
                )
            }
        } catch {
            throw RenderError.writeFailed
        }

        return url
    }

    private static func pdfFormat(language: CivicaLanguage) -> UIGraphicsPDFRendererFormat {
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = [
            kCGPDFContextTitle as String: SNAPAppealLetterStrings.documentTitle.value(in: language),
            kCGPDFContextCreator as String: "Civica",
            kCGPDFContextSubject as String: SNAPAppealLetterStrings.documentSubject.value(in: language)
        ]
        return format
    }

    // MARK: - Layout helpers

    private static let margin: CGFloat = 72

    @discardableResult
    private static func drawLeftBlock(
        lines: [String],
        pageRect: CGRect,
        yStart: CGFloat,
        font: UIFont,
        color: UIColor = .black,
        leading: CGFloat = 2
    ) -> CGFloat {
        var y = yStart
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color]
        for line in lines {
            let rect = CGRect(
                x: margin,
                y: y,
                width: pageRect.width - 2 * margin,
                height: font.lineHeight + 4
            )
            NSString(string: line).draw(in: rect, withAttributes: attrs)
            y += font.lineHeight + leading
        }
        return y
    }

    @discardableResult
    private static func drawTopRightText(
        _ text: String,
        pageRect: CGRect,
        yStart: CGFloat,
        font: UIFont,
        color: UIColor = .black
    ) -> CGFloat {
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color]
        let width = NSString(string: text).size(withAttributes: attrs).width
        let rect = CGRect(
            x: pageRect.width - margin - width,
            y: yStart,
            width: width,
            height: font.lineHeight + 4
        )
        NSString(string: text).draw(in: rect, withAttributes: attrs)
        return yStart + font.lineHeight
    }

    @discardableResult
    private static func drawWrappedText(
        _ text: String,
        pageRect: CGRect,
        yStart: CGFloat,
        font: UIFont,
        color: UIColor = .black,
        leading: CGFloat = 4
    ) -> CGFloat {
        let style = NSMutableParagraphStyle()
        style.lineSpacing = leading
        style.lineBreakMode = .byWordWrapping
        let attrs: [NSAttributedString.Key: Any] = [
            .font: font, .foregroundColor: color, .paragraphStyle: style
        ]
        let width = pageRect.width - 2 * margin
        let constrained = CGSize(width: width, height: .greatestFiniteMagnitude)
        let bounding = NSString(string: text).boundingRect(
            with: constrained,
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: attrs,
            context: nil
        )
        let rect = CGRect(x: margin, y: yStart, width: width, height: ceil(bounding.height) + 4)
        NSString(string: text).draw(in: rect, withAttributes: attrs)
        return yStart + ceil(bounding.height) + leading
    }
}

// MARK: - Letter copy

enum SNAPAppealLetterStrings {

    static let documentTitle = CivicaText(
        "SNAP Fair-Hearing Appeal Letter",
        es: "Carta de apelación para audiencia justa de SNAP",
        zh: "SNAP 公平听证申诉信",
        vi: "Thư kháng nghị điều trần công bằng SNAP",
        tl: "Liham ng Apela para sa Fair Hearing ng SNAP"
    )
    static let documentSubject = CivicaText(
        "Civica-generated SNAP fair-hearing request template",
        es: "Plantilla de solicitud de audiencia justa de SNAP generada por Civica",
        zh: "由 Civica 生成的 SNAP 公平听证申请模板",
        vi: "Mẫu yêu cầu điều trần công bằng SNAP do Civica tạo",
        tl: "Template ng kahilingan para sa fair hearing ng SNAP na ginawa ng Civica"
    )

    static func recipientLines(language: CivicaLanguage, stateCode: String) -> [String] {
        SNAPAgencyDirectory.hearingOfficeLines(for: stateCode, language: language)
    }

    static let subjectLine = CivicaText(
        "Re: Request for Fair Hearing — SNAP Application Denial",
        es: "Asunto: Solicitud de audiencia justa — Denegación de solicitud de SNAP",
        zh: "事由:申请公平听证 — SNAP 申请被拒",
        vi: "V/v: Yêu cầu điều trần công bằng — Đơn xin SNAP bị từ chối",
        tl: "Ukol sa: Kahilingan para sa Fair Hearing — Pagtanggi sa Aplikasyon ng SNAP"
    )

    static func salutation(language: CivicaLanguage, stateCode: String) -> String {
        let officeName: String
        switch stateCode.uppercased() {
        case "CA":
            switch language {
            case .english:
                officeName = "Dear State Hearings Division,"
            case .spanish:
                officeName = "Estimada División de Audiencias del Estado,"
            case .mandarin:
                officeName = "州听证处 您好:"
            case .vietnamese:
                officeName = "Kính gửi Phòng Điều trần Tiểu bang,"
            case .tagalog:
                officeName = "Sa State Hearings Division,"
            }
        case "MA":
            switch language {
            case .english:
                officeName = "Dear DTA Hearing Office,"
            case .spanish:
                officeName = "Estimada Oficina de Audiencias del DTA,"
            case .mandarin:
                officeName = "DTA 听证办公室 您好:"
            case .vietnamese:
                officeName = "Kính gửi Văn phòng Điều trần DTA,"
            case .tagalog:
                officeName = "Sa DTA Hearing Office,"
            }
        default:
            switch language {
            case .english:
                officeName = "Dear State SNAP Hearing Office,"
            case .spanish:
                officeName = "Estimada Oficina Estatal de Audiencias de SNAP,"
            case .mandarin:
                officeName = "州 SNAP 听证办公室 您好:"
            case .vietnamese:
                officeName = "Kính gửi Văn phòng Điều trần SNAP Tiểu bang,"
            case .tagalog:
                officeName = "Sa State SNAP Hearing Office,"
            }
        }
        return officeName
    }

    static func bodyParagraphs(language: CivicaLanguage) -> [String] {
        switch language {
        case .english:
            return [
                "I am requesting a fair hearing to appeal the denial of my SNAP (Supplemental Nutrition Assistance Program) application. I am submitting this request within the 90-day window allowed under 7 CFR 273.15.",
                "I believe the denial decision should be reconsidered. I would like the opportunity to present my case and any supporting information at the hearing."
            ]
        case .spanish:
            return [
                "Solicito una audiencia justa para apelar la denegación de mi solicitud de SNAP (Programa de Asistencia Nutricional Suplementaria). Estoy presentando esta solicitud dentro del período de 90 días permitido bajo 7 CFR 273.15.",
                "Considero que la decisión de denegación debe ser reconsiderada. Me gustaría tener la oportunidad de presentar mi caso y la información de apoyo en la audiencia."
            ]
        case .mandarin:
            return [
                "我申请公平听证,就我的 SNAP(补充营养援助计划)申请被拒一事提出申诉。我在 7 CFR 273.15 允许的 90 天期限内提交此申请。",
                "我认为该拒绝决定应被重新审议。我希望有机会在听证会上陈述我的情况并提交相关证明材料。"
            ]
        case .vietnamese:
            return [
                "Tôi yêu cầu một buổi điều trần công bằng để kháng nghị việc từ chối đơn xin SNAP (Chương trình Hỗ trợ Dinh dưỡng Bổ sung) của tôi. Tôi gửi yêu cầu này trong thời hạn 90 ngày được cho phép theo 7 CFR 273.15.",
                "Tôi tin rằng quyết định từ chối cần được xem xét lại. Tôi mong có cơ hội trình bày trường hợp của mình và cung cấp các thông tin chứng minh tại buổi điều trần."
            ]
        case .tagalog:
            return [
                "Humihiling ako ng fair hearing para iapela ang pagtanggi sa aking aplikasyon sa SNAP (Supplemental Nutrition Assistance Program). Isinusumite ko ang kahilingang ito sa loob ng 90 araw na pinapayagan sa ilalim ng 7 CFR 273.15.",
                "Naniniwala akong dapat muling pag-aralan ang desisyon na pagtanggi. Nais kong magkaroon ng pagkakataon na iharap ang aking kaso at anumang sumusuportang impormasyon sa hearing."
            ]
        }
    }

    static func fillInLines(language: CivicaLanguage) -> [String] {
        switch language {
        case .english:
            return [
                "My information:",
                "    Name:             ________________________________",
                "    Address:          ________________________________",
                "                      ________________________________",
                "    Phone:            ________________________________",
                "    Case number:      ________________________________",
                "    Date of denial:   ________________________________"
            ]
        case .spanish:
            return [
                "Mi información:",
                "    Nombre:           ________________________________",
                "    Dirección:        ________________________________",
                "                      ________________________________",
                "    Teléfono:         ________________________________",
                "    Número de caso:   ________________________________",
                "    Fecha de denegación: ____________________________"
            ]
        case .mandarin:
            return [
                "我的信息:",
                "    姓名:             ________________________________",
                "    地址:             ________________________________",
                "                      ________________________________",
                "    电话:             ________________________________",
                "    案件编号:         ________________________________",
                "    拒绝日期:         ________________________________"
            ]
        case .vietnamese:
            return [
                "Thông tin của tôi:",
                "    Họ và tên:        ________________________________",
                "    Địa chỉ:          ________________________________",
                "                      ________________________________",
                "    Điện thoại:       ________________________________",
                "    Số hồ sơ:         ________________________________",
                "    Ngày từ chối:     ________________________________"
            ]
        case .tagalog:
            return [
                "Ang aking impormasyon:",
                "    Pangalan:         ________________________________",
                "    Tirahan:          ________________________________",
                "                      ________________________________",
                "    Telepono:         ________________________________",
                "    Case number:      ________________________________",
                "    Petsa ng pagtanggi: ______________________________"
            ]
        }
    }

    static func hearingPreferenceLines(language: CivicaLanguage) -> [String] {
        switch language {
        case .english:
            return [
                "I am requesting:",
                "    [ ]  An in-person hearing",
                "    [ ]  A telephone hearing"
            ]
        case .spanish:
            return [
                "Solicito:",
                "    [ ]  Una audiencia en persona",
                "    [ ]  Una audiencia por teléfono"
            ]
        case .mandarin:
            return [
                "我申请:",
                "    [ ]  当面听证",
                "    [ ]  电话听证"
            ]
        case .vietnamese:
            return [
                "Tôi yêu cầu:",
                "    [ ]  Điều trần trực tiếp",
                "    [ ]  Điều trần qua điện thoại"
            ]
        case .tagalog:
            return [
                "Humihiling ako ng:",
                "    [ ]  Personal na hearing",
                "    [ ]  Hearing sa telepono"
            ]
        }
    }

    static let continuedBenefitsParagraph = CivicaText(
        "If applicable, I am also requesting that my SNAP benefits continue pending the hearing decision.",
        es: "Si aplica, también solicito que mis beneficios de SNAP continúen mientras se decide la audiencia.",
        zh: "如适用,我也申请在听证决定作出之前继续发放我的 SNAP 福利。",
        vi: "Nếu phù hợp, tôi cũng yêu cầu tiếp tục nhận trợ cấp SNAP trong khi chờ quyết định điều trần.",
        tl: "Kung naaangkop, hinihiling ko rin na magpatuloy ang aking mga benepisyo sa SNAP habang naghihintay ng desisyon sa hearing."
    )

    static let closing = CivicaText("Sincerely,", es: "Atentamente,", zh: "此致", vi: "Trân trọng,", tl: "Lubos na gumagalang,")
    static let signatureLabel = CivicaText("Signature", es: "Firma", zh: "签名", vi: "Chữ ký", tl: "Lagda")
    static let dateLabel = CivicaText("Date", es: "Fecha", zh: "日期", vi: "Ngày", tl: "Petsa")

    static func footerDisclosure(language: CivicaLanguage, stateCode: String, today: String) -> String {
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalURL = SNAPAgencyDirectory.portalShortURL(for: stateCode)
        let portalSuffix: String
        if !portal.isEmpty {
            switch language {
            case .english:
                portalSuffix = ", or submit through \(portal) (\(portalURL))"
            case .spanish:
                portalSuffix = ", o envíalo a través de \(portal) (\(portalURL))"
            case .mandarin:
                portalSuffix = ",或通过 \(portal)(\(portalURL))提交"
            case .vietnamese:
                portalSuffix = ", hoặc nộp qua \(portal) (\(portalURL))"
            case .tagalog:
                portalSuffix = ", o isumite sa pamamagitan ng \(portal) (\(portalURL))"
            }
        } else {
            portalSuffix = ""
        }
        switch language {
        case .english:
            return "Prepared with Civica on \(today). This is a personal reference document — sign and date by hand before mailing to the hearing office above\(portalSuffix)."
        case .spanish:
            return "Preparado con Civica el \(today). Este es un documento personal de referencia — firma y fecha a mano antes de enviar por correo a la oficina de audiencias arriba\(portalSuffix)."
        case .mandarin:
            return "由 Civica 于 \(today) 准备。这是一份个人参考文件 — 请手写签名和日期,然后邮寄至上方的听证办公室\(portalSuffix)。"
        case .vietnamese:
            return "Soạn bằng Civica vào ngày \(today). Đây là tài liệu tham khảo cá nhân — hãy ký tên và ghi ngày bằng tay trước khi gửi qua bưu điện đến văn phòng điều trần ở trên\(portalSuffix)."
        case .tagalog:
            return "Inihanda gamit ang Civica noong \(today). Ito ay personal na sangguniang dokumento — lagdaan at lagyan ng petsa nang sariling kamay bago ipadala sa hearing office sa itaas\(portalSuffix)."
        }
    }
}
