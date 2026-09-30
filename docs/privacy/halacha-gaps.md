# Halacha search-gap signals — what is counted (local only)

Status: **counted on the device only. Nothing is sent anywhere.** Remote analytics are not enabled.

## What is stored (localStorage `kz-halacha-gaps-v1`, per day, kept 60 days)
| Counter | Meaning |
|---|---|
| `answered` | a search whose first result was a verified answer |
| `weak` + `weakByCategory.<category id>` | only loosely related answers; the category of the top result (e.g. `shabbat`) |
| `sourcesOnly` | no verified answer, only source sections |
| `noMatch` | nothing found |
| `reformulated` | a new search within 45 seconds of a weak one |
| `rabbiRoutes.<flow>/<branch>` | a guided flow ended in "no verified answer — ask a rabbi" (e.g. `shabbat-heating/dry-raw`) |
| `sensitive` | a sensitive search happened (no category, no text) |

## What is never stored
- The text of any search or conversation message.
- Anything identifying the user or device.
- For sensitive topics: nothing beyond the single `sensitive` count.

## Before any remote collection (not enabled)
Only the table above, aggregated per day, would be eligible — and only after explicit user opt-in in settings, with the
exact payload shown to the user. Raw questions would still never leave the device.
