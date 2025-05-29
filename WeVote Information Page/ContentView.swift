//
//
//
//  ContentView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 3/30/25.
//  Updated by ChatGPT on 05/23/25 (expanded TabView & added repsVM injection)
//

import SwiftUI
import UIKit   // only needed if you reference UITabBar dimensions elsewhere

// MARK: – Safe-Indexing Helper
extension Collection {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

// MARK: – Date Helper
extension Date {
    static func from(_ string: String, format: String = "yyyy-MM-dd") -> Date {
        let fmt = DateFormatter()
        fmt.dateFormat = format
        fmt.timeZone   = .current
        return fmt.date(from: string) ?? Date()
    }
}

// MARK: – Bottom-Tab Enum
enum Tab: String, CaseIterable {
    case myReps             = "My Reps"
    case electionTimeline   = "Election Timeline"
    case registration       = "Registration"
    case nycMayoralElection = "NYC Mayoral Election"
    case howToVote          = "How to Vote"

    var iconName: String {
        switch self {
        case .myReps:             return "person.3.fill"
        case .electionTimeline:   return "calendar"
        case .registration:       return "person.badge.plus"
        case .nycMayoralElection: return "mappin.and.ellipse"
        case .howToVote:          return "flag.fill"
        }
    }
}

// MARK: – Root Content View
struct ContentView: View {
    // ← Create & own both view models here
    @StateObject private var planVM = PlanViewModel()
    @StateObject private var repsVM = MyRepsViewModel()

    @State private var selectedTab        = Tab.myReps
    @State private var showCivicScorecard = false
    @State private var showRegReminder    = false
    @State private var selectedElection: Election?
    @State private var showMyInfoPanel    = false

    var body: some View {
        TabView(selection: $selectedTab) {
            // 1. My Reps
            MyRepsView()
                .tabItem {
                    Label(Tab.myReps.rawValue, systemImage: Tab.myReps.iconName)
                }
                .tag(Tab.myReps)

            // 2. Election Timeline
            ElectionTimelineView()
                .tabItem {
                    Label(Tab.electionTimeline.rawValue,
                          systemImage: Tab.electionTimeline.iconName)
                }
                .tag(Tab.electionTimeline)

            // 3. Registration
            VoterRegistrationView()
                .tabItem {
                    Label(Tab.registration.rawValue, systemImage: Tab.registration.iconName)
                }
                .tag(Tab.registration)

            // 4. NYC Mayoral Election
            NYCMayoralElectionView()
                .tabItem {
                    Label(Tab.nycMayoralElection.rawValue,
                          systemImage: Tab.nycMayoralElection.iconName)
                }
                .tag(Tab.nycMayoralElection)

            // 5. How to Vote
            MobilizationView()
                .environmentObject(planVM)
                .tabItem {
                    Image("WeVoteLogo")
                        .renderingMode(.original)     // ← preserves your logo’s true colors
                        .resizable()                  // ← if you need to size it
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 24, height: 24) // ← tweak as needed
                    Text(Tab.howToVote.rawValue)
                }
                .tag(Tab.howToVote)
        }
        // ← Inject both into the environment
        .environmentObject(planVM)
        .environmentObject(repsVM)
        .tint(.blue)
        .overlay(alignment: .topTrailing) {
            Button { showMyInfoPanel = true } label: {
                Image(systemName: "person.crop.circle.fill")
                    .font(.system(size: 28))
                    .padding()
            }
        }
        .ignoresSafeArea(edges: .bottom)

        // Civic Scorecard sheet
        .sheet(isPresented: $showCivicScorecard) {
            CivicScorecardView()
                .environmentObject(planVM)
        }

        // Registration reminder sheet
        .sheet(isPresented: $showRegReminder) {
            VoterRegistrationReminderView(selectedTab: $selectedTab)
                .environmentObject(planVM)
        }

        // Election detail sheet
        .sheet(item: $selectedElection) { election in
            ElectionTabView(election: election)
                .environmentObject(planVM)
        }

        // My Info panel sheet
        .sheet(isPresented: $showMyInfoPanel) {
            MyInfoPanelView()
                .environmentObject(planVM)
                .environmentObject(repsVM)
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(PlanViewModel())
            .environmentObject(MyRepsViewModel())  // ← also inject here
    }
}
