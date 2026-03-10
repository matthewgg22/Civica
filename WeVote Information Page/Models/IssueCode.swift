import Foundation

enum IssueCode: String, CaseIterable, Identifiable, Codable {
    case jobs_wages
    case affordability
    case health
    case labor
    case foreign_affairs
    case veterans_military
    case taxes_budget
    case lgbtq

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .jobs_wages:
            return "Jobs & Wages"
        case .affordability:
            return "Affordability"
        case .health:
            return "Health"
        case .labor:
            return "Labor"
        case .foreign_affairs:
            return "Foreign Affairs"
        case .veterans_military:
            return "Veterans & Military"
        case .taxes_budget:
            return "Taxes & Budget"
        case .lgbtq:
            return "LGBTQ+ Rights"
        }
    }

    var shortPrompt: String {
        switch self {
        case .jobs_wages:
            return "support jobs, fair pay, and economic opportunity"
        case .affordability:
            return "support policies that lower costs and improve affordability for working families"
        case .health:
            return "support affordable, accessible healthcare and strong public health protections"
        case .labor:
            return "support workers' rights, fair labor standards, and safe workplaces"
        case .foreign_affairs:
            return "show strong leadership on diplomacy, alliances, and America's role abroad"
        case .veterans_military:
            return "support service members, veterans, and national defense"
        case .taxes_budget:
            return "support responsible budgeting and tax policy that helps families and communities"
        case .lgbtq:
            return "protect dignity, safety, and equal rights for LGBTQ+ people"
        }
    }

    var defaultAsk: String {
        switch self {
        case .jobs_wages:
            return "Please support policies that strengthen jobs, wages, and opportunity for working people."
        case .affordability:
            return "Please support policies that lower everyday costs for housing, food, childcare, and essential needs."
        case .health:
            return "Please support healthcare policies that expand access, reduce costs, and protect public health."
        case .labor:
            return "Please support policies that protect workers, strengthen labor standards, and improve workplace safety."
        case .foreign_affairs:
            return "Please support steady, principled American leadership abroad through diplomacy and strong alliances."
        case .veterans_military:
            return "Please support service members, veterans, and a strong, responsible national defense."
        case .taxes_budget:
            return "Please support responsible budgeting and tax policy that helps families, workers, and communities."
        case .lgbtq:
            return "Please support equal rights, dignity, and safety for LGBTQ+ people."
        }
    }

    var relevantSenateCommittees: [String] {
        switch self {
        case .jobs_wages:
            return [
                "Health, Education, Labor, and Pensions",
                "Small Business and Entrepreneurship",
                "Finance",
                "Budget",
            ]
        case .affordability:
            return [
                "Banking, Housing, and Urban Affairs",
                "Finance",
                "Budget",
                "Appropriations",
            ]
        case .health:
            return [
                "Health, Education, Labor, and Pensions",
                "Finance",
                "Appropriations",
            ]
        case .labor:
            return [
                "Health, Education, Labor, and Pensions",
                "Small Business and Entrepreneurship",
                "Finance",
                "Budget",
            ]
        case .foreign_affairs:
            return [
                "Foreign Relations",
                "Armed Services",
                "Intelligence",
                "Appropriations",
            ]
        case .veterans_military:
            return [
                "Armed Services",
                "Veterans' Affairs",
                "Appropriations",
            ]
        case .taxes_budget:
            return [
                "Finance",
                "Budget",
                "Appropriations",
            ]
        case .lgbtq:
            return [
                "Judiciary",
                "Health, Education, Labor, and Pensions",
                "Homeland Security and Governmental Affairs",
            ]
        }
    }
}
