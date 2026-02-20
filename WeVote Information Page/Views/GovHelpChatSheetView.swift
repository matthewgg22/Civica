import SwiftUI

private struct GovHelpChatMessage: Identifiable {
    enum MessageRole {
        case user
        case assistant
    }

    let id = UUID()
    let role: MessageRole
    let text: String
    let suggestedRepIDs: [String]
    let reportingDestinationIDs: [String]
    let isError: Bool

    static func user(_ text: String) -> GovHelpChatMessage {
        GovHelpChatMessage(
            role: .user,
            text: text,
            suggestedRepIDs: [],
            reportingDestinationIDs: [],
            isError: false
        )
    }

    static func assistant(
        _ text: String,
        suggestedRepIDs: [String],
        reportingDestinationIDs: [String]
    ) -> GovHelpChatMessage {
        GovHelpChatMessage(
            role: .assistant,
            text: text,
            suggestedRepIDs: suggestedRepIDs,
            reportingDestinationIDs: reportingDestinationIDs,
            isError: false
        )
    }

    static func error(_ text: String) -> GovHelpChatMessage {
        GovHelpChatMessage(
            role: .assistant,
            text: text,
            suggestedRepIDs: [],
            reportingDestinationIDs: [],
            isError: true
        )
    }
}

struct GovHelpChatSheetView: View {
    let reps: [RepCardContext]
    let currentZip: String

    @Environment(\.dismiss) private var dismiss
    @State private var inputText = ""
    @State private var isSending = false
    @State private var messages: [GovHelpChatMessage]

    private let service: GovHelpService

    init(
        reps: [RepCardContext],
        currentZip: String,
        service: GovHelpService = GovHelpService()
    ) {
        self.reps = reps
        self.currentZip = currentZip
        self.service = service

        let normalizedZip = currentZip.trimmingCharacters(in: .whitespacesAndNewlines)
        let openingText: String
        if normalizedZip.isEmpty {
            openingText = "I can help route your government issue to the right office. Casework is usually handled only for constituents, so please confirm the ZIP used to load your representatives."
        } else {
            openingText = "I can help route your government issue to the right office. Casework is usually handled only for constituents, so please confirm you want to use ZIP \(normalizedZip)."
        }

        _messages = State(initialValue: [
            GovHelpChatMessage.assistant(
                openingText,
                suggestedRepIDs: [],
                reportingDestinationIDs: []
            )
        ])
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                chatBody
                composer
            }
            .background(VoteNowColors.background)
            .navigationTitle("Government Help")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var chatBody: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(messages) { message in
                        messageRow(message)
                            .id(message.id)
                    }

                    if isSending {
                        HStack(spacing: 8) {
                            ProgressView()
                            Text("Thinking…")
                                .font(.footnote)
                                .foregroundColor(VoteNowColors.mutedText)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(VoteNowColors.surfaceWhite)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                        )
                        .id("typing")
                    }
                }
                .padding(14)
            }
            .onChange(of: messages.count) { _ in
                guard let last = messages.last else { return }
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo(last.id, anchor: .bottom)
                }
            }
            .onChange(of: isSending) { sending in
                if sending {
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo("typing", anchor: .bottom)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func messageRow(_ message: GovHelpChatMessage) -> some View {
        let isUser = message.role == .user

        VStack(alignment: isUser ? .trailing : .leading, spacing: 8) {
            Text(message.text)
                .font(.body)
                .foregroundColor(message.isError ? VoteNowColors.richRed : (isUser ? .white : VoteNowColors.primaryText))
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(messageBackgroundColor(message, isUser: isUser))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(message.isError ? VoteNowColors.richRed.opacity(0.45) : Color.clear, lineWidth: 1)
                )
                .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)

            if !isUser {
                let suggested = contexts(for: message.suggestedRepIDs)
                if !suggested.isEmpty {
                    GovHelpSuggestedContactsView(contexts: suggested)
                }

                let destinations = GovHelpReportingDestinations.resolve(ids: message.reportingDestinationIDs)
                if !destinations.isEmpty {
                    GovHelpDestinationLinksView(destinations: destinations)
                }
            }
        }
    }

    private var composer: some View {
        HStack(spacing: 8) {
            TextField("Describe what you need help with", text: $inputText, axis: .vertical)
                .lineLimit(1...4)
                .textFieldStyle(.roundedBorder)
                .disabled(isSending)

            Button {
                sendMessage()
            } label: {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(width: 38, height: 38)
                    .background(VoteNowColors.primaryCTA)
                    .clipShape(Circle())
            }
            .disabled(trimmedInput.isEmpty || isSending)
            .opacity((trimmedInput.isEmpty || isSending) ? 0.45 : 1)
        }
        .padding(12)
        .background(VoteNowColors.surfaceWhite)
        .overlay(alignment: .top) {
            Divider()
        }
    }

    private var trimmedInput: String {
        inputText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func sendMessage() {
        let prompt = trimmedInput
        guard !prompt.isEmpty, !isSending else { return }

        messages.append(.user(prompt))
        inputText = ""
        isSending = true

        let repPayloads = reps.prefix(80).map { context in
            GovHelpRepPayload(
                repID: context.repId,
                name: context.official.name,
                sectionTitle: context.sectionTitle,
                level: context.level.rawValue,
                party: context.official.party,
                district: context.official.district,
                officialPhone: context.official.officialPhone,
                websiteURL: context.official.resolvedWebsiteURL,
                contactFormURL: context.official.contactFormURL,
                reportingDestinationIDs: GovHelpReportingDestinations.all.map(\.id)
            )
        }
        guard !repPayloads.isEmpty else {
            isSending = false
            messages.append(.error("Load your representatives first, then try again."))
            return
        }

        let conversation = messages
            .filter { !$0.isError }
            .map {
                GovHelpConversationTurn(
                    role: $0.role == .user ? .user : .assistant,
                    content: $0.text
                )
            }

        let payload = GovHelpRequestPayload(
            zip: normalizedZip(currentZip),
            userMessage: prompt,
            messages: conversation,
            conversation: conversation,
            reps: repPayloads,
            reportingDestinations: GovHelpReportingDestinations.payloads()
        )

        Task {
            defer { isSending = false }

            do {
                let response = try await service.send(payload)
                let assistantText = response.assistantMessage.trimmingCharacters(in: .whitespacesAndNewlines)
                messages.append(
                    .assistant(
                        assistantText.isEmpty ? "I couldn't generate guidance for that request. Please try rephrasing." : assistantText,
                        suggestedRepIDs: response.recommendedRepIDs,
                        reportingDestinationIDs: response.reportingDestinationIDs
                    )
                )
            } catch {
                let fallback = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                messages.append(.error("I couldn't reach government help right now: \(fallback)"))
            }
        }
    }

    private func messageBackgroundColor(_ message: GovHelpChatMessage, isUser: Bool) -> Color {
        if message.isError {
            return VoteNowColors.infoSurfaceRed
        }
        return isUser ? VoteNowColors.primaryCTA : VoteNowColors.surfaceWhite
    }

    private func contexts(for recommendedIDs: [String]) -> [RepCardContext] {
        let lookup = Dictionary(uniqueKeysWithValues: reps.map { ($0.repId, $0) })
        return recommendedIDs.compactMap { lookup[$0] }
    }

    private func normalizedZip(_ raw: String) -> String {
        let digits = raw.filter(\.isNumber)
        if digits.count >= 5 {
            return String(digits.prefix(5))
        }
        return raw.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

private struct GovHelpSuggestedContactsView: View {
    let contexts: [RepCardContext]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Suggested Contacts")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(VoteNowColors.primaryText)

            ForEach(Array(contexts.enumerated()), id: \.element.repId) { idx, context in
                RepRow(rep: context.official)
                if idx < contexts.count - 1 {
                    Divider()
                }
            }
        }
        .padding(10)
        .background(VoteNowColors.infoSurfaceBlue.opacity(0.45))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
        )
    }
}

private struct GovHelpDestinationLinksView: View {
    let destinations: [GovHelpReportingDestination]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Official Reporting")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(VoteNowColors.primaryText)

            ForEach(destinations) { destination in
                Link(destination: destination.url) {
                    Label(destination.label, systemImage: "link")
                        .font(.footnote.weight(.semibold))
                        .foregroundColor(VoteNowColors.primaryCTA)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 6)
                }
            }
        }
        .padding(10)
        .background(VoteNowColors.surfaceWhite)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
        )
    }
}
