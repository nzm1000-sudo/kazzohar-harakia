# Practical Halacha Q&A Audit

## Scope

This audit covers the offline practical Halacha question layer, its local search path, and its links to the bundled Yalkut Yosef corpus. The publication target is 500 verified answers. The current release contains 20 verified answers and does not claim that the target has been met.

## Corpus Inventory

- 20 published practical answers with concise Hebrew answers.
- 190 legacy question records used for source discovery. These are not presented as verified answers.
- 14,305 local Yalkut Yosef sections across 87 parts.
- Primary authority for the published set: Rabbi Yitzhak Yosef, with the bundled 2007 abridged Yalkut Yosef edition as the exact local source.

## Publication Rules

A record reaches production search only when all three fields are present:

- `quality: verified`
- `reviewStatus: verified`
- `answerStatus: published`

Every published record must also have a nonempty short answer of no more than 240 characters, at least three query aliases, and at least one exact source ID that resolves inside the bundled Yalkut Yosef data. Records marked `needs-review` are excluded from publication.

## Coverage

The initial verified set covers common questions in blessings, prayer, Shabbat, women, holidays, family practice, and technology. It includes rice and banana blessings, prayer omissions, reheating and plata use, refrigerator use, bathing and medicine on Shabbat, women's Kiddush, drinking before prayer, Sefirat HaOmer, candle lighting, interruption after a blessing, borer, muktzeh, Kaddish, and Tefillin time.

The set is intentionally narrow. Kashrut, family purity, monetary law, medical edge cases, and many festival details require further editorial review before publication.

## Duplicate Audit

The 190 legacy canonical questions contain no exact duplicates after Hebrew-aware normalization. The 20 published canonical questions are also unique. JavaScript ASCII `\\W` matching is not used for this check because it does not preserve Hebrew letters.

## Source Audit

All 20 published records were checked automatically against the bundled Yalkut Yosef section IDs. No published source link is missing. Citations retain a human-readable siman and se'if label in addition to the stable local ID.

The automated gate verifies identity and availability, not the correctness of a newly composed ruling. New answers must still receive human halachic/editorial review before their statuses can be changed to published and verified.

## Search Audit

Twenty required everyday queries are tested offline. Each must return a verified answer first, include a concise answer, and link only to a bundled source. Existing relevance tests continue to cover legacy source-discovery questions and ambiguity between nearby topics.

## Manual Sample Audit

Because only 20 records are currently published, all 20 were audited rather than claiming a 50-record sample. The automated checks cover completeness, answer length, aliases, duplicate canonical questions, related IDs, local source resolution, publication status, and first-result behavior for the required queries.

A 50-question editorial sample is blocked until at least 50 independently reviewed answers exist.

## Offline Behavior

Practical question search, answer display, and Yalkut Yosef source resolution use imported local modules only. They do not call a model or network endpoint. Tests execute with Node's local module loader and require every returned practical source to exist in the bundled corpus.

## Open Risks

- The verified count is 20, below the required target of 500.
- Automated extraction from source prose cannot safely establish 500 verified practical rulings.
- The bundled Yalkut Yosef license is noncommercial share-alike and must remain visible in distribution documentation.
- Sensitive and fact-dependent cases still require a competent rabbi; the app must not imply personal adjudication.

## Expansion Gate

To reach 500, editors should review candidates in topic batches, compare each short answer against the cited local passage, record conditions and divergent cases, test aliases, and only then set all three publication statuses. A batch fails if any source is approximate, any answer overstates the source, or any material condition is omitted.