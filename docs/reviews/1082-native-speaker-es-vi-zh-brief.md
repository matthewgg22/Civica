# Reviewer brief — native-speaker read of Demeter's Spanish / Vietnamese / Chinese copy

**For:** a professional native speaker (ideally a certified translator) in **one** of Spanish (es), Vietnamese (vi), or Simplified Chinese (zh). One reviewer per language.
**Tracks:** [issue #1082](https://github.com/matthewgg22/Civica/issues/1082)
**Est. time:** 60–90 min per language.
**Deadline:** before public launch. Section 1 (crisis) is the launch blocker; the rest can follow.

---

## TL;DR — what we're asking

Demeter is a **free public SNAP (food-benefits) chatbot** for a heavily limited-English-proficient (LEP) audience in the US. In an Aug 2026 launch sweep we localized several surfaces into es/vi/zh. Those translations were a **careful first pass by an AI model** and have **not** yet had a native-speaker read. We need you to confirm they are **correct, natural, and appropriately toned** — not translationese — with special care for anything a **distressed** reader sees.

You do **not** need to touch code or know anything technical. Everything you need to review is quoted verbatim in this document. Give feedback in the table format in §3.

**Please review in this priority order** (highest stakes first):

1. **Crisis safety-net lines** (§5) — the suicide / domestic-violence hotline text shown to someone in crisis. *If you only do one section, do this one.*
2. **The "source" footer** (§6) — one line that appears under **every** answer.
3. **The feedback form** (§7).
4. **Crisis / hunger detection phrases** (§8) — a realism sanity-check, not a translation.

---

## 2. Context you need (2 minutes)

- **Who reads this:** people applying for or receiving food assistance. Often stressed, low-income, on a phone, and reading in their first language *because their English is limited.* A stilted or wrong translation on a benefits tool erodes exactly the trust the translation was meant to build.
- **The whole answer is in the reader's language.** When someone uses the Spanish / Vietnamese / Chinese interface, the chatbot's answers, the footer under each answer, and these safety lines are all shown in that language. So these strings are the reader's entire experience of being taken seriously in their own language.
- **Register matters.** This is a government-benefits helper serving all ages and education levels. We want warm, plain, respectful, dignified language — never bureaucratic, never childish, never cold. Where we made a formality choice (e.g. Spanish *tú* vs *usted*), we call it out for you to confirm.
- **"You" throughout.** These are direct-address strings ("you're not alone", "your message"). Please judge them as spoken *to* the reader.

---

## 3. How to give feedback

For each string, tell us: **is it good as-is, or what should it say instead, and why.** Please use this table (copy it, one row per string you'd change — you can skip anything that's fine, or add a row to confirm a high-stakes line is good):

| # (from this doc) | Verdict | Suggested replacement | Why / note |
|---|---|---|---|
| e.g. 5.1-vi | Reword | *(your text)* | "đơn độc" reads formal/literary; a distressed reader would expect *…* |
| e.g. 5.2-es | ✅ Good | — | Natural and warm as-is |

**Verdict options:** ✅ Good · ✏️ Reword (give the replacement) · ⚠️ Wrong/misleading (fix required) · ❓ Unsure (explain).

**Severity we care about most:** anything a person **in crisis** reads (§5), anything that could **mislead** about benefits or money, and anything that sounds **cold or robotic**. Typos and light awkwardness are welcome too, just lower priority.

If a term has **regional variation** (e.g. Latin-American Spanish varieties, Northern vs Southern Vietnamese, Mainland conventions), pick the option most **neutral and widely understood** across the US diaspora, and note the tradeoff.

---

## 4. Register questions we specifically want you to settle

These are deliberate choices where a native speaker's judgment beats ours. Please confirm or correct:

- **Spanish — informal *tú*.** The copy uses informal *tú* throughout ("estás", "cuéntanos", "verifica"). Is informal right for an all-ages benefits audience, or should it be *usted*? Be consistent either way.
- **Spanish — gendered forms.** We wrote "no estás solo" (masculine) in the crisis line and "seguro/a" (both) in the DV line. Is "solo" alone acceptable, or should it be "solo/a" / a gender-neutral rewrite? Flag any other place a gendered default excludes women.
- **Chinese — 您 vs 你.** The feedback page uses formal **您**; the crisis safety-net lines use informal **你**. Is that split intentional and right (warmer 你 in crisis, respectful 您 elsewhere), or should they be reconciled to one register?
- **Vietnamese — pronoun/address.** We use **bạn** ("you") throughout. Confirm that's the right neutral register for this audience across regions, and that tone marks/diacritics are correct everywhere.

---

## 5. HIGHEST STAKES — crisis safety-net lines

These are shown to someone whose message suggests **suicidal thoughts** or an **unsafe/abusive situation at home**. They must read as **human, calm, warm, and correct** — never like a legal disclaimer or an auto-reply. The English is the reference for meaning; judge each translation on its own naturalness, not word-for-word fidelity.

### 5.1 Self-harm / suicide

- **en (reference):** *"**If you're thinking about suicide or self-harm, you're not alone.** The 988 Suicide & Crisis Lifeline is free, confidential, and open 24/7 — call or text **988** (press 2 for Spanish)."*
- **es:** *"**Si estás pensando en el suicidio o en hacerte daño, no estás solo.** La Línea 988 de Prevención del Suicidio y Crisis es gratuita, confidencial y está disponible las 24 horas — llama o envía un mensaje de texto al **988** (presiona 2 para español)."*
- **vi:** *"**Nếu bạn đang nghĩ đến việc tự tử hoặc tự làm hại bản thân, bạn không đơn độc.** Đường dây 988 miễn phí, bảo mật và hoạt động 24/7 — hãy gọi hoặc nhắn tin **988** (có hỗ trợ tiếng Việt)."*
- **zh:** *"**如果你有自杀或自残的念头，你并不孤单。** 988 生命热线免费、保密，全天候 24/7 — 可拨打或发短信至 **988**（提供中文服务）。"*

Points to confirm: does "you're not alone" land warmly (not clinically)? Is "988" / the call-or-text instruction clear? Is the parenthetical language note (**press 2 for Spanish** / **có hỗ trợ tiếng Việt** / **提供中文服务**) accurate and natural? Would a distressed reader in your language *feel spoken to like a person*?

### 5.2 Abuse / domestic violence

- **en (reference):** *"**If you're not safe at home, help is available.** The National Domestic Violence Hotline is free, confidential, and open 24/7 — call **1-800-799-7233** or text **START to 88788** (interpretation in many languages)."*
- **es:** *"**Si no estás seguro/a en casa, hay ayuda disponible.** La Línea Nacional contra la Violencia Doméstica es gratuita, confidencial y está disponible las 24 horas — llama al **1-800-799-7233** o envía **START al 88788** (interpretación en muchos idiomas)."*
- **vi:** *"**Nếu bạn không an toàn ở nhà, luôn có sự trợ giúp.** Đường dây nóng Quốc gia về Bạo lực Gia đình miễn phí, bảo mật và hoạt động 24/7 — gọi **1-800-799-7233** hoặc nhắn **START đến 88788** (hỗ trợ thông dịch nhiều ngôn ngữ)."*
- **zh:** *"**如果你在家中不安全，可以获得帮助。** 全国家庭暴力热线免费、保密，全天候 24/7 — 请拨打 **1-800-799-7233**，或发送 **START 至 88788**（提供多种语言口译）。"*

Points to confirm: is the hotline's **name** rendered the way it's actually known in your language community? Is "text START to 88788" clear (the word **START** stays in English — that's required by the service; is that obvious to the reader)? Does "interpretation in many languages" read naturally?

> Numbers **988**, **1-800-799-7233**, **88788**, and the literal word **START** must stay exactly as written — they are dialable/textable and must not be localized. Everything around them should be natural in your language.

---

## 6. Under every answer — the "source" footer

This one line sits at the foot of **every** answer, so it is read constantly. It names the legal source and how long the figures are valid. It must be terse and trustworthy.

**Lead + source + validity line** (the "([eCFR])" is a link the reader can tap; keep the label as-is):

| lang | String |
|---|---|
| en | *"Based on federal SNAP rules ([eCFR]). FY2026 figures, valid through Sept 30, 2026."* |
| es | *"Según las reglas federales de SNAP ([eCFR]). Cifras del año fiscal 2026, vigentes hasta el 30 de septiembre de 2026."* |
| vi | *"Dựa trên quy định SNAP liên bang ([eCFR]). Số liệu năm tài khóa 2026, có hiệu lực đến ngày 30 tháng 9 năm 2026."* |
| zh | *"依据联邦 SNAP 规定（[eCFR]）。2026 财年数据，有效期至 2026 年 9 月 30 日。"* |

**Staleness warning** (shown only after Oct 1, when federal figures change; still worth getting right now):

| lang | String |
|---|---|
| en | *"Federal benefit figures changed on Oct 1 and this service may not reflect them yet. Double-check any dollar amount with your state agency."* |
| es | *"Las cifras federales cambiaron el 1 de octubre y es posible que este servicio aún no las refleje. Verifica cualquier monto con tu agencia estatal."* |
| vi | *"Các con số liên bang đã thay đổi từ ngày 1 tháng 10 và dịch vụ này có thể chưa cập nhật. Hãy kiểm tra lại mọi số tiền với cơ quan tiểu bang của bạn."* |
| zh | *"联邦标准已于10月1日调整，本服务可能尚未更新。请与您所在州的机构核实所有金额。"* |

Points to confirm: is "SNAP" left in English right (that's how the program is known), or is there a better-understood term in your community? Is "state agency" / "cơ quan tiểu bang" / "州的机构" clear to someone who may not know US government structure? Note the zh footer uses **您** while the zh staleness line and the crisis lines use **你** — flag if that should be unified.

---

## 7. The feedback form (the /feedback page)

Where a reader tells the team what's working or broken. Lower stakes, but it's the reader's voice channel, so it should feel welcoming. Full string set, en reference + your language:

| # | Field | en | es | vi | zh |
|---|---|---|---|---|---|
| 7.1 | Page title | Feedback | Comentarios | Góp ý | 反馈 |
| 7.2 | Lede | Tell us what's working, what's broken, or what's missing. A real person reads every message. This isn't a rating on one answer, it's anything else you want to say about the product. | Cuéntanos qué funciona, qué está roto o qué falta. Una persona real lee cada mensaje. Esto no es una calificación de una sola respuesta, es cualquier otra cosa que quieras decir sobre el producto. | Hãy cho chúng tôi biết điều gì đang hoạt động tốt, điều gì bị hỏng hoặc điều gì còn thiếu. Một người thật đọc mọi tin nhắn. Đây không phải là đánh giá cho một câu trả lời, mà là bất cứ điều gì khác bạn muốn nói về sản phẩm. | 告诉我们哪些好用、哪些出了问题、或者还缺什么。每条留言都有真人阅读。这不是对单个回答的评分，而是关于本产品您想说的任何其他内容。 |
| 7.3 | Reroute note (lead / link / tail) | "Reporting a specific wrong answer? The thumbs up/down under any answer in " / "the chat" / " reaches the same team, with the actual question and answer attached. Faster than describing it here from memory." | "¿Quieres reportar una respuesta específica incorrecta? El pulgar arriba/abajo debajo de cualquier respuesta en " / "el chat" / " llega al mismo equipo, con la pregunta y la respuesta reales adjuntas. Más rápido que describirlo aquí de memoria." | "Bạn muốn báo cáo một câu trả lời sai cụ thể? Nút thích/không thích dưới bất kỳ câu trả lời nào trong " / "phần trò chuyện" / " sẽ đến cùng một nhóm, kèm theo câu hỏi và câu trả lời thực tế. Nhanh hơn việc mô tả lại ở đây từ trí nhớ." | "要报告某个具体的错误回答？任何回答下方的赞/踩按钮，在" / "聊天" / "中会送达同一个团队，并附上实际的问题和回答。比在这里凭记忆描述更快。" |
| 7.4 | Message label | Your message * | Tu mensaje * | Tin nhắn của bạn * | 您的留言 * |
| 7.5 | Category label | What's this about? | ¿De qué se trata? | Về việc gì? | 关于什么？ |
| 7.6 | Category placeholder | Choose one (optional) | Elige una (opcional) | Chọn một (không bắt buộc) | 选择一项（可选） |
| 7.7 | Category: bug | Something's broken | Algo no funciona | Có gì đó bị hỏng | 有些功能坏了 |
| 7.8 | Category: suggestion | A suggestion | Una sugerencia | Một góp ý | 一个建议 |
| 7.9 | Category: question | A question | Una pregunta | Một câu hỏi | 一个问题 |
| 7.10 | Category: other | Something else | Otra cosa | Điều khác | 其他 |
| 7.11 | Email label | Email (optional, if you want a reply) | Correo electrónico (opcional, si quieres una respuesta) | Email (không bắt buộc, nếu bạn muốn nhận phản hồi) | 电子邮箱（可选，如果您想要回复） |
| 7.12 | Send button | Send feedback | Enviar comentarios | Gửi góp ý | 发送反馈 |
| 7.13 | Sending state | Sending… | Enviando… | Đang gửi… | 正在发送… |
| 7.14 | Thank-you title | Thank you | Gracias | Cảm ơn bạn | 谢谢 |
| 7.15 | Thank-you body | We read every message. If you left an email, we'll follow up if there's something to say back. | Leemos cada mensaje. Si dejaste un correo electrónico, te responderemos si hay algo que decir. | Chúng tôi đọc mọi tin nhắn. Nếu bạn để lại email, chúng tôi sẽ phản hồi nếu có điều gì cần nói lại. | 我们会阅读每条留言。如果您留下了邮箱，有需要回复的内容时我们会联系您。 |
| 7.16 | Error (generic) | Something went wrong, please try again. | Algo salió mal, inténtalo de nuevo. | Đã xảy ra lỗi, vui lòng thử lại. | 出了点问题，请重试。 |
| 7.17 | Error (network) | Network error, please try again. | Error de red, inténtalo de nuevo. | Lỗi mạng, vui lòng thử lại. | 网络错误，请重试。 |
| 7.18 | Meta title | Feedback: Demeter | Comentarios: Demeter | Góp ý: Demeter | 反馈：Demeter |
| 7.19 | Meta description | Tell Demeter what's working, what's broken, or what's missing. Read by the team that builds it. | Dile a Demeter qué funciona, qué está roto o qué falta. Lo lee el equipo que lo construye. | Cho Demeter biết điều gì đang hoạt động, điều gì bị hỏng hoặc điều gì còn thiếu. Được đọc bởi nhóm xây dựng nó. | 告诉 Demeter 哪些好用、哪些出了问题、或者还缺什么。由开发团队亲自阅读。 |

---

## 8. Detection phrases — a realism sanity-check (NOT a translation)

Behind the scenes, Demeter scans an incoming message for phrases that signal **crisis** or **acute hunger/housing** so it can lead with help. These are *trigger phrases*, not text shown to the reader. **We are not asking you to translate them** — we're asking, as a native speaker: **do these match how real people actually write these things, and what obvious ones are missing?**

Two failure modes to flag:
- **Missing (under-match):** a common real way someone would say this that isn't in the list → a person in crisis gets a plain policy answer and no hotline. This is the worse error.
- **False alarm (over-match):** an everyday phrase that would wrongly trip these → a person gets an unnecessary (but gentle) hotline line. Lower cost, but note it.

### Spanish
- **Self-harm:** *matarme · suicidarme · quitarme la vida · hacerme daño · lastimarme · quiero morir(me) · mejor muerto/a · no quiero vivir · suicidio / suicida*
- **Abuse:** *me pega · me golpea · me maltrata · me amenaza · violencia doméstica · abusa de mí · orden de restricción · (tengo) miedo/temor de mi esposo/esposa/pareja/novio/novia*
- **Hunger/housing:** *no tengo/hay comida · nada que comer · sin dinero para comida · niños con/tienen hambre · sin comer · pasando hambre · emergencia de comida · me robaron los beneficios / la EBT / las estampillas · sin hogar · desalojado(a) · durmiendo en el/mi carro/auto*

### Vietnamese
- **Self-harm:** *tự tử · tự sát · muốn chết · kết liễu*
- **Abuse:** *bạo lực gia đình · đánh tôi · chồng tôi đánh · vợ tôi đánh*
- **Hunger/housing:** *không có (gì để) ăn · hết đồ ăn/thức ăn/gạo · không có tiền mua đồ ăn · con (tôi/em) (bị) đói · nhịn đói · đang đói · chết đói · bị đuổi khỏi nhà · không có nhà · vô gia cư · ngủ ngoài đường/trong xe · trợ cấp bị cắt/mất/trộm · thẻ EBT bị mất/trộm/quẹt trộm*

### Simplified Chinese (patterns also include Traditional variants so a Traditional-writing user still triggers)
- **Self-harm:** *自杀/自殺 · 想死 · 不想活 · 轻生/輕生 · 自残/自殘*
- **Abuse:** *家暴 · 家庭暴力 · 他打我 · 她打我 · 虐待我*
- **Hunger/housing:** *没有(东西/饭/食物)吃 · 吃不上饭 · 买不起(吃的/食物/菜) · 没钱买(吃的/食物/菜) · 孩子(们)挨饿 · 饿肚子 · 挨饿 · 断粮 · 无家可归 · 被赶出 · 流浪 · 睡在车里 · 没地方住 · (福利/补助)被(停/取消/偷) · EBT被(偷/盗刷)*

For each language, please list: **(a)** any common real phrasing that's **missing**, and **(b)** anything here that would **false-alarm** on ordinary talk.

---

## 9. Reviewer focus areas — where to look hardest (per language)

*(A prioritized punch-list distilled from a first-pass review — work it top to bottom. It's a checklist, not a verdict or a limit; the full strings live in §5–§8. Priority: 🔴 do first · 🟡 should-fix · ⚪ polish.)*

> **Read this first — one gap spans all three languages.** The English detectors got a real-phrasing recall pass in the Aug 2026 launch audit (slang like *kms/unalive*, coercive-control patterns, *"haven't eaten"*, *benefits cut/denied*). **None of it was mirrored into es/vi/zh** — so the non-English crisis/hunger detectors recognize *less* than the English one, for exactly the LEP readers the translation exists to serve. Treat "bring my language to parity with English" as one job, not scattered edits. (Tracked as engineering issue #1110.)

Each language has two short lists: **Copy** — shipped strings you read and confirm — and **Detection** — trigger phrases you sanity-check for realism (§8). Add each listed phrasing unless it's marked *over-fire*.

### 9.1 Spanish (es)

*Competent, natural first pass. Register (**tú**) is consistent and deliberate across the whole shipped Spanish product — confirm it's right for the **crisis** line, don't "fix" it elsewhere. Do the crisis-line gender and the detection recall first.*

**Copy — confirm the shipped strings**

| Pri | String / surface | Confirm, or change to |
|---|---|---|
| 🔴 | Crisis self-harm **"no estás solo"** (masculine-only) | → **"no estás solo/a"** or gender-free (*"no tienes que pasar por esto en soledad"*); the abuse line already uses inclusive *"seguro/a"*. *(Test-pinned our side — just give the wording.)* |
| 🟡 | Crisis *"pensando en el suicidio"* next to *"hacerte daño"* | parallel it: *"pensando en quitarte la vida o en hacerte daño"* |
| 🟡 | Crisis line name *"La Línea 988 de…"* | confirm vs official *"988 Línea de Prevención del Suicidio y Crisis"* |
| 🟡 | *"estampillas"* | confirm as the primary term vs *"cupones de alimentos"* |
| ⚪ | *"las 24 horas"* (states hours, not days) | consider *"…, todos los días"* for the 24/7 promise |
| ⚪ | *"seguro/a"* (abuse) | *"a salvo"* removes the sure/safe ambiguity |
| ⚪ | "broken": *"está roto"* vs *"no funciona"* | unify (prefer *"no funciona"*) |
| ⚪ | rerouteLead *"el pulgar arriba/abajo"* | match the real UI label (*"el botón de me gusta / no me gusta"*) |
| ⚪ | lede *"no es X, es Y"* | use **sino**: *"…no es…, sino cualquier otra cosa…"* |
| ⚪ | freshness *"cifras federales"* (drops "benefit") | *"montos/cifras de beneficios federales"* |

**Detection — real phrasings to add** (per §8)

| Pri | Category | Missing / *over-firing* |
|---|---|---|
| 🔴 | self-harm | proclitic forms people actually type: *"me quiero morir / matar / hacer daño," "me voy a matar"*; *"estarían mejor sin mí"* |
| 🔴 | abuse | **no coercive control at all**: *"no me deja salir," "me quita la tarjeta/el dinero," "me controla todo," "me revisa el teléfono," "le tengo miedo a mi esposo"* (*a mi*, not *de mi*), *"mi ex"* |
| 🟡 | distress | *"hijos"* (only *"niños"*); benefits cut/denied (*"me cortaron/quitaron/negaron/cancelaron…"*); *"no tengo qué/para comer," "no he comido en X días," "me desalojaron," "estoy en la calle"* |
| ⚪ | dead pattern | *"emergencia de comida"* matches nothing real — replace |

### 9.2 Vietnamese (vi)

*Above typical machine quality — diacritics complete, **bạn** consistent, several idiomatic strings (*"hết gạo," "quẹt trộm"*). Spend your time on detection realism and the self-harm crisis line.*

**Copy — confirm the shipped strings**

| Pri | String / surface | Confirm, or change to |
|---|---|---|
| 🔴 | Crisis self-harm *"Đường dây 988"* (no name — barest of the four) | add a descriptive name (*"Đường dây nóng 988"*); verify **tone marks character-by-character** |
| 🔴 | Language-help wording differs: self-harm *"(có hỗ trợ tiếng Việt)"* vs abuse *"(hỗ trợ thông dịch nhiều ngôn ngữ)"* | standardize on **interpretation** (*"có thông dịch tiếng Việt"*); confirm 988 truly offers Vietnamese so it doesn't overstate |
| 🟡 | Register **bạn** | keep (warm, consistent), but confirm vs deferential **quý vị** for an elderly-skewing audience — change *everywhere* if at all |
| 🟡 | Crisis opener *"bạn không đơn độc"* (literary) | consider *"bạn không cô đơn"* / *"bạn không phải một mình"* |
| 🟡 | metaDescription *"Được đọc bởi…"* (stilted *by*-passive) | active, like the lede: *"Do nhóm xây dựng đọc"* |
| ⚪ | freshness *"Các con số liên bang"* (drops "benefit") | *"Các mức trợ cấp liên bang"* |

**Detection — real phrasings to add** (per §8)

| Pri | Category | Missing / *over-firing* |
|---|---|---|
| 🔴 | self-harm *over-fire* | *"muốn chết"* is the everyday intensifier (*"đói muốn chết"* = starving) → fires 988 **and** suppresses the food-bank lead (crisis outranks hunger). Highest-leverage fix: require a fuller phrase / exclude a preceding intensifier |
| 🔴 | self-harm | *"không muốn sống nữa," "sống không nổi," "chán sống," "tự vẫn," "kết thúc cuộc đời"*; self-harm-not-suicide: *"tự làm hại bản thân," "rạch tay/cắt tay"* (the safety line promises help for it) |
| 🔴 | abuse | **no coercive control**: *"không cho tôi ra khỏi nhà," "giữ hết tiền/thẻ EBT," "không cho gặp gia đình," "theo dõi/kiểm soát tôi"*; missing *"bạo hành," "ngược đãi," "bị đánh," "sợ chồng," "dọa giết tôi," "không an toàn ở nhà"*; register *"đánh em,"* Southern *"đánh tui"* |
| 🟡 | abuse *over-fire* | object-less *"chồng tôi đánh"* fires on *"đánh bài"* (gambles) — require a victim object |
| 🟡 | distress | *"đang đói"* over-fires ordinary hunger; add *"không đủ ăn/thiếu ăn," "không có chỗ ở," "sắp bị đuổi,"* benefits *"bị ngừng/dừng/hủy/từ chối"* |

### 9.3 Simplified Chinese (zh)

*Competent, mostly idiomatic; display copy is close to shippable. **Detection is the weakest layer** — treat this as the native pass the English detectors already got.*

**Copy — confirm the shipped strings**

| Pri | String / surface | Confirm, or change to |
|---|---|---|
| 🔴 | Same-answer pronoun clash: crisis **你** vs freshness **您** (both can render in one answer) | pick one in-answer voice and make them agree |
| 🔴 | Crisis *提供中文服务* (bare claim) | verify 988 offers Chinese + by what mechanism; if interpreter-based → *可要求中文口译* |
| 🟡 | Feedback **您** vs chat **你** | confirm the split is intentional (different surfaces) |
| 🟡 | category *一个问题* (question *or* problem, next to the bug option) | *一个疑问* |
| 🟡 | reroute *踩* (downvote slang) / *送达* (miscollocates with buttons) | clearer downvote wording; *会发送给同一个团队* |
| 🟡 | freshness *联邦标准* (vague) | *联邦福利金额/标准* |
| ⚪ | *关于什么？* (clipped) | *这是关于什么的？* / *您想反馈什么？* |
| ⚪ | spacing *2026 财年* vs Mainland *2026财年*; *。* vs *.* | pick one convention across files |

**Detection — real phrasings to add** (per §8)

| Pri | Category | Missing / *over-firing* |
|---|---|---|
| 🔴 | abuse | *他打我/她打我* only match contiguous + pronoun-led → *老公/丈夫/男朋友打我* and inserted words (*他会/经常打我, 他打了我*) **miss**; **zero coercive control** (*他不让我出门, 他控制我的钱, 他抢走我的EBT卡, 他威胁我*); threats/not-safe (*他威胁要杀我, 我在家里不安全*) |
| 🔴 | self-harm *over-fire* | bare *想死* is heavy hyperbole (*累得想死*) — the Chinese twin of "paperwork is killing me"; add pinned non-matches or require context |
| 🟡 | self-harm | *活不下去* (*不想活* does **not** catch it — word order), *想不开* (pre-suicide euphemism), *结束生命/结束自己, 一了百了, 割腕* |
| 🟡 | distress | standalone *没吃的/家里没吃的了*; *没吃饭/好几天没吃饭了* ("haven't eaten"); benefits *福利停了/被砍/被拒/被终止*, community term *食品券/粮食券*; housing *房东要赶我走/露宿街头/睡大街*; *流浪* over-fires on *流浪猫/狗* |

---

## 10. Scope

**In scope:** correctness, naturalness, tone/register, and factual clarity of the strings above.
**Out of scope:** the English source copy itself; the legal documents (privacy/terms/safety — English-only, tracked separately in #1013); the AI-generated *answers* (those are produced live, not fixed strings; if you notice a systematic answer-language issue, note it separately). Layout/design is not your concern — just the words.

**How to return:** the filled-in table from §3 (plus §8 lists and any §4 register decisions) — reply on issue #1082, email, or a shared doc, whatever's easiest. Thank you. This directly protects the readers this tool was built for.
