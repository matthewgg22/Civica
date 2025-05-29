//
//  CivicResponseModel.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/28/25.
//  Updated by ChatGPT on 05/22/25 (rename to avoid conflicts)

import Foundation

// MARK: – Data Models for the Civic Info API

/// The top‐level response containing offices and their officials.
struct CivicResponse: Codable {
    let offices:  [Office]
    let officials: [CivicOfficial]
}

/// A government office (e.g. "United States Senate") 
struct Office: Codable {
    let name:            String
    let officialIndices: [Int]
    let roles:           [String]?
}

/// A single person returned by the Civic Info API.
struct CivicOfficial: Identifiable, Codable {
    var id: String { name }

    let name:     String
    let party:    String?
    let photoUrl: String?
    let urls:     [String]?
    var index:    Int?   // tracks this official’s position in the `officials` array
}
