import Foundation
import SwiftUI

// Persisted store for the user's next recertification date.
//
// Source of truth (in order):
//   1. A user-set override, if one exists. Persisted to UserDefaults
//      under `co.civica.recert.nextDate`.
//   2. A computed default of `approval-milestone + 12 months`. The
//      approval milestone lives on SNAPApplicationStatusStore.
//   3. Nil — happens when no application has been approved yet AND
//      the user hasn't set a date. UI should prompt the user to set
//      one in that case.
//
// The 12-month default is correct for MA / CA standard households but
// wrong for CA SAR-7 (6mo) and elderly/disabled simplified reporting
// (24mo) populations. NOTES.md flags this — surface review needed
// before flipping the flag for those populations.

@MainActor
final class RecertScheduleStore: ObservableObject {
    @Published private(set) var userOverride: Date?

    static let storageKey = "co.civica.recert.nextDate"
    static let defaultCycleMonths = 12

    init() {
        if let stored = UserDefaults.standard.object(forKey: Self.storageKey) as? Date {
            self.userOverride = stored
        } else {
            self.userOverride = nil
        }
    }

    /// Effective recert date — the override if set, else the default
    /// computed from the approval milestone. Returns nil only when
    /// neither source is available.
    func effectiveDate(approvedAt: Date?) -> Date? {
        if let userOverride { return userOverride }
        return Self.defaultDate(approvedAt: approvedAt)
    }

    /// Save a user override. Empties any prior value.
    func setOverride(_ date: Date) {
        userOverride = date
        UserDefaults.standard.set(date, forKey: Self.storageKey)
    }

    /// Discard the user's override and fall back to the computed default.
    func clearOverride() {
        userOverride = nil
        UserDefaults.standard.removeObject(forKey: Self.storageKey)
    }

    /// Pure computation — exposed for tests and for views that want to
    /// show "default would be X" alongside the override editor.
    static func defaultDate(approvedAt: Date?) -> Date? {
        guard let approvedAt else { return nil }
        return Calendar.current.date(
            byAdding: .month,
            value: defaultCycleMonths,
            to: approvedAt
        )
    }
}
