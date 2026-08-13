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
    lead: "I can't put a number on this one — I don't have the figure in front of me and I'm not going to guess at yours.",
    tail: "Here is what I can do. The things that decide it are your household size, your income after the deductions you're entitled to, and your own state's limit, which is higher than the federal one in many states. I can walk you through what the application asks for, which documents to have ready, and how the interview works — and the caseworker who runs your actual numbers will do it in minutes with those in hand. Tell me where you'd like to pick up.",
  },
  es: {
    lead: "No puedo darte una cifra en este caso — no la tengo delante y no voy a adivinar la tuya.",
    tail: "Esto sí puedo hacerlo. Lo que decide el resultado es el tamaño de tu hogar, tus ingresos después de las deducciones a las que tienes derecho, y el límite de tu estado, que en muchos estados es más alto que el federal. Puedo explicarte qué pide la solicitud, qué documentos conviene tener listos y cómo funciona la entrevista — y con eso en la mano, la persona que calcule tus números reales lo hará en minutos. Dime por dónde quieres seguir.",
  },
  vi: {
    lead: "Tôi chưa thể đưa ra con số cho trường hợp này — tôi không có sẵn con số đó và cũng không muốn đoán bừa.",
    tail: "Nhưng đây là những gì tôi làm được. Quyết định kết quả là số người trong hộ, thu nhập sau khi trừ các khoản bạn được hưởng, và mức giới hạn của tiểu bang bạn, ở nhiều bang cao hơn mức liên bang. Tôi có thể hướng dẫn bạn đơn hỏi những gì, cần chuẩn bị giấy tờ nào, và buổi phỏng vấn ra sao — có sẵn những thứ đó, người xét hồ sơ sẽ tính ra con số thật chỉ trong vài phút. Bạn muốn bắt đầu từ đâu?",
  },
  zh: {
    lead: "这一条我给不了具体数字——我手上没有这个数，也不想凭空猜您的情况。",
    tail: "但我能做的是这些。真正决定结果的是您的家庭人数、扣除应得项目后的收入，以及您所在州的上限（许多州高于联邦标准）。我可以带您看申请表会问什么、需要准备哪些材料、面谈是怎么进行的——把这些准备好，负责核算的人几分钟就能算出真实数字。您想从哪一部分开始？",
  },
};

// SAYING THE SAME THING TWICE IS A DIFFERENT FAILURE FROM SAYING IT ONCE.
//
// A real conversation received the paragraph above five consecutive times. The
// person kept answering it — they gave their state, their household size, their
// income, their rent — and each time got back a sentence telling them to ask
// something narrower, worded identically. By the third one it no longer reads
// as care about accuracy; it reads as a machine that has stopped listening, and
// the honest thing at that point is to say so and hand over properly rather
// than invite a fourth attempt at a door that is not opening.
const DEGRADE_AGAIN: Record<AnswerLang, { lead: string; tail: string }> = {
  en: {
    lead: "I'm still stuck on the number, and you've given me everything I asked for — so the problem is mine, not yours.",
    tail: "Let's not spend more of your time on it. Two things will actually move you forward. Your state agency can run these exact numbers on the spot, and they will, so it's worth the call. And in the meantime I can get you ready for it: what the form asks, which documents to gather, what happens at the interview. Say the word and we'll start on that.",
  },
  es: {
    lead: "Sigo atascado con la cifra, y tú ya me diste todo lo que te pedí — así que el problema es mío, no tuyo.",
    tail: "No gastemos más de tu tiempo en esto. Dos cosas sí te hacen avanzar. La agencia de tu estado puede calcular estos números en el momento, y lo hará, así que vale la pena llamar. Y mientras tanto puedo dejarte listo: qué pide el formulario, qué documentos reunir, qué pasa en la entrevista. Dime y empezamos por ahí.",
  },
  vi: {
    lead: "Tôi vẫn tắc ở con số, mà bạn thì đã cung cấp đủ mọi thứ tôi hỏi — nên đây là hạn chế của tôi, không phải của bạn.",
    tail: "Đừng để việc này lấy thêm thời gian của bạn nữa. Có hai việc thực sự giúp bạn tiến lên. Cơ quan tiểu bang có thể tính ngay những con số này, nên rất đáng để gọi. Và trong lúc đó tôi có thể giúp bạn chuẩn bị sẵn: đơn hỏi gì, cần gom giấy tờ nào, buổi phỏng vấn ra sao. Bạn nói một tiếng là chúng ta bắt đầu.",
  },
  zh: {
    lead: "这个数字我还是卡住了，而您已经把我问的都告诉我了——所以是我这边的问题，不是您的。",
    tail: "别再让这件事耽误您的时间。有两件事真的能让您往前走。您所在州的机构当场就能算出这些数字，值得打这个电话。在那之前我可以帮您把该准备的准备好：表格会问什么、要收集哪些材料、面谈怎么进行。您说一声，我们就从这里开始。",
  },
};

/** `repeated` — has this conversation already degraded at least once? */
export function degradeWrapper(lang: AnswerLang, repeated = false): { lead: string; tail: string } {
  return (repeated ? DEGRADE_AGAIN : DEGRADE)[lang];
}

/** The lead sentences, for spotting a prior degrade in a transcript. */
export function degradeLeads(lang: AnswerLang): string[] {
  return [DEGRADE[lang].lead, DEGRADE_AGAIN[lang].lead];
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
