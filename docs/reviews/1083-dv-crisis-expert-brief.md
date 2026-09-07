# Reviewer brief — crisis / domestic-violence expert review of Demeter's safety gates

**For:** a crisis-line and/or domestic-violence **professional** (advocate, counselor, hotline clinician, or someone who trains them).
**Tracks:** [issue #1083](https://github.com/matthewgg22/Civica/issues/1083)
**Est. time:** 60–90 min.
**Deadline:** the pattern review (§4.1) is a launch-readiness item; the coercive-control design (§4.2) can follow shortly after.

---

## TL;DR — what we're asking

Demeter is a **free public SNAP (food-benefits) chatbot** for a heavily limited-English-proficient, low-income US audience. Because it invites people to describe their situation "in their own words," it **will** receive messages disclosing **suicidal thoughts** or **abuse** — often alongside a food-insecurity question. When it detects that, it leads the answer with a crisis resource (988 / the National DV Hotline) and, as a backstop, deterministically appends the hotline if the answer didn't include it.

We built these gates carefully but **without clinical training.** We need your professional eye on two things:

1. **Do the detectors catch how people really disclose, without over-firing?** (§4.1)
2. **Coercive control** — the abuse detector keys on named physical violence and we've begun adding control/confinement/financial/surveillance patterns, but this is the piece that most needs a DV advocate's judgment. (§4.2)

You don't need to read code. Everything is quoted in plain language below. Give feedback in the format in §7.

> **One framing note that drives every design choice here.** We treat a **false negative** (someone says they want to die, gets a paragraph about paperwork, no hotline) as **far worse** than a **false positive** (someone gets one gentle, unneeded line and a number). So we bias toward **recall**. The one guardrail on that: the detector must not fire on ordinary idiom like *"this paperwork is killing me"* or *"I'm dead broke,"* because a tool that mishandles the idiom won't be trusted with the real thing. Please push on both sides of that tradeoff.

---

## 2. How the system behaves (so your review targets the right thing)

1. **Detect.** Every incoming message is scanned by two independent detectors:
   - a **crisis** detector → returns `self_harm`, `abuse`, or nothing;
   - a **distress** detector → flags acute **food/housing** crisis (hunger, eviction, EBT stolen/cut).
2. **Instruct.** If crisis is detected, the AI is told to **open with** two–three short lines: acknowledge plainly and without alarm, give the relevant hotline, then **still answer the benefits question in full.** The shape is **acknowledge → resource → keep helping** — deliberately *not* "refuse and redirect." (Rationale: someone may disclose abuse precisely because it bears on their SNAP case — who's in the household changes eligibility — so withholding the answer would be both unhelpful and would teach them not to mention it again.)
3. **Backstop.** Because an instruction to a model is not a guarantee (a truncated or non-compliant answer could drop the number), the system checks the **finished** answer: if the hotline number isn't detectably present, it **appends a fixed, human-written safety line** (quoted in §6). Bias is one-directional on purpose — when unsure, append. So: **whether a person in crisis sees a hotline at all depends on the detector firing.** That's why recall is the whole game.

Both detectors run in **English, Spanish, Vietnamese, and Chinese.** (The *wording* of the localized safety lines is being checked by native speakers separately, in #1082 — here we care about clinical soundness and coverage, and you can review the English as representative.)

---

## 3. What's already been done (so you can go beyond it)

An adversarial self-audit (Aug 2026) already closed the biggest **recall** gaps in English. The self-harm detector now catches, among others: *kms · unalive · "I don't want to be alive anymore" · "I'm going to end it tonight" · "there's no point in living" · "everyone would be better off without me" · "I'd rather be dead" · "I wish I wasn't here".* The distress detector was extended for *"going to bed hungry," "zero dollars for groceries," "SNAP got cut off."* The abuse detector was extended with a first pass at coercive control (see §5).

So please **assume the obvious ones are covered** and spend your expertise on what a layperson audit would still miss, and on the clinical-quality questions in §4.

---

## 4. The two things we need from you

### 4.1 Expert review of the detection patterns

For **self-harm**, **abuse**, and **food/housing distress** (full inventories in §5):

- **Recall — what do we still miss?** High-signal phrasings, especially: indirect/passive disclosure ("I don't see the point anymore," "I just want it to stop"), means/plan language, culturally specific idioms, youth vernacular, and the ways LEP speakers phrase these. For each, tell us how confident you'd be that it signals real risk (so we can weigh it against false positives).
- **Precision — where do we over-fire?** Any pattern likely to trip on ordinary benefits talk or non-crisis idiom (see the idiom guards we already protect, §5.4). Over-firing is a lesser harm here, but a pattern that fires constantly trains people to ignore the line.
- **The response shape.** Is **acknowledge → resource → keep-helping** (rather than refuse-and-redirect) clinically sound for this channel? Is "say it once, warmly and briefly — repeating it reads as a script rather than as care" the right instinct, or should some situations repeat/escalate?
- **The copy.** Anything in the tone or content of the safety-net lines or the model instructions (§6) you'd change.
- **The facts.** Confirm the hotline details are current and correctly stated (§8).

### 4.2 Coercive control — the known gap (needs your design input most)

The abuse detector historically keyed on **named physical violence** ("he hits me," "beats me," "not safe at home"). It **missed coercive control without a named hit** — confinement, financial control, surveillance, isolation — which are core DV patterns a benefits chat will hear ("he won't let me leave," "he takes my EBT card," "he controls all the money," "tracks where I go").

We've added a **first pass** at these (listed in §5.3). We deliberately kept them narrow because these phrasings are broad and risk false positives on ordinary talk (*"my disability won't let me work," "who controls the SNAP program"*). **This is where we most want a DV advocate's judgment:**

- Are the coercive-control patterns we added the right ones, and phrased the way survivors actually disclose?
- What are we still missing (e.g. reproductive coercion, immigration-status threats — highly relevant for this LEP audience, threats involving children, tech/financial abuse specific to benefits like EBT-card control)?
- For each addition you'd suggest, what's the **false-positive guard** — the everyday phrase it must *not* fire on?
- Given this audience: **immigration-related coercion** ("he'll have me deported if I leave," "he has my papers") is plausibly common and high-stakes. Should that route to the DV hotline, a different resource, or both?

---

## 5. Full pattern inventory (plain language)

These are the actual triggers, translated from code into plain phrasings. A match is a **phrase**, not a bare word (that's how the idiom guards in §5.4 hold).

### 5.1 Self-harm → routes to 988
- "kill / hurt / harm / cut myself" (and -ing forms)
- "end my life," "end it all," "take my own life"
- "better off dead," "want to die," "wanna die," "want to be dead"
- "don't want to be here / be alive / live (anymore)"
- "suicide / suicidal"
- **kms** (abbreviation for "kill myself"); **unalive** (moderation-evasion euphemism)
- "wish I was/were dead / wasn't here / wasn't born"
- "(I'd) rather be dead"
- "end it/things/everything tonight / today / now / soon / for good"
- "no point / no reason in living / going on / keeping going / being here"
- "better off without me"
- **Spanish:** matarme · suicidarme · quitarme la vida · hacerme daño · lastimarme · "quiero morir(me)" · "mejor muerto/a" · "no quiero vivir" · suicidio/suicida
- **Vietnamese:** tự tử · tự sát · muốn chết · kết liễu
- **Chinese:** 自杀/自殺 · 想死 · 不想活 · 轻生/輕生 · 自残/自殘

### 5.2 Abuse — named physical violence → routes to National DV Hotline
- "[he/she/they/husband/wife/partner/boyfriend/girlfriend/bf/gf] … hits / beats / hurts / chokes / strangles me"
- "hits/beats/hurts me," "beat me up"
- "is/was/being abusive," "abuses me," "my abuser"
- "scared / afraid / terrified of my [husband/wife/partner/…/ex]"
- "domestic violence," "restraining order"
- "not safe at home / here," "threatened to kill me," "threatens me"
- **Spanish:** "me pega/golpea/maltrata/amenaza" · "violencia doméstica" · "abusa de mí" · "orden de restricción" · "miedo/temor de mi esposo/esposa/pareja/novio/novia"
- **Vietnamese:** bạo lực gia đình · đánh tôi · chồng tôi đánh · vợ tôi đánh
- **Chinese:** 家暴 · 家庭暴力 · 他打我 · 她打我 · 虐待我

### 5.3 Coercive control — first pass (§4.2 is about improving this) → routes to National DV Hotline
- "won't / will not / doesn't / don't let me leave"
- "not allowed to leave / have (any) money / see (my) friends/family/anyone / go out"
- "takes / took / controls / keeps / hides (all) my/the money / paycheck / pay / benefits / EBT / SNAP card / card / phone / passport / documents / keys"
- "controls everything / where I (can) go / what I (do/can do/buy/eat) / who I (see/talk to)"
- "tracks / monitors / watches my (or all my) location / phone / messages / texts / calls / every move / whereabouts"
- "isolates me," "cut me off from (my) family/friends/everyone"
- "won't/doesn't let me see (my) family/friends/kids / have (a) phone/money / go anywhere"

### 5.4 Idiom guards — patterns that must NOT fire (already test-pinned)
These are intentionally treated as **non-matches**; please confirm they're right and flag any others we should protect:
- self-harm idiom: *"this paperwork is killing me," "I'm dead broke," "dying to know if I qualify," "my benefits died last month"*
- coercive-control false friends: *"my disability won't let me work," "who controls the SNAP program"*
- ordinary distress: *"how do I apply," "income limit for a family of 3," "interview tomorrow," "got approved"* (must not read as crisis)

### 5.5 Food / housing distress → leads answer with expedited-SNAP rights, 211, food banks
"no food for/to feed," "nothing to eat," "out of food," "can't afford/buy food," "kids are/go to bed hungry," "haven't eaten," "starving," "going hungry," "food emergency," "empty fridge," "no money for food/groceries," "benefits were cut/stopped/stolen," "EBT stolen/skimmed/emptied," "homeless," "evicted," "sleeping in my/the car," "shelter tonight," "zero dollars for groceries," "SNAP/EBT/food stamps/CalFresh got cut off/denied/terminated/taken away" (+ es/vi/zh equivalents).

---

## 6. The safety copy (verbatim)

### Deterministic safety-net lines (appended if the answer omits the number)
- **Self-harm (en):** *"**If you're thinking about suicide or self-harm, you're not alone.** The 988 Suicide & Crisis Lifeline is free, confidential, and open 24/7 — call or text **988** (press 2 for Spanish)."*
- **Abuse (en):** *"**If you're not safe at home, help is available.** The National Domestic Violence Hotline is free, confidential, and open 24/7 — call **1-800-799-7233** or text **START to 88788** (interpretation in many languages)."*
- *(es/vi/zh versions exist and are being checked by native speakers in #1082; review the English as representative of the content.)*

### What the AI is instructed to do (the "system addendum")
- **Both:** *"Do not diagnose, label, or speculate about what they are experiencing. Do not moralise, and do not make continuing the conversation conditional on them contacting anyone. Say it once, warmly and briefly — repeating it reads as a script rather than as care. Then still answer their benefits question, in full and as usual."*
- **Self-harm adds:** open with two–three short lines that acknowledge plainly and without alarm, and give 988 (free/confidential/24-7, call or text, press 2 for Spanish).
- **Abuse adds:** acknowledge plainly and without alarm, give the National DV Hotline (1-800-799-7233 / text START to 88788, interpretation available); and *"if they have left or are planning to, note that who counts as part of their household can change, which affects a SNAP application — but only state specifics that the sources actually support."*

Questions for you on the copy: Is "you're not alone" / "help is available" the right opener, or too light? Is it right that we **don't** make continuing conditional on calling? For abuse, is it appropriate to connect the disclosure to the benefits mechanics (household composition) in the same breath, or should safety come fully first? Is anything here potentially **unsafe** for a survivor whose device may be monitored (e.g. should we add a "clear your history / use a safe device" note, or would that itself raise risk)?

---

## 7. How to give feedback

Use whatever's easiest (reply on issue #1083, a doc, or email). This structure helps us act on it:

**A. Missed phrasings** — one row each:

| Category (self-harm / abuse / coercive-control / distress) | Phrasing people actually use | How strong a risk signal (high/med/low) | False-positive risk to watch |
|---|---|---|---|

**B. Over-matches** — patterns from §5 you think will fire wrongly, and on what.

**C. Coercive-control design (§4.2)** — additions with, for each, the survivor-realistic phrasing **and** the everyday phrase it must not fire on.

**D. Response shape & copy (§6)** — anything to change in the flow, tone, or safety of the copy.

**E. Facts** (§8) — confirm or correct.

---

## 8. Facts to verify (please confirm current & correct)

- **988 Suicide & Crisis Lifeline** — reachable by **call or text to 988**; **press 2 for Spanish**; free, confidential, 24/7. (Is "press 2 for Spanish" still accurate? Is there a better instruction for other languages?)
- **National Domestic Violence Hotline** — **1-800-799-7233**; **text START to 88788**; free, confidential, 24/7; "interpretation in many languages." (Correct number and short-code? Is "START" still the trigger word?)
- **988 Spanish on the TEXT path.** "Press 2 for Spanish" is the *call* routing; the copy also invites *texting* 988 — confirm how Spanish (and other languages) are reached when texting/chatting, not just calling.
- **211** (call or 211.org) for local food banks / community meals — cited in the food/housing distress response; confirm nationwide coverage and that "no paperwork needed" is safe to state everywhere.
- **Expedited SNAP timing.** The hunger response tells people that if they apply and qualify for expedited service, benefits must be available **within 7 days** (federal standard). Confirm that's stated correctly and current.
- **National DV Hotline extra channels** (if you'd want them added): TTY (historically **1-800-787-3224**) and online chat at **thehotline.org** — a non-voice path for a survivor who can't safely call.
- Any resource you'd **add** for this audience (e.g. a warmline, a youth-specific line, a text-first option, an immigrant-survivor-specific resource).

---

## 9. Reviewer focus & candidate leads

*(A prioritized candidate list from an internal review pass — leads to weigh with your judgment, not conclusions. Nothing is decided; you accept, reject, or reword each, and each carries its false-positive cost. Priority: 🔴 highest-signal / likely-add · 🟡 worth considering · ⚪ your call. Sections map to the pattern groups in §5.)*

### 9.1 Missed phrasings — self-harm

| Pri | Phrasing people use | Note / false-positive risk |
|---|---|---|
| 🔴 | *"nothing to live for," "not worth living," "what's the point anymore"* | high-signal hopelessness; low FP |
| 🔴 | *"so tired of living," "tired of being alive," "I just want to disappear"* | passive death-wish; low–moderate FP |
| 🟡 | passive: *"I don't want to wake up," "hope I don't wake up (tomorrow)"* | may want a time/fatigue guard (*"wake up early for the interview"*) |
| 🟡 | *"thinking about ending it," "ready to end it," "I want it all to end"* | bare *"ending it"* needs a despair/human frame |
| 🟡 | means: *"overdose," "take all my pills"* | *"OD"* is high FP (overdraft) — exclude the abbreviation |
| 🟡 | bare noun *"self-harm" / "self harming"* | regex needs *verb + myself*; low FP |
| ⚪ | re-examine an exclusion: keep *"I can't do this anymore" / "I give up"* out? Are *"I can't keep living" / "I can't go on"* acute enough to include? | your call on the FP trade |

### 9.2 Missed phrasings — abuse

| Pri | Phrasing people use | Note / false-positive guard |
|---|---|---|
| 🔴 | past tense + full verb family: *"he hit me," "punched / slapped / kicked / pushed / shoved / grabbed me"* | **likely the single largest abuse gap** (set is present-tense *hits/beats/hurts/chokes/strangles* only). Guard: human subject (*"the news hit me"*) |
| 🔴 | immigration coercion (LEP-critical): *"he'll call ICE," "report me to immigration," "have me deported," "took my green card/papers so I can't leave"* | guard on a threat/withholding verb — **never** the word "immigration" alone |
| 🔴 | weapon/threat: bare past *"threatened me," "threatened me with a knife/gun," "pointed a gun at me"* | highest-lethality; low FP |
| 🟡 | sexual violence: *"forces me to have sex," "rapes me," "forced himself on me"* | you decide: DV hotline, or surface a sexual-assault resource? |
| 🟡 | fear of home / being found: *"scared to go home," "scared he'll find me"* | current pattern needs *"of my [partner]"* |
| 🟡 | stalking: *"he stalks me," "follows me," "shows up at my work"* | surveillance patterns are digital-only today |
| 🟡 | threats against children: *"he'll take the kids if I leave," "says he'll hurt the kids"* | guard: threat verb + conditional-on-leaving |
| — | **Non-English:** es/vi/zh abuse + self-harm sets are thinner and didn't get the launch expansion — see the native-speaker brief (#1082); flag anything clinically essential that must exist in all four languages. | |

### 9.3 Coercive-control additions (the §4.2 design) — candidates with guards

| Intent | Example phrasings | False-positive guard |
|---|---|---|
| Economic / employment sabotage | *"won't let me get a job," "makes me quit," "makes me hand over every paycheck," "ask permission to spend anything"* | require a **human/relationship subject** — not the pinned *"my disability won't let me work"* or SNAP work-requirement Qs |
| Immigration-status coercion | (as §9.2) | threat/withholding verb + immigration object; never neutral policy Qs |
| Document / ID / benefits withholding | *"won't give me my ID back," "keeps my Social Security card," "took my EBT card and won't give it back"* | withholding verb + *my* + ID/benefits noun; **disambiguate from EBT theft** (hunger gate, not DV) |
| Everyday digital surveillance | *"goes through my phone," "reads my texts," "checks my messages," "put a tracker on my car," "makes me share my location"* | *my* + device/comms noun + nearby human subject; not *"I check my phone for the code"* |
| Isolation / permission-for-basics | *"have to ask permission to leave," "won't let me go to the store alone," "won't let me talk to my family," "cut off my phone"* | human subject + basic-need/contact object; not SNAP procedural-permission Qs |
| Reproductive coercion | *"won't let me use birth control," "hides my birth control," "forces me to get pregnant"* | keep tight (low frequency here) |
| Benefits diversion / coerced case control *(bears on the answer — recall matters twice)* | *"makes me put the SNAP case in his name," "spends all my food stamps on himself," "makes me sign over my benefits"* | human subject + control verb + benefits object; distinguish from theft **and** authorized-rep Qs (*"can my daughter use my EBT"*) |
| Threats to children/pets as leverage | *"he'll take the kids if I leave," "threatened to kill the dog," "she'll call CPS on me if I go"* | threat verb + dependent object + conditional-on-leaving; not custody/CPS policy Qs |

### 9.4 Over-match stress-tests (please try to break these)

| Pri | Pattern | Fires wrongly on |
|---|---|---|
| 🔴 | `hits/hurts me` | *"my back hurts me," "the arthritis hurts me"* — somatic complaint from an older/disabled applicant. Not currently pinned |
| 🔴 | coercive-control `takes/keeps my card/phone` | *"my son took my phone," "the store/ATM kept my card," "the county took my benefits"* |
| 🟡 | `not allowed to have money` | asset-limit Qs (*"not allowed to have savings and still qualify"*) |
| 🟡 | `controls what I can buy/eat` | SNAP-rules Qs (*"SNAP controls what I can buy"*) — what this audience actually asks |
| 🟡 | `kms` | kilometers (*"the office is 20 kms away"*) — worth a pinned non-match |
| 🟡 | *"don't want to be here anymore" / "no point in going on"* | place-frustration / application-abandonment (*"no point going on with this paperwork"*) |
| ⚪ | distress *starving / haven't eaten / homeless* | hyperbole (*"starving, when's lunch"*) + neutral policy Qs — cheap, but each over-fire dilutes the crisis lead |

### 9.5 Response-shape & copy questions for your sign-off
- Is continuing **straight into the benefits answer after a suicidal disclosure** clinically right? (This is the part most worth a clinician's explicit sign-off.)
- *"Say it once … repeating reads as a script"* — sound for low-acuity, but for an explicit high-acuity self-harm statement, should the resource be **unmissable even at the cost of repetition**?
- The DV net opens *"If you're not safe at home"* — that assumes **cohabitation**; abuse often comes from an ex or non-cohabiting partner, or someone who has already left. Is *"If you're not safe"* more inclusive?
- **No 911 / emergency path** exists even for imminent-lethality phrasings (weapon, "threatened to kill me"). The hotline-only stance is defensible (911 has its own risks and uneven LEP language access) — but please **explicitly endorse or amend** it rather than leave it a default.
- Should the DV net offer a **non-voice channel** (online chat at thehotline.org, TTY) for a survivor under surveillance who cannot safely call?
- The vi/zh self-harm lines imply **native-language 988 service** (*"có hỗ trợ tiếng Việt" / "提供中文服务"*). If 988 serves those via interpretation, the copy may overstate — confirm what a VI/ZH caller actually reaches (also in the native-speaker brief, #1082).

---

## 10. Scope & a note of thanks

**In scope:** clinical soundness, recall/precision, and safety of the crisis + distress + abuse detection and response.
**Out of scope:** the exact non-English wording (native-speaker review, #1082); the general product; anything requiring changes to what SNAP itself provides.

We know this is heavy material. Your review directly determines whether someone reaching this tool in their worst moment is met with a real resource instead of a policy paragraph. Thank you.
