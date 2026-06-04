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
        es: "Encuentra ayuda cerca de ti",
        zh: "查找附近的帮助",
        vi: "Tìm hỗ trợ gần bạn",
        tl: "Maghanap ng tulong malapit sa iyo"
    )
    static let permissionTitle = CivicaText(
        "Show me places within walking distance.",
        es: "Muéstrame lugares a distancia caminable.",
        zh: "显示步行可达的地点。",
        vi: "Cho tôi xem những địa điểm trong khoảng cách đi bộ.",
        tl: "Ipakita sa akin ang mga lugar na malapit lang lakarin."
    )
    static let permissionBody = CivicaText(
        "Civica will ask iOS for your location next. Before that, here's exactly what we do and don't do with it.",
        es: "Civica le pedirá tu ubicación a iOS a continuación. Antes de eso, aquí está exactamente qué hacemos y qué no hacemos con ella.",
        zh: "Civica 接下来会向 iOS 请求你的位置。在此之前,我们先告诉你我们会用它做什么、不会做什么。",
        vi: "Tiếp theo Civica sẽ hỏi iOS để lấy vị trí của bạn. Trước đó, đây là chính xác những gì chúng tôi làm và không làm với nó.",
        tl: "Susunod na hihingin ng Civica sa iOS ang iyong lokasyon. Bago iyon, narito kung ano talaga ang ginagawa at hindi namin ginagawa rito."
    )

    static let permissionDoEyebrow = CivicaText(
        "What we do",
        es: "Qué hacemos",
        zh: "我们会做什么",
        vi: "Những gì chúng tôi làm",
        tl: "Ang ginagawa namin"
    )
    static let permissionDoBody = CivicaText(
        "Pull a list of nearby places, show them on a map, and sort by distance.",
        es: "Buscamos lugares cercanos, los mostramos en un mapa y los ordenamos por distancia.",
        zh: "查询附近地点的列表,在地图上显示,并按距离排序。",
        vi: "Lấy danh sách các địa điểm gần bạn, hiển thị trên bản đồ và sắp xếp theo khoảng cách.",
        tl: "Kumukuha ng listahan ng mga lugar na malapit, ipinapakita ang mga ito sa mapa, at isinasaayos ayon sa layo."
    )

    static let permissionDontEyebrow = CivicaText(
        "What we don't do",
        es: "Qué no hacemos",
        zh: "我们不会做什么",
        vi: "Những gì chúng tôi không làm",
        tl: "Ang hindi namin ginagawa"
    )
    static let permissionDontBody = CivicaText(
        "Track you over time. Share your location with Massachusetts DTA. Use it for ads.",
        es: "Rastrearte con el tiempo. Compartir tu ubicación con el DTA de Massachusetts. Usarla para anuncios.",
        zh: "长期追踪你。把你的位置分享给 Massachusetts DTA。用于广告。",
        vi: "Theo dõi bạn theo thời gian. Chia sẻ vị trí của bạn với Massachusetts DTA. Dùng nó cho quảng cáo.",
        tl: "Subaybayan ka sa paglipas ng panahon. Ibahagi ang iyong lokasyon sa Massachusetts DTA. Gamitin ito para sa mga ad."
    )

    static let permissionWithoutSharing = CivicaText(
        "You can use the map without sharing — type a zip code instead.",
        es: "Puedes usar el mapa sin compartir tu ubicación — ingresa un código postal en su lugar.",
        zh: "你可以不分享位置也能使用地图 — 输入邮政编码即可。",
        vi: "Bạn có thể dùng bản đồ mà không cần chia sẻ — hãy nhập mã zip thay vào đó.",
        tl: "Pwede mong gamitin ang mapa nang hindi nagbabahagi — mag-type na lang ng zip code."
    )

    static let permissionShareCTA = CivicaText(
        "Share my location",
        es: "Compartir mi ubicación",
        zh: "分享我的位置",
        vi: "Chia sẻ vị trí của tôi",
        tl: "Ibahagi ang aking lokasyon"
    )
    static let permissionZipCTA = CivicaText(
        "Use a zip code instead",
        es: "Usar un código postal",
        zh: "改用邮政编码",
        vi: "Dùng mã zip thay vào đó",
        tl: "Gumamit na lang ng zip code"
    )

    // MARK: - Detail sheet polish (board C)

    static let detailEyebrow = CivicaText(
        "Place details",
        es: "Detalles del lugar",
        zh: "地点详情",
        vi: "Chi tiết địa điểm",
        tl: "Mga detalye ng lugar"
    )
    static let detailReportIncorrect = CivicaText(
        "Report incorrect info",
        es: "Informar de un error",
        zh: "报告信息有误",
        vi: "Báo cáo thông tin sai",
        tl: "I-report ang maling impormasyon"
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
        es: "Dirección",
        zh: "地址",
        vi: "Địa chỉ",
        tl: "Address"
    )
    static let detailLabelPhone = CivicaText(
        "Phone",
        es: "Teléfono",
        zh: "电话",
        vi: "Điện thoại",
        tl: "Telepono"
    )
    static let detailLabelHours = CivicaText(
        "Hours",
        es: "Horario",
        zh: "营业时间",
        vi: "Giờ mở cửa",
        tl: "Oras ng bukas"
    )
    static let detailLabelLanguagesServed = CivicaText(
        "Languages served",
        es: "Idiomas ofrecidos",
        zh: "提供的语言",
        vi: "Ngôn ngữ phục vụ",
        tl: "Mga wikang naseserbisyuhan"
    )
    static let detailLabelNotes = CivicaText(
        "Notes",
        es: "Notas",
        zh: "备注",
        vi: "Ghi chú",
        tl: "Mga tala"
    )
    static let detailLastUpdatedPrefix = CivicaText(
        "Last updated:",
        es: "Última actualización:",
        zh: "最近更新:",
        vi: "Cập nhật lần cuối:",
        tl: "Huling na-update:"
    )
    static let detailDoneButton = CivicaText(
        "Done",
        es: "Listo",
        zh: "完成",
        vi: "Xong",
        tl: "Tapos na"
    )

    // Localized weekday names for the hours block. Keyed by the
    // hoursJson short-form keys (mon, tue, ...) the backend uses.
    static func weekdayLabel(for key: String, language: CivicaLanguage) -> String? {
        switch (key, language) {
        case ("mon", .english): return "Monday"
        case ("mon", .mandarin): return "星期一"
        case ("mon", .spanish): return "Lunes"
        case ("mon", .vietnamese): return "Thứ Hai"
        case ("mon", .tagalog): return "Lunes"
        case ("tue", .english): return "Tuesday"
        case ("tue", .mandarin): return "星期二"
        case ("tue", .spanish): return "Martes"
        case ("tue", .vietnamese): return "Thứ Ba"
        case ("tue", .tagalog): return "Martes"
        case ("wed", .english): return "Wednesday"
        case ("wed", .mandarin): return "星期三"
        case ("wed", .spanish): return "Miércoles"
        case ("wed", .vietnamese): return "Thứ Tư"
        case ("wed", .tagalog): return "Miyerkules"
        case ("thu", .english): return "Thursday"
        case ("thu", .mandarin): return "星期四"
        case ("thu", .spanish): return "Jueves"
        case ("thu", .vietnamese): return "Thứ Năm"
        case ("thu", .tagalog): return "Huwebes"
        case ("fri", .english): return "Friday"
        case ("fri", .mandarin): return "星期五"
        case ("fri", .spanish): return "Viernes"
        case ("fri", .vietnamese): return "Thứ Sáu"
        case ("fri", .tagalog): return "Biyernes"
        case ("sat", .english): return "Saturday"
        case ("sat", .mandarin): return "星期六"
        case ("sat", .spanish): return "Sábado"
        case ("sat", .vietnamese): return "Thứ Bảy"
        case ("sat", .tagalog): return "Sabado"
        case ("sun", .english): return "Sunday"
        case ("sun", .mandarin): return "星期日"
        case ("sun", .spanish): return "Domingo"
        case ("sun", .vietnamese): return "Chủ Nhật"
        case ("sun", .tagalog): return "Linggo"
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
        es: "Unos 2 segundos",
        zh: "大约 2 秒",
        vi: "Khoảng 2 giây",
        tl: "Mga 2 segundo"
    )
    static let loadingTitle = CivicaText(
        "Reading the local directory and food bank list…",
        es: "Consultando el directorio local y la lista de bancos de alimentos…",
        zh: "正在查询本地目录和食物银行列表……",
        vi: "Đang đọc danh bạ địa phương và danh sách ngân hàng thực phẩm…",
        tl: "Binabasa ang lokal na direktoryo at listahan ng food bank…"
    )

    // MARK: - Empty state (board B3)
    //
    // HANDOFF: "Empty state always offers a human path — the phone
    // number, every time." The radius-expand CTA covers rural users
    // who legitimately don't have results within a tight radius.

    static let emptyTitle = CivicaText(
        "Nothing within %@ miles.",
        es: "Nada dentro de %@ millas.",
        zh: "%@ 英里内没有结果。",
        vi: "Không có gì trong vòng %@ dặm.",
        tl: "Walang nakita sa loob ng %@ milya."
    )
    static let emptyBody = CivicaText(
        "Rural areas often need a wider radius. We can also help you over the phone — that works anywhere.",
        es: "Las áreas rurales suelen necesitar un radio más amplio. También podemos ayudarte por teléfono — eso funciona en cualquier lugar.",
        zh: "乡村地区通常需要更大的搜索范围。我们也可以通过电话帮你 — 哪里都能用。",
        vi: "Các khu vực nông thôn thường cần bán kính rộng hơn. Chúng tôi cũng có thể giúp bạn qua điện thoại — cách đó dùng được ở bất cứ đâu.",
        tl: "Madalas na mas malawak na radius ang kailangan sa mga rural na lugar. Pwede ka rin naming tulungan sa telepono — gumagana iyon kahit saan."
    )
    static let emptyExpandCTA = CivicaText(
        "Search 75 miles",
        es: "Buscar a 75 millas",
        zh: "搜索 75 英里",
        vi: "Tìm trong 75 dặm",
        tl: "Maghanap sa 75 milya"
    )
    static let emptyHumanLineLabel = CivicaText(
        "Talk to someone",
        es: "Habla con alguien",
        zh: "与人通话",
        vi: "Nói chuyện với người hỗ trợ",
        tl: "Makipag-usap sa isang tao"
    )

    /// MA Department of Transitional Assistance assistance line. Free
    /// across the state; used by the empty-state human-path line.
    static let emptyHumanLineNumber = "(877) 382-2363"

    /// "Nothing within 5 miles." / "Nada dentro de 5 millas." Caller
    /// passes the formatted miles value to interpolate.
    static func emptyTitleFormatted(miles: Int, language: CivicaLanguage) -> String {
        emptyTitle.value(in: language).replacingOccurrences(of: "%@", with: "\(miles)")
    }

    // MARK: - Transport error state
    //
    // Shown when the directory request fails at the transport layer
    // (DNS failure, no connection, etc.). Same skeleton as the empty
    // state: title, body, primary retry, zip-fallback escape hatch,
    // always-visible human path. Never leave the user on a raw
    // "hostname could not be found" message with no next step.

    static let transportErrorTitle = CivicaText(
        "We can't reach the directory right now.",
        es: "Ahora mismo no podemos consultar el directorio.",
        zh: "我们现在无法连接到目录。",
        vi: "Chúng tôi không thể kết nối tới danh bạ ngay bây giờ.",
        tl: "Hindi namin maabot ang direktoryo sa ngayon."
    )
    static let transportErrorBody = CivicaText(
        "Check your connection and try again, or use a zip code instead. The phone line below works without internet.",
        es: "Revisa tu conexión e inténtalo de nuevo, o usa un código postal. La línea telefónica funciona sin internet.",
        zh: "检查你的网络连接后重试,或改用邮政编码。下面的电话不需要联网也能用。",
        vi: "Hãy kiểm tra kết nối và thử lại, hoặc dùng mã zip thay vào đó. Đường dây điện thoại bên dưới hoạt động mà không cần internet.",
        tl: "Tingnan ang iyong koneksyon at subukan ulit, o gumamit na lang ng zip code. Gumagana ang linya ng telepono sa ibaba kahit walang internet."
    )
    static let transportErrorRetryCTA = CivicaText(
        "Try again",
        es: "Reintentar",
        zh: "重试",
        vi: "Thử lại",
        tl: "Subukan ulit"
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
        es: "Acepta EBT",
        zh: "接受 EBT",
        vi: "Chấp nhận EBT",
        tl: "Tumatanggap ng EBT"
    )
    static let chipWic = CivicaText(
        "WIC accepted",
        es: "Acepta WIC",
        zh: "接受 WIC",
        vi: "Chấp nhận WIC",
        tl: "Tumatanggap ng WIC"
    )
    /// HIP matches every $1 spent in SNAP on MA-grown fruits and
    /// vegetables, up to a monthly household cap. Worth ~$40-$80/mo
    /// for many households. MA-specific today.
    static let chipHip = CivicaText(
        "HIP matched",
        es: "Bonificación HIP",
        zh: "HIP 配套补贴",
        vi: "Được HIP hỗ trợ thêm",
        tl: "May HIP match"
    )

    // MARK: - Retailer pill labels (peek sheet)
    //
    // The peek sheet's service-type pill needs retailer labels too;
    // without these every retailer row falls back to the default
    // serviceTypes.first which is .snapApplicationHelp and renders
    // a misleading "SNAP HELP" badge.

    static let pillSupermarket = CivicaText(
        "GROCERY",
        es: "MERCADO",
        zh: "超市",
        vi: "TẠP HÓA",
        tl: "GROSERYA"
    )
    static let pillSmallGrocer = CivicaText(
        "LOCAL GROCER",
        es: "TIENDA LOCAL",
        zh: "本地杂货店",
        vi: "TIỆM TẠP HÓA ĐỊA PHƯƠNG",
        tl: "LOKAL NA TINDAHAN"
    )
    static let pillFarmersMarket = CivicaText(
        "FARMERS MARKET",
        es: "MERCADO AGRÍCOLA",
        zh: "农夫市集",
        vi: "CHỢ NÔNG SẢN",
        tl: "PALENGKE NG MAGSASAKA"
    )
    static let pillCoOp = CivicaText(
        "CO-OP",
        es: "COOPERATIVA",
        zh: "合作社",
        vi: "HỢP TÁC XÃ",
        tl: "KOOPERATIBA"
    )
    static let pillRestaurantRMP = CivicaText(
        "MEALS PROGRAM",
        es: "COMIDAS RMP",
        zh: "餐食计划",
        vi: "CHƯƠNG TRÌNH BỮA ĂN",
        tl: "PROGRAMA NG PAGKAIN"
    )

    // MARK: - Layer toggle (top of map screen)
    //
    // Three-way pill above the filter bar that selects which slice
    // of the SNAP ecosystem renders. Default state is "Both" so the
    // full ecosystem is the first impression; the user can narrow
    // to either side when they have a specific intent.

    static let layerFindHelp = CivicaText(
        "Find help",
        es: "Buscar ayuda",
        zh: "查找帮助",
        vi: "Tìm hỗ trợ",
        tl: "Maghanap ng tulong"
    )
    static let layerSpend = CivicaText(
        "Spend EBT",
        es: "Gastar EBT",
        zh: "使用 EBT",
        vi: "Dùng EBT",
        tl: "Gamitin ang EBT"
    )
    static let layerBoth = CivicaText(
        "Both",
        es: "Ambos",
        zh: "两者都看",
        vi: "Cả hai",
        tl: "Pareho"
    )

    // MARK: - Layer subtitles (one-line description below the toggle)

    static let layerFindHelpSubtitle = CivicaText(
        "SNAP offices, food pantries & application help",
        es: "Oficinas SNAP, despensas y ayuda para solicitar",
        zh: "SNAP 办公室、食物领取点和申请帮助",
        vi: "Văn phòng SNAP, kho thực phẩm và hỗ trợ nộp đơn",
        tl: "Mga opisina ng SNAP, food pantry at tulong sa aplikasyon"
    )
    static let layerSpendSubtitle = CivicaText(
        "Stores & markets that accept your EBT card",
        es: "Tiendas y mercados que aceptan tu tarjeta EBT",
        zh: "接受你的 EBT 卡的商店和市集",
        vi: "Cửa hàng và chợ chấp nhận thẻ EBT của bạn",
        tl: "Mga tindahan at palengke na tumatanggap ng iyong EBT card"
    )
    static let layerBothSubtitle = CivicaText(
        "Apply for benefits and find places to use them",
        es: "Solicita beneficios y encuentra dónde usarlos",
        zh: "申请福利,并找到可以使用福利的地方",
        vi: "Nộp đơn xin trợ cấp và tìm nơi để sử dụng chúng",
        tl: "Mag-apply ng benepisyo at maghanap ng mga lugar para gamitin ang mga ito"
    )
}