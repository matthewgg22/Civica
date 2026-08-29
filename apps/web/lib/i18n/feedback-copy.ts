// Copy for the general feedback surface — the /feedback page and the
// SiteFeedbackForm on it — in the four answer languages.
//
// Until now this surface was English-only, linked canonically from the footer
// and the chat gear (the same treatment as /terms and /privacy). It comes off
// that list here: a localized /[lang]/feedback route ships in the same change,
// so es/vi/zh readers reach a form they can read (launch audit 2026-08-28).
//
// Record<AnswerLang, …> + the interface make four-language parity a COMPILE
// error to break, the same guarantee PAGE_COPY relies on. The es/vi/zh strings
// are a careful first pass and, like the other launch-audit translations, are
// worth a native-speaker read before launch.

import type { AnswerLang } from "@civica/demeter-engine/packs";

export interface FeedbackCopy {
  /** Page <title> / meta. */
  metaTitle: string;
  metaDescription: string;
  /** Page header. */
  title: string;
  lede: string;
  /** The "reporting a specific wrong answer?" note, split around its one inline
   *  link so each language can place the link where its own grammar wants it. */
  rerouteLead: string;
  rerouteLink: string;
  rerouteTail: string;
  /** Form field labels. */
  messageLabel: string;
  categoryLabel: string;
  categoryChoose: string;
  catBug: string;
  catSuggestion: string;
  catQuestion: string;
  catOther: string;
  emailLabel: string;
  /** Button + states. */
  send: string;
  sending: string;
  /** Success panel. */
  thankYouTitle: string;
  thankYouBody: string;
  /** Localized failures — the raw server error is English and not shown. */
  errorGeneric: string;
  errorNetwork: string;
}

const en: FeedbackCopy = {
  metaTitle: "Feedback: Demeter",
  metaDescription:
    "Tell Demeter what's working, what's broken, or what's missing. Read by the team that builds it.",
  title: "Feedback",
  lede: "Tell us what's working, what's broken, or what's missing. A real person reads every message. This isn't a rating on one answer, it's anything else you want to say about the product.",
  rerouteLead: "Reporting a specific wrong answer? The thumbs up/down under any answer in ",
  rerouteLink: "the chat",
  rerouteTail:
    " reaches the same team, with the actual question and answer attached. Faster than describing it here from memory.",
  messageLabel: "Your message *",
  categoryLabel: "What's this about?",
  categoryChoose: "Choose one (optional)",
  catBug: "Something's broken",
  catSuggestion: "A suggestion",
  catQuestion: "A question",
  catOther: "Something else",
  emailLabel: "Email (optional, if you want a reply)",
  send: "Send feedback",
  sending: "Sending…",
  thankYouTitle: "Thank you",
  thankYouBody:
    "We read every message. If you left an email, we'll follow up if there's something to say back.",
  errorGeneric: "Something went wrong, please try again.",
  errorNetwork: "Network error, please try again.",
};

const es: FeedbackCopy = {
  metaTitle: "Comentarios: Demeter",
  metaDescription:
    "Dile a Demeter qué funciona, qué está roto o qué falta. Lo lee el equipo que lo construye.",
  title: "Comentarios",
  lede: "Cuéntanos qué funciona, qué está roto o qué falta. Una persona real lee cada mensaje. Esto no es una calificación de una sola respuesta, es cualquier otra cosa que quieras decir sobre el producto.",
  rerouteLead:
    "¿Quieres reportar una respuesta específica incorrecta? El pulgar arriba/abajo debajo de cualquier respuesta en ",
  rerouteLink: "el chat",
  rerouteTail:
    " llega al mismo equipo, con la pregunta y la respuesta reales adjuntas. Más rápido que describirlo aquí de memoria.",
  messageLabel: "Tu mensaje *",
  categoryLabel: "¿De qué se trata?",
  categoryChoose: "Elige una (opcional)",
  catBug: "Algo no funciona",
  catSuggestion: "Una sugerencia",
  catQuestion: "Una pregunta",
  catOther: "Otra cosa",
  emailLabel: "Correo electrónico (opcional, si quieres una respuesta)",
  send: "Enviar comentarios",
  sending: "Enviando…",
  thankYouTitle: "Gracias",
  thankYouBody:
    "Leemos cada mensaje. Si dejaste un correo electrónico, te responderemos si hay algo que decir.",
  errorGeneric: "Algo salió mal, inténtalo de nuevo.",
  errorNetwork: "Error de red, inténtalo de nuevo.",
};

const vi: FeedbackCopy = {
  metaTitle: "Góp ý: Demeter",
  metaDescription:
    "Cho Demeter biết điều gì đang hoạt động, điều gì bị hỏng hoặc điều gì còn thiếu. Được đọc bởi nhóm xây dựng nó.",
  title: "Góp ý",
  lede: "Hãy cho chúng tôi biết điều gì đang hoạt động tốt, điều gì bị hỏng hoặc điều gì còn thiếu. Một người thật đọc mọi tin nhắn. Đây không phải là đánh giá cho một câu trả lời, mà là bất cứ điều gì khác bạn muốn nói về sản phẩm.",
  rerouteLead:
    "Bạn muốn báo cáo một câu trả lời sai cụ thể? Nút thích/không thích dưới bất kỳ câu trả lời nào trong ",
  rerouteLink: "phần trò chuyện",
  rerouteTail:
    " sẽ đến cùng một nhóm, kèm theo câu hỏi và câu trả lời thực tế. Nhanh hơn việc mô tả lại ở đây từ trí nhớ.",
  messageLabel: "Tin nhắn của bạn *",
  categoryLabel: "Về việc gì?",
  categoryChoose: "Chọn một (không bắt buộc)",
  catBug: "Có gì đó bị hỏng",
  catSuggestion: "Một góp ý",
  catQuestion: "Một câu hỏi",
  catOther: "Điều khác",
  emailLabel: "Email (không bắt buộc, nếu bạn muốn nhận phản hồi)",
  send: "Gửi góp ý",
  sending: "Đang gửi…",
  thankYouTitle: "Cảm ơn bạn",
  thankYouBody:
    "Chúng tôi đọc mọi tin nhắn. Nếu bạn để lại email, chúng tôi sẽ phản hồi nếu có điều gì cần nói lại.",
  errorGeneric: "Đã xảy ra lỗi, vui lòng thử lại.",
  errorNetwork: "Lỗi mạng, vui lòng thử lại.",
};

const zh: FeedbackCopy = {
  metaTitle: "反馈：Demeter",
  metaDescription:
    "告诉 Demeter 哪些好用、哪些出了问题、或者还缺什么。由开发团队亲自阅读。",
  title: "反馈",
  lede: "告诉我们哪些好用、哪些出了问题、或者还缺什么。每条留言都有真人阅读。这不是对单个回答的评分，而是关于本产品你想说的任何其他内容。",
  rerouteLead: "要报告某个具体的错误回答？任何回答下方的赞/踩按钮，在",
  rerouteLink: "聊天",
  rerouteTail:
    "中会送达同一个团队，并附上实际的问题和回答。比在这里凭记忆描述更快。",
  messageLabel: "你的留言 *",
  categoryLabel: "关于什么？",
  categoryChoose: "选择一项（可选）",
  catBug: "有些功能坏了",
  catSuggestion: "一个建议",
  catQuestion: "一个问题",
  catOther: "其他",
  emailLabel: "电子邮箱（可选，如果你想要回复）",
  send: "发送反馈",
  sending: "正在发送…",
  thankYouTitle: "谢谢",
  thankYouBody: "我们会阅读每条留言。如果你留下了邮箱，有需要回复的内容时我们会联系你。",
  errorGeneric: "出了点问题，请重试。",
  errorNetwork: "网络错误，请重试。",
};

export const FEEDBACK_COPY: Record<AnswerLang, FeedbackCopy> = { en, es, vi, zh };
