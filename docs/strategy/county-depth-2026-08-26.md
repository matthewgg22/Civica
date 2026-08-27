# The roster is a mile wide and two banks deep

**2026-08-26.** Matthew's read: in the biggest counties there are only about two banks each,
which is too thin. Checked, and he is right — more so than my own reporting showed.

## What the roster actually looks like

| County | On roster | Addressable with branches | Unworked |
|---|---:|---:|---:|
| **Dallas, TX** | **0** | 67 | 67 |
| Los Angeles, CA | 5 | 54 | 49 |
| Harris, TX | 7 | 48 | 41 |
| **Tarrant, TX** | **0** | 47 | 47 |
| **New York, NY** | **1** | 46 | 45 |
| Cook, IL | 3 | 44 | 41 |
| Orange, CA | 5 | 43 | 38 |
| Miami-Dade, FL | 2 | 30 | 28 |
| **Bexar, TX** | **0** | 28 | 28 |
| Maricopa, AZ | 3 | 27 | 24 |
| Davidson, TN | 1 | 22 | 21 |
| Jefferson, KY | 2 | 20 | 18 |

**486 addressable banks with branches in these fifteen counties have never been looked at.**
Dallas, Tarrant and Bexar have **zero** roster banks against 67, 47 and 28 addressable. And
across the whole roster, **30 of 59 covered counties contain exactly one bank.**

## My own metric was hiding it

`branch_exposure_percounty.json` assigns each bank to a **single** `top_county`, so a bank
whose largest county is elsewhere disappears from every other county's count. Asked how many
addressable banks sit in Cook or Los Angeles, it answered **zero** — flatly false. The true
figures are 44 and 54.

`county_depth.json` replaces it, built by querying each county directly and intersecting with
the addressable universe.

## The cause: I read down a global ranking

The reading queue was ordered by **branch-weighted exposure across the whole country**. That
maximises the value of each individual read and, as a direct consequence, **spreads reads
thinly across many counties** — one bank in Davidson, one in New York, two in Jefferson.

For the pitch that is close to the worst possible shape:

- **A pooled ask needs several banks in one geography.** "We are approaching several
  institutions that share this assessment area" is not a sentence you can write to a
  single bank.
- **The artifact is already per-county work.** The need model, the map and the funnel are all
  built per assessment area, so the second bank in a county is far cheaper than the first in
  a new one.
- **The yield maths.** At a 10% reply rate, fifteen Harris banks is one or two conversations;
  two banks is most likely zero. Depth converts, breadth does not.

## The change

Stop reading down a national ranking. **Pick counties and work them out.** Concrete order,
by unworked depth against need:

1. **Harris, TX** — 7 loaded, 41 unworked. Already the deepest; finishing it produces the
   first county where a pooled ask is credible.
2. **Dallas + Tarrant, TX** — 0 loaded, 114 unworked between them, and the state metadata,
   need model and template already exist from Houston.
3. **Cook, IL** — 3 loaded, 41 unworked.
4. **Los Angeles + Orange, CA** — 10 loaded, 87 unworked, in the launch state.

Nothing about the method changes — the pre-filter, the probe and the per-AA read all stay.
What changes is the order they are applied in.

## Caveat carried forward

Branch presence still is not assessment-area membership. Frost has 61 Houston branches and
excludes four Houston MSA counties. These depth counts order a reading queue and nothing more;
every assessment area still comes from the evaluation.
