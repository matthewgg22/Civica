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

    override init() {
        // Initialize with whatever the manager’s current status is
        self.authorizationStatus = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        // Kick off the permission prompt
        manager.requestWhenInUseAuthorization()
        if manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse {
            manager.requestLocation()
        }
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
            // Still waiting on the user—ask again
            manager.requestWhenInUseAuthorization()
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
