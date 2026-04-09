import Foundation
import Testing
@testable import VoteNow

struct AssistantBackgroundFirstResponseFormatterTests {
    @Test
    func governmentShutdownFormatIsLaymanAndComplete() {
        let output = AssistantBackgroundFirstResponseFormatter.format(
            rawInput: "end government shutdown",
            normalizedIssue: "End Government Shutdown",
            briefBackground: "Congress has not finalized appropriations.",
            commonInterpretations: [],
            evidenceLine: nil
        )

        #expect(output.hasPrefix("It sounds like you’re asking about"))
        #expect(output.contains("People usually mean one of a few things when they say this:"))
        #expect(!output.contains("**Generated prompt:**"))
        #expect(!output.localizedCaseInsensitiveContains("what do you want to do next"))
        #expect(!output.localizedCaseInsensitiveContains("tap looks right"))
        #expect(output.wordCount <= 260)
    }

    @Test
    func gunControlIncludesPromptAndNoNextStepCopy() {
        let output = AssistantBackgroundFirstResponseFormatter.format(
            rawInput: "gun control",
            normalizedIssue: "Gun Safety Policy",
            briefBackground: "Debates include background checks and weapon access.",
            commonInterpretations: [],
            evidenceLine: nil
        )

        #expect(output.contains("It sounds like you’re asking about"))
        #expect(output.contains("People usually mean one of a few things when they say this:"))
        #expect(!output.contains("**Generated prompt:**"))
        #expect(!output.localizedCaseInsensitiveContains("what do you want to do next"))
        #expect(!output.localizedCaseInsensitiveContains("menu"))
    }

    @Test
    func wildfireFormatRemainsConciseAndStructured() {
        let output = AssistantBackgroundFirstResponseFormatter.format(
            rawInput: "wildfires prevent",
            normalizedIssue: "Wildfire Prevention and Preparedness",
            briefBackground: "Prevention requires mitigation, staffing, and resilient infrastructure.",
            commonInterpretations: [],
            evidenceLine: nil
        )

        #expect(output.contains("It sounds like you’re asking about"))
        #expect(output.contains("People usually mean one of a few things when they say this:"))
        #expect(!output.contains("**Generated prompt:**"))
        #expect(!output.localizedCaseInsensitiveContains("what do you want to do next"))
        #expect(output.wordCount <= 260)
    }

    @Test
    func iranWarFormatHasStructuredSectionsAndNoButtonLanguage() {
        let output = AssistantBackgroundFirstResponseFormatter.format(
            rawInput: "Iran war end",
            normalizedIssue: "Prevent Escalation with Iran",
            briefBackground: "This issue concerns congressional war powers and military escalation risks.",
            commonInterpretations: [],
            evidenceLine: nil
        )

        #expect(output.contains("It sounds like you’re asking about"))
        #expect(output.contains("People usually mean one of a few things when they say this:"))
        #expect(!output.contains("**Generated prompt:**"))
        #expect(!output.localizedCaseInsensitiveContains("looks right"))
        #expect(!output.localizedCaseInsensitiveContains("revise"))
        #expect(output.wordCount <= 260)
    }

    @Test
    func formatCanSuppressTranslationPrefixForOptionRefinements() {
        let output = AssistantBackgroundFirstResponseFormatter.format(
            rawInput: "General: End or prevent a federal government shutdown",
            normalizedIssue: "End Government Shutdown",
            briefBackground: "Congress has not finalized appropriations.",
            commonInterpretations: [],
            evidenceLine: nil,
            includeTranslation: false
        )

        #expect(!output.contains("It sounds like you’re asking about"))
        #expect(!output.contains("***"))
        #expect(!output.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }
}

private extension String {
    var wordCount: Int {
        split(whereSeparator: { $0.isWhitespace || $0.isNewline }).count
    }
}
