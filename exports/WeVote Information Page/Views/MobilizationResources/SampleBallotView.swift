//
//
//  SampleBallotView.swift
//  WeVote Information Page
//
//  Updated by ChatGPT on 05/20/25.

import SwiftUI

// MARK: - Models & Sample Data

struct Candidate: Identifiable, Hashable {
    let id: UUID = UUID()
    let name: String
    let party: String
    let website: URL?
    
    // Party color: blue for Dems, red for Repubs, default for others
    var partyColor: Color {
        let normalized = party.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalized.contains("democrat") { return VoteNowColors.richBlue }
        if normalized.contains("republican") { return VoteNowColors.richRed }
        return .primary
    }
}

struct BallotRace: Identifiable {
    let id: UUID = UUID()
    let office: String
    let candidates: [Candidate]
}

let sampleRaces: [BallotRace] = [
    // MARK: Mayor of New York
    BallotRace(
        office: "Mayor of New York",
        candidates: [
            Candidate(name: "Adrienne Adams", party: "Democrat",
                      website: URL(string: "https://adrienneforthepeople.com")),
            Candidate(name: "Selma Bartholomew", party: "Democrat",
                      website: URL(string: "https://drselmabartholomew.com")),
            Candidate(name: "Michael Blake", party: "Democrat",
                      website: URL(string: "https://blakefornyc.com")),
            Candidate(name: "Andrew Cuomo", party: "Democrat",
                      website: URL(string: "https://www.andrewcuomo.com")),
            Candidate(name: "Brad Lander", party: "Democrat",
                      website: URL(string: "https://landerfornyc.com/about")),
            Candidate(name: "Zohran Kwame Mamdani", party: "Democrat",
                      website: URL(string: "https://www.zohranfornyc.com")),
            Candidate(name: "Zellnor Myrie", party: "Democrat",
                      website: URL(string: "https://www.zellnor.nyc/endorsements")),
            Candidate(name: "Paperboy Prince", party: "Democrat",
                      website: URL(string: "https://paperboy.nyc")),
            Candidate(name: "Jessica Ramos", party: "Democrat",
                      website: URL(string: "https://www.ramosfornyc.com")),
            Candidate(name: "Scott Stringer", party: "Democrat",
                      website: URL(string: "https://scottstringernyc.com")),
            Candidate(name: "Whitney Tilson", party: "Democrat",
                      website: URL(string: "https://www.whitneyformayor.com")),
            Candidate(name: "Curtis Sliwa", party: "Republican Party",
                      website: URL(string: "https://www.sliwafornyc.com")),
            Candidate(name: "Irene Estrada", party: "Conservative Party",
                      website: URL(string: "https://www.instagram.com/iestradanyc/")),
            Candidate(name: "Gowri Krishna", party: "Working Families Party",
                      website: URL(string: "https://www.thecity.nyc/2025/04/03/working-families-party-general-election-candidate-mayor/"))
        ]
    ),

    // MARK: New York City Comptroller
    BallotRace(
        office: "New York City Comptroller",
        candidates: [
            Candidate(name: "Justin Brannan", party: "Democrat",
                      website: URL(string: "https://justinbrannan.com")),
            Candidate(name: "Mark Levine", party: "Democrat",
                      website: URL(string: "https://www.votemarklevine.com")),
            Candidate(name: "Ismael Malave", party: "Democrat",
                      website: URL(string: "https://malavefornyc.com")),
            Candidate(name: "Kevin Parker", party: "Democrat",
                      website: URL(string: "https://www.kevinparkernyc.com")),
            Candidate(name: "Peter Kefalas", party: "Republican Party",
                      website: URL(string: "https://www.peterkefalas.com")),
            Candidate(name: "Danniel Maio", party: "Republican Party",
                      website: URL(string: "https://nyc.maio.net")),
            Candidate(name: "Peter Kefalas", party: "Conservative Party",
                      website: URL(string: "https://www.peterkefalas.com")),
            Candidate(name: "Justin Brannan", party: "Working Families Party",
                      website: URL(string: "https://justinbrannan.com"))
        ]
    ),

    // MARK: New York City Public Advocate
    BallotRace(
        office: "New York City Public Advocate",
        candidates: [
            Candidate(name: "Jumaane Williams (Incumbent)", party: "Democrat",
                      website: URL(string: "https://jumaanewilliams.com/about")),
            Candidate(name: "Jumaane Williams (Incumbent)", party: "Working Families Party",
                      website: URL(string: "https://jumaanewilliams.com/about")),
            Candidate(name: "Martin Dolan", party: "Democrat",
                      website: URL(string: "https://www.martydolan.org")),
            Candidate(name: "Jenifer Rajkumar", party: "Democrat",
                      website: URL(string: "https://www.jeniferforny.com/?gad_source=1&gad_campaignid=22497745612&amp;gbraid=0AAAAACP36i9_-5PIeNjLQFffV0wOjlQhv&gclid=Cj0KCQjw0LDBBhCnARIsAMpYlAp7IhfcSAoFkwDtkkXzixYIJCHDlfnsdx2Z8Iwft5HVLob8Y7mMSfYaAuBvEALw_wcB")),
            Candidate(name: "Gonzalo Duran", party: "Republican Party",
                      website: URL(string: "https://www.gonzaloduran.nyc")),
            Candidate(name: "Gonzalo Duran", party: "Conservative Party",
                      website: URL(string: "https://www.gonzaloduran.nyc"))
        ]
    )
]

// MARK: - Views

struct SampleBallotView: View {
    @Environment(\.locale) private var locale
    @EnvironmentObject var planVM: PlanViewModel
    @State private var raceRankings: [String: [String: Int]] = [:]

    struct CandidateSummary: Identifiable {
        let id: String
        let name: String
        let parties: [String]
        let website: URL?
    }

    private var filteredRaces: [BallotRace] {
        sampleRaces.compactMap { race in
            let matches = race.candidates.filter { cand in
                partyMatchesRegistration(cand.party)
            }
            guard !matches.isEmpty else { return nil }
            return BallotRace(office: race.office, candidates: matches)
        }
    }

    private func partyMatchesRegistration(_ candidateParty: String) -> Bool {
        let normalized = candidateParty.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch planVM.selectedParty {
        case .democrat:
            return normalized.contains("democrat")
        case .republican:
            return normalized.contains("republican")
        case .independent:
            return normalized.contains("independent") || normalized.contains("nonpartisan")
        }
    }

    private func compactCandidates(for race: BallotRace) -> [CandidateSummary] {
        var grouped: [String: (name: String, parties: [String], website: URL?)] = [:]

        for cand in race.candidates {
            let key = "\(cand.name.lowercased())|\(cand.website?.absoluteString ?? "")"
            if var existing = grouped[key] {
                if !existing.parties.contains(cand.party) {
                    existing.parties.append(cand.party)
                }
                grouped[key] = existing
            } else {
                grouped[key] = (cand.name, [cand.party], cand.website)
            }
        }

        return grouped.values
            .map { value in
                CandidateSummary(
                    id: "\(value.name)|\(value.website?.absoluteString ?? "")",
                    name: value.name,
                    parties: value.parties.sorted(),
                    website: value.website
                )
            }
            .sorted { $0.name < $1.name }
    }

    private func rankLimit(for candidates: [CandidateSummary]) -> Int {
        min(5, candidates.count)
    }

    private func rankSelectionBinding(raceKey: String, candidateID: String) -> Binding<Int> {
        Binding(
            get: { raceRankings[raceKey]?[candidateID] ?? 0 },
            set: { newValue in
                setRank(newValue == 0 ? nil : newValue, raceKey: raceKey, candidateID: candidateID)
            }
        )
    }

    private func setRank(_ rank: Int?, raceKey: String, candidateID: String) {
        var raceMap = raceRankings[raceKey] ?? [:]

        if let rank {
            for (otherID, otherRank) in raceMap where otherID != candidateID && otherRank == rank {
                raceMap.removeValue(forKey: otherID)
            }
            raceMap[candidateID] = rank
        } else {
            raceMap.removeValue(forKey: candidateID)
        }

        if raceMap.isEmpty {
            raceRankings.removeValue(forKey: raceKey)
        } else {
            raceRankings[raceKey] = raceMap
        }
    }

    private func rankedCandidates(for raceKey: String, from candidates: [CandidateSummary]) -> [(rank: Int, candidate: CandidateSummary)] {
        let raceMap = raceRankings[raceKey] ?? [:]
        return candidates
            .compactMap { candidate in
                guard let rank = raceMap[candidate.id] else { return nil }
                return (rank, candidate)
            }
            .sorted { lhs, rhs in
                if lhs.rank == rhs.rank { return lhs.candidate.name < rhs.candidate.name }
                return lhs.rank < rhs.rank
            }
    }

    var body: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 20) {
                Text(l("app.sample_ballot.title", "Sample Ballot"))
                    .font(.largeTitle).bold()
                Text(l("app.sample_ballot.subtitle", "Preview candidates by race. Party filter from My Information is applied."))
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.mutedText)

                VStack(alignment: .leading, spacing: 6) {
                    Text(l("app.sample_ballot.ranked_choice.title", "Ranked-Choice Prep"))
                        .font(.subheadline.weight(.semibold))
                    Text(l("app.sample_ballot.ranked_choice.body_1", "This sample is structured for ranked-choice voting, so you can set your candidate order now before entering the voting booth."))
                        .font(.footnote)
                        .foregroundColor(VoteNowColors.mutedText)
                    Text(l("app.sample_ballot.ranked_choice.body_2", "Only candidates matching your selected party registration are shown."))
                        .font(.footnote)
                        .foregroundColor(VoteNowColors.mutedText)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(VoteNowColors.infoSurfaceBlue)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                if filteredRaces.isEmpty {
                    Text(l("app.sample_ballot.empty.no_match", "No candidates match your selected party registration in this sample."))
                        .font(.footnote)
                        .foregroundColor(VoteNowColors.mutedText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                ForEach(filteredRaces) { race in
                    let compact = compactCandidates(for: race)
                    let raceKey = race.office
                    let maxRank = rankLimit(for: compact)
                    let ranked = rankedCandidates(for: raceKey, from: compact)

                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text(race.office)
                                .font(.headline)
                            Spacer()
                            Text(lf("app.sample_ballot.count.candidates", "%d candidates", compact.count))
                                .font(.caption)
                                .foregroundColor(VoteNowColors.mutedText)
                        }

                        if !ranked.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(l("app.sample_ballot.order.title", "Your Ballot Order"))
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(VoteNowColors.mutedText)
                                ForEach(ranked, id: \.candidate.id) { entry in
                                    Text("\(entry.rank). \(entry.candidate.name)")
                                        .font(.caption)
                                        .foregroundColor(VoteNowColors.primaryText)
                                }
                            }
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(VoteNowColors.brandSoftBlue.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        }

                        ForEach(compact) { candidate in
                            CandidateRow(
                                summary: candidate,
                                maxRank: maxRank,
                                rankSelection: rankSelectionBinding(raceKey: raceKey, candidateID: candidate.id)
                            )
                        }
                    }
                    .padding(14)
                    .background(VoteNowColors.background)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(VoteNowColors.borderWarm.opacity(0.2), lineWidth: 1)
                    )
                }
            }
            .padding()
        }
        .background(VoteNowColors.infoSurfaceBlue)
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: planVM.selectedParty) { _, _ in
            raceRankings = [:]
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

    private func lf(_ key: String, _ fallback: String, _ args: CVarArg...) -> String {
        let format = l(key, fallback)
        return String(format: format, locale: locale, arguments: args)
    }
}

struct CandidateRow: View {
    @Environment(\.locale) private var locale
    let summary: SampleBallotView.CandidateSummary
    let maxRank: Int
    @Binding var rankSelection: Int

    private func color(for party: String) -> Color {
        let normalized = party.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalized.contains("democrat") { return VoteNowColors.richBlue }
        if normalized.contains("republican") { return VoteNowColors.richRed }
        return .secondary
    }

    private func shouldOpenMyInfoFromParty(_ party: String) -> Bool {
        let normalized = party.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return normalized.contains("democrat") || normalized.contains("republican")
    }

    private func displayPartyLabel(_ party: String) -> String {
        let normalized = party.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalized.contains("democrat") {
            return l("app.guide.party.democrat", "Democrat")
        }
        if normalized.contains("republican") {
            return l("app.guide.party.republican", "Republican")
        }
        return party.replacingOccurrences(of: " Party", with: "")
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 8) {
                Text(summary.name)
                    .font(.subheadline.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 6) {
                    ForEach(summary.parties, id: \.self) { party in
                        Text(displayPartyLabel(party))
                            .font(.caption2.weight(.semibold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(color(for: party).opacity(0.12))
                            .foregroundColor(color(for: party))
                            .clipShape(Capsule())
                            .opensMyInfoPanelOnLongPress(when: shouldOpenMyInfoFromParty(party))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 8) {
                if let url = summary.website {
                    Link(destination: url) {
                        Image(systemName: "link.circle.fill")
                            .font(.title3)
                            .foregroundColor(VoteNowColors.richBlue)
                    }
                }

                Menu {
                    Button(l("app.sample_ballot.rank.unranked", "Unranked")) { rankSelection = 0 }
                    ForEach(1...maxRank, id: \.self) { rank in
                        Button(lf("app.sample_ballot.rank.option", "Rank %d", rank)) { rankSelection = rank }
                    }
                } label: {
                    Text(rankSelection == 0
                         ? l("app.sample_ballot.rank.set", "Set Rank")
                         : lf("app.sample_ballot.rank.option", "Rank %d", rankSelection))
                        .font(.caption.weight(.semibold))
                        .foregroundColor(rankSelection == 0 ? .secondary : .blue)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(VoteNowColors.background)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .stroke(VoteNowColors.borderWarm.opacity(0.35), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
            }
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 12)
        .background(VoteNowColors.infoSurfaceBlue)
        .cornerRadius(8)
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

struct SampleBallotView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            SampleBallotView()
                .environmentObject(PlanViewModel())
        }
    }
}
