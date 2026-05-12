import Foundation
import SwiftUI

// View model for ExpirationCalendarView. Pulls capture dates from
// SNAPDocumentVaultReader, applies the predictor, exposes the
// resulting forecast as @Published. Re-computes on demand (refresh)
// or when the view appears.

@MainActor
final class ExpirationCalendarViewModel: ObservableObject {
    @Published private(set) var forecast: DocumentExpirationForecast?

    private let stateCode: String

    /// Recert date the forecast targets. Resolved at construction
    /// time so the model stays internally consistent; the surface
    /// holding this model is responsible for rebuilding when the
    /// recert date changes.
    private let nextRecertDate: Date

    init(stateCode: String, nextRecertDate: Date) {
        self.stateCode = stateCode
        self.nextRecertDate = nextRecertDate
    }

    /// Recompute the forecast. Cheap (pure date math + a handful of
    /// FileManager attribute lookups) so we can call this on every
    /// `onAppear`.
    func refresh(now: Date = Date()) {
        let vault = Dictionary(uniqueKeysWithValues:
            SNAPDocumentVaultReader.allCaptured().map { ($0.type, $0.capturedAt) }
        )

        let input = DocumentExpirationPredictor.Input(
            today: now,
            nextRecertDate: nextRecertDate,
            vault: vault,
            stateCode: stateCode
        )
        forecast = DocumentExpirationPredictor.forecast(input)
    }
}
