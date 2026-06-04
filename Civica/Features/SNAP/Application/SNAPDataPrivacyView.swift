import CivicaDesignSystem
import SwiftUI

// HANDOFF MobilePrivacyBoard · screen 1 — "Your data" settings
// landing. Plain-English inventory of what Civica has stored on the
// user + who's seen it + paths to Download or Delete.
//
// Brand-voice rule from the board: "Most apps treat data deletion
// as a punishment — warnings in red, scary modals, are you really
// really sure? Civica treats it as a reasonable request from
// someone with reasonable concerns." No destructive-modal pattern,
// no friction beyond the explanation screen.

struct SNAPDataPrivacyView: View {
    let language: CivicaLanguage

    @State private var inventory: CivicaUserData.Inventory = CivicaUserData.currentInventory()
    @State private var downloadURL: URL?
    @State private var isShareSheetPresented: Bool = false
    @State private var downloadError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                eyebrow
                header
                whatWeHaveCard
                whosSeenItCard
                actionRows
                if let error = downloadError {
                    Text(error)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.destructive)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { inventory = CivicaUserData.currentInventory() }
        .sheet(isPresented: $isShareSheetPresented) {
            if let url = downloadURL {
                DataPrivacyShareSheet(items: [url])
            }
        }
    }

    // MARK: - Header

    private var eyebrow: some View {
        Text(SNAPDataPrivacyStrings.eyebrow.value(in: language))
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.graphite)
            .textCase(.uppercase)
            .kerning(1.2)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPDataPrivacyStrings.title.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(SNAPDataPrivacyStrings.subtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - "What we have" card

    private var whatWeHaveCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(SNAPDataPrivacyStrings.whatWeHaveHeading.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.0)

            VStack(spacing: 0) {
                inventoryRow(
                    label: SNAPDataPrivacyStrings.rowApplicationAnswers.value(in: language),
                    detail: SNAPDataPrivacyStrings.sectionsCompleted(
                        completed: inventory.completedSections,
                        total: inventory.totalSections,
                        language: language
                    )
                )
                Divider().background(CivicaColors.hairline)
                inventoryRow(
                    label: SNAPDataPrivacyStrings.rowDocuments.value(in: language),
                    detail: SNAPDataPrivacyStrings.photosOnDevice(
                        count: inventory.capturedDocumentCount,
                        language: language
                    )
                )
                Divider().background(CivicaColors.hairline)
                inventoryRow(
                    label: SNAPDataPrivacyStrings.rowLanguage.value(in: language),
                    detail: languageDisplayName
                )
                Divider().background(CivicaColors.hairline)
                inventoryRow(
                    label: SNAPDataPrivacyStrings.rowStatus.value(in: language),
                    detail: SNAPDataPrivacyStrings.statusLabel(
                        status: inventory.status,
                        language: language,
                        stateCode: SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode
                    )
                )
            }
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
    }

    private func inventoryRow(label: String, detail: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
            Spacer(minLength: CivicaSpacing.md)
            Text(detail)
                .font(CivicaTypography.footnoteStrong.monospacedDigit())
                .foregroundStyle(CivicaColors.graphite)
        }
        .padding(.horizontal, CivicaSpacing.lg)
        .padding(.vertical, CivicaSpacing.md)
    }

    private var languageDisplayName: String {
        (CivicaLanguage(rawValue: inventory.languageRaw) ?? .english).displayName
    }

    // MARK: - "Who's seen it" card

    private var whosSeenItCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(SNAPDataPrivacyStrings.whosSeenItHeading.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.0)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                if inventory.hasBeenSubmittedToState {
                    Text(SNAPDataPrivacyStrings.sharedWithStateTitle(
                        stateCode: SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode,
                        language: language
                    ))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                    Text(SNAPDataPrivacyStrings.sharedWithStateBody(
                        stateCode: SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode,
                        language: language
                    ))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    Text(SNAPDataPrivacyStrings.nothingSharedTitle.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                    Text(SNAPDataPrivacyStrings.nothingSharedBody.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
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
    }

    // MARK: - Action rows

    private var actionRows: some View {
        VStack(spacing: CivicaSpacing.sm) {
            NavigationLink {
                SNAPNotificationPreviewView(language: language)
            } label: {
                actionRow(
                    title: SNAPDataPrivacyStrings.notificationsYoullReceive.value(in: language),
                    accent: CivicaColors.ink
                )
            }
            .buttonStyle(.plain)

            Button(action: triggerDownload) {
                actionRow(
                    title: SNAPDataPrivacyStrings.downloadCopy.value(in: language),
                    accent: CivicaColors.ink
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel(SNAPDataPrivacyStrings.downloadCopy.value(in: language))

            NavigationLink {
                SNAPDataDeletionView(language: language)
            } label: {
                actionRow(
                    title: SNAPDataPrivacyStrings.deleteEverything.value(in: language),
                    accent: CivicaColors.pinePrimary
                )
            }
            .buttonStyle(.plain)
        }
    }

    private func actionRow(title: String, accent: Color) -> some View {
        HStack {
            Text(title)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(accent)
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundStyle(accent)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, CivicaSpacing.lg)
        .padding(.vertical, CivicaSpacing.md)
        .frame(minHeight: 56)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    // MARK: - Download

    private func triggerDownload() {
        downloadError = nil
        // Reuse the application-packet renderer so users get the same
        // PDF they'd export at packet-generation time. Their answers
        // get materialized exactly as Civica has them.
        //
        // Guard against the "no draft yet" path: an applicant who taps
        // Your data + privacy before filling anything in would
        // otherwise get a near-empty PDF and think the export silently
        // failed. Surface an honest "nothing to download yet" message
        // instead of the generic download-error string.
        let draftStore = SNAPApplicationDraftStore()
        guard let payload = draftStore.load() else {
            downloadError = SNAPDataPrivacyStrings.downloadNothingYet.value(in: language)
            return
        }
        let draft = payload.draft
        do {
            let url = try SNAPApplicationDraftPDFRenderer.render(draft, language: language)
            downloadURL = url
            isShareSheetPresented = true
        } catch {
            downloadError = SNAPDataPrivacyStrings.downloadError.value(in: language)
        }
    }
}

// MARK: - Share sheet

private struct DataPrivacyShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Strings

enum SNAPDataPrivacyStrings {

    static let eyebrow = CivicaText("Your data", es: "Tus datos", zh: "你的数据", vi: "Dữ liệu của bạn")
    static let title = CivicaText(
        "What we have. Who's seen it.",
        es: "Lo que tenemos. Quién lo ha visto.",
        zh: "我们有什么。谁看过。",
        vi: "Chúng tôi có gì. Ai đã xem."
    )
    static let subtitle = CivicaText(
        "Plain English, on this screen, every time you ask. No emails, no support tickets.",
        es: "En lenguaje claro, en esta pantalla, cada vez que preguntes. Sin correos electrónicos, sin tickets de soporte.",
        zh: "用大白话,就在这个屏幕上,每次你问都看得到。不用发邮件,不用提工单。",
        vi: "Ngôn ngữ rõ ràng, ngay trên màn hình này, mỗi lần bạn hỏi. Không cần email, không cần phiếu hỗ trợ."
    )

    // What we have card
    static let whatWeHaveHeading = CivicaText(
        "What we have on you",
        es: "Lo que tenemos de ti",
        zh: "我们记录了你的哪些信息",
        vi: "Chúng tôi có thông tin gì về bạn"
    )
    static let rowApplicationAnswers = CivicaText(
        "Application answers",
        es: "Respuestas de la solicitud",
        zh: "申请回答",
        vi: "Câu trả lời trong đơn"
    )
    static let rowDocuments = CivicaText(
        "Documents",
        es: "Documentos",
        zh: "文件",
        vi: "Tài liệu"
    )
    static let rowLanguage = CivicaText(
        "Language preference",
        es: "Idioma preferido",
        zh: "语言偏好",
        vi: "Ngôn ngữ ưu tiên"
    )
    static let rowStatus = CivicaText(
        "Application status",
        es: "Estado de la solicitud",
        zh: "申请状态",
        vi: "Trạng thái đơn"
    )

    static func sectionsCompleted(completed: Int, total: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english, .tagalog: return completed == 0
            ? "Nothing yet"
            : "\(completed) of \(total) sections"
        case .mandarin: return completed == 0
            ? "暂无内容"
            : "已完成 \(completed) / \(total) 个部分"
        case .spanish: return completed == 0
            ? "Nada todavía"
            : "\(completed) de \(total) secciones"
        case .vietnamese: return completed == 0
            ? "Chưa có gì"
            : "\(completed) trên \(total) phần"
        }
    }

    static func photosOnDevice(count: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english, .tagalog: return count == 0
            ? "None on device"
            : (count == 1 ? "1 photo on device" : "\(count) photos on device")
        case .mandarin: return count == 0
            ? "设备上没有"
            : "设备上有 \(count) 张照片"
        case .spanish: return count == 0
            ? "Ninguno en el dispositivo"
            : (count == 1 ? "1 foto en el dispositivo" : "\(count) fotos en el dispositivo")
        case .vietnamese: return count == 0
            ? "Không có trên thiết bị"
            : "\(count) ảnh trên thiết bị"
        }
    }

    static func statusLabel(status: SNAPApplicationStatus, language: CivicaLanguage, stateCode: String? = nil) -> String {
        let agency = SNAPAgencyDirectory.agencyShortName(for: stateCode, language: language)
        switch (status, language) {
        case (.notStarted, .english), (.notStarted, .tagalog):              return "Not started"
        case (.notStarted, .mandarin):             return "尚未开始"
        case (.notStarted, .spanish):              return "No iniciado"
        case (.notStarted, .vietnamese):           return "Chưa bắt đầu"
        case (.screenerInProgress, .english), (.screenerInProgress, .tagalog):      return "Screener in progress"
        case (.screenerInProgress, .mandarin):     return "资格初筛进行中"
        case (.screenerInProgress, .spanish):      return "Evaluación en curso"
        case (.screenerInProgress, .vietnamese):   return "Đang sàng lọc điều kiện"
        case (.screenerComplete, .english), (.screenerComplete, .tagalog):        return "Screener complete"
        case (.screenerComplete, .mandarin):       return "资格初筛已完成"
        case (.screenerComplete, .spanish):        return "Evaluación completada"
        case (.screenerComplete, .vietnamese):     return "Sàng lọc đã xong"
        case (.packetGenerated, .english), (.packetGenerated, .tagalog):         return "Packet generated"
        case (.packetGenerated, .mandarin):        return "申请材料已生成"
        case (.packetGenerated, .spanish):         return "Paquete generado"
        case (.packetGenerated, .vietnamese):      return "Đã tạo hồ sơ"
        case (.submittedToState, .english), (.submittedToState, .tagalog):        return "Submitted to \(agency)"
        case (.submittedToState, .mandarin):       return "已提交至 \(agency)"
        case (.submittedToState, .spanish):        return "Enviado a \(agency)"
        case (.submittedToState, .vietnamese):     return "Đã nộp cho \(agency)"
        case (.documentsRequested, .english), (.documentsRequested, .tagalog):      return "Documents requested by \(agency)"
        case (.documentsRequested, .mandarin):     return "\(agency) 要求补交文件"
        case (.documentsRequested, .spanish):      return "Documentos solicitados por \(agency)"
        case (.documentsRequested, .vietnamese):   return "\(agency) yêu cầu tài liệu"
        case (.interviewScheduled, .english), (.interviewScheduled, .tagalog):      return "Interview scheduled"
        case (.interviewScheduled, .mandarin):     return "面谈已安排"
        case (.interviewScheduled, .spanish):      return "Entrevista programada"
        case (.interviewScheduled, .vietnamese):   return "Đã hẹn phỏng vấn"
        case (.interviewCompleted, .english), (.interviewCompleted, .tagalog):      return "Interview completed"
        case (.interviewCompleted, .mandarin):     return "面谈已完成"
        case (.interviewCompleted, .spanish):      return "Entrevista completada"
        case (.interviewCompleted, .vietnamese):   return "Phỏng vấn đã xong"
        case (.decisionApproved, .english), (.decisionApproved, .tagalog):        return "Approved"
        case (.decisionApproved, .mandarin):       return "已批准"
        case (.decisionApproved, .spanish):        return "Aprobado"
        case (.decisionApproved, .vietnamese):     return "Được duyệt"
        case (.decisionDenied, .english), (.decisionDenied, .tagalog):          return "Denied"
        case (.decisionDenied, .mandarin):         return "已拒绝"
        case (.decisionDenied, .spanish):          return "Denegado"
        case (.decisionDenied, .vietnamese):       return "Bị từ chối"
        case (.recertDue, .english), (.recertDue, .tagalog):               return "Recertification due"
        case (.recertDue, .mandarin):              return "需要重新认证"
        case (.recertDue, .spanish):               return "Recertificación pendiente"
        case (.recertDue, .vietnamese):            return "Đến hạn tái xác nhận"
        }
    }

    // Who's seen it card
    static let whosSeenItHeading = CivicaText(
        "Who's seen it",
        es: "Quién lo ha visto",
        zh: "谁看过",
        vi: "Ai đã xem"
    )
    static let nothingSharedTitle = CivicaText(
        "Your draft is local",
        es: "Tu borrador está en este dispositivo",
        zh: "你的草稿只在本机上",
        vi: "Bản nháp của bạn chỉ ở trên máy này"
    )
    static let nothingSharedBody = CivicaText(
        "Your SNAP draft and captured documents are saved on this device unless you choose to submit them to an official agency. Optional tools, such as finding nearby help or Interview Coach, may send only the information needed for that tool — never your full application draft.",
        es: "El borrador de tu solicitud de SNAP y los documentos capturados se guardan en este dispositivo a menos que decidas enviarlos a una agencia oficial. Las herramientas opcionales, como buscar ayuda cercana o el Coach de entrevistas, pueden enviar solo la información necesaria para esa herramienta — nunca tu borrador completo.",
        zh: "你的 SNAP 申请草稿和拍摄的文件都保存在这台设备上,除非你选择提交给官方机构。可选工具,例如查找附近的帮助点或面谈辅导,只会发送该工具需要的那部分信息 — 绝不会发送你完整的申请草稿。",
        vi: "Bản nháp đơn SNAP và các tài liệu bạn đã chụp được lưu trên thiết bị này, trừ khi bạn chọn nộp cho cơ quan chính thức. Các công cụ tùy chọn, như tìm điểm trợ giúp gần đây hoặc Hướng dẫn phỏng vấn, chỉ gửi đi thông tin cần thiết cho công cụ đó — không bao giờ gửi toàn bộ bản nháp đơn của bạn."
    )
    static func sharedWithStateTitle(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        switch language {
        case .english, .tagalog: return "\(agency) has your application"
        case .mandarin: return "\(agency) 已收到你的申请"
        case .spanish: return "\(agency) tiene tu solicitud"
        case .vietnamese: return "\(agency) đã nhận đơn của bạn"
        }
    }

    static func sharedWithStateBody(stateCode: String?, language: CivicaLanguage) -> String {
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let agency = SNAPAgencyDirectory.agencyShortName(for: stateCode, language: language)
        let portalRef: String
        if portal.isEmpty {
            switch language {
            case .spanish: portalRef = "el portal estatal"
            case .vietnamese: portalRef = "cổng thông tin của tiểu bang"
            default: portalRef = "the state portal"
            }
        } else {
            portalRef = portal
        }
        switch language {
        case .english, .tagalog:
            return "Once an application is submitted to \(portalRef), it becomes the state's record. Civica can't pull that back — only \(agency) can change or close it."
        case .mandarin:
            return "申请一旦提交到 \(portalRef),它就成为州政府的档案。Civica 无法撤回 — 只有 \(agency) 才能修改或关闭它。"
        case .spanish:
            return "Una vez que la solicitud se envía a \(portalRef), se convierte en el registro del estado. Civica no puede recuperarla — solo \(agency) puede cambiarla o cerrarla."
        case .vietnamese:
            return "Khi đơn đã nộp vào \(portalRef), nó trở thành hồ sơ của tiểu bang. Civica không thể rút lại — chỉ có \(agency) mới có thể thay đổi hoặc đóng đơn."
        }
    }

    // Action rows
    static let notificationsYoullReceive = CivicaText(
        "Notifications you'll receive",
        es: "Notificaciones que recibirás",
        zh: "你会收到的通知",
        vi: "Thông báo bạn sẽ nhận được"
    )
    static let downloadCopy = CivicaText(
        "Download a copy",
        es: "Descargar una copia",
        zh: "下载一份副本",
        vi: "Tải xuống một bản sao"
    )
    static let deleteEverything = CivicaText(
        "Delete everything",
        es: "Eliminar todo",
        zh: "删除全部内容",
        vi: "Xóa toàn bộ"
    )

    static let downloadError = CivicaText(
        "We couldn't prepare the download. Try again in a moment.",
        es: "No pudimos preparar la descarga. Inténtalo de nuevo en un momento.",
        zh: "我们没能准备好下载文件。请稍后再试一次。",
        vi: "Chúng tôi chưa chuẩn bị được bản tải xuống. Hãy thử lại sau ít phút."
    )

    /// Shown when the applicant hits Download a copy before any
    /// application draft exists on device. Earlier behavior was to
    /// render an empty PDF and present a share sheet over nothing,
    /// which read as "the button is broken."
    static let downloadNothingYet = CivicaText(
        "There's nothing to download yet — start your SNAP application first and the export will fill in.",
        es: "Aún no hay nada que descargar — primero comienza tu solicitud de SNAP y la exportación se rellenará.",
        zh: "目前还没有可以下载的内容 — 先开始你的 SNAP 申请,导出文件就会自动生成。",
        vi: "Hiện chưa có gì để tải xuống — hãy bắt đầu đơn SNAP của bạn trước, rồi bản xuất sẽ tự điền vào."
    )
}

#if DEBUG
struct SNAPDataPrivacyView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            SNAPDataPrivacyView(language: .english)
        }
    }
}
#endif
