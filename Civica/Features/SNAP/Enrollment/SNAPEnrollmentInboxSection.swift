import CivicaDesignSystem
import SwiftUI

// Self-contained inbox section for the waiting room.
// Fetches EnrollmentInboxItem records from the navigator API on appear
// and renders them as a card list. Unresolved items get an amber
// attention treatment; resolved items are muted with a checkmark.
//
// Returns EmptyView when auth is unavailable, loading fails, or there
// are no items — the waiting room body is unaffected.

struct SNAPEnrollmentInboxSection: View {
    let language: CivicaLanguage
    /// Changing this value re-triggers the inbox fetch. Pass a new UUID after a
    /// document upload so resolved items disappear without requiring a full view reload.
    var refreshID: AnyHashable = 0

    @EnvironmentObject private var enrollmentAuth: CivicaEnrollmentAuth

    @State private var items: [EnrollmentInboxItem] = []
    @State private var isLoading = false

    var body: some View {
        if isLoading {
            HStack {
                ProgressView()
                    .tint(CivicaColors.pinePrimary)
                Text(Strings.loading.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            }
        } else if !items.isEmpty {
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Text(Strings.sectionTitle.value(in: language))
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)

                ForEach(sortedItems) { item in
                    inboxCard(item)
                }
            }
        }
    }

    // MARK: - Card

    private func inboxCard(_ item: EnrollmentInboxItem) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: item.resolved ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                .imageScale(.large)
                .font(.body)
                .foregroundStyle(item.resolved ? CivicaColors.amberPrimary : CivicaColors.warningAmber)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(item.prompt)
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(item.resolved ? CivicaColors.graphite : CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)

                Text(formattedDate(item.createdAt))
                    .font(CivicaTypography.caption)
                    .foregroundStyle(CivicaColors.muted)
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(item.resolved
            ? CivicaColors.surfaceSecondary
            : CivicaColors.warningAmber.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(
                    item.resolved ? CivicaColors.hairline : CivicaColors.warningAmber.opacity(0.4),
                    lineWidth: 1
                )
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(item.resolved
            ? "\(Strings.resolvedA11y.value(in: language)). \(item.prompt)"
            : "\(Strings.pendingA11y.value(in: language)). \(item.prompt)"
        )
    }

    // MARK: - Helpers

    /// Unresolved items first, then resolved, newest-first within each group.
    private var sortedItems: [EnrollmentInboxItem] {
        let unresolved = items.filter { !$0.resolved }.sorted { $0.createdAt > $1.createdAt }
        let resolved   = items.filter {  $0.resolved }.sorted { $0.createdAt > $1.createdAt }
        return unresolved + resolved
    }

    private func formattedDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        f.locale = language == .spanish ? Locale(identifier: "es") : Locale(identifier: "en_US")
        return f.string(from: date)
    }

    // MARK: - Fetch

    private func fetchIfAuthenticated() async {
        guard enrollmentAuth.state.isAuthenticated else { return }
        let client = enrollmentAuth.makeEnrollmentAPIClient()
        isLoading = true
        defer { isLoading = false }
        if let fetched = try? await client.fetchInbox() {
            items = fetched
        }
    }

    // MARK: - Task modifier

    // Called by task { } in body — placed here so the previews
    // can trigger it independently if needed.
    func fetchInbox() async {
        await fetchIfAuthenticated()
    }
}

// MARK: - View + task wiring

extension SNAPEnrollmentInboxSection {
    /// Fires the fetch on appear and whenever `refreshID` changes.
    func fetchOnAppear() -> some View {
        self.task(id: refreshID) { await fetchIfAuthenticated() }
    }
}

// MARK: - Strings

private enum Strings {
    static let sectionTitle = CivicaText("From your navigator", es: "De tu navigator", zh: "来自你的 navigator", vi: "Từ navigator của bạn")
    static let loading      = CivicaText("Checking for messages…", es: "Buscando mensajes…", zh: "正在查看消息…", vi: "Đang kiểm tra tin nhắn…")
    static let resolvedA11y = CivicaText("Resolved", es: "Resuelto", zh: "已解决", vi: "Đã xử lý")
    static let pendingA11y  = CivicaText("Action needed", es: "Acción requerida", zh: "需要处理", vi: "Cần xử lý")
}

#if DEBUG
struct SNAPEnrollmentInboxSection_Previews: PreviewProvider {
    static let sampleItems: [EnrollmentInboxItem] = [
        EnrollmentInboxItem(
            id: "1", packetId: "p1",
            prompt: "Please upload a recent pay stub or proof of income.",
            createdAt: Date().addingTimeInterval(-86400 * 2),
            resolved: false
        ),
        EnrollmentInboxItem(
            id: "2", packetId: "p1",
            prompt: "We need a copy of your most recent utility bill.",
            createdAt: Date().addingTimeInterval(-86400 * 5),
            resolved: true
        ),
    ]

    static var previews: some View {
        ScrollView {
            VStack {
                SNAPEnrollmentInboxSection(language: .english)
                    .onAppear {
                        // Items injected in preview via the in-memory path
                    }
                    .padding()
            }
        }
        .environmentObject(CivicaEnrollmentAuth())
    }
}
#endif
