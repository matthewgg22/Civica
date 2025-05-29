//
import Foundation

// MARK: – Top‐level wrapper

struct RepsData: Codable {
  let federal: FederalSection
  let state:   StateSection
  let city:    CitySection

  private enum CodingKeys: String, CodingKey {
    case federal = "Federal"
    case state   = "State"
    case city    = "City"
  }
}

// MARK: – Federal section

struct FederalSection: Codable {
  let president:       OfficialData
  let senators:        [OfficialData]
  let representatives: [OfficialData]

  private enum CodingKeys: String, CodingKey {
    case president       = "President"
    case senators        = "Senators"
    case representatives = "Representatives"
  }
}

// MARK: – State section

struct StateSection: Codable {
  let governor:             OfficialData
  let stateSenators:        [OfficialData]
  let stateAssemblyMembers: [OfficialData]

  private enum CodingKeys: String, CodingKey {
    case governor             = "Governor"
    case stateSenators        = "StateSenators"
    case stateAssemblyMembers = "StateAssemblyMembers"
  }
}

// MARK: – City section

struct CitySection: Codable {
  let mayor: OfficialData

  private enum CodingKeys: String, CodingKey {
    case mayor = "Mayor"
  }
}

// MARK: – Individual official

struct OfficialData: Codable {
  let name:        String
  let office:      String
  let party:       String
  let district:    String?
  let boroughs:    [String]
  let divisionIds: [String]
  let website:     String
  let photoURL:    String?
}
