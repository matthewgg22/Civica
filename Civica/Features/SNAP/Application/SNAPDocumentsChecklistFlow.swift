import CivicaDesignSystem
import SwiftUI
import UIKit
import VisionKit

// Migrates the legacy "documentsChecklistStep". Unlike the other
// migrated steps, this isn't really a question — it's a single
// confirmation surface where the user marks which documents they
// already have. It stays as one screen, but in the HANDOFF
// breathing-room cadence using CivicaQuestionScreen with a
// checklist-style affordance.
//
// No questions to skip / split; we keep the legacy semantics:
// document types are nudges, not requirements. The user can
// continue with nothing checked.

struct SNAPDocumentsChecklistAnswers: Equatable, Codable {
    /// Documents the user has self-reported as on-hand. Toggled by the
    /// checklist's primary tap on each row.
    var documentsAvailable: Set<SNAPDocumentType> = []

    /// Documents for which the user has captured an iOS-camera image
    /// via the document scanner. Image bytes live on disk under
    /// SNAPCapturedDocumentStore — this set is just the index of which
    /// types have a saved file. Persistence keeps them in sync: if a
    /// type is in this set, a JPEG file should exist for it.
    var capturedDocuments: Set<SNAPDocumentType> = []
}

@MainActor
final class SNAPDocumentsChecklistFlowViewModel: ObservableObject {
    @Published var answers: SNAPDocumentsChecklistAnswers
    @Published var pendingExtraction: PendingExtraction?

    /// The document types that are relevant given the user's answers.
    /// Computed once at init from the draft so the list is stable
    /// while the user is on this screen.
    let relevantDocuments: [SNAPDocumentType]

    struct PendingExtraction: Identifiable {
        let id = UUID()
        let documentType: SNAPDocumentType
        let result: SNAPExtractionResult
    }

    init(answers: SNAPDocumentsChecklistAnswers = .init(), draft: SNAPApplicationDraft = .init()) {
        self.answers = answers
        self.relevantDocuments = SNAPDocumentType.relevant(for: draft)
    }

    func toggle(_ document: SNAPDocumentType) {
        if answers.documentsAvailable.contains(document) {
            answers.documentsAvailable.remove(document)
        } else {
            answers.documentsAvailable.insert(document)
        }
    }

    /// Record a captured image for the given document type. The image
    /// is persisted to disk via SNAPCapturedDocumentStore; the answers
    /// just track which types have a file. Automatically marks the
    /// document as available since the user has provably handled it.
    func recordCapture(_ image: UIImage, for document: SNAPDocumentType) {
        SNAPCapturedDocumentStore.save(image, as: document)
        answers.capturedDocuments.insert(document)
        answers.documentsAvailable.insert(document)
    }

    /// Drop the captured image for a type (e.g., user wants to retake).
    func clearCapture(for document: SNAPDocumentType) {
        SNAPCapturedDocumentStore.delete(document)
        answers.capturedDocuments.remove(document)
    }

    /// Kick off on-device extraction for a captured image. The result is
    /// surfaced via pendingExtraction, which the view binds to a sheet.
    /// Silently no-ops when the device or OS can't run Foundation Models
    /// so the existing capture flow degrades cleanly.
    func startExtraction(image: UIImage, for document: SNAPDocumentType) {
        guard SNAPOnDeviceExtractor.isAvailable else { return }
        Task { @MainActor [weak self] in
            guard let self else { return }
            guard #available(iOS 26, *) else { return }
            do {
                let result = try await SNAPOnDeviceExtractor.extract(image: image, capturedAs: document)
                self.pendingExtraction = PendingExtraction(documentType: document, result: result)
            } catch {
                // Demo-friendly: the photo is already saved, so swallowing
                // the extraction error keeps the user on the checklist
                // with no confusing crash or dead-end alert.
            }
        }
    }

    func dismissPendingExtraction() {
        pendingExtraction = nil
    }
}

struct SNAPDocumentsChecklistFlowView: View {
    @StateObject var viewModel: SNAPDocumentsChecklistFlowViewModel
    let language: CivicaLanguage
    let onComplete: (SNAPDocumentsChecklistAnswers) -> Void
    let onExit: () -> Void
    /// Fired when the user confirms an extracted paystub. The orchestrator
    /// captures the SNAPPaystub so the income flow can prefill the
    /// "gross monthly income" screen. The paystub object itself is not
    /// added to the persisted draft — it lives on the orchestrator
    /// viewmodel only, mirroring the existing "no PII at rest" posture.
    let onPaystubConfirmed: (SNAPPaystub) -> Void

    /// Which document type the camera sheet is currently capturing
    /// for. Nil when the sheet is dismissed. Drives .sheet(item:).
    @State private var documentBeingCaptured: SNAPDocumentType?

    @State private var showScannerUnavailableAlert = false

    /// Pending retry state when an on-device quality check fails.
    /// Drives presentation of SNAPDocumentRetryView (HANDOFF
    /// FormErrorBoard). The captured image stays saved on disk so
    /// "Keep this photo anyway" is just a dismiss; "Take another
    /// photo" re-presents the camera and overwrites the saved file.
    @State private var pendingRetry: PendingRetry?

    private struct PendingRetry: Identifiable {
        let id = UUID()
        let documentType: SNAPDocumentType
        let image: UIImage
        let quality: SNAPDocumentQualityResult
    }

    init(
        viewModel: SNAPDocumentsChecklistFlowViewModel,
        language: CivicaLanguage = .english,
        onComplete: @escaping (SNAPDocumentsChecklistAnswers) -> Void,
        onExit: @escaping () -> Void,
        onPaystubConfirmed: @escaping (SNAPPaystub) -> Void = { _ in }
    ) {
        self._viewModel = StateObject(wrappedValue: viewModel)
        self.language = language
        self.onComplete = onComplete
        self.onExit = onExit
        self.onPaystubConfirmed = onPaystubConfirmed
    }

    var body: some View {
        CivicaQuestionScreen(
            progress: .init(
                current: 1,
                total: 1,
                sectionIndex: SNAPApplicationSection.documentsChecklist.oneBasedIndex,
                sectionCount: SNAPApplicationSection.count,
                sectionTitle: SNAPApplicationSection.documentsChecklist.title(in: language)
            ),
            title: SNAPDocumentsChecklistStrings.title.value(in: language),
            helper: SNAPDocumentsChecklistStrings.helper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: true,
            onPrimary: { onComplete(viewModel.answers) },
            language: language
        ) {
            VStack(spacing: CivicaSpacing.sm) {
                ForEach(viewModel.relevantDocuments) { document in
                    checklistRow(for: document)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: onExit) {
                    Image(systemName: "xmark")
                        .foregroundStyle(CivicaColors.ink)
                }
                .accessibilityLabel(CivicaQuestionStrings.backLabel.value(in: language))
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $documentBeingCaptured) { document in
            SNAPDocumentCameraView(
                onCaptured: { image, quality in
                    viewModel.recordCapture(image, for: document)
                    documentBeingCaptured = nil
                    // On-device quality gate failed: surface the
                    // FormErrorBoard recovery sheet with image
                    // preview, a precise reason, and the retake /
                    // keep / skip routes. Passing photos go straight
                    // back to the checklist with the "Photo saved"
                    // confirmation chip and trigger on-device
                    // extraction so the confirmation sheet can offer
                    // pre-filled fields when Apple Intelligence is on.
                    if !quality.passed {
                        pendingRetry = PendingRetry(
                            documentType: document,
                            image: image,
                            quality: quality
                        )
                    } else {
                        viewModel.startExtraction(image: image, for: document)
                    }
                },
                onCancel: { documentBeingCaptured = nil }
            )
        }
        .sheet(item: $viewModel.pendingExtraction) { pending in
            NavigationStack {
                SNAPDocumentConfirmationView(
                    extraction: pending.result,
                    onConfirm: {
                        if let paystub = pending.result.extractedPaystub {
                            onPaystubConfirmed(paystub)
                        }
                        viewModel.dismissPendingExtraction()
                    },
                    onCorrect: { viewModel.dismissPendingExtraction() }
                )
            }
        }
        .fullScreenCover(item: $pendingRetry) { retry in
            NavigationStack {
                SNAPDocumentRetryView(
                    capturedImage: retry.image,
                    quality: retry.quality,
                    documentType: retry.documentType,
                    language: language,
                    onRetake: {
                        // Drop the just-saved capture so the row's
                        // "Photo saved" chip doesn't mislead the user
                        // while they re-shoot.
                        viewModel.clearCapture(for: retry.documentType)
                        pendingRetry = nil
                        // Defer presenting the camera by one runloop
                        // tick so the retry sheet's dismiss animation
                        // doesn't fight the camera's present animation.
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.32) {
                            documentBeingCaptured = retry.documentType
                        }
                    },
                    onKeepAnyway: {
                        // Leave the capture in place. The DTA caseworker
                        // will tell us if it isn't readable on their
                        // end; until then, the user has done their part.
                        pendingRetry = nil
                    },
                    onUseDifferentDocument: {
                        viewModel.clearCapture(for: retry.documentType)
                        pendingRetry = nil
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

    private func checklistRow(for document: SNAPDocumentType) -> some View {
        let isChecked = viewModel.answers.documentsAvailable.contains(document)
        let hasCapture = viewModel.answers.capturedDocuments.contains(document)
        return VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            // Top row: tappable toggle for "I have this" state.
            Button {
                viewModel.toggle(document)
            } label: {
                HStack(alignment: .top, spacing: CivicaSpacing.md) {
                    Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
                        .imageScale(.large)
                        .font(.body)
                        .foregroundStyle(isChecked ? CivicaColors.pinePrimary : CivicaColors.graphite)
                        .padding(.top, 2)
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                        Text(SNAPDocumentsChecklistStrings.label(for: document, language: language))
                            .font(CivicaTypography.subheadStrong)
                            .foregroundStyle(CivicaColors.ink)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        if let example = SNAPDocumentsChecklistStrings.example(for: document, language: language) {
                            Text(example)
                                .font(CivicaTypography.footnote)
                                .foregroundStyle(CivicaColors.graphite)
                                .multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(SNAPDocumentsChecklistStrings.label(for: document, language: language))
            .accessibilityAddTraits(isChecked ? [.isButton, .isSelected] : .isButton)

            // Bottom row: camera affordance. Tapping presents
            // VNDocumentCameraViewController; on capture, the image
            // is saved to disk under SNAPCapturedDocumentStore.
            cameraButton(for: document, hasCapture: hasCapture)
        }
        .padding(.horizontal, CivicaSpacing.lg)
        .padding(.vertical, CivicaSpacing.md)
        .frame(minHeight: 56)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.control)
                .strokeBorder(
                    isChecked ? CivicaColors.pinePrimary : CivicaColors.hairline,
                    lineWidth: isChecked ? 2 : 1
                )
        )
    }

    private func cameraButton(for document: SNAPDocumentType, hasCapture: Bool) -> some View {
        Button {
            guard VNDocumentCameraViewController.isSupported else {
                showScannerUnavailableAlert = true
                return
            }
            documentBeingCaptured = document
        } label: {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: hasCapture ? "checkmark.shield.fill" : "camera.fill")
                    .foregroundStyle(hasCapture ? CivicaColors.amberPrimary : CivicaColors.pinePrimary)
                    .accessibilityHidden(true)
                Text(hasCapture
                    ? SNAPDocumentsChecklistStrings.photoSaved.value(in: language)
                    : SNAPDocumentsChecklistStrings.takePhoto.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(hasCapture ? CivicaColors.amberPrimary : CivicaColors.pinePrimary)
                Spacer(minLength: 0)
            }
            .padding(.vertical, CivicaSpacing.xs)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(hasCapture
            ? SNAPDocumentsChecklistStrings.photoSaved.value(in: language)
            : SNAPDocumentsChecklistStrings.takePhoto.value(in: language))
    }
}

// MARK: - Strings

enum SNAPDocumentsChecklistStrings {

    static let title = CivicaText(
        "Which of these do you already have?",
        es: "¿Cuáles de estos ya tienes?",
        zh: "下面这些你已经有哪些?",
        vi: "Bạn đã có sẵn những giấy tờ nào trong số này?",
        tl: "Alin sa mga ito ang mayroon ka na?"
    )
    static let helper = CivicaText(
        "Mark anything you already have, or tap \"Take a photo\" to scan a document with your camera. Civica keeps the photo on this device only — nothing uploaded.",
        es: "Marca lo que ya tengas, o toca \"Tomar una foto\" para escanear un documento con tu cámara. Civica guarda la foto solo en este dispositivo — nada se sube.",
        zh: "勾选你已经有的任何材料,或者点击「拍一张照」用相机扫描文件。Civica 只把照片保存在这台设备上 — 不会上传任何东西。",
        vi: "Đánh dấu bất kỳ giấy tờ nào bạn đã có, hoặc nhấn “Chụp ảnh” để quét một giấy tờ bằng máy ảnh của bạn. Civica chỉ giữ ảnh trên thiết bị này — không tải lên bất cứ đâu.",
        tl: "Markahan ang anumang mayroon ka na, o i-tap ang “Kumuha ng litrato” para i-scan ang isang dokumento gamit ang iyong camera. Itinatago lang ng Civica ang litrato sa device na ito — walang ina-upload."
    )

    static let scannerUnavailableTitle = CivicaText(
        "Camera scanning not available",
        es: "Escaneo con cámara no disponible",
        zh: "相机扫描功能不可用",
        vi: "Không thể quét bằng máy ảnh",
        tl: "Hindi available ang pag-scan gamit ang camera"
    )
    static let scannerUnavailableBody = CivicaText(
        "Document scanning isn't supported on this device. You can still mark which documents you have and bring them to your appointment.",
        es: "El escaneo de documentos no es compatible con este dispositivo. Puedes marcar qué documentos tienes y llevarlos a tu cita.",
        zh: "这台设备不支持文件扫描。你仍然可以勾选你有哪些材料,然后带去预约时使用。",
        vi: "Thiết bị này không hỗ trợ quét giấy tờ. Bạn vẫn có thể đánh dấu những giấy tờ mình có và mang theo đến buổi hẹn.",
        tl: "Hindi sinusuportahan ng device na ito ang pag-scan ng dokumento. Pwede mo pa ring markahan kung anong mga dokumento ang mayroon ka at dalhin ang mga ito sa iyong appointment."
    )

    static let takePhoto = CivicaText(
        "Take a photo",
        es: "Tomar una foto",
        zh: "拍一张照",
        vi: "Chụp ảnh",
        tl: "Kumuha ng litrato"
    )
    static let photoSaved = CivicaText(
        "Photo saved · Tap to retake",
        es: "Foto guardada · Toca para volver a tomarla",
        zh: "照片已保存 · 点击重新拍摄",
        vi: "Đã lưu ảnh · Nhấn để chụp lại",
        tl: "Na-save ang litrato · I-tap para kumuhang muli"
    )
    static func label(for document: SNAPDocumentType, language: CivicaLanguage) -> String {
        switch (document, language) {
        case (.photoID, .english):                       return "Photo ID"
        case (.photoID, .mandarin):                       return "带照片的身份证件"
        case (.photoID, .spanish):                       return "Identificación con foto"
        case (.photoID, .vietnamese):                       return "Giấy tờ tùy thân có ảnh"
        case (.photoID, .tagalog):                       return "ID na may litrato"
        case (.proofOfAddress, .english):                return "Proof of where you live"
        case (.proofOfAddress, .mandarin):                return "你居住地址的证明"
        case (.proofOfAddress, .spanish):                return "Prueba de donde vives"
        case (.proofOfAddress, .vietnamese):                return "Bằng chứng về nơi bạn sống"
        case (.proofOfAddress, .tagalog):                return "Patunay kung saan ka nakatira"
        case (.proofOfIncome, .english):                 return "Recent paystubs or proof of income"
        case (.proofOfIncome, .mandarin):                 return "近期工资单或收入证明"
        case (.proofOfIncome, .spanish):                 return "Talones de pago recientes o prueba de ingresos"
        case (.proofOfIncome, .vietnamese):                 return "Phiếu lương gần đây hoặc bằng chứng thu nhập"
        case (.proofOfIncome, .tagalog):                 return "Mga kamakailang paystub o patunay ng kita"
        case (.rentOrHousingCostProof, .english):        return "Rent or housing cost"
        case (.rentOrHousingCostProof, .mandarin):        return "房租或住房费用"
        case (.rentOrHousingCostProof, .spanish):        return "Renta o costo de vivienda"
        case (.rentOrHousingCostProof, .vietnamese):        return "Tiền thuê nhà hoặc chi phí nhà ở"
        case (.rentOrHousingCostProof, .tagalog):        return "Upa o gastos sa pabahay"
        case (.utilityBill, .english):                   return "A recent utility bill"
        case (.utilityBill, .mandarin):                   return "近期的水电气账单"
        case (.utilityBill, .spanish):                   return "Un recibo reciente de servicios"
        case (.utilityBill, .vietnamese):                   return "Một hóa đơn tiện ích gần đây"
        case (.utilityBill, .tagalog):                   return "Isang kamakailang utility bill"
        case (.bankStatement, .english):                 return "Recent bank statement"
        case (.bankStatement, .mandarin):                 return "近期的银行对账单"
        case (.bankStatement, .spanish):                 return "Estado de cuenta bancario reciente"
        case (.bankStatement, .vietnamese):                 return "Sao kê ngân hàng gần đây"
        case (.bankStatement, .tagalog):                 return "Kamakailang bank statement"
        case (.studentStatusDocuments, .english):        return "Student enrollment paper"
        case (.studentStatusDocuments, .mandarin):        return "学生注册证明"
        case (.studentStatusDocuments, .spanish):        return "Comprobante de inscripción estudiantil"
        case (.studentStatusDocuments, .vietnamese):        return "Giấy xác nhận ghi danh học sinh, sinh viên"
        case (.studentStatusDocuments, .tagalog):        return "Papel ng pagpapatala bilang estudyante"
        case (.workStatusOrExemptions, .english):        return "Letter about work status or work exemption"
        case (.workStatusOrExemptions, .mandarin):        return "关于工作状况或工作豁免的证明信"
        case (.workStatusOrExemptions, .spanish):        return "Carta sobre estado laboral o exención de trabajo"
        case (.workStatusOrExemptions, .vietnamese):        return "Thư về tình trạng việc làm hoặc miễn trừ yêu cầu làm việc"
        case (.workStatusOrExemptions, .tagalog):        return "Sulat tungkol sa work status o work exemption"
        case (.childcareCostProof, .english):            return "Childcare receipt or invoice"
        case (.childcareCostProof, .mandarin):            return "托儿收据或发票"
        case (.childcareCostProof, .spanish):            return "Recibo o factura de cuidado infantil"
        case (.childcareCostProof, .vietnamese):            return "Biên nhận hoặc hóa đơn chi phí giữ trẻ"
        case (.childcareCostProof, .tagalog):            return "Resibo o invoice ng childcare"
        case (.immigrationDocumentsIfRelevant, .english):
            return "Immigration documents (only if the state asks)"
        case (.immigrationDocumentsIfRelevant, .mandarin):
            return "移民相关文件(仅在州政府要求时)"
        case (.immigrationDocumentsIfRelevant, .spanish):
            return "Documentos de inmigración (solo si el estado los pide)"
        case (.immigrationDocumentsIfRelevant, .vietnamese):
            return "Giấy tờ di trú (chỉ khi tiểu bang yêu cầu)"
        case (.immigrationDocumentsIfRelevant, .tagalog):
            return "Mga dokumento sa imigrasyon (kung hihingin lang ng estado)"
        }
    }

    /// Plain-language example so the user knows what to look for.
    /// Returns nil when the label already says it all.
    static func example(for document: SNAPDocumentType, language: CivicaLanguage) -> String? {
        switch (document, language) {
        case (.photoID, .english):                       return "Driver's license, state ID, passport"
        case (.photoID, .mandarin):                       return "驾照、州身份证、护照"
        case (.photoID, .spanish):                       return "Licencia de conducir, identificación estatal, pasaporte"
        case (.photoID, .vietnamese):                       return "Bằng lái xe, thẻ căn cước của tiểu bang, hộ chiếu"
        case (.photoID, .tagalog):                       return "Lisensya sa pagmamaneho, state ID, pasaporte"
        case (.proofOfAddress, .english):                return "Lease, mail, bill with your name and address"
        case (.proofOfAddress, .mandarin):                return "租约、邮件,或印有你的姓名和地址的账单"
        case (.proofOfAddress, .spanish):                return "Contrato de renta, correo o recibo con tu nombre y dirección"
        case (.proofOfAddress, .vietnamese):                return "Hợp đồng thuê nhà, thư từ, hoặc hóa đơn có tên và địa chỉ của bạn"
        case (.proofOfAddress, .tagalog):                return "Kontrata sa upa, koreo, o bill na may pangalan at address mo"
        case (.proofOfIncome, .english):                 return "Last 4 weeks of paystubs, or a letter from your employer"
        case (.proofOfIncome, .mandarin):                 return "过去 4 周的工资单,或你雇主出具的证明信"
        case (.proofOfIncome, .spanish):                 return "Talones de pago de las últimas 4 semanas, o una carta de tu empleador"
        case (.proofOfIncome, .vietnamese):                 return "Phiếu lương trong 4 tuần gần nhất, hoặc thư từ chủ lao động của bạn"
        case (.proofOfIncome, .tagalog):                 return "Mga paystub sa nakaraang 4 na linggo, o sulat mula sa iyong employer"
        case (.rentOrHousingCostProof, .english):        return "Lease, mortgage statement, or shelter receipt"
        case (.rentOrHousingCostProof, .mandarin):        return "租约、房贷月结单或庇护所收据"
        case (.rentOrHousingCostProof, .spanish):        return "Contrato, estado de cuenta de hipoteca o recibo de refugio"
        case (.rentOrHousingCostProof, .vietnamese):        return "Hợp đồng thuê nhà, sao kê tiền vay mua nhà, hoặc biên nhận nơi tạm trú"
        case (.rentOrHousingCostProof, .tagalog):        return "Kontrata sa upa, mortgage statement, o resibo ng tirahan"
        case (.utilityBill, .english):                   return "Electricity, gas, heat, water, or phone"
        case (.utilityBill, .mandarin):                   return "电费、燃气费、暖气费、水费或电话费"
        case (.utilityBill, .spanish):                   return "Electricidad, gas, calefacción, agua o teléfono"
        case (.utilityBill, .vietnamese):                   return "Tiền điện, ga, sưởi, nước, hoặc điện thoại"
        case (.utilityBill, .tagalog):                   return "Kuryente, gas, init, tubig, o telepono"
        case (.bankStatement, .english):                 return "Most recent statement showing your ending balance"
        case (.bankStatement, .mandarin):                 return "最近一期显示你期末余额的对账单"
        case (.bankStatement, .spanish):                 return "Estado de cuenta más reciente que muestre tu saldo final"
        case (.bankStatement, .vietnamese):                 return "Bản sao kê gần nhất cho thấy số dư cuối kỳ của bạn"
        case (.bankStatement, .tagalog):                 return "Pinakabagong statement na nagpapakita ng huling balanse mo"
        case (.studentStatusDocuments, .english):        return "A letter from the school or financial aid office"
        case (.studentStatusDocuments, .mandarin):        return "学校或助学金办公室出具的证明信"
        case (.studentStatusDocuments, .spanish):        return "Una carta de la escuela o la oficina de ayuda financiera"
        case (.studentStatusDocuments, .vietnamese):        return "Một lá thư từ trường học hoặc văn phòng hỗ trợ tài chính"
        case (.studentStatusDocuments, .tagalog):        return "Isang sulat mula sa paaralan o sa financial aid office"
        case (.workStatusOrExemptions, .english):        return nil
        case (.workStatusOrExemptions, .mandarin):        return nil
        case (.workStatusOrExemptions, .spanish):        return nil
        case (.workStatusOrExemptions, .vietnamese):        return nil
        case (.workStatusOrExemptions, .tagalog):        return nil
        case (.childcareCostProof, .english):            return nil
        case (.childcareCostProof, .mandarin):            return nil
        case (.childcareCostProof, .spanish):            return nil
        case (.childcareCostProof, .vietnamese):            return nil
        case (.childcareCostProof, .tagalog):            return nil
        case (.immigrationDocumentsIfRelevant, .english):
            return "Only some applicants need this. SNAP does not require status info from every household member."
        case (.immigrationDocumentsIfRelevant, .mandarin):
            return "只有部分申请人需要这一项。SNAP 不要求家庭中每个成员都提供身份信息。"
        case (.immigrationDocumentsIfRelevant, .spanish):
            return "Solo algunos solicitantes necesitan esto. SNAP no requiere información migratoria de cada miembro del hogar."
        case (.immigrationDocumentsIfRelevant, .vietnamese):
            return "Chỉ một số người nộp đơn cần giấy tờ này. SNAP không yêu cầu thông tin tình trạng di trú của mọi thành viên trong hộ gia đình."
        case (.immigrationDocumentsIfRelevant, .tagalog):
            return "Iilang aplikante lang ang nangangailangan nito. Hindi hinihingi ng SNAP ang impormasyon sa status ng bawat miyembro ng sambahayan."
        }
    }
}

#if DEBUG
struct SNAPDocumentsChecklistFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            SNAPDocumentsChecklistFlowView(
                viewModel: SNAPDocumentsChecklistFlowViewModel(),
            language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
