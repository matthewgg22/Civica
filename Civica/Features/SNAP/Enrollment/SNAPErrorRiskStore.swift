import CivicaDesignSystem
import Foundation
import SwiftUI

// Phase 2 error-risk store — wraps the existing
// `EnrollmentAPIClient.fetchErrorRisk(packetId:)` call so
// `CivicaHomePhase2View` can surface a "we noticed something the
// county may flag" row when the applicant's submitted packet
// scores high or medium QC risk.
//
// Reuses the gateway QC scoring engine (PR #199) that already
// powers `SNAPErrorRiskBadge` for navigators. Same endpoint, same
// data; different framing for the applicant — they don't review
// the packet, they just see a one-row prompt that the county is
// likely to ask follow-up questions, plus a factor-derived
// suggestion for what to fix.
//
// Failure-tolerant: any error (no network, no active packet,
// authentication missing, decode failure) leaves `result = nil`
// and the home view simply doesn't render the row. The home must
// never be blocked by a remote fetch failure.

@MainActor
final class SNAPErrorRiskStore: ObservableObject {
    @Published private(set) var result: ErrorRiskResult?
    @Published private(set) var isLoading: Bool = false
    /// IS-2 (audit 2026-05-29) — surfaces the load outcome to the
    /// coordinated `CivicaSyncBannerCoordinator`. Per-row hide on
    /// failure stays intact (`result = nil` still wins for rendering);
    /// this flag is purely a signal for the cross-store banner.
    @Published private(set) var lastLoadFailed: Bool = false

    private var apiClient: (any EnrollmentAPIClient)?

    /// Initialize without a client. Bind via `bind(client:)` once the
    /// view's environment is available — `CivicaEnrollmentAuth` is an
    /// `@EnvironmentObject` and isn't accessible at @StateObject
    /// initialization time.
    init() {}

    /// Inject the enrollment client. Idempotent — safe to call on
    /// every `.task` invocation (re-binding to the same client is
    /// a no-op).
    func bind(client: any EnrollmentAPIClient) {
        self.apiClient = client
    }

    /// Fetch error risk for the applicant's currently active
    /// post-submission packet. No-op when not authenticated, or
    /// when the applicant has no pending packet, or when any
    /// network error occurs.
    func load() async {
        guard let apiClient else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let packets = try await apiClient.fetchMyPackets()
            // Active = post-submission, pre-decision. Match the same
            // state space `SNAPApplicationStatus.isPostSubmission`
            // expresses on the local side.
            let pending: Set<EnrollmentPacketStatus> = [
                .submittedForReview,
                .needsDocuments,
                .needsApplicantClarification,
                .inNavigatorReview,
                .readyForHandoff,
            ]
            let activePacket = packets
                .filter { pending.contains($0.status) }
                .max(by: { (a, b) in
                    (a.submittedAt ?? a.updatedAt) < (b.submittedAt ?? b.updatedAt)
                })
            guard let activePacket else {
                result = nil
                lastLoadFailed = false
                return
            }
            let r = try await apiClient.fetchErrorRisk(packetId: activePacket.id)
            result = r
            lastLoadFailed = false
        } catch {
            // Silent fail: the home view degrades by hiding the row.
            // The IS-2 sync banner reads `lastLoadFailed` to coordinate
            // across stores.
            result = nil
            lastLoadFailed = true
        }
    }

    /// True when the home should render the error-risk row. Only
    /// fires for `.high` and `.medium` tiers — `.low` and
    /// `.incomplete` stay quiet because a row that says "you're
    /// fine" adds noise without value.
    var shouldSurface: Bool {
        guard let result else { return false }
        return result.tier == .high || result.tier == .medium
    }

    /// User-facing headline for the row. Tier-based, language-aware.
    func headline(in language: CivicaLanguage) -> String {
        guard let result else { return "" }
        switch result.tier {
        case .high:
            return SNAPErrorRiskPhase2Strings.headlineHigh.value(in: language)
        case .medium:
            return SNAPErrorRiskPhase2Strings.headlineMedium.value(in: language)
        case .low, .incomplete:
            return ""
        }
    }

    /// Factor-derived body copy. The highest-priority factor (by
    /// order in the returned `factors` array) drives the suggestion.
    /// Falls back to a generic "the county may ask for documents"
    /// when no factor matches the known set.
    func body(in language: CivicaLanguage) -> String {
        guard let result, !result.factors.isEmpty else {
            return SNAPErrorRiskPhase2Strings.bodyFallback.value(in: language)
        }
        // Use the first factor — gateway returns them in priority order.
        switch result.factors.first {
        case "earned_income_unverified":
            return SNAPErrorRiskPhase2Strings.bodyEarnedIncome.value(in: language)
        case "shelter_utility_unverified":
            return SNAPErrorRiskPhase2Strings.bodyShelterUtility.value(in: language)
        case "shared_lease_unverified":
            return SNAPErrorRiskPhase2Strings.bodySharedLease.value(in: language)
        case "assets_unverified":
            return SNAPErrorRiskPhase2Strings.bodyAssets.value(in: language)
        case "benefit_impact_unverified":
            return SNAPErrorRiskPhase2Strings.bodyBenefitImpact.value(in: language)
        default:
            return SNAPErrorRiskPhase2Strings.bodyFallback.value(in: language)
        }
    }
}

// MARK: - Strings (Phase 2 applicant-facing copy)

enum SNAPErrorRiskPhase2Strings {
    /// High-risk: county is very likely to follow up.
    static let headlineHigh = CivicaText(
        "We noticed something the county may flag",
        es: "Notamos algo que el condado podría marcar",
        zh: "我们发现了一项县里可能会标记的内容",
        vi: "Chúng tôi nhận thấy một điều mà county có thể đánh dấu",
        tl: "May napansin kami na maaaring i-flag ng county"
    )
    /// Medium-risk: some items are unverified; the county may follow
    /// up but it's less certain.
    static let headlineMedium = CivicaText(
        "A few items the county may ask about",
        es: "Algunos puntos que el condado podría preguntar",
        zh: "县里可能会问到几项内容",
        vi: "Một vài mục mà county có thể hỏi đến",
        tl: "Ilang bagay na maaaring itanong ng county"
    )

    /// Earned income — encourages Argyle connection or pay-stub upload.
    static let bodyEarnedIncome = CivicaText(
        "Your earned income isn't verified yet. Connect your pay stubs via Argyle or upload your last 3 paychecks.",
        es: "Tus ingresos del trabajo aún no están verificados. Conecta tus recibos de pago vía Argyle o sube tus últimos 3 cheques.",
        zh: "你的工作收入还没有核实。通过 Argyle 连接你的工资单,或上传最近 3 张工资单。",
        vi: "Thu nhập từ công việc của bạn chưa được xác minh. Hãy kết nối phiếu lương qua Argyle hoặc tải lên 3 phiếu lương gần nhất.",
        tl: "Hindi pa na-verify ang kita mo sa trabaho. I-connect ang iyong pay stubs sa pamamagitan ng Argyle o i-upload ang huling 3 paycheck mo."
    )
    /// Shelter / utility — encourages housing-cost documentation.
    static let bodyShelterUtility = CivicaText(
        "Your housing or utility costs aren't verified yet. Upload your most recent lease or utility statement.",
        es: "Tus gastos de vivienda o servicios aún no están verificados. Sube tu contrato de alquiler o factura de servicios más reciente.",
        zh: "你的住房或水电费还没有核实。上传你最近的租约或水电费账单。",
        vi: "Chi phí nhà ở hoặc tiện ích của bạn chưa được xác minh. Hãy tải lên hợp đồng thuê nhà hoặc hóa đơn tiện ích gần nhất.",
        tl: "Hindi pa na-verify ang gastos mo sa bahay o utilities. I-upload ang pinakabagong lease o utility bill mo."
    )
    /// Shared-lease — needs clarification on the housing arrangement.
    static let bodySharedLease = CivicaText(
        "The county may want details about your shared-living situation. Message a navigator if you have questions.",
        es: "El condado puede querer detalles sobre tu situación de vivienda compartida. Mensajea a un asesor si tienes preguntas.",
        zh: "县里可能想了解你合租生活情况的详情。如有疑问,可以给协助员发消息。",
        vi: "County có thể muốn biết chi tiết về tình trạng ở chung của bạn. Hãy nhắn tin cho người hỗ trợ nếu bạn có thắc mắc.",
        tl: "Maaaring hingin ng county ang detalye tungkol sa iyong sitwasyon ng pakikitira. Mag-message sa isang navigator kung may tanong ka."
    )
    /// Assets — needs proof of bank balances etc.
    static let bodyAssets = CivicaText(
        "Your asset amounts aren't verified yet. Upload a recent bank statement if you have one.",
        es: "Los montos de tus activos aún no están verificados. Sube un estado de cuenta bancario reciente si tienes uno.",
        zh: "你的资产金额还没有核实。如果有,请上传一份最近的银行对账单。",
        vi: "Số tiền tài sản của bạn chưa được xác minh. Hãy tải lên sao kê ngân hàng gần đây nếu bạn có.",
        tl: "Hindi pa na-verify ang halaga ng iyong assets. I-upload ang kamakailang bank statement kung mayroon ka."
    )
    /// Benefit impact — the calc is unverified.
    static let bodyBenefitImpact = CivicaText(
        "We couldn't verify how SNAP would affect your other benefits. The county will work this out during review.",
        es: "No pudimos verificar cómo SNAP afectaría tus otros beneficios. El condado lo resolverá durante la revisión.",
        zh: "我们无法核实 SNAP 会如何影响你的其他福利。县里会在审核期间处理这一点。",
        vi: "Chúng tôi không thể xác minh SNAP sẽ ảnh hưởng thế nào đến các phúc lợi khác của bạn. County sẽ xử lý điều này trong quá trình xét duyệt.",
        tl: "Hindi namin na-verify kung paano makakaapekto ang SNAP sa iyong ibang benepisyo. Aayusin ito ng county habang sinusuri."
    )
    /// Catch-all when no factor in our known set matches.
    static let bodyFallback = CivicaText(
        "The county may ask for additional documents. Tap to see what's flagged.",
        es: "El condado puede pedir documentos adicionales. Toca para ver lo marcado.",
        zh: "县里可能会要求补充材料。点击查看被标记的内容。",
        vi: "County có thể yêu cầu thêm tài liệu. Nhấn để xem những gì được đánh dấu.",
        tl: "Maaaring humingi ng karagdagang dokumento ang county. I-tap para makita kung ano ang na-flag."
    )
}