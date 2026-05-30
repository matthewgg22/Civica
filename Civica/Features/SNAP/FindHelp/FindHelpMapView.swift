import CivicaDesignSystem
import CoreLocation
import MapKit
import SwiftUI

// MARK: - AccessibilityElement = parent
struct FindHelpMapView: UIViewRepresentable {
    /// Initial latitudinal/longitudinal span used to center on the
    /// user's location on first mount. 0.3° ≈ a 20-mile diameter at MA
    /// latitudes — wide enough to show several pins for orientation,
    /// tight enough that the user immediately sees their neighborhood.
    private static let initialSpanDegrees: CLLocationDegrees = 0.3

    let locations: [FindHelpLocation]
    let userLocation: CLLocation?
    /// ID of the currently selected location, or nil. Drives the
    /// scale-up / halo treatment on the corresponding pin.
    var selectedLocationId: UUID? = nil
    let onSelect: (FindHelpLocation) -> Void
    /// Called after a user-initiated pan/zoom completes. Passes the new
    /// map center so the caller can offer "Search this area".
    var onRegionChanged: ((CLLocationCoordinate2D) -> Void)? = nil

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView()
        mapView.delegate = context.coordinator
        mapView.showsUserLocation = true
        mapView.register(
            FindHelpAnnotationView.self,
            forAnnotationViewWithReuseIdentifier: FindHelpAnnotationView.reuseID
        )
        mapView.register(
            MKMarkerAnnotationView.self,
            forAnnotationViewWithReuseIdentifier: MKMapViewDefaultClusterAnnotationViewReuseIdentifier
        )
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        syncAnnotations(on: mapView)
        syncSelection(on: mapView)
        if !context.coordinator.didCenterInitially, let userLocation {
            // Suppress the programmatic setRegion from firing onRegionChanged.
            context.coordinator.suppressNextRegionChange = true
            mapView.setRegion(
                MKCoordinateRegion(
                    center: userLocation.coordinate,
                    span: MKCoordinateSpan(
                        latitudeDelta: Self.initialSpanDegrees,
                        longitudeDelta: Self.initialSpanDegrees
                    )
                ),
                animated: false
            )
            context.coordinator.didCenterInitially = true
        }
    }

    /// Walk every visible annotation view and apply the selected /
    /// deselected visual state. Called on every `updateUIView` pass so
    /// the halo appears immediately when `selectedLocationId` changes.
    private func syncSelection(on mapView: MKMapView) {
        let pins = mapView.annotations.compactMap { $0 as? FindHelpAnnotation }
        for pin in pins {
            guard let view = mapView.view(for: pin) as? FindHelpAnnotationView else { continue }
            view.applySelectionState(pin.location.id == selectedLocationId, animated: true)
        }
    }

    private func syncAnnotations(on mapView: MKMapView) {
        let existing = mapView.annotations.compactMap { $0 as? FindHelpAnnotation }
        let existingIds = Set(existing.map(\.location.id))
        let newIds = Set(locations.map(\.id))

        // Remove stale annotations.
        let toRemove = existing.filter { !newIds.contains($0.location.id) }
        mapView.removeAnnotations(toRemove)

        // Add new annotations.
        let toAdd = locations
            .filter { !existingIds.contains($0.id) && $0.hasCoordinates }
            .map(FindHelpAnnotation.init(location:))
        mapView.addAnnotations(toAdd)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onSelect: onSelect, onRegionChanged: onRegionChanged)
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        let onSelect: (FindHelpLocation) -> Void
        let onRegionChanged: ((CLLocationCoordinate2D) -> Void)?
        var didCenterInitially: Bool = false
        /// Set to true before a programmatic setRegion call so the
        /// resulting regionDidChange event doesn't surface as a user pan.
        var suppressNextRegionChange: Bool = false

        init(
            onSelect: @escaping (FindHelpLocation) -> Void,
            onRegionChanged: ((CLLocationCoordinate2D) -> Void)?
        ) {
            self.onSelect = onSelect
            self.onRegionChanged = onRegionChanged
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            if annotation is MKUserLocation { return nil }
            if let cluster = annotation as? MKClusterAnnotation {
                let view = mapView.dequeueReusableAnnotationView(
                    withIdentifier: MKMapViewDefaultClusterAnnotationViewReuseIdentifier,
                    for: cluster
                ) as? MKMarkerAnnotationView
                // Homogeneous clusters take their category color; mixed
                // clusters fall back to graphite so the user can read
                // them as "various nearby" without misleading hue.
                view?.markerTintColor = FindHelpPinPalette.dominantColor(
                    in: cluster.memberAnnotations
                )
                return view
            }
            guard let pin = annotation as? FindHelpAnnotation else { return nil }
            let view = mapView.dequeueReusableAnnotationView(
                withIdentifier: FindHelpAnnotationView.reuseID,
                for: pin
            ) as? FindHelpAnnotationView
            view?.configure(with: pin.location)
            return view
        }

        func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
            if suppressNextRegionChange {
                suppressNextRegionChange = false
                return
            }
            guard didCenterInitially else { return }
            onRegionChanged?(mapView.region.center)
        }

        /// Spring-pop each new pin in as it's added to the map. The
        /// view is collapsed to a point and invisible on entry, then
        /// springs to full size — staggered by index so a batch of new
        /// results fans in rather than all appearing simultaneously.
        func mapView(_ mapView: MKMapView, didAdd views: [MKAnnotationView]) {
            let pins = views.filter { !($0.annotation is MKUserLocation) }
            // Cap the per-pin delay so dense regions (CA can drop hundreds
            // of pins at once) don't trickle in for tens of seconds.
            for (index, view) in pins.enumerated() {
                view.alpha = 0
                view.transform = CGAffineTransform(scaleX: 0.01, y: 0.01)
                let delay = Double(min(index, 12)) * 0.025
                UIView.animate(
                    withDuration: 0.38,
                    delay: delay,
                    usingSpringWithDamping: 0.58,
                    initialSpringVelocity: 0.4,
                    options: .allowUserInteraction
                ) {
                    view.alpha = 1
                    view.transform = .identity
                }
            }
        }

        func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
            mapView.deselectAnnotation(view.annotation, animated: false)
            if let pin = view.annotation as? FindHelpAnnotation {
                onSelect(pin.location)
            }
        }
    }
}

final class FindHelpAnnotation: NSObject, MKAnnotation {
    let location: FindHelpLocation
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(
            latitude: location.latitude ?? 0,
            longitude: location.longitude ?? 0
        )
    }
    var title: String? { location.name }
    var subtitle: String? { location.city }

    init(location: FindHelpLocation) {
        self.location = location
    }
}

/// Custom teardrop pin with a category glyph inside the upper bulb.
/// Subclasses `MKAnnotationView` directly (not `MKMarkerAnnotationView`)
/// so we control the shape and inner glyph rather than recoloring
/// Apple's default marker. Color + glyph + cached image rendering all
/// live in `FindHelpPinPalette` — this view is just the consumer.
///
/// Path mirrors the SVG from the canvas: a 28×35 teardrop with the
/// bulb centered at (14, 14) and the point at (14, 35). The view's
/// centerOffset anchors the tip on the underlying coordinate.
final class FindHelpAnnotationView: MKAnnotationView {
    static let reuseID = "FindHelpAnnotationView"

    override var annotation: MKAnnotation? {
        didSet {
            if let pin = annotation as? FindHelpAnnotation {
                configure(with: pin.location)
            }
        }
    }

    func configure(with location: FindHelpLocation) {
        // Clustering disabled — a "50" badge on a single dot hides
        // all the pins and feels broken. Individual pins at all zoom
        // levels let users orient themselves immediately.
        clusteringIdentifier = nil
        canShowCallout = false
        image = FindHelpPinPalette.teardropImage(for: location)
        // Anchor the tip of the teardrop on the coordinate rather
        // than the bulb center — that's where map pins are expected
        // to "point at" the place they represent.
        centerOffset = CGPoint(x: 0, y: -FindHelpPinPalette.teardropSize.height / 2)
        // White halo layer — opacity driven by applySelectionState.
        layer.shadowColor = UIColor.white.cgColor
        layer.shadowOffset = .zero
        layer.shadowRadius = 6
        layer.shadowOpacity = 0
        // Reset to deselected so recycled views don't carry stale state.
        applySelectionState(false, animated: false)
    }

    /// Animate the pin into its selected or deselected visual state.
    /// Selected: scales up 1.3× and lights a white halo shadow behind
    /// the teardrop so it clearly lifts off the map surface. The pin
    /// also rises in z-order so it renders above neighbouring pins.
    func applySelectionState(_ selected: Bool, animated: Bool) {
        let targetScale: CGFloat = selected ? 1.32 : 1.0
        let targetShadowOpacity: Float = selected ? 0.9 : 0
        layer.zPosition = selected ? 10 : 0

        if animated {
            UIView.animate(
                withDuration: 0.22,
                delay: 0,
                usingSpringWithDamping: 0.52,
                initialSpringVelocity: 0.3,
                options: .allowUserInteraction
            ) {
                self.transform = CGAffineTransform(scaleX: targetScale, y: targetScale)
            }
            // CABasicAnimation for the shadow since UIView.animate
            // doesn't drive layer.shadowOpacity on its own.
            let anim = CABasicAnimation(keyPath: "shadowOpacity")
            anim.fromValue = layer.shadowOpacity
            anim.toValue = targetShadowOpacity
            anim.duration = 0.18
            anim.fillMode = .forwards
            anim.isRemovedOnCompletion = false
            layer.add(anim, forKey: "shadowOpacity")
            layer.shadowOpacity = targetShadowOpacity
        } else {
            transform = CGAffineTransform(scaleX: targetScale, y: targetScale)
            layer.shadowOpacity = targetShadowOpacity
        }
    }
}
