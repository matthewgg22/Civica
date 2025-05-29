//
//
//  MyRepsViewModel.swift
//  WeVote Information Page
//
//  Created by Matthew Greer‑Gentis on 5/17/25.
//  Updated by ChatGPT on 05/23/25 (improved error handling & debug logging)

import Foundation
import SwiftUI

final class MyRepsViewModel: ObservableObject {
    @Published var isLoading      = false
    @Published var federalReps: [Official] = []
    @Published var stateReps:   [Official] = []
    @Published var cityReps:    [Official] = []
    @Published var errorMessage: String?   // renamed for clarity

    private var zipMap:  ZipToDistrict = [:]
    private var allReps: RepresentativesJSON?

    init() {
        loadJSONFiles()
    }

    private func loadJSONFiles() {
        // 🔍 Debug: list all bundled JSON files
        let jsonFiles = Bundle.main.urls(forResourcesWithExtension: "json", subdirectory: nil) ?? []
        print("🔍 Bundled JSON files:", jsonFiles.map { $0.lastPathComponent })

        let decoder = JSONDecoder()

        // 1) Load ZIP → district map
        guard let zipURL = Bundle.main.url(forResource: "ZipToDistrictMap", withExtension: "json"),
              let zipData = try? Data(contentsOf: zipURL),
              let map     = try? decoder.decode(ZipToDistrict.self, from: zipData) else {
            print("❌ ZIP map load error")
            errorMessage = "ZIP map load error"
            return
        }
        zipMap = map
        print("✅ ZIP map loaded")

        // 2) Load representatives roster
        guard let repsURL = Bundle.main.url(forResource: "NYCRepresentativesRoster", withExtension: "json"),
              let repsData = try? Data(contentsOf: repsURL) else {
            print("❌ Roster file missing")
            errorMessage = "Roster file missing"
            return
        }

        do {
            let reps = try decoder.decode(RepresentativesJSON.self, from: repsData)
            allReps = reps
            print("✅ Decoded \(reps.federal.us_representatives.count) U.S. House members")
        } catch {
            print("❌ Failed to parse roster:", error)
            errorMessage = error.localizedDescription
        }
    }

    func fetchReps(for zip: String) {
        guard let map  = zipMap[zip] else {
            errorMessage = "No mapping for ZIP \(zip)"
            clearReps()
            return
        }
        guard let reps = allReps else {
            errorMessage = "Representatives data missing"
            clearReps()
            return
        }

        isLoading = true
        defer { isLoading = false }
        errorMessage = nil

        // Federal: President + Senators + House member
        var fed = [reps.federal.president]
        fed.append(contentsOf: reps.federal.us_senators.values)
        if let hd = reps.federal.us_representatives[map.congressional] {
            fed.append(hd)
        }
        federalReps = fed

        // State: Senators + Assembly
        stateReps = reps.state.state_senators.values.filter {
            $0.divisionId?.contains(map.state_senate) == true
        }
        stateReps.append(contentsOf:
            reps.state.state_assembly_members.values.filter {
                $0.divisionId?.contains(map.state_assembly) == true
            }
        )

        // City: Mayor + Council (if any)
        var city = [reps.city.mayor]
        city.append(contentsOf: reps.city.city_council_members.values)
        cityReps = city
    }

    private func clearReps() {
        federalReps = []
        stateReps   = []
        cityReps    = []
    }
}
