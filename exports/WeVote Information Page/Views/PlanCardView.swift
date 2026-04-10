//
//  PlanCardView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/1/25.
//  Updated by ChatGPT on 5/19/25.
//

import SwiftUI

struct PlanCardView: View {
  @EnvironmentObject var planVM: PlanViewModel
  @EnvironmentObject var mapvPlanStore: MAPVPlanStore
  var waterfallController: EmojiWaterfallController? = nil
  @State private var showPlannerSheet = false
  @State private var didBootstrapLegacyPlan = false
  @StateObject private var localWaterfallController = EmojiWaterfallController()

  private var activeWaterfallController: EmojiWaterfallController {
      waterfallController ?? localWaterfallController
  }

  var body: some View {
      MAPVCardView(
          waterfallController: activeWaterfallController,
          onChangePlanTapped: {
          showPlannerSheet = true
      })
      .onAppear {
          guard didBootstrapLegacyPlan == false else { return }
          didBootstrapLegacyPlan = true
          DispatchQueue.main.async {
              mapvPlanStore.bootstrapFromLegacyPlanViewModel(planVM)
          }
      }
      .sheet(isPresented: $showPlannerSheet) {
          MultiStepFormView()
              .environmentObject(planVM)
              .environmentObject(mapvPlanStore)
      }
  }
}
