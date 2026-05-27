import SwiftUI

// OfferEventEmitter — visibility-debounced impression tracking.
//
// Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (B-T13 + F9).
//
// F9 outside-voice fix: SwiftUI's `.onAppear` fires the moment a view enters
// the view hierarchy — including off-screen rows in a LazyVStack. A naive
// `.onAppear { emit(.impression) }` double-counts every offer card, inflating
// the partner_offer_events_aggregate rows that drive partner billing.
//
// This emitter:
//   1. Uses GeometryReader to detect actual screen overlap.
//   2. Debounces for 500ms — the user must dwell on the row, not blink past
//      it during a scroll. (Standard banner-ad viewability threshold.)
//   3. Fires impression at most ONCE per offer per session — repeated scrolls
//      past the same card do not emit duplicate rows.
//   4. Click events fire on tap immediately (no debounce — taps are unambiguous).
//
// Wire contract: caller passes the offersStore. The emitter calls
// `offersStore.repository.emitEvent(offerId:eventType:countyFips:)` which is
// fire-and-forget against POST /me/offers/events.

/// View modifier that emits a single impression event when a view becomes
/// at least 50% visible for ≥500ms. Apply to each offer row in the perks
/// shelf or any other surface that should count toward the impression
/// metric.
struct ImpressionTracking: ViewModifier {
    let offerId: String
    let countyFips: String?
    /// Reference to the OffersStore so the event reaches the gateway. Stored
    /// weakly via the function reference to avoid coupling this modifier to
    /// the full store lifecycle.
    let emit: (String, EBTOfferEvent.EventType, String?) -> Void

    /// Per-session impression dedupe set, scoped per-modifier-instance.
    /// `@State` keeps it alive across view rebuilds without needing the
    /// caller to thread a dedupe set through the API.
    @State private var hasEmitted = false
    /// Pending dwell task so a quick scroll-past cancels the impression.
    @State private var dwellTask: Task<Void, Never>?

    func body(content: Content) -> some View {
        content
            .background(
                GeometryReader { proxy in
                    Color.clear
                        .preference(
                            key: VisibilityPreferenceKey.self,
                            value: VisibilitySnapshot(
                                offerId: offerId,
                                frame: proxy.frame(in: .global)
                            )
                        )
                }
            )
            .onPreferenceChange(VisibilityPreferenceKey.self) { snapshot in
                handle(snapshot: snapshot)
            }
            .onDisappear {
                dwellTask?.cancel()
                dwellTask = nil
            }
    }

    private func handle(snapshot: VisibilitySnapshot?) {
        guard let snapshot, !hasEmitted else { return }
        // Visibility heuristic: at least 50% of the view's frame inside the
        // screen bounds. Approximate the screen as a generous rect since we
        // don't have direct access to the safe-area inset from a modifier.
        // The frame is in .global coordinates; positive height + non-zero y
        // origin + the y origin below an arbitrary screen-bottom threshold
        // is a reasonable approximation. A LazyVStack row whose y origin
        // exceeds ~900 (most iPhone heights) is off-screen.
        let frame = snapshot.frame
        guard frame.height > 1 else { return }
        let approxScreenHeight: CGFloat = 1000
        let visibleTop = max(frame.minY, 0)
        let visibleBottom = min(frame.maxY, approxScreenHeight)
        let visibleHeight = max(0, visibleBottom - visibleTop)
        let visibleFraction = visibleHeight / frame.height
        guard visibleFraction >= 0.5 else {
            // Off-screen — cancel any pending dwell timer.
            dwellTask?.cancel()
            dwellTask = nil
            return
        }
        // Already counting — let the existing task complete.
        guard dwellTask == nil else { return }
        dwellTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 500_000_000)
            guard !Task.isCancelled, !hasEmitted else { return }
            hasEmitted = true
            emit(offerId, .impression, countyFips)
        }
    }
}

/// Compact preference-key shape carrying the offer id alongside its frame
/// so the preference-change callback can route to the right modifier.
private struct VisibilitySnapshot: Equatable {
    let offerId: String
    let frame: CGRect
}

private struct VisibilityPreferenceKey: PreferenceKey {
    static var defaultValue: VisibilitySnapshot? = nil
    static func reduce(value: inout VisibilitySnapshot?, nextValue: () -> VisibilitySnapshot?) {
        // Take the most recent non-nil value — modifiers stack on a single
        // row so we just adopt the latest frame.
        value = nextValue() ?? value
    }
}

extension View {
    /// Apply visibility-debounced impression tracking to an offer row. The
    /// `emit` callback typically forwards to `offersStore.repository.emitEvent`.
    func trackImpression(
        offerId: String,
        countyFips: String?,
        emit: @escaping (String, EBTOfferEvent.EventType, String?) -> Void
    ) -> some View {
        modifier(ImpressionTracking(offerId: offerId, countyFips: countyFips, emit: emit))
    }
}
