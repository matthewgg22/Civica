import CivicaDesignSystem
import SwiftUI

// HANDOFF MobilePrivacyBoard · screen 2 — "Here's what will happen,
// in order." Four numbered steps that lay out the deletion outcome
// in plain language, then a single brick-ink primary CTA.
//
// Brand-voice rule from the board: "treats data deletion as a
// reasonable request from someone with reasonable concerns." No
// scare modal, no double-confirm, no "really really sure?" — the
// explanation IS the confirmation. Tap = done.
//
// The 4 steps from the canvas mock are calibrated to a backend-
// connected app ("we send you an email confirming," "erased from
// our servers and our backups"). Civica is currently all-on-device
// — the four-step copy is rewritten honestly: nothing is on a
// server yet, but DTA-submitted records can't be pulled back.

struct SNAPDataDeletionView: View {
    @Environment(\.dismiss) private var dismiss

    @AppStorage(CivicaAppStorageKeys.hasCompletedOnboarding)
    private var hasCompletedOnboarding: Bool = false

    @AppStorage(CivicaAppStorageKeys.recertInProgress)
    private var recertInProgress: Bool = false

    @State private var didDelete: Bool = false

    let language: CivicaLanguage

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                    eyebrow
                    title
                    stepsBlock
                }
                .padding(CivicaSpacing.xl)
            }
            actionFooter
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Header

    private var eyebrow: some View {
        Text(SNAPDataDeletionStrings.eyebrow.value(in: language))
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.graphite)
            .textCase(.uppercase)
            .kerning(1.2)
    }

    private var title: some View {
        Text(SNAPDataDeletionStrings.title.value(in: language))
            .font(CivicaTypography.pageTitle)
            .foregroundStyle(CivicaColors.ink)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }

    // MARK: - Steps

    private var stepsBlock: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            ForEach(SNAPDataDeletionStrings.steps(language: language).indices, id: \.self) { i in
                step(
                    number: i + 1,
                    title: SNAPDataDeletionStrings.steps(language: language)[i].title,
                    body: SNAPDataDeletionStrings.steps(language: language)[i].body
                )
            }
        }
    }

    private func step(number: Int, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Text("\(number)")
                .font(CivicaTypography.subheadStrong.monospacedDigit())
                .foregroundStyle(CivicaColors.pinePrimary)
                .frame(width: 22, alignment: .leading)
                .padding(.top, 1)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(body)
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Action footer

    private var actionFooter: some View {
        VStack(spacing: CivicaSpacing.sm) {
            // Brick-ink primary (the canvas spec uses ink-fill with
            // paper text, signaling the seriousness without dipping
            // into destructive-red alarm).
            Button(action: performDeletion) {
                Text(SNAPDataDeletionStrings.confirm.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.paper)
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.control)
                            .fill(CivicaColors.ink)
                    )
            }
            .accessibilityLabel(SNAPDataDeletionStrings.confirm.value(in: language))

            CivicaSecondaryButton(
                title: SNAPDataDeletionStrings.cancel.value(in: language),
                action: { dismiss() }
            )
        }
        .padding(.horizontal, CivicaSpacing.xl)
        .padding(.top, CivicaSpacing.md)
        .padding(.bottom, CivicaSpacing.lg)
        .background(CivicaColors.paper)
        .overlay(alignment: .top) {
            Rectangle().fill(CivicaColors.hairline).frame(height: 1)
        }
    }

    // MARK: - Delete action

    private func performDeletion() {
        guard !didDelete else { return }
        didDelete = true

        // Wipe every byte. CivicaUserData.deleteEverything handles:
        // UserDefaults keys, captured documents on disk, the draft
        // store, the status store.
        CivicaUserData.deleteEverything()

        // The deletion routine clears UserDefaults but @AppStorage
        // properties hold their @State copies until the next view
        // tree refresh. Explicitly reset the two flags we care
        // about so the next launch (or dismiss-to-root re-eval)
        // routes the user to a fresh onboarding.
        hasCompletedOnboarding = false
        recertInProgress = false

        // The view tree above us reads hasCompletedOnboarding via
        // @AppStorage on CivicaRootView. Setting it to false triggers
        // a re-render to OnboardingFlowView. Dismissing this view
        // collapses the navigation stack first.
        dismiss()
    }
}

// MARK: - Strings

enum SNAPDataDeletionStrings {

    struct Step {
        let title: String
        let body: String
    }

    static let eyebrow = CivicaText(
        "Deleting your Civica data",
        es: "Eliminando tus datos de Civica",
        zh: "正在删除你的 Civica 数据",
        vi: "Đang xoá dữ liệu Civica của bạn"
    )
    static let title = CivicaText(
        "Here's what will happen, in order.",
        es: "Esto es lo que va a pasar, en orden.",
        zh: "接下来会按顺序发生这些事。",
        vi: "Đây là những gì sẽ xảy ra, theo thứ tự."
    )
    static let confirm = CivicaText(
        "Yes, delete everything",
        es: "Sí, eliminar todo",
        zh: "是的，删除所有内容",
        vi: "Có, xoá tất cả"
    )
    static let cancel = CivicaText(
        "Keep my account",
        es: "Mantener mi cuenta",
        zh: "保留我的账户",
        vi: "Giữ lại tài khoản của tôi"
    )

    static func steps(language: CivicaLanguage, stateCode: String? = nil) -> [Step] {
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        let portalEN = portal.isEmpty ? "your state portal" : portal
        let portalES = portal.isEmpty ? "el portal estatal" : portal
        let portalZH = portal.isEmpty ? "你所在州的门户网站" : portal
        let portalVI = portal.isEmpty ? "cổng thông tin của tiểu bang bạn" : portal
        switch language {
        case .english, .tagalog:
            return [
                Step(
                    title: "Right now",
                    body: "Your answers, captured documents, status, and language preference are erased from this device. The app returns to the language picker."
                ),
                Step(
                    title: "Already with the state",
                    body: "If you submitted to \(portalEN), that submission stays with the state. Civica can't pull it back — only \(agency) can change or close it. Your benefits won't change just because you delete here."
                ),
                Step(
                    title: "Civica's servers",
                    body: "Deleting here clears your local SNAP draft, captured documents, status, and preferences from this device. If you used optional network features — finding nearby help or Interview Coach — deletion of any server logs or backups follows Civica's retention process. Any application you already submitted stays with the state agency."
                ),
                Step(
                    title: "Reapplying later",
                    body: "You can come back any time. You'll start fresh — Civica won't recognize you, by design."
                ),
            ]
        case .mandarin:
            return [
                Step(
                    title: "现在",
                    body: "你的答案、拍下的文件、状态和语言偏好都会从这台设备上抹除。应用会返回到语言选择页面。"
                ),
                Step(
                    title: "已经提交给州政府的部分",
                    body: "如果你已经向\(portalZH)提交过申请，那份申请会保留在州政府那里。Civica 没办法把它撤回——只有\(agency)能修改或关闭它。你的福利不会因为在这里删除而改变。"
                ),
                Step(
                    title: "Civica 的服务器",
                    body: "在这里删除会清除这台设备上的本地 SNAP 草稿、拍下的文件、状态和偏好。如果你用过可选的网络功能——查找附近的帮助或面谈教练——任何服务器日志或备份的删除会按照 Civica 的保留流程进行。你已经提交的任何申请仍然保留在州政府机构那里。"
                ),
                Step(
                    title: "以后重新申请",
                    body: "你随时可以回来。你会从头开始——按照设计，Civica 不会认出你。"
                ),
            ]
        case .spanish:
            return [
                Step(
                    title: "Ahora mismo",
                    body: "Tus respuestas, documentos capturados, estado y preferencia de idioma se borran de este dispositivo. La aplicación vuelve a la selección de idioma."
                ),
                Step(
                    title: "Lo que ya está con el estado",
                    body: "Si enviaste tu solicitud a \(portalES), esa solicitud queda con el estado. Civica no puede recuperarla — solo \(agency) puede cambiarla o cerrarla. Tus beneficios no cambian por eliminar aquí."
                ),
                Step(
                    title: "Los servidores de Civica",
                    body: "Eliminar aquí borra de este dispositivo el borrador local de SNAP, los documentos capturados, el estado y las preferencias. Si usaste funciones opcionales de red — buscar ayuda cercana o el Coach de entrevistas — la eliminación de cualquier registro o copia de seguridad del servidor sigue el proceso de retención de Civica. Cualquier solicitud que ya enviaste permanece con la agencia estatal."
                ),
                Step(
                    title: "Volver a solicitar más tarde",
                    body: "Puedes regresar en cualquier momento. Empezarás de cero — Civica no te reconocerá, por diseño."
                ),
            ]
        case .vietnamese:
            return [
                Step(
                    title: "Ngay bây giờ",
                    body: "Câu trả lời, tài liệu đã chụp, trạng thái và ngôn ngữ ưu tiên của bạn sẽ bị xoá khỏi thiết bị này. Ứng dụng quay lại trang chọn ngôn ngữ."
                ),
                Step(
                    title: "Phần đã nộp cho tiểu bang",
                    body: "Nếu bạn đã nộp qua \(portalVI), hồ sơ đó vẫn nằm với tiểu bang. Civica không thể rút lại — chỉ có \(agency) mới có thể thay đổi hoặc đóng nó. Quyền lợi của bạn sẽ không thay đổi chỉ vì bạn xoá ở đây."
                ),
                Step(
                    title: "Máy chủ của Civica",
                    body: "Xoá ở đây sẽ xoá bản nháp SNAP cục bộ, tài liệu đã chụp, trạng thái và tuỳ chọn khỏi thiết bị này. Nếu bạn đã dùng các tính năng mạng tuỳ chọn — tìm trợ giúp gần đây hoặc Huấn luyện phỏng vấn — việc xoá bất kỳ nhật ký hay bản sao lưu nào trên máy chủ sẽ tuân theo quy trình lưu giữ của Civica. Mọi đơn bạn đã nộp vẫn nằm với cơ quan tiểu bang."
                ),
                Step(
                    title: "Nộp lại sau này",
                    body: "Bạn có thể quay lại bất kỳ lúc nào. Bạn sẽ bắt đầu lại từ đầu — theo thiết kế, Civica sẽ không nhận ra bạn."
                ),
            ]
        }
    }
}

#if DEBUG
struct SNAPDataDeletionView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            SNAPDataDeletionView(language: .english)
        }
    }
}
#endif
