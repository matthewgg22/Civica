import CivicaDesignSystem
import SwiftUI

// HANDOFF MobileInterviewBoard — "the most stressful part of the
// whole process, and the moment Civica earns the word advocacy."
//
// SNAP applicants statistically lose benefits at the interview step
// at a much higher rate than at any other stage — missed calls,
// frozen answers, hung-up call-backs. Civica's job here is to lower
// the activation energy: tell the user what's coming, give them
// phrasing they can borrow, walk through the call live if they
// want, and listen to how it went afterward.
//
// Four phases inside one view (internal navigation via @State):
//
//   .prep      — Day-before heads-up: when, who'll call, what to
//                have nearby, who to trust.
//   .questions — Canonical 12 MA SNAP interview questions with
//                "you can say:" prompts the user can read out loud.
//   .live      — During-the-call coach: scroll-through, tap to
//                advance, current question + next question visible.
//   .wrapup    — Post-call triage: four reflection options that
//                route to different follow-ups.
//
// Reached from the waiting room's action banner when the user's
// status is .interviewScheduled. Civica doesn't yet ingest DTA's
// interview-notice (date / time / county number) — placeholders
// stay generic-but-honest until that backend path lands.

struct SNAPInterviewCoachView: View {
    let language: CivicaLanguage
    /// Caller-supplied interview date. When present and ≥24h out, the
    /// prep view schedules a one-shot local notification 24h before
    /// the date so the user is nudged back into Civica the day before
    /// their call. Nil disables the notification (Step 2 of the
    /// Interview Navigator plan sources this from the status store).
    var interviewDate: Date? = nil
    let onDismiss: () -> Void

    @State private var phase: Phase = .prep
    @State private var liveQuestionIndex: Int = 0
    @State private var wrapupSelection: WrapupOption?

    enum Phase: Equatable {
        case prep
        case questions
        case live
        case wrapup
    }

    enum WrapupOption: String, CaseIterable, Identifiable {
        case smooth
        case stuck
        case rude
        case noCall
        var id: String { rawValue }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                    switch phase {
                    case .prep:      prepContent
                    case .questions: questionsContent
                    case .live:      liveContent
                    case .wrapup:    wrapupContent
                    }
                }
                .padding(CivicaSpacing.xl)
            }
            actionFooter
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: handleBack) {
                    Image(systemName: phase == .prep ? "xmark" : "chevron.left")
                        .foregroundStyle(CivicaColors.ink)
                }
                .accessibilityLabel(CivicaQuestionStrings.backLabel.value(in: language))
            }
        }
    }

    // MARK: - Phase 1: prep

    private var prepContent: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            Text(SNAPInterviewPrepStrings.eyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.brickPrimary)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(SNAPInterviewPrepStrings.title.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(SNAPInterviewPrepStrings.subtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: CivicaSpacing.sm) {
                ForEach(SNAPInterviewPrepTopics.list(language: language)) { topic in
                    prepTopicCard(topic)
                }
            }

            // Cross-link to the AI rehearsal flow. Gated the same way
            // the entry tile in CivicaEntryView gates — when the flag
            // is on, users can practice with simulated questions
            // before the real call.
            if InterviewCoachFeatureFlag.isEnabled {
                rehearsalCard
            }
        }
        .task(id: interviewDate) {
            SNAPAnalytics.trackInterviewPrepViewed()
            await scheduleTwentyFourHourReminderIfNeeded()
        }
    }

    private func prepTopicCard(_ topic: SNAPInterviewPrepTopics.Topic) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(topic.title)
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                ForEach(Array(topic.prompts.enumerated()), id: \.offset) { _, prompt in
                    HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                        Text("•")
                            .font(CivicaTypography.body)
                            .foregroundStyle(CivicaColors.brickPrimary)
                        Text(prompt)
                            .font(CivicaTypography.body)
                            .foregroundStyle(CivicaColors.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }

            if let permission = topic.permission {
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(SNAPInterviewPrepStrings.permissionLabel.value(in: language))
                        .font(CivicaTypography.captionStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .textCase(.uppercase)
                        .kerning(1.0)
                    Text(permission)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, CivicaSpacing.xs)
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private func scheduleTwentyFourHourReminderIfNeeded() async {
        guard let interviewDate else {
            CivicaLocalNotificationScheduler.cancel(
                identifier: SNAPInterviewNotification.twentyFourHourReminderID
            )
            return
        }
        let reminderDate = interviewDate.addingTimeInterval(-24 * 60 * 60)
        guard reminderDate > Date() else { return }

        let status = await CivicaLocalNotificationScheduler.authorizationStatus()
        if status == .notDetermined {
            _ = await CivicaLocalNotificationScheduler.requestAuthorization()
        }
        let scheduled = await CivicaLocalNotificationScheduler.schedule(
            identifier: SNAPInterviewNotification.twentyFourHourReminderID,
            fireAt: reminderDate,
            title: SNAPInterviewNotification.twentyFourHourTitle,
            body: SNAPInterviewNotification.twentyFourHourBody,
            language: language
        )
        if scheduled {
            SNAPAnalytics.trackInterview24hNotificationScheduled()
        }
    }

    private var rehearsalCard: some View {
        NavigationLink {
            InterviewCoachEntryView()
        } label: {
            rehearsalCardLabel
        }
        .simultaneousGesture(TapGesture().onEnded {
            InterviewCoachAnalytics.track(.crossLinkTapped)
        })
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(SNAPInterviewStrings.rehearseHeading.value(in: language)). \(SNAPInterviewStrings.rehearseBody.value(in: language)). \(SNAPInterviewStrings.rehearseAction.value(in: language)).")
    }

    private var rehearsalCardLabel: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: "bubble.left.and.bubble.right.fill")
                .font(.title3)
                .foregroundStyle(CivicaColors.brickPrimary)
                .frame(width: 32, alignment: .center)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(SNAPInterviewStrings.rehearseHeading.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.0)
                Text(SNAPInterviewStrings.rehearseBody.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(SNAPInterviewStrings.rehearseAction.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.brickPrimary)
                    .padding(.top, CivicaSpacing.xs)
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.brickPrimary.opacity(0.25), lineWidth: 1)
        )
    }

    // MARK: - Phase 2: questions

    private var questionsContent: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            Text(SNAPInterviewStrings.questionsEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(SNAPInterviewStrings.questionsTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)

            VStack(spacing: CivicaSpacing.sm) {
                ForEach(Array(SNAPInterviewQuestions.list(language: language).enumerated()), id: \.offset) { index, q in
                    questionCard(index: index, question: q)
                }
            }

            // "Don't know?" — first-class "not sure" path
            calloutCard(
                heading: SNAPInterviewStrings.dontKnowHeading.value(in: language),
                body: SNAPInterviewStrings.dontKnowBody.value(in: language),
                borderAccent: CivicaColors.hairline
            )
        }
    }

    private func questionCard(index: Int, question: SNAPInterviewQuestions.Question) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                Text("\(index + 1).")
                    .font(CivicaTypography.subheadStrong.monospacedDigit())
                    .foregroundStyle(CivicaColors.brickPrimary)
                Text(question.questionText)
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                    .italic()
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                Text(SNAPInterviewStrings.youCanSayLabel.value(in: language))
                    .font(CivicaTypography.caption.monospacedDigit())
                    .foregroundStyle(CivicaColors.brickPrimary)
                    .textCase(.uppercase)
                    .kerning(0.8)
                Text(question.suggestion)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.leading, CivicaSpacing.lg)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    // MARK: - Phase 3: live (during call)

    private var liveContent: some View {
        let questions = SNAPInterviewQuestions.list(language: language)
        return VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            HStack {
                Text(SNAPInterviewStrings.liveEyebrow.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.brickPrimary)
                    .textCase(.uppercase)
                    .kerning(1.2)
                Spacer()
                Circle()
                    .fill(CivicaColors.brickPrimary)
                    .frame(width: 8, height: 8)
                    .accessibilityHidden(true)
            }

            // Current-question card
            let current = questions[liveQuestionIndex]
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Text(SNAPInterviewStrings.questionOfLabel(
                    current: liveQuestionIndex + 1,
                    total: questions.count,
                    language: language
                ))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.0)
                Text(current.questionText)
                    .font(CivicaTypography.cardTitle)
                    .foregroundStyle(CivicaColors.ink)
                    .italic()
                    .fixedSize(horizontal: false, vertical: true)
                Text(SNAPInterviewStrings.youCanSayLabel.value(in: language) + " " + current.suggestion)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.brickPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, CivicaSpacing.xs)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.brickPrimary, lineWidth: 2)
            )

            // What's coming next
            if liveQuestionIndex + 1 < questions.count {
                let next = questions[liveQuestionIndex + 1]
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(SNAPInterviewStrings.nextUpLabel.value(in: language))
                        .font(CivicaTypography.captionStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .textCase(.uppercase)
                        .kerning(1.0)
                    Text(next.questionText)
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.ink)
                        .italic()
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(CivicaSpacing.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(CivicaColors.surfacePrimary.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card)
                        .strokeBorder(CivicaColors.hairline, lineWidth: 1)
                )
            }

            // "Stuck?" — normalizes pausing
            calloutCard(
                heading: SNAPInterviewStrings.stuckHeading.value(in: language),
                body: SNAPInterviewStrings.stuckBody.value(in: language),
                borderAccent: CivicaColors.hairline
            )
        }
    }

    // MARK: - Phase 4: wrapup

    private var wrapupContent: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            Text(SNAPInterviewStrings.wrapupEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.accentTeal)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(SNAPInterviewStrings.wrapupTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)

            VStack(spacing: CivicaSpacing.sm) {
                ForEach(WrapupOption.allCases) { option in
                    wrapupOptionCard(option)
                }
            }

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(SNAPInterviewStrings.wrapupNoteHeading.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.0)
                Text(SNAPInterviewStrings.wrapupNoteBody.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.accentTeal.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        }
    }

    private func wrapupOptionCard(_ option: WrapupOption) -> some View {
        let isSelected = wrapupSelection == option
        let copy = SNAPInterviewStrings.wrapupOption(option, language: language)
        return Button {
            wrapupSelection = option
        } label: {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(copy.title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(copy.body)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(CivicaSpacing.lg)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(
                        isSelected
                            ? (option == .rude || option == .noCall ? CivicaColors.brickPrimary : CivicaColors.accentTeal)
                            : CivicaColors.hairline,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Shared callout card

    private func calloutCard(heading: String, body: String, borderAccent: Color) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(heading)
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.0)
            Text(body)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(borderAccent, lineWidth: 1)
        )
    }

    // MARK: - Action footer

    @ViewBuilder
    private var actionFooter: some View {
        VStack(spacing: CivicaSpacing.sm) {
            switch phase {
            case .prep:
                CivicaPrimaryButton(
                    SNAPInterviewStrings.prepPrimary.value(in: language),
                    action: { phase = .questions }
                )
                CivicaSecondaryButton(
                    title: SNAPInterviewStrings.imOnTheCall.value(in: language),
                    action: { phase = .live; liveQuestionIndex = 0 }
                )
            case .questions:
                CivicaPrimaryButton(
                    SNAPInterviewStrings.imOnTheCall.value(in: language),
                    action: { phase = .live; liveQuestionIndex = 0 }
                )
                CivicaSecondaryButton(
                    title: SNAPInterviewStrings.backToPrep.value(in: language),
                    action: { phase = .prep }
                )
            case .live:
                let questions = SNAPInterviewQuestions.list(language: language)
                let atLast = liveQuestionIndex >= questions.count - 1
                CivicaPrimaryButton(
                    atLast
                        ? SNAPInterviewStrings.liveFinished.value(in: language)
                        : SNAPInterviewStrings.liveAdvance.value(in: language),
                    action: {
                        if atLast {
                            phase = .wrapup
                        } else {
                            liveQuestionIndex += 1
                        }
                    }
                )
                CivicaSecondaryButton(
                    title: SNAPInterviewStrings.livePause.value(in: language),
                    action: { phase = .wrapup }
                )
            case .wrapup:
                CivicaPrimaryButton(
                    SNAPInterviewStrings.wrapupPrimary.value(in: language),
                    isEnabled: wrapupSelection != nil,
                    action: onDismiss
                )
            }
        }
        .padding(.horizontal, CivicaSpacing.xl)
        .padding(.top, CivicaSpacing.md)
        .padding(.bottom, CivicaSpacing.lg)
        .background(CivicaColors.paper)
        .overlay(alignment: .top) {
            Rectangle().fill(CivicaColors.hairline).frame(height: 1)
        }
    }

    private func handleBack() {
        switch phase {
        case .prep:
            onDismiss()
        case .questions:
            phase = .prep
        case .live:
            phase = .questions
        case .wrapup:
            phase = .live
        }
    }
}

#if DEBUG
struct SNAPInterviewCoachView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            SNAPInterviewCoachView(language: .english, onDismiss: {})
        }
    }
}
#endif
