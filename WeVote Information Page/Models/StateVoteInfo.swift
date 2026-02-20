import Foundation

struct StateVoteInfo: Codable, Hashable {
    let stateName: String
    let stateCode: String
    let turnout2016Pres: Double?
    let turnout2018Mid: Double?
    let turnout2020Pres: Double?
    let turnout2022Mid: Double?
    let notableCloseRace: String
    let funFact: String
}
