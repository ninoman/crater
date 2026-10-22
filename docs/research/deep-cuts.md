# Research: recommending lesser-known releases ("deep cuts")

Research only, 2026-10-21. Nothing here is built yet. Method: one orchestrator brief (appendix A), seven parallel research sub-agents (one per question), then the synthesis below. The two claims the recommendation rests on, Zhou et al.'s λ convention and RP3β's default β, were checked against the sources directly (appendix B).

## The problem in one paragraph

*Also bought*, *Taste twins* and *For you* all rank by co-ownership. For you's popularity damping is `w(i) = 1 / log2(2 + n)`, which is mild: a release with 1,000 owners still keeps 0.10 against 0.43 for one with 3 owners, a ratio of about 4. So a release that every twin owns wins over a record that two close twins own and almost nobody else does. We want a mode that brings up the second kind on purpose, and says why.

## What the research found

Duplicates are merged and contradictions resolved. Sources are in appendix B.

### 1. The literature's answer is one family of formulas, and For you is already a mild member of it

- **HybridS** (Zhou et al., PNAS 2010) on a fans × releases graph, collapsed for one user (derivation checked):
  `score(α) = k_α^−(1−λ) · Σ_{fans i owning α} (1/k_i) · Σ_{β ∈ mine ∩ i} k_β^−λ`.
  The inner part is a rarity-weighted user similarity. The outer `k_α^−(1−λ)` is a **power-law penalty on the candidate's popularity**. λ=0 (HeatS) favours niche items, λ=1 (ProbS) favours popular ones. The tuned λ on the **RateYourMusic** dataset was 0.41, so the candidate exponent is ≈ 0.59.
- **RP³β** (Christoffel et al. 2015, Paudel et al. 2017) is the same shape from the random-walk side: a 3-hop walk me → release → fan → release, divided by `deg(α)^β`. irspack's default is **β = 0.6**.
- **For you** today is `Σ_twins s(F) × w(α)`. Shared-item rarity already sits inside `s(F)` (Σ w over the overlap, divided by √ of both sizes, §7). So For you *is* this family, but with a log penalty on the candidate instead of a power. **The main lever for deep cuts is the shape and strength of the candidate penalty, not a new graph algorithm.**
- At β = 0.6 the head is penalised much harder: 1,000 owners → 0.016 vs 3 owners → 0.52 (ratio ≈ 32, against ≈ 4 today).

### 2. Popularity must be Bandcamp's global count, not our local one

All agents agreed. Local `matchOwners` is a sample shaped by *where we scanned*, and we scan around your twins. Penalising by it is circular: your neighbourhood looks popular because we read it. Use `items.supporterCount` (Bandcamp's `also_collected_count + 1`, free with every collection item) for the penalty and for "Only N owners" in the reason line. Releases with no Bandcamp count are left out of deep cuts rather than guessed: we can't honestly call them niche.

### 3. A power law needs no population size, unlike IUF and BM25

IUF `log(N/n)` and BM25's IDF need N, the total number of Bandcamp fans, which we don't know. One agent proposed BM25 with N = scanned fans. **That is a unit mismatch** (global n over local N) and clips every release with more global owners than we've scanned to weight 0, so it's rejected. `n^−β` is scale-free: the ranking doesn't depend on N.

### 4. Sparse data: the noise is in the *evidence*, not in n

Bandcamp's n is exact even for tiny releases. What's noisy is how many twins back a pick. One twin's oddity on a 1-owner record shouldn't top the list. Every agent flagged this. The cheap, standard fix is shrinkage on the twin count, `t / (t + c)`, plus the sum over twins, which already rewards agreement. "Two twins both own an obscure record" is stronger evidence than one, and HybridS's additive sum says the same.

### 5. Things that are real but come later

- **Early adopters / tastemakers.** No validated formula exists; the closest is patent-level "earliness" (share of a release's buyers who came after you). It's cheap with our data (supporter purchase times), but **only exact for releases with ≤ 500 supporters**, and it's confounded by preorders, label subscribers and Bandcamp Friday sprees. Verdict: test it as a boost later ("do early buyers later overlap more with your twins?").
- **Tags and labels.** The literature backs the existing §12 rule: re-rank only, never a candidate source. Tags are thinnest exactly in the tail (Turnbull et al. 2008), and CF evidence beat tag similarity for propagation (Kim et al. 2009). Our 1–3-owner releases still have CF evidence, so content should enrich it, not replace it.
- **Mainstreaminess-adaptive β** (Bauer & Schedl 2019, LFM-1b): users with niche taste are served better by CF tuned for niche users. We could set β from the mean log-popularity of your own collection. It's a tuning step after real data exists.
- **Popularity calibration** (Steck 2018; Abdollahpouri et al. 2020): a greedy re-rank to match your head/mid/tail mix. It's the right tool for a *mixed* list (For you itself), but overkill for a dedicated deep-cuts list.
- **Prior art in products.** Spotify's "pulse vs edge" playlists (Every Noise / Glenn McDonald) use an **explicit popularity threshold** for the "edge". That supports a hard cap plus a visible count in the UI. Spotify's *Fans also like* normalises shared fans by both audiences, which is what our √(|M|·|F|) already does.

### 6. Offline metrics we can compute without feedback

Recall@k on a held-out part of your collection, ARP (mean popularity of the list, on `log2(1 + n)`), APLT (share of the list in the long tail), and **niche recall**: recall restricted to held-out releases that are themselves niche. Catalog coverage and Gini need many users, so they don't apply to a single-user extension. Holdout evaluation rewards popularity (your collection is head-skewed), so a deep-cuts scorer must be judged on niche recall, never on plain recall.

## Scorecard

1 = poor, 5 = good. "Sparse" = signal quality when a release has 1–3 known owners.

| Approach | Data fit | Sparse | Cost (IDB) | Explainable | Testable (pure) | Effort | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **A. Twin evidence × agreement shrink × power penalty on global n, niche cap** | 5 | 4 | 4 | 5 | 5 | 4 | Reuses twins, exclusions, rows. RP³β/HybridS candidate term on our twin layer. |
| B. *Edge* filter: For you limited to n ≤ cap | 5 | 3 | 4 | 5 | 5 | 5 | Cheapest. Keeps the mild log penalty, so the list fills with near-cap releases. |
| C. Full RP³β / HybridS 3-hop walk from you | 4 | 3 | 3 | 2 | 4 | 2 | Bypasses the twin layer (label-cluster ×0.3, track rules, lately). "Reached by random walks" is no reason line. |
| D. IUF / BM25 reweighting | 2 | 3 | 5 | 4 | 5 | 5 | Needs the global N we don't have (§3 above). |
| E. Popularity calibration re-rank | 4 | 3 | 5 | 2 | 5 | 3 | Better for balancing For you itself. |
| F. Early-adopter boost | 3 | 2 | 4 | 4 | 4 | 3 | Unvalidated, ≤ 500-supporter releases only. Later. |
| G. Tag / label re-rank | 2 | 2 | 2 | 4 | 4 | 2 | Needs release-page fetches. Later, re-rank only (§12). |

## Recommendation: a *Deep cuts* mode of For you (approach A)

### Scoring formula

For each release α owned by at least one of your top `DEEP_CUT_TWINS_K` twins, and not excluded (same `exclusions()` as today: hidden, owned or wishlisted as a whole, or an album you own a track of):

```
t(α)  = number of those twins who own α
T(α)  = Σ s(F) over those twins            (s = all-time twin score, label clusters already ×0.3)
n(α)  = max(supporters(α), t(α))           (Bandcamp's count; α is skipped if it has none)

eligible  ⇔  n(α) ≤ DEEP_CUT_MAX_SUPPORTERS
score(α)  = T(α) × t / (t + DEEP_CUT_AGREEMENT) × n(α)^(−DEEP_CUT_BETA)
```

- `T × t/(t+c)`: the evidence. Twins' similarity summed, then shrunk so one twin alone counts a third (c = 2) and agreement counts for more.
- `n^−β`: the HybridS / RP³β candidate penalty, β = 0.6 from both sources.
- The cap makes the mode mean what it says ("edge", like Spotify's), keeps "Only N owners" truthful, and shrinks the candidate set.
- **Pruning stays valid:** `t/(t+c) < 1` and `n^−β ≤ 1`, so `T × t/(t+c)` is a ceiling known *before* any item lookup. That is a tighter ceiling than For you's `couldRank`.
- Same diversity rule as For you (≤ 2 per artist in the first 20).

Constants, in `src/scoring/weights.ts` next to `weight()`:

```ts
/** Deep cuts: twins drawn on. More than For you's K, since niche picks are spread thin. */
export const DEEP_CUT_TWINS_K = 100;
/** Candidate popularity penalty n^−β. 0.6: RP³β's default, and Zhou et al.'s tuned λ on RYM. */
export const DEEP_CUT_BETA = 0.6;
/** Agreement shrink t/(t + c): one twin alone counts 1/3, two 1/2, four 2/3. */
export const DEEP_CUT_AGREEMENT = 2;

/** n^−β for a release's Bandcamp owner count. 1 for a release only one fan owns. */
export function nichePenalty(supporterCount: number, beta = DEEP_CUT_BETA): number
```

The cap is a user setting, not a constant: what counts as rare depends on the genre you dig in.

```ts
// src/shared/settings.ts
/** Releases with more Bandcamp owners than this are not deep cuts (decisions §18). */
deepCutMaxSupporters: number; // default 50: underground electronic runs small. Range 5–1000.
```

It sits in the popup's settings with the other recommendation settings, and the empty state and the reason line read it rather than a hard-coded 50.

### Reason-line copy

The count is always Bandcamp's, so the copy says "on Bandcamp" to make clear it isn't "among fans we've scanned".

| Case | Copy |
| --- | --- |
| 2+ twins | "Only 4 owners on Bandcamp · 3 are your twins" |
| every owner is a twin | "Only 3 owners on Bandcamp, all your twins" |
| 1 twin | "Only 12 owners on Bandcamp · one is your #3 twin" |

### Where it lives

- **`src/scoring/deepCuts.ts`** (pure): `scoreDeepCut(candidate, supporterCount)`, `deepCutCeiling(candidate)`, `rankDeepCuts`, and the reason-line inputs. It reuses `twinOwnership`, `diversify` and `topTwins` from `forYou.ts`, and `exclusions.ts`.
- **A mode of For you, not its own tab**: `For you · All / Fresh / Deep cuts`. That's the same pattern as the Twins tab's *All time / Lately* switch, with the same basis and empty states, and the same `ReleaseRow`. The worker side is `computeDeepCuts` next to `computeForYou` (`background/recommend/`), gathering through the existing `gatherForYou` with K = 100.
- Message: `getForYou { mode: 'all' | 'fresh' | 'deep' }` (a discriminated mode, so *Fresh* slots into the same switch). `ForYouRow` gains `supporters: number` for the copy, and the best twin's rank.

### Data we don't store yet

**Nothing required.** `supporterCount`, twin scores, `fanMatches` and the leaderboard ranks are all there. Optional, later:

- `genre_id` per collection item (free, §12): for a later "same genre as your collection" guard.
- When `supporterCount` was read: Bandcamp counts grow, so a release we saw at 40 may now have 400. A re-scan refreshes it; a timestamp would let the UI say "as of …". Not needed for v1.
- **To measure first:** reading item records for candidates. With K = 100 twins, the union of their lists can reach ~10⁵ ids. The ceiling cuts most of that before any lookup, but run `pnpm perf`. If it's over budget, add an `items.supporterCount` index (schema v9) and intersect candidates with `where('supporterCount').belowOrEqual(cap)`.

### Synthetic test dataset

Five twins: A 0.6, B 0.5, C 0.4, D 0.3, E 0.2. None of these releases are yours.

| Release | Owned by twins | Bandcamp owners n | For you today | Deep cuts |
| --- | --- | --- | --- | --- |
| `staple` | A B C D E | 40 | **0.371** (1st) | 0.156 (2nd) |
| `niche` | C D | 3 | 0.301 (2nd) | **0.181** (1st) |
| `mid` | A B | 25 | 0.231 | 0.080 (3rd) |
| `hit` | A B C D E | 2,000 | 0.182 | excluded (cap) |
| `lone` | E | 1 | 0.126 | 0.067 (4th) |

Tests to write:

1. `niche` outranks `staple` under deep cuts, and the reverse holds under For you (`forYou.test.ts` stays as it is).
2. `hit` is excluded by the cap. With the cap off it scores 0.015, still last.
3. `lone` (one weak twin, a 1-owner record) stays below `staple`: the shrink keeps single-twin oddities from topping the list. It also stays below `mid` (two twins): c is the knob that sets how far one twin alone can go.
4. A release with no Bandcamp count is skipped, not scored on local owners.
5. The ceiling `T × t/(t+c)` is ≥ every score (pruning safety), and a candidate whose ceiling is below the 60th-best score is never looked up.
6. Reason-line inputs: `{ supporters: 3, twins: 2, bestTwinRank }` for `niche`.

### Offline evaluation plan

A script like `pnpm perf` (`tests/eval/deepCuts.ts`, kept out of `pnpm test`). It runs on **your own full-database backup** loaded into fake-indexeddb. It prints aggregate numbers only and never commits personal data.

1. **Splits.** (a) *Temporal*: hold out your newest 20% of purchases ("would it have found what I bought next?"). (b) *Random*: 5 folds of 20%.
2. **No leakage through twins.** Remove the held-out releases from your lists, then **recompute the twin leaderboard** from what's left before scoring anything. The stored board was built *with* those releases. Residual leakage remains: some fans were discovered through held-out releases' supporter lists. The temporal split limits it, and the doc reports it as a caveat.
3. **Methods.**
   - Popularity baseline: rank by `T` only.
   - For you as today.
   - *Edge* filter (approach B).
   - Deep cuts over a grid: β ∈ {0.3, 0.45, 0.6, 0.8}, c ∈ {0, 1, 2, 4}, cap ∈ {25, 50, 100}.
4. **Metrics, each at k = 30 and 100:**
   - Recall@k on everything held out.
   - **Niche recall@k** on held-out releases with n ≤ cap. This is the target.
   - ARP = mean `log2(1 + n)` of the list.
   - Median n of the hits.
   - Share of the list with t = 1 (noise check).
5. **Success bar.** Deep cuts' niche recall@30 is at least 1.5× For you's, and the median n of its hits is under a fifth of For you's. Report each method as a (recall, niche recall) pair, never a single score. Pick the default β and c from the grid on the temporal split.
6. **Caveats to print with the numbers.** About 1,100 owned releases means roughly 220 held out, and perhaps 100 of those are niche, so show the spread across folds. Holdout favours popular items, so plain recall will understate deep cuts.

## Cheap alternative (approach B)

If the full mode is too much for now: an *Edge* toggle on For you that only filters to `supporters ≤ 50` and changes the reason line. No new formula and about a day of work. Its weakness is that the log penalty barely separates 5 from 95 owners, so the list fills with near-cap releases that many twins own. It's also the eval's mid baseline, so building A gets B almost for free.

## Decision

*(Recorded in `docs/decisions.md` as §18, since §13 was taken by then.)*

> ## 18. Deep cuts (planned)
>
> Researched 2026-10-21: `docs/research/deep-cuts.md`.
>
> - **A third mode of For you**, next to *Fresh*: `All / Fresh / Deep cuts`. It reuses For you's twins, exclusions, rows and diversity rule.
> - **Score** = `T × t/(t + c) × n^−β`, limited to `n ≤ cap`. T is the sum of the all-time scores of the top-K twins who own the release, t is how many own it, and n is Bandcamp's owner count (`supporterCount`). Defaults: K = 100, c = 2, β = 0.6 (RP³β's default and Zhou et al.'s tuned value on RateYourMusic data), cap = 50 (underground electronic releases run small). K, c and β live in `scoring/weights.ts`; the cap is a user setting, `deepCutMaxSupporters` (5–1000), since what counts as rare depends on the genre.
> - **Popularity is always Bandcamp's count, never `matchOwners`.** We scan around your twins, so local counts make your own neighbourhood look popular. A release with no Bandcamp count isn't a deep cut.
> - **No IUF or BM25:** both need the number of Bandcamp fans, which we don't know. A power law doesn't.
> - **Reason line:** "Only 4 owners on Bandcamp · 3 are your twins". With one twin: "… · one is your #3 twin".
> - **Tags, labels and early-adopter signals stay out of v1.** Tags re-rank only (§12). Earliness is a later boost, after a check that early buyers really predict twin overlap.
> - **Tuning** comes from an offline holdout eval (`tests/eval/`, on a local backup) with niche recall@k as the target metric, not plain recall.

## Proposed ROADMAP steps

```
## Deep cuts (not MVP)

**Goal:** a For you mode that surfaces releases few people own but your closest twins do, with an honest "only N owners" reason.

Design: decisions §18, research in docs/research/deep-cuts.md.

1. [ ] `scoring/deepCuts.ts` (taking the cap as an argument) and the constants and `nichePenalty` in `weights.ts`, plus the `deepCutMaxSupporters` setting (default 50, 5–1000), with the synthetic test set (niche beats staple, cap, shrink, no-count skip, ceiling safety).
2. [ ] `computeDeepCuts` in `background/recommend/`, with K = 100 twins and ceiling pruning; `pnpm perf` with a 100-twin board. Add the `items.supporterCount` index only if it's over budget.
3. [ ] `getForYou { mode }` on the message bus, and `ForYouRow.supporters` plus the best twin's rank.
4. [ ] For you tab: an `All / Deep cuts` switch (Fresh joins it when built), the cap in the popup's settings, the reason-line copy, and the empty state "No deep cuts yet: your twins' rare records show up as more of them are scanned".
5. [ ] Offline eval script (`tests/eval/`): temporal and random holdout, twins recomputed, recall@k, niche recall@k, ARP, median hit n, and the β / c / cap grid.
6. [ ] Tune the defaults from the eval on real data and record the numbers in decisions §18.
7. [ ] Later: early-adopter boost, tested first ("do early buyers overlap more with twins?").
8. [ ] Later: β adapted to how mainstream your own collection is.
```

---

## Appendix A: the orchestrator's brief (given to every sub-agent)

- **Platform.** MV3 extension, no backend. A polite scraper (1.5–3 s per request, a few thousand requests a day) fills a local IndexedDB. Scorers are pure TypeScript functions run in the service worker, and a re-score should stay well under ~200 ms.
- **Fans.** Found as supporters of releases: the 500 most recent buyers per release, each collection read up to its 2,000 newest items. A typical database holds 1k–20k fans and 10⁵–10⁷ ownership rows.
- **Ownership.** Rows `(fanId, itemKey, matchKey, source, addedAt)`; tracks fold into their album through `matchKey`.
- **fanMatches.** Per fan: sorted distinct release ids, and the newest purchase time for each.
- **matchOwners.** Local owner counts per release.
- **items.** Artist, selling account, `labelId` (on about half), `tags` (only for fetched release pages), and `supporterCount` (Bandcamp's global `also_collected_count + 1`, a snapshot taken at scan time).
- **releaseSupporters.** Supporter fanIds in recency order, each with a purchase time.
- **Twins.** The top 200: Σ w(i) over the shared releases / √(|M|·|F|), with a ×0.3 label-cluster factor and a time-faded "lately" score.
- **Signed-in extras.** Bandcamp's "N items in common" and each fan's `item_count`. `genre_id` is free but not stored.
- **Not available.** Audio features, play counts, ratings, release dates (without a page fetch), and any feedback besides *hide*.
- **Recommenders.**
  - *Also bought*: lift with a Wilson lower bound, omnivore damping and a twin boost.
  - *For you*: `Σ_twins s(F) × w(i)` over the top 30 twins.
  - *Fresh* is planned.
- **Constraints.** Local and pure. Sparse, partial data. A human reason line. Testable on a tiny synthetic set. O(edges) or less.

## Appendix B: sources

Verified means the orchestrator or a sub-agent read the cited passage.

- Zhou et al. 2010, *Solving the apparent diversity–accuracy dilemma of recommender systems*, PNAS. Eq. 6 and the λ endpoints were **verified by the orchestrator**: λ = 0 is HeatS, λ = 1 is ProbS, and the tuned λ is 0.23 on Netflix, 0.41 on RYM and 0.66 on Delicious. https://ar5iv.labs.arxiv.org/html/0808.2670
- Lü et al. 2012, *Recommender systems*, Physics Reports: AA, RA, ProbS and HeatS formulas. https://ar5iv.labs.arxiv.org/html/1202.1112
- RP³β: Christoffel et al., RecSys 2015, doi 10.1145/2792838.2800180; Paudel et al., TIIS 2017, doi 10.1145/2955101. The primary texts weren't readable; the default β = 0.6 was **verified by the orchestrator** in irspack: https://github.com/tohtsky/irspack/blob/main/src/irspack/recommenders/rp3.py
- Cooper et al. 2014, *Random walks in recommender systems*, WWW companion (P³): https://archives.iw3c2.org/www2014/proceedings/companion/p811.pdf (not readable)
- Ferrari Dacrema et al., *A Troubling Analysis of Reproducibility…* (P³α / RP³β as strong baselines): https://arxiv.org/abs/1911.07698
- Abdollahpouri et al. 2019, *Managing popularity bias… (xQuAD)*, with ARP, APLT and ACLT: https://arxiv.org/abs/1901.07555
- Abdollahpouri et al. 2020, popularity calibration: https://arxiv.org/abs/2007.12230
- Steck 2018, *Calibrated recommendations*, RecSys, as restated in da Silva & Jannach 2025: https://arxiv.org/html/2507.02643v1
- Breese, Heckerman & Kadie 1998 (IUF): https://arxiv.org/abs/1301.7363
- Vargas & Castells 2011 (novelty metrics), via RELISON: https://relison.readthedocs.io/en/latest/link/metrics/novelty.html
- Bauer & Schedl 2019, *Global and country-specific mainstreaminess*, PLOS ONE: https://doi.org/10.1371/journal.pone.0217389
- Spotify, *How Spotify discovers the genres of tomorrow* (pulse vs edge): https://artists.spotify.com/en/blog/how-spotify-discovers-the-genres-of-tomorrow
- Glenn McDonald on *Fans also like* (via Hypebot): https://www.hypebot.com/spotify-reveals-how-fans-also-like-works-the-second-most-important-piece-of-data
- Turnbull et al. 2008 (tag popularity bias): https://www.cs.swarthmore.edu/~turnbull/Papers/Turnbull_FiveTag_ISMIR08.pdf
- Kim et al. 2009 (CF vs. tag propagation): https://www.cs.swarthmore.edu/~turnbull/Papers/Kim_TagPropagate_ISMIR09.pdf
- Earliness patents (summary level only): https://patents.google.com/patent/US8930234 and https://patents.google.com/patent/US7885849
- Spotify "Found Them First": https://liveforlivemusic.com/news/spotify-launches-feature-that-tells-you-which-artists-you-discovered-first/
