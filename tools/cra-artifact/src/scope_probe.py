"""Before committing to a full PE read, answer two questions in ~30 seconds.

  1. Is the target assessment area FULL-SCOPE?
  2. Does a donations row exist that is scoped to it?

Two branch-based proxies were tried and both failed. National concentration
failed because First-Citizens has 2 of ~550 branches in Phoenix and Phoenix was
still full-scope. Within-state share failed harder -- across the nine banks read,
the ones WITHOUT a usable figure scored higher (34%, 31%, 25%) than the ones with
it (26%, 18%, 9%). Full-scope status is the bank's own scoping decision inside a
rated area, and nothing outside the document predicts it.

So stop predicting and just look. This downloads the PE, extracts with -layout
(flattened text destroys the table row labels that carry the answer), and reports.

    python3 scope_probe.py <label> <file_id> <AA name>
"""
import re, subprocess, sys, os

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"

def probe(label, file_id, aa):
    pdf, txt = f"/tmp/sp_{label}.pdf", f"/tmp/sp_{label}.txt"
    if not os.path.exists(txt):
        url = (file_id if file_id.startswith("http")
               else f"https://crapes.fdic.gov/publish/{file_id}")
        subprocess.run(["curl","-sSL","--max-time","180","-A",UA,url,"-o",pdf],
                       capture_output=True)
        subprocess.run(["pdftotext","-q","-layout",pdf,txt], capture_output=True)
    try:
        lines = open(txt, errors="ignore").read().split("\n")
    except OSError:
        return label, "FETCH FAILED", None, None
    flat = re.sub(r"\s+", " ", "\n".join(lines))

    # 1. scope
    scope = "unknown"
    for m in re.finditer(r"[^.]{0,200}" + re.escape(aa) + r"[^.]{0,200}", flat):
        s = m.group(0).lower()
        if "full-scope" in s or "full scope" in s: scope = "FULL"; break
        if "limited-scope" in s or "limited scope" in s: scope = "limited"
    if scope == "unknown":
        for m in re.finditer(r"(full-scope|limited-scope)[^.]{0,220}", flat, re.I):
            if aa.lower() in m.group(0).lower():
                scope = "FULL" if m.group(1).lower().startswith("full") else "limited"; break

    # 2. a donations row in a table that also names the AA.
    #
    # This is a HINT, not a gate. Measured on the nine banks already read it is
    # right 6 of 8, and both failures are understood:
    #
    #   * Glacier -- FALSE POSITIVE. Its Arizona table lists Phoenix as a row and
    #     carries a Donations line that is the STATE total. The window sees both.
    #   * First-Citizens -- FALSE NEGATIVE. Its figure is a sentence ("seven
    #     donation or grant contributions totaling $59,149"), not a table row.
    #
    # A stricter version that required the AA to be the table's SUBJECT and also
    # searched prose scored WORSE (4 of 8) -- it broke Truist and OZK, whose rows
    # sit in tables titled by rated area. Three predictors have now been tried and
    # discarded (national branch concentration, within-state branch share, strict
    # table-subject matching). Treat the output as an ordering hint and read the
    # section before recording any figure.
    figure = None
    for i, l in enumerate(lines):
        if re.search(r"(Donations|Grants &)", l) and re.search(r"[\d,]{2,}", l):
            blk = "\n".join(lines[max(0, i-32):i+4])
            if aa.split()[0].lower() in blk.lower():
                figure = l.strip()[:110]; break

    return label, scope, figure, len(lines)

if __name__ == "__main__":
    print(*probe(*sys.argv[1:4]), sep="  |  ")
