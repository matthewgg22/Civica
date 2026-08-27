"""CRA officers named on the Consumer Bankers Association's Community
Reinvestment Committee roster.

This is a public professional directory of the people who hold the CRA function
at CBA member banks -- exactly the role our outreach is addressed to, and the
first source found that names them at any scale. Retrieved 2026-08-26 from
consumerbankers.com/committee/community-reinvestment-committee/.

Titles are recorded as the roster states them. Where a bank name is ambiguous
(several unrelated banks share "Five Star Bank", "City National Bank",
"Independent Bank", "United Bank"), the entry is marked ambiguous and is NOT
auto-matched to a roster record -- a wrong name on a letter is worse than a role
route.
"""
import json

ROSTER = [
    ("Doug Schaeffer", "Executive Director, CRA & Community Development", "Woodforest National Bank", False),
    ("Camino Smith", "SVP, Manager - Community Reinvestment", "Banner Bank", False),
    ("Reza Aghamirzadeh", "EVP, Head of Community Development", "Citizens", False),
    ("Steven Akerlow", "CRA Officer", "American Express", False),
    ("Ryan Demarco Anderson", "Director, Bank Community Reinvestment", "Ameriprise Bank, FSB", False),
    ("Nathalia Artus", "Head of Community Impact", "Atlantic Union Bank", False),
    ("Jan Bergeson", "Executive Compliance Director and CRA Officer", "Ally Bank", False),
    ("Melissa Borino", "Director, CRA Governance", "BMO", False),
    ("Stephanie Cameron", "SVP, CRA Director", "KeyBank", False),
    ("Michele Collie", "SVP, Director CRA Officer", "City National Bank of Florida", True),
    ("Kristen Comstock", "CRA Strategic Planning & Governance Director", "JPMorgan Chase", False),
    ("Isabel Cruz", "CRA & Community Development Reporting Officer", "Rockland Trust Company", False),
    ("Glenn Davis", "First VP / CRA Officer", "Liberty Bank", True),
    ("Melinda DesJardins", "SVP, Director CRA Program Office", "U.S. Bank", False),
    ("Bradley Dossinger", "EVP, Manager - CRA", "M&T Bank", False),
    ("Justin Dunn", "SVP, Chief Community Impact Officer", "WSFS Bank", False),
    ("Kevin Girvin", "Managing Director, CRA Program Management", "Webster Bank, N.A.", False),
    ("Staci Glenn Short", "SVP, Community Development Program Director", "Huntington Bank", False),
    ("Cathryn Gonzalez", "Senior Compliance Manager & CRA Officer", "Five Star Bank", True),
    ("Jada Grandy-Mock", "Head of CRA Strategy and Program Management", "Wells Fargo", False),
    ("Irene Guzman", "First VP - Corporate CRA Officer", "International Bank of Commerce", False),
    ("Angie Hadley", "SVP, CRA Officer", "First Financial Bankshares", True),
    ("Wayne Hilliard", "Vice President, CRA", "Texas Capital Bank", False),
    ("Michael Innis-Thompson", "SVP, Head of Community Development", "TD Bank", False),
    ("Rhonda Jones", "Community Development Officer", "First Interstate Bank", False),
    ("Kristin Kraska", "Managing Director", "Citi", False),
    ("Charles Lee", "1st VP, Director of Regulatory Affairs, CRA Officer", "MidFirst Bank", False),
    ("Chelsey Lombardi", "Community Reinvestment Act Manager", "Northwest Bank", True),
    ("LaReta Lowther", "Director of Community Development", "WesBanco", False),
    ("Lasha Marshall", "Director of Compliance - CRA", "Bank OZK", False),
    ("Jim Matthews", "Senior VP, CRA Strategy", "Capital One", False),
    ("Roddell McCullough", "Chief Corporate Responsibility Officer", "First Financial Bank", True),
    ("Beverly Meek", "CRA Director", "Flagstar Bank", False),
    ("Liza Mistry", "Sr. Director of Fair Lending & CRA Compliance", "Fifth Third Bank", False),
    ("Bernadette Mueller", "EVP and Chief CSR-CRA Officer", "Valley National Bank", False),
    ("Amanda Peters", "VP, Compliance Manager", "Zions Bancorp", False),
    ("Chandra Rodgers", "Risk and Compliance Director", "Associated Bank", False),
    ("Angie Smedley", "CRA Officer", "SoFi Bank", False),
    ("Cheri Smith", "SVP, Director of Corporate Responsibility", "S&T Bank", False),
    ("Oscar Solis", "SVP, Director of Consumer Compliance", "Bank of Hawaii", False),
    ("Danny Spears", "Director, CRA Performance Management", "PNC Bank", False),
    ("Ginny Stroud", "Community Development Manager", "United Bank", True),
    ("Cade Stubblefield", "Director, Compliance Risk Management - CRA", "USAA Federal Savings Bank", False),
    ("Adey Tesfaye", "CRA Officer", "City National Bank", True),
    ("Kimberly Topping Morris", "SVP, Head of CRA", "EverBank", False),
    ("Beth Trotter Broussard", "EVP, CRA Officer", "First Horizon", False),
    ("Alan Urie", "SVP & CRA Officer", "Synchrony", False),
    ("Alicia Vela", "SVP, CRA Senior Manager", "Bank of America", False),
    ("Anthony Weekly", "Chief EVP, Chief CRA Officer", "Truist", False),
    ("Stephanie White", "CRA Officer", "Bread Financial", False),
    ("Cecil Williams", "EVP, Fair Banking Director", "Regions Bank", False),
    ("Sawyer Williams", "Senior VP, CRA Officer", "Frost Bank", False),
    ("Courtney Williams", "EVP, Director of CRA Strategy", "Mechanics Bank", False),
    ("Evan Zuverink", "Vice President, CRA Officer", "First Commonwealth Bank", False),
]

if __name__ == "__main__":
    out = [dict(name=n, title=t, bank=b, ambiguous=a) for n, t, b, a in ROSTER]
    json.dump(out, open("cba_cra_officers_2026.json", "w"), indent=1)
    print(f"CRA officers recorded: {len(out)}   ambiguous bank names: {sum(1 for x in out if x['ambiguous'])}")
