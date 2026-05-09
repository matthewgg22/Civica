import SwiftUI
import OSLog

#if DEBUG
struct SupabaseMAPVDebugView: View {
    private let logger = Logger(subsystem: "Civica", category: "SupabaseMAPVDebug")
    @State private var plans: [MapvPlan] = []
    @State private var statusText = "Idle"
    @State private var isWorking = false

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text("Supabase MAPV Debug")
                .font(CivicaTypography.sectionHeader)

            Text(statusText)
                .font(CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.textSecondary)

            HStack(spacing: 10) {
                Button("DEBUG: Insert MAPV") {
                    Task { await insertDebugPlan() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isWorking)

                Button("DEBUG: Fetch MAPV Plans") {
                    Task { await fetchDebugPlans() }
                }
                .buttonStyle(.bordered)
                .disabled(isWorking)
            }

            if plans.isEmpty {
                Text("No plans loaded.")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
            } else {
                ForEach(plans.prefix(5)) { plan in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(plan.electionID)
                            .font(CivicaTypography.subheadStrong)
                        Text(plan.pollingPlace ?? "No polling place")
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.textSecondary)
                    }
                    .padding(.vertical, CivicaSpacing.xs)
                }
            }
        }
        .padding(CivicaSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .fill(CivicaColors.infoSurfaceBlue)
        )
        .task { await runStartupAuth() }
    }

    private func runStartupAuth() async {
        isWorking = true
        defer { isWorking = false }

        do {
            try await SupabaseManager.shared.signInAnonymouslyIfNeeded()
            statusText = "Anonymous session ready"
        } catch {
            statusText = "Error: \(error.localizedDescription)"
            logger.error("Auth error in Supabase debug view.")
        }
    }

    private func insertDebugPlan() async {
        isWorking = true
        defer { isWorking = false }

        do {
            try await SupabaseManager.shared.insertDebugMAPVPlan()
            statusText = "Inserted test plan"
        } catch {
            statusText = "Insert failed: \(error.localizedDescription)"
            logger.error("Insert failed in Supabase debug view.")
        }
    }

    private func fetchDebugPlans() async {
        isWorking = true
        defer { isWorking = false }

        do {
            let latest = try await SupabaseManager.shared.fetchMAPVPlans()
            plans = latest
            statusText = "Fetched \(latest.count) plan(s)"
        } catch {
            statusText = "Fetch failed: \(error.localizedDescription)"
            logger.error("Fetch failed in Supabase debug view.")
        }
    }
}

#Preview {
    SupabaseMAPVDebugView()
}
#endif
