import CivicaDesignSystem
import Foundation
import Network
import SwiftUI

// IS-2 (audit 2026-05-29) — coordinated sync-degraded banner for the
// Phase 2 / Phase 3 home views.
//
// Today each store on the home (`SNAPErrorRiskStore`, `SNAPInboxStore`,
// `EBTBalanceStore`, …) silently hides its own row when its fetch
// fails. The user can't tell "nothing to show" from "we couldn't
// reach the gateway." Per-row hiding stays — but a coordinated
// failure mode (≥2 stores within a 10s window OR `NWPathMonitor`
// reports no path) now surfaces a single dismissible banner.
//
// The banner says nothing about *which* data is stale — only that
// sync is currently degraded. Once dismissed, it stays hidden for
// the rest of the session (the coordinator is created with the
// home view, so a fresh launch resets the dismissal).

@MainActor
final class CivicaSyncBannerCoordinator: ObservableObject {
    @Published private(set) var shouldShow: Bool = false
    @Published private(set) var dismissedThisSession: Bool = false

    private let failureWindow: TimeInterval
    private let failureThreshold: Int
    private let now: () -> Date

    private var failureTimestamps: [Date] = []
    private var isOffline: Bool = false

    private let pathMonitor: NWPathMonitor?

    /// - Parameters:
    ///   - failureWindow: rolling window for counting store failures (default 10s).
    ///   - failureThreshold: number of failures within the window that surface
    ///     the banner (default 2).
    ///   - now: clock seam for tests.
    ///   - startPathMonitor: when false, no `NWPathMonitor` is started — tests
    ///     drive the network signal explicitly via `handlePathUpdate(satisfied:)`.
    init(
        failureWindow: TimeInterval = 10,
        failureThreshold: Int = 2,
        now: @escaping () -> Date = Date.init,
        startPathMonitor: Bool = true
    ) {
        self.failureWindow = failureWindow
        self.failureThreshold = failureThreshold
        self.now = now

        // Swift 6 strict concurrency: every stored property must be initialized
        // before `self` can be captured in a closure (even weakly). Construct
        // the monitor + assign self.pathMonitor BEFORE wiring the
        // pathUpdateHandler closure.
        let resolvedMonitor: NWPathMonitor? = startPathMonitor ? NWPathMonitor() : nil
        self.pathMonitor = resolvedMonitor

        if let monitor = resolvedMonitor {
            monitor.pathUpdateHandler = { [weak self] path in
                let satisfied = path.status == .satisfied
                Task { @MainActor [weak self] in
                    self?.handlePathUpdate(satisfied: satisfied)
                }
            }
            monitor.start(queue: DispatchQueue.global(qos: .utility))
        }
    }

    // The audit flagged background goroutine leaks if the path monitor
    // isn't cancelled. `cancel()` is Sendable-safe so the nonisolated
    // deinit can call it directly without bouncing onto the main actor.
    deinit {
        pathMonitor?.cancel()
    }

    /// Stores call this from their `.task` block on any load failure.
    /// Two failures within `failureWindow` (default 10s) surface the banner.
    func registerStoreFailure() {
        let t = now()
        failureTimestamps = failureTimestamps.filter {
            t.timeIntervalSince($0) <= failureWindow
        }
        failureTimestamps.append(t)
        if failureTimestamps.count >= failureThreshold {
            surfaceIfNotDismissed()
        }
    }

    /// Stores call this from their `.task` block on success. Clears the
    /// rolling failure window and hides the banner — but only if the
    /// network path is still satisfied (otherwise the offline signal
    /// keeps the banner up).
    func registerStoreSuccess() {
        failureTimestamps.removeAll()
        if !isOffline {
            shouldShow = false
        }
    }

    /// User tapped the × on the banner. Persists for the rest of the
    /// session (i.e. until the coordinator is deallocated).
    func dismiss() {
        dismissedThisSession = true
        shouldShow = false
    }

    /// Network-path callback. Exposed so tests can simulate the path
    /// transitioning to `.unsatisfied` without spinning up a real
    /// `NWPathMonitor`.
    func handlePathUpdate(satisfied: Bool) {
        isOffline = !satisfied
        if !satisfied {
            surfaceIfNotDismissed()
        }
    }

    private func surfaceIfNotDismissed() {
        guard !dismissedThisSession else { return }
        shouldShow = true
    }
}

// MARK: - Banner view

/// Single-line dismissible banner. Pinned to the top of `ScrollView`
/// content on `CivicaHomePhase2View` / `CivicaHomePhase3View`.
struct CivicaSyncBanner: View {
    @ObservedObject var coordinator: CivicaSyncBannerCoordinator
    let language: CivicaLanguage

    var body: some View {
        if coordinator.shouldShow {
            HStack(alignment: .top, spacing: CivicaSpacing.md) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(CivicaColors.warningAmber)
                    .accessibilityHidden(true)
                    .padding(.top, 1)
                VStack(alignment: .leading, spacing: 2) {
                    Text(CivicaSyncBannerStrings.headline.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(CivicaSyncBannerStrings.body.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: CivicaSpacing.sm)
                Button {
                    coordinator.dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(CivicaColors.graphite)
                        .padding(8)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(CivicaSyncBannerStrings.dismissA11y.value(in: language))
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.statusWarningSurface)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
            .accessibilityElement(children: .combine)
            .accessibilityLabel(CivicaSyncBannerStrings.containerA11y.value(in: language))
        }
    }
}

// MARK: - Strings

enum CivicaSyncBannerStrings {
    static let headline = CivicaText(
        "We're having trouble syncing right now.",
        es: "Estamos teniendo problemas para sincronizar ahora.",
        zh: "我们现在同步遇到问题。",
        vi: "Hiện chúng tôi đang gặp sự cố khi đồng bộ."
    )
    static let body = CivicaText(
        "Check your connection.",
        es: "Revisa tu conexión.",
        zh: "请检查你的网络连接。",
        vi: "Hãy kiểm tra kết nối của bạn."
    )
    static let containerA11y = CivicaText(
        "Sync degraded. Some data may be stale.",
        es: "Sincronización degradada. Algunos datos pueden estar desactualizados.",
        zh: "同步状态不佳。部分数据可能不是最新的。",
        vi: "Đồng bộ bị gián đoạn. Một số dữ liệu có thể chưa được cập nhật."
    )
    static let dismissA11y = CivicaText(
        "Dismiss sync banner",
        es: "Cerrar el aviso de sincronización",
        zh: "关闭同步提示",
        vi: "Đóng thông báo đồng bộ"
    )
}