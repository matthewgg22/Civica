import CivicaDesignSystem
import SwiftUI
import UIKit
import VisionKit

// Optional ID scan offered before the first application question.
// Captures a photo of a driver's license or state ID, extracts
// the date of birth to pre-fill the applicantAge section, and
// saves the image as the photoID document so it's already checked
// off on the end-of-flow documents checklist.
//
// The user can skip at any time — nothing here is required. The
// only pre-fill side effect is dateOfBirth; name and address fields
// aren't captured by the current draft model so extraction is
// limited to DOB. Future: Vision-based OCR could extract name +
// address and pre-fill contact answers.

struct SNAPIDScanOfferView: View {
    let language: CivicaLanguage
    let onScanComplete: (UIImage?, Date?) -> Void
    let onSkip: () -> Void
    let onExit: () -> Void

    @State private var documentBeingCaptured = false
    @State private var pendingRetry: PendingRetry?
    @State private var showScannerUnavailableAlert = false

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
                    .background(CivicaColors.brickPrimary)
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
                        onScanComplete(image, nil)
                    }
                },
                onCancel: { documentBeingCaptured = false }
            )
        }
        .sheet(item: $pendingRetry) { retry in
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
                        onScanComplete(retry.image, nil)
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
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(CivicaColors.brickPrimary)
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
        es: "Opcional · 30 segundos"
    )
    static let title = CivicaText(
        "Scan your ID to get started faster.",
        es: "Escanea tu ID para empezar más rápido."
    )
    static let body = CivicaText(
        "A driver's license or state ID lets Civica pre-fill your date of birth and saves the photo for your documents checklist.",
        es: "Una licencia de conducir o ID estatal permite que Civica pre-llene tu fecha de nacimiento y guarda la foto para tu lista de documentos."
    )
    static let benefit1 = CivicaText(
        "Pre-fills your date of birth",
        es: "Pre-llena tu fecha de nacimiento"
    )
    static let benefit2 = CivicaText(
        "Checks off your photo ID on the documents list",
        es: "Marca tu foto de ID en la lista de documentos"
    )
    static let benefit3 = CivicaText(
        "Stays on this device only — nothing is uploaded",
        es: "Se queda solo en este dispositivo — nada se sube"
    )
    static let scanCTA = CivicaText(
        "Scan my ID",
        es: "Escanear mi ID"
    )
    static let skipCTA = CivicaText(
        "Skip for now",
        es: "Omitir por ahora"
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
