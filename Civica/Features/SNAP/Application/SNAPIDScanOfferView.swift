import CivicaDesignSystem
import SwiftUI
import UIKit
import VisionKit

// Optional ID scan offered as the FIRST step of the application.
// Captures a photo of a driver's license or state ID and runs
// on-device extraction to pre-fill the easy low-sensitivity fields:
// full name, date of birth, and (when present) address. Each scraped
// value lands in the normal application fields downstream, where the
// applicant confirms or edits it — the scan suggests, the applicant
// stays the source of truth. The image is also saved as the photoID
// document so it's pre-checked on the end-of-flow checklist.
//
// The user can skip at any time — nothing here is required. Name /
// DOB / address are draft-local + session-only (no server-side PII
// store). SSN / immigration are NEVER extracted (privacy firewall).

struct SNAPIDScanOfferView: View {
    let language: CivicaLanguage
    /// Returns the captured image + the parsed fields (name / DOB /
    /// address). `result` is nil when extraction is unavailable or
    /// returned nothing — the image still saves and the user proceeds.
    let onScanComplete: (UIImage?, SNAPInlineDocScanResult?) -> Void
    let onSkip: () -> Void
    let onExit: () -> Void

    @State private var documentBeingCaptured = false
    @State private var pendingRetry: PendingRetry?
    @State private var showScannerUnavailableAlert = false
    @State private var isExtracting = false

    private struct PendingRetry: Identifiable {
        let id = UUID()
        let image: UIImage
        let quality: SNAPDocumentQualityResult
    }

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: CivicaSpacing.xl)

            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(SNAPIDScanStrings.eyebrow.value(in: language))
                        .font(CivicaTypography.captionStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .textCase(.uppercase)
                        .kerning(1.2)
                    Text(SNAPIDScanStrings.title.value(in: language))
                        .font(CivicaTypography.pageTitle)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Text(SNAPIDScanStrings.body.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)

                benefitRows
            }
            .padding(.horizontal, CivicaSpacing.xl)

            Spacer(minLength: CivicaSpacing.xl)

            VStack(spacing: CivicaSpacing.xs) {
                Button {
                    guard VNDocumentCameraViewController.isSupported else {
                        showScannerUnavailableAlert = true
                        return
                    }
                    documentBeingCaptured = true
                } label: {
                    HStack(spacing: CivicaSpacing.sm) {
                        Image(systemName: "camera.fill")
                            .accessibilityHidden(true)
                        Text(SNAPIDScanStrings.scanCTA.value(in: language))
                    }
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, CivicaSpacing.sm)
                    .background(CivicaColors.pinePrimary)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                }
                .buttonStyle(.plain)

                Button(action: onSkip) {
                    Text(SNAPIDScanStrings.skipCTA.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, CivicaSpacing.xs)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, CivicaSpacing.xl)
            .padding(.bottom, CivicaSpacing.lg)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: onExit) {
                    Image(systemName: "xmark")
                        .foregroundStyle(CivicaColors.ink)
                }
                .accessibilityLabel(CivicaQuestionStrings.closeLabel.value(in: language))
            }
        }
        .fullScreenCover(isPresented: $documentBeingCaptured) {
            SNAPDocumentCameraView(
                onCaptured: { image, quality in
                    documentBeingCaptured = false
                    if !quality.passed {
                        pendingRetry = PendingRetry(image: image, quality: quality)
                    } else {
                        extractThenComplete(image)
                    }
                },
                onCancel: { documentBeingCaptured = false }
            )
        }
        .fullScreenCover(item: $pendingRetry) { retry in
            NavigationStack {
                SNAPDocumentRetryView(
                    capturedImage: retry.image,
                    quality: retry.quality,
                    documentType: .photoID,
                    language: language,
                    onRetake: {
                        pendingRetry = nil
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.32) {
                            documentBeingCaptured = true
                        }
                    },
                    onKeepAnyway: {
                        pendingRetry = nil
                        extractThenComplete(retry.image)
                    },
                    onUseDifferentDocument: {
                        pendingRetry = nil
                        onSkip()
                    }
                )
            }
        }
        .alert(
            SNAPDocumentsChecklistStrings.scannerUnavailableTitle.value(in: language),
            isPresented: $showScannerUnavailableAlert
        ) {
            Button(CivicaQuestionStrings.closeLabel.value(in: language), role: .cancel) {}
        } message: {
            Text(SNAPDocumentsChecklistStrings.scannerUnavailableBody.value(in: language))
        }
    }

    /// Run on-device extraction on the captured ID, then hand the
    /// parsed fields (name / DOB / address) back to the orchestrator.
    /// Fail-open: any extraction error still completes with the image
    /// (nil result) so the user proceeds — the photo is saved either
    /// way and the applicant fills the fields manually.
    private func extractThenComplete(_ image: UIImage) {
        guard SNAPOnDeviceExtractor.isAvailable, #available(iOS 26, *) else {
            onScanComplete(image, nil)
            return
        }
        isExtracting = true
        Task { @MainActor in
            defer { isExtracting = false }
            do {
                let res = try await SNAPOnDeviceExtractor.extract(image: image, capturedAs: .photoID)
                let other = res.extractedOther ?? [:]
                let parsed = SNAPInlineDocScanResult(
                    primaryAmount: nil,
                    fullName: other["name"],
                    address: other["address"],
                    dateOfBirth: other["date_of_birth"],
                    zipCode: other["zip"],
                    rawConfidence: res.extractionConfidence
                )
                onScanComplete(image, parsed)
            } catch {
                onScanComplete(image, nil)
            }
        }
    }

    private var benefitRows: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            benefitRow(icon: "calendar", text: SNAPIDScanStrings.benefit1.value(in: language))
            benefitRow(icon: "checkmark.shield", text: SNAPIDScanStrings.benefit2.value(in: language))
            benefitRow(icon: "iphone.and.arrow.forward.inward", text: SNAPIDScanStrings.benefit3.value(in: language))
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

    private func benefitRow(icon: String, text: String) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: icon)
                .imageScale(.large)
                .font(.body)
                .foregroundStyle(CivicaColors.pinePrimary)
                .frame(width: 20)
                .accessibilityHidden(true)
            Text(text)
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

enum SNAPIDScanStrings {
    static let eyebrow = CivicaText(
        "Optional · 30 seconds",
        es: "Opcional · 30 segundos",
        zh: "可选 · 30 秒"
    )
    static let title = CivicaText(
        "Scan your ID to get started faster.",
        es: "Escanea tu ID para empezar más rápido.",
        zh: "扫描你的身份证件,更快开始申请。"
    )
    static let body = CivicaText(
        "A driver's license or state ID lets Civica pre-fill your name, date of birth, and address — you'll confirm each one as you go. The photo is also saved for your documents checklist.",
        es: "Una licencia de conducir o ID estatal permite que Civica pre-llene tu nombre, fecha de nacimiento y dirección — confirmarás cada uno mientras avanzas. La foto también se guarda para tu lista de documentos.",
        zh: "驾驶执照或州身份证可以让 Civica 预填你的姓名、出生日期和地址 —— 你会在过程中逐项确认。照片也会保存到你的文件清单里。"
    )
    static let benefit1 = CivicaText(
        "Pre-fills your name, date of birth, and address",
        es: "Pre-llena tu nombre, fecha de nacimiento y dirección",
        zh: "预填你的姓名、出生日期和地址"
    )
    static let benefit2 = CivicaText(
        "Checks off your photo ID on the documents list",
        es: "Marca tu foto de ID en la lista de documentos",
        zh: "在文件清单上勾选你的身份证件照片"
    )
    static let benefit3 = CivicaText(
        "Stays on this device only — nothing is uploaded",
        es: "Se queda solo en este dispositivo — nada se sube",
        zh: "只保留在这台设备上 —— 不会上传任何内容"
    )
    static let scanCTA = CivicaText(
        "Scan my ID",
        es: "Escanear mi ID",
        zh: "扫描我的身份证件"
    )
    static let skipCTA = CivicaText(
        "Skip for now",
        es: "Omitir por ahora",
        zh: "暂时跳过"
    )
}

#if DEBUG
struct SNAPIDScanOfferView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            SNAPIDScanOfferView(
                language: .english,
                onScanComplete: { _, _ in },
                onSkip: {},
                onExit: {}
            )
        }
    }
}
#endif
