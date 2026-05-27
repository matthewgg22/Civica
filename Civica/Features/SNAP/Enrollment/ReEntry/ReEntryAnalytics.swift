import Foundation

// Analytics sink for the re-entry assist flow (Unrath retention pillar, G2).
//
// Injecting a protocol (rather than calling SNAPAnalytics statics directly
// from the store) keeps the store testable — tests use
// `RecordingReEntryAnalyticsSink` to capture emissions. Production wires
// `DefaultReEntryAnalyticsSink`, which forwards to the privacy-bounded
// SNAPAnalytics surface.
//
// Privacy invariant inherited from SNAPAnalytics: no PII, no eligibility
// detail, no packet identifiers in the payload. Only counts + the
// allowlisted `topic` slot (used for "new"/"existing" and "load"/"enroll").

protocol ReEntryAnalyticsSink: Sendable {
    func trackImpression()
    func trackConfirmed(idempotent: Bool)
    func trackDismissed()
    func trackError(stage: ReEntryErrorStage)
}

enum ReEntryErrorStage: String, Sendable {
    case load     // suggestion fetch failed
    case enroll   // POST re-enroll-from failed
}

struct DefaultReEntryAnalyticsSink: ReEntryAnalyticsSink {
    func trackImpression() {
        SNAPAnalytics.trackReEntryCardImpression()
    }
    func trackConfirmed(idempotent: Bool) {
        SNAPAnalytics.trackReEntryConfirmed(idempotent: idempotent)
    }
    func trackDismissed() {
        SNAPAnalytics.trackReEntryDismissed()
    }
    func trackError(stage: ReEntryErrorStage) {
        SNAPAnalytics.trackReEntryError(stage: stage.rawValue)
    }
}

/// Test recorder — captures every emission in order. Use in unit tests to
/// assert event ordering and payload shape. Thread-safe via internal lock
/// because the store may emit from async contexts.
final class RecordingReEntryAnalyticsSink: ReEntryAnalyticsSink, @unchecked Sendable {
    enum Event: Equatable {
        case impression
        case confirmed(idempotent: Bool)
        case dismissed
        case error(stage: ReEntryErrorStage)
    }

    private let lock = NSLock()
    private var _events: [Event] = []

    var events: [Event] {
        lock.lock(); defer { lock.unlock() }
        return _events
    }

    func trackImpression() {
        lock.lock(); _events.append(.impression); lock.unlock()
    }
    func trackConfirmed(idempotent: Bool) {
        lock.lock(); _events.append(.confirmed(idempotent: idempotent)); lock.unlock()
    }
    func trackDismissed() {
        lock.lock(); _events.append(.dismissed); lock.unlock()
    }
    func trackError(stage: ReEntryErrorStage) {
        lock.lock(); _events.append(.error(stage: stage)); lock.unlock()
    }
}
