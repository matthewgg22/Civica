import CivicaDesignSystem
import SwiftUI

// Mounts the SNAP enrollment orchestrator and chains the verdict +
// packet-PDF views together. Replaces the legacy
// SNAPEligibilityIntroView wrapper for the Civica target — the
// legacy view depends on SNAPApplicationViewModel which carries
// VoteNow-specific address / prefill plumbing the new flow doesn't
// need.
//
// Flow:
//   1. Mount SNAPApplicationFlowOrchestratorView
//   2. On "Generate my application packet" → evaluate locally,
//      record into the status store (which routes the user to the
//      returning-user-home on subsequent launches), push the
//      decision-math view
//   3. From the math view's "Continue" CTA → push the packet view
//   4. The packet view's "Done for now" dismisses the whole chain

struct CivicaSNAPFlowView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var generatedDraft: SNAPApplicationDraft?
    @State private var verdict: SNAPEligibilityResult?
    @State private var presentingVerdict: Bool = false
    @State private var presentingPacket: Bool = false
    /// Draft held while the user completes phone sign-in before packet generation.
    @State private var pendingDraft: SNAPApplicationDraft?
    @State private var showingSignIn: Bool = false

    @EnvironmentObject private var statusStore: SNAPApplicationStatusStore
    @EnvironmentObject private var enrollmentAuth: CivicaEnrollmentAuth

    /// True when the user is here as part of a recertification rather
    /// than a first-time application. Drives the inline banner that
    /// explains "this is your recert" and primes any future per-step
    /// copy adjustments. Status-store advancement on completion also
    /// clears the recert-in-progress flag at the root.
    @AppStorage(CivicaAppStorageKeys.recertInProgress)
    private var isRecertInProgress: Bool = false

    /// One-time first-entry buddy modal flag. Auto-presents the buddy
    /// 3-panel intro the very first time a user opens the apply flow;
    /// after dismissal the banner stays as the persistent re-entry path.
    @AppStorage(CivicaAppStorageKeys.buddyHasSeenApplyIntro)
    private var hasSeenBuddyIntro: Bool = false
    @State private var showingBuddyIntro: Bool = false

    /// Persisted "invited buddy" state. Empty strings mean no buddy
    /// yet. Set by the dummy invite form so the banner and the modal
    /// can render an invited state until backend wire-up replaces this
    /// with the real /buddy/invite response.
    @AppStorage(CivicaAppStorageKeys.buddyName)
    private var buddyName: String = ""
    @AppStorage(CivicaAppStorageKeys.buddyContact)
    private var buddyContact: String = ""

    /// Master gate. While `false`, the buddy banner, auto-presented intro,
    /// and re-share sheet are all suppressed — the share URL currently
    /// resolves to a broken `civica.app/b/<token>` page so surfacing the
    /// flow at all is a regression for the demo.
    @AppStorage(CivicaAppStorageKeys.buddyFeatureEnabled)
    private var buddyFeatureEnabled: Bool = false

    /// Demo / preview mode. When ON, packet generation bypasses the
    /// phone-OTP sign-in gate so a reviewer walking the application
    /// end-to-end isn't blocked when Supabase phone auth returns a
    /// non-2xx (project misconfig, SMS provider unwired, etc.). Off
    /// in production — the sign-in gate is the right default.
    @AppStorage(CivicaAppStorageKeys.demoUnlockAllPhases)
    private var demoUnlockAllPhases: Bool = false

    let language: CivicaLanguage
    let recertMode: Bool

    init(language: CivicaLanguage, recertMode: Bool = false) {
        self.language = language
        self.recertMode = recertMode
    }

    var body: some View {
        VStack(spacing: 0) {
            if recertMode {
                recertBanner
            }
            if buddyFeatureEnabled {
                buddyBanner
            }
            SNAPApplicationFlowOrchestratorView(
                viewModel: SNAPApplicationFlowOrchestratorViewModel(),
                language: language,
                onGeneratePacket: { draft in
                    // Demo bypass: when the gear's "Unlock all phases"
                    // toggle is on, generate the packet directly even
                    // when not signed in. Keeps the demo walk-through
                    // unblocked if phone OTP is misconfigured.
                    if enrollmentAuth.state.isAuthenticated || demoUnlockAllPhases {
                        runGeneratePacket(draft)
                    } else {
                        pendingDraft = draft
                        showingSignIn = true
                    }
                },
                onDismiss: { dismiss() }
            )
        }
        .navigationTitle("SNAP")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            // First entry: present the 3-panel buddy intro once, then
            // never again. The banner stays as the persistent re-entry
            // path for users who skipped or dismissed the modal. Gated
            // by `buddyFeatureEnabled` because the share link currently
            // resolves to a broken civica.app/b/<token> page.
            if buddyFeatureEnabled, !hasSeenBuddyIntro {
                showingBuddyIntro = true
            }
        }
        .sheet(isPresented: $showingBuddyIntro, onDismiss: {
            hasSeenBuddyIntro = true
        }) {
            BuddyApplyIntroView(
                language: language,
                buddyName: $buddyName,
                buddyContact: $buddyContact,
                onDismiss: {
                    hasSeenBuddyIntro = true
                    showingBuddyIntro = false
                }
            )
        }
        // When auth succeeds (e.g. inside the sign-in sheet), handle the pending draft.
        .onChange(of: enrollmentAuth.state) { _, newState in
            if newState.isAuthenticated, let draft = pendingDraft {
                pendingDraft = nil
                showingSignIn = false
                runGeneratePacket(draft)
            }
        }
        .sheet(isPresented: $showingSignIn, onDismiss: {
            // User cancelled sign-in — discard the pending draft.
            pendingDraft = nil
        }) {
            SNAPPhoneSignInView(auth: enrollmentAuth, language: language)
        }
        // Both destinations registered at the same NavigationStack level —
        // nesting a second navigationDestination inside the first destination's
        // view body is unsupported in iOS 17+ and causes navigation freezes.
        .navigationDestination(isPresented: $presentingVerdict) {
            if let verdict {
                SNAPDecisionMathView(
                    result: verdict,
                    language: language,
                    onContinue: { presentingPacket = true },
                    draft: generatedDraft
                )
            }
        }
        .navigationDestination(isPresented: $presentingPacket) {
            if let draft = generatedDraft {
                SNAPApplicationPacketView(
                    draft: draft,
                    language: language,
                    onClose: {
                        presentingPacket = false
                        presentingVerdict = false
                        dismiss()
                    }
                )
            }
        }
    }

    // MARK: - Packet generation

    private func runGeneratePacket(_ draft: SNAPApplicationDraft) {
        let result = SNAPLocalEligibilityEvaluator.evaluate(draft)
        statusStore.recordEligibilityResult(result)
        if recertMode { isRecertInProgress = false }
        generatedDraft = draft
        verdict = result
        presentingVerdict = true

        // Submit to the enrollment API in the background.
        // This is best-effort — a failure must never block the local UX.
        let client = enrollmentAuth.makeEnrollmentAPIClient()
        let stateCode = draft.whereApplying.stateCode?.uppercased() ?? "CA"
        Task {
            do {
                let packet = try await client.createPacket(stateCode: stateCode)
                _ = try await client.submitPacket(packetId: packet.id)
                SNAPAnalytics.trackSubmitted()
            } catch {
                // Intentional no-op: enrollment API is additive persistence.
                // The applicant's local flow continues unaffected.
            }
        }
    }

    /// Persistent buddy invite banner above the orchestrator. Two
    /// states:
    ///   • Pre-invite: pine-tinted CTA inviting the user to add a
    ///     buddy. Tap → opens the 3-panel intro modal.
    ///   • Post-invite: pine-tinted confirmation showing the buddy's
    ///     name + a checkmark, anchoring the relationship in the UI.
    ///     Tap → re-opens the modal so the user can manage / re-share.
    private var buddyBanner: some View {
        Button {
            showingBuddyIntro = true
        } label: {
            HStack(alignment: .center, spacing: CivicaSpacing.sm) {
                Image(systemName: buddyName.isEmpty ? "person.2.fill" : "person.2.badge.gearshape.fill")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(width: 36, height: 36)
                    .background(
                        Circle().fill(CivicaColors.pinePrimary.opacity(0.14))
                    )
                    .overlay(alignment: .topTrailing) {
                        if !buddyName.isEmpty {
                            Image(systemName: "checkmark.circle.fill")
                                .imageScale(.large)
                                .font(.body)
                                .foregroundStyle(CivicaColors.pinePrimary)
                                .background(Circle().fill(CivicaColors.pineSurface))
                                .offset(x: 4, y: -2)
                        }
                    }
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(buddyName.isEmpty
                         ? CivicaSNAPFlowStrings.buddyBannerTitle.value(in: language)
                         : CivicaSNAPFlowStrings.buddyBannerInvitedTitle(name: buddyName, language: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                    Text(buddyName.isEmpty
                         ? CivicaSNAPFlowStrings.buddyBannerBody.value(in: language)
                         : CivicaSNAPFlowStrings.buddyBannerInvitedBody.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: CivicaSpacing.sm)
                Image(systemName: "chevron.right")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.pineSurface)
            .overlay(alignment: .bottom) {
                Rectangle().fill(CivicaColors.hairline).frame(height: 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }

    /// Inline banner above the orchestrator when the user is here
    /// for a recertification. Tells them prior answers are pre-
    /// populated and that they only need to change what changed.
    private var recertBanner: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .foregroundStyle(CivicaColors.pinePrimary)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(CivicaSNAPFlowStrings.recertBannerTitle.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(CivicaSNAPFlowStrings.recertBannerBody.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(CivicaSpacing.md)
        .background(CivicaColors.amberSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(CivicaColors.hairline).frame(height: 1)
        }
    }
}

enum CivicaSNAPFlowStrings {
    static let recertBannerTitle = CivicaText(
        "You're recertifying",
        es: "Estás recertificando",
        zh: "你正在重新认证",
        vi: "Bạn đang tái chứng nhận",
        tl: "Nag-re-recertify ka"
    )
    static let recertBannerBody = CivicaText(
        "Your previous answers are pre-filled — change only what's different since last time.",
        es: "Tus respuestas anteriores están pre-llenadas — cambia solo lo que sea diferente desde la última vez.",
        zh: "你之前的回答已预先填好 — 只需修改自上次以来有变化的部分。",
        vi: "Câu trả lời trước đây của bạn đã được điền sẵn — chỉ sửa những gì đã thay đổi kể từ lần trước.",
        tl: "Naka-pre-fill na ang dati mong mga sagot — baguhin mo lang ang nag-iba mula noong huli."
    )

    // MARK: Buddy banner + first-entry modal

    static let buddyBannerTitle = CivicaText(
        "Loop in a buddy",
        es: "Incluye a un compañero",
        zh: "邀请一位伙伴",
        vi: "Rủ một người bạn đồng hành",
        tl: "Magsama ng buddy"
    )
    static let buddyBannerBody = CivicaText(
        "Share progress with someone you trust — they'll see deadlines and what's left to do.",
        es: "Comparte tu progreso con alguien de confianza — verá las fechas límite y lo que falta.",
        zh: "和你信任的人分享进度 — 他们能看到截止日期和还需要做什么。",
        vi: "Chia sẻ tiến trình với người bạn tin tưởng — họ sẽ thấy các hạn chót và những việc còn lại cần làm.",
        tl: "I-share ang progreso sa taong pinagkakatiwalaan mo — makikita nila ang mga deadline at ang natitira pang gawin."
    )

    static let buddyModalEyebrow = CivicaText(
        "BETTER WITH HELP",
        es: "MEJOR CON AYUDA",
        zh: "有人帮忙更顺利",
        vi: "DỄ HƠN KHI CÓ NGƯỜI GIÚP",
        tl: "MAS MADALI KAPAG MAY KATULONG"
    )
    static let buddyModalTitle = CivicaText(
        "Don't go through this alone",
        es: "No pases por esto solo",
        zh: "别一个人扛",
        vi: "Đừng tự mình vượt qua chuyện này",
        tl: "Huwag mong daanan ito nang mag-isa"
    )
    static let buddyModalSubtitle = CivicaText(
        "Add a family member, friend, or navigator so someone else knows what's next.",
        es: "Agrega a un familiar, amigo o asesor para que alguien más sepa qué sigue.",
        zh: "添加一位家人、朋友或协助员,让别人也知道下一步该做什么。",
        vi: "Thêm một người thân, bạn bè hoặc người hướng dẫn để người khác cũng biết bước tiếp theo là gì.",
        tl: "Magdagdag ng kapamilya, kaibigan, o navigator para may ibang nakakaalam din kung ano ang susunod."
    )
    static let buddyStep1Title = CivicaText(
        "You start the application",
        es: "Tú comienzas la solicitud",
        zh: "你开始申请",
        vi: "Bạn bắt đầu đơn xin",
        tl: "Ikaw ang magsisimula ng aplikasyon"
    )
    static let buddyStep1Body = CivicaText(
        "Walk through SNAP at your own pace. Your buddy never sees your private documents.",
        es: "Avanza por SNAP a tu ritmo. Tu compañero nunca verá tus documentos privados.",
        zh: "按你自己的节奏走完 SNAP 申请。你的伙伴永远看不到你的私人文件。",
        vi: "Làm SNAP theo nhịp của bạn. Người bạn đồng hành không bao giờ thấy giấy tờ riêng tư của bạn.",
        tl: "Dahan-dahan mong dadaanan ang SNAP sa sarili mong bilis. Hindi nakikita ng buddy mo ang iyong mga pribadong dokumento."
    )
    static let buddyStep2Title = CivicaText(
        "They get a private link",
        es: "Reciben un enlace privado",
        zh: "他们会收到一个私人链接",
        vi: "Họ nhận một đường liên kết riêng",
        tl: "Makakakuha sila ng pribadong link"
    )
    static let buddyStep2Body = CivicaText(
        "We send a one-time invite by text or email. They tap it to follow along — no app install required.",
        es: "Enviamos una invitación única por mensaje o correo. La tocan para seguir el proceso — sin instalar una app.",
        zh: "我们通过短信或邮件发送一次性邀请。他们点击就能跟进 — 不需要安装应用。",
        vi: "Chúng tôi gửi một lời mời dùng một lần qua tin nhắn hoặc email. Họ chạm vào để theo dõi — không cần cài ứng dụng.",
        tl: "Magpapadala kami ng isang beses na imbitasyon sa text o email. I-tap lang nila ito para makasubaybay — hindi kailangang mag-install ng app."
    )
    static let buddyStep3Title = CivicaText(
        "They see what's due, when",
        es: "Ven qué falta y cuándo",
        zh: "他们能看到什么时候要交什么",
        vi: "Họ thấy việc gì cần làm và khi nào",
        tl: "Makikita nila kung ano ang dapat gawin, at kailan"
    )
    static let buddyStep3Body = CivicaText(
        "Status, upcoming deadlines, and what documents are still needed — so they can nudge you or help you gather things.",
        es: "Estado, próximas fechas límite y qué documentos faltan — para que te recuerden o te ayuden a reunir cosas.",
        zh: "状态、即将到来的截止日期、以及还缺哪些文件 — 这样他们可以提醒你或帮你收集材料。",
        vi: "Trạng thái, các hạn chót sắp tới, và những giấy tờ còn thiếu — để họ có thể nhắc bạn hoặc giúp bạn gom đồ.",
        tl: "Status, mga paparating na deadline, at kung anong mga dokumento pa ang kailangan — para mapaalalahanan ka nila o matulungang ipunin ang mga bagay-bagay."
    )
    static let buddyModalPrimaryCTA = CivicaText(
        "Add a buddy now",
        es: "Agregar un compañero ahora",
        zh: "现在添加伙伴",
        vi: "Thêm người bạn đồng hành ngay",
        tl: "Magdagdag ng buddy ngayon"
    )
    static let buddyModalSecondaryCTA = CivicaText(
        "Maybe later",
        es: "Quizás después",
        zh: "以后再说",
        vi: "Để sau",
        tl: "Mamaya na lang"
    )
    static let buddyModalComingSoon = CivicaText(
        "Demo build — invites are simulated. Backend wire-up ships next.",
        es: "Versión de demostración — las invitaciones son simuladas. La conexión al servidor llega pronto.",
        zh: "演示版本 — 邀请是模拟的。后台对接即将上线。",
        vi: "Bản trình diễn — lời mời chỉ là mô phỏng. Phần kết nối máy chủ sẽ ra mắt sau.",
        tl: "Demo build — naka-simulate lang ang mga imbitasyon. Susunod na ilalabas ang koneksyon sa backend."
    )

    // Banner — invited state
    static func buddyBannerInvitedTitle(name: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "\(name) is following along"
        case .spanish: return "\(name) está siguiendo el proceso"
        case .mandarin: return "\(name) 正在跟进"
        case .vietnamese: return "\(name) đang theo dõi cùng bạn"
        case .tagalog: return "Sumusubaybay si \(name)"
        }
    }
    static let buddyBannerInvitedBody = CivicaText(
        "Tap to re-share the invite link or manage your buddy.",
        es: "Toca para volver a compartir el enlace o administrar tu compañero.",
        zh: "点击可重新分享邀请链接或管理你的伙伴。",
        vi: "Chạm để chia sẻ lại đường liên kết mời hoặc quản lý người bạn đồng hành.",
        tl: "I-tap para muling i-share ang link ng imbitasyon o i-manage ang iyong buddy."
    )

    // Invite form
    static let buddyFormTitle = CivicaText(
        "Add a buddy",
        es: "Agregar un compañero",
        zh: "添加伙伴",
        vi: "Thêm người bạn đồng hành",
        tl: "Magdagdag ng buddy"
    )
    static let buddyFormSubtitle = CivicaText(
        "We'll send them a one-time private link. They can open it on any phone — no Civica account needed.",
        es: "Les enviaremos un enlace privado de un solo uso. Pueden abrirlo desde cualquier teléfono — sin cuenta de Civica.",
        zh: "我们会给他们发送一个一次性的私人链接。他们可以在任何手机上打开 — 不需要 Civica 账户。",
        vi: "Chúng tôi sẽ gửi cho họ một đường liên kết riêng dùng một lần. Họ có thể mở trên bất kỳ điện thoại nào — không cần tài khoản Civica.",
        tl: "Padadalhan namin sila ng isang beses na pribadong link. Mabubuksan nila ito sa kahit anong telepono — hindi kailangan ng Civica account."
    )
    static let buddyFormNameLabel = CivicaText(
        "Their name",
        es: "Su nombre",
        zh: "他们的名字",
        vi: "Tên của họ",
        tl: "Pangalan nila"
    )
    static let buddyFormNamePlaceholder = CivicaText(
        "e.g. Maria",
        es: "p. ej. María",
        zh: "例如:Maria",
        vi: "ví dụ: Maria",
        tl: "hal. Maria"
    )
    static let buddyFormChannelLabel = CivicaText(
        "How should we reach them?",
        es: "¿Cómo los contactamos?",
        zh: "我们怎么联系他们?",
        vi: "Chúng tôi liên lạc với họ bằng cách nào?",
        tl: "Paano namin sila kokontakin?"
    )
    static let buddyFormChannelSMS = CivicaText(
        "Text",
        es: "Mensaje",
        zh: "短信",
        vi: "Tin nhắn",
        tl: "Text"
    )
    static let buddyFormChannelEmail = CivicaText(
        "Email",
        es: "Correo",
        zh: "邮件",
        vi: "Email",
        tl: "Email"
    )
    static let buddyFormContactPlaceholderSMS = CivicaText(
        "(555) 555-0123",
        es: "(555) 555-0123"
    )
    static let buddyFormContactPlaceholderEmail = CivicaText(
        "maria@example.com",
        es: "maria@ejemplo.com"
    )
    static let buddyFormSendCTA = CivicaText(
        "Send invite",
        es: "Enviar invitación",
        zh: "发送邀请",
        vi: "Gửi lời mời",
        tl: "Ipadala ang imbitasyon"
    )
    static let buddyFormPrivacyNote = CivicaText(
        "They'll only see your application status, deadlines, and what's left to do — never your documents, income details, or address.",
        es: "Solo verán el estado de tu solicitud, las fechas límite y lo que falta — nunca tus documentos, ingresos ni dirección.",
        zh: "他们只能看到你的申请状态、截止日期和还要做什么 — 永远看不到你的文件、收入详情或地址。",
        vi: "Họ chỉ thấy trạng thái đơn của bạn, các hạn chót và việc còn lại cần làm — không bao giờ thấy giấy tờ, chi tiết thu nhập hay địa chỉ của bạn.",
        tl: "Makikita lang nila ang status ng aplikasyon mo, mga deadline, at ang natitira pang gawin — hindi kailanman ang iyong mga dokumento, detalye ng kita, o address."
    )

    // Invite sent
    static func buddyInviteSentTitle(name: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Invite sent to \(name)"
        case .spanish: return "Invitación enviada a \(name)"
        case .mandarin: return "邀请已发送给 \(name)"
        case .vietnamese: return "Đã gửi lời mời cho \(name)"
        case .tagalog: return "Naipadala ang imbitasyon kay \(name)"
        }
    }
    static let buddyInviteSentBody = CivicaText(
        "They'll get a one-time link to follow along. You can re-send it any time from this screen.",
        es: "Recibirán un enlace único para seguir el proceso. Puedes reenviarlo en cualquier momento desde esta pantalla.",
        zh: "他们会收到一个一次性的链接来跟进。你随时可以在这个页面重新发送。",
        vi: "Họ sẽ nhận một đường liên kết dùng một lần để theo dõi. Bạn có thể gửi lại bất cứ lúc nào từ màn hình này.",
        tl: "Makakakuha sila ng isang beses na link para makasubaybay. Maaari mong ipadala itong muli anumang oras mula sa screen na ito."
    )
    static let buddyInviteSentLinkLabel = CivicaText(
        "Their private invite link",
        es: "Su enlace privado de invitación",
        zh: "他们的私人邀请链接",
        vi: "Đường liên kết mời riêng của họ",
        tl: "Ang kanilang pribadong link ng imbitasyon"
    )
    static let buddyInviteSentShareCTA = CivicaText(
        "Share invite link",
        es: "Compartir enlace de invitación",
        zh: "分享邀请链接",
        vi: "Chia sẻ đường liên kết mời",
        tl: "I-share ang link ng imbitasyon"
    )
    /// `subject:` for the ShareLink (email subject when the share is
    /// routed to Mail). Recipient may be a different locale than the
    /// sender — but iOS share sheets use the sender's locale, so we
    /// resolve in the user's preferred language.
    static let buddyInviteShareSubject = CivicaText(
        "Civica buddy invite",
        es: "Invitación de compañero de Civica",
        zh: "Civica 伙伴邀请",
        vi: "Lời mời bạn đồng hành Civica",
        tl: "Imbitasyon ng buddy sa Civica"
    )
    static let buddyInviteSentDoneCTA = CivicaText(
        "Back to my application",
        es: "Volver a mi solicitud",
        zh: "返回我的申请",
        vi: "Quay lại đơn của tôi",
        tl: "Balik sa aking aplikasyon"
    )
    static let buddyInviteSentRemoveCTA = CivicaText(
        "Remove buddy",
        es: "Quitar compañero",
        zh: "移除伙伴",
        vi: "Xóa bạn đồng hành",
        tl: "Alisin ang buddy"
    )
}

// MARK: - Buddy intro + invite flow (dummy demo)

/// Three-panel visual story explaining the buddy system. Auto-presents
/// the first time a user enters the SNAP apply flow; thereafter
/// re-openable from the persistent banner.
///
/// Push navigation inside the sheet:
///   Intro → InviteForm → InviteSent
///
/// The CTAs are end-to-end functional in the demo sense: tapping
/// "Add a buddy now" pushes a real form, "Send invite" persists the
/// dummy buddy via @AppStorage and shows a success screen with a real
/// iOS share-sheet on a stub link. Backend wire-up (POST /buddy/invite)
/// replaces the SimulatedBuddyService stub when that lands.
private struct BuddyApplyIntroView: View {
    let language: CivicaLanguage
    @Binding var buddyName: String
    @Binding var buddyContact: String
    let onDismiss: () -> Void

    @Environment(\.dismiss) private var dismiss

    /// On re-entry with an existing buddy, jump straight to the sent
    /// screen so the user can re-share or remove. Set on appear so the
    /// NavigationStack push animation runs naturally.
    @State private var deepLinkToSent: Bool = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                    header
                    stepsCard
                    ctaStack
                    comingSoonNote
                }
                .padding(CivicaSpacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(CivicaColors.paper.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        onDismiss()
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .imageScale(.large)
                            .font(.body)
                            .foregroundStyle(CivicaColors.graphite.opacity(0.6))
                    }
                    .accessibilityLabel("Close")
                }
            }
            .navigationDestination(isPresented: $deepLinkToSent) {
                BuddyInviteSentView(
                    language: language,
                    buddyName: $buddyName,
                    buddyContact: $buddyContact,
                    onDone: {
                        onDismiss()
                        dismiss()
                    }
                )
            }
            .onAppear {
                if !buddyName.isEmpty {
                    deepLinkToSent = true
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.md) {
                Image(systemName: "person.2.fill")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(width: 56, height: 56)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                            .fill(CivicaColors.pinePrimary.opacity(0.14))
                    )
                    .accessibilityHidden(true)
                Spacer()
            }
            Text(CivicaSNAPFlowStrings.buddyModalEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .kerning(1.2)
            Text(CivicaSNAPFlowStrings.buddyModalTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(CivicaSNAPFlowStrings.buddyModalSubtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var stepsCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            stepRow(
                number: 1,
                icon: "pencil.and.list.clipboard",
                title: CivicaSNAPFlowStrings.buddyStep1Title.value(in: language),
                body: CivicaSNAPFlowStrings.buddyStep1Body.value(in: language)
            )
            Divider().background(CivicaColors.hairline)
            stepRow(
                number: 2,
                icon: "link",
                title: CivicaSNAPFlowStrings.buddyStep2Title.value(in: language),
                body: CivicaSNAPFlowStrings.buddyStep2Body.value(in: language)
            )
            Divider().background(CivicaColors.hairline)
            stepRow(
                number: 3,
                icon: "checklist",
                title: CivicaSNAPFlowStrings.buddyStep3Title.value(in: language),
                body: CivicaSNAPFlowStrings.buddyStep3Body.value(in: language)
            )
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

    private func stepRow(number: Int, icon: String, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            ZStack {
                Circle()
                    .fill(CivicaColors.pinePrimary)
                    .frame(width: 32, height: 32)
                Text("\(number)")
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.onPrimaryText)
            }
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                HStack(spacing: CivicaSpacing.xs) {
                    Image(systemName: icon)
                        .imageScale(.large)
                        .font(.body)
                        .foregroundStyle(CivicaColors.pinePrimary)
                        .accessibilityHidden(true)
                    Text(title)
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                }
                Text(body)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step \(number). \(title). \(body)")
    }

    private var ctaStack: some View {
        VStack(spacing: CivicaSpacing.sm) {
            NavigationLink {
                BuddyInviteFormView(
                    language: language,
                    buddyName: $buddyName,
                    buddyContact: $buddyContact,
                    onDone: {
                        onDismiss()
                        dismiss()
                    }
                )
            } label: {
                Text(CivicaSNAPFlowStrings.buddyModalPrimaryCTA.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.onPrimaryText)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.control)
                            .fill(CivicaColors.pinePrimary)
                    )
            }
            .buttonStyle(.plain)
            Button {
                onDismiss()
                dismiss()
            } label: {
                Text(CivicaSNAPFlowStrings.buddyModalSecondaryCTA.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.plain)
        }
    }

    private var comingSoonNote: some View {
        HStack(spacing: CivicaSpacing.sm) {
            Image(systemName: "info.circle")
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
            Text(CivicaSNAPFlowStrings.buddyModalComingSoon.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Buddy invite form (dummy)

/// Name + channel + contact form for the dummy invite flow. On
/// "Send invite" simulates a 700ms RPC round-trip with a progress
/// spinner, writes the buddy to @AppStorage, and pushes the success
/// screen. No real network call; backend wire-up swaps the sleep for
/// a POST /buddy/invite.
private struct BuddyInviteFormView: View {
    enum Channel: String, CaseIterable, Identifiable {
        case sms, email
        var id: String { rawValue }
    }

    let language: CivicaLanguage
    @Binding var buddyName: String
    @Binding var buddyContact: String
    let onDone: () -> Void

    @State private var nameDraft: String = ""
    @State private var contactDraft: String = ""
    @State private var channel: Channel = .sms
    @State private var isSending: Bool = false
    @State private var navigateToSent: Bool = false

    private var canSend: Bool {
        !nameDraft.trimmingCharacters(in: .whitespaces).isEmpty &&
        !contactDraft.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                Text(CivicaSNAPFlowStrings.buddyFormSubtitle.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)

                nameField
                channelPicker
                contactField
                privacyNote
                sendButton
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(CivicaSNAPFlowStrings.buddyFormTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(isPresented: $navigateToSent) {
            BuddyInviteSentView(
                language: language,
                buddyName: $buddyName,
                buddyContact: $buddyContact,
                onDone: onDone
            )
        }
    }

    private var nameField: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(CivicaSNAPFlowStrings.buddyFormNameLabel.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
            TextField(
                CivicaSNAPFlowStrings.buddyFormNamePlaceholder.value(in: language),
                text: $nameDraft
            )
            .textContentType(.name)
            .padding(CivicaSpacing.md)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .fill(CivicaColors.surfaceSecondary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
    }

    private var channelPicker: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(CivicaSNAPFlowStrings.buddyFormChannelLabel.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
            Picker("Channel", selection: $channel) {
                Text(CivicaSNAPFlowStrings.buddyFormChannelSMS.value(in: language)).tag(Channel.sms)
                Text(CivicaSNAPFlowStrings.buddyFormChannelEmail.value(in: language)).tag(Channel.email)
            }
            .pickerStyle(.segmented)
            .onChange(of: channel) { _, _ in contactDraft = "" }
        }
    }

    private var contactField: some View {
        TextField(
            channel == .sms
                ? CivicaSNAPFlowStrings.buddyFormContactPlaceholderSMS.value(in: language)
                : CivicaSNAPFlowStrings.buddyFormContactPlaceholderEmail.value(in: language),
            text: $contactDraft
        )
        .keyboardType(channel == .sms ? .phonePad : .emailAddress)
        .textContentType(channel == .sms ? .telephoneNumber : .emailAddress)
        .autocapitalization(.none)
        .padding(CivicaSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.control)
                .fill(CivicaColors.surfaceSecondary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.control)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private var privacyNote: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: "lock.shield")
                .foregroundStyle(CivicaColors.pinePrimary)
                .accessibilityHidden(true)
            Text(CivicaSNAPFlowStrings.buddyFormPrivacyNote.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.md)
        .background(CivicaColors.pineSurface.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    private var sendButton: some View {
        Button {
            sendInvite()
        } label: {
            HStack(spacing: CivicaSpacing.sm) {
                if isSending {
                    ProgressView()
                        .tint(CivicaColors.onPrimaryText)
                }
                Text(CivicaSNAPFlowStrings.buddyFormSendCTA.value(in: language))
            }
            .font(CivicaTypography.subheadStrong)
            .foregroundStyle(CivicaColors.onPrimaryText)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .fill(canSend ? CivicaColors.pinePrimary : CivicaColors.pinePrimaryDisabled)
            )
        }
        .buttonStyle(.plain)
        .disabled(!canSend || isSending)
    }

    private func sendInvite() {
        let trimmedName = nameDraft.trimmingCharacters(in: .whitespaces)
        let trimmedContact = contactDraft.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty, !trimmedContact.isEmpty else { return }
        isSending = true
        // Simulated round-trip — replace with POST /buddy/invite when
        // the iOS side of buddy wire-up lands.
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 700_000_000)
            buddyName = trimmedName
            buddyContact = trimmedContact
            isSending = false
            navigateToSent = true
        }
    }
}

// MARK: - Buddy invite sent (dummy)

/// Success surface. Displays the buddy's name, a stub invite link with
/// a real iOS ShareLink so the share sheet actually opens, and a
/// "Remove buddy" path that clears the @AppStorage bindings. The link
/// itself is a deterministic stub keyed on the saved contact —
/// good enough for screenshots / demos without making any real network
/// call. Replace with the gateway's returned `invite_url` once
/// POST /buddy/invite is wired up.
private struct BuddyInviteSentView: View {
    let language: CivicaLanguage
    @Binding var buddyName: String
    @Binding var buddyContact: String
    let onDone: () -> Void

    @Environment(\.dismiss) private var dismiss

    private var inviteLink: URL {
        // Deterministic stub. Hash the contact so the link looks
        // unique per buddy without exposing the actual PII in the path.
        let token = String(abs(buddyContact.hashValue), radix: 36).prefix(10)
        return URL(string: "https://civica.app/b/\(token)")!
    }

    private var shareMessage: String {
        switch language {
        case .english:
            return "Hey \(buddyName) — I'm applying for SNAP through Civica and could use a buddy to help me stay on top of deadlines. Tap this private link to follow along: \(inviteLink.absoluteString)"
        case .spanish:
            return "Hola \(buddyName) — Estoy solicitando SNAP a través de Civica y me ayudaría tener un compañero pendiente de las fechas. Toca este enlace privado para seguir el proceso: \(inviteLink.absoluteString)"
        case .mandarin:
            return "嗨 \(buddyName) — 我正在通过 Civica 申请 SNAP,想请你做我的伙伴,帮我盯紧各项截止日期。点击这个私人链接来跟进:\(inviteLink.absoluteString)"
        case .vietnamese:
            return "Chào \(buddyName) — mình đang nộp đơn SNAP qua Civica và muốn nhờ bạn làm người đồng hành để giúp mình theo dõi các hạn chót. Chạm vào đường liên kết riêng này để theo dõi cùng mình: \(inviteLink.absoluteString)"
        case .tagalog:
            return "Uy \(buddyName) — nag-a-apply ako ng SNAP sa Civica at gusto sana kitang maging buddy para matulungan akong masubaybayan ang mga deadline. I-tap ang pribadong link na ito para makasama sa pagsubaybay: \(inviteLink.absoluteString)"
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                successHeader
                linkCard
                shareButton
                Divider().padding(.vertical, CivicaSpacing.sm)
                doneButton
                removeButton
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
    }

    private var successHeader: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Image(systemName: "checkmark.seal.fill")
                .imageScale(.large)
                .font(.body)
                .foregroundStyle(CivicaColors.pinePrimary)
                .accessibilityHidden(true)
            Text(CivicaSNAPFlowStrings.buddyInviteSentTitle(name: buddyName, language: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(CivicaSNAPFlowStrings.buddyInviteSentBody.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, CivicaSpacing.sm)
    }

    private var linkCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(CivicaSNAPFlowStrings.buddyInviteSentLinkLabel.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.0)
            HStack {
                Text(inviteLink.absoluteString)
                    .font(CivicaTypography.footnoteStrong.monospaced())
                    .foregroundStyle(CivicaColors.ink)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer()
                Image(systemName: "link")
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .accessibilityHidden(true)
            }
            .padding(CivicaSpacing.md)
            .background(CivicaColors.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
    }

    private var shareButton: some View {
        ShareLink(
            item: shareMessage,
            subject: Text(CivicaSNAPFlowStrings.buddyInviteShareSubject.value(in: language))
        ) {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "square.and.arrow.up")
                Text(CivicaSNAPFlowStrings.buddyInviteSentShareCTA.value(in: language))
            }
            .font(CivicaTypography.subheadStrong)
            .foregroundStyle(CivicaColors.onPrimaryText)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .fill(CivicaColors.pinePrimary)
            )
        }
    }

    private var doneButton: some View {
        Button {
            onDone()
        } label: {
            Text(CivicaSNAPFlowStrings.buddyInviteSentDoneCTA.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.pinePrimary)
                .frame(maxWidth: .infinity, minHeight: 44)
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .strokeBorder(CivicaColors.pinePrimary, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    private var removeButton: some View {
        Button(role: .destructive) {
            buddyName = ""
            buddyContact = ""
            dismiss()
        } label: {
            Text(CivicaSNAPFlowStrings.buddyInviteSentRemoveCTA.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.brickAccent)
                .frame(maxWidth: .infinity, minHeight: 44)
        }
        .buttonStyle(.plain)
    }
}

#if DEBUG
struct CivicaSNAPFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            CivicaSNAPFlowView(language: .english)
                .environmentObject(SNAPApplicationStatusStore())
        }
    }
}
#endif
