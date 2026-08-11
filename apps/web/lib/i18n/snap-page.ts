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
    "Demeter 用通俗语言回答，并为每一条结论引用相应的联邦法规——以及我们已核实的贵州手册。",
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
  agenciesH2: "项目由您所在的州执行——以下是相关机构",
  agenciesBody:
    "Demeter 从不决定您的个案，作出决定的是您所在州的机构。以下这些机构自己公布的规定，正是已核实答案的依据，也是您实际递交申请的地方。",
  agenciesNote:
    "没看到您所在的州？Demeter 仍会按联邦底线回答，并把各州不同的具体金额指引到您自己的州机构。",
  verifyLink: "了解我们如何核实",
};

export const PAGE_COPY: Record<AnswerLang, PageCopy> = { en, es, vi, zh };
