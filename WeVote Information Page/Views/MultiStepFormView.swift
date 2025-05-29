//
//
//  MultiStepFormView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/23/25.
//  Updated by ChatGPT on 05/25/25 (pinned mail-in link)

import SwiftUI
import MapKit
import EventKit
import Foundation


// MARK: - Enum for Voting Method

enum VotingMethod: String {
    case early    = "Vote Early"
    case mail     = "Vote by Mail"
    case election = "Vote on Election Day"
}

// MARK: - MultiStepFormView: Four-Step Flow

struct MultiStepFormView: View {
    @EnvironmentObject var planVM: PlanViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var currentStep            = 0
    @State private var selectedMethod       : VotingMethod? = nil
    @State private var selectedPollingPlace : PollingPlace?  = nil
    @State private var chosenVotingTime     = Calendar.current.date(
                                                  from: DateComponents(
                                                    year: 2025,
                                                    month: 6,
                                                    day: 14,
                                                    hour: 9
                                                  )
                                                )!

    private let titles = [
        "Method to Vote",
        "Logistics",
        "When I'm Voting",
        "Commit and Bring a Friend"
    ]
    private let emojis = ["🗳️","📍","📅","🤝"]

    private var stepTitle: String { titles[currentStep] }
    private var stepEmoji: String { emojis[currentStep] }

    private var isNextEnabled: Bool {
        switch currentStep {
        case 0: return selectedMethod != nil
        case 1: return selectedMethod == .mail || selectedPollingPlace != nil
        default: return true
        }
    }

    var body: some View {
        VStack {
            // MARK: Header
            HStack(spacing: 8) {
                Text(stepEmoji).font(.system(size: 38))
                Text(stepTitle)
                    .font(.title).bold()
                    .multilineTextAlignment(.center)
                Text(stepEmoji).font(.system(size: 38))
            }
            .frame(maxWidth: .infinity)
            .padding(.top)

            Spacer()

            // MARK: Body Content
            Group {
                switch currentStep {
                case 0:
                    StepOneView(selectedMethod: $selectedMethod)

                case 1:
                    if selectedMethod == .mail {
                        AbsenteeView()
                    } else {
                        VStack(spacing: 16) {
                            Text("Polling places are local sites where you go to cast your in-person ballot. Here are locations near you (NOTE: takes 30 SECONDS to load locations:")
                                .font(.headline)
                                .multilineTextAlignment(.leading)
                                .padding(.horizontal)
                            PollingLocationsView(selectedPlace: $selectedPollingPlace)
                        }
                    }

                case 2:
                    StepThreeView(
                        selectedMethod: selectedMethod,
                        chosenVotingTime: $chosenVotingTime
                    )

                case 3:
                    StepFourView(
                        selectedMethod: selectedMethod,
                        selectedPollingPlace: selectedPollingPlace,
                        chosenVotingTime: chosenVotingTime
                    )

                default:
                    Text("Invalid Step")
                }
            }
            .animation(.default, value: currentStep)

            Spacer()

            // MARK: Bottom Navigation
            HStack(spacing: 12) {
                if currentStep > 0 {
                    Button("Back") { withAnimation { currentStep -= 1 } }
                        .padding()
                        .background(Color.gray.opacity(0.2))
                        .cornerRadius(8)
                }

                Spacer()

                if currentStep < 3 {
                    Button("Next") { withAnimation { currentStep += 1 } }
                        .padding()
                        .background(isNextEnabled ? Color.blue : Color.gray)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                        .disabled(!isNextEnabled)
                } else {
                    Button("Save My Plan to Vote") {
                        planVM.savePlan(
                            method: selectedMethod,
                            place:  selectedPollingPlace,
                            time:   chosenVotingTime
                        )
                        dismiss()
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
            }
            .padding(.horizontal)
        }
        .padding()
    }
}


// MARK: - Step 1: Method to Vote

struct StepOneView: View {
    @Binding var selectedMethod: VotingMethod?

    var body: some View {
        VStack(spacing: 20) {
            Text("In the NYC Primary Election, you can vote three ways.")
                .font(.headline)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            VotingMethodCard(
                methodTitle: VotingMethod.early.rawValue,
                emoji: "⏰",
                backgroundColor: Color.red.opacity(0.3),
                isSelected: selectedMethod == .early,
                action: { selectedMethod = .early }
            ) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Pros: Flexibility, Shorter Wait Times, Avoids Last-Minute Issues")
                    Text("Early Voting: June 14 – June 22, 2025")
                }
            }

            VotingMethodCard(
                methodTitle: VotingMethod.mail.rawValue,
                emoji: "✉️",
                backgroundColor: Color.blue.opacity(0.3),
                isSelected: selectedMethod == .mail,
                action: { selectedMethod = .mail }
            ) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Pros: Convenience, Extended Time, Accessibility")
                    Text("Request by: June 14, 2025")
                }
            }

            VotingMethodCard(
                methodTitle: VotingMethod.election.rawValue,
                emoji: "🗳️",
                backgroundColor: Color.white,
                isSelected: selectedMethod == .election,
                action: { selectedMethod = .election }
            ) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Election Day: Tuesday, June 24, 2025")
                    Text("Polls 6 AM – 9 PM")
                }
            }
        }
        .padding(.horizontal)
    }
}


// MARK: - VotingMethodCard

struct VotingMethodCard<Details: View>: View {
    let methodTitle    : String
    let emoji          : String
    let backgroundColor: Color
    let isSelected     : Bool
    let action         : () -> Void
    private let detailsContent: Details

    init(
        methodTitle: String,
        emoji: String,
        backgroundColor: Color,
        isSelected: Bool = false,
        action: @escaping () -> Void,
        @ViewBuilder details: () -> Details
    ) {
        self.methodTitle     = methodTitle
        self.emoji           = emoji
        self.backgroundColor = backgroundColor
        self.isSelected      = isSelected
        self.action          = action
        self.detailsContent  = details()
    }

    var body: some View {
        Button(action: action) {
            VStack(spacing: 12) {
                Text(emoji).font(.largeTitle)
                Text(methodTitle).font(.title2).bold()
                detailsContent.font(.body)
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 15).fill(backgroundColor))
            .overlay(
                RoundedRectangle(cornerRadius: 15)
                    .stroke(isSelected ? Color.black : Color.gray.opacity(0.5),
                            lineWidth: isSelected ? 2 : 1)
            )
            .shadow(color: Color.black.opacity(0.1), radius: 3, x: 0, y: 2)
        }
        .foregroundColor(.black)
    }
}


// MARK: - Step 2: Mail Voting Logistics

struct AbsenteeView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("📬 Request Your Mail-in Ballot")
                    .font(.title2).bold()
                    .multilineTextAlignment(.center)
                    .padding(.top)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Early Mail Ballot").font(.headline)
                    Text("""
NY’s new Early Mail Voter Act lets any registered voter apply for a mail-in ballot before Election Day. \
You must apply by **June 14, 2025**. Filing a false application or casting an illegal ballot is a felony. \
Once issued, you can’t vote on a machine—but you can still vote in-person with an affidavit ballot.
""")
                }

                Divider()

                VStack(alignment: .leading, spacing: 8) {
                    Text("Absentee Ballot").font(.headline)
                    Text("""
If you’ll be away, ill, caring for someone, or otherwise can’t appear in person, you may apply for an absentee ballot by **June 14, 2025** (online/mail) or **June 23, 2025** (in person). \
Applications received by mail must arrive 10 days before Election Day; in-person apps are accepted up to the day before.
""")
                }

                // ← pinned link button, no Spacer below
                Link(destination: URL(string: "https://vote.nyc/RequestBallot")!) {
                    Text("Go to NYC Ballot Request")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .cornerRadius(10)
                }
                .padding(.top)
            }
            .padding()
        }
    }
}


// MARK: - Step 3: When I’m Voting

struct StepThreeView: View {
    @EnvironmentObject var planVM: PlanViewModel
    var selectedMethod: VotingMethod?
    @Binding var chosenVotingTime: Date

    var body: some View {
        VStack(spacing: 20) {
            // ➡️ Your explanatory text, unchanged
            Text("""
            Choosing when to vote—whether it’s first thing in the morning, during a lunch break, \
            or after work—helps you avoid long lines, fit voting into your day, and give yourself \
            time to review your choices before casting your ballot.
            """)
            .font(.headline)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal)

            // ➡️ Heading
            Text("Pick when you’ll cast your ballot")
                .font(.headline)
                .multilineTextAlignment(.center)

            // ➡️ Wheel‐style date + time picker
            DatePicker(
                "",
                selection: $chosenVotingTime,
                in: Date()...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .datePickerStyle(.wheel)
            .labelsHidden()
            .padding(.horizontal)
        }
        .padding(.vertical)
    }
}


// MARK: - Step 4: Commit and Bring a Friend

struct StepFourView: View {
    // — Inputs
    var selectedMethod      : VotingMethod?
    var selectedPollingPlace: PollingPlace?
    var chosenVotingTime    : Date

    // — EventKit state
    @State private var eventStore           = EKEventStore()
    @State private var showCalendarAlert    = false
    @State private var calendarAlertMessage = ""

    // — Helper to pick the right emoji
    private func emojiForMethod(_ method: VotingMethod?) -> String {
        switch method {
        case .early:    return "⏰"
        case .mail:     return "✉️"
        case .election: return "🗳️"
        default:        return ""
        }
    }

    // — Pre‐format your time so you don’t break string interpolation
    private var formattedTime: String {
        DateFormatter.localizedString(
            from: chosenVotingTime,
            dateStyle: .medium,
            timeStyle: .short
        )
    }

    var body: some View {
        VStack(spacing: 20) {
            Text("""
                Congratulations on making a plan to vote—you’ve picked your method \
                and timing, so you’re all set to have your voice heard!
                """)
                .font(.headline)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            VStack(alignment: .leading, spacing: 8) {
                if let m = selectedMethod {
                    HStack { Text("Method:").bold(); Text("\(emojiForMethod(m)) \(m.rawValue)") }
                }

                if selectedMethod == .mail {
                    HStack { Text("Plan:").bold(); Text("✉️ Request Absentee/Mail-in Ballot") }
                }
                else if let place = selectedPollingPlace {
                    HStack { Text("Location:").bold(); Text("📍 \(place.name)") }
                    Text("Address: \(place.address)")
                    Text("Hours:   \(place.hours)")
                }

                HStack {
                    Text("Voting Time:").bold()
                    Text("📅 \(formattedTime)")
                }
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 15).fill(Color(UIColor.systemGray5)))
            .shadow(radius: 3)

            Button("Add to Calendar") {
                addToCalendar()
            }
            .font(.headline)
            .padding()
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 10).fill(Color.blue))
            .foregroundColor(.white)
            .shadow(radius: 2)
            .alert(isPresented: $showCalendarAlert) {
                Alert(title: Text(calendarAlertMessage))
            }

            Text("Democracy is a team sport! Encourage your friends to vote by sharing your plan.")
                .font(.headline)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Spacer()
        }
        .padding()
    }

    // MARK: - Calendar integration

    private func addToCalendar() {
        switch EKEventStore.authorizationStatus(for: .event) {
        case .notDetermined:
            eventStore.requestAccess(to: .event) { granted, _ in
                DispatchQueue.main.async {
                    if granted { createEvent() }
                    else {
                        calendarAlertMessage = "Calendar access denied."
                        showCalendarAlert    = true
                    }
                }
            }

        case .authorized:
            createEvent()

        default:
            calendarAlertMessage = "Calendar access denied. Please enable it in Settings."
            showCalendarAlert    = true
        }
    }

    private func createEvent() {
        let event       = EKEvent(eventStore: eventStore)
        event.title     = "Vote: NYC Mayoral Election"
        event.startDate = chosenVotingTime
        event.endDate   = chosenVotingTime.addingTimeInterval(60*60)
        event.location  = selectedPollingPlace?.address
        event.calendar  = eventStore.defaultCalendarForNewEvents

        do {
            try eventStore.save(event, span: .thisEvent)
            calendarAlertMessage = "Added to your calendar!"
        }
        catch {
            calendarAlertMessage = "Failed to add event: \(error.localizedDescription)"
        }

        showCalendarAlert = true
    }
} // ← make sure this is the final closing brace of your struct


// MARK: - Full Plan Detail Sheet

struct FullPlanDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let method    : VotingMethod?
    let place     : PollingPlace?
    let votingTime: Date

    private var formattedTime: String {
        let df = DateFormatter()
        df.dateStyle = .full; df.timeStyle = .short
        return df.string(from: votingTime)
    }

    var body: some View {
        NavigationView {
            List {
                if let m = method {
                    Label(m.rawValue, systemImage: "checkmark.circle")
                }
                if let p = place {
                    Label(p.address, systemImage: "mappin.and.ellipse")
                }
                Label(formattedTime, systemImage: "calendar")
            }
            .navigationTitle("Your Voting Plan")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
