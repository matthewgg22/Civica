import SwiftUI
import MapKit
import UIKit

struct MyRepsView: View {
    @EnvironmentObject private var planVM: PlanViewModel
    @EnvironmentObject private var repsVM: MyRepsViewModel

    @FocusState private var locationFieldFocused: Bool
    @State private var locationInput: String = ""
    @State private var showMyInfoSheet = false
    @State private var showGovHelpChat = false

    private static let mapUpdatedDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
    private static let defaultMapRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 39.8283, longitude: -98.5795),
        span: MKCoordinateSpan(latitudeDelta: 34, longitudeDelta: 56)
    )

    private struct RepsSection: Identifiable {
        let id: String
        let title: String
        let level: OfficialLevel
        let officials: [Official]
    }

    private var sections: [RepsSection] {
        [
            RepsSection(id: "federal-exec", title: "Federal Executive", level: .federal, officials: repsVM.executiveReps),
            RepsSection(id: "federal-leg", title: "Federal Legislative", level: .federal, officials: repsVM.federalReps),
            RepsSection(id: "state", title: "State", level: .state, officials: repsVM.stateReps),
            RepsSection(id: "local", title: "Local", level: .local, officials: repsVM.cityReps)
        ].filter { !$0.officials.isEmpty }
    }

    private var chatContexts: [RepCardContext] {
        sections.flatMap { section in
            section.officials.map { official in
                RepCardContext(sectionTitle: section.title, level: section.level, official: official)
            }
        }
    }

    private var normalizedZip: String {
        String(planVM.zip.filter(\.isNumber).prefix(5))
    }

    var body: some View {
        ZStack {
            VoteNowColors.appBackground.ignoresSafeArea()

            VStack(spacing: 0) {
                PageHeader(title: "Representatives")
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 8)
                    .background(VoteNowColors.appBackground)

                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        searchCard

                        locationCoverageCard(
                            region: repsVM.zipMapRegion ?? Self.defaultMapRegion,
                            center: repsVM.zipMapCenter,
                            radiusMeters: repsVM.zipMapRadiusMeters
                        )

                        if repsVM.isLoading {
                            ProgressView("Looking up your reps…")
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, 8)
                        }

                        if let error = repsVM.errorMessage, !error.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(error)
                                    .font(.subheadline)
                                    .foregroundColor(VoteNowColors.urgentCTA)

                                Button("Retry") {
                                    submitLookup()
                                }
                                .buttonStyle(VoteNowPrimaryCTAButtonStyle())
                            }
                        }

                        if !sections.isEmpty {
                            ForEach(sections) { section in
                                RepresentativeSection(
                                    title: section.title,
                                    officials: section.officials
                                )
                            }
                        } else if !repsVM.isLoading && (repsVM.errorMessage?.isEmpty ?? true) {
                            Text("Enter your ZIP or full U.S. address to load your representatives.")
                                .font(.subheadline)
                                .foregroundColor(VoteNowColors.mutedText)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, 8)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)
                }
                .scrollDismissesKeyboard(.interactively)
            }
        }
        .safeAreaInset(edge: .bottom) {
            HStack {
                Spacer()
                chatButton
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 8)
        }
        .onAppear {
            seedLookupInputIfNeeded()
            if !normalizedZip.isEmpty {
                repsVM.fetchReps(for: normalizedZip)
            }
        }
        .onTapGesture {
            locationFieldFocused = false
        }
        .onChange(of: repsVM.resolvedLocationSelection?.timestamp) { _ in
            guard let selection = repsVM.resolvedLocationSelection else { return }
            if let zip = selection.postalCode {
                planVM.zip = zip
                planVM.userAddress.zip = zip
            }
            if let state = selection.administrativeArea {
                planVM.userAddress.state = state
            }
        }
        .sheet(isPresented: $showMyInfoSheet) {
            MyInfoPanelView()
                .environmentObject(planVM)
                .environmentObject(repsVM)
        }
        .sheet(isPresented: $showGovHelpChat) {
            GovHelpChatSheetView(
                reps: chatContexts,
                currentZip: normalizedZip
            )
        }
    }

    private var chatButton: some View {
        Button {
            showGovHelpChat = true
        } label: {
            Label("Chat", systemImage: "message.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(VoteNowColors.primaryCTA)
                .clipShape(Capsule())
                .shadow(color: VoteNowColors.primaryText.opacity(0.18), radius: 4, x: 0, y: 2)
        }
        .buttonStyle(.plain)
    }

    private var searchCard: some View {
        HStack(spacing: 10) {
            TextField("Enter ZIP or full U.S. address", text: $locationInput)
                .font(.system(size: 18))
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused($locationFieldFocused)
                .padding(.horizontal, 12)
                .padding(.vertical, 12)
                .background(VoteNowColors.surfaceWhite)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                )
                .onChange(of: locationInput) { newValue in
                    let sanitized = USZipInputValidator.sanitizedInput(newValue)
                    if sanitized != newValue {
                        locationInput = sanitized
                    }
                    repsVM.handleLocationInputTyping(sanitized)
                }
                .onSubmit {
                    submitLookup()
                }
                .toolbar {
                    ToolbarItemGroup(placement: .keyboard) {
                        Spacer()
                        Button("Done") {
                            locationFieldFocused = false
                        }
                    }
                }
                .frame(maxWidth: .infinity)

            Button {
                locationInput = ""
                planVM.zip = ""
                planVM.userAddress.zip = ""
                repsVM.resetZipEntryState()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 34, height: 34)
                    .background(Color.gray.opacity(0.60))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .opacity(locationInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.45 : 1.0)
            .disabled(locationInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            Button {
                locationFieldFocused = false
                showMyInfoSheet = true
            } label: {
                Text("My Info")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 11)
                    .background(VoteNowColors.primaryCTA)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private func locationCoverageCard(
        region: MKCoordinateRegion,
        center: CLLocationCoordinate2D?,
        radiusMeters: CLLocationDistance?
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(center == nil ? "Find your district by entering your address" : "Your address matches you to your district")
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(VoteNowColors.primaryText)

            MyRepsCoverageMapView(
                region: region,
                center: center,
                radiusMeters: radiusMeters
            )
            .id(repsVM.zipMapUpdateID)
            .frame(height: 215)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            if let updatedAt = repsVM.zipMapLastUpdated {
                Text("Updated \(Self.mapUpdatedDateFormatter.string(from: updatedAt))")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(VoteNowColors.mutedText)
            } else {
                Text("Map preview available before lookup")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(VoteNowColors.mutedText)
            }
        }
    }

    private func seedLookupInputIfNeeded() {
        guard locationInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        if let selection = repsVM.resolvedLocationSelection,
           let normalized = selection.normalizedAddress,
           !normalized.isEmpty {
            locationInput = normalized
            return
        }

        let address = [
            planVM.userAddress.street,
            planVM.userAddress.city,
            planVM.userAddress.state,
            planVM.userAddress.zip
        ]
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
        .joined(separator: ", ")

        if !address.isEmpty {
            locationInput = address
            return
        }

        if !normalizedZip.isEmpty {
            locationInput = normalizedZip
        }
    }

    private func submitLookup() {
        let trimmed = locationInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        if let zip = USZipInputValidator.normalizedPrimaryZIP(from: trimmed) {
            planVM.zip = zip
            planVM.userAddress.zip = zip
        }

        locationFieldFocused = false
        repsVM.resolveLocationInput(trimmed)
    }
}

struct MyRepsView_Previews: PreviewProvider {
    static var previews: some View {
        MyRepsView()
            .environmentObject(PlanViewModel())
            .environmentObject(MyRepsViewModel())
    }
}

private struct MyRepsCoverageMapView: UIViewRepresentable {
    let region: MKCoordinateRegion
    let center: CLLocationCoordinate2D?
    let radiusMeters: CLLocationDistance?

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView(frame: .zero)
        mapView.delegate = context.coordinator
        mapView.showsCompass = false
        mapView.showsScale = false
        mapView.isPitchEnabled = false
        mapView.isRotateEnabled = false
        mapView.setRegion(Self.presentationRegion(for: region), animated: false)
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        mapView.removeOverlays(mapView.overlays)
        mapView.removeAnnotations(mapView.annotations.filter { !($0 is MKUserLocation) })

        let presentationRegion = Self.presentationRegion(for: region)
        if !Coordinator.approximatelyEqual(mapView.region, presentationRegion) {
            mapView.setRegion(presentationRegion, animated: true)
        }

        if let center, let radiusMeters {
            let circle = MKCircle(center: center, radius: radiusMeters)
            mapView.addOverlay(circle)

            let annotation = MKPointAnnotation()
            annotation.coordinate = center
            annotation.title = "Location Center (Approx.)"
            mapView.addAnnotation(annotation)
        }
    }

    private static func presentationRegion(for region: MKCoordinateRegion) -> MKCoordinateRegion {
        let zoomOutMultiplier: CLLocationDegrees = 1.55
        let latitudeDelta = max(region.span.latitudeDelta * zoomOutMultiplier, 0.060)
        let longitudeDelta = max(region.span.longitudeDelta * zoomOutMultiplier, 0.060)
        return MKCoordinateRegion(
            center: region.center,
            span: MKCoordinateSpan(latitudeDelta: latitudeDelta, longitudeDelta: longitudeDelta)
        )
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        static func approximatelyEqual(_ lhs: MKCoordinateRegion, _ rhs: MKCoordinateRegion) -> Bool {
            abs(lhs.center.latitude - rhs.center.latitude) < 0.0005 &&
            abs(lhs.center.longitude - rhs.center.longitude) < 0.0005 &&
            abs(lhs.span.latitudeDelta - rhs.span.latitudeDelta) < 0.0005 &&
            abs(lhs.span.longitudeDelta - rhs.span.longitudeDelta) < 0.0005
        }

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            guard let circle = overlay as? MKCircle else {
                return MKOverlayRenderer(overlay: overlay)
            }

            let renderer = MKCircleRenderer(circle: circle)
            renderer.fillColor = UIColor.systemBlue.withAlphaComponent(0.20)
            renderer.strokeColor = UIColor.systemBlue.withAlphaComponent(0.40)
            renderer.lineWidth = 1.3
            return renderer
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard !(annotation is MKUserLocation) else { return nil }

            let identifier = "myRepsCoverageCenter"
            let annotationView: MKMarkerAnnotationView
            if let reused = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) as? MKMarkerAnnotationView {
                annotationView = reused
                annotationView.annotation = annotation
            } else {
                annotationView = MKMarkerAnnotationView(annotation: annotation, reuseIdentifier: identifier)
                annotationView.canShowCallout = true
                annotationView.displayPriority = .required
                annotationView.glyphImage = UIImage(systemName: "location.fill")
                annotationView.markerTintColor = .systemBlue
            }

            return annotationView
        }
    }
}
