import SwiftUI
import CivicaDesignSystem

// EXPERIMENTAL SILOED MODULE: practice session chat UI.
// Renders the transcript as alternating bubbles, exposes a text input bar
// at the bottom, and pushes to ReviewSummaryView once scoring completes.
struct PracticeSessionView: View {
    @StateObject private var viewModel = PracticeSessionViewModel()
    @State private var showScoreSheet = false
    @FocusState private var inputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            contextHeader

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                        ForEach(Array(viewModel.transcript.enumerated()), id: \.offset) { index, turn in
                            TurnRowView(turn: turn).id(index)
                        }

                        if case .awaitingCaseworker = viewModel.status {
                            HStack(spacing: CivicaSpacing.xs) {
                                ProgressView().controlSize(.small)
                                Text("Caseworker is typing…")
                                    .font(CivicaTypography.captionStrong)
                                    .foregroundStyle(CivicaColors.graphite)
                            }
                            .padding(.leading, CivicaSpacing.sm)
                        }

                        if case .scoring = viewModel.status {
                            HStack(spacing: CivicaSpacing.xs) {
                                ProgressView().controlSize(.small)
                                Text("Scoring your session…")
                                    .font(CivicaTypography.captionStrong)
                                    .foregroundStyle(CivicaColors.graphite)
                            }
                            .padding(.leading, CivicaSpacing.sm)
                        }

                        if case .failed(let message) = viewModel.status {
                            errorBanner(message)
                            retryButton
                        }

                        if viewModel.status == .complete {
                            completionFooter
                        }
                    }
                    .padding(.horizontal, CivicaSpacing.md)
                    .padding(.vertical, CivicaSpacing.md)
                }
                .onChange(of: viewModel.transcript.count) { _, newCount in
                    if newCount > 0 {
                        withAnimation(.easeOut(duration: 0.2)) {
                            proxy.scrollTo(newCount - 1, anchor: .bottom)
                        }
                    }
                }
            }

            if viewModel.status != .complete && viewModel.status != .scoring {
                inputBar
            }
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Practice session")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.startIfNeeded() }
        .navigationDestination(isPresented: $showScoreSheet) {
            if let score = viewModel.score {
                ReviewSummaryView(score: score)
            }
        }
    }

    // State-flag images live in the VoteNow assets bundle; on the Civica
    // side we surface the state code in a hairline pill instead until the
    // flag asset catalog ships.
    private var contextHeader: some View {
        HStack(spacing: CivicaSpacing.sm) {
            Text(viewModel.context.stateCode)
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.ink)
                .padding(.horizontal, CivicaSpacing.xs)
                .padding(.vertical, 2)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .fill(CivicaColors.tealSurface)
                )
            VStack(alignment: .leading, spacing: 0) {
                Text("\(viewModel.context.stateName) — \(viewModel.context.scenario.label)")
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text("\(viewModel.context.persona.label) caseworker · \(viewModel.context.archetype.label)")
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, CivicaSpacing.md)
        .padding(.vertical, CivicaSpacing.xs)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .overlay(
            Rectangle().frame(height: 1).foregroundStyle(CivicaColors.hairline),
            alignment: .bottom
        )
    }

    private var inputBar: some View {
        HStack(alignment: .bottom, spacing: CivicaSpacing.sm) {
            TextField("Your answer…", text: $viewModel.draftResponse, axis: .vertical)
                .focused($inputFocused)
                .textInputAutocapitalization(.sentences)
                .font(CivicaTypography.body)
                .padding(CivicaSpacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                        .fill(CivicaColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                        .stroke(CivicaColors.hairline, lineWidth: 1)
                )
                .lineLimit(1...5)
                .disabled(viewModel.status != .awaitingUser)

            Button {
                inputFocused = false
                Task { await viewModel.submitUserResponse() }
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .resizable().scaledToFit()
                    .frame(width: 36, height: 36)
                    .foregroundStyle(canSend ? CivicaColors.brickPrimary : CivicaColors.graphite.opacity(0.4))
            }
            .disabled(!canSend)
            .buttonStyle(.plain)
        }
        .padding(.horizontal, CivicaSpacing.md)
        .padding(.vertical, CivicaSpacing.sm)
        .background(CivicaColors.paper)
        .overlay(
            Rectangle().frame(height: 1).foregroundStyle(CivicaColors.hairline),
            alignment: .top
        )
    }

    private var canSend: Bool {
        viewModel.status == .awaitingUser &&
            !viewModel.draftResponse.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var completionFooter: some View {
        VStack(spacing: CivicaSpacing.sm) {
            Text("Interview complete.")
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)

            if viewModel.score == nil {
                Button {
                    Task {
                        await viewModel.requestScore()
                        if viewModel.score != nil { showScoreSheet = true }
                    }
                } label: {
                    Text("Get feedback")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(.white)
                        .padding(.horizontal, CivicaSpacing.lg)
                        .padding(.vertical, CivicaSpacing.sm)
                        .background(Capsule().fill(CivicaColors.brickPrimary))
                }
                .buttonStyle(.plain)
            } else {
                Button {
                    showScoreSheet = true
                } label: {
                    Text("See feedback")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(.white)
                        .padding(.horizontal, CivicaSpacing.lg)
                        .padding(.vertical, CivicaSpacing.sm)
                        .background(Capsule().fill(CivicaColors.brickPrimary))
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, CivicaSpacing.md)
    }

    private func errorBanner(_ message: String) -> some View {
        Text(message)
            .font(CivicaTypography.footnoteStrong)
            .foregroundStyle(CivicaColors.destructive)
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                    .fill(CivicaColors.destructive.opacity(0.10))
            )
    }

    private var retryButton: some View {
        Button {
            Task { await viewModel.retry() }
        } label: {
            Label("Try again", systemImage: "arrow.clockwise")
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(.white)
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.vertical, CivicaSpacing.sm)
                .background(Capsule().fill(CivicaColors.brickPrimary))
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .padding(.top, CivicaSpacing.xs)
    }
}

private struct TurnRowView: View {
    let turn: InterviewTurnDTO

    var body: some View {
        HStack {
            if turn.role == "applicant" { Spacer(minLength: 32) }

            Text(turn.text)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .padding(CivicaSpacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                        .fill(turn.role == "applicant"
                              ? CivicaColors.brickPrimary.opacity(0.12)
                              : CivicaColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                        .stroke(CivicaColors.hairline, lineWidth: 1)
                )

            if turn.role == "caseworker" { Spacer(minLength: 32) }
        }
    }
}
