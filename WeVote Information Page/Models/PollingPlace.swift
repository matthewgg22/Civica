//
//
//  PollingPlace.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/22/25.
//  Updated by ChatGPT on 5/27/25

import CoreLocation

struct PollingPlace: Identifiable, Codable {
    // now mutable so we can assign in-flight
    var id: UUID = .init()
    let label: String       // “1”, “2”, …
    let name: String        // human-readable name
    let address: String     // full street + borough
    var distance: String = ""    // e.g. “3.9 mi”
    let hours: String       // e.g. “6 AM – 9 PM”
    var coordinate: CLLocationCoordinate2D = .init()
    let postalCode: String?

    enum CodingKeys: String, CodingKey {
        case id, label, name, address, distance, hours, postalCode
        case lat, lon
    }

    // now distance & coordinate get default values if you don't pass them
    init(
      id: UUID = .init(),
      label: String,
      name: String,
      address: String,
      distance: String = "",
      hours: String,
      coordinate: CLLocationCoordinate2D = .init(),
      postalCode: String? = nil
    ) {
      self.id = id
      self.label = label
      self.name = name
      self.address = address
      self.distance = distance
      self.hours = hours
      self.coordinate = coordinate
      self.postalCode = postalCode
    }

    // MARK: – Codable
    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      id          = try c.decode(UUID.self, forKey: .id)
      label       = try c.decode(String.self, forKey: .label)
      name        = try c.decode(String.self, forKey: .name)
      address     = try c.decode(String.self, forKey: .address)
      distance    = try c.decode(String.self, forKey: .distance)
      hours       = try c.decode(String.self, forKey: .hours)
      postalCode  = try c.decodeIfPresent(String.self, forKey: .postalCode)
      let lat     = try c.decode(Double.self, forKey: .lat)
      let lon     = try c.decode(Double.self, forKey: .lon)
      coordinate  = CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    func encode(to encoder: Encoder) throws {
      var c = encoder.container(keyedBy: CodingKeys.self)
      try c.encode(id,         forKey: .id)
      try c.encode(label,      forKey: .label)
      try c.encode(name,       forKey: .name)
      try c.encode(address,    forKey: .address)
      try c.encode(distance,   forKey: .distance)
      try c.encode(hours,      forKey: .hours)
      try c.encode(postalCode, forKey: .postalCode)
      try c.encode(coordinate.latitude,  forKey: .lat)
      try c.encode(coordinate.longitude, forKey: .lon)
    }
}
