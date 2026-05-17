import Foundation

// Pure date math for predicting which captured documents will be too
// stale at the user's next recertification. No I/O, no UI — every
// branch is unit-testable without a simulator.
//
// Algorithm per document:
//   1. Look up the state's rule. No rule → skip (no advice for
//      unconfigured types).
//   2. Compute the "valid-from" date: recertDate - maxAgeDaysAtRecert.
//      Any document captured before this date will be too stale at
//      recert.
//   3. If the document has never been captured, emit a `.missing`
//      action due `dueBy = recertDate - maxAgeDaysAtRecert + buffer`.
//   4. If the document was captured but its capture date is before
//      the valid-from date, emit a `.staleAtRecert` action due now-ish.
//   5. If the document has a frequency hint (biweekly/monthly), emit
//      a `.cadenceDue` action when the most recent capture is older
//      than the cadence interval. This catches users with regular pay
//      stubs who would otherwise show "ready" until the day they're
//      not.
//
// Actions are sorted by dueBy ascending. UI groups by week / month
// at the rendering layer; the predictor itself stays flat.

enum DocumentExpirationPredictor {
    /// Days of slack we want between "user uploads fresh document"
    /// and "recert interview." Picked at 5 days so the user has the
    /// weekend to retake if something goes wrong.
    static let bufferDays = 5

    struct Input {
        let today: Date
        let nextRecertDate: Date
        /// Map of capture timestamps from the Document Vault.
        /// Documents the user has never captured are absent here.
        let vault: [SNAPDocumentType: Date]
        let stateCode: String

        /// All document types the predictor should consider for this
        /// run — defaults to whatever the rules file configures for
        /// the state. Callers can pass a narrower set to scope the
        /// forecast to "income docs only", etc.
        let documentsToConsider: [SNAPDocumentType]?

        init(
            today: Date,
            nextRecertDate: Date,
            vault: [SNAPDocumentType: Date],
            stateCode: String,
            documentsToConsider: [SNAPDocumentType]? = nil
        ) {
            self.today = today
            self.nextRecertDate = nextRecertDate
            self.vault = vault
            self.stateCode = stateCode
            self.documentsToConsider = documentsToConsider
        }
    }

    static func forecast(_ input: Input) -> DocumentExpirationForecast {
        let calendar = Calendar(identifier: .gregorian)

        let documents = input.documentsToConsider
            ?? DocumentExpirationRules.documentsConfigured(for: input.stateCode)

        var actions: [DocumentExpirationAction] = []
        var readyCount = 0

        for document in documents {
            guard let rule = DocumentExpirationRules.rule(state: input.stateCode, document: document) else {
                continue
            }

            // valid-from = recertDate - maxAge. Anything captured
            // before this point will be too stale at recert.
            guard let validFrom = calendar.date(
                byAdding: .day,
                value: -rule.maxAgeDaysAtRecert,
                to: input.nextRecertDate
            ) else {
                continue
            }

            // Recommended upload date: validFrom + buffer. This is
            // when the user should have a fresh document captured by.
            // If validFrom is already past, dueBy is today.
            let recommendedUpload = calendar.date(byAdding: .day, value: bufferDays, to: validFrom) ?? validFrom
            let dueBy = max(recommendedUpload, input.today)

            // Cap dueBy at the recert date itself — we never want to
            // tell the user "do this on a day after your recert."
            let cappedDueBy = min(dueBy, input.nextRecertDate)

            if let capturedAt = input.vault[document] {
                // Have a capture — is it fresh enough?
                if capturedAt < validFrom {
                    // Will be stale at recert. User needs a replacement.
                    actions.append(DocumentExpirationAction(
                        document: document,
                        action: .replace,
                        dueBy: cappedDueBy,
                        reason: .staleAtRecert
                    ))
                } else if let frequency = rule.frequency,
                          let cadenceDueDate = cadenceDueDate(
                              capturedAt: capturedAt,
                              frequency: frequency,
                              today: input.today,
                              calendar: calendar
                          ),
                          cadenceDueDate < input.nextRecertDate {
                    actions.append(DocumentExpirationAction(
                        document: document,
                        action: .replace,
                        dueBy: min(cadenceDueDate, cappedDueBy),
                        reason: .cadenceDue
                    ))
                } else {
                    readyCount += 1
                }
            } else {
                // No capture at all — user needs to upload one.
                actions.append(DocumentExpirationAction(
                    document: document,
                    action: .replace,
                    dueBy: cappedDueBy,
                    reason: .missing
                ))
            }
        }

        actions.sort { $0.dueBy < $1.dueBy }

        return DocumentExpirationForecast(
            upcomingActions: actions,
            nextRecertDate: input.nextRecertDate,
            documentsReadyForRecert: readyCount,
            documentsNeedingReplacement: actions.count,
            stateCode: input.stateCode
        )
    }

    /// Compute the next cadence-driven due date given a frequency
    /// hint and a most-recent capture timestamp. Returns nil for
    /// unrecognized frequencies (treated as one-shot).
    private static func cadenceDueDate(
        capturedAt: Date,
        frequency: String,
        today: Date,
        calendar: Calendar
    ) -> Date? {
        let intervalDays: Int
        switch frequency.lowercased() {
        case "biweekly":
            // Pay-stub cadence. 14 days + 3 days slack → the user is
            // due about 17 days after their last capture if they want
            // to stay current.
            intervalDays = 17
        case "monthly":
            intervalDays = 35
        case "weekly":
            intervalDays = 10
        default:
            return nil
        }
        return calendar.date(byAdding: .day, value: intervalDays, to: capturedAt)
    }
}
