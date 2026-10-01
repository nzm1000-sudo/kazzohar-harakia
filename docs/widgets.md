# Widgets — research and plan

All widgets read one compact snapshot the app computes on the device (`src/services/widgetSnapshot.mjs`), handed to
the native side by `src/services/nativeWidgets.mjs` (iOS: App Group `group.com.kzohaar.app` plus a shared keychain
item; Android: the app's SharedPreferences). Nothing is sent anywhere. The weather is the app's own last Open-Meteo
reading (`services/weather.mjs` cache), so the widgets never fetch anything.

## What the platforms allow (research summary)

**iOS (WidgetKit; the extension targets iOS 17)**
- Home screen: `systemSmall`, `systemMedium`, `systemLarge` (also `systemExtraLarge` on iPad). StandBy (iPhone on its
  side while charging) shows small widgets, which also stack in the Smart Stack.
- Lock screen (iOS 16+): `accessoryCircular`, `accessoryRectangular`, `accessoryInline`. These are drawn in the
  system's tint, so `Gauge`, `ProgressView` and plain text work best there.
- Taps: a small widget has a single tap target (`widgetURL`); medium and large can have several (`Link`).
- Interactive widgets (iOS 17+): `Button(intent:)` / `Toggle(intent:)` run an `AppIntent` without opening the app. The
  intent runs in the widget extension, so it writes shared storage and the timeline reloads afterwards. Lock-screen
  accessories may ask to unlock first.
- Live time with no updates: `Text(timerInterval:countsDown:)`, `Text(date, style: .timer/.relative)` and
  `ProgressView(timerInterval:)` tick by themselves. All other content changes only at timeline entries. The app
  provides entries ahead of time; the reload budget (about 40–70 a day) limits *reloads*, not entries.
- No network or location of its own is needed when the app supplies the data.

**Android (AppWidget + RemoteViews)**
- Sizes are set by cell targets (`targetCellWidth/Height`, Android 12+) and `minWidth/minHeight`. This app uses 2 × 2 and 4 × 2.
- RemoteViews allow only a fixed set of views: `FrameLayout`, `LinearLayout`, `RelativeLayout`, `GridLayout`,
  `TextView`, `ImageView`, `Button`, `ProgressBar`, `Chronometer`, `ListView` and a few others. There are no custom
  views, so custom drawings (the rings) are bitmaps.
- Each view can have its own `PendingIntent`, so one widget can have several doors. A button can send a broadcast
  without opening the app.
- `Chronometer` with `setChronometerCountDown` (API 24+, which is this app's minSdk) counts down by itself.
- `updatePeriodMillis` is at least 30 minutes, so exact changes come from one `AlarmManager` alarm at the next
  instant something changes.

**What Jewish apps commonly offer.** Zmanim lists with the next time highlighted; Shabbat candle lighting and
havdalah; the Hebrew date with the parasha; the Omer count; meat/dairy ("fleishig") timers; daily learning or a
quote; a yahrzeit reminder. Few of them combine the prayer of the hour with a deep link into the siddur, or start a
meat timer from the widget itself.

## Built

| Widget | iOS | Android | Tap |
|---|---|---|---|
| **זמנים ומזג אוויר** — the coming zmanim, the next one highlighted in gold (marked "מחר" for tomorrow); temperature, condition and high/low with the time of the reading; dimmed after 3 h, hidden after 12 h | medium, large | 4 × 2 | זמני היום |
| **התפילה הבאה** — the prayer of the hour (the Siddur's own rule, `choosePrayerType`); its next deadline (סוף זמן ק״ש → סוף זמן תפילה → חצות; שקיעה; חצות הלילה → עלות השחר) with a live countdown; when it properly begins (הנץ / מנחה גדולה / צאת הכוכבים); the medium size lists every deadline and the next prayer | small, medium, lock rectangular + inline | 2 × 2 (Chronometer) | that prayer in the Siddur |
| **רביעיית תפילות** — שחרית · מנחה · ערבית · ברכת המזון; the prayer of the hour framed in gold with "עד …", the others "מ־…" | medium (4 `Link`s) | 4 × 2 (4 PendingIntents) | each its own prayer |
| **אכלתי בשרי** — a 6 h (or 3 h, as chosen in the app) wait that ticks by itself, with a progress bar and "חלבי מ־…", then "אפשר חלבי"; the **אכלתי בשרי** button starts it from the widget | small, lock circular + rectangular; button iOS 17 | 2 × 2 (Chronometer; button → broadcast) | בשרי · חלבי card on Today |
| **דברי חכמים** — a saying of at most 100 letters every three hours, with its work and place; the snapshot carries 16 slots (two days) and then cycles | medium, large | 4 × 2 | בשבילי היום |
| **ספירת העומר** — the day in a ring of 49 with its words; outside the Omer, when it begins | small, lock circular + rectangular | 2 × 2 | the count in the Siddur |
| **שבת קודש** — the parasha, candle lighting and havdalah | small | — | פרשת השבוע |

The existing **כזוהר הרקיע · היום** widgets and the התבודדות Live Activity are unchanged, except that the medium
**היום** widget (the one with the tzaddik of the day) shows the **next three zmanim in sequence** in three equal columns —
the day's zmanim with Shabbat's candle lighting ("כניסת שבת") and havdalah ("צאת שבת", in place of that evening's צאת
הכוכבים) joined as zmanim (`upcomingZmanimAt` in `widgetSnapshot.mjs`, `upcoming(after:count:)` in Swift, `upcoming()` in
Java). Its ring, like every ring of the app, counts a full circle as 26 lights.

## Data flow

- `buildWidgetSnapshot` adds `prayers` (the windows for 8 days), `weather` (only what is shown), `sayings`
  (`{from, period, items}`) and `meat` (`{startedAt, hours, preferred, updatedAt}`). The native widgets apply the
  same rules as `prayerStateAt`, `quartetAt`, `weatherStateAt`, `sayingStateAt` and `meatStateAt`, which the tests pin.
- iOS timelines have an entry at every prayer boundary and deadline, saying slot, weather threshold and meat
  end/rest. Android uses one alarm (now delivered to `KZWidgetActionReceiver`) at the next such instant.
- **Meat sync.** The card (`MeatDairyTimer.jsx`) stamps every change (`recordMeatDairyChange`) and the widgets
  republish. The widget's button writes its own record (iOS `KZMeatStore`, App Group + keychain; Android
  SharedPreferences). Whichever record changed last wins everywhere. On start or return, the app adopts a newer widget
  record (`syncMeatFromWidget`), shows it on the card at once and schedules the same reminder. On iOS the button also
  sets that reminder itself, under the same notification id, if notifications are already allowed.
- **Deep links.** `kzohaar://open/prayer/<shacharit|mincha|maariv|birkat-hamazon|omer>` goes through the reminder's
  validated path (`parseDeepLink`, then NewApp, then the Siddur's auto-open). Outside the Smart Siddur, ברכת המזון opens
  by its concept, as the day card does. Other new routes: `sayings`, `meat`, `weather`, `shabbat`.

## Limits

- The interactive button needs iOS 17 (the extension's minimum). Older systems do not show these widgets.
- Lock-screen widgets are not interactive in practice; a tap opens the app.
- On Android, a wait started from the widget gets its end-of-wait reminder only when the app is next opened.
- The weather is only as fresh as the app's last visit to Today.

## Ideas for later

- A יארצייט/אזכרה הקרובה widget from the memorial store (needs the store in the snapshot).
- A large המעגל הרוחני ring with the week's lights.
- A configurable zmanim widget (`AppIntentConfiguration`: choose which zmanim).
- A Live Activity for the meat wait.
