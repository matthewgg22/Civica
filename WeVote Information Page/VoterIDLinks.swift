//  VoterIDLinks.swift
//  Generated list of Ballotpedia voter ID detail links (50 states + Washington, D.C.)
//  Source: Ballotpedia "Voter ID in <State>" pages.
//  Note: Laws can change—treat links as a starting point, and verify with official election sites when needed.

import Foundation

public struct JurisdictionLink: Identifiable, Hashable, Codable {
    public let id: String          // e.g., "NY", "CA", "DC"
    public let name: String        // display name
    public let urlString: String   // absolute URL string

    public init(id: String, name: String, urlString: String) {
        self.id = id
        self.name = name
        self.urlString = urlString
    }

    public var url: URL {
        // Force unwrap is OK here because these are static, known-good URLs.
        return URL(string: urlString)!
    }
}

public enum VoterIDLinks {
    /// Alphabetical list of U.S. states plus Washington, D.C.
    public static let all: [JurisdictionLink] = [
        .init(id: "AL", name: "Alabama", urlString: "https://ballotpedia.org/Voter_ID_in_Alabama"),
        .init(id: "AK", name: "Alaska", urlString: "https://ballotpedia.org/Voter_ID_in_Alaska"),
        .init(id: "AZ", name: "Arizona", urlString: "https://ballotpedia.org/Voter_ID_in_Arizona"),
        .init(id: "AR", name: "Arkansas", urlString: "https://ballotpedia.org/Voter_ID_in_Arkansas"),
        .init(id: "CA", name: "California", urlString: "https://ballotpedia.org/Voter_ID_in_California"),
        .init(id: "CO", name: "Colorado", urlString: "https://ballotpedia.org/Voter_ID_in_Colorado"),
        .init(id: "CT", name: "Connecticut", urlString: "https://ballotpedia.org/Voter_ID_in_Connecticut"),
        .init(id: "DE", name: "Delaware", urlString: "https://ballotpedia.org/Voter_ID_in_Delaware"),
        .init(id: "FL", name: "Florida", urlString: "https://ballotpedia.org/Voter_ID_in_Florida"),
        .init(id: "GA", name: "Georgia", urlString: "https://ballotpedia.org/Voter_ID_in_Georgia"),
        .init(id: "HI", name: "Hawaii", urlString: "https://ballotpedia.org/Voter_ID_in_Hawaii"),
        .init(id: "ID", name: "Idaho", urlString: "https://ballotpedia.org/Voter_ID_in_Idaho"),
        .init(id: "IL", name: "Illinois", urlString: "https://ballotpedia.org/Voter_ID_in_Illinois"),
        .init(id: "IN", name: "Indiana", urlString: "https://ballotpedia.org/Voter_ID_in_Indiana"),
        .init(id: "IA", name: "Iowa", urlString: "https://ballotpedia.org/Voter_ID_in_Iowa"),
        .init(id: "KS", name: "Kansas", urlString: "https://ballotpedia.org/Voter_ID_in_Kansas"),
        .init(id: "KY", name: "Kentucky", urlString: "https://ballotpedia.org/Voter_ID_in_Kentucky"),
        .init(id: "LA", name: "Louisiana", urlString: "https://ballotpedia.org/Voter_ID_in_Louisiana"),
        .init(id: "ME", name: "Maine", urlString: "https://ballotpedia.org/Voter_ID_in_Maine"),
        .init(id: "MD", name: "Maryland", urlString: "https://ballotpedia.org/Voter_ID_in_Maryland"),
        .init(id: "MA", name: "Massachusetts", urlString: "https://ballotpedia.org/Voter_ID_in_Massachusetts"),
        .init(id: "MI", name: "Michigan", urlString: "https://ballotpedia.org/Voter_ID_in_Michigan"),
        .init(id: "MN", name: "Minnesota", urlString: "https://ballotpedia.org/Voter_ID_in_Minnesota"),
        .init(id: "MS", name: "Mississippi", urlString: "https://ballotpedia.org/Voter_ID_in_Mississippi"),
        .init(id: "MO", name: "Missouri", urlString: "https://ballotpedia.org/Voter_ID_in_Missouri"),
        .init(id: "MT", name: "Montana", urlString: "https://ballotpedia.org/Voter_ID_in_Montana"),
        .init(id: "NE", name: "Nebraska", urlString: "https://ballotpedia.org/Voter_ID_in_Nebraska"),
        .init(id: "NV", name: "Nevada", urlString: "https://ballotpedia.org/Voter_ID_in_Nevada"),
        .init(id: "NH", name: "New Hampshire", urlString: "https://ballotpedia.org/Voter_ID_in_New_Hampshire"),
        .init(id: "NJ", name: "New Jersey", urlString: "https://ballotpedia.org/Voter_ID_in_New_Jersey"),
        .init(id: "NM", name: "New Mexico", urlString: "https://ballotpedia.org/Voter_ID_in_New_Mexico"),
        .init(id: "NY", name: "New York", urlString: "https://ballotpedia.org/Voter_ID_in_New_York"),
        .init(id: "NC", name: "North Carolina", urlString: "https://ballotpedia.org/Voter_ID_in_North_Carolina"),
        .init(id: "ND", name: "North Dakota", urlString: "https://ballotpedia.org/Voter_ID_in_North_Dakota"),
        .init(id: "OH", name: "Ohio", urlString: "https://ballotpedia.org/Voter_ID_in_Ohio"),
        .init(id: "OK", name: "Oklahoma", urlString: "https://ballotpedia.org/Voter_ID_in_Oklahoma"),
        .init(id: "OR", name: "Oregon", urlString: "https://ballotpedia.org/Voter_ID_in_Oregon"),
        .init(id: "PA", name: "Pennsylvania", urlString: "https://ballotpedia.org/Voter_ID_in_Pennsylvania"),
        .init(id: "RI", name: "Rhode Island", urlString: "https://ballotpedia.org/Voter_ID_in_Rhode_Island"),
        .init(id: "SC", name: "South Carolina", urlString: "https://ballotpedia.org/Voter_ID_in_South_Carolina"),
        .init(id: "SD", name: "South Dakota", urlString: "https://ballotpedia.org/Voter_ID_in_South_Dakota"),
        .init(id: "TN", name: "Tennessee", urlString: "https://ballotpedia.org/Voter_ID_in_Tennessee"),
        .init(id: "TX", name: "Texas", urlString: "https://ballotpedia.org/Voter_ID_in_Texas"),
        .init(id: "UT", name: "Utah", urlString: "https://ballotpedia.org/Voter_ID_in_Utah"),
        .init(id: "VT", name: "Vermont", urlString: "https://ballotpedia.org/Voter_ID_in_Vermont"),
        .init(id: "VA", name: "Virginia", urlString: "https://ballotpedia.org/Voter_ID_in_Virginia"),
        .init(id: "WA", name: "Washington", urlString: "https://ballotpedia.org/Voter_ID_in_Washington"),
        .init(id: "DC", name: "Washington, D.C.", urlString: "https://ballotpedia.org/Voter_ID_in_Washington%2C_D.C."),
        .init(id: "WV", name: "West Virginia", urlString: "https://ballotpedia.org/Voter_ID_in_West_Virginia"),
        .init(id: "WI", name: "Wisconsin", urlString: "https://ballotpedia.org/Voter_ID_in_Wisconsin"),
        .init(id: "WY", name: "Wyoming", urlString: "https://ballotpedia.org/Voter_ID_in_Wyoming"),
    ]
}
