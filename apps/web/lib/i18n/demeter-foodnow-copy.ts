// "Need food this week?" — the crisis affordance, in the chat's top bar.
//
// WHY IT IS IN THE CHROME. It used to live only as a section partway down
// /screen/ask, which meant the one person who needs it most — someone with no
// food today — had to scroll past an explanation of what SNAP is, a state
// picker and three sample questions to reach it, and could not reach it at all
// from /chat. Everything else on this surface can wait for a scroll. This
// cannot (owner, 2026-09-13).
//
// WHY IT SAYS "WITHIN 7 DAYS" AND NOT "AT LEAST SEVEN DAYS". The marketing
// page said SNAP "takes at least seven days even when it is urgent", which
// inverts the rule. 7 CFR 273.2(i)(3)(i) makes seven days the DEADLINE for
// expedited service — benefits posted to the card "not later than the seventh
// calendar day following the date an application was filed" — and many states
// are faster. Told the wrong way round, the sentence reads as "SNAP cannot
// help you this week", which is the opposite of true for exactly the household
// expedited service exists for.
//
// It still points at a food bank first, because even same-week is not tonight.

import type { AnswerLang } from "@civica/demeter-engine/packs";

export type FoodNowCopy = {
  /** Header button, full width available. */
  label: string;
  /** Header button under ~640px, where the full label would crowd sign-in. */
  labelShort: string;
  title: string;
  body: string;
  bank: string;
  call211: string;
  /** Sits under the links: SNAP itself may be days, not weeks, away. */
  expedited: string;
  close: string;
};

export const FOODNOW_T: Record<AnswerLang, FoodNowCopy> = {
  en: {
    label: "Need food this week?",
    labelShort: "Food this week?",
    title: "Need food this week?",
    body: "A food bank can give you food today, and 211 will find one near you. Neither asks you to qualify first.",
    bank: "Find a food bank",
    call211: "Call or visit 211",
    expedited:
      "SNAP can be quick too. If you have very little income or cash on hand, expedited service puts benefits on your card within 7 days of applying, and often sooner. Say so when you file.",
    close: "Close",
  },
  es: {
    label: "¿Necesitas comida esta semana?",
    labelShort: "¿Comida esta semana?",
    title: "¿Necesitas comida esta semana?",
    body: "Un banco de alimentos puede darte comida hoy, y el 211 te encuentra uno cerca. Ninguno te pide calificar primero.",
    bank: "Buscar un banco de alimentos",
    call211: "Llamar o visitar el 211",
    expedited:
      "SNAP también puede ser rápido. Si tienes muy pocos ingresos o poco efectivo disponible, el servicio acelerado pone los beneficios en tu tarjeta dentro de los 7 días de solicitar, y muchas veces antes. Dilo cuando presentes la solicitud.",
    close: "Cerrar",
  },
  vi: {
    label: "Cần thực phẩm tuần này?",
    labelShort: "Thực phẩm tuần này?",
    title: "Cần thực phẩm tuần này?",
    body: "Ngân hàng thực phẩm có thể cho bạn thực phẩm ngay hôm nay, và tổng đài 211 sẽ tìm giúp bạn một nơi gần nhà. Cả hai đều không yêu cầu bạn phải đủ điều kiện trước.",
    bank: "Tìm ngân hàng thực phẩm",
    call211: "Gọi hoặc truy cập 211",
    expedited:
      "SNAP cũng có thể nhanh. Nếu bạn có rất ít thu nhập hoặc rất ít tiền mặt, dịch vụ xét duyệt nhanh sẽ đưa trợ cấp vào thẻ của bạn trong vòng 7 ngày kể từ khi nộp đơn, và thường là sớm hơn. Hãy nói rõ điều đó khi nộp đơn.",
    close: "Đóng",
  },
  zh: {
    label: "这周需要食物吗？",
    labelShort: "这周需要食物？",
    title: "这周需要食物吗？",
    body: "食物银行今天就能给您食物，211 可以帮您找到附近的一家。两者都不要求您先符合资格。",
    bank: "寻找食物银行",
    call211: "致电或访问 211",
    expedited:
      "SNAP 也可以很快。如果您的收入极低或手头现金很少，加急服务会在您申请后 7 天内把福利存入您的卡，通常更快。申请时请说明这一点。",
    close: "关闭",
  },
};

/** Both are public, national, and free to reach. */
export const FOOD_BANK_URL = "https://www.feedingamerica.org/find-your-local-foodbank";
export const URL_211 = "https://www.211.org/";
