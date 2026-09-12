// Error-boundary + 404 copy for ALL supported locales.
//
// Lives here, not in app/i18n.ts, on purpose: app/i18n.ts is a label-only file
// (see lib/i18n/__tests__/zh-register.test.ts NO_PROSE) and must carry no
// second-person zh prose. These boundary strings are prose that addresses the
// reader, so they belong in a register-declared surface. Demeter speaks
// FORMALLY in Chinese (您), and this file is declared FORMAL in that test.
//
// The error page and the 404 are reachable by any visitor, so every supported
// locale ships — a vi/zh/tl visitor must not drop to English mid-failure.
// en/es mirror the app/i18n.ts landing dictionary; vi/zh/tl are pending
// native-speaker sign-off (#1082) but ship because a translated boundary beats
// an English one for LEP users.

import type { Locale } from "../../app/i18n";

export type ErrorCopy = {
  errorStatus: string;
  errorTitle: string;
  errorBody: string;
  errorReferenceLabel: string;
  errorReferenceHint: string;
  errorRetryCta: string;
  errorHomeCta: string;
  errorHelpNote: string;
};

export const errorStrings: Record<Locale, ErrorCopy> = {
  en: {
    errorStatus: "SOMETHING WENT WRONG",
    errorTitle: "This page didn't load.",
    errorBody:
      "Something on our end went wrong, not anything you did. Try again in a moment. This doesn't affect your SNAP case or eligibility.",
    errorReferenceLabel: "Reference",
    errorReferenceHint: "Share this if you contact us.",
    errorRetryCta: "Try again",
    errorHomeCta: "Back to the chat",
    errorHelpNote:
      "Need SNAP help right now? Contact your state SNAP agency, or dial 211 to reach a local benefits navigator.",
  },
  es: {
    errorStatus: "ALGO SALIÓ MAL",
    errorTitle: "Esta página no se cargó.",
    errorBody:
      "Algo falló de nuestro lado, no fue nada que hiciste. Vuelve a intentarlo en un momento. Esto no afecta tu caso ni tu elegibilidad para SNAP.",
    errorReferenceLabel: "Referencia",
    errorReferenceHint: "Compártela si nos contactas.",
    errorRetryCta: "Intentar de nuevo",
    errorHomeCta: "Volver al chat",
    errorHelpNote:
      "¿Necesitas ayuda con SNAP ahora? Comunícate con la agencia de SNAP de tu estado, o llama al 211 para hablar con un navegador de beneficios local.",
  },
  zh: {
    errorStatus: "出现错误",
    errorTitle: "此页面无法加载。",
    errorBody:
      "这是我们这边出现了问题，与您无关。请稍后再试。这不会影响您的 SNAP 申请或资格。",
    errorReferenceLabel: "参考编号",
    errorReferenceHint: "如果您与我们联系，请提供此编号。",
    errorRetryCta: "重试",
    errorHomeCta: "返回聊天",
    errorHelpNote:
      "现在需要 SNAP 帮助吗？请联系您所在州的 SNAP 机构，或拨打 211 联系当地福利导航员。",
  },
  vi: {
    errorStatus: "ĐÃ XẢY RA LỖI",
    errorTitle: "Trang này không tải được.",
    errorBody:
      "Đã có lỗi từ phía chúng tôi, không phải do bạn. Vui lòng thử lại sau giây lát. Việc này không ảnh hưởng đến hồ sơ hoặc điều kiện SNAP của bạn.",
    errorReferenceLabel: "Mã tham chiếu",
    errorReferenceHint: "Vui lòng cung cấp mã này nếu bạn liên hệ với chúng tôi.",
    errorRetryCta: "Thử lại",
    errorHomeCta: "Quay lại trò chuyện",
    errorHelpNote:
      "Cần trợ giúp SNAP ngay bây giờ? Hãy liên hệ cơ quan SNAP của tiểu bang, hoặc gọi 211 để gặp nhân viên hỗ trợ phúc lợi tại địa phương.",
  },
  tl: {
    errorStatus: "MAY NANGYARING MALI",
    errorTitle: "Hindi na-load ang page na ito.",
    errorBody:
      "May nangyaring mali sa aming panig, hindi dahil sa ginawa mo. Subukang muli sa ilang sandali. Hindi nito naaapektuhan ang iyong SNAP case o pagkakwalipika.",
    errorReferenceLabel: "Reference",
    errorReferenceHint: "Ibahagi ito kung makikipag-ugnayan ka sa amin.",
    errorRetryCta: "Subukang muli",
    errorHomeCta: "Bumalik sa chat",
    errorHelpNote:
      "Kailangan mo ba ng tulong sa SNAP ngayon? Makipag-ugnayan sa SNAP agency ng iyong estado, o tumawag sa 211 para sa lokal na benefits navigator.",
  },
};

export type NotFoundCopy = {
  notFoundStatus: string;
  notFoundTitle: string;
  notFoundBody: string;
  notFoundHomeCta: string;
  notFoundQuestionsCta: string;
};

export const notFoundStrings: Record<Locale, NotFoundCopy> = {
  en: {
    notFoundStatus: "PAGE NOT FOUND",
    notFoundTitle: "We couldn't find that page.",
    notFoundBody:
      "The link may be old or mistyped. Demeter answers your SNAP questions using your state's own rules, and shows the rule behind every answer.",
    notFoundHomeCta: "Go to Demeter",
    notFoundQuestionsCta: "Browse common questions",
  },
  es: {
    notFoundStatus: "PÁGINA NO ENCONTRADA",
    notFoundTitle: "No encontramos esa página.",
    notFoundBody:
      "El enlace puede estar desactualizado o mal escrito. Demeter responde tus preguntas sobre SNAP usando las reglas de tu estado, y muestra la regla detrás de cada respuesta.",
    notFoundHomeCta: "Ir a Demeter",
    notFoundQuestionsCta: "Ver preguntas comunes",
  },
  zh: {
    notFoundStatus: "找不到页面",
    notFoundTitle: "我们找不到该页面。",
    notFoundBody:
      "链接可能已过期或输入有误。Demeter 使用您所在州的规则回答您的 SNAP 问题，并显示每个答案背后的规则。",
    notFoundHomeCta: "前往 Demeter",
    notFoundQuestionsCta: "浏览常见问题",
  },
  vi: {
    notFoundStatus: "KHÔNG TÌM THẤY TRANG",
    notFoundTitle: "Chúng tôi không tìm thấy trang đó.",
    notFoundBody:
      "Liên kết có thể đã cũ hoặc bị nhập sai. Demeter trả lời các câu hỏi SNAP của bạn theo quy định của tiểu bang bạn, và hiển thị quy định đằng sau mỗi câu trả lời.",
    notFoundHomeCta: "Đến Demeter",
    notFoundQuestionsCta: "Xem các câu hỏi thường gặp",
  },
  tl: {
    notFoundStatus: "HINDI MAKITA ANG PAHINA",
    notFoundTitle: "Hindi namin makita ang pahinang iyon.",
    notFoundBody:
      "Maaaring luma na o maling na-type ang link. Sinasagot ng Demeter ang iyong mga tanong sa SNAP gamit ang mga panuntunan ng iyong estado, at ipinapakita ang panuntunan sa likod ng bawat sagot.",
    notFoundHomeCta: "Pumunta sa Demeter",
    notFoundQuestionsCta: "Tingnan ang mga karaniwang tanong",
  },
};
