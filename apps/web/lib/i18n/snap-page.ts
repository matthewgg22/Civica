// Explainer copy for the entry page, per language.
//
// Pairs with FORM_QUESTION_I18N in the engine (which carries the FAQ answers,
// stored next to their English source so they cannot drift). Together they are
// what makes /es, /vi and /zh real localized pages rather than the English page
// under a different URL — the latter reads to a search engine as duplicate
// content in the wrong language, which is worse than not publishing it.
//
// English here is byte-identical to what the un-prefixed page already renders,
// so adding the localized routes changes nothing about the English page.
//
// ⚠️ NOT NATIVE-REVIEWED — same caveat as the engine's translation file. These
// are accurate to the English source, but a speaker who knows SNAP should read
// them before this is treated as final.

import type { AnswerLang } from "@civica/demeter-engine/packs";

export interface Pair {
  t: string;
  d: string;
}

export interface PageCopy {
  /** THE ORIENTATION BAR — the page's h1 and the first thing anyone reads.
   *
   *  It exists because the page used to open with an h2 about SNAP and only
   *  named the product 120 words later, inside the chat card. The markup said
   *  it out loud: an <h2> preceded the <h1> in document order, so the page's
   *  own structure claimed to be a SNAP explainer that happened to contain a
   *  chatbot.
   *
   *  Two statements, ~45 words total: what Demeter is, then what SNAP is. The
   *  first leads because it is the thing someone remembers — every other tool
   *  in this category returns an estimate; this one hands you the rule. */
  h1: string;
  productLede: string;
  snapLine: string;
  eyebrow: string;
  h2: string;
  lede: string;
  trust: Pair[];
  /** Heading for the trust rows once they moved below the chat. They used to be
   *  an unlabelled <aside> in the lede, borrowing howH2 for its aria-label —
   *  which, as a real section heading, printed "How Demeter answers" twice on
   *  the page. Distinct heading, and it names what the four rows actually say. */
  trustH2: string;
  /** What SNAP IS, before the rules that decide who gets it. The page explained
   *  eligibility in detail to people who had not been told what the program
   *  does — one line in the orientation bar was carrying all of it. */
  snapH2: string;
  snapBody: string;
  snapFacts: Pair[];
  /** Links to the official program. Demeter is not the government, and the
   *  place where we point at USDA is exactly where that has to be said. */
  officialH3: string;
  officialNote: string;
  officialFns: string;
  officialDirectory: string;
  /** The Beeck Center's finding, which is the strongest outside evidence for
   *  why this product cites its sources instead of just answering. */
  evidenceH2: string;
  evidenceBody: string;
  evidenceQuote: string;
  evidenceAttrib: string;
  evidenceReport: string;
  evidenceDemoDay: string;
  decidesH2: string;
  decidesBody: string;
  defs: Pair[];
  whyHardH2: string;
  cards: Pair[];
  howH2: string;
  steps: Pair[];
  faqH2: string;
  faqBody: string;
  /** The FAQ question form. Shared with the JSON-LD so both say the same thing. */
  faqHeading: (phrase: string) => string;
  /** Link from the chat page to /questions, where the form-question cards and
   *  the "why this is hard" section now live. Moved, not deleted — the words
   *  are still server-rendered and indexable, on a page that is ABOUT them
   *  rather than buried under a chat box. */
  questionsLink: string;
  questionsIntro: string;
  questionsBack: string;
  /** The graphite footer. `footerDisclaimer` is the load-bearing one: it is the
   *  last thing anyone reads before acting on an answer, so it says plainly
   *  that the agency decides, not us. */
  /** One line under the wordmark. "Demeter" is a Greek harvest goddess; on its
   *  own it tells a first-time visitor nothing about SNAP. */
  brandSubtitle: string;
  navAsk: string;
  navQuestions: string;
  footerPrivacy: string;
  footerSupporters: string;
  footerDisclaimer: string;
  footerOrg: string;
  /** The coverage map's side panel. */
  map: {
    prompt: string;
    agency: string;
    apply: string;
    federalNote: string;
    verified: string;
  };
  agenciesH2: string;
  agenciesBody: string;
  agenciesNote: string;
  verifyLink: string;
}

const en: PageCopy = {
  h1: "Ask about SNAP and get the actual rule.",
  productLede:
    "Demeter answers in plain language and quotes the federal regulation behind every claim — plus your state’s own manual, where we have verified one.",
  snapLine:
    "SNAP is monthly money for groceries, paid onto an EBT card. Formerly called food stamps. Applying is free.",
  eyebrow: "Supplemental Nutrition Assistance Program",
  h2: "SNAP is monthly money for groceries, paid onto a card.",
  lede:
    "Formerly called food stamps, SNAP is a federal program run by each state. If you qualify, benefits arrive once a month on an EBT card you use like a debit card at most grocery stores. Applying is free, and you can apply whether or not you are working.",
  trust: [
    { t: "Free, no account", d: "Ask as many questions as you need. Nothing to sign up for." },
    {
      t: "Every claim cited",
      d: "Answers quote the federal regulation, and the state manual where we have verified one.",
    },
    { t: "States verified", d: "each checked against that agency’s own published rules before going live." },
    {
      t: "Everywhere else",
      d: "Federal rules still answer. Figures that vary by state are deferred to your agency rather than guessed.",
    },
  ],
  trustH2: "Free, cited, and clear about its limits",
  snapH2: "What SNAP is",
  snapBody:
    "SNAP is the country’s largest food assistance program. The federal government pays for the benefit and writes the baseline rules; your state takes the application and decides your case. If you qualify, an amount arrives each month on an EBT card you use like a debit card.",
  snapFacts: [
    {
      t: "Who pays, who decides",
      d: "USDA’s Food and Nutrition Service funds the benefit and sets the federal rules. Your state agency takes the application and decides your case.",
    },
    {
      t: "How it reaches you",
      d: "A monthly amount on an EBT card, used like a debit card at most grocery stores and many farmers markets.",
    },
    {
      t: "What it buys",
      d: "Groceries to take home and prepare, and seeds and plants that grow food. Not alcohol, household goods, or hot food made to eat right away — though some states let certain households buy restaurant meals.",
    },
    {
      t: "What applying costs",
      d: "Nothing. Applying is free, and one household’s benefit does not come out of anyone else’s.",
    },
  ],
  officialH3: "Official program information",
  officialNote:
    "Demeter is not a government agency, and is not affiliated with or endorsed by USDA. For the official program and to find your own state agency:",
  officialFns: "USDA Food and Nutrition Service — SNAP",
  officialDirectory: "SNAP state directory — find your agency",
  evidenceH2: "Why we show you the rule instead of just answering",
  evidenceBody:
    "Georgetown University’s Beeck Center ran twelve experiments on turning benefits policy into working code with AI. Their conclusion was not that it cannot be done — it was that models handling genuinely complex policy logic still need outside knowledge and a person checking the result. A language model is fluent enough to be wrong convincingly, and benefits rules are exactly where that costs someone money. So Demeter quotes the regulation behind every claim and links it. You do not have to trust the answer; you can read what it came from.",
  evidenceQuote: "still require external knowledge and human oversight",
  evidenceAttrib:
    "Beeck Center for Social Impact + Innovation, Georgetown University — AI-Powered Rules as Code, February 2025",
  evidenceReport: "Read the report",
  evidenceDemoDay: "The twelve Policy2Code experiments",
  decidesH2: "What actually decides whether you qualify",
  decidesBody:
    "Not your income alone — that is the most common reason people who qualify never apply. Eligibility turns on what is left after the deductions you are entitled to, and on a short list of category rules.",
  defs: [
    {
      t: "Household size",
      d: "Who buys and prepares food together, which is not always who lives together. Roommates who shop separately are usually separate households.",
    },
    {
      t: "Income, after deductions",
      d: "Rent, utilities, childcare, child support you pay, and — for members who are 60+ or disabled — medical costs above a set floor all come off before the limit is applied.",
    },
    {
      t: "Category rules",
      d: "Students, non-citizens, and adults without dependents each have their own rules, and most have exemptions that are missed more often than they are applied.",
    },
    {
      t: "Your state",
      d: "Federal rules set the floor; each state adds its own manual, its own utility allowances, and in some states its own asset test.",
    },
  ],
  whyHardH2: "Why a straight answer is hard to find",
  cards: [
    {
      t: "The rule is real but buried",
      d: "Most eligibility questions have one correct answer, sitting somewhere in a few hundred pages of federal regulation and a state manual on top of it.",
    },
    {
      t: "Old numbers keep circulating",
      d: "Limits change every October. Advice passed down from a few years ago turns people away who would qualify today.",
    },
    {
      t: "Deductions decide it",
      d: "Miss one deduction you are entitled to and a household looks over the limit when it is not. This is the single most common way an eligible household gets the wrong answer.",
    },
    {
      t: "Asking feels risky",
      d: "People worry a wrong answer on a form will be held against them, so they never file. Knowing what a question is actually asking is usually what gets someone past it.",
    },
  ],
  howH2: "How Demeter answers",
  steps: [
    {
      t: "Every claim carries its rule",
      d: "Answers cite the federal regulation and, in verified states, that state’s own manual — linked, so you can read the rule yourself or show it to a caseworker who disagrees.",
    },
    {
      t: "It says when it is not sure",
      d: "Each answer is marked certain or uncertain, and says why. When the sources retrieved do not cover your question, it says so instead of guessing a number.",
    },
    {
      t: "State packs are checked adversarially",
      d: "Before a state goes live, its policy pack is cross-checked against the state’s own primary sources and run through a gate whose only job is to prove the draft wrong.",
    },
  ],
  faqH2: "What the application is actually asking",
  faqBody:
    "These are the questions people get stuck on — the phrasing is legal, not conversational. Here is what each one means and the rule behind it.",
  faqHeading: (p) => `What does "${p}" mean on a SNAP application?`,
  questionsLink: "What the application is actually asking",
  questionsIntro:
    "People do not arrive with a policy question. They arrive stuck on one line of a form. Here is what each line means and the rule that decides it.",
  questionsBack: "Ask Demeter about your own situation",
  brandSubtitle: "SNAP Enrollment and Eligibility Assistance",
  navAsk: "Ask Demeter",
  navQuestions: "Application questions",
  footerPrivacy: "Privacy",
  footerSupporters: "Supporters",
  footerDisclaimer:
    "Demeter gives information, not legal advice, and does not decide your case. Your state agency does. Always confirm before acting on an answer.",
  footerOrg: "Demeter AI is built by Civica.",
  map: {
    prompt: "Pick a highlighted state to see who runs it there.",
    agency: "Administered by",
    apply: "Apply at",
    federalNote:
      "States without a verified pack are still answered from the federal rules. The map shows where we have also checked the state's own manual.",
    verified: "Verified",
  },
  agenciesH2: "Your state runs the program — here is who",
  agenciesBody:
    "Demeter never decides your case. Your state agency does. These are the agencies whose own published rules the verified answers are built from, and where you actually apply.",
  agenciesNote:
    "Not listed? Demeter still answers at the federal floor, and points you to your own state agency for figures that vary by state.",
  verifyLink: "See how we verify",
};

const es: PageCopy = {
  h1: "Pregunta sobre SNAP y obtén la regla exacta.",
  productLede:
    "Demeter responde en lenguaje sencillo y cita el reglamento federal detrás de cada afirmación — y el manual de tu estado, donde hemos verificado uno.",
  snapLine:
    "SNAP es dinero mensual para comida, depositado en una tarjeta EBT. Antes llamado cupones de alimentos. Solicitar es gratis.",
  eyebrow: "Programa de Asistencia Nutricional Suplementaria",
  h2: "SNAP es dinero mensual para comida, depositado en una tarjeta.",
  lede:
    "Antes llamado cupones de alimentos, SNAP es un programa federal que administra cada estado. Si calificas, el beneficio llega una vez al mes en una tarjeta EBT que usas como tarjeta de débito en la mayoría de los supermercados. Solicitar es gratis, y puedes solicitar trabajes o no.",
  trust: [
    { t: "Gratis, sin cuenta", d: "Haz todas las preguntas que necesites. No hay que registrarse." },
    {
      t: "Cada afirmación con su fuente",
      d: "Las respuestas citan la regulación federal, y el manual del estado donde hemos verificado uno.",
    },
    { t: "Estados verificados", d: "cada uno contrastado con las reglas publicadas por esa agencia antes de publicarse." },
    {
      t: "En los demás estados",
      d: "Las reglas federales siguen respondiendo. Las cifras que varían por estado se remiten a tu agencia en vez de adivinarse.",
    },
  ],
  trustH2: "Gratis, con fuentes, y claro sobre sus límites",
  snapH2: "Qué es SNAP",
  snapBody:
    "SNAP es el programa de asistencia alimentaria más grande del país. El gobierno federal paga el beneficio y fija las reglas básicas; tu estado recibe la solicitud y decide tu caso. Si calificas, cada mes llega una cantidad a una tarjeta EBT que usas como una tarjeta de débito.",
  snapFacts: [
    {
      t: "Quién paga y quién decide",
      d: "El Servicio de Alimentos y Nutrición del USDA financia el beneficio y fija las reglas federales. La agencia de tu estado recibe la solicitud y decide tu caso.",
    },
    {
      t: "Cómo te llega",
      d: "Una cantidad mensual en una tarjeta EBT, que se usa como tarjeta de débito en la mayoría de los supermercados y en muchos mercados de agricultores.",
    },
    {
      t: "Para qué sirve",
      d: "Alimentos para llevar a casa y preparar, y semillas y plantas que producen alimentos. No alcohol, artículos del hogar ni comida caliente preparada para comer de inmediato — aunque algunos estados permiten que ciertos hogares compren comidas en restaurantes.",
    },
    {
      t: "Cuánto cuesta solicitar",
      d: "Nada. Solicitar es gratis, y el beneficio de un hogar no se le quita a ningún otro.",
    },
  ],
  officialH3: "Información oficial del programa",
  officialNote:
    "Demeter no es una agencia del gobierno, ni está afiliado al USDA ni respaldado por él. Para la información oficial del programa y para encontrar la agencia de tu estado:",
  officialFns: "Servicio de Alimentos y Nutrición del USDA — SNAP",
  officialDirectory: "Directorio estatal de SNAP — encuentra tu agencia",
  evidenceH2: "Por qué te mostramos la regla en vez de solo responder",
  evidenceBody:
    "El Beeck Center de la Universidad de Georgetown realizó doce experimentos para convertir la política de beneficios en código funcional con inteligencia artificial. Su conclusión no fue que sea imposible, sino que, ante una lógica de política realmente compleja, los modelos siguen necesitando conocimiento externo y una persona que revise el resultado. Un modelo de lenguaje tiene la fluidez suficiente para equivocarse de forma convincente, y las reglas de beneficios son justo donde ese error le cuesta dinero a alguien. Por eso Demeter cita la regulación detrás de cada afirmación y la enlaza. No tienes que confiar en la respuesta: puedes leer de dónde salió.",
  evidenceQuote: "todavía requieren conocimiento externo y supervisión humana",
  evidenceAttrib:
    "Beeck Center for Social Impact + Innovation, Georgetown University — AI-Powered Rules as Code, febrero de 2025",
  evidenceReport: "Leer el informe",
  evidenceDemoDay: "Los doce experimentos de Policy2Code",
  decidesH2: "Qué decide realmente si calificas",
  decidesBody:
    "No solo tus ingresos — esa es la razón más común por la que gente que sí califica nunca solicita. La elegibilidad depende de lo que queda después de las deducciones a las que tienes derecho, y de una lista corta de reglas por categoría.",
  defs: [
    {
      t: "Tamaño del hogar",
      d: "Quiénes compran y preparan la comida juntos, que no siempre es quienes viven juntos. Los compañeros de vivienda que compran por separado suelen ser hogares distintos.",
    },
    {
      t: "Ingresos, después de deducciones",
      d: "La renta, los servicios, el cuidado infantil, la manutención que pagas y — para personas de 60+ o con discapacidad — los gastos médicos por encima de un mínimo se restan antes de aplicar el límite.",
    },
    {
      t: "Reglas por categoría",
      d: "Los estudiantes, las personas no ciudadanas y los adultos sin dependientes tienen cada uno sus reglas, y casi todas tienen excepciones que se pasan por alto más de lo que se aplican.",
    },
    {
      t: "Tu estado",
      d: "Las reglas federales fijan la base; cada estado añade su propio manual, sus propias asignaciones de servicios y, en algunos estados, su propia prueba de bienes.",
    },
  ],
  whyHardH2: "Por qué es difícil obtener una respuesta clara",
  cards: [
    {
      t: "La regla existe, pero está enterrada",
      d: "Casi toda pregunta de elegibilidad tiene una respuesta correcta, en algún lugar de unos cientos de páginas de regulación federal más el manual estatal encima.",
    },
    {
      t: "Siguen circulando cifras viejas",
      d: "Los límites cambian cada octubre. Un consejo heredado de hace unos años rechaza a personas que hoy sí calificarían.",
    },
    {
      t: "Las deducciones lo deciden",
      d: "Basta omitir una deducción a la que tienes derecho para que un hogar parezca sobre el límite sin estarlo. Es la forma más común en que un hogar elegible recibe la respuesta equivocada.",
    },
    {
      t: "Preguntar da miedo",
      d: "La gente teme que una respuesta equivocada en un formulario se use en su contra, así que nunca solicita. Entender qué pregunta realmente el formulario suele ser lo que destraba el trámite.",
    },
  ],
  howH2: "Cómo responde Demeter",
  steps: [
    {
      t: "Cada afirmación trae su regla",
      d: "Las respuestas citan la regulación federal y, en los estados verificados, el manual de ese estado — con enlace, para que leas la regla tú mismo o se la muestres a quien no esté de acuerdo.",
    },
    {
      t: "Dice cuándo no está seguro",
      d: "Cada respuesta se marca como segura o no confirmada, y explica por qué. Cuando las fuentes recuperadas no cubren tu pregunta, lo dice en vez de adivinar una cifra.",
    },
    {
      t: "Los paquetes estatales se revisan de forma adversarial",
      d: "Antes de publicar un estado, su paquete se contrasta con las fuentes primarias del propio estado y pasa por una revisión cuyo único trabajo es demostrar que el borrador está mal.",
    },
  ],
  faqH2: "Qué está preguntando realmente la solicitud",
  faqBody:
    "Estas son las preguntas donde la gente se atora — la redacción es legal, no conversacional. Esto es lo que significa cada una y la regla detrás.",
  faqHeading: (p) => `¿Qué significa "${p}" en una solicitud de SNAP?`,
  questionsLink: "Lo que la solicitud realmente pregunta",
  questionsIntro:
    "La gente no llega con una pregunta de política. Llega atascada en una línea de un formulario. Esto es lo que significa cada línea y la regla que la decide.",
  questionsBack: "Pregúntale a Demeter sobre tu propia situación",
  brandSubtitle: "Asistencia de inscripción y elegibilidad de SNAP",
  navAsk: "Pregúntale a Demeter",
  navQuestions: "Preguntas de la solicitud",
  footerPrivacy: "Privacidad",
  footerSupporters: "Patrocinadores",
  footerDisclaimer:
    "Demeter da información, no asesoría legal, y no decide tu caso. Lo decide la agencia de tu estado. Confirma siempre antes de actuar según una respuesta.",
  footerOrg: "Demeter AI es un producto de Civica.",
  map: {
    prompt: "Elige un estado resaltado para ver quién lo administra allí.",
    agency: "Administrado por",
    apply: "Solicita en",
    federalNote:
      "Los estados sin paquete verificado se responden con las reglas federales. El mapa muestra dónde además revisamos el manual del propio estado.",
    verified: "Verificado",
  },
  agenciesH2: "Tu estado administra el programa — estas son las agencias",
  agenciesBody:
    "Demeter nunca decide tu caso. Lo hace la agencia de tu estado. Estas son las agencias cuyas reglas publicadas sustentan las respuestas verificadas, y donde realmente se solicita.",
  agenciesNote:
    "¿No aparece el tuyo? Demeter igual responde con la base federal, y te remite a tu propia agencia estatal para las cifras que varían por estado.",
  verifyLink: "Mira cómo verificamos",
};

const vi: PageCopy = {
  h1: "Hỏi về SNAP và nhận đúng điều luật.",
  productLede:
    "Demeter trả lời bằng ngôn ngữ dễ hiểu và trích dẫn quy định liên bang đứng sau mỗi khẳng định — cùng với sổ tay của tiểu bang bạn, nơi chúng tôi đã xác minh.",
  snapLine:
    "SNAP là tiền mua thực phẩm hằng tháng, nạp vào thẻ EBT. Trước đây gọi là tem phiếu thực phẩm. Nộp đơn miễn phí.",
  eyebrow: "Chương trình Hỗ trợ Dinh dưỡng Bổ sung",
  h2: "SNAP là tiền mua thực phẩm hằng tháng, nạp vào một tấm thẻ.",
  lede:
    "Trước đây gọi là tem phiếu thực phẩm, SNAP là chương trình liên bang do từng tiểu bang quản lý. Nếu đủ điều kiện, trợ cấp về mỗi tháng một lần trên thẻ EBT, dùng như thẻ ghi nợ tại hầu hết các siêu thị. Nộp đơn miễn phí, và bạn có thể nộp dù đang đi làm hay không.",
  trust: [
    { t: "Miễn phí, không cần tài khoản", d: "Hỏi bao nhiêu tùy bạn. Không phải đăng ký gì cả." },
    {
      t: "Mọi khẳng định đều có nguồn",
      d: "Câu trả lời trích quy định liên bang, và cẩm nang của tiểu bang ở những nơi chúng tôi đã xác minh.",
    },
    { t: "Tiểu bang đã xác minh", d: "mỗi tiểu bang đều được đối chiếu với quy định do chính cơ quan đó công bố trước khi đưa lên." },
    {
      t: "Các nơi còn lại",
      d: "Quy định liên bang vẫn trả lời được. Những con số khác nhau theo tiểu bang sẽ được chuyển về cơ quan của bạn thay vì đoán.",
    },
  ],
  trustH2: "Miễn phí, có trích dẫn, và nói rõ giới hạn",
  snapH2: "SNAP là gì",
  snapBody:
    "SNAP là chương trình hỗ trợ thực phẩm lớn nhất nước Mỹ. Chính phủ liên bang chi trả trợ cấp và đặt ra các quy định nền tảng; tiểu bang của bạn nhận đơn và quyết định hồ sơ của bạn. Nếu đủ điều kiện, mỗi tháng một khoản tiền sẽ được nạp vào thẻ EBT dùng như thẻ ghi nợ.",
  snapFacts: [
    {
      t: "Ai chi trả, ai quyết định",
      d: "Cơ quan Thực phẩm và Dinh dưỡng (FNS) thuộc Bộ Nông nghiệp Hoa Kỳ cấp kinh phí và đặt ra quy định liên bang. Cơ quan tiểu bang của bạn nhận đơn và quyết định hồ sơ.",
    },
    {
      t: "Trợ cấp đến với bạn thế nào",
      d: "Một khoản tiền hằng tháng trên thẻ EBT, dùng như thẻ ghi nợ tại hầu hết siêu thị và nhiều chợ nông sản.",
    },
    {
      t: "Mua được những gì",
      d: "Thực phẩm mang về nhà nấu, cùng hạt giống và cây trồng ra thực phẩm. Không mua rượu bia, đồ gia dụng, hay thức ăn nóng làm sẵn để ăn ngay — dù một số tiểu bang cho phép vài nhóm hộ mua bữa ăn tại nhà hàng.",
    },
    {
      t: "Nộp đơn tốn bao nhiêu",
      d: "Không tốn gì. Nộp đơn miễn phí, và trợ cấp của một hộ không lấy đi phần của hộ nào khác.",
    },
  ],
  officialH3: "Thông tin chính thức về chương trình",
  officialNote:
    "Demeter không phải cơ quan chính phủ, không trực thuộc và không được Bộ Nông nghiệp Hoa Kỳ chứng thực. Để xem thông tin chính thức và tìm cơ quan tiểu bang của bạn:",
  officialFns: "Cơ quan Thực phẩm và Dinh dưỡng USDA — SNAP",
  officialDirectory: "Danh bạ SNAP theo tiểu bang — tìm cơ quan của bạn",
  evidenceH2: "Vì sao chúng tôi đưa ra điều luật thay vì chỉ trả lời",
  evidenceBody:
    "Beeck Center thuộc Đại học Georgetown đã thực hiện mười hai thử nghiệm chuyển chính sách phúc lợi thành mã hoạt động bằng trí tuệ nhân tạo. Kết luận của họ không phải là điều đó bất khả thi, mà là khi xử lý logic chính sách thực sự phức tạp, các mô hình vẫn cần kiến thức bên ngoài và cần người kiểm tra kết quả. Mô hình ngôn ngữ đủ trôi chảy để sai một cách thuyết phục, và quy định phúc lợi đúng là nơi cái sai đó khiến người ta mất tiền. Vì vậy Demeter trích dẫn quy định đằng sau mỗi khẳng định và kèm liên kết. Bạn không cần tin câu trả lời — bạn có thể đọc nguồn của nó.",
  evidenceQuote: "vẫn cần kiến thức bên ngoài và sự giám sát của con người",
  evidenceAttrib:
    "Beeck Center for Social Impact + Innovation, Georgetown University — AI-Powered Rules as Code, tháng 2 năm 2025",
  evidenceReport: "Đọc báo cáo",
  evidenceDemoDay: "Mười hai thử nghiệm Policy2Code",
  decidesH2: "Điều gì thực sự quyết định bạn có đủ điều kiện",
  decidesBody:
    "Không chỉ là thu nhập — đó là lý do phổ biến nhất khiến những người đủ điều kiện không bao giờ nộp đơn. Điều kiện phụ thuộc vào phần còn lại sau các khoản khấu trừ bạn được hưởng, và một danh sách ngắn các quy định theo nhóm.",
  defs: [
    {
      t: "Quy mô hộ gia đình",
      d: "Là những ai cùng mua và nấu ăn chung, không phải lúc nào cũng là những người sống chung. Người ở chung nhưng mua đồ ăn riêng thường được tính là hộ riêng.",
    },
    {
      t: "Thu nhập, sau khấu trừ",
      d: "Tiền thuê nhà, điện nước, giữ trẻ, tiền cấp dưỡng bạn trả và — với thành viên từ 60 tuổi trở lên hoặc khuyết tật — chi phí y tế vượt một mức nhất định đều được trừ trước khi áp dụng giới hạn.",
    },
    {
      t: "Quy định theo nhóm",
      d: "Sinh viên, người không phải công dân, và người trưởng thành không có người phụ thuộc đều có quy định riêng, và hầu hết đều có trường hợp miễn trừ bị bỏ sót nhiều hơn là được áp dụng.",
    },
    {
      t: "Tiểu bang của bạn",
      d: "Quy định liên bang đặt mức nền; mỗi tiểu bang bổ sung cẩm nang riêng, mức trợ cấp tiện ích riêng, và ở một số nơi là quy định về tài sản riêng.",
    },
  ],
  whyHardH2: "Vì sao khó tìm được câu trả lời rõ ràng",
  cards: [
    {
      t: "Quy định có thật, nhưng bị chôn vùi",
      d: "Hầu hết câu hỏi về điều kiện đều có một câu trả lời đúng, nằm đâu đó trong vài trăm trang quy định liên bang cộng thêm cẩm nang tiểu bang.",
    },
    {
      t: "Những con số cũ vẫn được truyền tai",
      d: "Các mức giới hạn thay đổi mỗi tháng Mười. Lời khuyên từ vài năm trước khiến người lẽ ra đủ điều kiện hôm nay bị từ chối.",
    },
    {
      t: "Khấu trừ mới là yếu tố quyết định",
      d: "Chỉ cần bỏ sót một khoản khấu trừ bạn được hưởng là hộ gia đình trông như vượt giới hạn dù thực tế không phải. Đây là cách phổ biến nhất khiến một hộ đủ điều kiện nhận câu trả lời sai.",
    },
    {
      t: "Hỏi thì thấy rủi ro",
      d: "Nhiều người sợ trả lời sai trên đơn sẽ bị dùng để chống lại mình, nên không bao giờ nộp. Hiểu được câu hỏi thực sự đang hỏi gì thường là điều giúp họ vượt qua.",
    },
  ],
  howH2: "Demeter trả lời như thế nào",
  steps: [
    {
      t: "Mỗi khẳng định đều kèm quy định",
      d: "Câu trả lời trích quy định liên bang và, ở các tiểu bang đã xác minh, cẩm nang của chính tiểu bang đó — có liên kết, để bạn tự đọc hoặc đưa cho nhân viên xét duyệt nếu họ không đồng ý.",
    },
    {
      t: "Nó nói rõ khi không chắc",
      d: "Mỗi câu trả lời được đánh dấu chắc chắn hoặc chưa chắc, kèm lý do. Khi các nguồn truy xuất không bao gồm câu hỏi của bạn, nó nói thẳng thay vì đoán một con số.",
    },
    {
      t: "Gói chính sách tiểu bang được kiểm tra đối kháng",
      d: "Trước khi một tiểu bang được đưa lên, gói chính sách của nó được đối chiếu với nguồn gốc của chính tiểu bang và đi qua một vòng kiểm tra mà nhiệm vụ duy nhất là chứng minh bản nháp sai.",
    },
  ],
  faqH2: "Đơn xin thực sự đang hỏi điều gì",
  faqBody:
    "Đây là những câu khiến người ta mắc kẹt — cách diễn đạt mang tính pháp lý, không phải đời thường. Sau đây là ý nghĩa của từng câu và quy định đằng sau nó.",
  faqHeading: (p) => `"${p}" trên đơn SNAP nghĩa là gì?`,
  questionsLink: "Đơn xin thực sự đang hỏi điều gì",
  questionsIntro:
    "Người ta không đến với một câu hỏi về chính sách. Họ mắc kẹt ở một dòng trên tờ đơn. Đây là ý nghĩa của từng dòng và điều luật quyết định nó.",
  questionsBack: "Hỏi Demeter về hoàn cảnh của chính bạn",
  brandSubtitle: "Hỗ trợ ghi danh và điều kiện SNAP",
  navAsk: "Hỏi Demeter",
  navQuestions: "Câu hỏi trên đơn",
  footerPrivacy: "Quyền riêng tư",
  footerSupporters: "Nhà tài trợ",
  footerDisclaimer:
    "Demeter cung cấp thông tin, không phải tư vấn pháp lý, và không quyết định hồ sơ của bạn. Cơ quan tiểu bang của bạn quyết định. Hãy luôn xác nhận trước khi hành động theo một câu trả lời.",
  footerOrg: "Demeter AI do Civica xây dựng.",
  map: {
    prompt: "Chọn một tiểu bang được tô sáng để xem cơ quan phụ trách ở đó.",
    agency: "Do cơ quan",
    apply: "Nộp đơn tại",
    federalNote:
      "Các tiểu bang chưa có gói đã xác minh vẫn được trả lời theo quy định liên bang. Bản đồ cho thấy nơi chúng tôi đã kiểm tra thêm sổ tay của chính tiểu bang đó.",
    verified: "Đã xác minh",
  },
  agenciesH2: "Tiểu bang của bạn điều hành chương trình — đây là các cơ quan",
  agenciesBody:
    "Demeter không bao giờ quyết định hồ sơ của bạn. Cơ quan tiểu bang mới quyết định. Đây là những cơ quan có quy định công bố làm nền cho các câu trả lời đã xác minh, và cũng là nơi bạn thực sự nộp đơn.",
  agenciesNote:
    "Không thấy tiểu bang của bạn? Demeter vẫn trả lời theo mức nền liên bang, và chỉ bạn tới cơ quan tiểu bang của mình cho những con số thay đổi theo từng nơi.",
  verifyLink: "Xem cách chúng tôi xác minh",
};

const zh: PageCopy = {
  h1: "询问 SNAP，拿到具体条款。",
  productLede:
    // 贵州 is Guizhou Province, not "your state". The honorific 贵 works before
    // a noun (贵公司 = your company) but 贵州 collides head-on with the province
    // name, so a Chinese reader saw "the Guizhou manual" on a page whose whole
    // claim is that it knows which state's rules apply to you.
    "Demeter 用通俗语言回答，并为每一条结论引用相应的联邦法规——以及您所在州的手册，只要我们已核实。",
  snapLine: "SNAP 是每月打入 EBT 卡的食品补助，旧称食品券。申请免费。",
  eyebrow: "补充营养援助计划",
  h2: "SNAP 是每月发放到卡上的食品补助。",
  lede:
    "SNAP 旧称食品券，是由各州具体执行的联邦项目。如果符合条件，补助每月一次打入 EBT 卡，可在大多数超市当作借记卡使用。申请免费，无论您是否在工作都可以申请。",
  trust: [
    { t: "免费，无需账户", d: "想问多少都可以，不用注册任何账号。" },
    { t: "每条结论都有出处", d: "回答会引用联邦法规，以及我们已核实的州级手册。" },
    { t: "已核实的州", d: "每一个都在上线前与该机构自己公布的规定逐条核对过。" },
    {
      t: "其他州",
      d: "联邦规定依然可以回答。各州不同的具体金额会转交您所在机构，而不是猜测。",
    },
  ],
  trustH2: "免费、有出处，并如实说明局限",
  snapH2: "SNAP 是什么",
  snapBody:
    "SNAP 是美国最大的食品援助项目。联邦政府支付补助并制定基本规则；您所在的州受理申请并裁定您的个案。若符合条件，每月会有一笔钱存入 EBT 卡，像借记卡一样使用。",
  snapFacts: [
    {
      t: "谁出钱，谁裁定",
      d: "美国农业部食品与营养服务局（FNS）拨付补助并制定联邦规则。您所在州的机构受理申请并裁定个案。",
    },
    {
      t: "补助怎么发放",
      d: "每月一笔金额存入 EBT 卡，可在大多数超市和许多农夫市集像借记卡一样使用。",
    },
    {
      t: "可以买什么",
      d: "可买回家烹调的食品，以及能长出食物的种子和幼苗。不可买酒类、家居用品，或现做现吃的热食——不过部分州允许特定家庭购买餐馆餐食。",
    },
    {
      t: "申请要花多少钱",
      d: "不花钱。申请免费，而且一个家庭领取补助并不会减少其他任何家庭的份额。",
    },
  ],
  officialH3: "官方项目信息",
  officialNote:
    "Demeter 不是政府机构，与美国农业部（USDA）无隶属关系，也未获其背书。查看官方项目信息并找到您所在州的机构：",
  officialFns: "美国农业部食品与营养服务局 — SNAP",
  officialDirectory: "SNAP 各州机构目录 — 找到您的机构",
  evidenceH2: "我们为什么把条文摆出来，而不是只给答案",
  evidenceBody:
    "乔治城大学 Beeck 中心做了十二项实验，尝试用人工智能把福利政策转成可运行的代码。他们的结论不是这件事做不到，而是面对真正复杂的政策逻辑时，模型仍然需要外部知识，也需要有人复核结果。语言模型足够流畅，因此出错时同样很有说服力，而福利规则恰恰是出错就要让人损失金钱的地方。所以 Demeter 会引用每一条说法背后的法规并附上链接。您不必相信答案本身——您可以读它的出处。",
  evidenceQuote: "仍然需要外部知识和人工监督",
  evidenceAttrib:
    "Beeck Center for Social Impact + Innovation, Georgetown University — AI-Powered Rules as Code，2025 年 2 月",
  evidenceReport: "阅读报告",
  evidenceDemoDay: "十二项 Policy2Code 实验",
  decidesH2: "真正决定您是否符合条件的是什么",
  decidesBody:
    "不只是收入——这正是许多本可获得补助的人从未申请的最常见原因。资格取决于扣除您应享有的各项之后还剩多少，以及一小组分类规定。",
  defs: [
    {
      t: "家庭人数",
      d: "指共同购买并一起做饭的人，未必等于住在一起的人。分开买菜的合租者通常算作不同家庭。",
    },
    {
      t: "扣除后的收入",
      d: "房租、水电、托儿费、您支付的子女抚养费，以及 60 岁以上或残疾成员超过一定额度的医疗支出，都会在适用收入上限之前先行扣除。",
    },
    {
      t: "分类规定",
      d: "学生、非公民、无受抚养人的成年人各有各的规定，而且大多都有豁免情形——这些豁免被忽略的次数远多于被适用的次数。",
    },
    {
      t: "您所在的州",
      d: "联邦规定设定底线；各州再加上自己的手册、自己的水电补贴标准，有些州还有自己的资产审查。",
    },
  ],
  whyHardH2: "为什么很难得到一个明确答案",
  cards: [
    {
      t: "规定是有的，只是被埋住了",
      d: "绝大多数资格问题都有唯一正确答案，就藏在几百页联邦法规再加上一本州手册里。",
    },
    {
      t: "过时的数字还在流传",
      d: "各项上限每年十月调整。几年前传下来的说法，会把今天本该符合条件的人挡在门外。",
    },
    {
      t: "决定性的是扣除项",
      d: "只要漏掉一项您本应享有的扣除，一个家庭看上去就会超出上限，实际却没有。这是符合条件的家庭得到错误答案最常见的方式。",
    },
    {
      t: "开口问本身让人害怕",
      d: "很多人担心表格上答错会被用来对付自己，于是干脆不申请。弄清楚题目到底在问什么，往往就是让人迈过这一步的关键。",
    },
  ],
  howH2: "Demeter 如何作答",
  steps: [
    {
      t: "每条结论都带着它的规定",
      d: "回答会引用联邦法规，在已核实的州还会引用该州自己的手册——附带链接，您可以自己读，也可以拿给有异议的工作人员看。",
    },
    {
      t: "不确定时会明说",
      d: "每条回答都会标注为确定或不确定，并说明原因。当检索到的来源没有覆盖您的问题时，它会直说，而不是猜一个数字。",
    },
    {
      t: "州级政策包经过对抗式核查",
      d: "一个州上线之前，其政策包会与该州自己的原始来源逐条比对，并通过一道唯一任务就是证明草稿有错的审查。",
    },
  ],
  faqH2: "申请表真正在问什么",
  faqBody:
    "这些是最容易卡住人的问题——它们的措辞是法律语言，不是日常说法。下面是每一条的含义，以及背后的规定。",
  faqHeading: (p) => `SNAP 申请表上的“${p}”是什么意思？`,
  questionsLink: "申请表到底在问什么",
  questionsIntro:
    "人们并不是带着政策问题来的，而是卡在表格的某一行上。这里说明每一行的含义，以及决定它的条款。",
  questionsBack: "就您自己的情况询问 Demeter",
  brandSubtitle: "SNAP 申请与资格协助",
  navAsk: "询问 Demeter",
  navQuestions: "申请表问题",
  footerPrivacy: "隐私政策",
  footerSupporters: "支持者",
  footerDisclaimer:
    "Demeter 提供信息，不提供法律建议，也不会决定您的申请结果。决定权在您所在州的机构。根据答案采取行动前请务必核实。",
  footerOrg: "Demeter AI 由 Civica 开发。",
  map: {
    prompt: "点击高亮的州，查看当地由哪个机构负责。",
    agency: "负责机构",
    apply: "申请入口",
    federalNote:
      "尚无已核实政策包的州仍会依据联邦规定作答。地图显示的是我们另外核对过该州自身手册的地区。",
    verified: "核实于",
  },
  agenciesH2: "项目由您所在的州执行——以下是相关机构",
  agenciesBody:
    "Demeter 从不决定您的个案，作出决定的是您所在州的机构。以下这些机构自己公布的规定，正是已核实答案的依据，也是您实际递交申请的地方。",
  agenciesNote:
    "没看到您所在的州？Demeter 仍会按联邦底线回答，并把各州不同的具体金额指引到您自己的州机构。",
  verifyLink: "了解我们如何核实",
};

export const PAGE_COPY: Record<AnswerLang, PageCopy> = { en, es, vi, zh };
