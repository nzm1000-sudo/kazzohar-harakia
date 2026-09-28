# Stage 5 brief — enrich the learning tracks (מסלולי לימוד)

Goal: every learning track in `src/data/halachaTracks.mjs` grows by AT LEAST 22 items, none repeating another item of
that track or the same ruling. The user asked for many more practical Q&A people actually ask, on each track's topic.

Rules (the app's standing rules — non-negotiable):
- Answers come ONLY from the bundled Yalkut Yosef corpus, exactly per `scripts/halacha/PROTOCOL.md` (verbatim excerpt,
  faithful short answer that adds nothing). Never fabricate halacha; a gap is better than a stretched answer.
- Web Q&A sites are LEADS ONLY for which questions people ask and how they phrase them — never copy answer text. Use:
  dinonline.org (דין), halachayomit.co.il (הלכה יומית), hidabroot.org (הידברות), "קו ההלכה" of Rav Yaron Ashkenazi,
  https://hl5047.co.il/questions, yeshiva.org.il. Put 0–2 real URLs you opened into "askedOn".
- Load the corpus with node: `const { YALKUT_YOSEF } = await import('/Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia/src/data/yalkutYosef.mjs')`
  (sections: { id, part, section, halachaIndex, text }). Search it by keywords.
- Existing published entries: `const { PRACTICAL_HALACHA_QA } = await import('.../src/data/practicalHalachaQa.mjs')`
  (fields id, question, shortAnswer, topic, category, answerStatus). Many relevant ones exist but are not in the track yet.

Deliverables per track `<track>` (ids from halachaTracks.mjs):
1. `scripts/halacha/out-T-<track>.json` — NEW entries (JSON array, PROTOCOL shape; ids `hal-trk-<track>-<slug>`),
   at least 14 per track, each a distinct practical question not already answered by an existing entry.
2. `scripts/halacha/tracks-<track>.json` — `{ "add": ["id", ...] }`: the ordered ids to APPEND to the track — your new
   entry ids that pass verification plus existing published entries that belong on this track and are not in it yet.
   At least 22 ids, in a sensible learning order, no id already in the track, no duplicates of the same ruling.

Verify: `cd /Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia/scripts/halacha && HALACHA_STAGE=tracks node verify.mjs --skip-urls`
then read `rejected-tracks.json` for your ids and fix or drop them (other agents' files are verified in the same run —
ignore their results; rerun until yours pass). Only ids that are accepted (in accepted-tracks.json) or already published
may appear in tracks-<track>.json.

Do NOT edit any other file (not halachaTracks.mjs, not the app). No git commands that change anything.
Reply with: per track — new entries accepted, existing ids added, total added, and doubts.
