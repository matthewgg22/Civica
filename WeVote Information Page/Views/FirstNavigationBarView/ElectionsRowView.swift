//
//
//
//  ElectionsRowView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/22/25.
//

import CivicaDesignSystem
import SwiftUI

struct ElectionsRowView: View {
    let elections: [Election]
    @Binding var selectedTab: Tab

    @EnvironmentObject var planVM: PlanViewModel
    @State private var now = Date()
    @State private var showSurvey = false
    private let timer = Timer.publish(every: 60, on: .main, in: .common)
        .autoconnect()

    var body: some View {
        Group {
            if elections.isEmpty {
                Text("No upcoming elections")
                    .foregroundColor(CivicaColors.textSecondary)
                    .padding()
            } else {
                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(elections.indices, id: \.self) { idx in
                            let election = elections[idx]

                            VStack(spacing: CivicaSpacing.md) {
                                // 1. Centered, bold title
                                Text(election.name)
                                    .font(.title2)
                                    .bold()
                                    .multilineTextAlignment(.center)

                                // 2. Subtitle
                                Text(election.subtitle)
                                    .font(CivicaTypography.sectionHeader)
                                    .multilineTextAlignment(.center)

                                // 3. Registration deadline
                                Text("Registration Deadline: \(Self.dateFormatter.string(from: election.registrationDeadline))")
                                    .font(CivicaTypography.subhead)
                                    .multilineTextAlignment(.center)

                                Divider().background(Color.gray)

                                // 4. Early Voting row
                                HStack {
                                    Text("Early Voting Start:")
                                        .font(CivicaTypography.subhead)
                                    Spacer()
                                    Text(Self.dateFormatter.string(from: election.startDate))
                                        .font(CivicaTypography.subhead)
                                    Spacer()
                                    Text(countdownString(to: election.startDate))
                                        .font(.caption.monospacedDigit())
                                        .foregroundColor(CivicaColors.textSecondary)
                                }
                                .padding(.horizontal)

                                // 5. Election Day row
                                HStack {
                                    Text("Election Day:")
                                        .font(CivicaTypography.subhead)
                                    Spacer()
                                    Text(Self.dateFormatter.string(from: election.electionDay))
                                        .font(CivicaTypography.subhead)
                                    Spacer()
                                    Text(countdownString(to: election.electionDay))
                                        .font(.caption.monospacedDigit())
                                        .foregroundColor(CivicaColors.textSecondary)
                                }
                                .padding(.horizontal)
                            }
                            .padding(.vertical, CivicaSpacing.lg)
                            .padding(.horizontal)

                            if idx < elections.count - 1 {
                                Divider().background(Color.gray)
                            }
                        }
                    }
                }
            }
        }
        .onReceive(timer) { now = $0 }
        .sheet(isPresented: $showSurvey) {
            MultiStepFormView()
        }
    }

    // Countdown helper
    private func countdownString(to date: Date) -> String {
        let interval = max(0, date.timeIntervalSince(now))
        let days  = Int(interval) / 86_400
        let hours = (Int(interval) % 86_400) / 3_600
        let mins  = (Int(interval) % 3_600) / 60
        return String(format: "%02dd %02dh %02dm",
                      days, hours, mins)
    }

    // Medium‐style date only
    private static let dateFormatter: DateFormatter = {
        let df = DateFormatter()
        df.dateStyle = .medium
        df.timeStyle = .none
        return df
    }()
}

struct ElectionsRowView_Previews: PreviewProvider {
    static var previews: some View {
        ElectionsRowView(
            elections: PlanViewModel().upcomingElections,
            selectedTab: .constant(.electionTimeline)
        )
        .environmentObject(PlanViewModel())
    }
}
