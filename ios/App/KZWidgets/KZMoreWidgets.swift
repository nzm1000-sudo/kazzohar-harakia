import AppIntents
import SwiftUI
import UserNotifications
import WidgetKit

// The second set of widgets, all from the same on-device snapshot (KZSharedStore) the app writes
// (src/services/widgetSnapshot.mjs), each with a timeline entry at every instant it changes — so they stay right for
// days without the app being opened:
//   זמנים ומזג אוויר   medium, large      the coming zmanim (the next one in gold) and the app's last weather reading
//   התפילה הבאה        small, medium, lock screen   the prayer of the hour, its deadline and a live countdown; a tap
//                                          opens that prayer in the Siddur
//   רביעיית תפילות     medium             שחרית · מנחה · ערבית · ברכת המזון, each its own door into the Siddur
//   אכלתי בשרי         small, lock screen  the meat → dairy wait ticking by itself; the button starts it from the widget
//   דברי חכמים         medium, large      a saying every three hours, with its source; a tap opens בשבילי היום
//   ספירת העומר        small, lock screen  the day of the Omer; a tap opens the count in the Siddur
//   שבת קודש           small              the parasha, candle lighting and havdalah
// Nothing here touches the network: the weather is the reading the app itself made, with the time it was made.

// MARK: - Timeline

struct KZMoreEntry: TimelineEntry {
    let date: Date
    let snapshot: KZSnapshot?
    let meat: KZMeat?
}

struct KZMoreProvider: TimelineProvider {
    func placeholder(in context: Context) -> KZMoreEntry { KZMoreEntry(date: Date(), snapshot: KZSample.snapshot, meat: nil) }

    func getSnapshot(in context: Context, completion: @escaping (KZMoreEntry) -> Void) {
        let stored = KZSharedStore.read()
        completion(KZMoreEntry(date: Date(), snapshot: stored ?? (context.isPreview ? KZSample.snapshot : nil), meat: KZMeatStore.effective(stored)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<KZMoreEntry>) -> Void) {
        let now = Date()
        let snapshot = KZSharedStore.read()
        let meat = KZMeatStore.effective(snapshot)
        guard let snapshot else {
            // No snapshot yet: the meat widget still works (its own store); look again in an hour.
            var dates = [now]
            if let state = meat?.state(at: now), state.phase != .idle {
                [state.end, state.restAt + 1000].filter { $0 > KZSnapshot.ms(now) }.forEach { dates.append(KZSnapshot.date($0)) }
            }
            completion(Timeline(entries: dates.map { KZMoreEntry(date: $0, snapshot: nil, meat: meat) }, policy: .after(now.addingTimeInterval(3600))))
            return
        }
        let changes = snapshot.moreChanges(after: now, meat: meat, limit: 140)
        let entries = [KZMoreEntry(date: now, snapshot: snapshot, meat: meat)] + changes.map { KZMoreEntry(date: $0, snapshot: snapshot, meat: meat) }
        completion(Timeline(entries: entries, policy: .after(changes.last ?? now.addingTimeInterval(6 * 3600))))
    }
}

// MARK: - Shared pieces

private func kzLink(_ path: String) -> URL { URL(string: "kzohaar://open/\(path)")! }

private let kzOnGold = Color(red: 0.141, green: 0.118, blue: 0.090)

private func kzClock(_ ms: Double, _ snapshot: KZSnapshot?) -> String {
    if let snapshot { return snapshot.time(ms) }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "he_IL")
    formatter.dateFormat = "HH:mm"
    return formatter.string(from: KZSnapshot.date(ms))
}

// "מחר" beside a time that falls on a later civil day than the entry (in the snapshot's time zone).
private func kzIsLaterDay(_ ms: Double, after date: Date, _ snapshot: KZSnapshot) -> Bool {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: snapshot.tzid) ?? .current
    return calendar.startOfDay(for: KZSnapshot.date(ms)) > calendar.startOfDay(for: date)
}

struct KZCard<Content: View>: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    let content: (KZPalette) -> Content
    init(@ViewBuilder content: @escaping (KZPalette) -> Content) { self.content = content }
    var body: some View {
        let palette = KZPalette.of(scheme)
        content(palette)
            .environment(\.layoutDirection, .rightToLeft)
            .containerBackground(for: .widget) {
                if [.systemSmall, .systemMedium, .systemLarge].contains(family) {
                    ZStack {
                        LinearGradient(colors: [palette.top, palette.bottom], startPoint: .top, endPoint: .bottom)
                        ContainerRelativeShape().inset(by: 5).strokeBorder(palette.gold.opacity(0.38), lineWidth: 0.75)
                    }
                } else {
                    Color.clear
                }
            }
    }
}

// A small title between two gold rules — the heading of a widget.
struct KZHeading: View {
    let text: String
    let palette: KZPalette
    var body: some View {
        HStack(spacing: 7) {
            Rectangle().fill(LinearGradient(colors: [palette.gold.opacity(0), palette.gold.opacity(0.7)], startPoint: .leading, endPoint: .trailing)).frame(height: 0.75)
            Text(text).font(.system(size: 13, weight: .semibold, design: .serif)).foregroundColor(palette.gold).lineLimit(1).fixedSize()
            Rectangle().fill(LinearGradient(colors: [palette.gold.opacity(0.7), palette.gold.opacity(0)], startPoint: .leading, endPoint: .trailing)).frame(height: 0.75)
        }
        .accessibilityAddTraits(.isHeader)
    }
}

private func kzWeatherSymbol(_ kind: String) -> String {
    switch kind {
    case "clear": return "sun.max.fill"
    case "night": return "moon.stars.fill"
    case "partly": return "cloud.sun.fill"
    case "fog": return "cloud.fog.fill"
    case "drizzle": return "cloud.drizzle.fill"
    case "rain": return "cloud.rain.fill"
    case "snow": return "cloud.snow.fill"
    case "storm": return "cloud.bolt.rain.fill"
    default: return "cloud.fill"
    }
}

// MARK: - 1. זמנים ומזג אוויר

struct KZWeatherBlock: View {
    let snapshot: KZSnapshot
    let date: Date
    let palette: KZPalette
    var compact = false
    var body: some View {
        if let (weather, dim) = snapshot.weatherState(at: date) {
            // Compact (beside the date in the large size) it stands flush with the far edge, mirroring the date block.
            VStack(alignment: compact ? .trailing : .center, spacing: 3) {
                HStack(spacing: 6) {
                    Image(systemName: kzWeatherSymbol(weather.kind))
                        .symbolRenderingMode(.multicolor)
                        .font(.system(size: compact ? 24 : 26))
                    Text("\(weather.temp)°")
                        .font(.system(size: compact ? 30 : 34, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(palette.ink)
                }
                Text(weather.label).font(.system(size: 14)).foregroundColor(palette.muted).lineLimit(1).minimumScaleFactor(0.8)
                if let high = weather.high, let low = weather.low {
                    Text("↑\(high)°  ↓\(low)°").font(.system(size: 13, weight: .medium)).monospacedDigit().foregroundColor(palette.muted)
                        .environment(\.layoutDirection, .leftToRight)
                }
                Text("עודכן \(kzClock(weather.at, snapshot))").font(.system(size: 11)).foregroundColor(palette.muted.opacity(dim ? 1 : 0.8))
            }
            .opacity(dim ? 0.6 : 1)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("מזג האוויר: \(weather.temp) מעלות, \(weather.label), עודכן ב־\(kzClock(weather.at, snapshot))")
        } else {
            VStack(spacing: 4) {
                Image(systemName: "cloud.sun").font(.system(size: 24)).foregroundColor(palette.gold.opacity(0.6))
                Text("מזג האוויר יופיע אחרי פתיחת מסך היום").font(.system(size: 12)).foregroundColor(palette.muted).multilineTextAlignment(.center).lineLimit(3)
            }
        }
    }
}

struct KZZmanRows: View {
    let snapshot: KZSnapshot
    let date: Date
    let count: Int
    let palette: KZPalette
    var size: CGFloat = 15
    var body: some View {
        let t = KZSnapshot.ms(date)
        let rows = Array(snapshot.zmanim.filter { $0.at > t }.prefix(count))
        VStack(spacing: size > 15 ? 5 : 3) {
            ForEach(Array(rows.enumerated()), id: \.offset) { index, zman in
                let first = index == 0
                HStack(spacing: 6) {
                    Text(zman.name).font(.system(size: size, weight: first ? .semibold : .regular)).foregroundColor(first ? palette.gold : palette.ink).lineLimit(1).minimumScaleFactor(0.8)
                    if kzIsLaterDay(zman.at, after: date, snapshot) {
                        Text("מחר").font(.system(size: size - 3)).foregroundColor(palette.muted)
                    }
                    Spacer(minLength: 4)
                    Text(snapshot.time(zman.at)).font(.system(size: size, weight: first ? .bold : .medium, design: .rounded)).monospacedDigit().foregroundColor(first ? palette.gold : palette.ink)
                }
                .padding(.horizontal, 7)
                .padding(.vertical, first ? 2 : 0)
                .background(first ? RoundedRectangle(cornerRadius: 7).fill(palette.gold.opacity(0.13)) : nil)
            }
        }
    }
}

struct KZZmanimWeatherView: View {
    @Environment(\.widgetFamily) private var family
    let entry: KZMoreEntry
    var body: some View {
        KZCard { palette in
            if let snapshot = entry.snapshot, let day = snapshot.state(at: entry.date).day, !snapshot.state(at: entry.date).stale {
                if family == .systemLarge {
                    VStack(spacing: 10) {
                        HStack(alignment: .center) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(day.date).font(.system(size: 20, weight: .semibold, design: .serif)).foregroundColor(palette.ink).lineLimit(1).minimumScaleFactor(0.8)
                                Text([day.weekday, day.parasha].compactMap { $0 }.joined(separator: " · ")).font(.system(size: 14)).foregroundColor(palette.muted).lineLimit(1)
                                if !snapshot.place.isEmpty { Text(snapshot.place).font(.system(size: 13)).foregroundColor(palette.muted).lineLimit(1) }
                            }
                            Spacer(minLength: 8)
                            KZWeatherBlock(snapshot: snapshot, date: entry.date, palette: palette, compact: true)
                        }
                        KZGoldRule(palette: palette)
                        KZZmanRows(snapshot: snapshot, date: entry.date, count: 10, palette: palette, size: 16)
                        Spacer(minLength: 0)
                    }
                } else {
                    HStack(spacing: 12) {
                        KZWeatherBlock(snapshot: snapshot, date: entry.date, palette: palette)
                            .frame(width: 104)
                        Rectangle().fill(LinearGradient(colors: [palette.gold.opacity(0), palette.gold.opacity(0.6), palette.gold.opacity(0)], startPoint: .top, endPoint: .bottom)).frame(width: 0.75)
                        VStack(spacing: 4) {
                            HStack {
                                Text(day.dayMonth).font(.system(size: 14, weight: .semibold, design: .serif)).foregroundColor(palette.ink)
                                Spacer()
                                Text(day.weekday).font(.system(size: 13)).foregroundColor(palette.muted)
                            }
                            .padding(.horizontal, 7)
                            KZZmanRows(snapshot: snapshot, date: entry.date, count: 5, palette: palette, size: 14)
                        }
                    }
                }
            } else {
                KZOpenApp(palette: palette)
            }
        }
        .widgetURL(kzLink("zmanim"))
    }
}

struct KZZmanimWeatherWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "KZZmanimWeather", provider: KZMoreProvider()) { entry in KZZmanimWeatherView(entry: entry) }
            .configurationDisplayName("זמנים ומזג אוויר")
            .description("הזמנים הקרובים — הבא מודגש — ומזג האוויר כפי שנקרא באפליקציה.")
            .supportedFamilies([.systemMedium, .systemLarge])
    }
}

// MARK: - 2. התפילה הבאה

struct KZNextPrayerView: View {
    @Environment(\.widgetFamily) private var family
    let entry: KZMoreEntry

    var body: some View {
        let state = entry.snapshot?.prayerState(at: entry.date)
        let link = kzLink("prayer/\(state?.current.key ?? "shacharit")")
        Group {
            switch family {
            case .accessoryInline:
                if let state, let snapshot = entry.snapshot {
                    Text(state.deadline.map { "\(state.current.name) · עד \(snapshot.time($0.at))" } ?? state.current.name)
                } else {
                    Text("כזוהר הרקיע")
                }
            case .accessoryRectangular:
                if let state, let snapshot = entry.snapshot {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(state.current.name).font(.headline).widgetAccentable()
                        if let deadline = state.deadline {
                            Text("\(deadline.name) \(snapshot.time(deadline.at))").lineLimit(1).minimumScaleFactor(0.8)
                            Text(timerInterval: entry.date...KZSnapshot.date(deadline.at), countsDown: true).monospacedDigit()
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    Text("פתחו את כזוהר הרקיע")
                }
            default:
                KZCard { palette in
                    if let state, let snapshot = entry.snapshot {
                        if family == .systemMedium { medium(state, snapshot, palette) } else { small(state, snapshot, palette) }
                    } else {
                        KZOpenApp(palette: palette)
                    }
                }
            }
        }
        .widgetURL(link)
    }

    private func header(_ state: KZSnapshot.PrayerState, _ snapshot: KZSnapshot) -> String {
        if let opens = state.opens { return "\(opens.name) \(snapshot.time(opens.at))" }
        return "התפילה עכשיו"
    }

    @ViewBuilder
    private func small(_ state: KZSnapshot.PrayerState, _ snapshot: KZSnapshot, _ palette: KZPalette) -> some View {
        VStack(spacing: 4) {
            Text(header(state, snapshot)).font(.system(size: 13)).foregroundColor(palette.muted).lineLimit(1).minimumScaleFactor(0.8)
            Text(state.current.name).font(.system(size: 32, weight: .bold, design: .serif)).foregroundColor(palette.ink)
            KZGoldRule(palette: palette).padding(.horizontal, 8)
            if let deadline = state.deadline {
                Text("\(deadline.name) \(snapshot.time(deadline.at))").font(.system(size: 14, weight: .medium)).foregroundColor(palette.ink).lineLimit(1).minimumScaleFactor(0.75)
                Text(timerInterval: entry.date...KZSnapshot.date(deadline.at), countsDown: true)
                    .font(.system(size: 22, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(palette.gold)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func medium(_ state: KZSnapshot.PrayerState, _ snapshot: KZSnapshot, _ palette: KZPalette) -> some View {
        let t = KZSnapshot.ms(entry.date)
        HStack(spacing: 14) {
            small(state, snapshot, palette).frame(width: 136)
            Rectangle().fill(LinearGradient(colors: [palette.gold.opacity(0), palette.gold.opacity(0.6), palette.gold.opacity(0)], startPoint: .top, endPoint: .bottom)).frame(width: 0.75)
            VStack(alignment: .leading, spacing: 5) {
                Text("זמני \(state.current.name)").font(.system(size: 13, weight: .semibold, design: .serif)).foregroundColor(palette.gold)
                if let opens = state.current.opens {
                    row(opens.name, snapshot.time(opens.at), passed: opens.at <= t, current: false, palette)
                }
                ForEach(Array(state.current.ends.enumerated()), id: \.offset) { _, mark in
                    row(mark.name, snapshot.time(mark.at), passed: mark.at <= t, current: mark.at == state.deadline?.at, palette)
                }
                Spacer(minLength: 0)
                if let next = state.next {
                    Link(destination: kzLink("prayer/\(next.key)")) {
                        HStack {
                            Text("הבאה: \(next.name)").font(.system(size: 14, weight: .medium)).foregroundColor(palette.ink)
                            Spacer()
                            Text(snapshot.time(next.opens?.at ?? next.from)).font(.system(size: 14, weight: .medium, design: .rounded)).monospacedDigit().foregroundColor(palette.muted)
                        }
                    }
                }
            }
        }
    }

    private func row(_ name: String, _ time: String, passed: Bool, current: Bool, _ palette: KZPalette) -> some View {
        HStack {
            Text(name).font(.system(size: 14, weight: current ? .semibold : .regular)).lineLimit(1).minimumScaleFactor(0.8)
            Spacer(minLength: 4)
            Text(time).font(.system(size: 14, weight: current ? .bold : .medium, design: .rounded)).monospacedDigit()
        }
        .foregroundColor(current ? palette.gold : passed ? palette.muted.opacity(0.65) : palette.ink)
        .strikethrough(passed, color: palette.muted.opacity(0.5))
    }
}

struct KZNextPrayerWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "KZNextPrayer", provider: KZMoreProvider()) { entry in KZNextPrayerView(entry: entry) }
            .configurationDisplayName("התפילה הבאה")
            .description("תפילת השעה, סוף זמנה וכמה נותר. נגיעה פותחת אותה בסידור.")
            .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

// MARK: - 3. רביעיית תפילות

struct KZQuartetView: View {
    let entry: KZMoreEntry
    private static let symbols = ["shacharit": "sunrise", "mincha": "sun.max", "maariv": "moon.stars", "birkat-hamazon": "fork.knife"]

    var body: some View {
        KZCard { palette in
            let snapshot = entry.snapshot
            let current = snapshot?.prayerState(at: entry.date)
            VStack(spacing: 9) {
                KZHeading(text: snapshot?.state(at: entry.date).day.map { "תפילות · \($0.dayMonth)" } ?? "תפילות", palette: palette)
                HStack(spacing: 8) {
                    ForEach(doors(snapshot, current), id: \.key) { door in
                        Link(destination: kzLink("prayer/\(door.key)")) { tile(door, palette) }
                    }
                }
            }
        }
        .widgetURL(kzLink("prayer/\(entry.snapshot?.prayerState(at: entry.date)?.current.key ?? "shacharit")"))
    }

    private struct Door { let key: String; let name: String; let now: Bool; let hint: String }

    // The same doors as quartetAt() in JavaScript.
    private func doors(_ snapshot: KZSnapshot?, _ state: KZSnapshot.PrayerState?) -> [Door] {
        let t = KZSnapshot.ms(entry.date)
        let names = ["shacharit": "שחרית", "mincha": "מנחה", "maariv": "ערבית"]
        var out: [Door] = ["shacharit", "mincha", "maariv"].map { key in
            if let state, state.current.key == key {
                return Door(key: key, name: names[key]!, now: true, hint: state.deadline.map { "עד \(snapshot!.time($0.at))" } ?? "")
            }
            let upcoming = snapshot?.prayers?.first { $0.key == key && $0.from > t }
            return Door(key: key, name: names[key]!, now: false, hint: upcoming.map { "מ־\(snapshot!.time($0.opens?.at ?? $0.from))" } ?? "")
        }
        out.append(Door(key: "birkat-hamazon", name: "ברכת המזון", now: false, hint: "אחרי הסעודה"))
        return out
    }

    private func tile(_ door: Door, _ palette: KZPalette) -> some View {
        VStack(spacing: 4) {
            Image(systemName: KZQuartetView.symbols[door.key] ?? "book")
                .font(.system(size: 19, weight: .medium))
                .foregroundColor(palette.gold)
                .frame(height: 22)
            Text(door.name).font(.system(size: 15, weight: .semibold)).foregroundColor(palette.ink).lineLimit(1).minimumScaleFactor(0.7)
            Text(door.hint).font(.system(size: 12, weight: .medium)).monospacedDigit().foregroundColor(door.now ? palette.gold : palette.muted).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(palette.gold.opacity(door.now ? 0.16 : 0.06))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(palette.gold.opacity(door.now ? 0.85 : 0.3), lineWidth: door.now ? 1.2 : 0.75)
        )
        .accessibilityElement(children: .combine)
        .accessibilityHint("פותח בסידור")
    }
}

struct KZQuartetWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "KZQuartet", provider: KZMoreProvider()) { entry in KZQuartetView(entry: entry) }
            .configurationDisplayName("רביעיית תפילות")
            .description("שחרית, מנחה, ערבית וברכת המזון — כל אחת נפתחת ישר בסידור.")
            .supportedFamilies([.systemMedium])
    }
}

// MARK: - 4. אכלתי בשרי

// The widget's own button (iOS 17): starts the wait now, with the hours the user chose in the app (6, or 3 for those
// whose custom it is). Runs in the widget extension; writes the shared store the app reads back
// (KZWidgetsPlugin.getMeatState) and sets the same reminder the app's card sets.
struct KZStartMeatIntent: AppIntent {
    static var title: LocalizedStringResource = "אכלתי בשרי"
    static var description = IntentDescription("מתחיל את ההמתנה בין בשר לחלב מעכשיו.")
    static var isDiscoverable = false

    func perform() async throws -> some IntentResult {
        let now = Date()
        let current = KZMeatStore.effective(KZSharedStore.read())
        let preferred = [6, 3].contains(current?.preferred ?? 6) ? (current?.preferred ?? 6) : 6
        let meat = KZMeat(startedAt: KZSnapshot.ms(now), hours: preferred, preferred: preferred, updatedAt: KZSnapshot.ms(now))
        KZMeatStore.write(meat)
        await KZStartMeatIntent.remind(start: now, hours: preferred)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }

    // The reminder at the end of the wait — only if the user already allowed the app's notifications.
    static func remind(start: Date, hours: Int) async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) else { return }
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        let content = UNMutableNotificationContent()
        content.title = "אפשר לאכול חלבי"
        content.body = "עברו \(hours) שעות מהארוחה הבשרית (\(formatter.string(from: start)))."
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(hours * 3600), repeats: false)
        try? await center.add(UNNotificationRequest(identifier: KZMeatStore.reminderIdentifier, content: content, trigger: trigger))
    }
}

struct KZMeatView: View {
    @Environment(\.widgetFamily) private var family
    let entry: KZMoreEntry

    var body: some View {
        let state = entry.meat?.state(at: entry.date) ?? KZMeat(startedAt: nil, hours: 6, preferred: entry.snapshot?.meat?.preferred, updatedAt: 0).state(at: entry.date)
        Group {
            switch family {
            case .accessoryCircular:
                if state.phase == .waiting {
                    ProgressView(timerInterval: KZSnapshot.date(state.start)...KZSnapshot.date(state.end), countsDown: true) {
                        Text("בשרי")
                    } currentValueLabel: {
                        Image(systemName: "fork.knife")
                    }
                    .progressViewStyle(.circular)
                } else {
                    ZStack {
                        AccessoryWidgetBackground()
                        VStack(spacing: 0) {
                            Image(systemName: state.phase == .done ? "checkmark" : "fork.knife").font(.system(size: 15, weight: .semibold))
                            Text(state.phase == .done ? "חלבי" : "בשרי").font(.system(size: 11, weight: .semibold))
                        }
                    }
                }
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 0) {
                    switch state.phase {
                    case .waiting:
                        Text("חלבי מ־\(kzClock(state.end, entry.snapshot))").font(.headline).widgetAccentable()
                        Text(timerInterval: KZSnapshot.date(state.start)...KZSnapshot.date(state.end), countsDown: true).monospacedDigit()
                        ProgressView(timerInterval: KZSnapshot.date(state.start)...KZSnapshot.date(state.end), countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
                    case .done:
                        Text("אפשר חלבי").font(.headline).widgetAccentable()
                        Text("מאז \(kzClock(state.end, entry.snapshot))")
                    case .idle:
                        Text("בשרי · חלבי").font(.headline).widgetAccentable()
                        Text("המתנה של \(state.hours) שעות")
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            default:
                KZCard { palette in small(state, palette) }
            }
        }
        .widgetURL(kzLink("meat"))
    }

    @ViewBuilder
    private func small(_ state: KZMeat.State, _ palette: KZPalette) -> some View {
        VStack(spacing: 5) {
            switch state.phase {
            case .waiting:
                Text("נותרו").font(.system(size: 13)).foregroundColor(palette.muted)
                Text(timerInterval: KZSnapshot.date(state.start)...KZSnapshot.date(state.end), countsDown: true)
                    .font(.system(size: 30, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(palette.ink)
                    .multilineTextAlignment(.center)
                ProgressView(timerInterval: KZSnapshot.date(state.start)...KZSnapshot.date(state.end), countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
                    .progressViewStyle(.linear)
                    .tint(palette.gold)
                    .padding(.horizontal, 6)
                Text("חלבי מ־\(kzClock(state.end, entry.snapshot))").font(.system(size: 15, weight: .medium)).foregroundColor(palette.ink)
                Text("אכלתי ב־\(kzClock(state.start, entry.snapshot)) · \(state.hours) שעות").font(.system(size: 12)).foregroundColor(palette.muted).lineLimit(1).minimumScaleFactor(0.8)
            case .done:
                Text("ההמתנה הסתיימה").font(.system(size: 13)).foregroundColor(palette.muted)
                Text("אפשר חלבי").font(.system(size: 26, weight: .bold, design: .serif)).foregroundColor(palette.gold)
                Text("מאז \(kzClock(state.end, entry.snapshot))").font(.system(size: 14)).foregroundColor(palette.muted)
                KZGoldRule(palette: palette).padding(.horizontal, 10)
                button("אכלתי בשרי שוב", palette)
            case .idle:
                KZHeading(text: "בשרי · חלבי", palette: palette)
                Spacer(minLength: 0)
                Image(systemName: "fork.knife").font(.system(size: 22, weight: .regular)).foregroundColor(palette.gold.opacity(0.85))
                Spacer(minLength: 0)
                button("אכלתי בשרי", palette)
                Text("המתנה של \(state.hours) שעות").font(.system(size: 13)).foregroundColor(palette.muted)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func button(_ title: String, _ palette: KZPalette) -> some View {
        Button(intent: KZStartMeatIntent()) {
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(kzOnGold)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity)
                .background(Capsule().fill(LinearGradient(colors: [palette.gold.opacity(0.8), palette.gold], startPoint: .top, endPoint: .bottom)))
        }
        .buttonStyle(.plain)
        .accessibilityHint("מתחיל את ההמתנה מעכשיו")
    }
}

struct KZMeatWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "KZMeat", provider: KZMoreProvider()) { entry in KZMeatView(entry: entry) }
            .configurationDisplayName("אכלתי בשרי")
            .description("ההמתנה בין בשר לחלב — 6 שעות, או 3 למנהגכם כפי שנבחר באפליקציה. אפשר להתחיל ישר מהווידג׳ט.")
            .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular])
    }
}

// MARK: - 5. דברי חכמים

struct KZSayingView: View {
    @Environment(\.widgetFamily) private var family
    let entry: KZMoreEntry
    var body: some View {
        KZCard { palette in
            if let (saying, _) = entry.snapshot?.saying(at: entry.date) {
                let large = family == .systemLarge
                VStack(spacing: large ? 14 : 7) {
                    KZHeading(text: "דברי חכמים", palette: palette)
                    Spacer(minLength: 0)
                    Text(saying.text)
                        .font(.system(size: large ? 24 : 17, weight: .regular, design: .serif))
                        .foregroundColor(palette.ink)
                        .multilineTextAlignment(.center)
                        .lineSpacing(large ? 5 : 2)
                        .lineLimit(large ? 9 : 4)
                        .minimumScaleFactor(0.7)
                    Spacer(minLength: 0)
                    Text(saying.source).font(.system(size: large ? 14 : 12)).foregroundColor(palette.gold).lineLimit(1).minimumScaleFactor(0.75)
                }
                .accessibilityElement(children: .combine)
            } else {
                KZOpenApp(palette: palette)
            }
        }
        .widgetURL(kzLink("sayings"))
    }
}

struct KZSayingsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "KZSayings", provider: KZMoreProvider()) { entry in KZSayingView(entry: entry) }
            .configurationDisplayName("דברי חכמים")
            .description("אמרה מדברי חכמים, מתחלפת כל שלוש שעות, עם מקורה. נגיעה פותחת את בשבילי היום.")
            .supportedFamilies([.systemMedium, .systemLarge])
    }
}

// MARK: - 6. ספירת העומר

private func kzOmerWords(_ day: Int) -> String {
    let weeks = day / 7, days = day % 7
    if weeks == 0 { return day == 1 ? "יום אחד לעומר" : "\(day) ימים לעומר" }
    let weeksText = weeks == 1 ? "שבוע אחד" : "\(weeks) שבועות"
    return days == 0 ? "שהם \(weeksText)" : "שהם \(weeksText) \(days == 1 ? "ויום אחד" : "ו־\(days) ימים")"
}

struct KZOmerView: View {
    @Environment(\.widgetFamily) private var family
    let entry: KZMoreEntry
    var body: some View {
        let day = entry.snapshot?.state(at: entry.date).day?.omer ?? 0
        Group {
            switch family {
            case .accessoryCircular:
                Gauge(value: Double(day), in: 0...49) { Text("עומר") } currentValueLabel: { Text(day > 0 ? "\(day)" : "—").monospacedDigit() }
                    .gaugeStyle(.accessoryCircularCapacity)
                    .accessibilityLabel(day > 0 ? "היום \(day) לעומר" : "אין ספירת העומר היום")
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 0) {
                    Text("ספירת העומר").font(.headline).widgetAccentable()
                    Text(day > 0 ? "היום \(day) לעומר" : (entry.snapshot?.omerAnswer(at: entry.date) ?? "פתחו את כזוהר הרקיע")).lineLimit(2)
                    if day >= 7 { Text(kzOmerWords(day)).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.75) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            default:
                KZCard { palette in
                    VStack(spacing: 6) {
                        KZHeading(text: "ספירת העומר", palette: palette)
                        if day > 0 {
                            ZStack {
                                Circle().stroke(palette.track, lineWidth: 5)
                                Circle().trim(from: 0, to: Double(day) / 49)
                                    .stroke(palette.gold, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                                    .rotationEffect(.degrees(-90))
                                Text("\(day)").font(.system(size: 30, weight: .semibold, design: .serif)).monospacedDigit().foregroundColor(palette.ink)
                            }
                            .frame(width: 66, height: 66)
                            Text(day < 7 ? kzOmerWords(day) : "היום \(day) לעומר").font(.system(size: 14, weight: .medium)).foregroundColor(palette.ink).lineLimit(1).minimumScaleFactor(0.8)
                            if day >= 7 { Text(kzOmerWords(day)).font(.system(size: 12)).foregroundColor(palette.muted).lineLimit(1).minimumScaleFactor(0.8) }
                        } else if let snapshot = entry.snapshot {
                            Spacer(minLength: 0)
                            Image(systemName: "calendar").font(.system(size: 24)).foregroundColor(palette.gold.opacity(0.8))
                            Text(snapshot.omerAnswer(at: entry.date)).font(.system(size: 14)).foregroundColor(palette.muted).multilineTextAlignment(.center).lineLimit(3)
                            Spacer(minLength: 0)
                        } else {
                            KZOpenApp(palette: palette)
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .widgetURL(kzLink(day > 0 ? "prayer/omer" : "today"))
    }
}

struct KZOmerWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "KZOmer", provider: KZMoreProvider()) { entry in KZOmerView(entry: entry) }
            .configurationDisplayName("ספירת העומר")
            .description("היום לעומר, מתחלף בשקיעה. נגיעה פותחת את הספירה בסידור.")
            .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular])
    }
}

// MARK: - 7. שבת קודש

struct KZShabbatView: View {
    let entry: KZMoreEntry
    var body: some View {
        KZCard { palette in
            if let snapshot = entry.snapshot, let shabbat = snapshot.state(at: entry.date).shabbat {
                let t = KZSnapshot.ms(entry.date)
                let during = (shabbat.candles ?? .infinity) <= t
                VStack(spacing: 6) {
                    Text("שבת קודש").font(.system(size: 20, weight: .semibold, design: .serif)).foregroundColor(palette.gold)
                    if let parasha = shabbat.parasha {
                        Text(parasha).font(.system(size: 14)).foregroundColor(palette.ink).lineLimit(1).minimumScaleFactor(0.8)
                    }
                    KZGoldRule(palette: palette).padding(.horizontal, 4).padding(.vertical, 2)
                    if let candles = shabbat.candles {
                        line("כניסת שבת", snapshot.time(candles), strong: !during, palette)
                    }
                    line("צאת שבת", snapshot.time(shabbat.havdalah), strong: during, palette)
                    if let rt = shabbat.rabbenuTam {
                        Text("ר״ת \(snapshot.time(rt))").font(.system(size: 11)).foregroundColor(palette.muted).lineLimit(1)
                            .accessibilityLabel("רבנו תם \(snapshot.time(rt))")
                    }
                    if !during, let candles = shabbat.candles, kzIsLaterDay(candles, after: entry.date, snapshot) {
                        Text(Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: entry.date), to: Calendar.current.startOfDay(for: KZSnapshot.date(candles))).day.map { $0 == 1 ? "מחר" : "בעוד \($0) ימים" } ?? "")
                            .font(.system(size: 12)).foregroundColor(palette.muted)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .accessibilityElement(children: .combine)
            } else {
                KZOpenApp(palette: palette)
            }
        }
        .widgetURL(kzLink("zmanim"))
    }

    private func line(_ label: String, _ time: String, strong: Bool, _ palette: KZPalette) -> some View {
        HStack {
            Text(label).font(.system(size: 14, weight: strong ? .semibold : .regular)).foregroundColor(strong ? palette.ink : palette.muted).lineLimit(1).minimumScaleFactor(0.8)
            Spacer(minLength: 4)
            Text(time).font(.system(size: 17, weight: strong ? .bold : .medium, design: .rounded)).monospacedDigit().foregroundColor(strong ? palette.ink : palette.muted)
        }
        .padding(.horizontal, 4)
    }
}

struct KZShabbatWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "KZShabbat", provider: KZMoreProvider()) { entry in KZShabbatView(entry: entry) }
            .configurationDisplayName("שבת קודש")
            .description("פרשת השבוע, הדלקת נרות וצאת השבת לפי המיקום שלכם.")
            .supportedFamilies([.systemSmall])
    }
}
