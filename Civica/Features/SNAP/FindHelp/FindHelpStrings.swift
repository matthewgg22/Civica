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
    /// Permission-comparison copy ("what we don't do"). Names the
    /// active state's SNAP agency so the comparison feels grounded
    /// rather than abstract. Defaults to the launch state's agency
    /// when the caller hasn't threaded a state code through yet.
    static func permissionDontBody(stateCode: String? = nil, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        switch language {
        case .english:
            return "Track you over time. Share your location with \(agency). Use it for ads."
        case .spanish:
            return "Rastrearte con el tiempo. Compartir tu ubicación con \(agency). Usarla para anuncios."
        }
    }

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

    // MARK: - Detail sheet body labels
    //
    // Info-block titles above each piece of place data on the detail
    // sheet. These were inline English literals; routing through
    // CivicaText keeps them in step with the in-app language picker
    // so a Spanish-locale user doesn't get an English "Address" label
    // above a Spanish-language street name.

    static let detailLabelAddress = CivicaText(
        "Address",
        es: "Dirección"
    )
    static let detailLabelPhone = CivicaText(
        "Phone",
        es: "Teléfono"
    )
    static let detailLabelHours = CivicaText(
        "Hours",
        es: "Horario"
    )
    static let detailLabelLanguagesServed = CivicaText(
        "Languages served",
        es: "Idiomas ofrecidos"
    )
    static let detailLabelNotes = CivicaText(
        "Notes",
        es: "Notas"
    )
    static let detailLastUpdatedPrefix = CivicaText(
        "Last updated:",
        es: "Última actualización:"
    )
    static let detailDoneButton = CivicaText(
        "Done",
        es: "Listo"
    )

    // Localized weekday names for the hours block. Keyed by the
    // hoursJson short-form keys (mon, tue, ...) the backend uses.
    static func weekdayLabel(for key: String, language: CivicaLanguage) -> String? {
        switch (key, language) {
        case ("mon", .english): return "Monday"
        case ("mon", .spanish): return "Lunes"
        case ("tue", .english): return "Tuesday"
        case ("tue", .spanish): return "Martes"
        case ("wed", .english): return "Wednesday"
        case ("wed", .spanish): return "Miércoles"
        case ("thu", .english): return "Thursday"
        case ("thu", .spanish): return "Jueves"
        case ("fri", .english): return "Friday"
        case ("fri", .spanish): return "Viernes"
        case ("sat", .english): return "Saturday"
        case ("sat", .spanish): return "Sábado"
        case ("sun", .english): return "Sunday"
        case ("sun", .spanish): return "Domingo"
        default: return nil
        }
    }

    // MARK: - Loading state (board B4)
    //
    // HANDOFF: "Loading names the work — 'reading the county
    // directory' not 'loading…'." Concrete framing reduces the
    // perceived wait.

    static let loadingEyebrow = CivicaText(
        "About 2 seconds",
        es: "Unos 2 segundos"
    )
    static let loadingTitle = CivicaText(
        "Reading the local directory and food bank list…",
        es: "Consultando el directorio local y la lista de bancos de alimentos…"
    )

    // MARK: - Empty state (board B3)
    //
    // HANDOFF: "Empty state always offers a human path — the phone
    // number, every time." The radius-expand CTA covers rural users
    // who legitimately don't have results within a tight radius.

    static let emptyTitle = CivicaText(
        "Nothing within %@ miles.",
        es: "Nada dentro de %@ millas."
    )
    static let emptyBody = CivicaText(
        "Rural areas often need a wider radius. We can also help you over the phone — that works anywhere.",
        es: "Las áreas rurales suelen necesitar un radio más amplio. También podemos ayudarte por teléfono — eso funciona en cualquier lugar."
    )
    static let emptyExpandCTA = CivicaText(
        "Search 25 miles",
        es: "Buscar a 25 millas"
    )
    static let emptyHumanLineLabel = CivicaText(
        "Talk to someone",
        es: "Habla con alguien"
    )

    /// MA Department of Transitional Assistance assistance line. Free
    /// across the state; used by the empty-state human-path line.
    static let emptyHumanLineNumber = "(877) 382-2363"

    /// "Nothing within 5 miles." / "Nada dentro de 5 millas." Caller
    /// passes the formatted miles value to interpolate.
    static func emptyTitleFormatted(miles: Int, language: CivicaLanguage) -> String {
        emptyTitle.value(in: language).replacingOccurrences(of: "%@", with: "\(miles)")
    }

    static let zipResultsNotice = CivicaText(
        "Showing limited results by ZIP code. Hours and availability can change — call ahead to confirm.",
        es: "Mostrando resultados limitados por código postal. Los horarios y la disponibilidad pueden cambiar — llama antes de ir."
    )

    // MARK: - Transport error state
    //
    // Shown when the directory request fails at the transport layer
    // (DNS failure, no connection, etc.). Same skeleton as the empty
    // state: title, body, primary retry, zip-fallback escape hatch,
    // always-visible human path. Never leave the user on a raw
    // "hostname could not be found" message with no next step.

    static let transportErrorTitle = CivicaText(
        "We can't reach the directory right now.",
        es: "Ahora mismo no podemos consultar el directorio."
    )
    static let transportErrorBody = CivicaText(
        "Check your connection and try again, or use a zip code instead. The phone line below works without internet.",
        es: "Revisa tu conexión e inténtalo de nuevo, o usa un código postal. La línea telefónica funciona sin internet."
    )
    static let transportErrorRetryCTA = CivicaText(
        "Try again",
        es: "Reintentar"
    )

    // MARK: - Eligibility chips (board C, retailer detail polish)
    //
    // Strip of small pills shown on retailer detail + peek sheets
    // that names what the user can actually pay with here. EBT is
    // implied for every retailer row but stated explicitly because
    // unfamiliarity with the term is the #1 reason people who are
    // SNAP-eligible don't realize a store accepts their benefits.

    static let chipEbt = CivicaText(
        "EBT accepted",
        es: "Acepta EBT"
    )
    static let chipWic = CivicaText(
        "WIC accepted",
        es: "Acepta WIC"
    )
    /// HIP matches every $1 spent in SNAP on MA-grown fruits and
    /// vegetables, up to a monthly household cap. Worth ~$40-$80/mo
    /// for many households. MA-specific today.
    static let chipHip = CivicaText(
        "HIP matched",
        es: "Bonificación HIP"
    )

    // MARK: - Retailer pill labels (peek sheet)
    //
    // The peek sheet's service-type pill needs retailer labels too;
    // without these every retailer row falls back to the default
    // serviceTypes.first which is .snapApplicationHelp and renders
    // a misleading "SNAP HELP" badge.

    static let pillSupermarket = CivicaText(
        "GROCERY",
        es: "MERCADO"
    )
    static let pillSmallGrocer = CivicaText(
        "LOCAL GROCER",
        es: "TIENDA LOCAL"
    )
    static let pillFarmersMarket = CivicaText(
        "FARMERS MARKET",
        es: "MERCADO AGRÍCOLA"
    )
    static let pillCoOp = CivicaText(
        "CO-OP",
        es: "COOPERATIVA"
    )
    static let pillRestaurantRMP = CivicaText(
        "MEALS PROGRAM",
        es: "COMIDAS RMP"
    )

    // MARK: - Layer toggle (top of map screen)
    //
    // Three-way pill above the filter bar that selects which slice
    // of the SNAP ecosystem renders. Default state is "Both" so the
    // full ecosystem is the first impression; the user can narrow
    // to either side when they have a specific intent.

    static let layerFindHelp = CivicaText(
        "Find help",
        es: "Buscar ayuda"
    )
    static let layerSpend = CivicaText(
        "Spend EBT",
        es: "Gastar EBT"
    )
    static let layerBoth = CivicaText(
        "Both",
        es: "Ambos"
    )
}
