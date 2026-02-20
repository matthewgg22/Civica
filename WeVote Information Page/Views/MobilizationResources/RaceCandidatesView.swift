//
//  RaceCandidatesView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/22/25.
//

import SwiftUI

struct StaticCandidate: Identifiable {
    let id = UUID()
    let name: String
    let imageName: String
    let experience: String
    let announcedDate: String
    let websiteURL: String
}

struct RaceCandidatesView: View {
    let candidates = [
        StaticCandidate(name: "Adrienne Adams", imageName: "adrienne", experience: "Speaker of the NYC Council (2022–present), Councilmember (2017–present)", announcedDate: "March 5, 2025", websiteURL: "https://adrienneforthepeople.com"),
        StaticCandidate(name: "Michael Blake", imageName: "blake", experience: "Assemblymember (2015–2021), DNC Vice Chair, Candidate for Public Advocate & NY-15", announcedDate: "Nov 24, 2024", websiteURL: "https://blakefornyc.com"),
        StaticCandidate(name: "Andrew Cuomo", imageName: "cuomo", experience: "Governor (2011–2021), NY AG (2007–2010), HUD Secretary (1997–2001)", announcedDate: "March 1, 2025", websiteURL: "https://www.andrewcuomo.com"),
        StaticCandidate(name: "Brad Lander", imageName: "lander", experience: "NYC Comptroller (2022–present), Councilmember (2010–2021)", announcedDate: "July 30, 2024", websiteURL: "https://landerfornyc.com"),
        StaticCandidate(name: "Zohran Mamdani", imageName: "mamdani", experience: "Assemblymember, District 36 (2021–present)", announcedDate: "Oct 22, 2024", websiteURL: "https://www.zohranfornyc.com"),
        StaticCandidate(name: "Zellnor Myrie", imageName: "myrie", experience: "NY State Senator, District 20 (2019–present)", announcedDate: "May 8, 2024", websiteURL: "https://www.zellnor.nyc"),
        StaticCandidate(name: "Jessica Ramos", imageName: "ramos", experience: "NY State Senator, District 13 (2019–present)", announcedDate: "Sept 13, 2024", websiteURL: "https://www.ramosfornyc.com"),
        StaticCandidate(name: "Scott Stringer", imageName: "stringer", experience: "NYC Comptroller (2014–2021), Manhattan BP (2006–2013), Assemblymember (1993–2005)", announcedDate: "Jan 18, 2024", websiteURL: "https://scottstringernyc.com"),
        StaticCandidate(name: "Whitney Tilson", imageName: "tilson", experience: "Investor, Hedge fund manager", announcedDate: "Nov 26, 2024", websiteURL: "https://www.whitneyformayor.com")
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .center, spacing: 20) {
                Text("Race Candidates")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .multilineTextAlignment(.center)

                Text("🗽 2025 NYC Mayoral Race - Dem Primary")
                    .font(.title3)
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)

                ForEach(candidates) { candidate in
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(alignment: .top) {
                            Image(candidate.imageName)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 70, height: 70)
                                .clipShape(Circle())
                                .shadow(radius: 3)

                            VStack(alignment: .leading, spacing: 4) {
                                Text(candidate.name)
                                    .font(.headline)

                                Text(candidate.experience)
                                    .font(.subheadline)
                                    .foregroundColor(VoteNowColors.mutedText)

                                Text("Announced: \(candidate.announcedDate)")
                                    .font(.caption)
                                    .foregroundColor(.gray)

                                Link("Website", destination: URL(string: candidate.websiteURL)!)
                                    .font(.caption)
                                    .foregroundColor(VoteNowColors.richBlue)
                            }
                            .padding(.leading, 8)
                        }
                        Divider()
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.bottom)
        }
    }
}

#Preview {
    RaceCandidatesView()
}
