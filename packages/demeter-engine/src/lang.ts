// Answer languages — one registry, so adding a language is one entry here
// instead of eight `if (lang === "es")` branches scattered across retrieval,
// the orchestrator, the trailer, certainty, and freshness.
//
// That scattering is exactly why this file exists: Spanish was added inline in
// each of those files, and the second language would have doubled every branch
// while making it easy to add a language the engine could not actually honor —
// a picker offering Vietnamese while retrieval silently ran the English path.
//
// WHAT STAYS ENGLISH, ALWAYS:
//   - the corpus and its embedding descriptors (7 CFR is published in English);
//   - citation verification, which runs on the English retrieval BEFORE the
//     answer is composed, so the "0 fabricated citations" property never
//     depends on translated text;
//   - the citation strings themselves ("7 CFR 273.9(d)(6)"), verbatim.
// Only the ANSWER and the surrounding chrome localize. The numeric-equivalence
// gate then applies to every language (orchestrator.ts), which is what keeps a
// translated answer from inventing a dollar figure.

export const ANSWER_LANGS = ["en", "es", "vi", "zh"] as const;
export type AnswerLang = (typeof ANSWER_LANGS)[number];

export function isAnswerLang(v: unknown): v is AnswerLang {
  return typeof v === "string" && (ANSWER_LANGS as readonly string[]).includes(v);
}

/** Native names, for a picker that should never label a language in English. */
export const LANG_NATIVE_NAME: Record<AnswerLang, string> = {
  en: "English",
  es: "Español",
  vi: "Tiếng Việt",
  zh: "中文",
};

/** BCP-47 tags for `lang=` attributes and `Intl` consumers. */
export const LANG_TAG: Record<AnswerLang, string> = {
  en: "en",
  es: "es",
  vi: "vi",
  zh: "zh-Hans",
};

// ── Retrieval glossaries ────────────────────────────────────────────────────
// The corpus is English, so a non-English query is expanded with the English
// SNAP terms it implies BEFORE scoring. This changes only what RETRIEVAL sees;
// the user's question, the answer language, and the audit record are untouched.
//
// Note for CJK: Chinese has no word boundaries, so `\b` is meaningless there —
// these are plain substring patterns on purpose. (The `\b` anchors in the
// Spanish list are load-bearing for a different reason: bare /auto/ matched
// inside "autorización".)
type Glossary = Array<[RegExp, string]>;

const ES_GLOSSARY: Glossary = [
  // Gap-tolerant for the same reason as the VI entry below (#685): "asignación
  // máxima" happens to be contiguous in the gold question, but "asignación de
  // CalFresh máxima" or "beneficio mensual máximo" would have silently missed.
  // Fixed here too rather than waiting for the eval to catch it in Spanish.
  [
    /asignaci[oó]n(?:\s+\S+){0,3}\s*m[aá]xima|beneficio(?:\s+\S+){0,3}\s*m[aá]ximo/i,
    "maximum allotment",
  ],
  [/emergencia|urgente|r[aá]pido|cu[aá]nto tarda/i, "expedited service emergency seven days"],
  [/entrevista/i, "interview"],
  [/tel[eé]fono/i, "phone telephone"],
  [/ingresos?|gana|salario|sueldo/i, "income limit gross net"],
  [/estatus migratorio|inmigraci[oó]n|carga p[uú]blica/i, "public charge immigration status"],
  [/estudiantes?|universidad|colegio/i, "student eligibility enrollment"],
  [/\bcarro|\bcoche|\bauto\b|autom[oó]vil|veh[ií]culo/i, "vehicle car resource asset"],
  [/robar|robaron|robo|skimming/i, "stolen benefits replacement skimming"],
  [/tarjeta|ebt/i, "EBT card"],
  [/requisitos de trabajo|trabajar|empleo/i, "work requirements ABAWD employment"],
  [/deducci[oó]n|deducciones/i, "deduction"],
  [/renta|alquiler|vivienda|hipoteca/i, "shelter rent housing"],
  [/servicios (p[uú]blicos|b[aá]sicos)|luz|utilidades/i, "utility allowance"],
  [/recertificaci[oó]n|renovar|renovaci[oó]n/i, "recertification renewal"],
  [/audiencia|apelar|apelaci[oó]n/i, "fair hearing appeal"],
  [/reponen|reemplazo|reembolso/i, "replacement"],
  [/seguro social|n[uú]mero de seguro/i, "social security number SSN"],
  [/califica|calific[oa]|elegib(le|ilidad)/i, "eligibility qualify"],
  [/hogar|familia|personas/i, "household size"],
  [/mayores|ancian[oa]s?|discapacidad|discapacitad[oa]/i, "elderly disabled"],
  [/solicitar|solicitud|aplicar|aplicaci[oó]n/i, "application apply"],
  [/hijos?|ni[ñn][oa]s?/i, "children household"],
  [/comida|alimentos|hambre/i, "food emergency"],
];

const VI_GLOSSARY: Glossary = [
  [/phiếu thực phẩm|trợ cấp thực phẩm|tem phiếu/i, "SNAP food stamps benefits"],
  // GAP-TOLERANT (#685). This was /trợ cấp tối đa/ — a contiguous phrase — and
  // it silently failed on "Trợ cấp SNAP tối đa", where the programme name sits
  // between the two terms. Nothing else in the glossary matched either, so the
  // query got NO expansion and the raw Vietnamese embedded next to 273.8
  // (resources) instead of 273.10 (allotments): a correct, correctly-cited
  // answer that the reader still sees marked uncertain.
  //
  // Allowing a few intervening tokens costs nothing — the terms still both have
  // to be present, in order — and covers the natural way people name a benefit
  // mid-phrase ("trợ cấp SNAP tối đa", "trợ cấp hàng tháng tối đa").
  [/trợ cấp(?:\s+\S+){0,3}\s*tối đa|mức tối đa/i, "maximum allotment"],
  [/khẩn cấp|gấp|nhanh|bao lâu/i, "expedited service emergency seven days"],
  [/phỏng vấn/i, "interview"],
  [/điện thoại/i, "phone telephone"],
  [/thu nhập|lương|kiếm được/i, "income limit gross net"],
  [/nhập cư|di trú|gánh nặng x[aã] hội|thẻ xanh/i, "public charge immigration status"],
  [/sinh viên|học sinh|đại học/i, "student eligibility enrollment"],
  [/xe hơi|xe ô ?tô|ô ?tô|phương tiện/i, "vehicle car resource asset"],
  [/bị (đánh cắp|mất trộm)|trộm|đánh cắp/i, "stolen benefits replacement skimming"],
  [/thẻ ebt|thẻ/i, "EBT card"],
  [/yêu cầu làm việc|đi làm|việc làm|thất nghiệp/i, "work requirements ABAWD employment"],
  [/khấu trừ/i, "deduction"],
  [/tiền thuê|thuê nhà|nhà ở|thế chấp/i, "shelter rent housing"],
  [/điện nước|tiện ích|hóa đơn điện/i, "utility allowance"],
  [/tái chứng nhận|gia hạn|cấp lại/i, "recertification renewal"],
  [/kháng cáo|điều trần|khiếu nại/i, "fair hearing appeal"],
  [/số an sinh x[aã] hội|ssn/i, "social security number SSN"],
  [/đủ điều kiện|hội đủ|điều kiện/i, "eligibility qualify"],
  [/hộ gia đình|gia đình|bao nhiêu người/i, "household size"],
  [/người (cao tuổi|già)|khuyết tật|tàn tật/i, "elderly disabled"],
  [/nộp đơn|đơn xin|đăng ký/i, "application apply"],
  [/trẻ em|con cái|con nhỏ/i, "children household"],
  [/thức ăn|thực phẩm|đói/i, "food emergency"],
];

const ZH_GLOSSARY: Glossary = [
  [/食品券|粮食券|营养补充|食物补助/, "SNAP food stamps benefits"],
  [/最高(补助|金额)|最多能拿/, "maximum allotment"],
  [/紧急|加急|多久|多快/, "expedited service emergency seven days"],
  [/面谈|面试|访谈/, "interview"],
  [/电话/, "phone telephone"],
  [/收入|工资|挣/, "income limit gross net"],
  [/移民身份|公共负担|绿卡/, "public charge immigration status"],
  [/学生|大学|上学/, "student eligibility enrollment"],
  [/汽车|车辆|有车/, "vehicle car resource asset"],
  [/被盗|盗刷|偷/, "stolen benefits replacement skimming"],
  [/ebt|卡/i, "EBT card"],
  [/工作要求|工作|就业|失业/, "work requirements ABAWD employment"],
  [/扣除|抵扣/, "deduction"],
  [/房租|租金|住房|房贷/, "shelter rent housing"],
  [/水电|公用事业|电费/, "utility allowance"],
  [/重新认证|续期|复审/, "recertification renewal"],
  [/上诉|听证|申诉/, "fair hearing appeal"],
  [/社会安全号|社安号/, "social security number SSN"],
  [/资格|符合条件|能不能领/, "eligibility qualify"],
  [/家庭|住户|几口人/, "household size"],
  [/老年人|年长|残疾/, "elderly disabled"],
  [/申请|递交/, "application apply"],
  [/孩子|儿童|小孩/, "children household"],
  [/食物|吃的|饿/, "food emergency"],
];

const GLOSSARIES: Record<AnswerLang, Glossary> = {
  en: [],
  es: ES_GLOSSARY,
  vi: VI_GLOSSARY,
  zh: ZH_GLOSSARY,
};

/** Expand a non-English query with the English SNAP terms it implies.
 *  Returns the query unchanged for English, or when nothing matches. */
export function expandQuery(query: string, lang: AnswerLang = "en"): string {
  const extra: string[] = [];
  for (const [re, en] of GLOSSARIES[lang]) {
    if (re.test(query)) extra.push(en);
  }
  return extra.length ? `${query}\n${extra.join(" ")}` : query;
}

// ── Answer-language instruction ─────────────────────────────────────────────
// Appended as its own system block when the answer is not English. Every
// version carries the same two hard constraints, because both are correctness
// rather than style: citations stay in their original form, and numbers are
// copied rather than re-expressed (the numeric gate enforces the second, but
// telling the model up front means fewer retry cycles).
const ANSWER_INSTRUCTION: Record<Exclude<AnswerLang, "en">, string> = {
  es: "Responde COMPLETAMENTE en español, con calidez y claridad. Mantén las citas legales textualmente en su forma original (p. ej. '7 CFR 273.9') y NO traduzcas los números — cada cantidad en dólares y porcentaje debe copiarse exactamente de las fuentes provistas.",
  vi: "Trả lời HOÀN TOÀN bằng tiếng Việt, rõ ràng và gần gũi. Giữ nguyên các trích dẫn pháp lý theo đúng dạng gốc (ví dụ '7 CFR 273.9') và KHÔNG dịch các con số — mọi số tiền đô la và phần trăm phải được sao chép chính xác từ nguồn được cung cấp.",
  zh: "请完全用简体中文回答，语气清楚、亲切。法律引用必须保持原文形式（例如 '7 CFR 273.9'），并且不要翻译或改写数字——所有美元金额和百分比都必须与所提供的来源完全一致。",
};

/** The system block that sets the answer language. Null for English. */
export function answerInstruction(lang: AnswerLang): string | null {
  return lang === "en" ? null : ANSWER_INSTRUCTION[lang];
}

// ── Degrade wrapper ─────────────────────────────────────────────────────────
// What a reader is told when the citation verifier refuses an answer twice.
//
// The guardrail itself is working when this fires: it has stopped the model
// inventing a figure it could not source. What used to happen NEXT was the
// failure — the reader got an internal-sounding apology followed by several
// hundred words of raw regulation. Someone who typed "four people, $4k, Boston"
// received 7 CFR 273.8 on vehicle resource exclusions and a "NOT recognized"
// validation log.
//
// So this no longer dumps the retrieved text. It says plainly what could not be
// confirmed, says what actually decides the answer WITHOUT naming a figure (the
// whole point is that we could not verify one), and hands over. The citation
// trailer still carries the links, so "read it yourself" survives — as a link,
// which is what that offer should always have been.
//
// It must state NO numbers. A static string cannot know the household size or
// the state, and putting a plausible threshold here would be exactly the
// fabrication the gate just prevented.
const DEGRADE: Record<AnswerLang, { lead: string; tail: string }> = {
  en: {
    lead: "I could not check this one against the rules I have, so I am not going to give you a figure I cannot stand behind.",
    tail: "What decides it is your household size, your income after the deductions you are entitled to, and your own state's limit — which is higher than the federal one in many states. Your state SNAP agency can give you the exact number for a household your size. You can also ask me something narrower and I will try again.",
  },
  es: {
    lead: "No pude verificar esto con las reglas que tengo, así que no te voy a dar una cifra que no pueda respaldar.",
    tail: "Lo que lo decide es el tamaño de tu hogar, tus ingresos después de las deducciones a las que tienes derecho, y el límite de tu propio estado — que en muchos estados es más alto que el federal. La agencia de SNAP de tu estado puede darte la cifra exacta para un hogar de tu tamaño. También puedes preguntarme algo más específico y lo intentaré de nuevo.",
  },
  vi: {
    lead: "Tôi không kiểm chứng được điều này với các quy định tôi có, nên tôi sẽ không đưa ra con số mà mình không thể bảo đảm.",
    tail: "Điều quyết định là số người trong hộ, thu nhập của bạn sau khi trừ các khoản bạn được hưởng, và mức giới hạn của chính tiểu bang bạn — ở nhiều bang mức này cao hơn mức liên bang. Cơ quan SNAP của tiểu bang có thể cho bạn con số chính xác cho hộ có quy mô như bạn. Bạn cũng có thể hỏi tôi điều gì cụ thể hơn và tôi sẽ thử lại.",
  },
  zh: {
    lead: "这一条我无法用手上的法规核实，所以我不会给您一个自己无法负责的数字。",
    tail: "真正起作用的是您的家庭人数、扣除您应得项目后的收入，以及您所在州自己的上限——在许多州，这个上限高于联邦标准。您所在州的 SNAP 机构可以告诉您符合您家庭规模的确切数字。您也可以问我更具体的问题，我再试一次。",
  },
};

export function degradeWrapper(lang: AnswerLang): { lead: string; tail: string } {
  return DEGRADE[lang];
}

// ── Chrome copy: citation trailer + freshness footer ────────────────────────
export interface ChromeCopy {
  citationHeading: string;
  verifiedNote: string;
  unrecognizedNote: string;
  sourcesAsOf: string;
  locale: string;
}

export const CHROME: Record<AnswerLang, ChromeCopy> = {
  en: {
    citationHeading: "Citation check",
    verifiedNote: "quoted from the retrieved sources",
    unrecognizedNote: "not found in the retrieved sources — treat as unverified",
    sourcesAsOf: "Sources as of",
    locale: "en-US",
  },
  es: {
    citationHeading: "Verificación de citas",
    verifiedNote: "citado de las fuentes recuperadas",
    unrecognizedNote: "no se encontró en las fuentes recuperadas — trátalo como no verificado",
    sourcesAsOf: "Fuentes al",
    locale: "es-ES",
  },
  vi: {
    citationHeading: "Kiểm tra trích dẫn",
    verifiedNote: "được trích từ các nguồn đã truy xuất",
    unrecognizedNote: "không tìm thấy trong các nguồn đã truy xuất — hãy coi là chưa được xác minh",
    sourcesAsOf: "Nguồn tính đến",
    locale: "vi-VN",
  },
  zh: {
    citationHeading: "引用核对",
    verifiedNote: "引自检索到的来源",
    unrecognizedNote: "未在检索到的来源中找到——请视为未经核实",
    sourcesAsOf: "来源截至",
    locale: "zh-CN",
  },
};
