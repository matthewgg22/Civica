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
        es: "Carta de apelación para audiencia justa de SNAP"
    )
    static let documentSubject = CivicaText(
        "Civica-generated SNAP fair-hearing request template",
        es: "Plantilla de solicitud de audiencia justa de SNAP generada por Civica"
    )

    static func recipientLines(language: CivicaLanguage, stateCode: String) -> [String] {
        SNAPAgencyDirectory.hearingOfficeLines(for: stateCode, language: language)
    }

    static let subjectLine = CivicaText(
        "Re: Request for Fair Hearing — SNAP Application Denial",
        es: "Asunto: Solicitud de audiencia justa — Denegación de solicitud de SNAP"
    )

    static func salutation(language: CivicaLanguage, stateCode: String) -> String {
        let officeName: String
        switch stateCode.uppercased() {
        case "CA":
            officeName = language == .english
                ? "Dear State Hearings Division,"
                : "Estimada División de Audiencias del Estado,"
        case "MA":
            officeName = language == .english
                ? "Dear DTA Hearing Office,"
                : "Estimada Oficina de Audiencias del DTA,"
        default:
            officeName = language == .english
                ? "Dear State SNAP Hearing Office,"
                : "Estimada Oficina Estatal de Audiencias de SNAP,"
        }
        return officeName
    }

    static func bodyParagraphs(language: CivicaLanguage) -> [String] {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog:
            return [
                "I am requesting a fair hearing to appeal the denial of my SNAP (Supplemental Nutrition Assistance Program) application. I am submitting this request within the 90-day window allowed under 7 CFR 273.15.",
                "I believe the denial decision should be reconsidered. I would like the opportunity to present my case and any supporting information at the hearing."
            ]
        case .spanish:
            return [
                "Solicito una audiencia justa para apelar la denegación de mi solicitud de SNAP (Programa de Asistencia Nutricional Suplementaria). Estoy presentando esta solicitud dentro del período de 90 días permitido bajo 7 CFR 273.15.",
                "Considero que la decisión de denegación debe ser reconsiderada. Me gustaría tener la oportunidad de presentar mi caso y la información de apoyo en la audiencia."
            ]
        }
    }

    static func fillInLines(language: CivicaLanguage) -> [String] {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog:
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
        }
    }

    static func hearingPreferenceLines(language: CivicaLanguage) -> [String] {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog:
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
        }
    }

    static let continuedBenefitsParagraph = CivicaText(
        "If applicable, I am also requesting that my SNAP benefits continue pending the hearing decision.",
        es: "Si aplica, también solicito que mis beneficios de SNAP continúen mientras se decide la audiencia."
    )

    static let closing = CivicaText("Sincerely,", es: "Atentamente,")
    static let signatureLabel = CivicaText("Signature", es: "Firma")
    static let dateLabel = CivicaText("Date", es: "Fecha")

    static func footerDisclosure(language: CivicaLanguage, stateCode: String, today: String) -> String {
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalURL = SNAPAgencyDirectory.portalShortURL(for: stateCode)
        let portalSuffix: String
        if !portal.isEmpty {
            portalSuffix = language == .english
                ? ", or submit through \(portal) (\(portalURL))"
                : ", o envíalo a través de \(portal) (\(portalURL))"
        } else {
            portalSuffix = ""
        }
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog:
            return "Prepared with Civica on \(today). This is a personal reference document — sign and date by hand before mailing to the hearing office above\(portalSuffix)."
        case .spanish:
            return "Preparado con Civica el \(today). Este es un documento personal de referencia — firma y fecha a mano antes de enviar por correo a la oficina de audiencias arriba\(portalSuffix)."
        }
    }
}
