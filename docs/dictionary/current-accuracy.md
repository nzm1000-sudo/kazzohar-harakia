# The Aramaic engine — current accuracy (pass 2)

Two **independent stratified random samples** of the tokens the lookup glosses, drawn by `scripts/aramaic/audit-coverage.mjs --fresh <seed>` (a fixed-seed reservoir over every glossed Aramaic token of each corpus — token-weighted, so a frequent form is drawn as often as it is read), judged item by item by the reviewer against the source sense and the context, and totalled by `scripts/aramaic/accuracy-report.mjs`. Neither reuses the 890 items of pass 1.

Strata (1,300 items each): Bavli 400 · Zohar + Tikkunei 300 (Zohar 200, Zohar Chadash 50, Tikkunei 50) · Onkelos 200 · Yerushalmi 150 · Biblical Aramaic 100 · Siddur/Midrash/mixed 150 (liturgy 50, Midrash 50, Rashi/Tosafot 25, other commentaries 25).

Judging: correct when the bubble gives the meaning the word has *there* (a two-reading bubble "א · ב" counts when one reading fits; a verb glossed in its dictionary form counts; a conjugated rendering in the wrong person, a garbled rendering, or a gloss on a Hebrew word or a name counts as wrong). Every item — surface form, reference, resolved lemma, display gloss, resolution path, source, judgment, reason — is in the per-item tables:
- `docs/dictionary/accuracy-fresh-1.tsv` (seed 71003, the engine as committed in c155362) and `accuracy-judgments-1.json`
- `docs/dictionary/accuracy-fresh-2.tsv` (seed 90127, the engine after the pass-2 fixes) and `accuracy-judgments-2.json`

## 1. Before the fixes — seed 71003, the engine of c155362

| STRATUM | SAMPLE | CORRECT | ACCURACY |
|---|---:|---:|---:|
| Bavli | 400 | 376 | 94.0% |
| Zohar + Tikkunei | 300 | 281 | 93.7% |
| Onkelos/Targum | 200 | 174 | 87.0% |
| Yerushalmi | 150 | 142 | 94.7% |
| Biblical Aramaic | 100 | 86 | 86.0% |
| Siddur/Midrash/mixed | 150 | 135 | 90.0% |
| **Total** | **1300** | **1194** | **91.8%** |

**Target ≥ 98%: FAIL (91.8%).** (Pass 1 had reported 93.5% on its own 890 items; that sample had been drawn before the pass-1 corrections and was judged by the same reviewer who then corrected its errors — this one is independent.)

Where the errors were (the same sample by the class of its analysis, joined with the build trace; counted before two late re-judgments, so ±1):

| CLASS OF ANALYSIS | WRONG / SAMPLED |
|---|---:|
| Jastrow's Targum-verse equivalents "(h. X)" used as glosses | 15 / 17 (88%) |
| unreviewed analyses of forms used < 10 times in their corpus | 28 / 81 (35%) |
| … 10–49 times | 36 / 171 (21%) |
| … 50–199 times | 22 / 184 (12%) |
| … 200–999 times | 11 / 334 (3.3%) |
| … 1,000+ times | 7 / 527 (1.3%) |
| reviewed forms (pass-1 review) | 12 / 476 (2.5%) |

| CORPUS | FORM | SHOWN | ×  | PATH | SOURCE | WHY WRONG |
|---|---|---|---:|---|---|---|
| bavli | מוליד | לידה | 1 | form | krupnik-1927:def | Hebrew participle 'begets' read as the noun 'birth' |
| bavli | אי | אם | 1 | form | krupnik-1927:def-en | Hebrew negation 'אי אתה' glossed 'אם' |
| bavli | דאתאי | שבאתי | 1 | form:pe.perf.1s+d | krupnik-1927:def | 3fs 'that came (was brought)', rendered 1s |
| bavli | ליעבד | ייעשה | 1 | form:itpe.impf.3ms | reviewed:reviewed | active jussive 'let him do', rendered passive |
| bavli | דאמור | שאומר | 1 | reviewed-form | reviewed | 'that (the Rabbis) said', rendered present singular |
| bavli | לבר | מחוץ | 1 | reviewed-form | reviewed | name (בר פדא), not 'outside' |
| bavli | טובא | טוב | 1 | form | jastrow-1903:same | here the adverb 'much, very' — the homograph of 'good' |
| bavli | שרשורא | חבל | 1 | form | krupnik-1927:def | 'chain', not 'rope' |
| bavli | יהב | יהב | 1 | form | jastrow-1903:targum-h | identity gloss says nothing to a Hebrew reader ('נתן') |
| bavli | מיחזי | מראה | 1 | form | krupnik-1927:def | 'appears (as)', not 'shows' |
| bavli | ירקא | ירק | 1 | form | jastrow-1903:same | verb 'turned pale' (ירקא אפיה), not 'vegetable' |
| bavli | מדרבנן | מתקנת חכמים | 1 | form+m | krupnik-1927:def | 'one of the Rabbis' (ההוא מדרבנן) |
| bavli | תנא | שנה | 2 | form | reviewed:reviewed | the noun 'Tanna' glossed as the verb |
| bavli | היינו | זהו | 1 | form | krupnik-1927:def | Hebrew 'we were' (נוהגין היינו) |
| bavli | בשמא | בשם | 1 | reviewed-form | reviewed | 'in (a case of) doubt' (שמא), not 'in the name' |
| bavli | רווחא | הנחה והקלה | 1 | form | krupnik-1927:def | 'space, gap' here |
| bavli | וניחא | ורך | 1 | form+w | krupnik-1927:def | 'and it is convenient', not 'soft' |
| bavli | דכל | של כל | 1 | reviewed-form | reviewed | relative 'that all', not 'of all' |
| bavli | דמי | דומה | 1 | reviewed-form | reviewed | 'the money of' (דמי יין נסך) |
| bavli | דרבן | פתח | 1 | form | krupnik-1927:def | 'of Rabban' (title) read as 'goad' |
| bavli | מחסיא | חמלה | 1 | form:n.pl | krupnik-1927:def | personal name (מחסיא בר אידי) |
| bavli | צעריה | חרפה שלו | 1 | form:n.pl+3ms | krupnik-1927:def | 'pained him' (verb), not 'his disgrace' |
| bavli | מיכוין | מתכוונים | 1 | reviewed-form | reviewed | singular 'intends', rendered plural |
| yerushalmi | לקדמך | ללפניך | 1 | form+l | grammar:pronominal | 'to meet you' |
| yerushalmi | מיניין | מאין, מהיכן | 1 | form | krupnik-1927:def | Hebrew 'count' (מניין) |
| yerushalmi | יתנון | יהב | 1 | form:pe.impf.3mp | jastrow-1903:targum-h | gloss is the Aramaic lemma itself ('they will give') |
| yerushalmi | סבא | שתה לשכרה | 1 | form | krupnik-1927:def | 'old man', not 'drank' |
| yerushalmi | שיני | שונה | 2 | reviewed-form | reviewed | Hebrew 'second' (שני) |
| yerushalmi | חבריא | אחבירה | 1 | form:n.pl | jastrow-1903:targum-h | garbled; 'the colleagues' |
| yerushalmi | הוינא | תבונה | 1 | form | krupnik-1927:def | 'I was' |
| zohar | אתערו | התעוררות | 1 | form:n.sg | krupnik-1927:def | verb 'they discussed/aroused', not the noun |
| zohar | ניעול | יבוא | 1 | form:pe.impf.3ms | krupnik-1927:def | 1pl 'let us enter', rendered 3ms |
| zohar | אתכלילו | נכנס לחופה | 1 | form:itpa.perf.3mp | krupnik-1927:def | 'were included' |
| zohar | דא | גערת הגַמָל | 1 | phrase | krupnik-1927 | a wrong phrase match (דא בלא דא) |
| zohar | ואחיד | ומיוחד | 1 | form+w | jastrow-1903:eq | 'and holds', not 'unique' |
| zohar | סמיך | עזרה | 1 | form | krupnik-1927:def | 'rests (upon)', not 'help' |
| zohar | תליא | יתד, תלי | 1 | form | krupnik-1927:def | 'depends', not 'peg' |
| zohar | לחרבא | לחרב | 1 | form+l | krupnik-1927:def | infinitive 'to destroy', not 'to the sword' |
| zohar | דאתמשכן | שנלקח לעבוט | 1 | form:itpa.perf.3ms+d | krupnik-1927:def | 'that are drawn' (משך), not 'pledged' |
| zohar | זכאה | צדיק | 1 | form | krupnik-1927:def | 'fortunate' (זכאה חולקהון) |
| zohar | זכאין | צדיקים | 1 | reviewed-form | reviewed | the Zohar's זכאין אינון is 'fortunate are' (found on re-review in pass 2) |
| zohar | לקמי | ללפני | 1 | form+l | krupnik-1927:def | 'before' (the ל belongs to the word) |
| zohar | עתיק | האתנים | 1 | form | jastrow-1903:targum-h | 'Ancient (of Days)' |
| zohar | אחידן | חידה | 1 | form:n.pl | jastrow-1903:targum-h | 'are attached', not 'riddle' |
| zohar | משיך | עור | 1 | form | krupnik-1927:def | 'draws', not 'skin' |
| zohar | הוו | הווים | 1 | form:pe.ptcp.mp | reviewed:reviewed | 'were' (past), not a participle |
| tikkunei-zohar | בידיה | עלילת שוא שלו | 1 | form:n.pl+3ms | krupnik-1927:def | 'in his hand' |
| tikkunei-zohar | דאתפשט | שנתישר | 1 | form:itpe.perf.3ms+d | krupnik-1927:def | 'that he stripped off' |
| zohar-chadash | דזכינא | שנקה | 1 | form:pe.ptcp.1s+d | jastrow-1903:targum-h | 'that I merited' |
| onkelos | לה | לה | 2 | reviewed-form | reviewed | Onkelos לֵהּ is masculine 'to him' (לו) |
| onkelos | לחברה | לאחבירה | 1 | form+l | jastrow-1903:targum-h | garbled rendering of 'to his fellow' |
| onkelos | ולדא | ולזו | 1 | form+wl | jastrow-1903:eq | 'offspring (of your cattle)', not ו+ל+דא |
| onkelos | דארזא | קשה | 1 | form | krupnik-1927:def | 'of cedar' |
| onkelos | דדהב | שזהב | 1 | form+d | krupnik-1927:def | 'of gold' (של זהב), ד before a noun |
| onkelos | ושתא | ושנה | 1 | form+w | jastrow-1903:eq | 'and six' |
| onkelos | ובת | ובת בליעל | 2 | form+w | jastrow-1903:targum-h | 'and the daughter / and the (bird) bat' — not 'wicked daughter' |
| onkelos | ונפק | וכיוצא בו | 1 | form+w | jastrow-1903:eq | 'and went out' |
| onkelos | ליעקב | ירדוף · קיפח ועקר, ביטל | 1 | form:pe.impf.3ms | krupnik-1927:def | the name Jacob with ל |
| onkelos | הוו | הווים | 1 | form:pe.ptcp.mp | reviewed:reviewed | 'were' (past) |
| onkelos | תנינא | שנינו | 1 | reviewed-form | reviewed | 'second' (month) |
| onkelos | למברא | לעבָרה על פני נהר | 1 | form+l | krupnik-1927:def | 'outside' (לברא) |
| onkelos | רבותא | חדוש, דבר פלא | 2 | form | krupnik-1927:def | 'greatness; anointing (oil)', not 'novelty' |
| onkelos | קבלתון | חשיכה | 1 | form:pe.perf.2mp | krupnik-1927:def | 'you accepted/obeyed' |
| onkelos | גלי | ביד רמה | 1 | form | jastrow-1903:targum-h | 'revealed' (before me) |
| onkelos | חמיר | חמור | 1 | form | jastrow-1903:eq | 'leaven' |
| onkelos | ומן | ומאין | 1 | form+w | jastrow-1903:eq | 'and from' |
| onkelos | מלן | מלנו | 1 | form+m | grammar:pronominal | 'full' (מליין) |
| onkelos | מועדיא | מוזהר ומותרה | 1 | form:n.pl | krupnik-1927:def | 'the festivals' |
| onkelos | תקפתא | חיזק | 1 | form:pa.perf.2ms | krupnik-1927:def | 'mighty' (hand), adjective |
| onkelos | לדריכון | דרך ופסע · התהלך | 1 | form:pe.impf.3mp | krupnik-1927:def | 'for your generations' |
| onkelos | יהוין | יהיה | 1 | form:pe.impf.3fp | reviewed:reviewed | 3fp 'they shall be', rendered 3ms |
| onkelos | דרתא | דירה | 1 | form | krupnik-1927:def | 'the court(yard)' |
| biblical-aramaic | פרשגן | מדרש | 2 | form | jastrow-1903:targum-h | 'copy (of a letter)' |
| biblical-aramaic | ברא | ברא | 2 | form | krupnik-1927:def | 'of the field' — the identity reads as 'created' |
| biblical-aramaic | גבא | גב, הצד העליון · אצל, אל | 1 | form | krupnik-1927:def | 'the den (pit)' |
| biblical-aramaic | בה | בה | 1 | reviewed-form | reviewed | pointed בֵּהּ is 'in him' (found on re-review in pass 2) |
| biblical-aramaic | נהרה | האיר · נזכר | 1 | form | krupnik-1927:def | 'the River' (עבר נהרה) |
| biblical-aramaic | דירין | רפת | 1 | form:n.pl | krupnik-1927:def | 'dwelling' (participle) |
| biblical-aramaic | ומן | ומאין | 1 | form+w | jastrow-1903:eq | 'and from' |
| biblical-aramaic | ודי | וזה | 1 | form+w | jastrow-1903:targum-h | 'and whereas / and that' |
| biblical-aramaic | ומני | ומינה | 1 | reviewed-form | reviewed | 'and by me' |
| biblical-aramaic | ספר | שפת הים | 1 | form | krupnik-1927:def | 'scribe' |
| biblical-aramaic | כספא | הכלם | 1 | form | jastrow-1903:targum-h | 'the silver' |
| biblical-aramaic | רבה | לקח רבית · הכניס בכלל | 1 | form | krupnik-1927:def | 'grew' |
| midrash | זיל | היה בזול | 1 | form | krupnik-1927:def | 'go!' |
| midrash | וסליק | והס | 1 | form:pe.ptcp.ms+w | jastrow-1903:targum-h | garbled; 'and went up' |
| midrash | באדין | באזי · בז | 1 | form+b | jastrow-1903:eq | 'then' |
| midrash | סבא | שתה לשכרה | 1 | form | krupnik-1927:def | 'the elder' |
| liturgy | אנא | אני | 5 | form | grammar:pronominal | Hebrew אָנָּא 'please' (אנא הושיעה נא) |
| liturgy | בכן | מכאן ואילך | 1 | form | jastrow-1903:eq | Hebrew 'then/so' in a piyyut |
| liturgy | לאישון | לזמן ומועד | 1 | form+l | krupnik-1927:def | Hebrew 'the pupil (of the eye)' |
| liturgy | מירון | בגליל | 1 | form | krupnik-1927:def | place name; the gloss is a fact, not a meaning |
| liturgy | תכלא | תכלת | 1 | form | krupnik-1927:def | Hebrew 'withhold' (לא תכלא) |
| liturgy | דודה | בֶּן דָּוִד כנוי למשיח | 1 | form | krupnik-1927:def | Hebrew 'her beloved' |
| other-commentary | ומלייא | ומלאן | 1 | form+wm | krupnik-1927:def | garbled; 'and fill' |

## 2. The fixes (all deterministic; no new gloss written)

1. **Jastrow's Targum-verse equivalents are no longer glosses** (`scripts/dictionary/aramaic/lexicon.mjs`): 88% wrong.
2. **The review gate** (`build-aramaic-engine.mjs`, `REVIEW_GATE_MIN = 200`): an unreviewed analysis of a form used fewer than 200 times in its corpus is not published — it becomes a REVIEW candidate in `docs/dictionary/review/*-top-unresolved.tsv`. The reviewed paradigms (irregular verbs, pronominal table, a proclitic on a reviewed form) need 20 uses. Exceptions, each a deterministic check:
   - **Onkelos:** a candidate is published when the Hebrew verse Onkelos translates has the gloss word (or its root letters) in at least half of the form's verses and in two at least.
   - **Daniel/Ezra and the liturgy:** a candidate is published when Onkelos (for Daniel/Ezra) or the Targum, the Bavli or the Zohar (for the liturgy) publishes the very same analysis.
3. **Classifier v5:** the divine name יי is a name everywhere; in Onkelos a Tanakh name form is a name where the verse it translates has that name (דמצרים ↔ מצרים, but למיכל "to eat" is not ל + מיכל); in Daniel/Ezra a bare Tanakh name (or a prefix on a long one). The coverage denominators of Onkelos, Daniel/Ezra and the liturgy lost their names (Onkelos 79,535 → 76,881 Aramaic tokens).
4. **Morphology:**
   - the assimilated reflexive base (איבעי) no longer generates imperfects that are the simple stem's own forms (ליעבד is "let him do");
   - נ־ in the imperfect is the first person plural outside the Babylonian profiles (ניעול in the Zohar is "let us enter");
   - הוו is the perfect "they were";
   - two readings of one lemma that nothing tells apart (אתאי "I came" / "she came") → unresolved;
   - ד before a word of unknown part of speech → unresolved, unless it is an emphatic noun (דימינא);
   - the progressive קא and ל + infinitive now license generated analyses (קתני, קסבר, לאחזאה);
   - a proclitic on a reviewed form is rendered by the grammar (בההוא, דפליגי, מדכתיב), with three guards: ו always; ד only on a verb form; ב ל כ מ only on a noun or particle;
   - no ב ל כ מ on a possessive "של…" (לדידהו);
   - the Hebrew article drops after ב ל כ (לעם).
5. **Vowel signs** (`engine.mjs`, runtime):
   - אָנָּא is the Hebrew "please";
   - a final ־ֵהּ is "his" (לֵהּ → לו, בֵּהּ → בו);
   - a final ־ַהּ/־ָהּ is never shown as "his";
   - הֲוָא is "was".
6. **Review data:**
   - wrong pass-1 reviewed glosses were removed or narrowed to their profiles;
   - wrong forms, phrases and senses the samples exposed were excluded (EXCLUDED_FORMS, EXCLUDED_IN_PROFILES, EXCLUDED_PHRASES);
   - Hebrew contexts: "אי אתה/אפשר", "בן תימא" and "אמרי פי" are not glossed.

## 3. After the fixes — seed 90127, the engine after steps 1–6 (before the corrections listed under it)

| STRATUM | SAMPLE | CORRECT | ACCURACY |
|---|---:|---:|---:|
| Bavli | 400 | 390 | 97.5% |
| Zohar + Tikkunei | 300 | 293 | 97.7% |
| Onkelos/Targum | 200 | 195 | 97.5% |
| Yerushalmi | 150 | 146 | 97.3% |
| Biblical Aramaic | 100 | 91 | 91.0% |
| Siddur/Midrash/mixed | 150 | 143 | 95.3% |
| **Total** | **1300** | **1258** | **96.8%** |

**Target ≥ 98%: NOT MET (96.8%).** Bavli, Zohar + Tikkunei, Onkelos and Yerushalmi are each at 97.3–97.7%. Two strata are lower:
- **Biblical Aramaic (91%):** the vowel-sign cases and Daniel's names.
- **Siddur/Midrash/mixed (95.3%).**

| CORPUS | FORM | SHOWN | ×  | PATH | SOURCE | WHY WRONG |
|---|---|---|---:|---|---|---|
| bavli | זיל | היה בזול | 2 | form | krupnik-1927:def | imperative 'go!' — Krupnik's homograph 'was cheap' |
| bavli | הדרן | חזרנו | 1 | reviewed-form | reviewed | 'go around' (participle plural), not 'we returned' |
| bavli | דכולי | של כל | 1 | reviewed-form | reviewed | 'that everyone' (דכולי עלמא) |
| bavli | לדידהו | לשלהם | 1 | form+l | grammar:pronominal | 'to them themselves' — garbled rendering |
| bavli | תנא | שנה | 1 | form | reviewed:reviewed | the noun 'the Tanna' (מאי תנא דקתני) |
| bavli | אטו | וכי | 1 | reviewed-form | reviewed | 'on account of' (גזרה יו״ט אטו שבת) |
| bavli | דמי | דומה | 1 | reviewed-form | reviewed | 'the price of' (דמי צמרו) |
| bavli | דההיא | של אותה | 1 | reviewed-form | reviewed | relative 'that at that (hour)' |
| bavli | דמר | של מר | 1 | reviewed-form | reviewed | relative 'that (one) master holds' (דמר סבר) |
| yerushalmi | הוינן | אנו הווים | 2 | form:pe.ptcp.1pl | reviewed:reviewed | 'we used to (find)' — past habitual |
| yerushalmi | דמיא | דומה | 1 | reviewed-form | reviewed | 'of water' (קולתה דמיא) |
| yerushalmi | תימא | תאמר | 1 | form:pe.impf.2ms | jastrow-1903:same | the name בן תימא |
| zohar | דלעילא | של לחמור צעיר | 3 | form+dl | krupnik-1927:def | 'of above' — split as ד+ל+עילא 'young ass' |
| zohar | אתכליל | נכנס לחופה | 1 | form:itpa.perf.3ms | krupnik-1927:def | 'was included' |
| zohar | לכלא | נגמר | 1 | form:pe.impf.3ms | krupnik-1927:def | 'for all' (ל + כלא) |
| zohar | לאינון | להם | 1 | form+l | grammar:pronominal | demonstrative 'those' (לאינון מאנין) |
| zohar-chadash | דעביד | של עשוי, נהוג | 1 | form+d | krupnik-1927:def | 'that makes (the paths)' |
| onkelos | זמנא | פעם | 2 | reviewed-form | reviewed | '(tent of) meeting' (משכן זמנא) |
| onkelos | לעמא | להעם | 1 | form+l | reviewed:reviewed-base | garbled rendering of 'for the people' |
| onkelos | עבדא | העבד | 1 | reviewed-form | reviewed | 'producing (milk and honey)', participle |
| onkelos | עמה | עמו | 1 | reviewed-form | reviewed | pointed עִמַּהּ is 'with her' |
| biblical-aramaic | ביתה | באותה | 2 | form+b | grammar:pronominal | 'his house' (בַיְתֵהּ), split as ב + יתה |
| biblical-aramaic | אלה | אלוה | 1 | form | jastrow-1903:eq | 'these' (Jer 10:11 אֵלֶּה) |
| biblical-aramaic | בה | בה | 3 | reviewed-form | reviewed | pointed בֵהּ is 'in it (masc.)' — the tree |
| biblical-aramaic | הוא | הוא | 1 | reviewed-form | reviewed | pointed הֲוָא 'was' |
| biblical-aramaic | מן | תיכף ומיד | 1 | phrase | krupnik-1927 | 'from (the hand of)' — a wrong phrase |
| biblical-aramaic | לבר | לחוץ | 1 | reviewed-form | reviewed | 'like a son of (gods)' (לְבַר אֱלָהִין) |
| midrash | דהתם | של שם | 1 | reviewed-form | reviewed | relative 'that there' |
| midrash | עייל | טיפל, עסק | 1 | form:pe.ptcp.ms | krupnik-1927:def | 'went in' |
| liturgy | אמרי | אומרים | 1 | form:pe.ptcp.mp | jastrow-1903:same | Hebrew 'the words of (my mouth)' |
| talmud-commentary | דהתם | של שם | 1 | reviewed-form | reviewed | relative 'that there' |
| talmud-commentary | דדרשינן | שהורה בצבור | 1 | form:pe.ptcp.1pl+d | krupnik-1927:def | 'that we expound' |
| other-commentary | דדוקא | של מין חולי בעין · של מוץ | 1 | form+d | krupnik-1927:def | 'that only' (דווקא) |
| other-commentary | טובא | טוב | 1 | form | jastrow-1903:same | 'much, far' |

Every error of this sample was then corrected: the form, sense or phrase was excluded in that profile, or a pointing/grammar rule was added. These corrections are in the shipped build, but **they are not re-measured**: a third independent sample is needed before any claim above 96.8%. The known remaining risk is the pass-1 reviewed glosses (2.5% wrong in sample 1). They are agent-reviewed, not human-reviewed; see `docs/dictionary/review/`.
