import Foundation

// EN/ES copy for the FindHelp Civica-controlled surfaces:
//
//   • Permission explainer (HANDOFF map · B1) — the Civica screen
//     that runs before the iOS dialog. "What we do / What we don't
//     do" gets equal weight; "use a zip code instead" is a first-
//     class alternative, not buried.
//
//   • Location-detail polish (HANDOFF map · C) — the "Report
//     incorrect info" link and eyebrow that the legacy detail
//     sheet was missing.
//
// The existing .xcstrings-keyed strings (find_help.*) stay in place;
// these CivicaText entries cover the new HANDOFF-aligned surfaces.

enum FindHelpStrings {

    // MARK: - Permission explainer (board B1)

    static let permissionEyebrow = CivicaText(
        "Find help nearby",
        es: "Encuentra ayuda cerca de ti"
    )
    static let permissionTitle = CivicaText(
        "Show me places within walking distance.",
        es: "Muéstrame lugares a distancia caminable."
    )
    static let permissionBody = CivicaText(
        "Civica will ask iOS for your location next. Before that, here's exactly what we do and don't do with it.",
        es: "Civica le pedirá tu ubicación a iOS a continuación. Antes de eso, aquí está exactamente qué hacemos y qué no hacemos con ella."
    )

    static let permissionDoEyebrow = CivicaText(
        "What we do",
        es: "Qué hacemos"
    )
    static let permissionDoBody = CivicaText(
        "Pull a list of nearby places, show them on a map, and sort by distance.",
        es: "Buscamos lugares cercanos, los mostramos en un mapa y los ordenamos por distancia."
    )

    static let permissionDontEyebrow = CivicaText(
        "What we don't do",
        es: "Qué no hacemos"
    )
    static let permissionDontBody = CivicaText(
        "Track you over time. Share your location with Massachusetts DTA. Use it for ads.",
        es: "Rastrearte con el tiempo. Compartir tu ubicación con el DTA de Massachusetts. Usarla para anuncios."
    )

    static let permissionWithoutSharing = CivicaText(
        "You can use the map without sharing — type a zip code instead.",
        es: "Puedes usar el mapa sin compartir tu ubicación — ingresa un código postal en su lugar."
    )

    static let permissionShareCTA = CivicaText(
        "Share my location",
        es: "Compartir mi ubicación"
    )
    static let permissionZipCTA = CivicaText(
        "Use a zip code instead",
        es: "Usar un código postal"
    )

    // MARK: - Detail sheet polish (board C)

    static let detailEyebrow = CivicaText(
        "Place details",
        es: "Detalles del lugar"
    )
    static let detailReportIncorrect = CivicaText(
        "Report incorrect info",
        es: "Informar de un error"
    )
}
