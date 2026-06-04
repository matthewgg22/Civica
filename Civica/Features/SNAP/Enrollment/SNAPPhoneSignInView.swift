import CivicaDesignSystem
import SwiftUI

// Phone sign-in sheet presented before packet generation so the
// applicant's submission is persisted server-side under their identity.
// Backed by CivicaEnrollmentAuth (Supabase phone OTP via URLSession).
//
// When state transitions to .authenticated the parent's .onChange
// handler on enrollmentAuth.state picks up the pending draft and
// calls runGeneratePacket — this view does not need to signal the
// parent directly.

struct SNAPPhoneSignInView: View {
    @ObservedObject var auth: CivicaEnrollmentAuth
    let language: CivicaLanguage

    @Environment(\.dismiss) private var dismiss

    @State private var phoneText: String = ""
    @State private var otpText: String = ""
    @FocusState private var phoneFieldFocused: Bool
    @FocusState private var otpFieldFocused: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                    headerSection
                    if case .awaitingOTP(let phone) = auth.state {
                        otpSection(phone: phone)
                    } else {
                        phoneSection
                    }
                    if let error = auth.lastError {
                        errorBanner(error.localizedDescription)
                    }
                    Spacer(minLength: CivicaSpacing.xl)
                }
                .padding(.horizontal, CivicaSpacing.md)
                .padding(.top, CivicaSpacing.md)
            }
            .navigationTitle(Strings.navTitle.value(in: language))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(Strings.cancel.value(in: language)) { dismiss() }
                }
            }
        }
        .disabled(auth.isLoading)
        .overlay {
            if auth.isLoading {
                Color.black.opacity(0.15).ignoresSafeArea()
                ProgressView().tint(CivicaColors.pinePrimary)
            }
        }
    }

    // MARK: - Sections

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(Strings.title.value(in: language))
                .font(CivicaTypography.cardHero)
                .foregroundStyle(CivicaColors.ink)
            Text(Strings.subtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var phoneSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(Strings.phoneLabel.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                TextField(Strings.phonePlaceholder.value(in: language), text: $phoneText)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
                    .focused($phoneFieldFocused)
                    .padding(CivicaSpacing.sm)
                    .background(CivicaColors.surfaceSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(CivicaColors.hairline, lineWidth: 1)
                    )
            }

            Button {
                phoneFieldFocused = false
                Task { @MainActor in await auth.requestOTP(phone: phoneText) }
            } label: {
                Text(Strings.sendCode.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, CivicaSpacing.sm)
            }
            .buttonStyle(.borderedProminent)
            .tint(CivicaColors.pinePrimary)
            .disabled(phoneText.trimmingCharacters(in: .whitespaces).isEmpty)
            .accessibilityLabel(Strings.sendCode.value(in: language))

            Text(Strings.phoneDisclosure.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func otpSection(phone: String) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(Strings.otpSentTo(phone, language: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(Strings.otpLabel.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                TextField(Strings.otpPlaceholder.value(in: language), text: $otpText)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .focused($otpFieldFocused)
                    .onChange(of: otpText) { _, v in
                        if v.count > 6 { otpText = String(v.prefix(6)) }
                    }
                    .padding(CivicaSpacing.sm)
                    .background(CivicaColors.surfaceSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(CivicaColors.hairline, lineWidth: 1)
                    )
            }

            Button {
                otpFieldFocused = false
                Task { @MainActor in await auth.verifyOTP(code: otpText) }
            } label: {
                Text(Strings.verify.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, CivicaSpacing.sm)
            }
            .buttonStyle(.borderedProminent)
            .tint(CivicaColors.pinePrimary)
            .disabled(otpText.count < 6)

            Button {
                otpText = ""
                Task { @MainActor in await auth.requestOTP(phone: phone) }
            } label: {
                Text(Strings.resend.value(in: language))
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.pinePrimary)
            }
            .buttonStyle(.plain)
        }
    }

    private func errorBanner(_ message: String) -> some View {
        Text(message)
            .font(CivicaTypography.footnote)
            .foregroundStyle(CivicaColors.destructive)
            .padding(CivicaSpacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.statusErrorSurface)
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - Strings

    private enum Strings {
        static let navTitle = CivicaText("Verify identity", es: "Verificar identidad", zh: "验证身份", vi: "Xác minh danh tính", tl: "I-verify ang pagkakakilanlan")
        static let cancel = CivicaText("Cancel", es: "Cancelar", zh: "取消", vi: "Hủy", tl: "Kanselahin")
        static let title = CivicaText("Save your application", es: "Guarda tu solicitud", zh: "保存你的申请", vi: "Lưu đơn của bạn", tl: "I-save ang iyong aplikasyon")
        static let subtitle = CivicaText(
            "Enter your phone number to receive a code. Your application will be securely saved for your navigator.",
            es: "Ingresa tu número de teléfono para recibir un código. Tu solicitud se guardará de forma segura para tu navigator.",
            zh: "输入你的手机号码以接收验证码。你的申请将安全保存,供你的 navigator 使用。",
            vi: "Nhập số điện thoại của bạn để nhận mã. Đơn của bạn sẽ được lưu an toàn cho navigator của bạn.",
            tl: "Ilagay ang iyong numero ng telepono para makatanggap ng code. Ligtas na ise-save ang iyong aplikasyon para sa iyong navigator."
        )
        static let phoneLabel = CivicaText("Phone number", es: "Número de teléfono", zh: "手机号码", vi: "Số điện thoại", tl: "Numero ng telepono")
        static let phonePlaceholder = CivicaText("+1 (555) 000-0000", es: "+1 (555) 000-0000", zh: "+1 (555) 000-0000", vi: "+1 (555) 000-0000")
        static let sendCode = CivicaText("Send code", es: "Enviar código", zh: "发送验证码", vi: "Gửi mã", tl: "Ipadala ang code")
        static let phoneDisclosure = CivicaText(
            "Standard messaging rates may apply. Your number is only used for verification.",
            es: "Pueden aplicar tarifas de mensajería estándar. Tu número se usa solo para verificación.",
            zh: "可能产生标准短信费用。你的号码仅用于验证。",
            vi: "Có thể áp dụng cước tin nhắn tiêu chuẩn. Số của bạn chỉ được dùng để xác minh.",
            tl: "Maaaring mag-apply ang karaniwang singil sa pagte-text. Ginagamit lang ang iyong numero para sa pag-verify."
        )
        static let otpLabel = CivicaText("Verification code", es: "Código de verificación", zh: "验证码", vi: "Mã xác minh", tl: "Verification code")
        static let otpPlaceholder = CivicaText("6-digit code", es: "Código de 6 dígitos", zh: "6 位验证码", vi: "Mã gồm 6 chữ số", tl: "6-digit na code")
        static let verify = CivicaText("Verify", es: "Verificar", zh: "验证", vi: "Xác minh", tl: "I-verify")
        static let resend = CivicaText("Send again", es: "Enviar de nuevo", zh: "重新发送", vi: "Gửi lại", tl: "Ipadala ulit")

        static func otpSentTo(_ phone: String, language: CivicaLanguage) -> String {
            switch language {
            case .english:
                return "We sent a 6-digit code to \(phone)"
            case .spanish:
                return "Enviamos un código de 6 dígitos a \(phone)"
            case .mandarin:
                return "我们已将 6 位验证码发送至 \(phone)"
            case .vietnamese:
                return "Chúng tôi đã gửi mã gồm 6 chữ số đến \(phone)"
            case .tagalog:
                return "Nagpadala kami ng 6-digit na code sa \(phone)"
            }
        }
    }
}

#if DEBUG
struct SNAPPhoneSignInView_Previews: PreviewProvider {
    static var previews: some View {
        SNAPPhoneSignInView(
            auth: CivicaEnrollmentAuth(),
            language: .english
        )
    }
}
#endif
