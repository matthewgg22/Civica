//
//
//  InteractiveIslandView.swift
//  VoteNow
//
//  Created by Matthew Greer-Gentis on 5/28/25.
//  Updated by ChatGPT on 05/28/25 (added debug tap & contentShape)
//
import SwiftUI
import UserNotifications
import OSLog

private let islandLogger = Logger(subsystem: "Civica", category: "InteractiveIsland")

// MARK: - Model

struct VotingPlan {
    let countdown: String       // e.g. "5h 23m"
    let electionName: String    // e.g. "NYC Mayoral Election"
    let votingTime: String      // e.g. "Apr 17, 2025 @ 2:00 PM"
    let location: String        // e.g. "PS 123 Voting Center"
    let distanceETA: String     // e.g. "2.3 mi • ETA 12 min"
}

// MARK: - Collapsed Island View

struct CollapsedIslandView: View {
    let countdown: String
    let electionName: String

    var body: some View {
        ZStack {
            Color.black
            HStack {
                Text(electionName)
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(.white)
                Spacer()
                Text("Polls Open: \(countdown)")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.green)
                    .cornerRadius(16)
            }
            .padding(.horizontal, 16)
        }
        .frame(width: 360, height: 64)
        .cornerRadius(32)
        .transition(.scale.combined(with: .opacity))
    }
}

// MARK: - Expanded Card View

struct ExpandedCardView: View {
    let plan: VotingPlan
    private let barWidth: CGFloat = 300
    private let barHeight: CGFloat = 4
    private var dotX: CGFloat { barWidth * ((14 - 7) / (21 - 7)) }

    var body: some View {
        VStack(spacing: 0) {
            // Top Info
            HStack {
                Text(plan.electionName)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)
                Spacer()
                Text("Polls Open")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.green)
                    .cornerRadius(12)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider().background(VoteNowColors.surfacePrimary)

            // Day Tracker
            VStack(spacing: 12) {
                ZStack {
                    Capsule()
                        .fill(VoteNowColors.borderSubtle.opacity(0.4))
                        .frame(width: barWidth, height: barHeight)
                    Capsule()
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [Color.green, Color.orange, Color.red]),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: barWidth, height: barHeight)
                    Circle()
                        .fill(VoteNowColors.surfacePrimary)
                        .frame(width: 8, height: 8)
                        .offset(x: dotX)
                    Text("▲")
                        .font(.system(size: 10))
                        .foregroundColor(.white)
                        .offset(x: dotX, y: -8)
                }

                HStack {
                    Text("7 AM")
                    Spacer()
                    Text("9 PM")
                }
                .font(.system(size: 12))
                .foregroundColor(.white)
                .frame(width: barWidth)

                HStack {
                    Text("⏱️ Polls close in \(plan.countdown)")
                    Spacer()
                    Text(plan.distanceETA)
                }
                .font(.system(size: 14))
                .foregroundColor(.white)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider().background(VoteNowColors.surfacePrimary)

            // My Plan to Vote
            VStack(alignment: .leading, spacing: 8) {
                Text("My Plan to Vote:")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)

                HStack {
                    Text(plan.votingTime)
                    Spacer()
                    Text(plan.location)
                }
                .font(.system(size: 14))
                .foregroundColor(.white)

                Button(action: {
                }) {
                    Text("Change Plan to Vote")
                        .font(.system(size: 14, weight: .medium))
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .foregroundColor(.white)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(VoteNowColors.surfacePrimary, lineWidth: 1)
                        )
                }
                .padding(.top, 8)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(Color.black)
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(VoteNowColors.surfacePrimary, lineWidth: 1)
        )
        .frame(width: 360)
        .transition(.scale.combined(with: .opacity))
    }
}

// MARK: - Interactive Island View

struct InteractiveIslandView: View {
    @EnvironmentObject var planVM: PlanViewModel
    @State private var isExpanded = false
    @State private var now = Date()

    private let dateFormatter: DateFormatter = {
        let df = DateFormatter()
        df.dateStyle = .medium
        df.timeStyle = .short
        return df
    }()

    private let countdownTimer = Timer.publish(every: 60, on: .main, in: .common).autoconnect()

    private var livePlan: VotingPlan? {
        guard
            let election = planVM.upcomingElections.first,
            let voteTime = planVM.plan.voteTime,
            let place    = planVM.plan.placeName,
            let addr     = planVM.plan.placeAddress
        else { return nil }

        let distance = planVM.plan.distanceETA ?? "–"

        let minutesRemaining = max(0, Int(voteTime.timeIntervalSince(now) / 60))
        let h = minutesRemaining / 60, m = minutesRemaining % 60
        let countdown = "\(h)h \(m)m"

        let votingTimeStr = dateFormatter.string(from: voteTime)
        let locationStr = "\(place) • \(addr)"

        return VotingPlan(
            countdown: countdown,
            electionName: election.name,
            votingTime: votingTimeStr,
            location: locationStr,
            distanceETA: distance
        )
    }

    var body: some View {
        ZStack {
            if let plan = livePlan, isExpanded {
                ExpandedCardView(plan: plan)
            } else if let plan = livePlan {
                CollapsedIslandView(
                    countdown: plan.countdown,
                    electionName: plan.electionName
                )
            } else {
                Text("Loading…")
                    .foregroundColor(VoteNowColors.textSecondary)
            }
        }
        .contentShape(Rectangle())                    // make full area tappable
        .onTapGesture {
            islandLogger.debug("Island tapped; expanding: \(!isExpanded, privacy: .public)")
            withAnimation { isExpanded.toggle() }
        }
        .animation(.easeInOut(duration: 0.3), value: isExpanded)
        .onReceive(countdownTimer) { input in now = input }
        .onAppear(perform: scheduleVoteReminder)
    }

    private func scheduleVoteReminder() {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { granted, error in
            guard granted, error == nil,
                  let voteDate = planVM.plan.voteTime else { return }

            let content = UNMutableNotificationContent()
            content.title = "🗳️ Polls Open Soon"
            content.body = "Your plan to vote is at \(dateFormatter.string(from: voteDate))"
            content.sound = .default

            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)

            let req = UNNotificationRequest(
                identifier: "voteReminder",
                content: content,
                trigger: trigger
            )
            center.add(req)
        }
    }
}

// MARK: - Preview

struct InteractiveIslandView_Previews: PreviewProvider {
    static var previews: some View {
        InteractiveIslandView()
            .environmentObject(PlanViewModel())
            .previewLayout(.sizeThatFits)
            .padding()
    }
}
