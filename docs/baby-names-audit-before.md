# Baby Names Audit Before Cleanup

Date: 2026-09-21

## Counts

| Measure | Count |
| --- | ---: |
| Raw group entries | 532 |
| Exact unique spellings | 416 |
| Exact duplicate entries | 116 |
| Published records | 416 |
| Existing review records | 61 |
| Exported records | 477 |
| Published boys | 123 |
| Published girls | 118 |
| Published unisex | 175 |
| Normalized spelling collisions beyond exact duplicates | 0 |
| Empty meanings | 0 syntactically; most are generic group boilerplate |
| Missing nested source metadata | 0 |
| Conflicting labels after first-seen deduplication | 0; raw groups contain cross-category repetitions |

## Findings

- The source uses localized labels (`בנים`, `בנות`, `לשניהם`) instead of the required canonical enum (`male`, `female`, `unisex`).
- Duplicate raw entries are silently dropped by first-seen order, so source provenance and gender conflicts are not retained.
- `relatedSpellings` is empty for every record and search only matches exact normalized names.
- Gematria is runtime-only and is not stored as an auditable field.
- Review records use a generic meaning and generic Hebrew Academy source regardless of the actual review reason.
- The current meaning field is usually a broad group description, not a short, name-specific linguistic explanation.
- Existing source metadata identifies broad source buckets but does not use normalized source types or consistently provide canonical Tanakh references.
- Favorite loading accepts only current published IDs and has no migration map.
- Existing filtered non-target examples include `ניק`, `אן`, and `שון`; they are absent from the exported records but are not represented in a review/rejection ledger.

## Existing Review Inventory

`אדירון`, `אחוזה`, `אלמוגית`, `ארזית`, `אשירה`, `באר`, `ברקת`, `גאיה`, `גולדה`, `גיתאי`, `דביר`, `דולביה`, `הוד`, `הראל`, `זיו`, `זיווה`, `חמד`, `חמדת`, `טנא`, `יובב`, `יועדיה`, `יובלית`, `יחד`, `ינאי`, `כרמלית`, `לוטן`, `מגדים`, `מישר`, `נבו`, `נביעה`, `נוגית`, `נריה`, `סלעית`, `עוזיה`, `עיינה`, `פלגית`, `רביבית`, `שוהם`, `שלהב`, `תקומה`, `תשבי`, `אורח`, `חופית`, `יערה`, `כחל`, `מכבים`, `עופר`, `שיזף`, `תירוש`, `כרמליה`, `אביטל`, `ארבלית`, `הדריה`, `זמר`, `חניתה`, `מאורית`, `שירז`, `תניא`, `תקווה`, `אדרת`, `מור`.

This file records the pre-cleanup state. The cleanup will retain the original source history and add an explicit rejection/review ledger rather than silently deleting records.
