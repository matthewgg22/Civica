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
// IT DOES NOT PROMISE FOOD TODAY. The first cut said "a food bank can give you
// food today", which we cannot know: pantries keep their own hours, some run on
// weekly distributions, some take appointments. Telling someone "today" and
// having them arrive at a locked door is worse than telling them the truth —
// free groceries, no application, and 211 knows the hours. Same failure mode as
// the seven-day claim above, in the other direction (owner, 2026-09-13).

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
    body: "Food pantries give out free groceries, with no application and no qualifying. 211 can find the nearest one and tell you when it is open.",
    bank: "Find a food bank",
    call211: "Call or visit 211",
    expedited:
      "SNAP itself can be fast. With almost no income or cash on hand, expedited service puts benefits on your card within 7 days. Say so when you file.",
    close: "Close",
  },
  es: {
    label: "¿Necesitas comida esta semana?",
    labelShort: "¿Comida esta semana?",
    title: "¿Necesitas comida esta semana?",
    body: "Las despensas de alimentos reparten comida gratis, sin solicitud y sin calificar. El 211 puede encontrar la más cercana y decirte a qué hora abre.",
    bank: "Buscar un banco de alimentos",
    call211: "Llamar o visitar el 211",
    expedited:
      "SNAP también puede ser rápido. Con casi ningún ingreso ni efectivo disponible, el servicio acelerado pone los beneficios en tu tarjeta dentro de los 7 días. Dilo cuando presentes la solicitud.",
    close: "Cerrar",
  },
  vi: {
    label: "Cần thực phẩm tuần này?",
    labelShort: "Thực phẩm tuần này?",
    title: "Cần thực phẩm tuần này?",
    body: "Các điểm phát thực phẩm cho thực phẩm miễn phí, không cần nộp đơn và không cần đủ điều kiện. Tổng đài 211 có thể tìm nơi gần nhất và cho bạn biết giờ mở cửa.",
    bank: "Tìm ngân hàng thực phẩm",
    call211: "Gọi hoặc truy cập 211",
    expedited:
      "Bản thân SNAP cũng có thể nhanh. Nếu gần như không có thu nhập hay tiền mặt, dịch vụ xét duyệt nhanh đưa trợ cấp vào thẻ trong vòng 7 ngày. Hãy nói rõ khi nộp đơn.",
    close: "Đóng",
  },
  zh: {
    label: "这周需要食物吗？",
    labelShort: "这周需要食物？",
    title: "这周需要食物吗？",
    body: "食物发放点免费发放食物，不用申请，也不用先符合资格。211 可以帮您找到最近的一家，并告诉您开放时间。",
    bank: "寻找食物银行",
    call211: "致电或访问 211",
    expedited:
      "SNAP 本身也可以很快。如果您几乎没有收入或现金，加急服务会在 7 天内把福利存入您的卡。申请时请说明这一点。",
    close: "关闭",
  },
};

/** Both are public, national, and free to reach. */
export const FOOD_BANK_URL = "https://www.feedingamerica.org/find-your-local-foodbank";
export const URL_211 = "https://www.211.org/";
