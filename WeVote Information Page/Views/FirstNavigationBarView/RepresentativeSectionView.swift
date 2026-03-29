import SwiftUI
import UIKit

private func partyTint(_ party: String?) -> Color {
    let normalized = (party ?? "").lowercased()
    if normalized.contains("democrat") { return VoteNowColors.richBlue }
    if normalized.contains("republican") { return VoteNowColors.richRed }
    return VoteNowColors.mutedText
}

private func shouldOpenMyInfoFromParty(_ party: String?) -> Bool {
    let normalized = (party ?? "").lowercased()
    return normalized.contains("democrat") || normalized.contains("republican")
}

private func telephoneURL(from raw: String?) -> URL? {
    guard let raw else { return nil }
    let digits = raw.filter { $0.isNumber }
    guard digits.count >= 7 else { return nil }
    return URL(string: "tel:\(digits)")
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
    let phoneLabel: String?

    var isPhone: Bool { id == "phone" }
}

private struct RepHeadshotView: View {
    let rep: Official

    @State private var fallbackWikipediaURL: URL?
    @State private var activeRemoteURL: URL?
    @State private var attemptedWikipediaLookup = false

    private var bundledImage: UIImage? {
        guard shouldUseBundledImage else { return nil }
        return UIImage(named: rep.assetName)
    }

    private var providedPhotoURL: URL? {
        normalizedImageURL(rep.photoURL)
    }

    private var shouldUseBundledImage: Bool {
        guard rep.level == .state else { return true }
        guard let stateCode = stateCodeFromDivisionID(rep.divisionId) else { return false }
        return stateCode == "ny"
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
            let wikipediaURL: URL?
            if rep.level == .state {
                wikipediaURL = try await WikipediaImageService.shared.verifiedPoliticalThumbnailURL(for: rep.name)
            } else {
                wikipediaURL = try await WikipediaImageService.shared.thumbnailURL(for: rep.name)
            }
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

    private func stateCodeFromDivisionID(_ divisionID: String?) -> String? {
        guard let divisionID = divisionID?.lowercased(),
              let stateRange = divisionID.range(of: "/state:") else {
            return nil
        }
        let suffix = divisionID[stateRange.upperBound...]
        let code = suffix.prefix { $0.isLetter }
        guard code.count == 2 else { return nil }
        return String(code)
    }
}

struct RepRow: View {
    let rep: Official

    @Environment(\.openURL) private var openURL
    @Environment(\.locale) private var locale

    @State private var isContactExpanded = false
    @State private var showPhoneFallbackAlert = false
    @State private var phoneFallbackMessage = ""

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

    private var contactURL: URL? {
        normalizedURL(rep.contactFormURL)
    }

    private var websiteURL: URL? {
        normalizedURL(rep.resolvedWebsiteURL)
    }

    private var phoneURL: URL? {
        telephoneURL(from: rep.officialPhone)
    }

    private var districtLabel: String? {
        guard let district = rep.district?.trimmingCharacters(in: .whitespacesAndNewlines),
              !district.isEmpty else {
            return nil
        }
        guard district.caseInsensitiveCompare("Statewide") == .orderedSame ||
                district.caseInsensitiveCompare("Citywide") == .orderedSame,
              let officeTitle = rep.officeTitle?.trimmingCharacters(in: .whitespacesAndNewlines),
              !officeTitle.isEmpty else {
            return district
        }
        return "\(district) - \(officeTitle)"
    }

    private var displayName: String {
        guard rep.level == .local else { return rep.name }
        return rep.name.replacingOccurrences(
            of: #"\s*\(mayor\)\s*$"#,
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )
    }

    private var displayParty: String? {
        guard let party = rep.party?.trimmingCharacters(in: .whitespacesAndNewlines), !party.isEmpty else {
            return nil
        }
        if party.caseInsensitiveCompare("Democratic") == .orderedSame {
            return l("app.reps.party.democrat", "Democrat")
        }
        return party
    }

    private var contactActions: [RepContactAction] {
        var actions: [RepContactAction] = []
        if let contactURL {
            actions.append(
                RepContactAction(
                    id: "email",
                    title: l("app.reps.action.email", "Email"),
                    systemImage: "envelope.badge.fill",
                    destination: contactURL,
                    phoneLabel: nil
                )
            )
        }
        if let phoneURL {
            actions.append(
                RepContactAction(
                    id: "phone",
                    title: l("app.reps.action.phone", "Phone"),
                    systemImage: "phone.fill",
                    destination: phoneURL,
                    phoneLabel: rep.officialPhone
                )
            )
        }
        if let websiteURL {
            actions.append(
                RepContactAction(
                    id: "website",
                    title: l("app.reps.action.website", "Website"),
                    systemImage: "link",
                    destination: websiteURL,
                    phoneLabel: nil
                )
            )
        }
        return actions
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 14) {
                RepHeadshotView(rep: rep)
                .frame(width: 65, height: 65)
                .clipShape(Circle())

                VStack(alignment: .leading, spacing: 4) {
                    Text(displayName)
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(VoteNowColors.primaryText)
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)

                    if let party = displayParty {
                        Text(party)
                            .font(.system(size: 17, weight: .regular))
                            .foregroundColor(partyTint(party))
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                            .opensMyInfoPanelOnLongPress(when: shouldOpenMyInfoFromParty(party))
                    }

                    if let districtLabel {
                        Text(districtLabel)
                            .font(.system(size: 16, weight: .regular))
                            .foregroundColor(VoteNowColors.mutedText)
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
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
                        Button {
                            handleActionTap(action)
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: action.systemImage)
                                Text(action.title)
                            }
                            .font(.system(size: 12, weight: .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity, minHeight: 36)
                            .background(VoteNowColors.primaryCTA)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .frame(maxWidth: .infinity)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .padding(.vertical, 8)
        .alert(l("app.reps.alert.phone_unavailable.title", "Phone Not Available"), isPresented: $showPhoneFallbackAlert) {
            Button(l("app.reps.alert.phone_unavailable.ok", "OK"), role: .cancel) {}
        } message: {
            Text(phoneFallbackMessage)
        }
    }

    private func handleActionTap(_ action: RepContactAction) {
        if action.isPhone, UIApplication.shared.canOpenURL(action.destination) == false {
            presentPhoneFallback(for: action)
            return
        }

        openURL(action.destination) { accepted in
            if action.isPhone, !accepted {
                presentPhoneFallback(for: action)
            }
        }
    }

    private func presentPhoneFallback(for action: RepContactAction) {
        let number = action.phoneLabel?.trimmingCharacters(in: .whitespacesAndNewlines)
        let message: String

        if let number, !number.isEmpty {
            UIPasteboard.general.string = number
            message = lf(
                "app.reps.alert.phone_unavailable.copied",
                "This device cannot place calls. Copied number: %@",
                number
            )
        } else {
            message = l("app.reps.alert.phone_unavailable.generic", "This device cannot place calls.")
        }

        phoneFallbackMessage = message
        showPhoneFallbackAlert = true
    }
}

struct RepresentativeSection: View {
    let title: String
    let officials: [Official]
    @Environment(\.locale) private var locale

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }

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
            Spacer(minLength: 0)
            HStack(spacing: 8) {
                headerIcon
                Text(displayTitle)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(VoteNowColors.primaryCTA)
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private var headerIcon: some View {
        switch normalizedTitle {
        case "federal executive":
            Image("WhiteHouseIcon")
                .resizable()
                .scaledToFit()
                .frame(width: 29, height: 29)
                .padding(5)
                .background(VoteNowColors.primaryCTA.opacity(0.30))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(VoteNowColors.primaryCTA.opacity(0.40), lineWidth: 1.3)
                )
        case "federal legislative":
            if UIImage(named: "CapitolIcon") != nil {
                Image("CapitolIcon")
                    .renderingMode(.original)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 32, height: 32)
                    .padding(4)
                    .background(VoteNowColors.primaryCTA.opacity(0.30))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(VoteNowColors.primaryCTA.opacity(0.40), lineWidth: 1.3)
                    )
            } else {
                Text("🏛️")
                    .font(.system(size: 24))
                    .frame(width: 32, height: 32)
                    .padding(4)
                    .background(VoteNowColors.primaryCTA.opacity(0.30))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(VoteNowColors.primaryCTA.opacity(0.40), lineWidth: 1.3)
                    )
            }
        case "state":
            if let asset = StateFlagCatalog.assetName(for: resolvedStateCode),
               UIImage(named: asset) != nil {
                Image(asset)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 42, height: 32)
                    .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .stroke(VoteNowColors.primaryCTA.opacity(0.30), lineWidth: 0.9)
                    )
                    .shadow(color: VoteNowColors.primaryText.opacity(0.22), radius: 4, x: 0, y: 2)
                    .opensMyInfoPanelOnLongPress()
            } else {
                Image(systemName: "map.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(VoteNowColors.primaryCTA)
                    .frame(width: 22, height: 22)
                    .padding(4)
                    .background(VoteNowColors.primaryCTA.opacity(0.30))
                    .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .stroke(VoteNowColors.primaryCTA.opacity(0.40), lineWidth: 1.3)
                    )
            }
        default:
            Image(systemName: "building.2.fill")
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(VoteNowColors.primaryCTA)
                .frame(width: 22, height: 22)
        }
    }

    private var normalizedTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private var displayTitle: String {
        switch normalizedTitle {
        case "federal executive":
            return "\(l("app.reps.section.federal_executive", "Federal Executive")) (\(l("app.reps.section.white_house", "White House")))"
        case "federal legislative":
            return "\(l("app.reps.section.federal_legislative", "Federal Legislative")) (\(l("app.reps.section.congress", "Congress")))"
        case "state":
            return l("app.reps.section.state", "State")
        case "local":
            return l("app.reps.section.local", "Local")
        default:
            return title
        }
    }

    private var resolvedStateCode: String? {
        for official in officials {
            guard let divisionId = official.divisionId?.lowercased(),
                  let range = divisionId.range(of: "/state:") else {
                continue
            }
            let suffix = divisionId[range.upperBound...]
            let code = suffix.prefix { $0.isLetter }
            if code.count == 2 {
                return String(code).uppercased()
            }
        }
        return nil
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
