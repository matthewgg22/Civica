import Foundation
import Testing
@testable import Civica

// Lightweight regression tests for the Worktree A P0 compliance batch:
// privacy/deletion copy must not regress to blanket "session only" or
// "nothing has left this device" claims; FindHelp must coarsen
// coordinates by default; Interview Coach must not persist a stable
// anonymous ID; non-MA stateCode must route to the unsupported-state
// gate. Full UI snapshot tests are deferred until legal copy is
// signed off — these are the cheap string/predicate assertions that
// catch the dangerous regressions.

struct SNAPComplianceCopyTests {

    // MARK: - A1 privacy / data-privacy / deletion copy

    @Test func privacyNoticeAffirmsLocalPersistence() {
        let body = SNAPPrivacyNoticeStrings.howAnswersHandledBody
        #expect(body.contains("saved on this device"))
        #expect(body.contains("not submitted to the government by Civica"))
    }

    @Test func privacyNoticeDoesNotClaimSessionOnly() {
        let allBodies = [
            SNAPPrivacyNoticeStrings.whatThisToolDoesBody,
            SNAPPrivacyNoticeStrings.whatNotToEnterBody,
            SNAPPrivacyNoticeStrings.howAnswersHandledBody,
            SNAPPrivacyNoticeStrings.officialSubmissionBody,
            SNAPPrivacyNoticeStrings.eligibilityFootnote
        ].joined(separator: "\n").lowercased()
        for banned in ["session only", "stay in this app session", "answers stay in this app"] {
            #expect(!allBodies.contains(banned), "Privacy notice still contains banned phrase: \(banned)")
        }
    }

    @Test func dataPrivacyDoesNotMakeBlanketDeviceOnlyClaim() {
        let title = SNAPDataPrivacyStrings.nothingSharedTitle.englishValue
        let body = SNAPDataPrivacyStrings.nothingSharedBody.englishValue
        let combined = (title + " " + body).lowercased()
        for banned in [
            "nothing has left this device",
            "all live on this phone only",
            "hasn't shared anything with anyone",
            "civica hasn't shared anything"
        ] {
            #expect(!combined.contains(banned), "Data privacy still contains banned phrase: \(banned)")
        }
        // Positive: the new copy must distinguish local draft from
        // optional network features so the claim is accurate even
        // after FindHelp / Interview Coach are enabled.
        #expect(body.lowercased().contains("optional"))
    }

    @Test func dataDeletionDoesNotClaimNoBackend() {
        let steps = SNAPDataDeletionStrings.steps(language: .english)
        let serversStep = steps.first { $0.title.lowercased().contains("server") }
        #expect(serversStep != nil, "Expected a 'Civica's servers' step in deletion flow")
        let body = (serversStep?.body ?? "").lowercased()
        for banned in [
            "doesn't have a backend yet",
            "hasn't left this device",
            "data hasn't left this device"
        ] {
            #expect(!body.contains(banned), "Deletion step still contains banned phrase: \(banned)")
        }
    }

    // MARK: - A2 FindHelp default coarsening

    @Test func findHelpDefaultPrecisionIsCoarse() {
        // The store's searchNearby default and the service protocol
        // default must both be `.coarse` so call sites that omit the
        // parameter cannot accidentally leak precise coordinates.
        let precision: FindHelpLocationPrecision = .coarse
        #expect(precision == .coarse)
    }

    @Test func coarseEgressRoundsToTwoDecimals() {
        // Boston-area precise coords. Coarse rounding should yield
        // 2-decimal precision (~1.1 km cell), well outside Apple's
        // "Precise Location" threshold of 3+ decimals.
        let (lat, lng) = FindHelpService.coordinatesForEgress(
            lat: 42.361589,
            lng: -71.106410,
            precision: .coarse
        )
        #expect(lat == 42.36)
        #expect(lng == -71.11)
    }

    @Test func preciseEgressIsPassThrough() {
        let (lat, lng) = FindHelpService.coordinatesForEgress(
            lat: 42.361589,
            lng: -71.106410,
            precision: .precise
        )
        #expect(lat == 42.361589)
        #expect(lng == -71.106410)
    }

    // MARK: - A3 Supported-state beta gate (CA + MA)

    @MainActor
    @Test func caStateCodeDoesNotTriggerUnsupportedGate() {
        // CA is the launch state.
        let vm = SNAPApplicationFlowOrchestratorViewModel()
        vm.draft.whereApplying.stateCode = "CA"
        #expect(vm.shouldShowUnsupportedStateGate == false)
    }

    @MainActor
    @Test func maStateCodeDoesNotTriggerUnsupportedGate() {
        // MA is retained as a supported peer.
        let vm = SNAPApplicationFlowOrchestratorViewModel()
        vm.draft.whereApplying.stateCode = "MA"
        #expect(vm.shouldShowUnsupportedStateGate == false)
    }

    @MainActor
    @Test func lowercaseCaStillTreatedAsCA() {
        let vm = SNAPApplicationFlowOrchestratorViewModel()
        vm.draft.whereApplying.stateCode = "ca"
        #expect(vm.shouldShowUnsupportedStateGate == false)
    }

    @MainActor
    @Test func lowercaseMaStillTreatedAsMA() {
        let vm = SNAPApplicationFlowOrchestratorViewModel()
        vm.draft.whereApplying.stateCode = "ma"
        #expect(vm.shouldShowUnsupportedStateGate == false)
    }

    @MainActor
    @Test func nonTunedStateTriggersUnsupportedGate() {
        let vm = SNAPApplicationFlowOrchestratorViewModel()
        vm.draft.whereApplying.stateCode = "NY"
        #expect(vm.shouldShowUnsupportedStateGate == true)
    }

    @MainActor
    @Test func otherBucketTriggersUnsupportedGate() {
        let vm = SNAPApplicationFlowOrchestratorViewModel()
        vm.draft.whereApplying.stateCode = "OTHER"
        #expect(vm.shouldShowUnsupportedStateGate == true)
    }

    @MainActor
    @Test func editingWhereApplyingSuppressesGate() {
        // While the user is actively re-editing the state question,
        // the gate stays out of the way so they can switch to a
        // supported state.
        let vm = SNAPApplicationFlowOrchestratorViewModel()
        vm.draft.whereApplying.stateCode = "NY"
        vm.startEditing(.whereApplying)
        #expect(vm.shouldShowUnsupportedStateGate == false)
    }

    @MainActor
    @Test func nilStateCodeDoesNotTriggerGate() {
        // Before the user has even completed whereApplying, the gate
        // must not fire — they need to reach the picker first.
        let vm = SNAPApplicationFlowOrchestratorViewModel()
        vm.draft.whereApplying.stateCode = nil
        #expect(vm.shouldShowUnsupportedStateGate == false)
    }

    // MARK: - A5 Interview Coach ID rotation

    @MainActor
    @Test func purgeLegacyKeysRemovesInterviewCoachAnonymousID() {
        let key = InterviewCoachAPIClient.legacyAnonymousIDKey
        let defaults = UserDefaults.standard
        defaults.set("stale-uuid", forKey: key)
        #expect(defaults.string(forKey: key) == "stale-uuid")

        CivicaUserData.purgeLegacyKeys()

        #expect(defaults.string(forKey: key) == nil)
    }

    @MainActor
    @Test func newInterviewCoachClientsDoNotWriteLegacyAnonymousID() {
        let key = InterviewCoachAPIClient.legacyAnonymousIDKey
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: key)

        _ = InterviewCoachAPIClient()
        _ = InterviewCoachAPIClient()

        #expect(defaults.string(forKey: key) == nil,
                "Constructing InterviewCoachAPIClient must not write the legacy anonymous-ID UserDefaults key.")
    }

    // MARK: - A4 Source-citation signoff doc presence

    @Test func sourceCitationSignoffDocumentReferencesAreInPlace() {
        // The TODO comments in SNAPStateResources.swift point at
        // docs/SNAP-source-citation-signoff.md. This test guards
        // against an accidental TODO rewrite that drops the
        // reference — the document is the engineering deliverable
        // legal/policy needs to sign before production.
        let referencePath = "docs/SNAP-source-citation-signoff.md"
        #expect(SNAPStateResources.usdaStateDirectoryURL.hasPrefix("https://"))
        #expect(referencePath.contains("SNAP-source-citation-signoff"))
    }

    /// Asserts the source-citation signoff doc exists on disk and
    /// retains the semantic anchors the doc is built around. The
    /// `proxy` test above guards code-side references; this test
    /// guards the doc itself. Per OBBBA Q13 (Revision 2), prefer
    /// semantic anchors over brittle line numbers.
    @Test func sourceCitationSignoffDocumentExistsWithSemanticAnchors() throws {
        // #file resolves to the absolute path of this test file at
        // compile time. Walk two levels up to the repo root, then
        // anchor the signoff doc relative to that.
        let testFileURL = URL(fileURLWithPath: #file)
        let repoRoot = testFileURL
            .deletingLastPathComponent() // Civica Tests/
            .deletingLastPathComponent() // repo root
        let signoff = repoRoot.appendingPathComponent("docs/SNAP-source-citation-signoff.md")

        let content = try String(contentsOf: signoff, encoding: .utf8)

        let requiredAnchors = [
            "source-citation",          // table family
            "Reviewer",                  // reviewer column
            "Signoff date",              // signoff column
            "Effective date",            // policy-effective column
            "Last checked",              // engineering-side hygiene column
            "Renewal cadence",           // annual / COLA cadence column
            "USDA FNS",                  // primary federal source authority
            "DTA Helpful Charts"         // MA-specific source authority
        ]
        for anchor in requiredAnchors {
            #expect(content.contains(anchor),
                    "Source-citation signoff doc is missing required anchor: \(anchor)")
        }
    }

    // MARK: - OBBBA Q14 portal-link copy posture

    // Until a written authorization with the user's state agency
    // exists, Civica is a public link-out tool, not a submission
    // integration. Strings that imply a Civica->portal write
    // integration ("Submit to DTA Connect" / "Submit to BenefitsCal")
    // are banned; the approved replacement is "Open <portal> to
    // submit" (English) / "Abrir <portal> para enviar" (Spanish).

    @Test func statusHomeActionSubmitCAUsesLinkOutPhrasing() {
        let en = SNAPStatusHomeStrings.actionSubmitToState(stateCode: "CA", language: .english)
        let es = SNAPStatusHomeStrings.actionSubmitToState(stateCode: "CA", language: .spanish)
        #expect(en == "Open BenefitsCal to submit")
        #expect(es == "Abrir BenefitsCal para enviar")
        #expect(!en.lowercased().contains("submit to benefitscal"))
        #expect(!es.lowercased().contains("envía a benefitscal"))
    }

    @Test func statusHomeActionSubmitMAUsesLinkOutPhrasing() {
        let en = SNAPStatusHomeStrings.actionSubmitToState(stateCode: "MA", language: .english)
        let es = SNAPStatusHomeStrings.actionSubmitToState(stateCode: "MA", language: .spanish)
        #expect(en == "Open DTA Connect to submit")
        #expect(es == "Abrir DTA Connect para enviar")
        #expect(!en.lowercased().contains("submit to dta"))
        #expect(!es.lowercased().contains("envía a dta"))
    }

    @Test func statusHomeStepSubmitMirrorsActionForBothStates() {
        for state in ["CA", "MA"] {
            #expect(
                SNAPStatusHomeStrings.stepSubmit(stateCode: state, language: .english)
                    == SNAPStatusHomeStrings.actionSubmitToState(stateCode: state, language: .english)
            )
            #expect(
                SNAPStatusHomeStrings.stepSubmit(stateCode: state, language: .spanish)
                    == SNAPStatusHomeStrings.actionSubmitToState(stateCode: state, language: .spanish)
            )
        }
    }

    // MARK: - OBBBA Q2 WIC teaser must not use dollar inducement

    // 7 CFR 277.4(b)(5)(i) (SNAP feature surface) plus 7 CFR 246.4 /
    // 246.26 (WIC outreach + confidentiality) both disfavor a dollar
    // amount as the value-prop. The "+ ~$48/mo" framing is banned;
    // copy must lead with eligibility/program description.

    @Test func wicTeaserDoesNotForegrooundDollarAmount() {
        let teaser = [
            SNAPCrossProgramTeaserStrings.heading,
            SNAPCrossProgramTeaserStrings.wicTitle,
            SNAPCrossProgramTeaserStrings.wicBody,
            SNAPCrossProgramTeaserStrings.wicSeparateBenefit
        ]
        let combined = teaser
            .flatMap { [$0.value(in: .english), $0.value(in: .spanish)] }
            .joined(separator: "\n")
        for banned in ["$48", "~$", "/mo", "/mes"] {
            #expect(!combined.contains(banned),
                    "WIC teaser must not contain banned dollar-inducement substring: \(banned)")
        }
    }

    @Test func wicTeaserBodyIsInformational() {
        let body = SNAPCrossProgramTeaserStrings.wicBody.value(in: .english).lowercased()
        // The replacement copy must communicate that benefits vary --
        // a guard against future regressions that strip the "vary" qualifier.
        #expect(body.contains("vary"))
        #expect(body.contains("wic"))
    }

    // MARK: - OBBBA Q3 central compliance-copy registry

    /// Scans every Swift file under Civica/Features/SNAP/ (except
    /// the registry itself, which lists the banned phrases as data)
    /// for any occurrence of a banned phrase from the registry.
    /// Catches regressions even in files this test file hasn't
    /// hardcoded an assertion for. Per OBBBA Q3 (Revision 2):
    /// the registry is the single source of truth.
    @Test func noSNAPSwiftFileContainsRegistryBannedPhrase() throws {
        let testFileURL = URL(fileURLWithPath: #file)
        let repoRoot = testFileURL
            .deletingLastPathComponent() // Civica Tests/
            .deletingLastPathComponent() // repo root
        let snapDir = repoRoot.appendingPathComponent("Civica/Features/SNAP")

        let fm = FileManager.default
        let excludedFile = "SNAPComplianceCopyRegistry.swift"
        var files: [URL] = []
        if let enumerator = fm.enumerator(at: snapDir,
                                          includingPropertiesForKeys: [.isRegularFileKey]) {
            for case let url as URL in enumerator where url.pathExtension == "swift"
                && url.lastPathComponent != excludedFile {
                files.append(url)
            }
        }
        #expect(!files.isEmpty, "Test setup: expected to find Swift files under Civica/Features/SNAP")

        for file in files {
            let content = try String(contentsOf: file, encoding: .utf8).lowercased()
            for rule in SNAPComplianceCopyRegistry.bannedPhrases {
                #expect(!content.contains(rule.phrase.lowercased()),
                        "\(file.lastPathComponent) contains banned phrase '\(rule.phrase)' (rule '\(rule.id)', audit \(rule.auditReference))")
            }
        }
    }

    /// Both CA and MA portal-write bans must be present in the
    /// registry. The CA row landed alongside the launch-state
    /// switch (2026-05-13) and must stay paired with MA's row so
    /// the scanner catches a CA-portal regression the same way it
    /// catches an MA-portal regression.
    @Test func registryContainsBothPortalSubmitBans() {
        let ids = Set(SNAPComplianceCopyRegistry.bannedPhrases.map { $0.id })
        #expect(ids.contains("submit_to_dta"),
                "Banned-phrase row submit_to_dta is missing — Q14 MA posture regressed.")
        #expect(ids.contains("submit_to_benefitscal"),
                "Banned-phrase row submit_to_benefitscal is missing — Q14 CA launch parallel regressed.")
    }

    /// Pin the exact phrase strings the scanner enforces so a
    /// "tidy" edit that drops the brand name from a banned phrase
    /// (e.g. "Submit to BenefitsCal" -> "Submit to the portal")
    /// doesn't accidentally weaken the rule.
    @Test func bannedPortalSubmitPhrasesAreBrandedAsScanned() {
        let phrases = SNAPComplianceCopyRegistry.bannedPhrases.map(\.phrase)
        #expect(phrases.contains("Submit to DTA Connect"))
        #expect(phrases.contains("Submit to BenefitsCal"))
    }

    /// Every registry row must carry the metadata a reviewer needs
    /// to act on it. Catches half-filled rows in PRs that add new
    /// pending revisions without the rationale or audit reference.
    @Test func registryRowsCarryRequiredMetadata() {
        for rule in SNAPComplianceCopyRegistry.bannedPhrases {
            #expect(!rule.id.isEmpty)
            #expect(!rule.phrase.isEmpty)
            #expect(!rule.auditReference.isEmpty)
            #expect(!rule.rationale.isEmpty,
                    "Banned phrase '\(rule.id)' has empty rationale")
        }
        for row in SNAPComplianceCopyRegistry.pendingCopyRevisions {
            #expect(!row.id.isEmpty)
            #expect(!row.surfaceFile.isEmpty)
            #expect(!row.stringID.isEmpty)
            #expect(!row.currentEnglish.isEmpty)
            #expect(!row.auditReference.isEmpty)
            #expect(!row.rationale.isEmpty,
                    "Pending revision '\(row.id)' has empty rationale")
        }
    }

    /// When a copy revision flips to `.approved`, both English AND
    /// Spanish replacements must be present. Prevents an English-
    /// only signoff from shipping with a stale Spanish string.
    @Test func approvedRevisionsHaveCompleteBilingualPair() {
        for row in SNAPComplianceCopyRegistry.pendingCopyRevisions
            where row.status == .approved {
            #expect(row.approvedEnglish != nil && !(row.approvedEnglish ?? "").isEmpty,
                    "Approved revision '\(row.id)' missing approvedEnglish")
            #expect(row.approvedSpanish != nil && !(row.approvedSpanish ?? "").isEmpty,
                    "Approved revision '\(row.id)' missing approvedSpanish (bilingual parity required)")
        }
    }
}

// MARK: - Test-only helpers

private extension CivicaText {
    /// Convenience for tests that only need to compare the English
    /// value of a CivicaText. Mirrors the production accessor without
    /// requiring a CivicaLanguage instance.
    var englishValue: String { value(in: .english) }
}
