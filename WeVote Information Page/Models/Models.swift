//
//
//
//
//  Models.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/17/25.
//  Updated by ChatGPT on 05/24/25 (derive assetName from last name, strip diacritics)
//

import Foundation

public enum OfficialLevel: String, Codable {
    case federal
    case state
    case local
}

/// Mapping from ZIP code → district identifiers
public struct DistrictMapping: Codable {
    public let congressional:  String
    public let state_senate:   String
    public let state_assembly: String
}

public typealias ZipToDistrict = [String: DistrictMapping]

/// A single elected official
public struct Official: Identifiable, Codable {
    public let id: UUID
    public let name:       String
    public let divisionId: String?
    public let party:      String?
    public let officeTitle: String?
    public let photoURL:   String?
    public let url:        String?
    public let officialPhone: String?
    public let websiteURL: String?
    public let contactFormURL: String?
    public let committeeAssignments: [String]
    public let level: OfficialLevel?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case divisionId
        case party
        case officeTitle
        case photoURL
        case url
        case officialPhone
        case websiteURL
        case contactFormURL
        case committeeAssignments
        case level
    }

    public init(
        id: UUID = UUID(),
        name: String,
        divisionId: String?,
        party: String?,
        officeTitle: String? = nil,
        photoURL: String?,
        url: String? = nil,
        officialPhone: String? = nil,
        websiteURL: String? = nil,
        contactFormURL: String? = nil,
        committeeAssignments: [String] = [],
        level: OfficialLevel? = nil
    ) {
        self.id = id
        self.name = name
        self.divisionId = divisionId
        self.party = party
        self.officeTitle = officeTitle
        self.photoURL = photoURL
        self.url = url
        self.officialPhone = officialPhone
        self.websiteURL = websiteURL ?? url
        self.contactFormURL = contactFormURL
        self.committeeAssignments = committeeAssignments
        self.level = level
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let decodedURL = try container.decodeIfPresent(String.self, forKey: .url)
        let decodedWebsiteURL = try container.decodeIfPresent(String.self, forKey: .websiteURL)

        id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        name = try container.decode(String.self, forKey: .name)
        divisionId = try container.decodeIfPresent(String.self, forKey: .divisionId)
        party = try container.decodeIfPresent(String.self, forKey: .party)
        officeTitle = try container.decodeIfPresent(String.self, forKey: .officeTitle)
        photoURL = try container.decodeIfPresent(String.self, forKey: .photoURL)
        url = decodedURL
        officialPhone = try container.decodeIfPresent(String.self, forKey: .officialPhone)
        websiteURL = decodedWebsiteURL ?? decodedURL
        contactFormURL = try container.decodeIfPresent(String.self, forKey: .contactFormURL)
        committeeAssignments = try container.decodeIfPresent([String].self, forKey: .committeeAssignments) ?? []
        level = try container.decodeIfPresent(OfficialLevel.self, forKey: .level)
    }

    /// Derives the name of the image in Assets.xcassets
    ///   • Uses only the last name (e.g. “Schumer” from “Chuck Schumer”)
    ///   • Strips diacritics so “Velázquez” → “Velazquez”
    public var assetName: String {
        // 1) Grab last name (or full name if single-word)
        let raw = name
            .split(separator: " ")
            .last
            .map(String.init) ?? name

        // 2) Remove accents/diacritics
        let folded = raw.folding(options: .diacriticInsensitive,
                                 locale: .current)

        return folded
    }

    /// Human-readable district label
    public var district: String? {
        guard let id = divisionId else { return nil }

        if let r = id.range(of: "/cd:") {
            return "Congressional District " + normalizedDistrictFragment(id[r.upperBound...])
        }
        if let r = id.range(of: "/sldu:") {
            return "State Senate District " + normalizedDistrictFragment(id[r.upperBound...])
        }
        if let r = id.range(of: "/sldl:") {
            return "State Assembly District " + normalizedDistrictFragment(id[r.upperBound...])
        }
        if id.contains("/place:")  { return "Citywide" }
        if id.contains("/state:")  { return "Statewide" }
        if id.contains("/country:"){ return "Nationwide" }
        return nil
    }

    public var resolvedWebsiteURL: String? {
        websiteURL ?? url
    }

    public func withLevel(_ level: OfficialLevel) -> Official {
        Official(
            id: id,
            name: name,
            divisionId: divisionId,
            party: party,
            officeTitle: officeTitle,
            photoURL: photoURL,
            url: url,
            officialPhone: officialPhone,
            websiteURL: websiteURL,
            contactFormURL: contactFormURL,
            committeeAssignments: committeeAssignments,
            level: level
        )
    }

    private func normalizedDistrictFragment(_ value: Substring) -> String {
        String(value)
            .replacingOccurrences(of: "_", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

/// Root JSON container for all offices
public struct RepresentativesJSON: Codable {
    public let federal: Federal
    public let state:   State
    public let city:    City

    public struct Federal: Codable {
        public let president:          Official
        public let us_senators:        [String: Official]
        public let us_representatives: [String: Official]
    }

    public struct State: Codable {
        public let state_senators:         [String: Official]
        public let state_assembly_members: [String: Official]
    }

    public struct City: Codable {
        public let mayor:                Official
        public let city_council_members: [String: Official]
    }
}
