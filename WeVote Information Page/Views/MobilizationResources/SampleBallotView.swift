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
        switch party {
        case "Democratic Party":   return .blue
        case "Republican Party":   return .red
        default:                   return .primary
        }
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
            Candidate(name: "Adrienne Adams", party: "Democratic Party",
                      website: URL(string: "https://adrienneforthepeople.com")),
            Candidate(name: "Selma Bartholomew", party: "Democratic Party",
                      website: URL(string: "https://drselmabartholomew.com")),
            Candidate(name: "Michael Blake", party: "Democratic Party",
                      website: URL(string: "https://blakefornyc.com")),
            Candidate(name: "Andrew Cuomo", party: "Democratic Party",
                      website: URL(string: "https://www.andrewcuomo.com")),
            Candidate(name: "Brad Lander", party: "Democratic Party",
                      website: URL(string: "https://landerfornyc.com/about")),
            Candidate(name: "Zohran Kwame Mamdani", party: "Democratic Party",
                      website: URL(string: "https://www.zohranfornyc.com")),
            Candidate(name: "Zellnor Myrie", party: "Democratic Party",
                      website: URL(string: "https://www.zellnor.nyc/endorsements")),
            Candidate(name: "Paperboy Prince", party: "Democratic Party",
                      website: URL(string: "https://paperboy.nyc")),
            Candidate(name: "Jessica Ramos", party: "Democratic Party",
                      website: URL(string: "https://www.ramosfornyc.com")),
            Candidate(name: "Scott Stringer", party: "Democratic Party",
                      website: URL(string: "https://scottstringernyc.com")),
            Candidate(name: "Whitney Tilson", party: "Democratic Party",
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
            Candidate(name: "Justin Brannan", party: "Democratic Party",
                      website: URL(string: "https://justinbrannan.com")),
            Candidate(name: "Mark Levine", party: "Democratic Party",
                      website: URL(string: "https://www.votemarklevine.com")),
            Candidate(name: "Ismael Malave", party: "Democratic Party",
                      website: URL(string: "https://malavefornyc.com")),
            Candidate(name: "Kevin Parker", party: "Democratic Party",
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
            Candidate(name: "Jumaane Williams (Incumbent)", party: "Democratic Party",
                      website: URL(string: "https://jumaanewilliams.com/about")),
            Candidate(name: "Jumaane Williams (Incumbent)", party: "Working Families Party",
                      website: URL(string: "https://jumaanewilliams.com/about")),
            Candidate(name: "Martin Dolan", party: "Democratic Party",
                      website: URL(string: "https://www.martydolan.org")),
            Candidate(name: "Jenifer Rajkumar", party: "Democratic Party",
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
    @EnvironmentObject var planVM: PlanViewModel
    @State private var rankings: [UUID: Int] = [:]
    
    private var filteredRaces: [BallotRace] {
        sampleRaces.compactMap { race in
            let matches = race.candidates.filter { cand in
                planVM.selectedParty == .independent || cand.party.contains(planVM.selectedParty.rawValue)
            }
            guard !matches.isEmpty else { return nil }
            return BallotRace(office: race.office, candidates: matches)
        }
    }

    var body: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 30) {
                Text("🗳️ Sample Ballot")
                    .font(.largeTitle).bold()
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top)
                
                ForEach(filteredRaces) { race in
                    VStack(alignment: .leading, spacing: 15) {
                        Text(race.office)
                            .font(.headline)
                        
                        ForEach(race.candidates) { cand in
                            CandidateRow(
                                candidate: cand,
                                rank: Binding(get: { rankings[cand.id] ?? 0 }, set: { rankings[cand.id] = $0 }),
                                maxRank: race.candidates.count
                            )
                        }
                    }
                    .padding(.horizontal)
                }
                
                Spacer(minLength: 50)
            }
            .padding(.bottom)
        }
        .background(Color(.systemGray6))
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct CandidateRow: View {
    let candidate: Candidate
    @Binding var rank: Int
    let maxRank: Int
    
    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(candidate.name)
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)
                
                Text(candidate.party)
                    .font(.caption)
                    .foregroundColor(candidate.partyColor)
            }
            
            Spacer()
            
            if let url = candidate.website {
                Link(destination: url) {
                    Image(systemName: "link.circle")
                        .font(.title3)
                }
                .padding(.trailing, 8)
            }
            
            Picker("", selection: $rank) {
                Text("–").tag(0)
                ForEach(1...maxRank, id: \.self) { i in
                    Text("\(i)").tag(i)
                }
            }
            .pickerStyle(MenuPickerStyle())
            .frame(width: 50)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(Color(.systemGray5))
        .cornerRadius(8)
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
