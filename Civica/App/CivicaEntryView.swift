import CivicaDesignSystem
import SwiftUI

// Civica cold-start home — Phase 1 (Enroll) of the three-phase main
// screen. Rendered by CivicaRootView.rootSurface only when the user
// hasn't yet submitted to the state (status .notStarted, plus the
// active-case-pre-submission states reached via the rootSurface
// .isActiveCase branch when SNAPReturningUserHomeView is replaced).
//
// Replaces the legacy 6-tile column (Apply / Estimator / EBT / Find
// help / Buddy / Interview Coach / Recert) which the May 2026 design
// review flagged as AI-slop — every entry point carried equal visual
// weight, the icon-in-tinted-rectangle pattern was a textbook
// repeating-card grid, and "Apply for SNAP" (the primary action) had
// no more affordance than "Add a buddy" (a coming-soon placeholder).
//
// New shape: one filled-pine hero card that owns "Apply for SNAP"
// outright, an inline estimator off-ramp for the hesitation path,
// and two hairline-separated secondary rows for utility entry points
// (find food today / check EBT balance for existing recipients).
// Buddy and Interview Coach are dropped from cold-start — Buddy
// because its destination is a coming-soon placeholder, Interview
// Coach because it belongs on Phase 2 when status .interviewScheduled.

struct CivicaEntryView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    /// Offers-aware EBT entry. The base branch (`codex/rebuild-feb18`
    /// post PR #272) wires the EBT root with an authenticated offers
    /// client when the user is signed in; preserve that contract on
    /// the new secondary row so the offers feature continues to surface.
    @EnvironmentObject private var enrollmentAuth: CivicaEnrollmentAuth

    @State private var presentingDebugMenu = false
    /// Captured once on appear; nil means "not yet loaded" (avoids a
    /// visible flash between the skeleton and the resolved state on
    /// first render).
    @State private var draftLoadResult: Result<SNAPApplicationDraftStore.PersistedState, DraftLoadError>? = nil

    /// Optional handler so a DEBUG `CivicaPhaseTab` can swap the
    /// rendered phase from outside this view without mutating the
    /// underlying SNAPApplicationStatusStore. Production builds
    /// ignore this — the tab is only wired in DEBUG.
    var onDebugPhaseChange: ((CivicaPhase) -> Void)? = nil

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    private var hasActiveDraft: Bool {
        if case .success = draftLoadResult { return true }
        return false
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                phaseTab
                if let loadError = draftLoadError {
                    draftFallbackCard(error: loadError)
                }
                heroCard
                estimatorOffRamp
                hairline
                secondaryRows
                Spacer(minLength: CivicaSpacing.xl)
                privacyFooterLink
                versionFooter
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
        // Phase 1 (start-here) intentionally omits .civicaNavWordmark() —
        // the hero card already carries the wheat sticker; the nav-bar mark
        // would double up on the same surface. Phase 2/3 keep their nav
        // wordmark because they don't have a hero-card sticker equivalent.
        .sheet(isPresented: $presentingDebugMenu) {
            DebugMenuView()
        }
        .onAppear {
            let result = SNAPApplicationDraftStore().loadResult()
            draftLoadResult = result
            if case .failure(let error) = result, case .empty = error {
                // .empty is normal; no telemetry needed
            } else if case .failure(let error) = result {
                SNAPAnalytics.trackDraftLoadFailure(error: error)
            }
        }
    }

    // MARK: - Draft load error (non-empty failures only)

    /// Returns the load error when the disk had bytes that couldn't be
    /// decoded. Returns nil for .success (normal resume) or .empty
    /// (normal new-user path) — both of those don't need a card.
    private var draftLoadError: DraftLoadError? {
        guard case .failure(let error) = draftLoadResult else { return nil }
        if case .empty = error { return nil }
        return error
    }

    // MARK: - Phase tab (moved off the home — now lives in the gear)

    /// Phase indicator no longer renders on the home surface. The
    /// reviewer-facing phase picker has moved into the settings sheet
    /// (gear) under "Demo mode" so it never bleeds into the
    /// applicant-facing UI even when demo mode is on. `onDebugPhaseChange`
    /// is still threaded through the view because SwiftUI Previews
    /// inject it directly to drive the inline preview tabs — production
    /// & device builds get an empty view here.
    @ViewBuilder
    private var phaseTab: some View {
        EmptyView()
    }

    // MARK: - Draft fallback card (IS-9)

    /// Rendered above the hero when a draft existed on disk but
    /// couldn't be decoded. Presents two recovery CTAs so the user
    /// isn't silently dropped into a "Start" flow and surprised.
    ///
    /// NOT marked `@ViewBuilder`: the body opens with a `let bodyText`
    /// + switch-assignment block before the returned VStack. With
    /// `@ViewBuilder` applied, the result builder reads each top-level
    /// statement as a view expression and fails on the switch with
    /// "type '()' cannot conform to 'View'". The function returns a
    /// single composed VStack anyway, so the annotation is redundant.
    private func draftFallbackCard(error: DraftLoadError) -> some View {
        let bodyText: String = {
            switch error {
            case .schemaMismatch:
                return CivicaEntryStrings.draftFallbackBodySchemaMismatch.value(in: language)
            case .ioError:
                return CivicaEntryStrings.draftFallbackBodyIOError.value(in: language)
            case .decodingError, .empty:
                return CivicaEntryStrings.draftFallbackBodyDecoding.value(in: language)
            }
        }()

        return VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(CivicaEntryStrings.draftFallbackTitle.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.destructive)

            Text(bodyText)
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: CivicaSpacing.sm) {
                NavigationLink {
                    CivicaSNAPFlowView(language: language)
                } label: {
                    Text(CivicaEntryStrings.draftFallbackRerunCTA.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.pinePrimary)
                }
                .buttonStyle(.plain)

                Text("·")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)

                Button {
                    SNAPApplicationDraftStore().clear()
                    draftLoadResult = .failure(.empty)
                } label: {
                    Text(CivicaEntryStrings.draftFallbackStartFreshCTA.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.graphite)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.statusErrorSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    // MARK: - Hero card (filled pine, owns the primary action)

    private var heroCard: some View {
        NavigationLink {
            CivicaSNAPFlowView(language: language)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Text(CivicaEntryStrings.heroEyebrow.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.onPrimaryText.opacity(0.72))
                    .textCase(.uppercase)
                    .kerning(1.2)
                    .padding(.bottom, CivicaSpacing.sm)

                Text(CivicaEntryStrings.heroTitle.value(in: language))
                    .font(CivicaTypography.pageTitle)
                    .foregroundStyle(CivicaColors.onPrimaryText)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                    .padding(.bottom, CivicaSpacing.sm)

                Text(CivicaEntryStrings.heroBody.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.onPrimaryText.opacity(0.82))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, CivicaSpacing.md)

                Rectangle()
                    .fill(CivicaColors.onPrimaryText.opacity(0.18))
                    .frame(height: 1)
                    .padding(.bottom, CivicaSpacing.md)

                HStack(spacing: CivicaSpacing.sm) {
                    Text(
                        hasActiveDraft
                            ? CivicaEntryStrings.heroResumeCTA.value(in: language)
                            : CivicaEntryStrings.heroStartCTA.value(in: language)
                    )
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.onPrimaryText)
                    Spacer(minLength: 0)
                    Image(systemName: "arrow.right")
                        .foregroundStyle(CivicaColors.onPrimaryText)
                        .accessibilityHidden(true)
                }
                .frame(minHeight: 24)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.pinePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(alignment: .topTrailing) {
                Image("civica-wheat-logo")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 64, height: 64)
                    .padding(4)
                    .accessibilityHidden(true)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(
            "\(CivicaEntryStrings.heroTitle.value(in: language)). \(CivicaEntryStrings.heroBody.value(in: language))"
        )
    }

    // MARK: - Estimator off-ramp (inline link, NOT a tile)

    /// Hesitation off-ramp for users who suspect they might not
    /// qualify. Rendered as inline copy with a tappable pine link,
    /// not as a peer-of-Apply tile — the design review surfaced
    /// that giving estimator equal visual weight to the application
    /// itself was costing primary-action conversion. Preserves the
    /// SNAPCoveragePolicy unsupported-state gate from the legacy
    /// estimatorTile.
    private var estimatorOffRamp: some View {
        NavigationLink {
            estimatorDestination
        } label: {
            HStack(spacing: CivicaSpacing.xs) {
                Text(CivicaEntryStrings.estimatorOffRampPrompt.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                Text(CivicaEntryStrings.estimatorOffRampLink.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
            }
            .padding(.vertical, CivicaSpacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var estimatorDestination: some View {
        let persistedState = SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode
        if SNAPCoveragePolicy.shouldShowUnsupportedStateGate(for: persistedState) {
            SNAPUnsupportedStateView(
                stateCode: persistedState ?? "",
                language: language,
                onChangeState: {},
                onExit: {}
            )
        } else {
            SNAPEstimatorFlowView(language: language)
        }
    }

    // MARK: - Secondary rows (find help · EBT balance)

    private var hairline: some View {
        Rectangle()
            .fill(CivicaColors.hairline)
            .frame(height: 1)
    }

    private var secondaryRows: some View {
        VStack(alignment: .leading, spacing: 0) {
            findHelpRow
            hairline
            ebtBalanceRow
        }
    }

    private var findHelpRow: some View {
        NavigationLink {
            FindHelpRootView()
        } label: {
            secondaryRowLabel(
                icon: "fork.knife",
                eyebrow: CivicaEntryStrings.findHelpRowEyebrow.value(in: language),
                link: CivicaEntryStrings.findHelpRowLink.value(in: language)
            )
        }
        .buttonStyle(.plain)
    }

    private var ebtBalanceRow: some View {
        NavigationLink {
            // Preserves the PR #272 offers wiring on the new secondary
            // row: authenticated users get an offers-aware EBT root;
            // anonymous users get the fixture-only stack. Both paths
            // are nil-safe in EBTBalanceRootView's init.
            EBTBalanceRootView(
                offersAPIClient: enrollmentAuth.state.isAuthenticated
                    ? enrollmentAuth.makeOffersAPIClient()
                    : nil
            )
        } label: {
            secondaryRowLabel(
                icon: "creditcard",
                eyebrow: CivicaEntryStrings.ebtBalanceRowEyebrow.value(in: language),
                link: CivicaEntryStrings.ebtBalanceRowLink.value(in: language)
            )
        }
        .buttonStyle(.plain)
    }

    private func secondaryRowLabel(icon: String, eyebrow: String, link: String) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            Image(systemName: icon)
                .imageScale(.large)
                .font(.body)
                .foregroundStyle(CivicaColors.ink)
                .frame(width: 32, alignment: .leading)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(eyebrow)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                Text(link)
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
            }
            Spacer(minLength: CivicaSpacing.sm)
            Image(systemName: "chevron.right")
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
        }
        .padding(.vertical, CivicaSpacing.md)
        .padding(.horizontal, CivicaSpacing.xs)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(eyebrow). \(link)")
    }

    // MARK: - Privacy footer

    /// Combines the existing "Your data + privacy" entry point with
    /// the "Civica · public-benefit project" trust signal selected
    /// during the C2 design refinement — resolves the
    /// "state-of-California" copy fact-check question with honest,
    /// non-endorsement language.
    private var privacyFooterLink: some View {
        NavigationLink {
            SNAPDataPrivacyView(language: language)
        } label: {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "lock.shield")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
                Text(CivicaEntryStrings.privacyLink.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .underline()
                Text(CivicaEntryStrings.publicBenefitTag.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite.opacity(0.6))
                Spacer(minLength: 0)
            }
            .padding(.vertical, CivicaSpacing.sm)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(CivicaEntryStrings.privacyLink.value(in: language))
    }

    // MARK: - Version footer (preserved 5-tap debug menu)

    /// Tiny, low-contrast version stamp. Tapped 5 times in a row it
    /// pops the QA debug menu. Standard iOS hidden-affordance
    /// pattern; not discoverable to normal users. Preserved verbatim
    /// from the legacy entry view — design review D7.
    private var versionFooter: some View {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        return HStack {
            Spacer()
            Text("v\(version) (\(build))")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .onTapGesture(count: 5) {
                    presentingDebugMenu = true
                }
                .accessibilityHidden(true)
            Spacer()
        }
        .padding(.top, CivicaSpacing.md)
    }
}

// MARK: - Strings

enum CivicaEntryStrings {
    // ─── Phase 1 hero ──────────────────────────────────────────────

    static let heroEyebrow = CivicaText(
        "Start here",
        es: "Empieza aquí",
        zh: "从这里开始",
        vi: "Bắt đầu tại đây",
        tl: "Magsimula dito"
    )
    static let heroTitle = CivicaText(
        "Apply for SNAP",
        es: "Solicita SNAP",
        zh: "申请 SNAP",
        vi: "Đăng ký SNAP",
        tl: "Mag-apply para sa SNAP"
    )
    // Entry runs before the user picks a state, so the body stays
    // state-neutral here ("SNAP food assistance"). The state-conditioned
    // wording ("CalFresh" for CA, "DTA SNAP" for MA) is applied
    // downstream by SNAPAgencyDirectory once the state question is
    // answered.
    static let heroBody = CivicaText(
        "SNAP food assistance. About 15 minutes. Save anytime, no commitment to submit.",
        es: "Asistencia alimentaria de SNAP. Unos 15 minutos. Guarda en cualquier momento; no hay compromiso de enviar.",
        zh: "SNAP 食品援助。大约 15 分钟。随时可以保存,无需承诺提交。",
        vi: "Hỗ trợ thực phẩm SNAP. Khoảng 15 phút. Lưu bất cứ lúc nào, không bắt buộc phải nộp.",
        tl: "Tulong sa pagkain ng SNAP. Mga 15 minuto. Pwede mong i-save anumang oras, walang obligasyong mag-submit."
    )
    static let heroStartCTA = CivicaText(
        "Start your application",
        es: "Empieza tu solicitud",
        zh: "开始申请",
        vi: "Bắt đầu đơn của bạn",
        tl: "Simulan ang iyong aplikasyon"
    )
    static let heroResumeCTA = CivicaText(
        "Resume your application",
        es: "Continúa tu solicitud",
        zh: "继续申请",
        vi: "Tiếp tục đơn của bạn",
        tl: "Ituloy ang iyong aplikasyon"
    )

    // ─── Estimator off-ramp ────────────────────────────────────────

    static let estimatorOffRampPrompt = CivicaText(
        "Not sure if you qualify?",
        es: "¿No estás seguro de si calificas?",
        zh: "不确定你是否符合资格?",
        vi: "Không chắc bạn có đủ điều kiện?",
        tl: "Hindi sigurado kung qualified ka?"
    )
    static let estimatorOffRampLink = CivicaText(
        "Estimate your benefit →",
        es: "Calcula tu beneficio →",
        zh: "估算你的福利 →",
        vi: "Ước tính trợ cấp của bạn →",
        tl: "Tantyahin ang iyong benepisyo →"
    )

    // ─── Secondary rows ────────────────────────────────────────────

    static let findHelpRowEyebrow = CivicaText(
        "Need food today?",
        es: "¿Necesitas comida hoy?",
        zh: "今天需要食物吗?",
        vi: "Cần thực phẩm hôm nay?",
        tl: "Kailangan mo ng pagkain ngayon?"
    )
    static let findHelpRowLink = CivicaText(
        "Find help nearby",
        es: "Encuentra ayuda cerca",
        zh: "查找附近的援助",
        vi: "Tìm hỗ trợ gần bạn",
        tl: "Maghanap ng tulong malapit sa iyo"
    )
    // State-neutral on the entry surface; the "CalFresh" / "DTA SNAP"
    // wording is applied downstream once the state is known.
    static let ebtBalanceRowEyebrow = CivicaText(
        "Already have SNAP?",
        es: "¿Ya tienes SNAP?",
        zh: "已经有 SNAP 了?",
        vi: "Đã có SNAP?",
        tl: "May SNAP ka na?"
    )
    static let ebtBalanceRowLink = CivicaText(
        "Check your EBT balance",
        es: "Consulta tu saldo de EBT",
        zh: "查看你的 EBT 余额",
        vi: "Xem số dư EBT của bạn",
        tl: "Tingnan ang iyong EBT balance"
    )

    // ─── Draft fallback card (IS-9) ────────────────────────────────

    static let draftFallbackTitle = CivicaText(
        "We couldn't read your saved progress.",
        es: "No pudimos leer tu progreso guardado.",
        zh: "我们无法读取你保存的进度。",
        vi: "Chúng tôi không đọc được tiến trình đã lưu của bạn.",
        tl: "Hindi namin nabasa ang iyong na-save na progreso."
    )
    static let draftFallbackBodySchemaMismatch = CivicaText(
        "Your data is from an older version of the app. Re-run the screener (2 min) or start fresh.",
        es: "Tus datos son de una versión anterior de la aplicación. Vuelve a hacer el cuestionario (2 min) o empieza de nuevo.",
        zh: "你的数据来自较早版本的应用。请重新完成筛查(约 2 分钟)或从头开始。",
        vi: "Dữ liệu của bạn từ phiên bản cũ của ứng dụng. Làm lại bộ câu hỏi sàng lọc (2 phút) hoặc bắt đầu lại.",
        tl: "Ang data mo ay mula sa lumang bersyon ng app. Ulitin ang screener (2 minuto) o magsimula nang panibago."
    )
    static let draftFallbackBodyIOError = CivicaText(
        "Couldn't read your saved progress — try restarting the app. Or start fresh below.",
        es: "No se pudo leer tu progreso guardado — intenta reiniciar la app. O empieza de nuevo.",
        zh: "无法读取你保存的进度 — 请尝试重新启动应用,或在下方从头开始。",
        vi: "Không đọc được tiến trình đã lưu — hãy thử khởi động lại ứng dụng. Hoặc bắt đầu lại bên dưới.",
        tl: "Hindi nabasa ang iyong na-save na progreso — subukang i-restart ang app. O magsimula nang panibago sa ibaba."
    )
    static let draftFallbackBodyDecoding = CivicaText(
        "Your saved data appears corrupted. Re-run the screener (2 min) or start fresh.",
        es: "Tus datos guardados parecen dañados. Vuelve a hacer el cuestionario (2 min) o empieza de nuevo.",
        zh: "你保存的数据看起来已损坏。请重新完成筛查(约 2 分钟)或从头开始。",
        vi: "Dữ liệu đã lưu của bạn có vẻ bị hỏng. Làm lại bộ câu hỏi sàng lọc (2 phút) hoặc bắt đầu lại.",
        tl: "Mukhang sira ang iyong na-save na data. Ulitin ang screener (2 minuto) o magsimula nang panibago."
    )
    static let draftFallbackRerunCTA = CivicaText(
        "Re-run the screener (2 min)",
        es: "Volver a hacer el cuestionario (2 min)",
        zh: "重新完成筛查(约 2 分钟)",
        vi: "Làm lại bộ câu hỏi sàng lọc (2 phút)",
        tl: "Ulitin ang screener (2 minuto)"
    )
    static let draftFallbackStartFreshCTA = CivicaText(
        "Start fresh",
        es: "Empezar de nuevo",
        zh: "从头开始",
        vi: "Bắt đầu lại",
        tl: "Magsimula nang panibago"
    )

    // ─── Footer ────────────────────────────────────────────────────

    static let privacyLink = CivicaText(
        "Your data + privacy",
        es: "Tus datos y privacidad",
        zh: "你的数据与隐私",
        vi: "Dữ liệu và quyền riêng tư của bạn",
        tl: "Ang iyong data at privacy"
    )
    static let publicBenefitTag = CivicaText(
        "· Civica · public-benefit project",
        es: "· Civica · proyecto de beneficio público",
        zh: "· Civica · 公益项目",
        vi: "· Civica · dự án vì lợi ích công cộng",
        tl: "· Civica · proyektong para sa kapakanan ng publiko"
    )
}

#if DEBUG
struct CivicaEntryView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            CivicaEntryView()
                .environmentObject(SNAPApplicationStatusStore())
                .environmentObject(CivicaEnrollmentAuth())
        }
    }
}
#endif
