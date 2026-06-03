import Foundation
import UIKit
import CivicaDesignSystem
import SwiftUI

// Export paths for a finished appeal document:
//   - PDF on disk (temp file, returned as a URL ready for ShareLink)
//   - State-portal deep link (per-state URL)
//   - System share sheet via the export sheet view
//
// The user's last opportunity to review before submitting is the
// system share sheet, which gives them mail / messages / save to
// files / portal-as-URL all in one. We do not auto-submit anywhere.

enum AppealExportService {
    /// Map of two-letter state code → state benefits portal URL.
    /// Used for the "Open state portal" CTA. New states need to be
    /// added here AND in the appeal templates fixture.
    static let statePortals: [String: URL] = [
        "MA": URL(string: "https://dtaconnect.eohhs.mass.gov/")!,
        "CA": URL(string: "https://benefitscal.com/")!
    ]

    /// Render the appeal body to a paginated US-Letter PDF. Writes
    /// the file to a temp URL and returns it.
    ///
    /// Pagination: simple monospaced layout — fits ~52 lines per
    /// page at 11pt with 1in margins. Sufficient for any of the
    /// procedural appeal templates we ship, which top out around
    /// one page of dense paragraphs.
    static func writePDF(body: String, stateCode: String) -> URL? {
        let pageSize = CGSize(width: 612, height: 792) // US Letter @ 72dpi
        let margin: CGFloat = 72
        let contentRect = CGRect(
            x: margin,
            y: margin,
            width: pageSize.width - margin * 2,
            height: pageSize.height - margin * 2
        )

        let format = UIGraphicsPDFRendererFormat()
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: pageSize), format: format)

        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont(name: "Menlo", size: 11) ?? UIFont.systemFont(ofSize: 11),
            .foregroundColor: UIColor.black
        ]
        let attributed = NSAttributedString(string: body, attributes: attributes)

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("recert-appeal-\(stateCode)-\(Int(Date().timeIntervalSince1970)).pdf")

        do {
            try renderer.writePDF(to: url) { context in
                drawAttributedString(attributed, in: contentRect, context: context)
            }
            return url
        } catch {
            return nil
        }
    }

    /// Paginate the attributed string across PDF pages. Reads the
    /// glyph range layout from CoreText and draws each frame until
    /// the entire string has been laid out.
    private static func drawAttributedString(
        _ attributed: NSAttributedString,
        in rect: CGRect,
        context: UIGraphicsPDFRendererContext
    ) {
        let framesetter = CTFramesetterCreateWithAttributedString(attributed)
        var currentRange = CFRange(location: 0, length: 0)
        let totalLength = attributed.length

        while currentRange.location < totalLength {
            context.beginPage()
            let path = CGMutablePath()
            path.addRect(rect)
            let frame = CTFramesetterCreateFrame(framesetter, currentRange, path, nil)

            let cgContext = context.cgContext
            cgContext.saveGState()
            cgContext.translateBy(x: 0, y: rect.maxY + rect.minY)
            cgContext.scaleBy(x: 1, y: -1)
            cgContext.textMatrix = .identity
            CTFrameDraw(frame, cgContext)
            cgContext.restoreGState()

            let visibleRange = CTFrameGetVisibleStringRange(frame)
            currentRange.location += visibleRange.length
            if visibleRange.length == 0 { break }
        }
    }
}

// MARK: - Share sheet wrapper

struct AppealExportSheetView: View {
    @Environment(\.dismiss) private var dismiss

    let appealText: String
    let stateCode: String
    let language: CivicaLanguage

    @State private var pdfURL: URL?

    var body: some View {
        NavigationStack {
            VStack(spacing: CivicaSpacing.lg) {
                Text(AppealExportStrings.title.value(in: language))
                    .font(CivicaTypography.pageTitle)
                    .foregroundStyle(CivicaColors.ink)
                    .multilineTextAlignment(.center)

                if let pdfURL {
                    ShareLink(item: pdfURL) {
                        exportCTA(
                            icon: "square.and.arrow.up",
                            title: AppealExportStrings.shareCTA.value(in: language)
                        )
                    }
                }

                if let portal = AppealExportService.statePortals[stateCode.uppercased()] {
                    Link(destination: portal) {
                        exportCTA(
                            icon: "safari",
                            title: AppealExportStrings.portalCTA(state: stateCode).value(in: language)
                        )
                    }
                }

                Button(action: copy) {
                    exportCTA(
                        icon: "doc.on.doc",
                        title: AppealExportStrings.copyCTA.value(in: language)
                    )
                }
                .buttonStyle(.plain)

                Spacer()
            }
            .padding(CivicaSpacing.xl)
            .background(CivicaColors.paper.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(AppealExportStrings.cancel.value(in: language)) {
                        dismiss()
                    }
                }
            }
            .onAppear {
                pdfURL = AppealExportService.writePDF(body: appealText, stateCode: stateCode)
                RecertCompanionAnalytics.trackAppealExported(stateCode: stateCode)
            }
        }
    }

    private func exportCTA(icon: String, title: String) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            Image(systemName: icon)
                .imageScale(.large)
                .font(.body)
                .foregroundStyle(CivicaColors.brickAccent)
                .frame(width: 32)
            Text(title)
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            Spacer()
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private func copy() {
        UIPasteboard.general.string = appealText
    }
}

enum AppealExportStrings {
    static let title = CivicaText(
        "Send your appeal",
        es: "Envía tu apelación",
        zh: "发送你的申诉"
    )
    static let shareCTA = CivicaText(
        "Save as PDF or send",
        es: "Guardar PDF o enviar",
        zh: "保存为 PDF 或发送"
    )
    static let copyCTA = CivicaText(
        "Copy text",
        es: "Copiar texto",
        zh: "复制文本"
    )

    static func portalCTA(state: String) -> CivicaText {
        CivicaText(
            "Open the \(state) benefits portal",
            es: "Abrir el portal de beneficios de \(state)",
            zh: "打开 \(state) 福利门户"
        )
    }
    static let cancel = CivicaText(
        "Cancel",
        es: "Cancelar",
        zh: "取消"
    )
}
