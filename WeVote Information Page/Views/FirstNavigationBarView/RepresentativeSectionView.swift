//
//
//
//  RepresentativeSectionView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/28/25.
//  Updated by ChatGPT on 05/24/25 (use asset catalog first)
//

import SwiftUI
import UIKit // for UIImage(named:) 

/// A single row showing an official’s photo, name, party, district, and (optionally) a website link.
struct RepRow: View {
    let rep: Official

    var body: some View {
        HStack(spacing: 12) {
            // 1) Asset Catalog image, else 2) remote AsyncImage, else 3) system placeholder
            Group {
                if let uiImage = UIImage(named: rep.assetName) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                }
                else if let urlString = rep.photoURL,
                        let url       = URL(string: urlString) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable().scaledToFill()
                        default:
                            Color.gray.opacity(0.3)
                        }
                    }
                }
                else {
                    Image(systemName: "person.crop.circle.fill")
                        .resizable()
                        .scaledToFit()
                        .foregroundColor(.gray)
                }
            }
            .frame(width: 44, height: 44)
            .clipShape(Circle())

            // Name, party, and district
            VStack(alignment: .leading, spacing: 4) {
                Text(rep.name)
                    .font(.headline)

                if let party = rep.party {
                    Text(party)
                        .font(.subheadline)
                        .foregroundColor(party.contains("Democrat") ? .blue : .red)
                }

                if let district = rep.district {
                    Text(district)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            // Website link icon
            if let linkString = rep.url,
               let linkURL    = URL(string: linkString) {
                Link(destination: linkURL) {
                    Image(systemName: "link")
                        .imageScale(.large)
                        .foregroundColor(.blue)
                }
                .padding(.trailing, 4)
            }
        }
        .padding(.vertical, 6)
    }
}

/// A simple section listing multiple officials under a single section title.
struct RepresentativeSection: View {
    let title: String
    let officials: [Official]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.title3)
                .fontWeight(.semibold)

            ForEach(officials) { official in
                RepRow(rep: official)
                Divider()
            }
        }
        .padding(.horizontal)
    }
}

struct RepresentativeSectionView_Previews: PreviewProvider {
    static var sampleReps: [Official] = [
        // Drop the assetName argument—assetName is computed automatically now.
        Official(
            name:       "Jane Doe",
            divisionId: nil,
            party:      "Independent",
            photoURL:   nil,
            url:        "https://example.com/janedoe"
        ),
        Official(
            name:       "Chuck Schumer",
            divisionId: "ocd-division/country:us/state:ny/sldu:17",
            party:      "Democrat",
            photoURL:   nil,
            url:        nil
        )
    ]

    static var previews: some View {
        RepresentativeSection(
            title:     "Sample Officials",
            officials: sampleReps
        )
        .previewLayout(.sizeThatFits)
    }
}
