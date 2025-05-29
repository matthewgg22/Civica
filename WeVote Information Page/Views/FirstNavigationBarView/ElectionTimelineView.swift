//
//  ElectionTimelineView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/15/25.
//  Updated by ChatGPT on 5/15/25.

import SwiftUI

struct ElectionTimelineView: View {
    @EnvironmentObject var planVM: PlanViewModel
    @State private var planElection: Election?

    private let timelineElections: [Election] = [
        // 1. NYC Mayoral Race – Primary Election
        Election(
            name:                 "2025 NYC Mayoral Race",
            subtitle:             "Primary Election",
            registrationDeadline: Date.from("2025-06-14"),
            startDate:            Date.from("2025-06-14"),
            electionDay:          Date.from("2025-06-24")
        ),
        // 2. NYC Mayoral Race – General Election
        Election(
            name:                 "2025 NYC Mayoral Race",
            subtitle:             "General Election",
            registrationDeadline: Date.from("2025-10-10"),
            startDate:            Date.from("2025-10-25"),
            electionDay:          Date.from("2025-11-04")
        ),
        // 3. 2026 Midterm Race – Primary Election
        Election(
            name:                 "2026 Midterm Race",
            subtitle:             "Primary Election",
            registrationDeadline: Date.from("2026-05-15"),
            startDate:            Date.from("2026-06-01"),
            electionDay:          Date.from("2026-06-10")
        ),
        // 4. 2026 Midterm Race – General Election
        Election(
            name:                 "2026 Midterm Race",
            subtitle:             "General Election",
            registrationDeadline: Date.from("2026-10-10"),
            startDate:            Date.from("2026-10-25"),
            electionDay:          Date.from("2026-11-03")
        ),
        // 5. 2028 Presidential Race – Primary Election
        Election(
            name:                 "2028 Presidential Race",
            subtitle:             "Primary Election",
            registrationDeadline: Date.from("2028-02-15"),
            startDate:            Date.from("2028-03-01"),
            electionDay:          Date.from("2028-03-15")
        ),
        // 6. 2028 Presidential Race – General Election
        Election(
            name:                 "2028 Presidential Race",
            subtitle:             "General Election",
            registrationDeadline: Date.from("2028-10-10"),
            startDate:            Date.from("2028-10-25"),
            electionDay:          Date.from("2028-11-07")
        )
    ]

    // fixed width for date columns
    private let labelWidth: CGFloat = 150
    private let dateWidth: CGFloat  = 100

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                ForEach(Array(timelineElections.enumerated()), id: \.offset) { idx, election in
                    VStack(spacing: 16) {
                        // Header
                        Text("\(election.name) — \(election.subtitle)")
                            .font(.title2).bold()
                            .multilineTextAlignment(.center)

                        Divider().background(Color.gray)

                        // Registration Deadline
                        HStack {
                            Text("Registration Deadline:")
                                .frame(width: labelWidth, alignment: .leading)
                            Text(Self.dateFormatter.string(from: election.registrationDeadline))
                                .frame(width: dateWidth, alignment: .leading)
                            Spacer()
                        }
                        .font(.subheadline)

                        // Early Voting Start
                        HStack {
                            Text("Early Voting Start:")
                                .frame(width: labelWidth, alignment: .leading)
                            Text(Self.dateFormatter.string(from: election.startDate))
                                .frame(width: dateWidth, alignment: .leading)
                            Spacer()
                            Text(countdownString(to: election.startDate))
                                .font(.caption.monospacedDigit())
                                .foregroundColor(.secondary)
                        }
                        .font(.subheadline)

                        // Election Day
                        HStack {
                            Text("Election Day:")
                                .frame(width: labelWidth, alignment: .leading)
                            Text(Self.dateFormatter.string(from: election.electionDay))
                                .frame(width: dateWidth, alignment: .leading)
                            Spacer()
                            Text(countdownString(to: election.electionDay))
                                .font(.caption.monospacedDigit())
                                .foregroundColor(.secondary)
                        }
                        .font(.subheadline)

                        // Blue button only for the first Primary
                        if idx == 0 && election.subtitle.contains("Primary") {
                            Button("Make a Plan to Vote") {
                                planElection = election
                            }
                            .font(.subheadline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(8)
                        }
                    }
                    .padding()
                    .background(.regularMaterial)
                    .cornerRadius(12)
                }
            }
            .padding()
        }
        .navigationTitle("Election Timeline")
        .sheet(item: $planElection) { _ in
            MultiStepFormView()
                .environmentObject(planVM)
        }
    }

    // countdown without seconds
    private func countdownString(to date: Date) -> String {
        let interval = max(0, date.timeIntervalSince(Date()))
        let days  = Int(interval) / 86_400
        let hours = (Int(interval) % 86_400) / 3_600
        let mins  = (Int(interval) % 3_600) / 60
        return String(format: "%02dd %02dh %02dm", days, hours, mins)
    }

    private static let dateFormatter: DateFormatter = {
        let df = DateFormatter()
        df.dateStyle = .medium
        df.timeStyle = .none
        return df
    }()
}

struct ElectionTimelineView_Previews: PreviewProvider {
    static var previews: some View {
        ElectionTimelineView()
            .environmentObject(PlanViewModel())
    }
}
