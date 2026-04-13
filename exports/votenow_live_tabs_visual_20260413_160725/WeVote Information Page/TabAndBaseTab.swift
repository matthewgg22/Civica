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

            // Call Your Rep
            NavigationStack {
                IssueCallCenterView(
                    federalReps: repsVM.federalReps,
                    userZip: {
                        let resolvedAddressZip = String((repsVM.resolvedLocationSelection?.postalCode ?? "").filter(\.isNumber).prefix(5))
                        if resolvedAddressZip.count == 5 { return resolvedAddressZip }
                        let addressZip = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
                        if addressZip.count == 5 { return addressZip }
                        let fallbackZip = String(planVM.zip.filter(\.isNumber).prefix(5))
                        return fallbackZip.count == 5 ? fallbackZip : ""
                    }(),
                    initialTab: .examples,
                    showsReturnHomeButton: false,
                    hidesTabBar: false
                )
            }
                .environmentObject(planVM)
                .environmentObject(repsVM)
                .tabItem {
                    Image(uiImage: VoteNowLogoIcon.tabBarBarsUIImage)
                        .renderingMode(.original)
                    Text("Call Your Rep")
                }
                .tag(Tab.callYourReps)

            // Election Timeline
            ElectionTimelineView()
                .environmentObject(planVM)
                .tabItem { Label("Election Timeline", systemImage: "calendar") }
                .tag(Tab.electionTimeline)

            // Voting Guide
            VoterRegistrationView()
                .environmentObject(planVM)
                .tabItem { Label("Voting Guide", systemImage: "person.badge.plus") }
                .tag(Tab.registration)

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
        .onReceive(NotificationCenter.default.publisher(for: .openMyInfoPanel)) { _ in
            showMyInfoPanel = true
        }
        // add any other sheets here, e.g. scorecard, registration reminder, election detail…
    }
}

struct TabAndBaseTab_Previews: PreviewProvider {
    static var previews: some View {
        TabAndBaseTab()
    }
}
