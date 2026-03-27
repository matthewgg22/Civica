from __future__ import annotations

from dataclasses import dataclass

from .models import Ask

SUPPORTED_PLACEHOLDERS = (
    "[YOUR_NAME]",
    "[CITY]",
    "[ZIP]",
    "[FULL_ADDRESS]",
    "[OFFICIAL_TITLE]",
    "[OFFICIAL_LAST]",
    "[BILL_OR_RESOLUTION]",
)

SHARED_SUPPORTER_VARIANT = (
    "Thank you [OFFICIAL_TITLE] [OFFICIAL_LAST] for supporting this issue. "
    "Please keep speaking out publicly, push leadership to act, and urge your colleagues to join you."
)

SHARED_UNDECIDED_VARIANT = (
    "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to review this issue urgently and "
    "take a public position as soon as possible."
)

SHARED_STAFFER_VARIANT = (
    "Please pass this message to [OFFICIAL_TITLE] [OFFICIAL_LAST] and let them know "
    "this matters to me as a constituent."
)

SHARED_VOICEMAIL_FOOTER = (
    "If leaving voicemail, please include your full street address, [FULL_ADDRESS], "
    "so your message is tallied."
)


@dataclass(frozen=True)
class BaselineIssueVariant:
    slug: str
    title: str
    category: str
    target_chambers: tuple[str, ...]
    primary_ask: Ask
    overview: str
    live_script: str
    voicemail_script: str
    tags: tuple[str, ...]
    placeholders: tuple[str, ...] = SUPPORTED_PLACEHOLDERS
    template_asks: tuple[Ask, ...] = ()
    related_bills: tuple[str, ...] = ()
    supporter_variant: str = SHARED_SUPPORTER_VARIANT
    undecided_variant: str = SHARED_UNDECIDED_VARIANT
    staffer_variant: str = SHARED_STAFFER_VARIANT
    voicemail_footer: str = SHARED_VOICEMAIL_FOOTER


def baseline_issue_variants() -> list[BaselineIssueVariant]:
    return [
        BaselineIssueVariant(
            slug="stop-unauthorized-military-strikes-on-iran",
            title="Stop Unauthorized Military Strikes on Iran",
            category="Foreign Affairs",
            target_chambers=("house", "senate"),
            primary_ask=Ask.SUPPORT,
            overview=(
                "Recent military escalation has renewed pressure on Congress to reassert its constitutional war powers. "
                "This issue asks members of Congress to oppose unauthorized U.S. military action against Iran, support "
                "de-escalation, and back legislation or resolutions requiring congressional approval before further escalation."
            ),
            live_script=(
                "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support [BILL_OR_RESOLUTION] and oppose any "
                "unauthorized U.S. war with Iran. Congress must reassert its constitutional authority and prevent further "
                "escalation without a vote.\n\n"
                "Please speak out publicly, support immediate de-escalation, and vote to block any continued military action "
                "that has not been authorized by Congress.\n\n"
                "Thank you for your time and consideration."
            ),
            voicemail_script=(
                "Hi, my name is [YOUR_NAME], and I'm a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support [BILL_OR_RESOLUTION] and oppose unauthorized "
                "military action against Iran. The United States should not be pulled deeper into another war without "
                "congressional approval.\n\n"
                "Please take public action to defend Congress's war powers and push for de-escalation.\n\n"
                "Thank you."
            ),
            tags=("foreign-policy", "war-powers", "congress", "deescalation", "iran"),
            template_asks=(Ask.SUPPORT, Ask.ASK_PUBLIC_STATEMENT, Ask.SEEK_OVERSIGHT),
            related_bills=("[BILL_OR_RESOLUTION]",),
        ),
        BaselineIssueVariant(
            slug="protect-trans-rights-and-gender-affirming-care",
            title="Protect Trans Rights and Gender-Affirming Care",
            category="LGBTQ",
            target_chambers=("house", "senate"),
            primary_ask=Ask.OPPOSE,
            overview=(
                "This issue asks Congress to oppose anti-trans legislation, censorship efforts, and restrictions on medically "
                "necessary gender-affirming care. The focus is equal protection, bodily autonomy, and evidence-based "
                "treatment rather than political targeting."
            ),
            live_script=(
                "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to defend transgender people and oppose federal attacks "
                "on gender-affirming care. Please oppose any ban on care, reject anti-trans censorship bills like "
                "[BILL_OR_RESOLUTION], and fight policies that strip trans people of safety, dignity, and medically necessary "
                "treatment.\n\n"
                "Trans people deserve evidence-based care and equal protection under the law, not political targeting.\n\n"
                "Thank you for your time and consideration."
            ),
            voicemail_script=(
                "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP].\n\n"
                "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to protect trans rights and oppose new federal restrictions on "
                "gender-affirming care and anti-LGBTQ censorship. Please speak out publicly and vote against measures that "
                "harm transgender people and their families.\n\n"
                "Thank you."
            ),
            tags=("trans-rights", "lgbtq", "healthcare", "civil-rights", "anti-discrimination"),
            template_asks=(Ask.OPPOSE, Ask.ASK_PUBLIC_STATEMENT, Ask.SUPPORT),
            related_bills=("[BILL_OR_RESOLUTION]",),
        ),
        BaselineIssueVariant(
            slug="demand-the-resignation-of-fbi-director-kash-patel",
            title="Demand the Resignation of FBI Director Kash Patel",
            category="Government Oversight",
            target_chambers=("house", "senate"),
            primary_ask=Ask.SEEK_OVERSIGHT,
            overview=(
                "This issue frames concerns about FBI leadership as an accountability and public-trust issue. Constituents "
                "ask members of Congress to demand Kash Patel's resignation, support investigations into misconduct or misuse "
                "of resources, and pursue formal accountability measures if needed."
            ),
            live_script=(
                "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to demand FBI Director Kash Patel's resignation and "
                "support aggressive oversight into his conduct. Reports about misuse of government resources, retaliation, and "
                "mismanagement at the FBI are serious and demand a response.\n\n"
                "If Patel refuses to resign, [OFFICIAL_TITLE] [OFFICIAL_LAST] should support formal investigations and pursue "
                "every available accountability measure.\n\n"
                "Thank you for your time and consideration."
            ),
            voicemail_script=(
                "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\n"
                "I'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to call for Kash Patel's resignation and back immediate "
                "oversight of his conduct as FBI director. The bureau should never be used as a tool for personal privilege "
                "or political retaliation.\n\n"
                "Please take public action on this issue.\n\n"
                "Thank you."
            ),
            tags=("oversight", "fbi", "accountability", "corruption", "rule-of-law"),
            template_asks=(Ask.SEEK_OVERSIGHT, Ask.ASK_PUBLIC_STATEMENT, Ask.OPPOSE),
        ),
        BaselineIssueVariant(
            slug="oppose-steve-pearce-as-blm-director",
            title="Oppose Steve Pearce as Bureau of Land Management Director",
            category="Nominations",
            target_chambers=("senate",),
            primary_ask=Ask.VOTE_NO,
            overview=(
                "This issue asks senators to oppose Steve Pearce for Bureau of Land Management director because of his "
                "record on public lands and ties to extraction interests. The message emphasizes stewardship, conservation, "
                "and protection of federal lands."
            ),
            live_script=(
                "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to urge Senator [OFFICIAL_LAST] to oppose Steve Pearce's confirmation as Director of the Bureau "
                "of Land Management. His record shows too much alignment with oil and gas interests and too little commitment "
                "to protecting public lands for future generations.\n\n"
                "Please vote no on his confirmation and speak out in defense of our public lands.\n\n"
                "Thank you for your time and consideration."
            ),
            voicemail_script=(
                "Hi, this is [YOUR_NAME], and I'm a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to ask Senator [OFFICIAL_LAST] to oppose Steve Pearce for BLM director. This position should go "
                "to someone committed to stewardship of public lands, not someone whose record raises concerns about extraction "
                "and selloffs.\n\n"
                "Thank you."
            ),
            tags=("nominations", "public-lands", "environment", "senate", "blm"),
            template_asks=(Ask.VOTE_NO, Ask.OPPOSE, Ask.ASK_PUBLIC_STATEMENT),
        ),
        BaselineIssueVariant(
            slug="oppose-the-save-america-act",
            title="Oppose the SAVE America Act",
            category="Voter Rights",
            target_chambers=("senate",),
            primary_ask=Ask.OPPOSE,
            overview=(
                "This issue asks senators to reject legislation that would impose new documentation barriers to voter "
                "registration and participation. The emphasis is protecting ballot access for eligible voters and opposing "
                "unnecessary bureaucratic hurdles."
            ),
            live_script=(
                "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to urge Senator [OFFICIAL_LAST] to oppose the SAVE America Act and any effort to force it "
                "through the Senate. This bill would create unnecessary documentation barriers that make it harder for "
                "eligible citizens to register and vote.\n\n"
                "Please defend voting rights, reject this bill, and oppose any attempt to make voting less accessible for "
                "lawful voters.\n\n"
                "Thank you for your time and consideration."
            ),
            voicemail_script=(
                "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to ask Senator [OFFICIAL_LAST] to oppose the SAVE America Act. Eligible Americans should not "
                "lose access to the ballot because of burdensome paperwork requirements.\n\n"
                "Please vote no and speak out against this bill.\n\n"
                "Thank you."
            ),
            tags=("voting-rights", "democracy", "senate", "ballot-access", "elections"),
            template_asks=(Ask.OPPOSE, Ask.VOTE_NO, Ask.ASK_PUBLIC_STATEMENT),
        ),
        BaselineIssueVariant(
            slug="oppose-casey-means-for-surgeon-general",
            title="Oppose Casey Means for U.S. Surgeon General",
            category="Nominations",
            target_chambers=("senate",),
            primary_ask=Ask.VOTE_NO,
            overview=(
                "This issue asks senators to oppose Casey Means for Surgeon General and support evidence-based public health "
                "leadership. The message centers on credibility, trust, and the importance of science-driven health communication."
            ),
            live_script=(
                "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to urge Senator [OFFICIAL_LAST] to oppose Casey Means for U.S. Surgeon General. This role should "
                "go to someone with strong public health credibility, clear support for evidence-based medicine, and full public "
                "trust.\n\n"
                "Please vote no on this nomination and speak out for qualified, science-based public health leadership.\n\n"
                "Thank you for your time and consideration."
            ),
            voicemail_script=(
                "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to ask Senator [OFFICIAL_LAST] to oppose Casey Means for Surgeon General. The country needs trusted, "
                "evidence-based public health leadership in this role.\n\n"
                "Please vote no on this nomination.\n\n"
                "Thank you."
            ),
            tags=("nominations", "public-health", "senate", "science", "surgeon-general"),
            template_asks=(Ask.VOTE_NO, Ask.OPPOSE, Ask.ASK_PUBLIC_STATEMENT),
        ),
        BaselineIssueVariant(
            slug="support-tps-extension-for-haitians",
            title="Support Temporary Protected Status for Haitians",
            category="Immigration",
            target_chambers=("house", "senate"),
            primary_ask=Ask.SUPPORT,
            overview=(
                "This issue asks lawmakers to defend Temporary Protected Status for Haitians, oppose efforts to end those "
                "protections, and support stability for families facing dangerous conditions and legal uncertainty."
            ),
            live_script=(
                "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support continued Temporary Protected Status for "
                "Haitians and oppose any effort to strip those protections away.\n\n"
                "Please speak out publicly, support every available legislative and oversight tool to protect Haitian TPS holders, "
                "and reject deportation policies that would put families at risk.\n\n"
                "Thank you for your time and consideration."
            ),
            voicemail_script=(
                "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\n"
                "I'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support TPS protections for Haitians and oppose efforts "
                "to end them. Haitian families deserve stability and protection, not more fear and uncertainty.\n\n"
                "Thank you."
            ),
            tags=("immigration", "tps", "haiti", "humanitarian", "deportation"),
            template_asks=(Ask.SUPPORT, Ask.ASK_PUBLIC_STATEMENT, Ask.SEEK_OVERSIGHT),
        ),
        BaselineIssueVariant(
            slug="protest-the-epa-repeal-of-the-endangerment-finding",
            title="Protest the EPA's Repeal of the Endangerment Finding",
            category="Environment",
            target_chambers=("house", "senate"),
            primary_ask=Ask.OPPOSE,
            overview=(
                "This issue asks members of Congress to oppose efforts to dismantle the legal basis for federal climate regulation "
                "and to defend protections against dangerous pollution. The focus is climate responsibility and public health."
            ),
            live_script=(
                "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to oppose the repeal of the EPA's endangerment finding and "
                "defend strong federal climate protections.\n\n"
                "Please support aggressive oversight and legislation to restore meaningful greenhouse-gas standards and protect "
                "communities from dangerous pollution.\n\n"
                "Thank you for your time and consideration."
            ),
            voicemail_script=(
                "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP].\n\n"
                "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to oppose the repeal of the EPA's endangerment finding and defend "
                "strong climate and public-health protections.\n\n"
                "Please take public action on this issue.\n\n"
                "Thank you."
            ),
            tags=("climate", "epa", "pollution", "public-health", "environment"),
            template_asks=(Ask.OPPOSE, Ask.SEEK_OVERSIGHT, Ask.ASK_PUBLIC_STATEMENT),
        ),
        BaselineIssueVariant(
            slug="block-trumps-push-to-take-control-of-greenland",
            title="Block Trump's Push to Take Control of Greenland",
            category="Foreign Affairs",
            target_chambers=("house", "senate"),
            primary_ask=Ask.OPPOSE,
            overview=(
                "This issue asks Congress to oppose any effort by the administration to pressure or take control of Greenland "
                "and to defend allied sovereignty, international stability, and responsible foreign policy."
            ),
            live_script=(
                "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to reject any attempt by the administration to seize, "
                "pressure, or coerce Greenland.\n\n"
                "The United States should respect Greenlandic and Danish sovereignty, protect our alliances, and make clear that "
                "Congress will not support reckless attempts to take control of allied territory.\n\n"
                "Thank you for your time and consideration."
            ),
            voicemail_script=(
                "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\n"
                "I'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to oppose any U.S. attempt to take control of Greenland and "
                "to defend allied sovereignty and international stability.\n\n"
                "Please speak out publicly on this issue.\n\n"
                "Thank you."
            ),
            tags=("foreign-policy", "greenland", "sovereignty", "diplomacy", "congress"),
            template_asks=(Ask.OPPOSE, Ask.ASK_PUBLIC_STATEMENT, Ask.SUPPORT),
        ),
        BaselineIssueVariant(
            slug="protect-state-level-ai-regulation",
            title="Protect State-Level AI Regulation",
            category="Digital Rights",
            target_chambers=("house", "senate"),
            primary_ask=Ask.OPPOSE,
            overview=(
                "This issue asks Congress to preserve states' ability to regulate AI systems when federal protections are "
                "incomplete. The message centers on consumer protection, state authority, and the need for enforceable safeguards."
            ),
            live_script=(
                "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to protect states' ability to regulate artificial intelligence "
                "and oppose any federal effort to punish states for passing basic AI safeguards.\n\n"
                "Congress should not strip states of the power to enact consumer protections while federal law remains incomplete. "
                "Please oppose preemption and any funding threats tied to state AI regulation.\n\n"
                "Thank you for your time and consideration."
            ),
            voicemail_script=(
                "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP].\n\n"
                "I'm asking [OFFICIAL_TITLE] [OFFICIAL_LAST] to protect state authority to regulate AI and oppose efforts to "
                "override state safeguards or threaten funding.\n\n"
                "Please defend the ability of states to protect their residents.\n\n"
                "Thank you."
            ),
            tags=("ai", "digital-rights", "consumer-protection", "states-rights", "tech-policy"),
            template_asks=(Ask.OPPOSE, Ask.ASK_PUBLIC_STATEMENT, Ask.SEEK_OVERSIGHT),
        ),
        BaselineIssueVariant(
            slug="fully-fund-hawaii-flood-relief-and-recovery",
            title="Fully Fund Hawaii Flood Relief and Recovery",
            category="Disaster Relief",
            target_chambers=("house", "senate"),
            primary_ask=Ask.SUPPORT,
            overview=(
                "Hawaii is facing some of its worst flooding in more than 20 years, with more than 230 rescues, evacuation "
                "orders affecting roughly 5,500 residents, and major damage to homes and public infrastructure. Early estimates "
                "indicate damage could exceed $1 billion across roads, schools, farms, and health facilities, while state and "
                "county assessments are still ongoing. Governor Josh Green requested a presidential major disaster declaration "
                "and up to a 90% federal cost share, signaling state and local resources are not enough. This issue asks "
                "Congress to support rapid federal disaster funding and oversight so recovery is not delayed."
            ),
            live_script=(
                "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to fully support Hawaii flood recovery by backing "
                "immediate FEMA Disaster Relief Fund support, fast disaster declaration action, and strong federal cost sharing "
                "so rebuilding is not delayed.\n\n"
                "The scale of damage is severe and local resources are not enough. Please push for urgent federal action and "
                "public accountability so communities can recover quickly.\n\n"
                "Thank you for your time and consideration."
            ),
            voicemail_script=(
                "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\n"
                "I'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to support urgent federal flood relief for Hawaii through "
                "FEMA's Disaster Relief Fund and prompt disaster assistance.\n\n"
                "Please act quickly so families and infrastructure can recover without delay.\n\n"
                "Thank you."
            ),
            tags=("urgent", "hawaii", "flooding", "disaster-relief", "fema", "recovery", "infrastructure"),
            template_asks=(Ask.SUPPORT, Ask.ASK_PUBLIC_STATEMENT, Ask.SEEK_OVERSIGHT),
        ),
        BaselineIssueVariant(
            slug="strengthen-tsa-staffing-and-reduce-checkpoint-bottlenecks",
            title="Strengthen TSA Staffing and Reduce Checkpoint Bottlenecks",
            category="Transportation",
            target_chambers=("house", "senate"),
            primary_ask=Ask.SUPPORT,
            overview=(
                "U.S. air travel demand remains high and continues to strain TSA screening operations and frontline staffing. "
                "TSA has faced sustained turnover pressures, including over 1,100 officers leaving in a two-month period in "
                "late 2025, even as passenger volume stayed elevated. Federal delay data shows disruptions come from multiple "
                "sources, but stronger TSA staffing is still one of the most direct ways Congress can reduce checkpoint "
                "bottlenecks, improve traveler experience, and protect safety."
            ),
            live_script=(
                "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\n"
                "I'm calling to urge [OFFICIAL_TITLE] [OFFICIAL_LAST] to support full TSA staffing and compensation funding to "
                "reduce checkpoint bottlenecks and improve traveler safety and reliability.\n\n"
                "Please prioritize appropriations and oversight that stabilize the TSA workforce and strengthen frontline "
                "operations at high-volume airports.\n\n"
                "Thank you for your time and consideration."
            ),
            voicemail_script=(
                "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\n"
                "I'm calling to ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to fully fund TSA staffing and pay so screening lines move "
                "more efficiently and safety stays strong during heavy travel demand.\n\n"
                "Please support urgent action on this.\n\n"
                "Thank you."
            ),
            tags=("urgent", "tsa", "air-travel", "aviation", "staffing", "travel-delays", "airport-security"),
            template_asks=(Ask.SUPPORT, Ask.ASK_PUBLIC_STATEMENT, Ask.SEEK_OVERSIGHT),
        ),
    ]
