import CivicaDesignSystem
import Foundation
import SwiftUI

// Phase 2 inbox / documents-requested store — wraps the existing
// `EnrollmentAPIClient.fetchInbox()` call so `CivicaHomePhase2View`
// can surface a "N documents requested" row when the navigator has
// open missing-item requests on the applicant's active packet.
//
// Reuses the same `/me/inbox` endpoint that powers the legacy
// `SNAPEnrollmentInboxSection` card list in `SNAPWaitingRoomView`.
// Same data source; new home renders a compact 1-line row instead
// of cards. The "messages-inbox" design slot on the Phase 2 home
// is left intentionally untouched here — the gateway's inbox table
// stores doc requests AND free-form prompts in one stream, and the
// applicant-facing UX gain from splitting them is unclear until a
// distinct navigator-to-applicant messaging feature exists. For
// now, "documents requested" is the right framing for the inbox.
//
// Failure-tolerant in the same way as `SNAPErrorRiskStore`: any
// error (no network, no active packet, auth missing, decode fail)
// leaves the published counts at zero and the home view hides the
// row.

@MainActor
final class SNAPInboxStore: ObservableObject {
    @Published private(set) var items: [EnrollmentInboxItem] = []
    @Published private(set) var isLoading: Bool = false
    /// IS-2 (audit 2026-05-29) — surfaces the load outcome to the
    /// coordinated `CivicaSyncBannerCoordinator`. Per-row hide on
    /// failure stays intact (`items = []` still wins for rendering);
    /// this flag is purely a signal for the cross-store banner.
    @Published private(set) var lastLoadFailed: Bool = false

    private var apiClient: (any EnrollmentAPIClient)?

    init() {}

    /// Inject the enrollment client. Idempotent.
    func bind(client: any EnrollmentAPIClient) {
        self.apiClient = client
    }

    /// Fetch the applicant's inbox. No-op when not bound.
    func load() async {
        guard let apiClient else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            items = try await apiClient.fetchInbox()
            lastLoadFailed = false
        } catch {
            // Silent fail — the home view degrades by hiding the row.
            // The IS-2 sync banner reads `lastLoadFailed` to coordinate
            // across stores.
            items = []
            lastLoadFailed = true
        }
    }

    /// Unresolved item count. Drives whether the row renders +
    /// the count in the row primary label.
    var unresolvedCount: Int {
        items.filter { !$0.resolved }.count
    }

    /// "Sent N days ago" / "Sent today" — relative-time label for
    /// the most recent unresolved request. Returns empty when no
    /// unresolved items exist.
    func relativeDueLabel(in language: CivicaLanguage) -> String {
        let mostRecent = items
            .filter { !$0.resolved }
            .max(by: { $0.createdAt < $1.createdAt })
        guard let date = mostRecent?.createdAt else { return "" }
        return SNAPInboxPhase2Strings.relativeLabel(for: date, language: language)
    }

    /// Comma-joined summary of the first up-to-3 prompts. Truncated
    /// at a sensible character budget so the row stays a single
    /// scannable line. Returns empty when no unresolved items.
    func summary(in language: CivicaLanguage, maxItems: Int = 3, charBudget: Int = 100) -> String {
        let prompts = items
            .filter { !$0.resolved }
            .sorted { $0.createdAt > $1.createdAt }
            .prefix(maxItems)
            .map { $0.prompt }

        var joined = prompts.joined(separator: SNAPInboxPhase2Strings.summaryJoiner.value(in: language))
        if joined.count > charBudget {
            // Trim at the last word boundary inside the budget.
            let idx = joined.index(joined.startIndex, offsetBy: charBudget)
            let head = joined[..<idx]
            if let lastSpace = head.lastIndex(of: " ") {
                joined = String(joined[..<lastSpace]) + "…"
            } else {
                joined = String(head) + "…"
            }
        }
        return joined
    }
}

// MARK: - Strings

enum SNAPInboxPhase2Strings {
    /// Joiner between prompts in the summary line. Spanish uses the
    /// same "·" so it's locale-stable; defined here for symmetry.
    static let summaryJoiner = CivicaText(" · ", es: " · ")

    /// Relative-time label for the most recent unresolved request.
    /// English uses "today" / "yesterday" / "N days ago"; Spanish
    /// mirrors. Falls back to formatted date for older items.
    static func relativeLabel(for date: Date, language: CivicaLanguage) -> String {
        let days = Calendar.current.dateComponents([.day], from: date, to: Date()).day ?? 0
        switch language {
        case .english:
            if days <= 0 { return "Sent today" }
            if days == 1 { return "Sent yesterday" }
            if days <= 14 { return "Sent \(days) days ago" }
            let f = DateFormatter()
            f.dateFormat = "MMM d"
            return "Sent \(f.string(from: date))"
        case .mandarin:
            if days <= 0 { return "今天发送" }
            if days == 1 { return "昨天发送" }
            if days <= 14 { return "\(days) 天前发送" }
            let f = DateFormatter()
            f.dateFormat = "M月d日"
            return "\(f.string(from: date)) 发送"
        case .spanish:
            if days <= 0 { return "Enviado hoy" }
            if days == 1 { return "Enviado ayer" }
            if days <= 14 { return "Enviado hace \(days) días" }
            let f = DateFormatter()
            f.dateFormat = "d 'de' MMM"
            return "Enviado el \(f.string(from: date))"
        case .vietnamese:
            if days <= 0 { return "Đã gửi hôm nay" }
            if days == 1 { return "Đã gửi hôm qua" }
            if days <= 14 { return "Đã gửi \(days) ngày trước" }
            let f = DateFormatter()
            f.dateFormat = "d MMM"
            return "Đã gửi ngày \(f.string(from: date))"
        case .tagalog:
            if days <= 0 { return "Ipinadala ngayong araw" }
            if days == 1 { return "Ipinadala kahapon" }
            if days <= 14 { return "Ipinadala \(days) araw na ang nakalipas" }
            let f = DateFormatter()
            f.dateFormat = "MMM d"
            return "Ipinadala noong \(f.string(from: date))"
        }
    }
}
