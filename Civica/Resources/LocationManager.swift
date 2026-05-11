//
//
//
//
//  LocationManager.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/16/25.
//  Updated by ChatGPT on 05/26/25
//

import Foundation
import CoreLocation
import OSLog

/// A simple manager that
/// 1) requests “when in use” permission
/// 2) publishes the user’s current location
/// 3) exposes the authorization status so you can react in your UI if needed
final class LocationManager: NSObject, ObservableObject {
    /// The most recent location, if authorized
    @Published var location: CLLocation?
    /// The current authorization status
    @Published var authorizationStatus: CLAuthorizationStatus

    private let manager = CLLocationManager()
    private let logger = Logger(subsystem: "Civica", category: "LocationManager")
    private var hasPublishedInitialLocation = false
    private let autoRequestPermission: Bool

    override convenience init() {
        self.init(autoRequestPermission: true)
    }

    /// Pass `autoRequestPermission: false` from views that need to gate
    /// the iOS dialog behind their own explainer (HANDOFF map · B1 —
    /// "Pre-permission explainer is a Civica screen, not the iOS
    /// dialog"). Default is true so legacy call sites preserve the
    /// auto-prompt behavior.
    init(autoRequestPermission: Bool) {
        self.autoRequestPermission = autoRequestPermission
        self.authorizationStatus = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        if autoRequestPermission {
            manager.requestWhenInUseAuthorization()
        }
        if manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse {
            manager.requestLocation()
        }
    }

    /// Trigger the iOS authorization dialog explicitly. No-op when the
    /// status is already determined.
    func requestPermission() {
        guard manager.authorizationStatus == .notDetermined else { return }
        manager.requestWhenInUseAuthorization()
    }
}

extension LocationManager: CLLocationManagerDelegate {
    // Called whenever the user changes the permission in Settings or via the prompt
    func locationManager(_ manager: CLLocationManager,
                         didChangeAuthorization status: CLAuthorizationStatus)
    {
        DispatchQueue.main.async {
            self.authorizationStatus = status
        }

        switch status {
        case .authorizedWhenInUse, .authorizedAlways:
            // Use one-shot location requests to avoid constant map/state churn.
            manager.requestLocation()
        case .notDetermined:
            // Re-prompt only when the call site opted into auto-prompt.
            // Views with their own Civica explainer (FindHelp) gate
            // the dialog manually via requestPermission().
            if autoRequestPermission {
                manager.requestWhenInUseAuthorization()
            }
        default:
            // .denied, .restricted: you might show an alert in your UI
            break
        }
    }

    // Called with location updates
    func locationManager(_ manager: CLLocationManager,
                         didUpdateLocations locations: [CLLocation])
    {
        guard let loc = locations.last else { return }
        if hasPublishedInitialLocation {
            return
        }
        hasPublishedInitialLocation = true
        DispatchQueue.main.async {
            self.location = loc
        }
        manager.stopUpdatingLocation()
    }

    // Called if there’s an error obtaining location
    func locationManager(_ manager: CLLocationManager,
                         didFailWithError error: Error)
    {
        logger.error("Location request failed.")
    }
}
