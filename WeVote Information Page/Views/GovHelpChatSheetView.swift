import CivicaDesignSystem
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
    @Environment(\.locale) private var locale
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
        _messages = State(initialValue: [])
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                chatBody
                composer
            }
            .background(CivicaColors.paper)
            .navigationTitle(Text("app.gov_help.title", tableName: "AppShell"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(l("app.gov_help.action.done", "Done")) {
                        dismiss()
                    }
                }
            }
        }
        .onAppear {
            seedOpeningMessageIfNeeded()
        }
    }

    private var chatBody: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: CivicaSpacing.md) {
                    ForEach(messages) { message in
                        messageRow(message)
                            .id(message.id)
                    }

                    if isSending {
                        HStack(spacing: CivicaSpacing.sm) {
                            ProgressView()
                            Text(l("app.gov_help.thinking", "Thinking..."))
                                .font(CivicaTypography.footnote)
                                .foregroundColor(CivicaColors.graphite)
                        }
                        .padding(.horizontal, CivicaSpacing.md)
                        .padding(.vertical, CivicaSpacing.sm)
                        .background(CivicaColors.surfacePrimary)
                        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                                .stroke(CivicaColors.hairline, lineWidth: 1)
                        )
                        .id("typing")
                    }
                }
                .padding(CivicaSpacing.md)
            }
            .onChange(of: messages.count) { _, _ in
                guard let last = messages.last else { return }
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo(last.id, anchor: .bottom)
                }
            }
            .onChange(of: isSending) { _, sending in
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

        VStack(alignment: isUser ? .trailing : .leading, spacing: CivicaSpacing.sm) {
            Text(message.text)
                .font(.body)
                .foregroundColor(message.isError ? CivicaColors.ctaRed : (isUser ? .white : CivicaColors.ink))
                .padding(.horizontal, CivicaSpacing.md)
                .padding(.vertical, CivicaSpacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                        .fill(messageBackgroundColor(message, isUser: isUser))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                        .stroke(message.isError ? CivicaColors.ctaRed.opacity(0.45) : Color.clear, lineWidth: 1)
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
        HStack(spacing: CivicaSpacing.sm) {
            TextField(l("app.gov_help.input.placeholder", "Describe what you need help with"), text: $inputText, axis: .vertical)
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
                    .background(CivicaColors.brickPrimary)
                    .clipShape(Circle())
            }
            .disabled(trimmedInput.isEmpty || isSending)
            .opacity((trimmedInput.isEmpty || isSending) ? 0.45 : 1)
        }
        .padding(CivicaSpacing.md)
        .background(CivicaColors.surfacePrimary)
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
            messages.append(.error(l("app.gov_help.error.load_reps_first", "Load your representatives first, then try again.")))
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
            preferredLanguageCode: locale.language.languageCode?.identifier ?? "en",
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
                        assistantText.isEmpty ? l("app.gov_help.error.empty_guidance", "I couldn't generate guidance for that request. Please try rephrasing.") : assistantText,
                        suggestedRepIDs: response.recommendedRepIDs,
                        reportingDestinationIDs: response.reportingDestinationIDs
                    )
                )
            } catch {
                let fallback = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                messages.append(.error(lf("app.gov_help.error.unreachable", "I couldn't reach government help right now: %@", fallback)))
            }
        }
    }

    private func messageBackgroundColor(_ message: GovHelpChatMessage, isUser: Bool) -> Color {
        if message.isError {
            return CivicaColors.brickSurface
        }
        return isUser ? CivicaColors.brickPrimary : CivicaColors.surfacePrimary
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

    private func seedOpeningMessageIfNeeded() {
        guard messages.isEmpty else { return }

        let normalizedZip = currentZip.trimmingCharacters(in: .whitespacesAndNewlines)
        let openingText: String
        if normalizedZip.isEmpty {
            openingText = l(
                "app.gov_help.opening.no_zip",
                "I can help route your government issue to the right office. Casework is usually handled only for constituents, so please confirm the ZIP used to load your representatives."
            )
        } else {
            openingText = lf(
                "app.gov_help.opening.with_zip",
                "I can help route your government issue to the right office. Casework is usually handled only for constituents, so please confirm you want to use ZIP %@.",
                normalizedZip
            )
        }

        messages = [
            GovHelpChatMessage.assistant(
                openingText,
                suggestedRepIDs: [],
                reportingDestinationIDs: []
            )
        ]
    }

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }

    private func lf(_ key: String, _ fallback: String, _ args: CVarArg...) -> String {
        let format = l(key, fallback)
        return String(format: format, locale: locale, arguments: args)
    }
}

private struct GovHelpSuggestedContactsView: View {
    let contexts: [RepCardContext]
    @Environment(\.locale) private var locale

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(l("app.gov_help.suggested_contacts", "Suggested Contacts"))
                .font(CivicaTypography.subheadStrong)
                .foregroundColor(CivicaColors.ink)

            ForEach(Array(contexts.enumerated()), id: \.element.repId) { idx, context in
                RepRow(rep: context.official)
                if idx < contexts.count - 1 {
                    Divider()
                }
            }
        }
        .padding(CivicaSpacing.sm)
        .background(CivicaColors.tealSurface.opacity(0.45))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                .stroke(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }
}

private struct GovHelpDestinationLinksView: View {
    let destinations: [GovHelpReportingDestination]
    @Environment(\.locale) private var locale

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(l("app.gov_help.official_reporting", "Official Reporting"))
                .font(CivicaTypography.subheadStrong)
                .foregroundColor(CivicaColors.ink)

            ForEach(destinations) { destination in
                Link(destination: destination.url) {
                    Label(localizedDestinationLabel(destination), systemImage: "link")
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundColor(CivicaColors.brickPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, CivicaSpacing.xs)
                }
            }
        }
        .padding(CivicaSpacing.sm)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                .stroke(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private func localizedDestinationLabel(_ destination: GovHelpReportingDestination) -> String {
        switch destination.id {
        case "us-house-clerk":
            return l("app.gov_help.destination.us_house_clerk", destination.label)
        case "us-senate":
            return l("app.gov_help.destination.us_senate", destination.label)
        case "usa-gov-complaint":
            return l("app.gov_help.destination.usa_gov_complaint", destination.label)
        case "eac":
            return l("app.gov_help.destination.eac", destination.label)
        case "federal-trade-commission":
            return l("app.gov_help.destination.ftc", destination.label)
        default:
            return destination.label
        }
    }

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }
}
