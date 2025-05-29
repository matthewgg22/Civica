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

  private static let dateFormatter: DateFormatter = {
    let df = DateFormatter()
    df.dateStyle = .medium
    df.timeStyle = .none
    return df
  }()

  private static let timeFormatter: DateFormatter = {
    let tf = DateFormatter()
    tf.dateStyle = .none
    tf.timeStyle = .short
    return tf
  }()

  var body: some View {
    let vm = planVM
    let nextTitle = vm.upcomingElections.first?.name ?? ""

    // Only require method + voteTime
    if let methodRaw = vm.plan.method,
       let voteTime  = vm.plan.voteTime
    {
      VStack(alignment: .leading, spacing: 16) {
        // Title
        VStack(spacing: 4) {
          Text("My Plan to Vote")
            .font(.headline)
            .frame(maxWidth: .infinity)
            .multilineTextAlignment(.center)

          Text(nextTitle)
            .font(.subheadline)
            .foregroundColor(.secondary)
            .frame(maxWidth: .infinity)
            .multilineTextAlignment(.center)
        }

        Divider()

        // Show different rows depending on method
        switch methodRaw {
        case VotingMethod.early.rawValue,
             VotingMethod.election.rawValue:
          // Common in-person flow
          HStack(spacing: 8) {
            Image(systemName: methodRaw.lowercased().contains("early")
                      ? "clock"
                      : "calendar")
            Text(methodRaw)
              .font(.subheadline)
          }

          if let placeName = vm.plan.placeName,
             let placeAddr = vm.plan.placeAddress,
             let hours     = vm.plan.placeHours
          {
            HStack(spacing: 8) {
              Image(systemName: "mappin.and.ellipse")
              VStack(alignment: .leading, spacing: 2) {
                Text(placeName)
                  .font(.subheadline)
                Text(placeAddr)
                  .font(.caption)
                  .foregroundColor(.gray)
              }
            }

            Text("Hours: \(hours)")
              .font(.caption)
          }

        case VotingMethod.mail.rawValue:
          // Mail-in flow
          HStack(spacing: 8) {
            Image(systemName: "envelope")
            Text(methodRaw)
              .font(.subheadline)
          }
          Text("✉️ Request Absentee/Mail-in Ballot")
            .font(.subheadline)

        default:
          EmptyView()
        }

        // Voting time
        HStack(spacing: 8) {
          Image(systemName: "calendar")
          Text("\(Self.dateFormatter.string(from: voteTime)) at \(Self.timeFormatter.string(from: voteTime))")
            .font(.caption)
        }
      }
      .padding()
      .background(.regularMaterial)
      .cornerRadius(16)
      .shadow(radius: 2)
      .frame(maxWidth: .infinity)
    }
  }
}
