import Foundation

// Builder for the prep checklist shown at the end of a Phantom Recert.
// Two inputs:
//   - The change-detector diff (sections that need re-answering)
//   - The expiration forecast (documents that need uploading)
//
// One output: a flat, ordered list of `ChecklistItem` values the
// summary view renders. Pure — no I/O or UI.

struct PhantomChecklistItem: Equatable, Hashable {
    enum Kind: Equatable, Hashable {
        case answerReview(section: SNAPApplicationSection, change: PhantomChange.Kind)
        case documentUpload(SNAPDocumentType)
    }

    let kind: Kind

    /// Sort priority — higher floats up. Used to put document
    /// uploads before answer-review items, since uploads have a
    /// time floor (you need an actual document in hand).
    let priority: Int
}

enum PhantomPrepChecklist {
    static func build(
        changes: [PhantomChange],
        forecast: DocumentExpirationForecast
    ) -> [PhantomChecklistItem] {
        var items: [PhantomChecklistItem] = []

        // Document uploads first — they need physical preparation
        // (find the bill, retrieve the pay stub).
        for action in forecast.upcomingActions {
            items.append(PhantomChecklistItem(
                kind: .documentUpload(action.document),
                priority: 10
            ))
        }

        // Then answer-review items. Modified sections rank higher
        // than filled, since "you said X last year, you said Y in
        // the dry run" is more urgent than "you filled in something
        // new."
        for change in changes {
            let priority: Int
            switch change.kind {
            case .modified: priority = 8
            case .cleared: priority = 7
            case .filled: priority = 5
            }
            items.append(PhantomChecklistItem(
                kind: .answerReview(section: change.section, change: change.kind),
                priority: priority
            ))
        }

        return items.sorted { $0.priority > $1.priority }
    }
}
