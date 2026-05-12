import Foundation

// Persists the most-recent eligible estimator output so the waiting-
// room countdown card can show "you'd receive about $X/day" without
// requiring the user to re-run the estimator.
//
// Separate from SNAPApplicationStatusStore.eligibilityResult on
// purpose: the estimator is reachable BEFORE the user starts a real
// application, so its result has an earlier lifecycle than the
// orchestrator's verdict. Once the orchestrator runs and writes
// statusStore.eligibilityResult, that becomes the source of truth;
// this store is the pre-application fallback.

struct SNAPEstimatorResultRecord: Codable, Equatable {
    let monthlyBenefit: Decimal
    let computedAt: Date
}

struct SNAPEstimatorResultStore {

    static let storageKey = "co.civica.estimatorResult"

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func save(monthlyBenefit: Decimal, computedAt: Date = Date()) {
        let record = SNAPEstimatorResultRecord(
            monthlyBenefit: monthlyBenefit,
            computedAt: computedAt
        )
        if let data = try? JSONEncoder().encode(record) {
            defaults.set(data, forKey: Self.storageKey)
        }
    }

    func load() -> SNAPEstimatorResultRecord? {
        guard let data = defaults.data(forKey: Self.storageKey) else { return nil }
        return try? JSONDecoder().decode(SNAPEstimatorResultRecord.self, from: data)
    }

    func clear() {
        defaults.removeObject(forKey: Self.storageKey)
    }
}
