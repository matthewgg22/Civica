import Foundation

struct ElectionLookupSections {
    let yourElections: [Election]
    let needsAddressToConfirm: [Election]
    let informational: [Election]
}

enum ElectionResultClassifier {
    static func classify(_ elections: [Election], precision: SearchPrecision) -> ElectionLookupSections {
        let sorted = elections.sorted { $0.electionDay < $1.electionDay }
        var yourElections: [Election] = []
        var needsAddressToConfirm: [Election] = []
        var informational: [Election] = []

        for election in sorted {
            if election.isBucketRow {
                informational.append(election)
                continue
            }

            if election.isPublicResultEligible(for: precision) {
                yourElections.append(election)
                continue
            }

            if precision == .zipOrCity,
               election.visibility.lowercased() == "public",
               election.requiresFullAddress {
                needsAddressToConfirm.append(election)
            }
        }

        return ElectionLookupSections(
            yourElections: yourElections,
            needsAddressToConfirm: needsAddressToConfirm,
            informational: informational
        )
    }
}
