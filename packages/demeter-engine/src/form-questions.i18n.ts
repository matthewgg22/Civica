// Translations of FORM_QUESTIONS' `whyAsked`, keyed by topic.
//
// These live NEXT TO the English source rather than in apps/web so they cannot
// drift from the entries they explain, and a coverage test fails the build if a
// new form question ships without them.
//
// Same posture the ANSWER pipeline already takes for non-English output: the
// underlying authority is English, the explanation is written in the reader's
// language, and the citation stays verbatim (citations are rendered separately,
// so no translated string here contains one). No string here carries a dollar
// figure, for the same reason the English ones don't — amounts move every
// October and these are meant to stay true.
//
// ⚠️ NOT NATIVE-REVIEWED. These are model-authored translations of
// benefits-policy explanations for a population that will act on them. They are
// accurate to the English source as written, but Spanish/Vietnamese/Chinese
// review by a speaker who knows SNAP is a real prerequisite before treating
// them as final — the same standard this project already applies to its
// compliance strings.

import type { AnswerLang } from "./lang";

export type TranslatedLang = Exclude<AnswerLang, "en">;

export const FORM_QUESTION_I18N: Record<string, Record<TranslatedLang, string>> = {
  household_composition: {
    es: "Decide quiénes cuentan como un solo hogar de SNAP. Las personas que compran y preparan la comida juntas solicitan como un mismo hogar aunque no sean familiares — y eso cambia tanto el límite de ingresos como el beneficio.",
    vi: "Câu này quyết định những ai được tính là một hộ SNAP. Những người cùng mua và nấu ăn chung sẽ nộp đơn như một hộ, ngay cả khi không có quan hệ họ hàng — và điều đó thay đổi cả mức thu nhập giới hạn lẫn số tiền trợ cấp.",
    zh: "这决定了谁算作同一个 SNAP 家庭。共同购买并一起做饭的人算作一个家庭申请，即使没有亲属关系——这会同时影响收入上限和补助金额。",
  },
  homelessness: {
    es: "No tener vivienda no te descalifica — puede aumentar tu beneficio. Un hogar sin vivienda estable puede tomar la deducción para personas sin hogar en vez de comprobar gastos de vivienda, y puedes recibir SNAP sin una dirección fija.",
    vi: "Tình trạng vô gia cư không làm bạn mất điều kiện — nó có thể làm tăng trợ cấp. Hộ không có chỗ ở ổn định có thể dùng khoản khấu trừ dành cho người vô gia cư thay vì phải chứng minh chi phí nhà ở, và bạn vẫn nhận được SNAP dù không có địa chỉ cố định.",
    zh: "无家可归不会取消您的资格——反而可能提高补助。没有稳定住所的家庭可以使用无家可归者专项扣除，而不必证明实际住房支出，而且没有固定地址也可以领取 SNAP。",
  },
  utility_costs: {
    es: "Pagar cualquier costo de calefacción o aire acondicionado por separado de la renta normalmente te da derecho a la asignación estándar completa de servicios — a menudo la deducción más grande de la solicitud, y una que la gente omite porque cree que necesita recibos.",
    vi: "Nếu bạn trả bất kỳ chi phí sưởi ấm hoặc làm mát nào tách riêng với tiền thuê nhà, bạn thường đủ điều kiện nhận toàn bộ khoản trợ cấp tiện ích tiêu chuẩn — thường là khoản khấu trừ lớn nhất trong đơn, và nhiều người bỏ qua vì tưởng phải có hóa đơn.",
    zh: "只要您与房租分开支付任何取暖或制冷费用，通常就可以获得全额标准水电补贴——这往往是申请表上最大的一项扣除，很多人因为以为需要收据而漏掉了它。",
  },
  student_status: {
    es: "Solo los estudiantes inscritos al menos medio tiempo en educación superior enfrentan las reglas adicionales para estudiantes — y aun así aplican muchas excepciones (trabajar 20 horas, cuidar a un hijo, estudio y trabajo, programas de E&T). Los estudiantes de medio tiempo y de secundaria no están sujetos a ellas.",
    vi: "Chỉ những sinh viên ghi danh ít nhất bán thời gian ở bậc đại học mới chịu các quy định bổ sung dành cho sinh viên — và ngay cả khi đó vẫn có nhiều trường hợp miễn trừ (làm việc 20 giờ, chăm con, chương trình vừa học vừa làm, chương trình E&T). Học sinh phổ thông và người học bán thời gian không thuộc diện này.",
    zh: "只有在高等院校至少半时注册的学生才适用额外的学生规定——即便如此，也有许多豁免情形（每周工作 20 小时、照顾孩子、勤工俭学、E&T 项目）。非全时学生和中学生完全不适用这些规定。",
  },
  expedited_service: {
    es: "Esto te evalúa para recibir beneficios en 7 días. Ingresos y recursos muy bajos, o costos de vivienda mayores que tus ingresos, pueden calificarte — y la agencia debe evaluar cada solicitud para esto, lo pidas o no.",
    vi: "Mục này xét xem bạn có được nhận trợ cấp trong vòng 7 ngày hay không. Thu nhập và tài sản rất thấp, hoặc chi phí nhà ở cao hơn thu nhập, đều có thể đủ điều kiện — và cơ quan phải xét điều này cho mọi đơn, dù bạn có yêu cầu hay không.",
    zh: "这一项是在筛查您能否在 7 天内拿到补助。收入和资产极低，或住房支出高于收入，都可能符合条件——而且无论您是否提出，机构都必须对每份申请进行这项筛查。",
  },
  self_employment: {
    es: "El ingreso por cuenta propia se cuenta después de los gastos del negocio, no antes — así que las ganancias brutas de una plataforma son el número equivocado para reportar. Esta es una de las líneas peor calculadas de la solicitud.",
    vi: "Thu nhập tự doanh được tính sau khi trừ chi phí kinh doanh, không phải trước — nên tổng số tiền nhận từ nền tảng là con số sai để khai báo. Đây là một trong những mục bị tính sai nhiều nhất trong đơn.",
    zh: "自雇收入是在扣除经营成本之后才计算的，而不是之前——所以平台上的总收入并不是应该填报的数字。这是申请表上最容易算错的项目之一。",
  },
  voluntary_quit: {
    es: "Renunciar a un trabajo sin causa justificada puede traer una penalidad — pero la \"causa justificada\" es amplia (condiciones inseguras, falta de cuidado infantil, transporte, discriminación), y que te despidan no es una renuncia voluntaria.",
    vi: "Tự ý nghỉ việc mà không có lý do chính đáng có thể bị phạt — nhưng \"lý do chính đáng\" được hiểu rất rộng (điều kiện làm việc không an toàn, không có người trông trẻ, không có phương tiện đi lại, bị phân biệt đối xử), và bị sa thải không phải là tự ý nghỉ việc.",
    zh: "无正当理由主动辞职可能会受到处罚——但“正当理由”的范围很广（工作环境不安全、没有托儿安排、交通问题、遭受歧视），而被解雇并不属于主动辞职。",
  },
  drug_felony: {
    es: "La mayoría de los estados han optado por eliminar por completo la prohibición federal por delitos de drogas, y donde queda alguna regla suele depender de cumplir con un tratamiento o con la libertad condicional. Una condena por sí sola con frecuencia no te descalifica.",
    vi: "Phần lớn các tiểu bang đã bỏ hoàn toàn lệnh cấm liên bang đối với tiền án ma túy, và ở nơi còn quy định thì thường phụ thuộc vào việc tuân thủ điều trị hoặc quản chế. Chỉ riêng một bản án thường không làm bạn mất điều kiện.",
    zh: "大多数州已完全退出联邦对毒品重罪的禁令，即使仍保留规定的州，通常也取决于是否遵守戒治或缓刑条件。仅有一次定罪往往并不会取消资格。",
  },
  fleeing_felon: {
    es: "Esto descalifica solo a la persona, nunca a todo el hogar — y requiere una intención activa de evadir el proceso judicial, no simplemente que exista una orden de arresto antigua.",
    vi: "Điều này chỉ làm mất điều kiện của cá nhân đó, không bao giờ áp dụng cho cả hộ — và đòi hỏi có ý định thực sự trốn tránh truy tố, chứ không chỉ là tồn tại một lệnh bắt cũ.",
    zh: "这只会取消该个人的资格，绝不会影响整个家庭——而且必须存在主动逃避起诉的意图，仅仅有一张陈年的逮捕令并不算。",
  },
  immigration_status: {
    es: "Puedes solicitar para los miembros del hogar que sí califican (incluidos hijos ciudadanos) sin solicitar para ti, y SNAP no cuenta en la prueba de carga pública. Solo las personas que solicitan tienen que dar su estatus migratorio.",
    vi: "Bạn có thể nộp đơn cho những thành viên đủ điều kiện trong hộ (kể cả con là công dân Mỹ) mà không cần nộp cho chính mình, và SNAP không bị tính trong xét \"gánh nặng xã hội\". Chỉ những người thực sự nộp đơn mới phải khai tình trạng nhập cư.",
    zh: "您可以只为符合条件的家庭成员（包括美国公民子女）申请，而不必为自己申请，而且 SNAP 不计入“公共负担”认定。只有实际申请的人才需要提供移民身份。",
  },
  ssn_requirement: {
    es: "El número de seguro social solo se exige a las personas que están solicitando. Los miembros del hogar que no solicitan no tienen que darlo, y negarse por ellos no puede hundir toda la solicitud.",
    vi: "Số an sinh xã hội chỉ bắt buộc đối với những người đang nộp đơn. Thành viên trong hộ không nộp đơn thì không cần cung cấp, và việc từ chối cho họ không thể làm hỏng toàn bộ đơn.",
    zh: "只有实际申请的人才必须提供社会安全号码。不申请的家庭成员无需提供，且为他们拒绝提供也不会导致整份申请被否决。",
  },
  resources_assets: {
    es: "La mayoría de los estados eliminan por completo la prueba de bienes mediante la elegibilidad categórica amplia, así que los ahorros y los vehículos con frecuencia no cuentan — pero esto varía según el estado más que casi cualquier otra regla.",
    vi: "Phần lớn các tiểu bang đã bỏ hoàn toàn việc xét tài sản thông qua diện đủ điều kiện theo nhóm mở rộng, nên tiền tiết kiệm và xe cộ thường không bị tính — nhưng quy định này khác nhau giữa các tiểu bang nhiều hơn hầu hết mọi quy định khác.",
    zh: "大多数州通过广义类别资格完全取消了资产审查，因此存款和车辆往往根本不计入——但这一点各州差异之大，超过几乎所有其他规定。",
  },
  missed_interview: {
    es: "Perder una llamada no es una denegación automática. El condado tiene que enviarte un aviso por escrito y darte hasta el día 30 desde la fecha de tu solicitud para reprogramar — y si ese aviso nunca llegó, o llegó después de que ya hiciste la entrevista, la denegación no se sostiene. No tienes que volver a solicitar; puedes llamar para reprogramar.",
    vi: "Lỡ một cuộc gọi không phải là bị từ chối tự động. Quận phải gửi cho bạn thông báo bằng văn bản và cho bạn tới ngày thứ 30 kể từ ngày nộp đơn để hẹn lại — và nếu thông báo đó chưa từng được gửi, hoặc gửi sau khi bạn đã phỏng vấn xong, thì quyết định từ chối không có giá trị. Bạn không cần nộp đơn lại; chỉ cần gọi để hẹn lại.",
    zh: "错过一次电话并不等于自动被拒。县机构必须给您书面通知，并给您从申请之日起至第 30 天的时间重新预约——如果那份通知从未寄出，或是在您已经完成面谈之后才寄出，该拒绝决定就站不住脚。您不需要重新申请，打电话重新预约即可。",
  },
  repeat_verification: {
    es: "El condado solo puede pedir comprobante de algo que realmente esté en duda — no volver a pedir lo que ya está en tu expediente, ni negarte por \"no entregar\" algo que ya entregaste. Si te vuelven a pedir un documento que ya enviaste, vale la pena reclamar en vez de reenviarlo sin más.",
    vi: "Quận chỉ được yêu cầu chứng từ cho những điều thực sự còn nghi vấn — không được đòi lại thứ đã có trong hồ sơ, và không được từ chối vì \"không cung cấp\" thứ bạn đã nộp. Nếu họ đòi lại giấy tờ bạn đã gửi, điều đó đáng để phản đối chứ không nên mặc nhiên nộp lại.",
    zh: "县机构只能就确实存疑的事项要求证明——不能重复索要已在您档案中的材料，也不能以“未提供”您已经交过的东西为由拒绝您。如果他们再次索要您已提交的文件，这值得提出异议，而不是默默重交一份。",
  },
  abawd_work_requirement: {
    es: "Esta es la regla ABAWD: sin una actividad laboral que califique o una exención, los beneficios se limitan a tres meses contables en un periodo de tres años. La mayoría de los adultos nunca llega a esta regla — aplican varias exenciones (discapacidad, cuidar a un hijo, embarazo y otras) — y un aviso tardío o ausente puede ser motivo para impugnar un corte.",
    vi: "Đây là quy định ABAWD: nếu không có hoạt động làm việc đủ điều kiện hoặc không được miễn trừ, trợ cấp bị giới hạn ba tháng được tính trong giai đoạn ba năm. Phần lớn người trưởng thành không bao giờ chạm tới quy định này — có nhiều diện miễn trừ (khuyết tật, chăm con, mang thai và các trường hợp khác) — và một thông báo gửi trễ hoặc không gửi có thể là căn cứ để phản đối việc cắt trợ cấp.",
    zh: "这是 ABAWD 工作规定：如果没有符合条件的工作活动，也没有豁免，补助将被限制为三年期内累计三个计算月。大多数成年人根本不会触及这条规定——存在多项豁免（残疾、照顾孩子、怀孕等）——而通知迟发或未发本身就可能成为质疑停发的理由。",
  },
  denial_notice_validity: {
    es: "Un aviso de denegación o terminación tiene que indicar el motivo real, en lenguaje claro, y si menciona más de un motivo todos tienen que ser correctos — un solo motivo equivocado puede invalidar el aviso completo, no solo esa línea. Un aviso confuso o que no coincide con lo que realmente pasó vale la pena cuestionarlo, no aceptarlo sin más.",
    vi: "Thông báo từ chối hoặc chấm dứt phải nêu đúng lý do thật, bằng ngôn ngữ dễ hiểu, và nếu nêu nhiều hơn một lý do thì mọi lý do đều phải chính xác — chỉ một lý do sai có thể làm vô hiệu toàn bộ thông báo, không chỉ dòng đó. Một thông báo khó hiểu hoặc không khớp với thực tế đáng để bạn chất vấn, chứ không nên chấp nhận ngay.",
    zh: "拒绝或终止通知必须写明真实理由，用通俗易懂的语言表述；如果列出不止一个理由，则每一个都必须准确——只要有一个理由是错的，整份通知都可能无效，而不只是那一行。内容含糊或与实际情况不符的通知值得质疑，而不该被默默接受。",
  },
};

/** Topics missing a translation in any supported language. Empty in a healthy
 *  build — the coverage test asserts exactly that, so a new form question
 *  cannot ship English-only into a localized page. */
export function untranslatedTopics(topics: string[], langs: TranslatedLang[]): string[] {
  return topics.filter((t) => langs.some((l) => !FORM_QUESTION_I18N[t]?.[l]));
}
