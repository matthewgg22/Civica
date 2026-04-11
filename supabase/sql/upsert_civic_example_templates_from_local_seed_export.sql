-- Backfill/upsert civic premade cards from the exported local seed set.
-- Source JSON: exports/fallback_premade_scripts_supabase 3/civic_example_templates.clean.json
--
-- This script preserves existing seed copy exactly for title/category/summary/scripts,
-- and writes rows keyed by slug into public.civic_example_templates.

begin;

with payload as (
  select
    $SEEDS$
[
  {
    "issue_id": "stop-unauthorized-military-strikes-on-iran",
    "slug": "stop-unauthorized-military-strikes-on-iran",
    "title": "Stop Unauthorized Military Strikes on Iran",
    "category": "Foreign Affairs",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "support",
    "summary": "On March 4-5, 2026, the Senate voted 53-47 and the House voted 219-212 against war-powers measures that would have required congressional authorization for hostilities against Iran. Reuters noted that the 1973 War Powers Resolution still gives the administration only 60 days to continue unauthorized military action, putting a deadline at the end of April 2026 unless Congress approves it. The issue is whether Congress will reassert its constitutional role before the conflict widens.",
    "related_bills": [],
    "template_asks": [
      "support",
      "ask_public_statement",
      "seek_oversight"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support [BILL_OR_RESOLUTION] and oppose any unauthorized U.S. war with Iran. Congress must reassert its constitutional authority and prevent further escalation without a vote.\n\nPlease speak out publicly, support immediate de-escalation, and vote to block any continued military action that has not been authorized by Congress.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, my name is [YOUR_NAME], and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support [BILL_OR_RESOLUTION] and oppose unauthorized military action against Iran. The United States should not be pulled deeper into another war without congressional approval.\n\nPlease take public action to defend Congress's war powers and push for de-escalation.\n\nThank you.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "foreign-policy",
      "war-powers",
      "congress",
      "deescalation",
      "iran"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 1
  },
  {
    "issue_id": "protect-trans-rights-and-gender-affirming-care",
    "slug": "protect-trans-rights-and-gender-affirming-care",
    "title": "Protect Trans Rights and Gender-Affirming Care",
    "category": "LGBTQ",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "oppose",
    "summary": "Kansas became the 27th state to enact restrictions on gender-affirming care for minors, even as the APA continues to support \"unobstructed access\" to evidence-based care and the Endocrine Society says this care is \"needed and often life-saving.\" On March 19, 2026, a federal judge said he would block HHS from using RFK Jr.'s declaration to threaten providers, in a case brought by 19 states and Washington, D.C.; those states said three hospitals had already been referred to HHS's inspector general. The issue is whether federal policy will override major medical guidance and state protections.",
    "related_bills": [],
    "template_asks": [
      "oppose",
      "ask_public_statement",
      "support"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to defend transgender people and oppose federal attacks on gender-affirming care. Please oppose any ban on care, reject anti-trans censorship bills like [BILL_OR_RESOLUTION], and fight policies that strip trans people of safety, dignity, and medically necessary treatment.\n\nTrans people deserve evidence-based care and equal protection under the law, not political targeting.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP].\n\nI'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to protect trans rights and oppose new federal restrictions on gender-affirming care and anti-LGBTQ censorship. Please speak out publicly and vote against measures that harm transgender people and their families.\n\nThank you.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "trans-rights",
      "lgbtq",
      "healthcare",
      "civil-rights",
      "anti-discrimination"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 2
  },
  {
    "issue_id": "demand-the-resignation-of-fbi-director-kash-patel",
    "slug": "demand-the-resignation-of-fbi-director-kash-patel",
    "title": "Demand the Resignation of FBI Director Kash Patel",
    "category": "Government Oversight",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "seek_oversight",
    "summary": "In March 2026, Reuters reported that a special-counsel probe had sought more than two years of Patel's phone records, text logs, IP data, and financial information, with subpoenas covering periods from October 1, 2020, to February 22, 2023, and from January 1, 2021, to November 23, 2023. Days earlier, two former FBI agents sued Patel, saying they were fired over work on the \"Arctic Frost\" election investigation and had been unable to find new employment since. The issue is whether Congress treats this as an oversight crisis involving retaliation, management, or both.",
    "related_bills": [],
    "template_asks": [
      "seek_oversight",
      "ask_public_statement",
      "oppose"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to demand FBI Director Kash Patel's resignation and support aggressive oversight into his conduct. Reports about misuse of government resources, retaliation, and mismanagement at the FBI are serious and demand a response.\n\nIf Patel refuses to resign, [OFFICIAL_TITLE] [OFFICIAL_LAST] should support formal investigations and pursue every available accountability measure.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to call for Kash Patel's resignation and back immediate oversight of his conduct as FBI director. The bureau should never be used as a tool for personal privilege or political retaliation.\n\nPlease take public action on this issue.\n\nThank you.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "oversight",
      "fbi",
      "accountability",
      "corruption",
      "rule-of-law"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 3
  },
  {
    "issue_id": "oppose-steve-pearce-as-blm-director",
    "slug": "oppose-steve-pearce-as-blm-director",
    "title": "Oppose Steve Pearce as Bureau of Land Management Director",
    "category": "Nominations",
    "target_chambers": [
      "senate"
    ],
    "primary_ask": "vote_no",
    "summary": "Trump nominated Stevan Pearce on November 5, 2025 to run the Bureau of Land Management, the agency that oversees 245 million acres of public land. Reuters noted Pearce, 78, comes from New Mexico, has long backed expanded oil production, and previously owned an oilfield services company; as BLM director he would oversee leasing for oil and gas, mining, grazing, and renewable energy. The issue is whether the Senate wants a BLM chief aligned more with extraction or stewardship.",
    "related_bills": [],
    "template_asks": [
      "vote_no",
      "oppose",
      "ask_public_statement"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge Senator [OFFICIAL_LAST] to oppose Steve Pearce's confirmation as Director of the Bureau of Land Management. His record shows too much alignment with oil and gas interests and too little commitment to protecting public lands for future generations.\n\nPlease vote no on his confirmation and speak out in defense of our public lands.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME], and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to ask Senator [OFFICIAL_LAST] to oppose Steve Pearce for BLM director. This position should go to someone committed to stewardship of public lands, not someone whose record raises concerns about extraction and selloffs.\n\nThank you.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "nominations",
      "public-lands",
      "environment",
      "senate",
      "blm"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 4
  },
  {
    "issue_id": "oppose-the-save-america-act",
    "slug": "oppose-the-save-america-act",
    "title": "Oppose the SAVE America Act",
    "category": "Voter Rights",
    "target_chambers": [
      "senate"
    ],
    "primary_ask": "oppose",
    "summary": "On February 11, 2026, the House passed the SAVE America Act by 218-213, and Reuters said it then faced a likely 60-vote Senate hurdle. Reuters also reported that about 12% of Americans do not have easy access to either a passport or birth certificate, and about 21 million eligible voters lack easy access to citizenship documents; AP noted that only five states issue enhanced driver's licenses that prove citizenship. The issue is whether proof-of-citizenship rules solve a meaningful problem or create documentation barriers for eligible voters.",
    "related_bills": [],
    "template_asks": [
      "oppose",
      "vote_no",
      "ask_public_statement"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge Senator [OFFICIAL_LAST] to oppose the SAVE America Act and any effort to force it through the Senate. This bill would create unnecessary documentation barriers that make it harder for eligible citizens to register and vote.\n\nPlease defend voting rights, reject this bill, and oppose any attempt to make voting less accessible for lawful voters.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP].\n\nI'm calling to ask Senator [OFFICIAL_LAST] to oppose the SAVE America Act. Eligible Americans should not lose access to the ballot because of burdensome paperwork requirements.\n\nPlease vote no and speak out against this bill.\n\nThank you.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "voting-rights",
      "democracy",
      "senate",
      "ballot-access",
      "elections"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 5
  },
  {
    "issue_id": "oppose-casey-means-for-surgeon-general",
    "slug": "oppose-casey-means-for-surgeon-general",
    "title": "Oppose Casey Means for U.S. Surgeon General",
    "category": "Nominations",
    "target_chambers": [
      "senate"
    ],
    "primary_ask": "vote_no",
    "summary": "Casey Means's nomination has stalled after a February hearing where Reuters reported her Oregon medical license is inactive, she left her surgical residency early, and she declined to disavow RFK Jr.'s debunked autism-vaccine claim even while expressing support for measles vaccination. AP reported that senators from both parties questioned her qualifications and vaccine views, and that the confirmation process had stretched to roughly 300 days. The issue is whether the Senate wants a surgeon general with traditional public-health credentials or a more heterodox wellness profile.",
    "related_bills": [],
    "template_asks": [
      "vote_no",
      "oppose",
      "ask_public_statement"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge Senator [OFFICIAL_LAST] to oppose Casey Means for U.S. Surgeon General. This role should go to someone with strong public health credibility, clear support for evidence-based medicine, and full public trust.\n\nPlease vote no on this nomination and speak out for qualified, science-based public health leadership.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP].\n\nI'm calling to ask Senator [OFFICIAL_LAST] to oppose Casey Means for Surgeon General. The country needs trusted, evidence-based public health leadership in this role.\n\nPlease vote no on this nomination.\n\nThank you.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "nominations",
      "public-health",
      "senate",
      "science",
      "surgeon-general"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 6
  },
  {
    "issue_id": "support-tps-extension-for-haitians",
    "slug": "support-tps-extension-for-haitians",
    "title": "Support Temporary Protected Status for Haitians",
    "category": "Immigration",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "support",
    "summary": "On March 16, 2026, the Supreme Court agreed to hear the administration's attempt to end TPS for more than 350,000 Haitians, but left lower-court protections in place for now. Reuters notes that the State Department still warns Americans not to travel to Haiti because of kidnapping, crime, terrorist activity, civil unrest, and limited healthcare; meanwhile, the U.N. reported 5,519 people killed between March 1, 2025, and January 15, 2026, and IOM reported that more than 1.4 million people have been displaced. The issue is whether the U.S. should withdraw protections while conditions remain this severe.",
    "related_bills": [],
    "template_asks": [
      "support",
      "ask_public_statement",
      "seek_oversight"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support continued Temporary Protected Status for Haitians and oppose any effort to strip those protections away.\n\nPlease speak out publicly, support every available legislative and oversight tool to protect Haitian TPS holders, and reject deportation policies that would put families at risk.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support TPS protections for Haitians and oppose efforts to end them. Haitian families deserve stability and protection, not more fear and uncertainty.\n\nThank you.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "immigration",
      "tps",
      "haiti",
      "humanitarian",
      "deportation"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 7
  },
  {
    "issue_id": "protest-the-epa-repeal-of-the-endangerment-finding",
    "slug": "protest-the-epa-repeal-of-the-endangerment-finding",
    "title": "Protest the EPA's Repeal of the Endangerment Finding",
    "category": "Environment",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "oppose",
    "summary": "On February 12, 2026, EPA repealed the 2009 endangerment finding that underpins federal greenhouse-gas regulation. On March 19, 2026, 23 states and 14 cities and counties sued to reverse the move, and Reuters noted the rollback also swept in vehicle greenhouse-gas rules for model years 2012 through 2027. The issue is whether Congress and the courts will allow the federal government to dismantle the legal basis for national climate rules.",
    "related_bills": [],
    "template_asks": [
      "oppose",
      "seek_oversight",
      "ask_public_statement"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to oppose the repeal of the EPA's endangerment finding and defend strong federal climate protections.\n\nPlease support aggressive oversight and legislation to restore meaningful greenhouse-gas standards and protect communities from dangerous pollution.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP].\n\nI'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to oppose the repeal of the EPA's endangerment finding and defend strong climate and public-health protections.\n\nPlease take public action on this issue.\n\nThank you.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "climate",
      "epa",
      "pollution",
      "public-health",
      "environment"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 8
  },
  {
    "issue_id": "block-trumps-push-to-take-control-of-greenland",
    "slug": "block-trumps-push-to-take-control-of-greenland",
    "title": "Block Trump's Push to Take Control of Greenland",
    "category": "Foreign Affairs",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "oppose",
    "summary": "On February 2, 2026, Greenland Prime Minister Jens-Frederik Nielsen said Washington still fundamentally sought control of Greenland and called the pressure \"completely unacceptable.\" Reuters also reported the standoff was serious enough to show up in a Greenland mental-health survey measuring anxiety over U.S. pressure. The issue is whether Congress should block any funding or authorization for coercive action against an autonomous Danish territory and NATO partner.",
    "related_bills": [],
    "template_asks": [
      "oppose",
      "ask_public_statement",
      "support"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to reject any attempt by the administration to seize, pressure, or coerce Greenland.\n\nThe United States should respect Greenlandic and Danish sovereignty, protect our alliances, and make clear that Congress will not support reckless attempts to take control of allied territory.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to oppose any U.S. attempt to take control of Greenland and to defend allied sovereignty and international stability.\n\nPlease speak out publicly on this issue.\n\nThank you.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "foreign-policy",
      "greenland",
      "sovereignty",
      "diplomacy",
      "congress"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 9
  },
  {
    "issue_id": "protect-state-level-ai-regulation",
    "slug": "protect-state-level-ai-regulation",
    "title": "Protect State-Level AI Regulation",
    "category": "Digital Rights",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "oppose",
    "summary": "On March 20, 2026, the White House released a national AI framework that explicitly calls on Congress to preempt state AI rules, after Trump had already threatened in December 2025 to withhold federal broadband funds from states whose AI laws the administration views as too restrictive. NCSL says all 50 states introduced AI legislation in 2025 and 38 states enacted about 100 measures; Reuters also reported the Senate voted 99-1 in July 2025 to strip a proposed 10-year federal moratorium on state AI laws. The issue is whether states keep regulating AI until Congress passes a durable federal standard.",
    "related_bills": [],
    "template_asks": [
      "oppose",
      "ask_public_statement",
      "seek_oversight"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to protect states' ability to regulate artificial intelligence and oppose any federal effort to punish states for passing basic AI safeguards.\n\nCongress should not strip states of the power to enact consumer protections while federal law remains incomplete. Please oppose preemption and any funding threats tied to state AI regulation.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP].\n\nI'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to protect state authority to regulate AI and oppose efforts to override state safeguards or threaten funding.\n\nPlease defend the ability of states to protect their residents.\n\nThank you.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "ai",
      "digital-rights",
      "consumer-protection",
      "states-rights",
      "tech-policy"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 10
  },
  {
    "issue_id": "protect-snap-food-security-and-family-farmers",
    "slug": "protect-snap-food-security-and-family-farmers",
    "title": "Protect SNAP, Food Security, and Family Farmers",
    "category": "Agriculture",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "support",
    "summary": "Starting October 1, 2026, states' share of SNAP administrative costs rises to 75% from 50%, and starting October 1, 2027, states with payment-error rates above 6% can be required to cover 5% to 15% of SNAP benefits that the federal government had previously paid in full. Reuters estimated those changes could shift about $22 billion in SNAP costs to states and localities, and the program serves more than 41 million people. At the same time, USDA forecasts 2026 net farm income at $153.4 billion, down 0.7%, even with $44.3 billion in direct government payments that are expected to account for nearly 29% of farm income. The issue is whether Congress can protect both food assistance and family-farm stability without pushing more of the cost onto states or low-income households.",
    "related_bills": [],
    "template_asks": [
      "support",
      "ask_public_statement",
      "seek_oversight"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support a farm bill that protects SNAP, strengthens food security, and helps family farmers rather than shifting big new costs to states.\n\nPlease oppose harmful cuts or cost-shifts and support a final bill that keeps food assistance strong and rural communities stable.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support a farm bill that protects SNAP, strengthens food security, and helps family farmers instead of shifting new costs to states.\n\nThank you for your time and consideration.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "farm-bill",
      "snap",
      "food-security",
      "family-farmers",
      "agriculture"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 11
  },
  {
    "issue_id": "protect-pell-grants-and-affordable-student-aid",
    "slug": "protect-pell-grants-and-affordable-student-aid",
    "title": "Protect Pell Grants and Affordable Student Aid",
    "category": "Education",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "support",
    "summary": "In February 2026, CBO-based projections showed the Pell Grant program facing a $5.4 billion funding gap in FY2026 and nearly an $11.5 billion shortfall in FY2027, even after a $10.5 billion one-time funding injection in the 2025 law. TICAS says more than 7 million students rely on Pell each year, and CRFB says the cumulative 10-year shortfall could reach $104 billion to $132 billion, with the risk of disrupting full awards by the 2028-2029 school year if Congress does not act. The policy question is whether lawmakers close the gap with new funding or by cutting award amounts or eligibility.",
    "related_bills": [],
    "template_asks": [
      "support",
      "ask_public_statement",
      "seek_oversight"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to protect Pell Grants and student-aid programs and avoid changes that make college or job training harder to afford.\n\nStudents and working adults need real access to education and job training, not new barriers or higher costs.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to protect Pell Grants and student-aid programs and avoid changes that make college or job training harder to afford.\n\nThank you for your time and consideration.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "education",
      "pell-grants",
      "student-aid",
      "college-affordability",
      "job-training"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 12
  },
  {
    "issue_id": "invest-in-climate-resilience-grid-and-insurance-stability",
    "slug": "invest-in-climate-resilience-grid-and-insurance-stability",
    "title": "Invest in Climate Resilience and Insurance Stability",
    "category": "Environment",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "support",
    "summary": "NOAA counts 403 U.S. weather and climate disasters with losses above $1 billion from 1980 through 2024, and the annual average has risen to 23 events over the last five years versus 9 over the full period. Swiss Re projects global insured catastrophe losses of about $148 billion in 2026, with a severe-year scenario as high as $320 billion, while NERC says winter peak electricity demand in the U.S. and Canada is expected to grow by 245 gigawatts over the next decade. After a court order, FEMA reopened its BRIC resilience program on March 26, 2026 with $1 billion in grants, reversing a cancellation that had frozen about $3.6 billion. The issue is whether federal policy keeps paying mainly after disasters or invests earlier in resilience, grid reliability, and insurance-market stability.",
    "related_bills": [],
    "template_asks": [
      "support",
      "ask_public_statement",
      "seek_oversight"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to invest in resilience, grid reliability, and insurance-market stability so disaster costs do not keep falling on households.\n\nPlease support policies that help communities prepare for climate disasters instead of leaving families to absorb the damage alone.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to invest in resilience, grid reliability, and insurance-market stability so disaster costs do not keep falling on households.\n\nThank you for your time and consideration.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "climate",
      "resilience",
      "insurance",
      "grid-reliability",
      "disasters"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 13
  },
  {
    "issue_id": "support-fair-maps-and-election-guardrails",
    "slug": "support-fair-maps-and-election-guardrails",
    "title": "Support Fair Maps and Transparent Election Rules",
    "category": "Democracy",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "support",
    "summary": "In March 2026, Reuters described a national mid-decade redistricting fight after Trump pressed Republican-led states to redraw congressional maps ahead of the midterms. On March 25, 2026, the Missouri Supreme Court upheld a new congressional map in a 4-3 decision; Missouri had previously elected 6 Republicans and 2 Democrats under its post-2020 map, and opponents submitted more than 300,000 signatures seeking to force a statewide vote on the redraw. AP also reported that Utah's Trump-backed effort to repeal the state's 2018 anti-gerrymandering law failed to make the 2026 ballot, leaving a court-imposed map in place for now. The debate is whether states should be allowed to rewrite the rules mid-cycle for partisan gain or whether stronger guardrails are needed around maps and election administration.",
    "related_bills": [],
    "template_asks": [
      "support",
      "ask_public_statement",
      "seek_oversight"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support fair maps, transparent election administration, and guardrails against mid-cycle partisan redistricting.\n\nVoters deserve stable rules, equal representation, and a democracy that is not manipulated for partisan advantage.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support fair maps, transparent election administration, and guardrails against mid-cycle partisan redistricting.\n\nThank you for your time and consideration.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "democracy",
      "redistricting",
      "elections",
      "fair-maps",
      "representation"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 14
  },
  {
    "issue_id": "advance-social-security-and-medicare-solvency-plan",
    "slug": "advance-social-security-and-medicare-solvency-plan",
    "title": "Advance a Bipartisan Social Security and Medicare Plan",
    "category": "Retirement Security",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "support",
    "summary": "The 2025 trustees projected that Social Security's Old-Age and Survivors Insurance trust fund can pay full scheduled benefits until 2033, with 77% payable after that, while the combined OASDI funds can pay full benefits until 2034 and Medicare's Hospital Insurance trust fund until 2033, with 89% payable thereafter. SSA says about 75 million Americans will receive Social Security or SSI payments in 2026, and CMS says Medicare covers about 68 million people. The debate is no longer whether these programs matter; it is whether Congress acts early enough to avoid across-the-board cuts or abrupt financing changes.",
    "related_bills": [],
    "template_asks": [
      "support",
      "ask_public_statement"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to advance a bipartisan Social Security and Medicare solvency plan now so any changes are gradual and not sudden benefit cuts.\n\nPlease protect earned benefits and work across the aisle on a long-term solution before the choices become more painful.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to advance a bipartisan Social Security and Medicare solvency plan now so any changes are gradual and not sudden benefit cuts.\n\nThank you for your time and consideration.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "social-security",
      "medicare",
      "solvency",
      "retirement-security",
      "earned-benefits"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 15
  },
  {
    "issue_id": "expand-housing-supply-and-prevent-homelessness",
    "slug": "expand-housing-supply-and-prevent-homelessness",
    "title": "Expand Housing Supply and Prevent Homelessness",
    "category": "Housing",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "support",
    "summary": "Reuters reported in March 2026 that Congress is debating housing legislation against an estimated national shortage of 4 million homes, with home prices up about 60% since 2019. NLIHC's 2026 Gap report found an even sharper crunch at the low end: 11 million extremely low-income renter households are facing a shortage of 7.2 million affordable and available homes, leaving only 35 homes for every 100 households, and 74% of those renters are severely cost-burdened. The issue is whether federal policy focuses only on abstract supply growth or also addresses the affordability and homelessness pressures hitting the lowest-income renters.",
    "related_bills": [],
    "template_asks": [
      "support",
      "ask_public_statement",
      "seek_oversight"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support more housing supply, more rental relief, and federal incentives for states and cities to allow more homes near jobs and transit.\n\nPlease treat housing affordability and homelessness as urgent national issues and back policies that make it easier to build and keep people housed.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support more housing supply, more rental relief, and federal incentives for states and cities to allow more homes near jobs and transit.\n\nThank you for your time and consideration.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "housing",
      "homelessness",
      "rental-relief",
      "zoning",
      "affordability"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 16
  },
  {
    "issue_id": "protect-affordable-coverage-and-reject-medicaid-work-requirements",
    "slug": "protect-affordable-coverage-and-reject-medicaid-work-requirements",
    "title": "Protect Affordable Coverage and Reject Medicaid Work Requirements",
    "category": "Health Care",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "support",
    "summary": "The 2025 reconciliation law, signed on July 4, 2025, makes work requirements a condition of Medicaid eligibility for ACA expansion adults starting January 1, 2027. KFF says 41 states including D.C. have expanded Medicaid up to 138% of the federal poverty level, and its March 2026 tracker says coverage losses from work requirements account for more than half of the projected increase in the uninsured, or about 5.3 million people. The policy fight is whether lawmakers are improving program integrity or creating large coverage losses through reporting rules and paperwork.",
    "related_bills": [],
    "template_asks": [
      "support",
      "oppose",
      "ask_public_statement"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to prevent avoidable coverage losses by restoring affordability and rejecting Medicaid work requirements and other paperwork rules that push eligible people off insurance.\n\nPlease protect access to care and do not let eligible families lose coverage because of higher costs or red tape.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to restore affordable coverage and reject Medicaid work requirements and other paperwork rules that push eligible people off insurance.\n\nThank you for your time and consideration.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "aca",
      "medicaid",
      "coverage",
      "work-requirements",
      "affordability"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 17
  },
  {
    "issue_id": "lower-health-care-costs-and-protect-coverage",
    "slug": "lower-health-care-costs-and-protect-coverage",
    "title": "Lower Health Care Costs While Protecting Coverage",
    "category": "Health Care",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "support",
    "summary": "For 2026, CMS raised the standard Medicare Part B premium to $202.90 a month from $185.00 and the annual deductible to $283 from $257, while BLS reported medical care prices were up 3.4% year over year in February 2026. At the same time, CMS says 23.1 million people selected or were automatically re-enrolled in marketplace coverage for 2026. The central question is how lawmakers bring down premiums, deductibles, and out-of-pocket costs without shrinking coverage or destabilizing the insurance market.",
    "related_bills": [],
    "template_asks": [
      "support",
      "ask_public_statement",
      "seek_oversight"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to prioritize lower premiums, deductibles, and drug costs while protecting coverage.\n\nHealth care has to be more affordable for families without forcing people to give up access or benefits.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to lower premiums, deductibles, and drug costs while protecting coverage.\n\nThank you for your time and consideration.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "health-care",
      "premiums",
      "deductibles",
      "drug-costs",
      "coverage"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 18
  },
  {
    "issue_id": "protect-federal-reproductive-health-care-and-funding",
    "slug": "protect-federal-reproductive-health-care-and-funding",
    "title": "Protect Federal Reproductive Health Care and Funding",
    "category": "Reproductive Rights",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "support",
    "summary": "Title X provides $286 million a year to a network of nearly 4,000 clinics and served 2.8 million people in 2023, but the program has faced repeated federal disruption. KFF says the administration withheld $65.8 million in year-four funding from 16 of 86 Title X grants in April 2025, and Reuters reported that a federal judge later blocked Medicaid funding cuts to abortion-providing nonprofits in 22 states and Washington, D.C., after the law had already contributed to at least 20 health-center closures since September 2025. The issue is whether Congress protects reproductive health access through stable Medicaid and Title X funding or allows ongoing legal and administrative instability to keep shrinking the provider network.",
    "related_bills": [],
    "template_asks": [
      "support",
      "ask_public_statement"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to state clearly whether they support federal protections and funding for reproductive health care, and to vote to protect that care.\n\nCongress still shapes access through Medicaid, Title X, appropriations, and broader health-funding laws, so this position should be explicit.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to state clearly whether they support federal protections and funding for reproductive health care, and to vote to protect that care.\n\nThank you for your time and consideration.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "reproductive-health",
      "abortion",
      "title-x",
      "medicaid",
      "health-funding"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 19
  },
  {
    "issue_id": "support-workers-during-layoffs-and-economic-uncertainty",
    "slug": "support-workers-during-layoffs-and-economic-uncertainty",
    "title": "Support Workers During Layoffs and Economic Uncertainty",
    "category": "Labor",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "support",
    "summary": "Reuters reported that the U.S. lost 92,000 jobs in February 2026 and the unemployment rate rose to 4.4%. The latest JOLTS data showed 6.9 million job openings in January, 3.1 million quits, and 1.6 million layoffs and discharges, while Reuters separately reported private payroll growth has averaged just 18,000 a month over the last three months and the federal civilian workforce shrank 12% between September 2024 and January 2026. The policy question is whether lawmakers respond to a cooling labor market with better retraining, transition support, and layoff planning before job losses deepen.",
    "related_bills": [],
    "template_asks": [
      "support",
      "ask_public_statement",
      "seek_oversight"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support worker protections, retraining, and transparent impact assessments for layoffs and federal workforce cuts.\n\nFamilies need job security, honest planning, and real support when the labor market starts to cool.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support worker protections, retraining, and transparent impact assessments for layoffs and federal workforce cuts.\n\nThank you for your time and consideration.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "jobs",
      "layoffs",
      "workers",
      "retraining",
      "labor-market"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 20
  },
  {
    "issue_id": "lower-everyday-costs-for-working-families",
    "slug": "lower-everyday-costs-for-working-families",
    "title": "Lower Everyday Costs for Working Families",
    "category": "Economy",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "support",
    "summary": "BLS reported that consumer prices were up 2.4% year over year in February 2026, but the pressure on household essentials remained uneven: food was up 3.1%, shelter 3.0%, medical care 3.4%, household furnishings and operations 3.9%, full-service meals 4.6%, electricity 4.8%, and natural gas 10.9%. Reuters also noted in March that economists expected the Iran-driven oil shock and tariffs to add new inflation pressure even after relatively moderate core CPI readings. The issue is which mix of housing, food, energy, wage, and tax policy can actually lower day-to-day costs without creating new supply shocks.",
    "related_bills": [],
    "template_asks": [
      "support",
      "ask_public_statement",
      "seek_oversight"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to back policies that lower everyday costs for families without adding new hidden taxes or supply shocks.\n\nPlease focus on affordability in the real economy, especially food, housing, and other essential household costs.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to back policies that lower everyday costs for families without adding hidden taxes or supply shocks.\n\nThank you for your time and consideration.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "economy",
      "inflation",
      "cost-of-living",
      "prices",
      "families"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 21
  },
  {
    "issue_id": "fully-fund-hawaii-flood-relief-and-recovery",
    "slug": "fully-fund-hawaii-flood-relief-and-recovery",
    "title": "Fully Fund Hawaii Flood Relief and Recovery",
    "category": "Disaster Relief",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "support",
    "summary": "Hawaii is facing some of its worst flooding in more than 20 years, with more than 230 rescues, evacuation orders affecting about 5,500 residents, and major damage to homes and public infrastructure. Early estimates indicate damage could exceed $1 billion across roads, schools, farms, and health facilities, while state and county assessments are still ongoing. Governor Josh Green has requested a presidential major disaster declaration and sought up to a 90% federal cost share, signaling state and local resources are not enough. This makes timely federal action through FEMA's Disaster Relief Fund urgent to prevent rebuilding delays and stabilize impacted communities.",
    "related_bills": [],
    "template_asks": [
      "support",
      "ask_public_statement",
      "seek_oversight"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to fully support Hawaii flood recovery by backing immediate FEMA Disaster Relief Fund support, an expedited major disaster declaration response, and strong federal cost sharing so rebuilding is not delayed.\n\nThe scale of damage is severe and local resources are not enough. Please push for fast federal action and public accountability so communities can recover quickly.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support urgent federal flood relief for Hawaii through FEMA's Disaster Relief Fund and prompt disaster assistance.\n\nPlease act quickly so families and infrastructure can recover without delay.\n\nThank you.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "urgent",
      "hawaii",
      "flooding",
      "disaster-relief",
      "fema",
      "recovery",
      "infrastructure"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 22
  },
  {
    "issue_id": "strengthen-tsa-staffing-and-reduce-checkpoint-bottlenecks",
    "slug": "strengthen-tsa-staffing-and-reduce-checkpoint-bottlenecks",
    "title": "Strengthen TSA Staffing and Reduce Checkpoint Bottlenecks",
    "category": "Transportation",
    "target_chambers": [
      "house",
      "senate"
    ],
    "primary_ask": "support",
    "summary": "U.S. air travel demand remains very high, placing sustained pressure on TSA screening operations and frontline officers. TSA has faced continuing staffing strain and turnover, including more than 1,100 officers leaving in a two-month period in late 2025, even as passenger volume stays elevated. Federal delay data also shows flight disruptions come from multiple sources: in December 2025, 71.74% of flights were on time, with delays largely tied to carriers and the national aviation system, while a smaller share was directly tied to security. The most accurate policy case is that fully funding TSA staffing and compensation reduces checkpoint bottlenecks, improves traveler experience, and protects safety while broader delay drivers are handled across airlines and air traffic control.",
    "related_bills": [],
    "template_asks": [
      "support",
      "ask_public_statement",
      "seek_oversight"
    ],
    "live_script": "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support full TSA staffing and compensation funding to reduce checkpoint bottlenecks and improve traveler safety and reliability.\n\nPlease prioritize appropriations and oversight that stabilize the TSA workforce and strengthen frontline operations at high-volume airports.\n\nThank you for your time and consideration.",
    "voicemail_script": "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to fully fund TSA staffing and pay so screening lines move more efficiently and safety stays strong during heavy travel demand.\n\nPlease support urgent action on this.\n\nThank you.",
    "supporter_variant": "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you.",
    "undecided_variant": "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and take a public position as soon as possible.",
    "staffer_variant": "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know this matters to me as a constituent.",
    "voicemail_footer": "If leaving voicemail, please include your full street address, [FULL_ADDRESS], so your message is tallied.",
    "placeholders": [
      "[YOUR_NAME]",
      "[CITY]",
      "[ZIP]",
      "[FULL_ADDRESS]",
      "[OFFICIAL_TITLE]",
      "[OFFICIAL_LAST]",
      "[BILL_OR_RESOLUTION]"
    ],
    "tags": [
      "urgent",
      "tsa",
      "air-travel",
      "aviation",
      "staffing",
      "travel-delays",
      "airport-security"
    ],
    "is_active": true,
    "starts_at": null,
    "ends_at": null,
    "display_order": 23
  }
]    $SEEDS$::jsonb as data
), rows as (
  select
    coalesce(nullif(trim(t.slug), ''), nullif(trim(t.issue_id), '')) as slug,
    coalesce(nullif(trim(t.title), ''), coalesce(nullif(trim(t.slug), ''), nullif(trim(t.issue_id), ''))) as title,
    coalesce(nullif(trim(t.category), ''), 'Issue') as category,
    coalesce(nullif(trim(t.summary), ''), 'No summary provided.') as summary,
    null::text as action_sentence,
    coalesce(nullif(trim(t.live_script), ''), 'Hi, my name is [YOUR_NAME] from [CITY], [ZIP].') as live_script,
    coalesce(nullif(trim(t.voicemail_script), ''), 'Hi, this is [YOUR_NAME] from [CITY], [ZIP].') as voicemail_script,
    nullif(
      (
        select elem.value
        from jsonb_array_elements_text(coalesce(t.related_bills, '[]'::jsonb)) as elem(value)
        where trim(elem.value) <> ''
        limit 1
      ),
      ''
    ) as vehicle_label,
    case
      when coalesce(t.is_active, true) = false then 'draft'
      when t.ends_at is not null and t.ends_at < now() then 'archived'
      when t.starts_at is not null and t.starts_at > now() then 'draft'
      else 'published'
    end as status,
    coalesce(t.display_order, 0) as display_order,
    coalesce(
      (
        select array_agg(elem.value)
        from jsonb_array_elements_text(coalesce(t.target_chambers, '[]'::jsonb)) as elem(value)
      ),
      '{}'::text[]
    ) as target_chambers,
    nullif(trim(t.primary_ask), '') as primary_ask,
    coalesce(
      (
        select array_agg(elem.value)
        from jsonb_array_elements_text(coalesce(t.template_asks, '[]'::jsonb)) as elem(value)
      ),
      '{}'::text[]
    ) as template_asks,
    coalesce(
      (
        select array_agg(elem.value)
        from jsonb_array_elements_text(coalesce(t.related_bills, '[]'::jsonb)) as elem(value)
      ),
      '{}'::text[]
    ) as related_bills,
    coalesce(
      (
        select array_agg(elem.value)
        from jsonb_array_elements_text(coalesce(t.tags, '[]'::jsonb)) as elem(value)
      ),
      '{}'::text[]
    ) as tags,
    jsonb_strip_nulls(
      jsonb_build_object(
        'supporter_variant', nullif(trim(t.supporter_variant), ''),
        'undecided_variant', nullif(trim(t.undecided_variant), ''),
        'staffer_variant', nullif(trim(t.staffer_variant), ''),
        'voicemail_footer', nullif(trim(t.voicemail_footer), ''),
        'placeholders', coalesce(t.placeholders, '[]'::jsonb)
      )
    ) as presentation
  from payload p
  cross join jsonb_to_recordset(p.data) as t(
    issue_id text,
    slug text,
    title text,
    category text,
    target_chambers jsonb,
    primary_ask text,
    summary text,
    related_bills jsonb,
    template_asks jsonb,
    live_script text,
    voicemail_script text,
    supporter_variant text,
    undecided_variant text,
    staffer_variant text,
    voicemail_footer text,
    placeholders jsonb,
    tags jsonb,
    is_active boolean,
    starts_at timestamptz,
    ends_at timestamptz,
    display_order integer
  )
)
insert into public.civic_example_templates (
  slug,
  title,
  category,
  summary,
  action_sentence,
  live_script,
  voicemail_script,
  vehicle_label,
  status,
  display_order,
  target_chambers,
  primary_ask,
  template_asks,
  related_bills,
  tags,
  presentation,
  created_at,
  updated_at
)
select
  slug,
  title,
  category,
  summary,
  action_sentence,
  live_script,
  voicemail_script,
  vehicle_label,
  status,
  display_order,
  target_chambers,
  primary_ask,
  template_asks,
  related_bills,
  tags,
  presentation,
  now(),
  now()
from rows
where slug is not null
on conflict (slug) do update set
  title = excluded.title,
  category = excluded.category,
  summary = excluded.summary,
  action_sentence = excluded.action_sentence,
  live_script = excluded.live_script,
  voicemail_script = excluded.voicemail_script,
  vehicle_label = excluded.vehicle_label,
  status = excluded.status,
  display_order = excluded.display_order,
  target_chambers = excluded.target_chambers,
  primary_ask = excluded.primary_ask,
  template_asks = excluded.template_asks,
  related_bills = excluded.related_bills,
  tags = excluded.tags,
  presentation = excluded.presentation,
  updated_at = now();

-- Preserve prior vehicle labels that were previously injected from local slug mapping.
update public.civic_example_templates
set
  vehicle_label = case slug
    when 'oppose-the-save-america-act' then 'Safeguard American Voter Eligibility Act (SAVE Act), H.R. 22'
    when 'crypto-consumer-protection' then 'Digital Asset Market Clarity Act of 2025 (CLARITY Act), H.R. 3633'
    when 'expand-housing-supply-and-prevent-homelessness' then 'Housing for the 21st Century Act, H.R. 6644'
    when 'block-trumps-push-to-take-control-of-greenland' then 'Greenland Sovereignty Protection Act, H.R. 7013'
    when 'strengthen-tsa-staffing-and-reduce-checkpoint-bottlenecks' then 'Rights for the TSA Workforce Act, H.R. 2086'
    when 'ukraine-security-and-humanitarian-support' then 'Ukraine Support Act, H.R. 2913'
    when 'gun-safety-and-background-checks' then 'Bipartisan Background Checks Act of 2025, H.R. 18'
    when 'protect-state-level-ai-regulation' then 'A bill to prohibit the use of Federal funds to implement the Executive order entitled "Ensuring a National Policy Framework for Artificial Intelligence," S. 3557'
    when 'oppose-casey-means-for-surgeon-general' then 'Casey Means nomination for Surgeon General, PN730-47'
    when 'oppose-steve-pearce-as-blm-director' then 'Stevan Pearce nomination for Bureau of Land Management Director, PN730-52'
    when 'stop-unauthorized-military-strikes-on-iran' then 'Iran War Powers Resolution, S.J.Res. 104'
    else vehicle_label
  end,
  updated_at = now()
where slug in (
  'oppose-the-save-america-act',
  'crypto-consumer-protection',
  'expand-housing-supply-and-prevent-homelessness',
  'block-trumps-push-to-take-control-of-greenland',
  'strengthen-tsa-staffing-and-reduce-checkpoint-bottlenecks',
  'ukraine-security-and-humanitarian-support',
  'gun-safety-and-background-checks',
  'protect-state-level-ai-regulation',
  'oppose-casey-means-for-surgeon-general',
  'oppose-steve-pearce-as-blm-director',
  'stop-unauthorized-military-strikes-on-iran'
);

commit;
