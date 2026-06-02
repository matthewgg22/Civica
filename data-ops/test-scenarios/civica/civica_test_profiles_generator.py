import json, copy, os, argparse, datetime as _dt

# ---------- FY2026 PARAM TABLE (⚠ CONFIRM vs FNS COLA before freezing benefit values) ----------
PARAMS = {
  "fy":"2026","note":"⚠ illustrative FY2026 values; confirm max-allotment & SD by size from FNS COLA memo",
  "tolerance":58, "sd":{1:209,2:209,3:209,4:223,5:261,6:299},
  "max_allot":{1:298,2:546,3:785,4:994,5:1183,6:1421,7:1571,8:1789},
  "asset_limit":3000, "asset_limit_ed":4500, "homeless_ded":198.99, "min_benefit":24, "shelter_cap":744,
  # monthly FPL (2025 guidelines, 48 states) by HH size
  "fpl":{1:1305,2:1764,3:2222,4:2680,5:3139,6:3597,7:4056,8:4514}
}
def fpl(sz): 
    return PARAMS["fpl"].get(sz, PARAMS["fpl"][8] + (sz-8)*459)

# ---------- STATE ARCHETYPE LIBRARY (policy spread; example real states) ----------
# bbce_fpl_basis: "federal_fiscal_year" (CA) or "calendar_year" (MA, DTA 106 CMR 364.976);
#   propagates to engine's BBCE date-window math. Non-BBCE states leave it null.
STATES = {
  "CA": {"label":"California / LA County","bbce":True,"bbce_threshold":200,"bbce_fpl_basis":"federal_fiscal_year","asset_waiver":True,"sua":"mandatory","admin":"county","allotment_tier":"48","drug_felony_ban":False,"abawd_waiver_avail":True},
  "MA": {"label":"Massachusetts / DTA","bbce":True,"bbce_threshold":200,"bbce_fpl_basis":"calendar_year","asset_waiver":True,"sua":"mandatory","admin":"state","allotment_tier":"48","drug_felony_ban":False,"abawd_waiver_avail":True},
  "TX": {"label":"BBCE-165 archetype (e.g. TX)","bbce":True,"bbce_threshold":165,"bbce_fpl_basis":"federal_fiscal_year","asset_waiver":True,"sua":"mandatory","admin":"state","allotment_tier":"48","drug_felony_ban":True,"abawd_waiver_avail":False},
  "KS": {"label":"Non-BBCE archetype (e.g. KS)","bbce":False,"bbce_threshold":130,"bbce_fpl_basis":None,"asset_waiver":False,"sua":"mandatory","admin":"state","allotment_tier":"48","drug_felony_ban":False,"abawd_waiver_avail":False},
  "AK": {"label":"Alaska (non-BBCE, higher allotments)","bbce":False,"bbce_threshold":130,"bbce_fpl_basis":None,"asset_waiver":False,"sua":"mandatory","admin":"state","allotment_tier":"AK","drug_felony_ban":False,"abawd_waiver_avail":True}
}

# ---------- helpers ----------
def gross_gate(sz, gross, st):
    """policy oracle: does household pass the gross income test in state st?"""
    thr = STATES[st]["bbce_threshold"]
    return gross <= fpl(sz)*thr/100.0
def asset_gate(assets, ed, st):
    if STATES[st]["asset_waiver"]: return True
    lim = PARAMS["asset_limit_ed"] if ed else PARAMS["asset_limit"]
    return assets <= lim

def fin_verdict(sz, gross, assets, ed, st, net_ok=True):
    ok = gross_gate(sz,gross,st) and asset_gate(assets,ed,st) and net_ok
    return "APPROVE" if ok else "DENY"

# ---------- PROFILE TABLE ----------
# kind: 'fin' (compute per-state from gross/asset), 'same' (verdict same all states - non-financial),
#       'state' (explicit per-state dict), 'ab' (A/B variant flip, not state-driven), 'ladder' (fixed state + benefit)
P = []
def add(**k): P.append(k)

# ---- A: easy-in anchors (approve everywhere) ----
for pid,lbl,sz,gr,ed,asts,es in [
 ("A01","Single mother, 2 kids, low wage",3,1300,False,200,"311_wages"),
 ("A03","Disabled man, SSDI + high medical",1,1100,True,900,"365_medical"),
 ("A04","Working family of 4",4,2000,False,400,"311_wages"),
 ("A05","Homeless single adult, zero income",1,0,False,0,"363_shelter"),
 ("A07","Elderly couple, low SS, high shelter",2,1500,True,3800,"363_shelter"),
 ("A08","Single parent, part-time wages, pays child support",2,1400,False,300,"311_wages")]:
    add(id=pid,label=lbl,kind="fin",sz=sz,gross=gr,ed=ed,assets=asts,es=es,expedited=(pid=="A05"))
add(id="A02",label="Elderly woman, SSI only",kind="same",sz=1,verdict="APPROVE",cat="pure_SSI",es="346_unearned",note="categorically eligible (SSI)")
add(id="A06",label="Pure-TANF household",kind="same",sz=3,verdict="APPROVE",cat="pure_PA",es="150_unit",note="categorically eligible (TANF)")
add(id="A09",label="LPR, 40 quarters, low income",kind="same",sz=2,verdict="APPROVE",es="311_wages",note="qualified LPR, bar-exempt")
add(id="A10",label="Refugee adjusted to LPR",kind="same",sz=3,verdict="APPROVE",es="311_wages",note="humanitarian-to-LPR, no wait")

# ---- D: denials (some flip across states!) ----
add(id="D01",label="Single adult over gross limit",kind="fin",sz=1,gross=2200,ed=False,assets=1000,es="311_wages",note="flips: deny non-BBCE/165, approve 200")
add(id="D02",label="Over asset limit, non-BBCE",kind="fin",sz=1,gross=1000,ed=False,assets=10000,es="resource",note="flips on asset waiver")
add(id="D08",label="High-income professional family",kind="fin",sz=4,gross=7500,ed=False,assets=40000,es="311_wages")
add(id="D10",label="Over income and assets, deep reject",kind="fin",sz=2,gross=5000,ed=False,assets=25000,es="311_wages")
for pid,lbl,sz,es,note in [
 ("D03","ABAWD timed out",1,"abawd","time-limit, not waived"),
 ("D04","Full-time college student, no exemption",1,"student","ineligible student"),
 ("D05","Undocumented single adult",1,"immigration","no eligible member"),
 ("D06","Substantial lottery winnings",3,"lottery","HH ineligible until requalify"),
 ("D07","Refugee in refugee status (pre-LPR), post-OBBBA",2,"immigration","removed category"),
 ("D09","IPV-disqualified individual",1,"ipv","disqualified = whole HH")]:
    add(id=pid,label=lbl,kind="same",sz=sz,verdict="DENY",es=es,note=note)

# ---- M: maybes (the flips) ----
add(id="M01",label="Gross at 165% FPL (BBCE flip)",kind="fin",sz=3,gross=3665,ed=False,assets=1000,es="cat_elig")
add(id="M02",label="Assets $3,500 (asset-test flip)",kind="fin",sz=2,gross=1400,ed=False,assets=3500,es="resource")
add(id="M03",label="Gross just under 130%",kind="fin",sz=3,gross=2800,ed=False,assets=500,es="363_shelter",note="net-sensitive (low shelter R-III)")
add(id="M04",label="Gross just over 130%",kind="fin",sz=2,gross=2400,ed=False,assets=800,es="311_wages")
add(id="M05",label="Elderly, assets near E/D limit",kind="fin",sz=1,gross=1000,ed=True,assets=4400,es="resource")
add(id="M06",label="Net income at the 100% FPL edge",kind="fin",sz=3,gross=3100,ed=False,assets=600,es="363_shelter",net_ok=True,note="net-edge; binds on excess-shelter/cap")
add(id="M07",label="Mixed wage + self-employment near limit",kind="fin",sz=3,gross=2700,ed=False,assets=700,es="312_se",note="flips on se_calc_method (state option)")
add(id="M08",label="Farm self-employment loss offset",kind="same",sz=2,verdict="APPROVE",es="312_se",note="farm loss offsets other income (federal)")
for pid,lbl,sz,ed,es,note in [
 ("M09","Shelter crossing $744 cap (non-E/D)",3,False,"363_shelter","capped R-II; amount test"),
 ("M10","Same as M09 but elderly (uncapped)",3,True,"363_shelter","uncapped R-I; higher benefit"),
 ("M11","Low/no-shelter household (S=0)",2,False,"363_shelter","S=0 region")]:
    add(id=pid,label=lbl,kind="same",sz=sz,verdict="APPROVE",ed=ed,es=es,note=note)
add(id="M12",label="ABAWD in a waived area",kind="state",sz=1,es="abawd",
    per_state={"CA":"APPROVE","MA":"APPROVE","TX":"DENY","KS":"DENY","AK":"APPROVE"},note="flips on area unemployment waiver")
add(id="M13",label="ABAWD age 60-64 (the seam)",kind="same",sz=1,verdict="APPROVE",ed=True,es="abawd",note="elderly for benefit, ABAWD-clocked for eligibility")
add(id="M14",label="Homeless veteran ABAWD (point-in-time)",kind="ab",sz=1,es="abawd",
    variants={"as_of<2025-11-01":"APPROVE","as_of>=2025-11-01":"DENY"},note="OBBBA removed vet/homeless exemption")
add(id="M15",label="Tribal-member ABAWD (OBBBA exemption)",kind="same",sz=1,verdict="APPROVE",es="abawd",note="statewide Tribal exemption")
add(id="M16",label="Student at the 20-hour work line",kind="ab",sz=1,es="student",variants={"19_hrs":"DENY","21_hrs":"APPROVE"})
add(id="M17",label="Single-parent student, child near age 12",kind="ab",sz=2,es="student",variants={"child_11":"APPROVE","child_12":"DENY"})
add(id="M18",label="Mixed-status: undoc parent + citizen kids",kind="same",sz=3,verdict="APPROVE",es="proration",note="kids eligible; benefit via proration")
add(id="M19",label="Sponsored LPR (deeming)",kind="same",sz=1,verdict="DENY",es="immigration",note="sponsor income deemed over limit (unless indigence)")
add(id="M20",label="COFA migrant (retained post-OBBBA)",kind="same",sz=2,verdict="APPROVE",es="immigration")
add(id="M21",label="Elderly separate-household at 165% FPL",kind="ab",sz=1,ed=True,es="150_unit",variants={"coresident<=165pct":"APPROVE","coresident>165pct":"DENY"})
add(id="M22",label="Boarder vs roomer",kind="ab",sz=1,es="150_unit",variants={"roomer":"APPROVE","boarder":"DENY (not independent)"})
add(id="M23",label="Variable gig income (anticipation)",kind="ab",sz=1,es="311_wages",variants={"avg_method":"APPROVE","recent_high_month":"DENY"})
add(id="M24",label="Zero-income household (subsistence)",kind="same",sz=3,verdict="APPROVE",es="311_wages",expedited=True,note="approve+expedited; subsistence verification")
add(id="M25",label="Drug/alcohol treatment center resident",kind="same",sz=1,verdict="APPROVE",es="150_unit",note="one-person HH via FNS-authorized center")
add(id="M26",label="Destitute migrant farmworker",kind="same",sz=2,verdict="APPROVE",es="311_wages",expedited=True,note="only received income counts")
add(id="M27",label="Internet in shelter (point-in-time)",kind="ab",sz=3,es="363_shelter",variants={"as_of<2025-11-01":"higher benefit","as_of>=2025-11-01":"lower benefit"})
add(id="M28",label="§10103 heat-and-eat HCSUA (post-OBBBA)",kind="ab",sz=2,es="364_sua",variants={"as_of<2025-11-01":"HCSUA available","as_of>=2025-11-01":"restricted to E/D"})
add(id="M29",label="Drug-felony individual (state option)",kind="state",sz=2,es="drug_felony",
    per_state={"CA":"APPROVE","MA":"APPROVE","TX":"DENY","KS":"APPROVE","AK":"APPROVE"},note="flips on state drug-felony ban")
add(id="M30",label="Child-support-paid deduction at net margin",kind="ab",sz=2,es="363_shelter",variants={"with_deduction":"APPROVE","without":"DENY"})

# ---- P51-P62 addendum ----
add(id="P51",label="Under-22 mandatory-combination flip",kind="ab",sz=2,es="150_unit",variants={"age_21_with_parent":"DENY/reduced","age_22_separate":"APPROVE"})
add(id="P52",label="Fleeing felon / probation-parole violator",kind="ab",sz=2,es="fleeing_felon",variants={"active_warrant":"member DENY","no_warrant":"member APPROVE"})
add(id="P53",label="Medical-deduction flip",kind="ab",sz=1,ed=True,es="365_medical",variants={"medical_200":"APPROVE","medical_30":"DENY"})
add(id="P54",label="Cash gift vs vendor payment",kind="ab",sz=1,es="346_unearned",variants={"cash_to_hh":"counted (may deny)","vendor_to_landlord":"excluded (approve)"})
add(id="P55",label="Two full-time student siblings",kind="ab",sz=2,es="student",variants={"neither_works":"DENY","one_works_20hr":"APPROVE"})
add(id="P56",label="New job: partial first paycheck vs anticipated",kind="ab",sz=3,es="311_wages",variants={"first_month_850":"APPROVE","ongoing_4500":"DENY"})
add(id="P57",label="Roomer rents a room (shared housing)",kind="same",sz=1,verdict="APPROVE",es="363_shelter",note="separate HH; shelter=amount actually paid")
add(id="P58",label="Elderly retiree tips over net limit",kind="ab",sz=1,ed=True,es="346_unearned",variants={"below_net":"APPROVE","above_net":"DENY"})
add(id="P59",label="Single adult at HH1 BBCE boundary",kind="fin",sz=1,gross=2110,ed=False,assets=500,es="311_wages")
add(id="P60",label="Large household (family of 7)",kind="same",sz=7,verdict="APPROVE",es="150_unit",note="size-indexed params beyond HH3")
add(id="P61",label="Interstate residency split",kind="same",sz=3,verdict="APPROVE",es="150_unit",note="residency/dual-participation")
add(id="P62",label="Negative control: personal-property resale",kind="same",sz=2,verdict="APPROVE",es="312_se",negative_control=True,note="resale of personal goods != income")

# ---- gradient ladders (fixed CA, benefit given) ----
for pid,sz,gross,ben in [("G01",3,0,785),("G02",3,1000,785),("G03",3,1500,639),("G04",3,2000,459),("G05",3,2500,279),("G06",3,2888,155),
                          ("G07",1,0,298),("G08",1,1000,212),("G09",1,1300,104),("G10",1,1500,32),("G11",1,1650,24)]:
    add(id=pid,label="Income ladder pt",kind="ladder",sz=sz,gross=gross,benefit=ben,es="311_wages")
add(id="G12",label="Net-driven: rent $1000",kind="ladder",sz=3,gross=2000,benefit=459,es="363_shelter")
add(id="G13",label="Net-driven: rent $1600 (capped)",kind="ladder",sz=3,gross=2000,benefit=591,es="363_shelter")
add(id="G14",label="Net-driven: rent $1600 + elderly (uncapped)",kind="ladder",sz=3,gross=2000,benefit=639,ed=True,es="363_shelter")

# ---- arguable max ----
add(id="MX1",label="Arguable max: E/D deduction-stacked, $3000 gross",kind="ladder",sz=2,gross=3000,benefit=546,ed=True,es="363_shelter")
add(id="MX2",label="Raw-dollar max: large HH zero net",kind="ladder",sz=8,gross=0,benefit=1789,es="150_unit")
add(id="MX3",label="Integrity contrast: same income NOT E/D",kind="state",sz=2,es="363_shelter",
    per_state={"CA":"APPROVE(112)","MA":"APPROVE","TX":"DENY","KS":"DENY","AK":"DENY"},note="same facts as MX1 but non-E/D -> gross test + cap block the max")
add(id="MX4",label="BBCE max income with any benefit",kind="fin",sz=3,gross=4440,ed=False,assets=500,es="311_wages",note="just under 200%; small/zero benefit")

# ---- HCOL shelter sweep (fixed CA, benefit) ----
for pid,sz,sh,ben,ed in [("H01",3,400,416,False),("H02",3,800,471,False),("H03",3,1200,591,False),("H04",3,1360,639,False),("H05",3,2000,639,False),("H06",3,3000,639,False),
                         ("H07",3,400,416,True),("H08",3,1200,591,True),("H09",3,1360,639,True),("H10",3,2000,785,True),("H11",3,2600,785,True),("H12",3,3000,785,True)]:
    add(id=pid,label="Shelter sweep pt (shelter=%d)"%sh,kind="ladder",sz=sz,gross=1800,benefit=ben,ed=ed,shelter=sh,es="363_shelter")

# ---- Set 2 (P63-P71) ----
add(id="P63",label="AmeriCorps stipend (program-split)",kind="ab",sz=2,es="excluded",variants={"state_national":"excluded->APPROVE","vista_prior_snap":"excluded->APPROVE","vista_no_prior":"counted->may DENY"})
add(id="P64",label="School/contract seasonal income (annualized)",kind="same",sz=5,verdict="APPROVE",es="311_wages",note="contract salary averaged over 12 mo")
add(id="P65",label="Tax refund / EITC (negative control)",kind="same",sz=5,verdict="APPROVE",es="resource",negative_control=True,note="refund/EITC excluded income & resource 12mo")
add(id="P66",label="Unemployment counted + phantom-income error",kind="same",sz=2,verdict="APPROVE",es="346_unearned",integrity={"keyed":2167,"correct":867,"should_flag":True})
add(id="P67",label="Caregiver of incapacitated adult (exemption)",kind="same",sz=2,verdict="APPROVE",es="abawd",integrity={"issue":"clocked ABAWD despite exemption","should_flag":True})
add(id="P68",label="Roommate-leaseholder shelter",kind="same",sz=1,verdict="APPROVE",es="363_shelter",integrity={"issue":"rent altered without cause $298->$24","should_flag":True})
add(id="P69",label="Disabled wrongly clocked ABAWD",kind="same",sz=1,verdict="APPROVE",ed=True,es="abawd",integrity={"issue":"countable months despite disability exemption","should_flag":True})
add(id="P70",label="Self-employed (Venmo) student",kind="ab",sz=1,es="student",variants={"ge_20hr":"APPROVE","lt_20hr":"DENY"})
add(id="P71",label="Jury duty vs work mandate",kind="same",sz=1,verdict="APPROVE",es="abawd",note="jury duty = good cause that month")

# ---- Student battery (S01-S09) ----
add(id="S01",label="Student, no income, no exemption",kind="same",sz=1,verdict="DENY",es="student",note="income irrelevant")
add(id="S02",label="Student on work-study",kind="same",sz=1,verdict="APPROVE",es="student",note="exempt (b)(6), term-bound")
add(id="S03",label="Student, paid summer internship >=20hr",kind="same",sz=1,verdict="APPROVE",es="student")
add(id="S04",label="Student, unpaid summer internship",kind="same",sz=1,verdict="DENY",es="student")
add(id="S05",label="Student-parent, two kids <6, no income",kind="same",sz=3,verdict="APPROVE",es="student",note="exempt (b)(8); max benefit")
add(id="S06",label="Single-parent student, child <12",kind="same",sz=2,verdict="APPROVE",es="student")
add(id="S07",label="Student receiving TANF",kind="same",sz=2,verdict="APPROVE",cat="pure_PA",es="student")
add(id="S08",label="Age carve-out: student 50+",kind="same",sz=1,verdict="APPROVE",es="student",note="rule not applicable")
add(id="S09",label="Student in SNAP E&T / JTPA placement",kind="same",sz=1,verdict="APPROVE",es="student")


STATE='CA'; S=STATES[STATE]
D = {
 "A01":dict(members=[(29,"head"),(5,"child"),(7,"child")],income=[("head","wages",1300)],rent=950,sua=600),
 "A02":dict(members=[(72,"head")],income=[("head","ssi",960)],rent=700,sua_tier="LUA",sua=400,cat="pure_SSI"),
 "A03":dict(members=[(54,"head",dict(disability=True))],income=[("head","unearned_rsdi",1100)],rent=850,sua=600,medical=300),
 "A04":dict(members=[(34,"head"),(32,"spouse"),(6,"child"),(8,"child")],income=[("head","wages",2000)],rent=1200,sua=600),
 "A05":dict(members=[(40,"head",dict(work_class="abawd_subject",abawd_months_used=0))],income=[],rent=0,sua_tier="none",sua=0,homeless=True),
 "A06":dict(members=[(30,"head"),(6,"child"),(9,"child")],income=[("head","tanf",700)],rent=900,sua=600,cat="pure_PA"),
 "A07":dict(members=[(68,"head"),(70,"spouse")],income=[("head","unearned_rsdi",1500)],rent=1300,sua=600,medical=80),
 "A08":dict(members=[(34,"head"),(8,"child")],income=[("head","wages",1400)],rent=950,sua=600,child_support_paid=300),
 "A09":dict(members=[(40,"head",dict(immigration="lpr",five_yr_bar="exempt:40quarters")),(38,"spouse",dict(immigration="lpr"))],income=[("head","wages",1500)],rent=1000,sua_tier="LUA",sua=400),
 "A10":dict(members=[(35,"head",dict(immigration="lpr",five_yr_bar="exempt:refugee_adjusted")),(33,"spouse"),(8,"child")],income=[("head","wages",1200)],rent=1050,sua=600),
 "D01":dict(members=[(35,"head")],income=[("head","wages",2200)],rent=600,sua=600),
 "D02":dict(members=[(45,"head")],income=[("head","wages",1000)],rent=600,sua=600),
 "D03":dict(members=[(30,"head",dict(work_class="abawd_subject",abawd_months_used=3))],income=[],rent=500,sua=400),
 "D04":dict(members=[(22,"head",dict(student="he_halftime_subject"))],income=[],rent=600,sua=400),
 "D05":dict(members=[(38,"head",dict(immigration="undocumented"))],income=[("head","wages",1000)],rent=600,sua=400),
 "D06":dict(members=[(40,"head",dict(disqual=["lottery"])),(38,"spouse"),(10,"child")],income=[("head","wages",1100)],rent=900,sua=600),
 "D07":dict(members=[(35,"head",dict(immigration="removed_status:refugee")),(33,"spouse")],income=[("head","wages",900)],rent=900,sua=600,as_of="2026-04-01"),
 "D08":dict(members=[(42,"head"),(40,"spouse"),(10,"child"),(12,"child")],income=[("head","wages",4500),("spouse","wages",3000)],rent=1500,sua=600),
 "D09":dict(members=[(40,"head",dict(disqual=["ipv:tier1"]))],income=[("head","wages",800)],rent=600,sua=400),
 "D10":dict(members=[(45,"head"),(43,"spouse")],income=[("head","wages",5000)],rent=900,sua=600),
 "M01":dict(members=[(35,"head"),(8,"child"),(10,"child")],income=[("head","wages",3665)],rent=1200,sua=600),
 "M02":dict(members=[(40,"head"),(8,"child")],income=[("head","wages",1400)],rent=900,sua=600),
 "M03":dict(members=[(35,"head"),(8,"child"),(10,"child")],income=[("head","wages",2800)],rent=700,sua_tier="none",sua=0),
 "M04":dict(members=[(35,"head"),(8,"child")],income=[("head","wages",2400)],rent=1100,sua=600),
 "M05":dict(members=[(66,"head")],income=[("head","unearned_rsdi",1000)],rent=700,sua=600),
 "M06":dict(members=[(35,"head"),(8,"child"),(10,"child")],income=[("head","wages",3100)],rent=1400,sua=600),
 "M07":dict(members=[(35,"head"),(8,"child"),(10,"child")],income=[("head","wages",1500),("head","self_employment",1200)],rent=1100,sua=600),
 "M08":dict(members=[(40,"head"),(38,"spouse")],income=[("head","farm_se",-800),("spouse","wages",2500)],rent=900,sua=600),
 "M09":dict(members=[(35,"head"),(8,"child"),(10,"child")],income=[("head","wages",1600)],rent=1500,sua=600),
 "M10":dict(members=[(67,"head"),(35,"child_adult"),(8,"child")],income=[("child_adult","wages",1600)],rent=1500,sua=600),
 "M11":dict(members=[(35,"head"),(8,"child")],income=[("head","wages",1800)],rent=0,sua_tier="none",sua=0),
 "M13":dict(members=[(62,"head",dict(work_class="abawd_subject"))],income=[("head","unearned_rsdi",700)],rent=700,sua=600),
 "M18":dict(members=[(38,"head",dict(immigration="undocumented")),(8,"child",dict(immigration="citizen")),(10,"child",dict(immigration="citizen"))],income=[("head","wages",2000)],rent=1000,sua=600),
 "M19":dict(members=[(40,"head",dict(immigration="lpr",sponsored=True))],income=[("head","wages",600)],rent=800,sua=600,sponsor_income=5000),
 "M20":dict(members=[(35,"head",dict(immigration="cofa")),(33,"spouse",dict(immigration="cofa"))],income=[("head","wages",1300)],rent=1000,sua=600),
 "M21":dict(members=[(68,"head",dict(disability=True))],income=[("head","unearned_rsdi",800)],rent=700,sua=600),
 "M24":dict(members=[(35,"head"),(8,"child"),(10,"child")],income=[],rent=1000,sua=600),
 "M25":dict(members=[(40,"head",dict(living="treatment_ctr"))],income=[],rent=0,sua_tier="none",sua=0),
 "M26":dict(members=[(35,"head",dict(living="migrant")),(33,"spouse")],income=[("head","wages",400,"terminated")],rent=600,sua=400),
 "M29":dict(members=[(40,"head",dict(disqual=["drug_felony"])),(38,"spouse")],income=[("head","wages",1200)],rent=900,sua=600),
 "P53":dict(members=[(66,"head",dict(disability=True))],income=[("head","unearned_rsdi",1250)],rent=800,sua=600,medical=200),
 "P54":dict(members=[(40,"head")],income=[("head","gift_cash",400)],rent=700,sua=600),
 "P57":dict(members=[(30,"head",dict(role="roomer"))],income=[("head","wages",900)],rent=450,sua_tier="none",sua=0),
 "P58":dict(members=[(67,"head")],income=[("head","unearned_rsdi",1100),("head","wages",600)],rent=700,sua=600),
 "P59":dict(members=[(35,"head")],income=[("head","wages",2110)],rent=600,sua=290),
 "P60":dict(members=[(38,"head"),(36,"spouse"),(2,"child"),(5,"child"),(8,"child"),(11,"child"),(14,"child")],income=[("head","wages",2500)],rent=1600,sua=600),
 "P63":dict(members=[(28,"head"),(4,"child")],income=[("head","americorps_sn",1500)],rent=1000,sua=600),
 "P64":dict(members=[(40,"head"),(38,"spouse"),(6,"child"),(9,"child"),(12,"child")],income=[("head","wages_contract",2200),("spouse","self_employment",1000)],rent=1100,sua=600),
 "P65":dict(members=[(35,"head"),(5,"child"),(8,"child"),(11,"child"),(14,"child")],income=[("head","wages",2200),("head","excluded_tax_refund",4000,"annual")],rent=1300,sua=600,assets_override=4200),
 "P66":dict(members=[(34,"head"),(32,"spouse")],income=[("head","unearned_ui",867)],rent=1000,sua=600),
 "P67":dict(members=[(38,"head",dict(work_class="exempt:caregiver_incapacitated"))],income=[],rent=800,sua=600),
 "P68":dict(members=[(30,"head",dict(role="roomer"))],income=[("head","wages",900)],rent=450,sua_tier="none",sua=0),
 "P69":dict(members=[(45,"head",dict(disability=True,work_class="abawd_exempt:disabled"))],income=[("head","unearned_rsdi",1000)],rent=800,sua=600),
 "P70":dict(members=[(24,"head",dict(student="he_halftime_subject"))],income=[("head","self_employment",900)],rent=700,sua=400),
 "P71":dict(members=[(33,"head",dict(work_class="abawd_subject"))],income=[("head","wages",0)],rent=600,sua=400),
 "MX1":dict(members=[(68,"head",dict(disability=True)),(66,"spouse",dict(disability=True))],income=[("head","unearned_rsdi",3000)],rent=2400,sua=600,medical=900),
 "MX2":dict(members=[(40,"head"),(38,"spouse"),(2,"child"),(4,"child"),(6,"child"),(8,"child"),(10,"child"),(12,"child")],income=[],rent=1200,sua=600),
 "MX3":dict(members=[(40,"head"),(38,"spouse")],income=[("head","wages",3000)],rent=2400,sua=600),
 "S01":dict(members=[(21,"head",dict(student="he_halftime_subject"))],income=[],rent=600,sua=400),
 "S02":dict(members=[(23,"head",dict(student="he_exempt:work_study"))],income=[("head","wages",300)],rent=600,sua=400),
 "S03":dict(members=[(22,"head",dict(student="he_exempt:work20"))],income=[("head","wages",1000)],rent=600,sua=400),
 "S04":dict(members=[(22,"head",dict(student="he_halftime_subject"))],income=[],rent=600,sua=400),
 "S05":dict(members=[(26,"head",dict(student="he_exempt:dependent_under6")),(3,"child"),(5,"child")],income=[],rent=1000,sua=600),
 "S06":dict(members=[(28,"head",dict(student="he_exempt:single_parent_child_under12")),(9,"child")],income=[("head","wages",1200)],rent=900,sua=600),
 "S07":dict(members=[(27,"head",dict(student="he_exempt:tanf")),(5,"child")],income=[("head","tanf",600)],rent=800,sua=600,cat="pure_PA"),
 "S08":dict(members=[(52,"head",dict(student="he_exempt:age50plus"))],income=[("head","wages",900)],rent=700,sua=400),
 "S09":dict(members=[(24,"head",dict(student="he_exempt:et_placement"))],income=[("head","wages",0)],rent=600,sua=400),
}

def _members(p):
    pid=p["id"]; sz=p.get("sz",1); ed=p.get("ed",False)
    if pid in D and "members" in D[pid]:
        out=[]
        for i,mm in enumerate(D[pid]["members"]):
            age,role=mm[0],mm[1]; fl=mm[2] if len(mm)>2 else {}
            out.append(dict(member_id="m%d"%(i+1),age=age,role=role,disability=fl.get("disability", ed and i==0),
                elderly=(age>=60),student=fl.get("student","not"),immigration=fl.get("immigration","citizen"),
                five_yr_bar=fl.get("five_yr_bar","n/a"),sponsored=fl.get("sponsored",False),
                work_class=fl.get("work_class","gen_work_subject"),abawd_months_used=fl.get("abawd_months_used",0),
                disqual=fl.get("disqual",[]),living=fl.get("living","housed")))
        return out
    out=[dict(member_id="m1",age=(67 if ed else 35),role="head",disability=ed,elderly=ed,student="not",
        immigration="citizen",five_yr_bar="n/a",sponsored=False,work_class="gen_work_subject",abawd_months_used=0,disqual=[],living="housed")]
    kids=[8,10,12,6,14,4,2]
    for i in range(1,sz):
        age=8 if (sz==2) else kids[(i-1)%len(kids)]
        out.append(dict(member_id="m%d"%(i+1),age=age,role="child",disability=False,elderly=False,student="not",
            immigration="citizen",five_yr_bar="n/a",sponsored=False,work_class="exempt",abawd_months_used=0,disqual=[],living="housed"))
    return out

def _income(p,members):
    pid=p["id"]
    if pid in D and "income" in D[pid]:
        out=[]
        for ln in D[pid]["income"]:
            ref,typ,amt=ln[0],ln[1],ln[2]; freq=ln[3] if len(ln)>3 else "monthly"
            mid=members[0]["member_id"]
            if ref=="spouse":
                sp=[m for m in members if m["role"]=="spouse"]; mid=sp[0]["member_id"] if sp else mid
            elif ref=="child_adult":
                ca=[m for m in members if m["role"]=="child_adult"]; mid=ca[0]["member_id"] if ca else mid
            ss="terminated" if freq=="terminated" else "ongoing"
            if freq=="terminated": freq="monthly"
            out.append(dict(member=mid,type=typ,amount=amt,freq=freq,anticipation="averaged",source_status=ss))
        return out
    g=p.get("gross")
    if g is None: return []
    typ="unearned_rsdi" if p.get("ed") else "wages"
    return [dict(member=members[0]["member_id"],type=typ,amount=g,freq="monthly",anticipation="averaged",source_status="ongoing")]

def _shelter(p):
    d=D.get(p["id"],{}); rent=d.get("rent"); sua=d.get("sua"); tier=d.get("sua_tier","HCSUA")
    if rent is None:
        tot=p.get("shelter")
        if tot is not None: rent=max(0,tot-600); sua=600
        else: rent=800; sua=600
    if sua is None: sua=600 if tier=="HCSUA" else (290 if tier=="phone" else 0)
    return dict(rent=rent,sua_tier=tier,sua_amount=sua,internet=d.get("internet",0),homeless_deduction=d.get("homeless",False))

def _ded(p):
    d=D.get(p["id"],{}); return dict(dependent_care=d.get("dependent_care",0),medical_unreimbursed=d.get("medical",0),child_support_paid=d.get("child_support_paid",0))


# ================= v0.6 OVERLAY (assembled after PARAMS/STATES/P and D/_members/_income/_shelter/_ded) =================
# v0.6 deltas vs v0.5:
#  - SUA is now per-state (PARAMS["sua_by_state"]); states without authored values yield benefit=null
#    so consumers don't trust illustrative numbers as production.
#  - compute_benefit now applies the homeless-deduction substitute (7 CFR 273.9(d)(6)(i)).
#  - as_of_date comparisons use datetime.date.fromisoformat instead of string compare.
#  - All outputs go to args.out_dir (CLI / env CIVICA_PROFILES_OUT_DIR, default = script dir).
#  - Script no longer auto-executes on import; wrapped in if __name__=="__main__".
#  - Emits summary.json (coverage report) and benefit_derivations.json (diff-friendly oracle).
import re

# CA production SUA values (CDSS ACIN I-46-25). Use as the v0.6 default for backward
# compatibility with the v0.5 single-sua block; per-state overrides live in sua_by_state below.
PARAMS["sua"]={"HCSUA":663,"LUA":170,"phone":20,"none":0}

# Per-state SUA values. CA + MA pinned to production regulatory text. TX/KS/AK are
# explicitly None (not authored) — consumers see benefit=null for those states rather
# than assertions silently using CA-illustrative numbers.
#   CA: CDSS ACIN I-46-25
#   MA: DTA 106 CMR 364.976 (calendar-year basis)
PARAMS["sua_by_state"]={
    "CA": {"HCSUA":663,"LUA":170,"phone":20,"none":0},
    "MA": {"HCSUA":914,"LUA":556,"phone":64,"none":0},
    "TX": None,
    "KS": None,
    "AK": None,
}

PARAMS["allotment_tables"]={"48":dict(PARAMS["max_allot"]),"AK":{k:round(v*1.27) for k,v in PARAMS["max_allot"].items()}}
EARNED={"wages","self_employment","farm_se","wages_contract"}
def _excluded(t): return t.startswith("excluded") or t.startswith("americorps") or ("vendor" in t)

# OBBBA §10104 internet-counts-toward-shelter cutoff. Pre-2025-11-01 internet counts;
# post-cutoff it doesn't. Parsed once at module load to avoid repeating in hot path.
_OBBBA_INTERNET_CUTOFF = _dt.date(2025, 11, 1)
def _parse_as_of(as_of_str, default=_dt.date(2026, 6, 1)):
    try:
        return _dt.date.fromisoformat(as_of_str)
    except (ValueError, TypeError):
        return default

LAD_SHELTER={"G01":1000,"G02":1000,"G03":1000,"G04":1000,"G05":1000,"G06":1000,"G07":600,"G08":600,"G09":600,"G10":600,"G11":600,
 "G12":1000,"G13":1600,"G14":1600,"MX1":3000,"MX3":3000,
 "H01":400,"H02":800,"H03":1200,"H04":1360,"H05":2000,"H06":3000,"H07":400,"H08":1200,"H09":1360,"H10":2000,"H11":2600,"H12":3000}
for pid,tot in LAD_SHELTER.items():
    D.setdefault(pid,{}); D[pid]["rent"]=tot; D[pid]["sua_tier"]="none"

def compute_benefit(facts, st):
    """Independent benefit oracle. Returns (benefit:int|None, deriv:dict).

    benefit=None when the state's SUA isn't authored (TX/KS/AK in v0.6) — consumers
    must not assert dollar amounts they can't trust. deriv always populated for
    auditability; carries an `unavailable` reason when benefit=None.
    """
    state_sua = PARAMS["sua_by_state"].get(st)
    if state_sua is None:
        return None, {"size":len(facts["household"]),"state":st,"unavailable":"SUA not authored for "+st,"benefit":None}

    hh=facts["household"]; sz=len(hh); ed=any(m.get("disability") or m.get("elderly") for m in hh)
    earned=0.0; unearned=0.0
    for i in facts["income"]:
        t=i["type"]; amt=i["amount"]
        if _excluded(t): continue
        if t in EARNED: earned+=amt
        else: unearned+=amt
    if earned<0: unearned=max(0.0,unearned+earned); earned=0.0
    EID=0.2*max(0.0,earned)
    sd=PARAMS["sd"].get(sz, PARAMS["sd"][6])
    dd=facts["deductions"]; med=max(0.0,dd["medical_unreimbursed"]-35) if (ed and dd["medical_unreimbursed"]>35) else 0.0
    other=dd["dependent_care"]+med+dd["child_support_paid"]
    A=earned+unearned-EID-sd-other
    sh=facts["shelter"]

    # Per-state SUA: substitute the state-specific tier value, regardless of what
    # facts.shelter.sua_amount carries (that's the CA-illustrative value from build()).
    tier_str=sh.get("sua_tier","none")
    state_sua_amt=state_sua.get(tier_str,0)

    # OBBBA §10104: pre-cutoff internet counts toward shelter; post-cutoff it doesn't.
    as_of=_parse_as_of(facts.get("as_of_date","2026-06-01"))
    internet = sh.get("internet",0) if as_of < _OBBBA_INTERNET_CUTOFF else 0

    # Homeless-deduction substitute per 7 CFR 273.9(d)(6)(i): homeless households can
    # elect the fixed homeless shelter deduction in lieu of excess-shelter calc.
    # The independent oracle applies it whenever facts.shelter.homeless_deduction=true.
    if sh.get("homeless_deduction"):
        shelter_amt = 0.0  # not used in this branch but reported for audit
        excess = PARAMS["homeless_ded"]
    else:
        shelter_amt = sh["rent"] + state_sua_amt + internet
        excess = max(0.0, shelter_amt - 0.5*A)
        if not ed:
            excess = min(excess, PARAMS["shelter_cap"])

    N=max(0.0,A-excess)
    tier=STATES[st]["allotment_tier"]; tbl=PARAMS["allotment_tables"].get(tier,PARAMS["allotment_tables"]["48"])
    maxA=tbl.get(sz, tbl[8]+(sz-8)*round(tbl[8]*0.125))
    b=round(maxA-0.30*N)
    if b<0: b=0
    if sz<=2 and 0<=b<PARAMS["min_benefit"]: b=PARAMS["min_benefit"]
    return b, {"size":sz,"state":st,"ed":ed,"earned":round(earned),"unearned":round(unearned),"EID":round(EID),"SD":sd,"other_ded":round(other),"adj_income":round(A),"shelter":round(shelter_amt),"excess_shelter":round(excess),"net_income":round(N),"max_allot":maxA,"benefit":b,"homeless_substitute":bool(sh.get("homeless_deduction"))}

def requires_for(f):
    r=set()
    for m in f["household"]:
        if m.get("student","not")!="not": r.add("eligibility.student")
        if m.get("disability"): r.add("deductions.medical"); r.add("shelter.uncapped")
        if m.get("elderly"): r.add("shelter.uncapped"); r.add("test.net_only")
        if str(m.get("work_class","")).startswith("abawd"): r.add("workreq.abawd")
        if m.get("immigration","citizen")!="citizen": r.add("eligibility.immigration")
        if m.get("disqual"): r.add("eligibility.disqualification")
        if m.get("role") in ("roomer","boarder","sponsored"): r.add("household.composition")
    for i in f["income"]:
        t=i["type"]; r.add("income."+("wages" if t in EARNED else "unearned"))
        if "se" in t: r.add("income.self_employment")
        if _excluded(t): r.add("income.exclusion")
    sh=f["shelter"]
    if sh.get("sua_tier","none")!="none": r.add("shelter.sua."+sh["sua_tier"])
    if sh.get("internet"): r.add("shelter.internet")
    if sh.get("homeless_deduction"): r.add("shelter.homeless")
    dd=f["deductions"]
    if dd["dependent_care"]: r.add("deductions.dependent_care")
    if dd["child_support_paid"]: r.add("deductions.child_support")
    if str(f.get("cat_elig")) not in ("NPA",): r.add("eligibility.categorical")
    r.add("test.gross_net_fpl")
    return sorted(r)

def name_for(p):
    s=re.sub(r"[^a-z0-9]+","-",p["label"].lower()).strip("-")[:46]
    return p["id"]+"-"+s

PAIRED={"M03":"M04","M04":"M03","M09":"M10","M10":"M09","S01":"S05","S05":"S01","S03":"S04","S04":"S03","MX1":"MX3","MX3":"MX1","P59":"D01"}
NEGCTRL={"P62","P65"}
MUST_REJECT={"D05","D03","D04","D06","D09"}

V={
 "M14":{"pre_2025-11-01":{"facts_patch":{"as_of_date":"2025-06-01","household.0.work_class":"abawd_exempt:veteran_homeless"},"verdict":"APPROVE"},"post_2025-11-01":{"facts_patch":{"as_of_date":"2026-06-01","household.0.work_class":"abawd_subject","household.0.abawd_months_used":3},"verdict":"DENY"}},
 "M16":{"work_19hr":{"facts_patch":{"household.0.weekly_work_hours":19,"household.0.student":"he_halftime_subject"},"verdict":"DENY"},"work_21hr":{"facts_patch":{"household.0.weekly_work_hours":21,"household.0.student":"he_exempt:work20"},"verdict":"APPROVE"}},
 "M17":{"child_11":{"facts_patch":{"household.1.age":11,"household.0.student":"he_exempt:single_parent_child_under12"},"verdict":"APPROVE"},"child_12":{"facts_patch":{"household.1.age":12,"household.0.student":"he_halftime_subject"},"verdict":"DENY"}},
 "M21":{"coresident_le_165pct":{"facts_patch":{"coresident_income_pct":160},"verdict":"APPROVE"},"coresident_gt_165pct":{"facts_patch":{"coresident_income_pct":170},"verdict":"DENY"}},
 "M22":{"roomer":{"facts_patch":{"household.0.role":"roomer","shares_meals":False},"verdict":"APPROVE"},"boarder":{"facts_patch":{"household.0.role":"boarder","shares_meals":True},"verdict":"DENY"}},
 "M23":{"averaged":{"facts_patch":{"income.0.anticipation":"averaged","income.0.amount":1800},"verdict":"APPROVE","note":"CA approves both; flips in non-BBCE"},"recent_high_month":{"facts_patch":{"income.0.anticipation":"recent_month","income.0.amount":2200},"verdict":"APPROVE","note":"lower benefit; DENY in non-BBCE"}},
 "M27":{"pre_2025-11-01":{"facts_patch":{"as_of_date":"2025-06-01","shelter.internet":60},"verdict":"APPROVE","note":"internet counts"},"post_2025-11-01":{"facts_patch":{"as_of_date":"2026-06-01","shelter.internet":0},"verdict":"APPROVE","note":"10104 removed"}},
 "M28":{"pre_2025-11-01":{"facts_patch":{"as_of_date":"2025-06-01","shelter.sua_tier":"HCSUA"},"verdict":"APPROVE","note":"heat-and-eat"},"post_2025-11-01":{"facts_patch":{"as_of_date":"2026-06-01","shelter.sua_tier":"LUA"},"verdict":"APPROVE","note":"10103 restricted to E/D"}},
 "M30":{"with_cs_deduction":{"facts_patch":{"deductions.child_support_paid":250},"verdict":"APPROVE"},"without":{"facts_patch":{"deductions.child_support_paid":0},"verdict":"DENY"}},
 "P51":{"age21_with_parent":{"facts_patch":{"household.0.age":21,"household.0.role":"child","must_combine_with_parent":True},"verdict":"DENY"},"age22_separate":{"facts_patch":{"household.0.age":22,"household.0.role":"head","must_combine_with_parent":False},"verdict":"APPROVE"}},
 "P52":{"active_warrant":{"facts_patch":{"household.0.disqual":["fleeing_felon"],"active_warrant":True},"verdict":"DENY"},"no_active_warrant":{"facts_patch":{"household.0.disqual":[],"active_warrant":False},"verdict":"APPROVE"}},
 "P53":{"medical_200":{"facts_patch":{"deductions.medical_unreimbursed":200},"verdict":"APPROVE"},"medical_30":{"facts_patch":{"deductions.medical_unreimbursed":30},"verdict":"DENY","note":"under $35 floor"}},
 "P54":{"cash_to_household":{"facts_patch":{"income.0.type":"gift_cash"},"verdict":"DENY","note":"countable unearned"},"vendor_to_landlord":{"facts_patch":{"income.0.type":"gift_vendor_payment"},"verdict":"APPROVE","note":"excluded vendor"}},
 "P55":{"neither_works":{"facts_patch":{"household.0.student":"he_halftime_subject","household.1.student":"he_halftime_subject"},"verdict":"DENY"},"one_works_20hr":{"facts_patch":{"household.0.student":"he_exempt:work20","household.1.student":"he_halftime_subject"},"verdict":"APPROVE"}},
 "P56":{"first_month_partial":{"facts_patch":{"income.0.amount":850,"income.0.source_status":"new"},"verdict":"APPROVE"},"ongoing_anticipated":{"facts_patch":{"income.0.amount":4500,"income.0.source_status":"ongoing"},"verdict":"DENY"}},
 "P58":{"below_net_limit":{"facts_patch":{"income.1.amount":400},"verdict":"APPROVE"},"above_net_limit":{"facts_patch":{"income.1.amount":1200},"verdict":"DENY"}},
 "P63":{"state_national":{"facts_patch":{"income.0.type":"americorps_sn_excluded"},"verdict":"APPROVE","note":"excluded NCSA 12637(d)"},"vista_prior_snap":{"facts_patch":{"income.0.type":"americorps_vista_excluded"},"verdict":"APPROVE"},"vista_no_prior":{"facts_patch":{"income.0.type":"americorps_vista_counted"},"verdict":"DENY"}},
 "P70":{"ge_20hr":{"facts_patch":{"household.0.student":"he_exempt:work20"},"verdict":"APPROVE"},"lt_20hr":{"facts_patch":{"household.0.student":"he_halftime_subject"},"verdict":"DENY"}},
}
CIT={"311_wages":"7 CFR 273.9(b)(1),(d)(2); 273.10(c)","312_se":"7 CFR 273.11(a),(b)","363_shelter":"7 CFR 273.9(d)(6)","364_sua":"7 CFR 273.9(d)(6)(iii)","365_medical":"7 CFR 273.9(d)(3)","346_unearned":"7 CFR 273.9(b)(2)","abawd":"7 CFR 273.24","student":"7 CFR 273.5","immigration":"7 CFR 273.4; FNA 6(f)","proration":"7 CFR 273.11(c)","resource":"7 CFR 273.8","cat_elig":"7 CFR 273.2(j)","150_unit":"7 CFR 273.1","lottery":"7 CFR 272.17","ipv":"7 CFR 273.16","fleeing_felon":"7 CFR 273.11(n)","drug_felony":"7 CFR 273.11(m)","excluded":"7 CFR 273.9(c)"}
INTEG={
 "P66":{"correct_input":{"unearned_ui":867},"agency_keyed":{"unearned_ui":2167},"qc_should_flag":True,"error_element":"346_unearned","reason":"keyed UI 2.5x documented"},
 "P67":{"correct_status":"abawd_exempt:caregiver_incapacitated","agency_keyed":"abawd_subject","qc_should_flag":True,"error_element":"abawd","reason":"countable months despite caregiver exemption"},
 "P68":{"correct_input":{"shelter.rent":450},"agency_keyed":{"shelter.rent":0},"qc_should_flag":True,"error_element":"363_shelter","reason":"verified rent altered; 298->24"},
 "P69":{"correct_status":"abawd_exempt:disabled","agency_keyed":"abawd_subject","qc_should_flag":True,"error_element":"abawd","reason":"disability exemption ignored"},
 "A03":{"correct_input":{"medical_unreimbursed":300},"agency_keyed":{"medical_unreimbursed":0},"qc_should_flag":True,"error_element":"365_medical","reason":"E/D medical omitted"},
 "M09":{"correct_input":{"shelter.rent":1500},"agency_keyed":{"shelter.rent":500},"qc_should_flag":True,"error_element":"363_shelter","reason":"shelter under-entered"},
 "M18":{"correct_method":"prorate_ineligible_income","agency_keyed":"count_full_ineligible_income","qc_should_flag":True,"error_element":"proration","reason":"counted full ineligible income"},
 "M28":{"correct_method":"HCSUA_only_if_ED","agency_keyed":"HCSUA_applied_nonED","qc_should_flag":True,"error_element":"364_sua","reason":"heat-and-eat applied to non-E/D"},
 "M30":{"correct_input":{"child_support_paid":250},"agency_keyed":{"child_support_paid":0},"qc_should_flag":True,"error_element":"363_shelter","reason":"child-support deduction omitted"},
 "M04":{"correct_input":{"wages":2400},"agency_keyed":{"wages":2100},"qc_should_flag":True,"error_element":"311_wages","reason":"wage anticipation under-converted"},
}
def cite_for(p): return CIT.get(p.get("es"),"7 CFR 273")
def basis_for(p):
    c=cite_for(p); n=p.get("note","")
    return (n+"  ["+c+"]") if n else ("tests "+(p.get("es") or "eligibility")+" determination ["+c+"]")
def label_fix(p): return {"D01":"Single adult, gross ~169% FPL (state-dependent)","D02":"Liquid assets $10k (state-dependent)"}.get(p["id"],p["label"])
def assets_field(p):
    d=D.get(p["id"],{}); cat=d.get("cat",p.get("cat","NPA"))
    if cat in ("pure_SSI","pure_PA"): return "n/a:categorical_no_asset_test"
    a=d.get("assets_override",p.get("assets")); return a if a is not None else "n/a:not_authored"
def build(p, deriv_collector):
    mems=_members(p); inc=_income(p,mems); sh=_shelter(p)
    # facts.shelter.sua_amount is the CA-illustrative anchor for human readability;
    # compute_benefit substitutes the per-state SUA from PARAMS["sua_by_state"][st]
    # when scoring each state's expected outcome.
    sh["sua_amount"]=0 if sh["sua_tier"]=="none" else PARAMS["sua"].get(sh["sua_tier"],663)
    d=D.get(p["id"],{})
    facts={"household":mems,"income":inc,"shelter":sh,"deductions":_ded(p),"assets":assets_field(p),
           "cat_elig":d.get("cat",p.get("cat","NPA")),"expedited":p.get("expedited",False),"sponsor_income":d.get("sponsor_income")}
    f2=dict(facts); f2["as_of_date"]=d.get("as_of","2026-06-01")
    rec={"id":name_for(p),"legacy_id":p["id"],"label":label_fix(p),"as_of_date":d.get("as_of","2026-06-01"),
      "facts":facts,"requires":requires_for(f2),"oracle_basis":basis_for(p),"citation":cite_for(p),
      "error_surface":{"mode":"flip" if p["kind"] in ("ab","state","fin") else "amount","element":p.get("es")},
      "negative_control":(p["id"] in NEGCTRL),"must_reject":(p["id"] in MUST_REJECT),
      "paired_with":PAIRED.get(p["id"]),"integrity":INTEG.get(p["id"])}
    if p["kind"]=="ab":
        rec["expected"]={"variants":V.get(p["id"],{k:{"facts_patch":{},"verdict":v} for k,v in p.get("variants",{}).items()})}
    else:
        eb={}
        for st in STATES:
            if p["kind"]=="fin": v_raw=fin_verdict(p.get("sz",1),p["gross"],p.get("assets",0),p.get("ed",False),st,p.get("net_ok",True))
            elif p["kind"]=="same": v_raw=p["verdict"]
            elif p["kind"]=="state": v_raw=p["per_state"][st]
            else: v_raw="APPROVE"
            # Normalize: state-kind profiles sometimes annotate the verdict
            # with a hint like "APPROVE(112)" for a recall-time amount; strip
            # to bare verdict so the schema enum {APPROVE, DENY} is satisfied.
            v = v_raw.split("(",1)[0].strip().upper() if isinstance(v_raw,str) else v_raw
            ben=None
            if v=="APPROVE":
                ben,dr=compute_benefit(f2,st)
                deriv_collector.append((p["id"],st,dr))
            eb[st]={"verdict":v,"eligible":v=="APPROVE","benefit":ben}
        rec["expected_by_state"]=eb
    return rec

def write_derivations_md(deriv, out_path, params):
    """Human-readable benefit derivation audit trail."""
    lines=["# Benefit derivations (independent oracle, illustrative FY2026 params)\n",
           "B = maxAllot - 0.30*Net ; Net = (earned + unearned - 20%%EID - SD - other_ded) - excess_shelter ; excess capped at $%d unless E/D ; homeless-deduction substitute = $%.2f when applicable.\n"%(params["shelter_cap"],params["homeless_ded"])]
    # Markdown lists CA only (back-compat with v0.5 file). JSON ledger carries all states.
    seen=set()
    for pid,st,dr in deriv:
        if st!="CA" or pid in seen or dr.get("unavailable"): continue
        seen.add(pid)
        homeless_note=" [homeless-sub]" if dr.get("homeless_substitute") else ""
        lines.append("- **%s**: sz %d%s | earned %d + unearned %d - EID %d - SD %d - other %d = adj %d | shelter %d, excess %d -> net %d | maxAllot %d -> **$%d**%s"%(
            pid,dr["size"]," E/D" if dr["ed"] else "",dr["earned"],dr["unearned"],dr["EID"],
            dr["SD"],dr["other_ded"],dr["adj_income"],dr["shelter"],dr["excess_shelter"],
            dr["net_income"],dr["max_allot"],dr["benefit"],homeless_note))
    with open(out_path,"w") as f: f.write("\n".join(lines))

def write_derivations_json(deriv, out_path):
    """Diff-friendly oracle ledger: every (profile, state) -> derivation breakdown.
    Lets PR review catch component-level regressions (EID changed, SD bumped, etc.)."""
    ledger={}
    for pid,st,dr in deriv:
        ledger.setdefault(pid,{})[st]=dr
    with open(out_path,"w") as f: json.dump(ledger,f,indent=2,sort_keys=True)

def write_summary(profiles, out_path):
    """Coverage report: tells reviewer at a glance where coverage is thin."""
    from collections import Counter
    by_requires=Counter()
    by_element=Counter()
    by_cat_elig=Counter()
    by_immigration=Counter()
    by_work_class=Counter()
    by_must_reject=Counter()
    by_paired=Counter()
    by_state_diff=0
    for p in profiles:
        for r in p.get("requires",[]): by_requires[r]+=1
        es=p.get("error_surface",{}).get("element"); by_element[es or "(none)"]+=1
        ce=p.get("facts",{}).get("cat_elig","NPA"); by_cat_elig[ce]+=1
        for m in p.get("facts",{}).get("household",[]):
            by_immigration[m.get("immigration","citizen")]+=1
            by_work_class[m.get("work_class","gen_work_subject")]+=1
        if p.get("must_reject"): by_must_reject["true"]+=1
        if p.get("paired_with"): by_paired["paired"]+=1
        eb=p.get("expected_by_state")
        if eb:
            verdicts={st:b.get("verdict") for st,b in eb.items()}
            if len(set(verdicts.values()))>1: by_state_diff+=1
    summary={
        "total_profiles":len(profiles),
        "by_requires_tag":dict(sorted(by_requires.items())),
        "by_error_surface_element":dict(sorted(by_element.items())),
        "by_cat_elig":dict(sorted(by_cat_elig.items())),
        "by_immigration":dict(sorted(by_immigration.items())),
        "by_work_class":dict(sorted(by_work_class.items())),
        "negative_or_must_reject":{"must_reject":by_must_reject["true"]},
        "paired_profiles":by_paired["paired"],
        "profiles_with_state_verdict_divergence":by_state_diff,
        "ab_variant_profiles":sum(1 for p in profiles if "expected" in p and "variants" in p.get("expected",{})),
        "integrity_profiles":sum(1 for p in profiles if p.get("integrity")),
    }
    with open(out_path,"w") as f: json.dump(summary,f,indent=2,sort_keys=True)

def main():
    parser=argparse.ArgumentParser(description="Civica SNAP test-profile generator (v0.6)")
    default_out=os.environ.get("CIVICA_PROFILES_OUT_DIR", os.path.dirname(os.path.abspath(__file__)))
    parser.add_argument("--out-dir",default=default_out,help="Output directory (default: %(default)s)")
    parser.add_argument("--state-default",default="CA",help="Hint to consumers when no state explicitly chosen")
    args=parser.parse_args()
    os.makedirs(args.out_dir,exist_ok=True)

    states_lib={st:{**STATES[st],"max_allotment_table":PARAMS["allotment_tables"].get(STATES[st]["allotment_tier"],PARAMS["allotment_tables"]["48"]),"sua_by_tier":PARAMS["sua_by_state"].get(st)} for st in STATES}

    deriv=[]
    profiles=[build(p, deriv) for p in P]

    out={
      "meta":{
        "version":"0.6","fy":"2026","basis":"post-OBBBA (2025-11-01)","count":len(profiles),
        "default_state":args.state_default,
        "states":states_lib,"params":PARAMS,
        "tolerances":{"verdict":"exact_match","benefit":"exact_match","snap_qc_payment_error_threshold_dollars":58,
          "note":"$58 is SNAP QC program tolerance, not test slack."},
        "how_to_use":"Facts are state-independent. Pick a state from expected_by_state to run; A/B rows: apply expected.variants[k].facts_patch then assert verdict. requires[] lists engine surfaces so a partial engine can skip unbuilt ones. integrity rows: feed agency_keyed, assert qc_should_flag.",
        "caveats":[
          "Benefits computed by an INDEPENDENT oracle from facts (four-eyes), not citeable as PER; reconcile params.sd/allotment with production before trusting $.",
          "SUA pinned to production for CA (663/170/20) and MA (914/556/64). TX/KS/AK SUA still illustrative — those states' expected_by_state benefits are null until production values land.",
          "Generic dependent ages synthesized where unpinned; oracle/citation policy-sourced, never regenerate from the engine.",
          "compute_benefit applies the homeless-deduction substitute ($198.99 FY26) per 7 CFR 273.9(d)(6)(i) when shelter.homeless_deduction=true.",
        ],
      },
      "profiles":profiles,
    }

    profiles_path=os.path.join(args.out_dir,"civica_test_profiles.json")
    deriv_md_path=os.path.join(args.out_dir,"benefit_derivations.md")
    deriv_json_path=os.path.join(args.out_dir,"benefit_derivations.json")
    summary_path=os.path.join(args.out_dir,"summary.json")

    with open(profiles_path,"w") as f: json.dump(out,f,indent=2)
    write_derivations_md(deriv, deriv_md_path, PARAMS)
    write_derivations_json(deriv, deriv_json_path)
    write_summary(profiles, summary_path)

    print("v0.6 profiles:",len(profiles))
    print("out dir:",args.out_dir)
    byid={r["legacy_id"]:r for r in profiles}
    print("ladder benefits CA:",{k:byid[k]["expected_by_state"]["CA"]["benefit"] for k in ["G01","G03","G06","G07","G11","MX1","H05","H10"]})
    print("ladder benefits MA (first 4):",{k:byid[k]["expected_by_state"]["MA"]["benefit"] for k in ["G01","G03","G06","G11"]})
    print("TX/KS/AK should be null:",{k:byid["G01"]["expected_by_state"][k]["benefit"] for k in ["TX","KS","AK"]})
    print("requires sample (A03):",byid["A03"]["requires"])
    print("names sample:",byid["M28"]["id"])

if __name__=="__main__":
    main()
