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
enum Tab: CaseIterable {
    case myReps
    case electionTimeline
    case registration
    case electionGuide
    case howToVote

    var iconName: String {
        switch self {
        case .myReps:             return "person.3.fill"
        case .electionTimeline:   return "calendar"
        case .registration:       return "person.badge.plus"
        case .electionGuide:      return "mappin.and.ellipse"
        case .howToVote:          return "flag.fill"
        }
    }
}

// MARK: – Root Content View
struct ContentView: View {
    @EnvironmentObject private var planVM: PlanViewModel
    @EnvironmentObject private var repsVM: MyRepsViewModel
    @StateObject private var mapvPlanStore = MAPVPlanStore.shared
    @Environment(\.scenePhase) private var scenePhase
    private let zipStateResolver = USZipStateResolver()

    private static let stateCodeToName: [String: String] = [
        "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
        "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
        "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
        "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
        "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
        "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
        "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
        "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
        "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
        "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
        "DC": "District of Columbia", "AS": "American Samoa", "GU": "Guam",
        "MP": "Northern Mariana Islands", "PR": "Puerto Rico", "VI": "U.S. Virgin Islands"
    ]

    @State private var selectedTab        = Tab.myReps
    @State private var showCivicScorecard = false
    @State private var showRegReminder    = false
    @State private var selectedElection: Election?
    @State private var showLaunchOverlay  = true
    @State private var showWhyVoteOverlay = false
    @State private var whyVoteTapOriginInSpreadSpace: CGPoint?

    private var loadingZip: String? {
        let primary = String(planVM.zip.filter(\.isNumber).prefix(5))
        if primary.count == 5 { return primary }
        let fallback = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
        return fallback.count == 5 ? fallback : nil
    }

    private var loadingStateName: String? {
        let enteredState = planVM.userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines)
        if !enteredState.isEmpty {
            if enteredState.count == 2 {
                let code = enteredState.uppercased()
                return Self.stateCodeToName[code] ?? code
            }
            return enteredState
        }

        if let zip = loadingZip,
           let stateCode = zipStateResolver.stateCode(for: zip) {
            return Self.stateCodeToName[stateCode] ?? stateCode
        }
        return nil
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            // 1. My Reps
            MyRepsView()
                .tabItem {
                    Label {
                        Text("app.tab.my_reps", tableName: "AppShell")
                    } icon: {
                        Image(systemName: Tab.myReps.iconName)
                    }
                }
                .tag(Tab.myReps)

            // 2. Election Timeline
            ElectionTimelineView()
                .tabItem {
                    Label {
                        Text("app.tab.election_timeline", tableName: "AppShell")
                    } icon: {
                        Image(systemName: Tab.electionTimeline.iconName)
                    }
                }
                .tag(Tab.electionTimeline)

            // 3. Registration
            VoterRegistrationView()
                .tabItem {
                    Label {
                        Text("app.tab.registration", tableName: "AppShell")
                    } icon: {
                        Image(systemName: Tab.registration.iconName)
                    }
                }
                .tag(Tab.registration)

            // 4. Election Guide
            NYCMayoralElectionView()
                .tabItem {
                    Label {
                        Text("app.tab.election_guide", tableName: "AppShell")
                    } icon: {
                        Image(systemName: Tab.electionGuide.iconName)
                    }
                }
                .tag(Tab.electionGuide)

            // 5. How to Vote
            MobilizationView()
                .environmentObject(planVM)
                .tabItem {
                    Image(uiImage: VoteNowLogoIcon.tabBarBarsUIImage)
                        .renderingMode(.original)
                    Text("app.tab.how_to_vote", tableName: "AppShell")
                }
                .tag(Tab.howToVote)
        }
        .environmentObject(mapvPlanStore)
        .coordinateSpace(name: "SpreadSpace")
        .tint(VoteNowColors.primaryCTA)
        .overlay {
            if showWhyVoteOverlay {
                WhyVoteFloodOverlay(
                    isPresented: $showWhyVoteOverlay,
                    originInSpreadSpace: whyVoteTapOriginInSpreadSpace
                )
                    .environmentObject(planVM)
                    .environmentObject(repsVM)
                    .zIndex(900)
            }
        }
        .overlay {
            if showLaunchOverlay {
                LoadingView(
                    selectedStateName: loadingStateName,
                    selectedZip: loadingZip
                )
                    .transition(.opacity)
                    .zIndex(1000)
            }
        }
        .ignoresSafeArea(edges: .bottom)
        .onAppear {
            DispatchQueue.main.async {
                mapvPlanStore.bootstrapFromLegacyPlanViewModel(planVM)
                mapvPlanStore.refreshLiveActivity()
                DispatchQueue.main.asyncAfter(deadline: .now() + 7.0) {
                    withAnimation(.easeOut(duration: 0.3)) {
                        showLaunchOverlay = false
                    }
                }
            }
        }
        .onChange(of: scenePhase) { phase in
            guard phase == .active else { return }
            DispatchQueue.main.async {
                mapvPlanStore.bootstrapFromLegacyPlanViewModel(planVM)
                mapvPlanStore.refreshLiveActivity()
            }
        }
        .onOpenURL { url in
            let scheme = url.scheme?.lowercased()
            let host = url.host?.lowercased() ?? ""
            let path = url.path.lowercased()

            guard scheme == "votenow" else { return }

            if host == "mapv" || path.contains("mapv") {
                selectedTab = .howToVote
            } else if host == "directions" || path.contains("directions") {
                selectedTab = .howToVote
                if let mapsURL = mapvPlanStore.plan?.mapsURL {
                    UIApplication.shared.open(mapsURL)
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .toggleWhyVoteOverlay)) { notification in
            DispatchQueue.main.async {
                let userInfo = notification.userInfo
                if let x = userInfo?["originX"] as? CGFloat,
                   let y = userInfo?["originY"] as? CGFloat {
                    whyVoteTapOriginInSpreadSpace = CGPoint(x: x, y: y)
                } else if let x = userInfo?["originX"] as? Double,
                          let y = userInfo?["originY"] as? Double {
                    whyVoteTapOriginInSpreadSpace = CGPoint(x: x, y: y)
                }

                guard !showWhyVoteOverlay else { return }
                showWhyVoteOverlay = true
            }
        }

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

    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(PlanViewModel())
            .environmentObject(MyRepsViewModel())  // ← also inject here
    }
}
