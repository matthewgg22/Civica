//
//  ElectionTabView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/30/25.
//

import SwiftUI

struct ElectionTabView: View {
  @EnvironmentObject var planVM: PlanViewModel
  let election: Election

  var body: some View {
    VStack(spacing: CivicaSpacing.lg) {
      Text("\(election.name) – \(election.subtitle)")
        .font(.title2).bold()
        .multilineTextAlignment(.center)

      Text(election.subtitle)
        .font(CivicaTypography.sectionHeader)
        .foregroundColor(CivicaColors.textSecondary)

      Divider()

      HStack {
        Text("Registration Deadline:")
        Spacer()
        Text(election.registrationDeadline, style: .date)
      }

      HStack {
        Text("Early Voting Start:")
        Spacer()
        Text(election.startDate, style: .date)
        // call your existing CountdownView
      }

      HStack {
        Text("Election Day:")
        Spacer()
        Text(election.electionDay, style: .date)
      }

      Spacer()

      Button("Make a Plan to Vote") {
        // wire up to PlanViewModel, e.g. flip over to your PlanCard
      }
      .buttonStyle(.borderedProminent)
      .controlSize(.large)
    }
    .padding()
  }
}

// ‼️ No CountdownView struct here!  We’re using the one from Views/CountdownView.swift
