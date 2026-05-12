import Foundation

// Renders a complete appeal document from a template + slots.
//
// Pure function. No I/O. The whole point of keeping this
// deterministic (versus a free-form LLM call) is so the resulting
// document is reviewable, auditable, and stable: the same inputs
// always produce the same output.
//
// Conditional sections:
//   - The reason-specific paragraph is picked by DenialReason.
//   - The failure-vs-refusal-to-cooperate argument is always
//     rendered after the reason paragraph for procedural denials.
//   - Statutory citations are pulled from the template's Citations
//     block; the renderer NEVER invents citations.
//
// Slot substitution:
//   - Each paragraph may contain {{slotName}} markers.
//   - Unmatched markers stay in place — the review screen renders
//     them in a warning style so the user can fill them in.

struct AppealDocument: Equatable {
    let stateCode: String
    let language: String
    /// The plain-text rendered output. Suitable for display, PDF
    /// generation, and email composition.
    let body: String
    /// True when every {{slot}} marker was substituted.
    let allSlotsResolved: Bool
    /// Slot names that were referenced in the template but not
    /// supplied by the caller. Surfaced to the review screen so the
    /// user can fill them.
    let missingSlots: [String]
}

enum AppealRenderer {
    static func render(
        template: AppealTemplate,
        denialReason: DenialReason,
        slots: [String: String]
    ) -> AppealDocument {
        let reasonParagraph = reasonParagraph(template: template, reason: denialReason)

        let paragraphsInOrder: [String] = [
            template.paragraphs.header,
            "",
            template.paragraphs.opening,
            "",
            reasonParagraph,
            "",
            template.paragraphs.failureVsRefusalArgument,
            "",
            template.paragraphs.closing,
            "",
            template.paragraphs.signatureBlock
        ]

        let joined = paragraphsInOrder.joined(separator: "\n")
        let (substituted, missing) = substitute(joined, slots: slots)

        return AppealDocument(
            stateCode: template.stateCode,
            language: template.language,
            body: substituted,
            allSlotsResolved: missing.isEmpty,
            missingSlots: missing.sorted()
        )
    }

    static func reasonParagraph(template: AppealTemplate, reason: DenialReason) -> String {
        switch reason {
        case .missedInterview: return template.paragraphs.missedInterview
        case .missingDocuments: return template.paragraphs.missingDocuments
        case .noResponse: return template.paragraphs.noResponse
        case .otherProcedural: return template.paragraphs.otherProcedural
        }
    }

    /// Substitute {{slot}} markers. Returns the rendered text plus
    /// the set of slots referenced but not provided.
    private static func substitute(_ text: String, slots: [String: String]) -> (String, [String]) {
        var output = text
        var missing: Set<String> = []

        // Capture every {{ident}} occurrence in source order so the
        // missing-list is deterministic; substitute the ones we have.
        let pattern = try? NSRegularExpression(pattern: #"\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}"#)
        let range = NSRange(output.startIndex..., in: output)
        guard let matches = pattern?.matches(in: output, range: range), !matches.isEmpty else {
            return (output, [])
        }

        // Walk the original string once to collect names; substitute
        // afterwards to keep indices stable.
        var slotNames: [String] = []
        for match in matches {
            guard let nameRange = Range(match.range(at: 1), in: output) else { continue }
            slotNames.append(String(output[nameRange]))
        }

        for name in slotNames {
            let placeholder = "{{\(name)}}"
            if let value = slots[name] {
                output = output.replacingOccurrences(of: placeholder, with: value)
            } else {
                missing.insert(name)
            }
        }

        return (output, Array(missing))
    }
}
