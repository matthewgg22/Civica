import SwiftUI
import UIKit

private func partyTint(_ party: String?) -> Color {
    let normalized = (party ?? "").lowercased()
    if normalized.contains("democrat") { return VoteNowColors.richBlue }
    if normalized.contains("republican") { return VoteNowColors.richRed }
    return VoteNowColors.mutedText
}

private func telephoneURL(from raw: String?) -> URL? {
    guard let raw else { return nil }
    let digits = raw.filter { $0.isNumber }
    guard digits.count >= 7 else { return nil }
    return URL(string: "tel://\(digits)")
}

private func normalizedURL(_ raw: String?) -> URL? {
    guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return nil }
    if raw.lowercased().hasPrefix("http://") || raw.lowercased().hasPrefix("https://") {
        return URL(string: raw)
    }
    return URL(string: "https://\(raw)")
}

private func normalizedImageURL(_ raw: String?) -> URL? {
    guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return nil }
    if raw.lowercased().hasPrefix("http://") || raw.lowercased().hasPrefix("https://") {
        return URL(string: raw)
    }
    return URL(string: "https://\(raw)")
}

private struct RepContactAction: Identifiable {
    let id: String
    let title: String
    let systemImage: String
    let destination: URL
}

private struct RepHeadshotView: View {
    let rep: Official

    @State private var fallbackWikipediaURL: URL?
    @State private var activeRemoteURL: URL?
    @State private var attemptedWikipediaLookup = false

    private var bundledImage: UIImage? {
        UIImage(named: rep.assetName)
    }

    private var providedPhotoURL: URL? {
        normalizedImageURL(rep.photoURL)
    }

    var body: some View {
        headshotContent
        .task(id: rep.name) {
            await resolveBestPhotoURL()
        }
    }

    @ViewBuilder
    private var headshotContent: some View {
        if let bundledImage {
            Image(uiImage: bundledImage)
                .resizable()
                .scaledToFill()
        } else if let remoteURL = activeRemoteURL {
            AsyncImage(url: remoteURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                case .failure:
                    Color.gray.opacity(0.18)
                        .onAppear {
                            if remoteURL == providedPhotoURL {
                                activeRemoteURL = fallbackWikipediaURL
                            } else {
                                activeRemoteURL = nil
                            }
                        }
                case .empty:
                    ZStack {
                        Color.gray.opacity(0.14)
                        ProgressView()
                            .scaleEffect(0.85)
                    }
                @unknown default:
                    Color.gray.opacity(0.18)
                }
            }
        } else {
            Image(systemName: "person.crop.circle.fill")
                .resizable()
                .scaledToFit()
                .foregroundColor(VoteNowColors.mutedText.opacity(0.45))
        }
    }

    private func resolveBestPhotoURL() async {
        await MainActor.run {
            if activeRemoteURL == nil {
                activeRemoteURL = providedPhotoURL
            }
        }

        guard bundledImage == nil else { return }
        guard !attemptedWikipediaLookup else { return }

        await MainActor.run {
            attemptedWikipediaLookup = true
        }

        do {
            let wikipediaURL = try await WikipediaImageService.shared.thumbnailURL(for: rep.name)
            await MainActor.run {
                fallbackWikipediaURL = wikipediaURL
                if activeRemoteURL == nil {
                    activeRemoteURL = wikipediaURL
                }
            }
        } catch {
            return
        }
    }
}

struct RepRow: View {
    let rep: Official

    @State private var isContactExpanded = false

    private var contactURL: URL? {
        normalizedURL(rep.contactFormURL)
    }

    private var websiteURL: URL? {
        normalizedURL(rep.resolvedWebsiteURL)
    }

    private var phoneURL: URL? {
        telephoneURL(from: rep.officialPhone)
    }

    private var contactActions: [RepContactAction] {
        var actions: [RepContactAction] = []
        if let contactURL {
            actions.append(
                RepContactAction(
                    id: "email",
                    title: "Email",
                    systemImage: "envelope.badge.fill",
                    destination: contactURL
                )
            )
        }
        if let phoneURL {
            actions.append(
                RepContactAction(
                    id: "phone",
                    title: "Phone",
                    systemImage: "phone.fill",
                    destination: phoneURL
                )
            )
        }
        if let websiteURL {
            actions.append(
                RepContactAction(
                    id: "website",
                    title: "Website",
                    systemImage: "link",
                    destination: websiteURL
                )
            )
        }
        return actions
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 14) {
                RepHeadshotView(rep: rep)
                .frame(width: 72, height: 72)
                .clipShape(Circle())

                VStack(alignment: .leading, spacing: 4) {
                    Text(rep.name)
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(VoteNowColors.primaryText)

                    if let party = rep.party, !party.isEmpty {
                        Text(party)
                            .font(.system(size: 17, weight: .regular))
                            .foregroundColor(partyTint(party))
                    }

                    if let district = rep.district, !district.isEmpty {
                        Text(district)
                            .font(.system(size: 16, weight: .regular))
                            .foregroundColor(VoteNowColors.mutedText)
                    }
                }

                Spacer(minLength: 10)

                if !contactActions.isEmpty {
                    Button {
                        withAnimation(.easeInOut(duration: 0.18)) {
                            isContactExpanded.toggle()
                        }
                    } label: {
                        Image(systemName: isContactExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(VoteNowColors.mutedText)
                    }
                    .buttonStyle(.plain)
                }
            }

            if isContactExpanded, !contactActions.isEmpty {
                HStack(spacing: 8) {
                    ForEach(contactActions) { action in
                        Link(destination: action.destination) {
                            HStack(spacing: 6) {
                                Image(systemName: action.systemImage)
                                Text(action.title)
                            }
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity, minHeight: 36)
                            .background(VoteNowColors.primaryCTA)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .frame(maxWidth: .infinity)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.leading, 86)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .padding(.vertical, 8)
    }
}

struct RepresentativeSection: View {
    let title: String
    let officials: [Official]

    var body: some View {
        VStack(spacing: 0) {
            header
                .padding(.bottom, 10)

            ForEach(Array(officials.enumerated()), id: \.element.id) { index, official in
                RepRow(rep: official)
                if index < officials.count - 1 {
                    Divider()
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(VoteNowColors.infoSurfaceBlue)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.22), lineWidth: 1)
        )
    }

    private var header: some View {
        HStack {
            Label(title, systemImage: "building.columns")
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(VoteNowColors.primaryCTA)

            Spacer()
        }
    }
}

struct RepresentativeSectionView_Previews: PreviewProvider {
    static var previews: some View {
        RepresentativeSection(
            title: "Federal Executive",
            officials: [
                Official(
                    name: "Jane Doe",
                    divisionId: nil,
                    party: "Independent",
                    photoURL: nil,
                    url: "https://example.com/jane"
                ),
                Official(
                    name: "John Smith",
                    divisionId: "ocd-division/country:us/state:ny/sldu:17",
                    party: "Democrat",
                    photoURL: nil,
                    officialPhone: "(202) 555-0100",
                    websiteURL: "https://example.com"
                )
            ]
        )
        .padding()
        .background(VoteNowColors.appBackground)
        .previewLayout(.sizeThatFits)
    }
}
