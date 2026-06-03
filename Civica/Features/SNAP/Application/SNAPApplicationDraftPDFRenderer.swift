import PDFKit
import UIKit

// Local PDF renderer for SNAPApplicationDraft. Produces a readable
// "Civica SNAP Application Summary" PDF entirely on-device — no
// backend round-trip required.
//
// This is the v1 deliverable from the orchestrator's "Generate my
// application packet" CTA. It's not the official MA DTA SNAP-1 form
// (that requires a real PDF template + AcroForm fill, which lives
// in the backend at backend/civic_api/snap/application/pdf.py).
// What this renderer produces is the user's answers as a readable
// document they can:
//
//   • Save to Files / iCloud Drive
//   • AirDrop / email to a SNAP navigator
//   • Print and hand to a caseworker
//   • Use as a reference when filling out DTA Connect
//
// The official form-fill remains a backend job — wire it in by
// pointing the orchestrator at the backend's application/pdf endpoint
// once the HTTP layer ships. This renderer keeps the v1 path working
// without that dependency.
//
// Layout: Letter (8.5 × 11 in = 612 × 792 pt) with 50-pt margins.
// Single column. Page breaks when content would overflow. Header
// on each page, footer with rules-version stamp + disclosure.

enum SNAPApplicationDraftPDFRenderer {

    enum RenderError: Error {
        case writeFailed
    }

    /// Render the draft to a PDF written under the app's temporary
    /// directory. Returns the URL for the share sheet. Caller is
    /// responsible for not retaining the URL across launches — the
    /// system reaps temp files on its own schedule.
    static func render(
        _ draft: SNAPApplicationDraft,
        language: CivicaLanguage = .english,
        today: Date = Date()
    ) throws -> URL {
        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: pdfFormat())

        let filename = "civica-snap-summary-\(UUID().uuidString.prefix(8)).pdf"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)

        do {
            try renderer.writePDF(to: url) { context in
                var cursor = RenderCursor(pageRect: pageRect, context: context)
                cursor.beginPage()
                cursor.drawHeader(language: language, today: today)
                cursor.drawVerticalSpace(20)

                cursor.drawSection(
                    title: SNAPReviewDraftStrings.sectionTitle(.whereApplying, language: language),
                    rows: whereApplyingRows(draft.whereApplying, language: language)
                )
                cursor.drawSection(
                    title: SNAPReviewDraftStrings.sectionTitle(.applicantAge, language: language),
                    rows: applicantAgeRows(draft.applicantAge, language: language)
                )
                cursor.drawSection(
                    title: SNAPReviewDraftStrings.sectionTitle(.household, language: language),
                    rows: householdRows(draft.household, language: language)
                )
                cursor.drawSection(
                    title: SNAPReviewDraftStrings.sectionTitle(.contact, language: language),
                    rows: contactRows(draft.contact, language: language)
                )
                cursor.drawSection(
                    title: SNAPReviewDraftStrings.sectionTitle(.income, language: language),
                    rows: incomeRows(draft.income, language: language)
                )
                cursor.drawSection(
                    title: SNAPReviewDraftStrings.sectionTitle(.studentStatus, language: language),
                    rows: studentStatusRows(draft.studentStatus, language: language)
                )
                cursor.drawSection(
                    title: SNAPReviewDraftStrings.sectionTitle(.expenses, language: language),
                    rows: expensesRows(draft.expenses, language: language)
                )
                cursor.drawSection(
                    title: SNAPReviewDraftStrings.sectionTitle(.documentsChecklist, language: language),
                    rows: documentsRows(draft.documentsChecklist, language: language)
                )

                cursor.drawFooter(language: language, stateCode: draft.whereApplying.stateCode)
            }
        } catch {
            throw RenderError.writeFailed
        }

        return url
    }

    private static func pdfFormat() -> UIGraphicsPDFRendererFormat {
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = [
            kCGPDFContextTitle as String: "Civica SNAP Application Summary",
            kCGPDFContextCreator as String: "Civica",
            kCGPDFContextSubject as String: "Personal SNAP application draft — reference document"
        ]
        return format
    }

    // MARK: - Per-section row projections

    private static func whereApplyingRows(_ answers: SNAPWhereApplyingAnswers, language: CivicaLanguage) -> [Row] {
        var rows: [Row] = []
        if let code = answers.stateCode {
            rows.append(.init(label: SNAPReviewDraftStrings.rowState.value(in: language), value: code))
        }
        if let housing = answers.housingStatus {
            rows.append(.init(
                label: SNAPReviewDraftStrings.rowHousing.value(in: language),
                value: SNAPWhereApplyingStrings.housingLabel(for: housing, language: language)
            ))
        }
        return rows
    }

    private static func applicantAgeRows(_ answers: SNAPApplicantAgeAnswers, language: CivicaLanguage) -> [Row] {
        guard let age = answers.derivedAge else { return [] }
        return [.init(label: SNAPReviewDraftStrings.rowAge.value(in: language), value: "\(age)")]
    }

    private static func householdRows(_ answers: SNAPHouseholdAnswers, language: CivicaLanguage) -> [Row] {
        var rows: [Row] = []
        if let size = answers.householdSize {
            rows.append(.init(label: SNAPReviewDraftStrings.rowHouseholdSize.value(in: language), value: size))
        }
        if let m = answers.hasMinorInHousehold {
            rows.append(.init(label: SNAPReviewDraftStrings.rowMinors.value(in: language), value: yesNo(m, language: language)))
        }
        if let e = answers.hasElderlyOrDisabled {
            rows.append(.init(label: SNAPReviewDraftStrings.rowElderlyOrDisabled.value(in: language), value: yesNo(e, language: language)))
        }
        return rows
    }

    private static func contactRows(_ answers: SNAPContactAnswers, language: CivicaLanguage) -> [Row] {
        var rows: [Row] = []
        if let email = answers.email { rows.append(.init(label: SNAPReviewDraftStrings.rowEmail.value(in: language), value: email)) }
        if let phone = answers.phone { rows.append(.init(label: SNAPReviewDraftStrings.rowPhone.value(in: language), value: phone)) }
        if let method = answers.preferredMethod {
            rows.append(.init(
                label: SNAPReviewDraftStrings.rowPreferred.value(in: language),
                value: SNAPContactStrings.methodLabel(for: method, language: language)
            ))
        }
        return rows
    }

    private static func incomeRows(_ answers: SNAPIncomeAnswers, language: CivicaLanguage) -> [Row] {
        var rows: [Row] = []
        if let e = answers.anyoneEarning {
            rows.append(.init(label: SNAPReviewDraftStrings.rowEarning.value(in: language), value: SNAPIncomeStrings.triLabel(for: e, language: language)))
        }
        if let g = answers.grossMonthlyIncome {
            rows.append(.init(label: SNAPReviewDraftStrings.rowGrossIncome.value(in: language), value: "$\(NSDecimalNumber(decimal: g).stringValue)/mo"))
        }
        if let v = answers.incomeChangesMonthToMonth {
            rows.append(.init(label: SNAPReviewDraftStrings.rowVariability.value(in: language), value: SNAPIncomeStrings.triLabel(for: v, language: language)))
        }
        if let u = answers.hasUnearnedIncome {
            rows.append(.init(label: SNAPReviewDraftStrings.rowUnearned.value(in: language), value: SNAPIncomeStrings.triLabel(for: u, language: language)))
        }
        return rows
    }

    private static func studentStatusRows(_ answers: SNAPStudentStatusAnswers, language: CivicaLanguage) -> [Row] {
        var rows: [Row] = []
        if let e = answers.enrolledInHigherEd {
            rows.append(.init(label: SNAPReviewDraftStrings.rowEnrolled.value(in: language), value: yesNo(e, language: language)))
        }
        if answers.enrolledInHigherEd == true {
            let exceptions = [
                answers.works20PlusHours == true ? "20+ hr/wk" : nil,
                answers.inWorkStudy == true ? "work-study" : nil,
                answers.responsibleForDependentChild == true ? "dependent child" : nil,
                answers.inApprovedJobProgram == true ? "job-training program" : nil
            ].compactMap { $0 }
            if !exceptions.isEmpty {
                rows.append(.init(
                    label: SNAPReviewDraftStrings.rowStudentExceptions.value(in: language),
                    value: exceptions.joined(separator: ", ")
                ))
            }
        }
        return rows
    }

    private static func expensesRows(_ answers: SNAPExpensesAnswers, language: CivicaLanguage) -> [Row] {
        func render(_ value: Decimal?) -> String? {
            guard let value else { return nil }
            return "$\(NSDecimalNumber(decimal: value).stringValue)/mo"
        }
        var rows: [Row] = []
        if let v = render(answers.monthlyRentOrHousing) { rows.append(.init(label: SNAPReviewDraftStrings.rowRent.value(in: language), value: v)) }
        if let v = render(answers.monthlyUtilities) { rows.append(.init(label: SNAPReviewDraftStrings.rowUtilities.value(in: language), value: v)) }
        if let v = render(answers.monthlyChildcare) { rows.append(.init(label: SNAPReviewDraftStrings.rowChildcare.value(in: language), value: v)) }
        if let v = render(answers.monthlyMedical) { rows.append(.init(label: SNAPReviewDraftStrings.rowMedical.value(in: language), value: v)) }
        return rows
    }

    private static func documentsRows(_ answers: SNAPDocumentsChecklistAnswers, language: CivicaLanguage) -> [Row] {
        guard !answers.documentsAvailable.isEmpty else { return [] }
        let names = answers.documentsAvailable
            .map { SNAPDocumentsChecklistStrings.label(for: $0, language: language) }
            .sorted()
        return [.init(
            label: SNAPReviewDraftStrings.rowDocumentsCount.value(in: language),
            value: names.joined(separator: " · ")
        )]
    }

    private static func yesNo(_ value: Bool, language: CivicaLanguage) -> String {
        value
            ? CivicaQuestionStrings.yesLabel.value(in: language)
            : CivicaQuestionStrings.noLabel.value(in: language)
    }

    // MARK: - Row + cursor helpers

    struct Row { let label: String; let value: String }
}

// MARK: - RenderCursor

/// Internal layout helper — tracks the current Y position on the
/// page, handles page breaks when content overflows, and draws each
/// block of text in the right Civica style. Lives outside the
/// renderer enum so we can pass it by inout to the drawing helpers.
private struct RenderCursor {
    let pageRect: CGRect
    let context: UIGraphicsPDFRendererContext

    private let margin: CGFloat = 50
    private let footerReserve: CGFloat = 70  // vertical room kept for the page footer

    private var y: CGFloat = 0

    init(pageRect: CGRect, context: UIGraphicsPDFRendererContext) {
        self.pageRect = pageRect
        self.context = context
    }

    private var contentWidth: CGFloat { pageRect.width - margin * 2 }
    private var bottomLimit: CGFloat { pageRect.height - footerReserve }

    mutating func beginPage() {
        context.beginPage()
        y = margin
    }

    mutating func drawVerticalSpace(_ amount: CGFloat) {
        y += amount
        breakIfNeeded()
    }

    mutating func drawHeader(language: CivicaLanguage, today: Date) {
        let title = SNAPPacketPDFStrings.title.value(in: language)
        drawText(title, at: y, font: .systemFont(ofSize: 18, weight: .semibold), color: .black)
        y += 24

        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.locale = language == .spanish
            ? Locale(identifier: "es")
            : Locale(identifier: "en_US")
        let subtitle = SNAPPacketPDFStrings.subtitle(formattedDate: formatter.string(from: today), language: language)
        drawText(subtitle, at: y, font: .systemFont(ofSize: 11, weight: .regular), color: .darkGray)
        y += 18

        // Brick rule under the header
        let rect = CGRect(x: margin, y: y, width: contentWidth, height: 2)
        UIColor(red: 0x9C/255, green: 0x3A/255, blue: 0x24/255, alpha: 1).setFill()
        UIRectFill(rect)
        y += 8
    }

    mutating func drawSection(title: String, rows: [SNAPApplicationDraftPDFRenderer.Row]) {
        guard !rows.isEmpty else { return }
        breakIfNeeded(headerHeight: 30)

        drawText(title, at: y, font: .systemFont(ofSize: 13, weight: .semibold), color: .black)
        y += 18

        for row in rows {
            breakIfNeeded(headerHeight: 18)
            drawText(row.label, at: y, font: .systemFont(ofSize: 11, weight: .regular), color: .darkGray)
            drawText(
                row.value,
                at: y,
                font: .systemFont(ofSize: 11, weight: .regular),
                color: .black,
                rightAligned: true
            )
            y += 16
        }
        y += 6
    }

    mutating func drawFooter(language: CivicaLanguage, stateCode: String?) {
        let footerY = pageRect.height - footerReserve + 10
        let rulesLine = SNAPPacketPDFStrings.rulesLine(stateCode: stateCode, language: language)
        let disclosure = SNAPPacketPDFStrings.disclosure(stateCode: stateCode, language: language)

        drawText(rulesLine, at: footerY, font: .systemFont(ofSize: 8, weight: .regular), color: .gray)
        drawText(
            disclosure,
            at: footerY + 12,
            font: .systemFont(ofSize: 8, weight: .regular),
            color: .gray,
            width: contentWidth
        )
    }

    // MARK: - Internal drawing

    private mutating func breakIfNeeded(headerHeight: CGFloat = 0) {
        if y + headerHeight > bottomLimit {
            beginPage()
        }
    }

    private func drawText(
        _ text: String,
        at y: CGFloat,
        font: UIFont,
        color: UIColor,
        rightAligned: Bool = false,
        width: CGFloat? = nil
    ) {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color
        ]
        let drawWidth = width ?? contentWidth
        let rect: CGRect
        if rightAligned {
            let textWidth = NSString(string: text).size(withAttributes: attributes).width
            rect = CGRect(
                x: pageRect.width - margin - textWidth,
                y: y,
                width: textWidth,
                height: font.lineHeight + 4
            )
        } else {
            rect = CGRect(x: margin, y: y, width: drawWidth, height: font.lineHeight * 3)
        }
        NSString(string: text).draw(in: rect, withAttributes: attributes)
    }
}

// MARK: - Strings

enum SNAPPacketPDFStrings {
    static let title = CivicaText(
        "Civica SNAP Application Summary",
        es: "Resumen de tu solicitud de SNAP — Civica",
        zh: "Civica SNAP 申请摘要"
    )

    static func subtitle(formattedDate: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog: return "Prepared on \(formattedDate)"
        case .mandarin: return "制作于 \(formattedDate)"
        case .spanish: return "Preparado el \(formattedDate)"
        }
    }

    // State-conditioned: portal name/URL and agency short name come from
    // SNAPAgencyDirectory (the single source) rather than hardcoding MA's
    // DTA Connect / dtaconnect.eohhs.mass.gov, which was wrong for CA
    // applicants. Falls back to generic copy when the state is untuned.
    static func disclosure(stateCode: String?, language: CivicaLanguage) -> String {
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let host = SNAPAgencyDirectory.portalShortURL(for: stateCode)
        let agency = SNAPAgencyDirectory.agencyShortName(for: stateCode, language: language)
        let portalRef: String
        if portal.isEmpty {
            switch language {
            case .english, .vietnamese, .tagalog: portalRef = "your state SNAP portal"
            case .mandarin: portalRef = "你所在州的 SNAP 网站"
            case .spanish: portalRef = "el portal de SNAP de tu estado"
            }
        } else {
            portalRef = host.isEmpty ? portal : "\(portal) (\(host))"
        }
        switch language {
        case .english, .vietnamese, .tagalog:
            return "This is a personal reference document prepared from your answers in Civica. It is NOT an official application. Submit your real application via \(portalRef) or in person at a \(agency) office."
        case .mandarin:
            return "这是根据你在 Civica 中填写的回答整理的个人参考文件。这不是正式申请。请通过 \(portalRef) 或亲自前往 \(agency) 办公室提交你的正式申请。"
        case .spanish:
            return "Este es un documento personal de referencia preparado a partir de tus respuestas en Civica. NO es una solicitud oficial. Envía tu solicitud real a través de \(portalRef) o en persona en una oficina de \(agency)."
        }
    }

    static func rulesLine(stateCode: String?, language: CivicaLanguage) -> String {
        // BBCE gross-income limit is state-set; name the selected state
        // instead of hardcoding "MA". Falls back to the launch state (CA)
        // when no state was captured. CA and MA both use 200% FPL.
        let normalized = (stateCode ?? "").trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let state = normalized.isEmpty ? SNAPAgencyDirectory.launchStateCode : normalized
        switch language {
        case .english, .vietnamese, .tagalog: return "Civica · local v1 · FY26 federal poverty guidelines · \(state) BBCE 200%"
        case .mandarin: return "Civica · 本地 v1 · FY26 联邦贫困线 · \(state) BBCE 200%"
        case .spanish: return "Civica · v1 local · pautas federales de pobreza AF26 · \(state) BBCE 200%"
        }
    }
}
