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
// IT DOES NOT PROMISE WHAT ANYONE ELSE WILL DO (owner, 2026-09-13).
//
// Three drafts of this copy each made a claim about a third party we do not
// control: "a food bank can give you food today" (pantries keep their own
// hours and some run weekly distributions), "no application and no
// qualifying" (what a pantry asks for varies by site), and "211 will find the
// nearest pantry and its hours" (211 is a referral line, not a directory we
// can vouch for). All three were kindly meant and none of them was ours to
// promise — the same failure as the seven-day claim, applied to other people's
// operations instead of the agency's clock.
//
// So the copy DESCRIBES the resources and lets them speak for themselves:
// what a food bank is, what 211 is, and what the rules require of the agency.
// The one number left is the 7-day expedited standard, and it is attributed to
// the rule rather than stated as an outcome — which is the whole product's
// thesis applied to its own interface copy.

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
    body: "Food banks give out groceries at no cost. 211 is a free line that connects you to food help near you.",
    bank: "Find a food bank",
    call211: "Call or visit 211",
    expedited:
      "SNAP can be fast too: with almost no income or cash, the rules give the agency 7 days. Say so when you file.",
    close: "Close",
  },
  es: {
    label: "¿Necesitas comida esta semana?",
    labelShort: "¿Comida esta semana?",
    title: "¿Necesitas comida esta semana?",
    body: "Los bancos de alimentos reparten comida sin costo. El 211 es una línea gratuita de ayuda alimentaria cerca de ti.",
    bank: "Buscar un banco de alimentos",
    call211: "Llamar o visitar el 211",
    expedited:
      "SNAP también puede ser rápido: con casi ningún ingreso ni efectivo, las reglas le dan 7 días a la agencia. Dilo cuando solicites.",
    close: "Cerrar",
  },
  vi: {
    label: "Cần thực phẩm tuần này?",
    labelShort: "Thực phẩm tuần này?",
    title: "Cần thực phẩm tuần này?",
    body: "Ngân hàng thực phẩm phát thực phẩm miễn phí. Tổng đài 211 là đường dây miễn phí hỗ trợ thực phẩm gần nhà.",
    bank: "Tìm ngân hàng thực phẩm",
    call211: "Gọi hoặc truy cập 211",
    expedited:
      "SNAP cũng có thể nhanh: gần như không có thu nhập hay tiền mặt thì quy định cho cơ quan 7 ngày. Hãy nói rõ khi nộp đơn.",
    close: "Đóng",
  },
  zh: {
    label: "这周需要食物吗？",
    labelShort: "这周需要食物？",
    title: "这周需要食物吗？",
    body: "食物银行免费发放食物。211 是一条免费热线，可以为您联系附近的食物援助。",
    bank: "寻找食物银行",
    call211: "致电或访问 211",
    expedited:
      "SNAP 本身也可以很快：几乎没有收入或现金时，规定给机构 7 天时间。申请时请说明。",
    close: "关闭",
  },
};

/** Both are public, national, and free to reach. */
export const FOOD_BANK_URL = "https://www.feedingamerica.org/find-your-local-foodbank";
export const URL_211 = "https://www.211.org/";
