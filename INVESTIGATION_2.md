# INVESTIGATION 2

Confirmed CivicCallService path from find: ./WeVote Information Page/Models/CivicCallService.swift

## A) grep -n "@MainActor\|@Published\|DispatchQueue\|Task {" <CORRECT_PATH>
$ grep -n "@MainActor\|@Published\|DispatchQueue\|Task {" "./WeVote Information Page/Models/CivicCallService.swift"
2208:@MainActor
2254:    @Published var selectedTab: CivicIssueCallTab = .assistant
2255:    @Published var selectedRepFilter: CivicRepFilter = .all
2256:    @Published var concernText: String = ""
2257:    @Published var selectedAsk: CivicAsk?
2258:    @Published var optionalBillRef: String = ""
2259:    @Published var isSubmitting = false
2260:    @Published var errorMessage: String?
2262:    @Published var issueTitle: String = ""
2263:    @Published var issueSummary: String = ""
2264:    @Published var resolvedEntities: CivicResolvedEntities = .empty
2265:    @Published var callBriefs: [CivicCallBrief] = []
2266:    @Published var examples: [CivicExampleIssueCard] = []
2267:    @Published var historyGroups: [CivicHistoryGroup] = []
2268:    @Published var activeBriefID: String?
2269:    @Published var loggedOutcomeByBriefID: [String: CivicCallOutcome] = [:]
2270:    @Published var callScoreSummary: CivicCallScoreSummary?
2271:    @Published var callScoreBreakdown: CivicCallScoreBreakdown?
2272:    @Published var callScoreHistory: [CivicCallScoreHistoryItem] = []
2273:    @Published var leaderboardSummary: CivicLeaderboardUserSummary?
2274:    @Published var callStats: CivicCallStats = .empty
2275:    @Published var appWideCompletedCallsByIssueID: [String: Int] = [:]
2276:    @Published var lastCompletionResult: CivicCallCompletionResponse?
2277:    @Published var pendingCallLaunch: PendingCallLaunch?
2278:    @Published var requiresDraftApproval = false
2279:    @Published var mapcV3DisplayIssue: String = ""
2280:    @Published var mapcV3AskOptions: [CivicMAPCV3PreparedOption] = []
2281:    @Published var mapcV3SelectedOptionID: String?
2282:    @Published var mapcV3SelectedDisplayAsk: String = ""
2283:    @Published var mapcV3BackgroundText: String = ""
2284:    @Published var mapcV3SessionState: String = "new"
2285:    @Published var mapcV3NeedsClarification: Bool = false
2286:    @Published var mapcV3ClarificationPrompt: String?
2287:    @Published var mapcV3IntroShown: Bool = false
2288:    @Published var mapcV3ClarificationTurnCount: Int = 0
2289:    @Published var mapcV3MapcApproved: Bool = false
2290:    @Published var mapcV3AccumulatedContext: [CivicMAPCV3ContextTurn] = []
2291:    @Published var generationPath: String = "v3"
2292:    @Published var fallbackReason: String?
2293:    @Published var sessionResetReason: String?
2294:    @Published var mapcV3LastFailureReasonCode: String?
2403:            Task {
3064:                Task { [userID] in
3426:        Task {
3465:                Task { [weak self] in
3531:            Task { [apiClient] in
3575:            Task { [apiClient] in
3860:        if let inFlight = callScoreRefreshTask {
3875:        let refreshTask = Task { [weak self] in
3908:        if let summary = try? await summaryTask {
3911:        if let breakdown = try? await breakdownTask {
3914:        if let history = try? await historyTask {
3917:        if let leaderboard = try? await monthlyUserLeaderboardTask {
4077:        Task { [supabaseManager] in
4770:        deferredSnapshotTask = Task { [weak self] in

## B) grep -n "await\|async let\|withTaskGroup\|Task {" <CORRECT_PATH> | head -120
$ grep -n "await\|async let\|withTaskGroup\|Task {" "./WeVote Information Page/Models/CivicCallService.swift" | head -120
814:        await attachAuthorizationIfAvailable(to: &request)
816:        let data = try await requestData(for: request, timeout: 12, allowTimeoutRetry: false)
832:            return try await createScriptPackageV3(
877:        await attachAuthorizationIfAvailable(to: &request)
880:        let data = try await requestData(for: request)
978:        await attachAuthorizationIfAvailable(to: &interpretRequest)
980:        let interpretData = try await requestData(for: interpretRequest)
1003:        await attachAuthorizationIfAvailable(to: &askRequest)
1011:        let askData = try await requestData(for: askRequest)
1075:            if let recovered = try await recoverMAPCV3PendingSelection(
1111:            await attachAuthorizationIfAvailable(to: &backgroundRequest)
1118:            let backgroundData = try await requestData(for: backgroundRequest)
1140:            backgroundResponse = try await performBackgroundRequest(using: activePending)
1158:                    if let repaired = try await reprepareMAPCV3SelectionForInvalidStateTransition(
1174:                        backgroundResponse = try await performBackgroundRequest(using: activePending)
1175:                    } else if let rebuilt = try await rebuildMAPCV3SelectionFromScratch(
1188:                        backgroundResponse = try await performBackgroundRequest(using: activePending)
1232:        await attachAuthorizationIfAvailable(to: &scriptRequest)
1242:        let scriptData = try await requestData(for: scriptRequest)
1278:        await attachAuthorizationIfAvailable(to: &request)
1285:        let data = try await requestData(for: request)
1346:            await attachAuthorizationIfAvailable(to: &interpretRequest)
1348:            let interpretData = try await requestData(for: interpretRequest)
1354:            interpretResponse = try await performInterpret(
1366:                interpretResponse = try await performInterpret(
1384:        await attachAuthorizationIfAvailable(to: &askRequest)
1392:        let askData = try await requestData(for: askRequest)
1432:        let prepared = try await prepareMAPCV3Selection(
1681:        await attachAuthorizationIfAvailable(to: &request)
1683:        _ = try await requestData(for: request)
1708:        await attachAuthorizationIfAvailable(to: &request)
1710:        _ = try await requestData(for: request)
1733:        try await attachAuthorization(to: &request)
1735:        _ = try await requestData(for: request)
1743:        try await attachAuthorization(to: &request)
1745:        let data = try await requestData(for: request)
1765:        try await attachAuthorization(to: &request)
1767:        let data = try await requestData(for: request)
1783:        try await attachAuthorization(to: &request)
1785:        let data = try await requestData(for: request)
1794:        try await attachAuthorization(to: &request)
1795:        let data = try await requestData(for: request)
1804:        try await attachAuthorization(to: &request)
1805:        let data = try await requestData(for: request)
1818:        try await attachAuthorization(to: &request)
1819:        let data = try await requestData(for: request)
1828:        try await attachAuthorization(to: &request)
1830:        let data = try await requestData(for: request)
1846:        try await attachAuthorization(to: &request)
1847:        let data = try await requestData(for: request)
1864:        try await attachAuthorization(to: &request)
1865:        let data = try await requestData(for: request)
1870:        let token = try await currentAccessToken()
1875:        if let token = try? await currentAccessToken() {
1882:        try? await SupabaseManager.shared.signInAnonymouslyIfNeeded()
1885:            return try await SupabaseClientProvider.shared.client.auth.session.accessToken
1888:                let refreshed = try await SupabaseClientProvider.shared.client.auth.refreshSession()
1914:            return try await performRequest(firstAttempt)
1922:                    return try await performRequest(retryAttempt)
1934:                try? await Task.sleep(nanoseconds: 300_000_000)
1935:                return try await requestData(
1969:        let (data, response) = try await session.data(for: request)
2403:            Task {
2404:                await self.flushPendingScriptChatTurns()
2503:        try? await supabaseManager.signInAnonymouslyIfNeeded()
2506:        let response = try await SupabaseClientProvider.shared.client
2546:            return try await fetchPublishedPremadeScripts()
2554:        let userID = await userIDForRequest()
2556:        async let remotePremadeScriptsTask: [RemotePremadeScript] = loadPremadeScripts()
2557:        async let historyTask: [CivicHistoryGroup] = apiClient.fetchHistory(userID: userID)
2559:        let remotePremadeScripts = await remotePremadeScriptsTask
2564:            historyGroups = try await historyTask
2570:        await refreshCallScoreData(for: userID)
2576:        await loadExamplesAndHistory()
2829:        let userID = await userIDForRequest()
2852:        await submitAssistantRequestV3(
2885:            let prepared = try await apiClient.prepareMAPCV3Selection(
2992:        let userID = await userIDForRequest()
2997:            let package = try await apiClient.generateMAPCV3ScriptFromSelection(
3064:                Task { [userID] in
3065:                    await self.refreshCallScoreData(for: userID)
3426:        Task {
3427:            await self.flushPendingScriptChatTurns()
3444:            let userID = await userIDForRequest()
3446:                try await apiClient.logScriptChatTurn(
3465:                Task { [weak self] in
3466:                    try? await Task.sleep(nanoseconds: 2_000_000_000)
3468:                    await self.flushPendingScriptChatTurns()
3531:            Task { [apiClient] in
3532:                let userID = await self.userIDForRequest()
3534:                    try await apiClient.logScriptFeedback(
3575:            Task { [apiClient] in
3576:                let userID = await self.userIDForRequest()
3578:                    try await apiClient.logScriptFeedback(
3660:        let userID = await userIDForRequest()
3663:            let launch = try await apiClient.logCallLaunch(
3718:        let userID = await userIDForRequest()
3721:            let response = try await apiClient.confirmCallCompletion(
3745:                await refreshCallScoreData(for: userID, force: true)
3782:        let userID = await userIDForRequest()
3785:            try await apiClient.logCall(
3857:            resolvedUserID = await userIDForRequest()
3860:        if let inFlight = callScoreRefreshTask {
3861:            await inFlight.value
3875:        let refreshTask = Task { [weak self] in
3877:            await self.performCallScoreRefreshData(for: resolvedUserID)
3881:        await refreshTask.value
3886:        async let summaryTask = apiClient.fetchCallScoreSummary(userID: resolvedUserID)
3887:        async let breakdownTask = apiClient.fetchCallScoreBreakdown(userID: resolvedUserID)
3888:        async let historyTask = apiClient.fetchCallScoreHistory(userID: resolvedUserID, limit: 30)
3889:        async let monthlyUserLeaderboardTask = apiClient.fetchUserLeaderboardSummary(
3894:        async let monthlyLeaderboardTask = apiClient.fetchLeaderboard(periodType: "monthly", periodStart: nil)
3895:        async let allTimeLeaderboardTask = apiClient.fetchLeaderboard(periodType: "all_time", periodStart: nil)
3896:        async let annualLeaderboardTask = apiClient.fetchLeaderboard(periodType: "annual", periodStart: nil)
3897:        async let allTimeUserSummaryTask = apiClient.fetchUserLeaderboardSummary(
3902:        async let annualUserSummaryTask = apiClient.fetchUserLeaderboardSummary(
3908:        if let summary = try? await summaryTask {
3911:        if let breakdown = try? await breakdownTask {
3914:        if let history = try? await historyTask {
3917:        if let leaderboard = try? await monthlyUserLeaderboardTask {

## C) grep -n "submitAssistantRequest\|canSubmit\|guard.*rep\|guard.*address\|guard.*zip\|repTargets\|requestRepSlots\|mapcV3Enabled" <CORRECT_PATH> | head -60
$ grep -n "submitAssistantRequest\|canSubmit\|guard.*rep\|guard.*address\|guard.*zip\|repTargets\|requestRepSlots\|mapcV3Enabled" "./WeVote Information Page/Models/CivicCallService.swift" | head -60
692:        repTargets: [CivicRepTarget],
714:        repTargets: [CivicRepTarget],
826:        repTargets: [CivicRepTarget],
836:                repTargets: repTargets,
844:            guard let target = repTargets.first(where: { $0.slot == slot }) else {
917:        repTargets: [CivicRepTarget],
926:        _ = repTargets
1050:        repTargets: [CivicRepTarget],
1260:            repTargets: repTargets,
1514:        repTargets: [CivicRepTarget],
1536:            repTargets: repTargets,
1592:        repTargets: [CivicRepTarget],
1596:        let selectedTargets = repTargets.filter { targetReps.contains($0.slot) }
2327:    let repTargets: [CivicRepTarget]
2373:        self.repTargets = targets
2424:        for target in repTargets {
2451:        if repTargets.contains(where: { $0.slot == .house }) { filters.append(.house) }
2452:        if repTargets.contains(where: { $0.slot == .senate1 }) { filters.append(.senate1) }
2453:        if repTargets.contains(where: { $0.slot == .senate2 }) { filters.append(.senate2) }
2473:    var requestRepSlots: [CivicRepSlot] {
2474:        return repTargets.map(\.slot)
2477:    var canSubmit: Bool {
2478:        selectedAsk != nil && !concernText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !repTargets.isEmpty
2672:        if repTargets.contains(where: { $0.slot == .house }) {
2675:        if repTargets.contains(where: { $0.slot == .senate1 || $0.slot == .senate2 }) {
2692:        lines += repTargets
2814:    func submitAssistantRequest() async {
2820:        guard canSubmit else {
2852:        await submitAssistantRequestV3(
2858:    private func submitAssistantRequestV3(
3002:                targetReps: requestRepSlots,
3003:                repTargets: repTargets,
3014:                    selectedSlots: requestRepSlots,
4159:           repTargets.indices.contains(idx) {
4160:            return repTargets[idx].official
4255:        let selectedTargets = repTargets.filter { selectedSlots.contains($0.slot) }
4363:        guard !chamberSet.isEmpty else { return requestRepSlots }
4370:            if repTargets.contains(where: { $0.slot == .senate1 }) {
4373:            if repTargets.contains(where: { $0.slot == .senate2 }) {
4378:        return slots.isEmpty ? requestRepSlots : slots
4416:           let target = repTargets.first(where: { $0.slot == slot }) {
4422:           let target = repTargets.first(where: {
4430:           let target = repTargets.first(where: {
4801:        let selectedTargets = repTargets.filter { selectedSlots.contains($0.slot) }
4802:        let scopedTargets = selectedTargets.isEmpty ? repTargets : selectedTargets
4889:           let senator = repTargets.first(where: { $0.slot == .senate1 || $0.slot == .senate2 }) {
4893:           let house = repTargets.first(where: { $0.slot == .house }) {
4896:        return repTargets.first?.official
4919:        let selectedTargets = repTargets.filter { selectedSlots.contains($0.slot) }

## D) grep -n "Publishing\|objectWillChange\|\.send()\|errorMessage =\|isSubmitting =" <CORRECT_PATH> | head -60
$ grep -n "Publishing\|objectWillChange\|\.send()\|errorMessage =\|isSubmitting =" "./WeVote Information Page/Models/CivicCallService.swift" | head -60
2259:    @Published var isSubmitting = false
2815:        errorMessage = nil
2817:            errorMessage = "Select an explicit ask before generating call briefs."
2821:            errorMessage = "Enter your concern and keep at least one representative selected."
2825:        isSubmitting = true
2826:        defer { isSubmitting = false }
2846:            errorMessage = mapcV3RecoveryMessage
2916:                errorMessage = prepared.clarificationPrompt ?? "I need one detail to make this usable: what issue do you care about most?"
2925:                errorMessage = "I hit a snag, but I still have your issue. Pick a fix or restate the action you want."
2937:            errorMessage = nil
2942:            errorMessage = failureMessage
2980:            errorMessage = "Pick one ask option before confirming preview."
2987:        isSubmitting = true
2988:        defer { isSubmitting = false }
3033:                    errorMessage = mapcV3RecoveryMessage
3044:                errorMessage = nil
3075:                    errorMessage = "I need one detail to make this usable: what issue do you care about most?"
3078:                    errorMessage = hint
3091:                errorMessage = package.truthTrace?.refusalReason ?? package.reviewRegenerateHint
3111:            errorMessage = failureMessage
3510:            errorMessage = "Review the script preview first, then tap Looks right before approving."

## E) grep -rn "result.*accumulator\|Result.*Accumulator\|0\.250\|accumulator.*timeout\|timeout.*0\.25" --include="*.swift" "WeVote Information Page/"
$ grep -rn "result.*accumulator\|Result.*Accumulator\|0\.250\|accumulator.*timeout\|timeout.*0\.25" --include="*.swift" "WeVote Information Page/"

## F) grep -n "lookupStateLegislators\|openstatesService\|openStatesService\|fetchStateLeg" "WeVote Information Page/Models/MyRepsViewModel.swift" | head -40
$ grep -n "lookupStateLegislators\|openstatesService\|openStatesService\|fetchStateLeg" "WeVote Information Page/Models/MyRepsViewModel.swift" | head -40
431:    private let openStatesService = OpenStatesStateLegislativeService()
1340:                let openStatesOfficials = await self.openStatesService.lookupStateLegislators(
1420:            let officials = await self.openStatesService.lookupStateLegislators(

## G) grep -n "repTargets\|federalReps\|stateReps\|officials\b\|loadReps\|resolveAddress\|addressSearch" "WeVote Information Page/Models/MyRepsViewModel.swift" | head -40
$ grep -n "repTargets\|federalReps\|stateReps\|officials\b\|loadReps\|resolveAddress\|addressSearch" "WeVote Information Page/Models/MyRepsViewModel.swift" | head -40
411:    @Published var federalReps: [Official] = []
412:    @Published var stateReps: [Official] = []
1299:                federalReps = dedupedOfficials(applyLevel(.federal, to: result.federal))
1300:                stateReps = applyLevel(.state, to: result.state)
1305:                federalReps = dedupedOfficials(
1308:                stateReps = applyLevel(.state, to: result.state).filter(isStatewideStateOfficial)
1318:                || !federalReps.isEmpty
1319:                || !stateReps.isEmpty
1349:                    self.stateReps = self.dedupedOfficials(
1350:                        self.stateReps + self.applyLevel(.state, to: openStatesOfficials)
1420:            let officials = await self.openStatesService.lookupStateLegislators(
1429:                self.stateReps = self.dedupedOfficials(
1430:                    self.stateReps + self.applyLevel(.state, to: officials)
1468:    private func dedupedOfficials(_ officials: [Official]) -> [Official] {
1472:        for official in officials {
1579:    private func applyLevel(_ level: OfficialLevel, to officials: [Official]) -> [Official] {
1580:        officials.map { official in
1737:        federalReps = []
1738:        stateReps = []

## H) cat backend/civic_api/api.py | grep -A 20 "def openstates_people_geo"
$ cat backend/civic_api/api.py | grep -A 20 "def openstates_people_geo"
    def openstates_people_geo(
        request: Request,
        lat: float,
        lng: float,
        include: str = "links",
    ) -> dict[str, Any]:
        def handler() -> dict[str, Any]:
            _ = resolve_authenticated_or_anonymous_user_id(request)
            return get_openstates_people_geo(lat=lat, lng=lng, include=include)

        return _run_endpoint(handler, bad_request_exceptions=bad_request)

    @app.get("/share/preview/{card_type}.svg")
    def share_preview_svg(
        card_type: str,
        title: str | None = None,
        subtitle: str | None = None,
        badge: str | None = None,
        cta: str | None = None,
    ) -> Response:
        resolved = _resolve_card_type(card_type)

## I) cat backend/civic_api/mapc_pipeline_v3.py | grep -n "accumulator\|_accumulator_timeout\|Result\|result_" | head -40
$ cat backend/civic_api/mapc_pipeline_v3.py | grep -n "accumulator\|_accumulator_timeout\|Result\|result_" | head -40
180:        configured_accumulator_timeout = float(os.environ.get("MAPC_ACCUMULATOR_TIMEOUT_SECONDS", "25.0"))
182:        self._accumulator_timeout_seconds = max(25.0, configured_accumulator_timeout)
184:        self._timeout_seconds = max(8.0, configured_request_timeout, self._accumulator_timeout_seconds)
