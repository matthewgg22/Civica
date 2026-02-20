//
//
//  TabAndBaseTab.swift
//  WeVote Information Page
//
//  Updated by ChatGPT on 05/21/25
//  ⇢ uses the shared Tab enum from ContentView.swift

import SwiftUI

struct TabAndBaseTab: View {
    @StateObject private var planVM = PlanViewModel()
    @StateObject private var repsVM = MyRepsViewModel()

    @State private var selectedTab     = Tab.myReps
    @State private var showScorecard   = false
    @State private var showRegReminder = false
    @State private var showMayorModal  = false
    @State private var showMyInfoPanel = false

    var body: some View {
        TabView(selection: $selectedTab) {
            // My Reps
            MyRepsView()
                .environmentObject(planVM)
                .environmentObject(repsVM)
                .tabItem { Label("My Reps", systemImage: "person.3.fill") }
                .tag(Tab.myReps)

            // Election Timeline
            ElectionTimelineView()
                .environmentObject(planVM)
                .tabItem { Label("Election Timeline", systemImage: "calendar") }
                .tag(Tab.electionTimeline)

            // Registration
            VoterRegistrationView()
                .environmentObject(planVM)
                .tabItem { Label("Registration", systemImage: "person.badge.plus") }
                .tag(Tab.registration)

            // Election Guide
            NYCMayoralElectionView()
                .environmentObject(planVM)
                .tabItem { Label("Election Guide", systemImage: "mappin.and.ellipse") }
                .tag(Tab.electionGuide)

            // How to Vote
            MobilizationView()
                .environmentObject(planVM)
                .tabItem {
                    Image(uiImage: VoteNowLogoIcon.tabBarBarsUIImage)
                        .renderingMode(.original)
                    Text("How to Vote")
                }
                .tag(Tab.howToVote)

        }
        .environmentObject(planVM)
        .environmentObject(repsVM)
        .tint(VoteNowColors.primaryCTA)
        .overlay(alignment: .topTrailing) {
            Button { showMyInfoPanel = true } label: {
                Image(systemName: "person.crop.circle.fill")
                    .font(.system(size: 28))
                    .padding()
            }
        }
        .sheet(isPresented: $showMyInfoPanel) {
            MyInfoPanelView()
                .environmentObject(planVM)
                .environmentObject(repsVM)
        }
        // add any other sheets here, e.g. scorecard, registration reminder, election detail…
    }
}

struct TabAndBaseTab_Previews: PreviewProvider {
    static var previews: some View {
        TabAndBaseTab()
    }
}
