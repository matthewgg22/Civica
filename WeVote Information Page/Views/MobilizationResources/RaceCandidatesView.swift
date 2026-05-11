//
//  RaceCandidatesView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/22/25.
//

import CivicaDesignSystem
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
    @Environment(\.locale) private var locale
    var showArchiveDisclaimer: Bool = false

    let candidates = [
        StaticCandidate(name: "Adrienne Adams", imageName: "adrienne", experience: "Speaker of the NYC Council (2022–present), Councilmember (2017–present)", announcedDate: "March 5, 2025", websiteURL: "https://adrienneforthepeople.com"),
        StaticCandidate(name: "Michael Blake", imageName: "blake", experience: "Assemblymember (2015–2021), DNC Vice Chair, Candidate for Public Advocate & NY-15", announcedDate: "Nov 24, 2024", websiteURL: "https://blakefornyc.com"),
        StaticCandidate(name: "Andrew Cuomo", imageName: "cuomo", experience: "Governor (2011–2021), NY AG (2007–2010), HUD Secretary (1997–2001)", announcedDate: "March 1, 2025", websiteURL: "https://www.andrewcuomo.com"),
        StaticCandidate(name: "Brad Lander", imageName: "lander", experience: "NYC Comptroller (2022–present), Councilmember (2010–2021)", announcedDate: "July 30, 2024", websiteURL: "https://landerfornyc.com"),
        StaticCandidate(name: "Zohran Mamdani", imageName: "mayor_mamdani", experience: "Assemblymember, District 36 (2021–present)", announcedDate: "Oct 22, 2024", websiteURL: "https://www.zohranfornyc.com"),
        StaticCandidate(name: "Zellnor Myrie", imageName: "mayor_myrie", experience: "NY State Senator, District 20 (2019–present)", announcedDate: "May 8, 2024", websiteURL: "https://www.zellnor.nyc"),
        StaticCandidate(name: "Jessica Ramos", imageName: "mayor_ramos", experience: "NY State Senator, District 13 (2019–present)", announcedDate: "Sept 13, 2024", websiteURL: "https://www.ramosfornyc.com"),
        StaticCandidate(name: "Scott Stringer", imageName: "stringer", experience: "NYC Comptroller (2014–2021), Manhattan BP (2006–2013), Assemblymember (1993–2005)", announcedDate: "Jan 18, 2024", websiteURL: "https://scottstringernyc.com"),
        StaticCandidate(name: "Whitney Tilson", imageName: "tilson", experience: "Investor, Hedge fund manager", announcedDate: "Nov 26, 2024", websiteURL: "https://www.whitneyformayor.com")
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .center, spacing: CivicaSpacing.lg) {
                Text(l("app.race_candidates.title.truthful", "Candidates in this race"))
                    .font(CivicaTypography.pageTitle)
                    .multilineTextAlignment(.center)

                if showArchiveDisclaimer {
                    Text(
                        l(
                            "app.race_candidates.archive.subtitle",
                            "Archived example: NYC 2025 Mayoral Democratic Primary"
                        )
                    )
                    .font(CivicaTypography.subheadStrong)
                    .foregroundColor(CivicaColors.graphite)
                    .multilineTextAlignment(.center)
                }

                Text(l("app.race_candidates.subtitle", "🗽 2025 NYC Mayoral Race - Dem Primary"))
                    .font(.title3)
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)

                ForEach(candidates) { candidate in
                    VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                        HStack(alignment: .top) {
                            Image(candidate.imageName)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 70, height: 70)
                                .clipShape(Circle())
                                .shadow(radius: 3)

                            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                                Text(candidate.name)
                                    .font(CivicaTypography.sectionHeader)

                                Text(localizedExperience(for: candidate))
                                    .font(CivicaTypography.subhead)
                                    .foregroundColor(CivicaColors.graphite)

                                Text("\(l("app.race_candidates.announced_prefix", "Announced:")) \(candidate.announcedDate)")
                                    .font(CivicaTypography.caption)
                                    .foregroundColor(.gray)

                                if let websiteURL = URL(string: candidate.websiteURL) {
                                    Link(l("app.race_candidates.website", "Website"), destination: websiteURL)
                                        .font(CivicaTypography.caption)
                                        .foregroundColor(CivicaColors.brickPrimary)
                                } else {
                                    Text(l("app.race_candidates.website", "Website"))
                                        .font(CivicaTypography.caption)
                                        .foregroundColor(CivicaColors.graphite)
                                }
                            }
                            .padding(.leading, CivicaSpacing.sm)
                        }
                        Divider()
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.bottom)
        }
    }

    private func localizedExperience(for candidate: StaticCandidate) -> String {
        switch candidate.name {
        case "Adrienne Adams":
            return l("app.race_candidates.exp.adrienne_adams", candidate.experience)
        case "Michael Blake":
            return l("app.race_candidates.exp.michael_blake", candidate.experience)
        case "Andrew Cuomo":
            return l("app.race_candidates.exp.andrew_cuomo", candidate.experience)
        case "Brad Lander":
            return l("app.race_candidates.exp.brad_lander", candidate.experience)
        case "Zohran Mamdani":
            return l("app.race_candidates.exp.zohran_mamdani", candidate.experience)
        case "Zellnor Myrie":
            return l("app.race_candidates.exp.zellnor_myrie", candidate.experience)
        case "Jessica Ramos":
            return l("app.race_candidates.exp.jessica_ramos", candidate.experience)
        case "Scott Stringer":
            return l("app.race_candidates.exp.scott_stringer", candidate.experience)
        case "Whitney Tilson":
            return l("app.race_candidates.exp.whitney_tilson", candidate.experience)
        default:
            return candidate.experience
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

#Preview {
    RaceCandidatesView()
}
