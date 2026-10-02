import SwiftUI
import WidgetKit

// "כזוהר הרקיע" on the home screen (small, medium; StandBy shows the small one) and on the lock screen (circular: the
// spiritual ring; rectangular and inline: the date and the next zman). Everything is read from the snapshot the app
// wrote (KZSharedStore); the timeline has an entry at every instant something changes (each zman, each sunset, the end
// of the ring's week, havdalah), so "the next zman" advances on time without the app being opened.

// MARK: - Palette (the app's cream and gold; a warm ink in the dark)

struct KZPalette {
    let top: Color, bottom: Color, ink: Color, muted: Color, gold: Color, track: Color
    // The ONE colour of the spiritual circle's progress, as in the app (src/services/progressColor.mjs): royal blue
    // #2A55D0, and in the dark #789CF8 (the same royal blue, lighter for a dark ground). The track stays gold.
    static let progressLight = Color(red: 42 / 255, green: 85 / 255, blue: 208 / 255)
    static let progressDark = Color(red: 120 / 255, green: 156 / 255, blue: 248 / 255)
    var progress: Color { isDark ? KZPalette.progressDark : KZPalette.progressLight }
    var isDark = false
    static func of(_ scheme: ColorScheme) -> KZPalette {
        scheme == .dark
            ? KZPalette(top: Color(red: 0.125, green: 0.110, blue: 0.086), bottom: Color(red: 0.090, green: 0.078, blue: 0.059),
                        ink: Color(red: 0.953, green: 0.933, blue: 0.886), muted: Color(red: 0.745, green: 0.694, blue: 0.604),
                        gold: Color(red: 0.831, green: 0.698, blue: 0.353), track: Color(red: 0.831, green: 0.698, blue: 0.353).opacity(0.22), isDark: true)
            : KZPalette(top: Color(red: 0.992, green: 0.984, blue: 0.965), bottom: Color(red: 0.961, green: 0.949, blue: 0.918),
                        ink: Color(red: 0.141, green: 0.118, blue: 0.090), muted: Color(red: 0.443, green: 0.404, blue: 0.345),
                        gold: Color(red: 0.722, green: 0.569, blue: 0.184), track: Color(red: 0.722, green: 0.569, blue: 0.184).opacity(0.2))
    }
}

// MARK: - Timeline

struct KZEntry: TimelineEntry {
    let date: Date
    let snapshot: KZSnapshot?
    var state: KZSnapshot.State? { snapshot?.state(at: date) }
}

struct KZProvider: TimelineProvider {
    func placeholder(in context: Context) -> KZEntry { KZEntry(date: Date(), snapshot: KZSample.snapshot) }

    func getSnapshot(in context: Context, completion: @escaping (KZEntry) -> Void) {
        let stored = KZSharedStore.read()
        completion(KZEntry(date: Date(), snapshot: stored ?? (context.isPreview ? KZSample.snapshot : nil)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<KZEntry>) -> Void) {
        let now = Date()
        guard let snapshot = KZSharedStore.read() else {
            completion(Timeline(entries: [KZEntry(date: now, snapshot: nil)], policy: .after(now.addingTimeInterval(3600))))
            return
        }
        let changes = snapshot.changes(after: now, limit: 72)
        let entries = [KZEntry(date: now, snapshot: snapshot)] + changes.map { KZEntry(date: $0, snapshot: snapshot) }
        completion(Timeline(entries: entries, policy: .after(changes.last ?? now.addingTimeInterval(6 * 3600))))
    }
}

// MARK: - Pieces

struct KZRing: View {
    let value: Int
    let goal: Int
    let size: CGFloat
    let palette: KZPalette
    var body: some View {
        let progress = min(1, max(0, Double(value) / Double(max(1, goal))))
        ZStack {
            Circle().stroke(palette.track, lineWidth: size * 0.09)
            Circle().trim(from: 0, to: progress)
                .stroke(LinearGradient(colors: [palette.progress.opacity(0.8), palette.progress], startPoint: .top, endPoint: .bottom),
                        style: StrokeStyle(lineWidth: size * 0.09, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(value)")
                .font(.system(size: size * 0.34, weight: .semibold, design: .serif))
                .monospacedDigit()
                .foregroundColor(palette.ink)
                .minimumScaleFactor(0.7)
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("המעגל הרוחני: \(value) מתוך \(goal)")
    }
}

struct KZGoldRule: View {
    let palette: KZPalette
    var body: some View {
        HStack(spacing: 5) {
            Rectangle().fill(LinearGradient(colors: [palette.gold.opacity(0), palette.gold.opacity(0.7)], startPoint: .leading, endPoint: .trailing)).frame(height: 0.75)
            Rectangle().fill(palette.gold).frame(width: 4.5, height: 4.5).rotationEffect(.degrees(45))
            Rectangle().fill(LinearGradient(colors: [palette.gold.opacity(0.7), palette.gold.opacity(0)], startPoint: .leading, endPoint: .trailing)).frame(height: 0.75)
        }
        .accessibilityHidden(true)
    }
}

private struct KZLabeledTime: View {
    let label: String
    let time: String
    let palette: KZPalette
    var large: CGFloat = 24
    var labelSize: CGFloat = 15
    var labelScale: CGFloat = 0.85
    var alignment: HorizontalAlignment = .leading
    var body: some View {
        VStack(alignment: alignment, spacing: 0) {
            Text(label).font(.system(size: labelSize, weight: .regular)).foregroundColor(palette.muted).lineLimit(1).minimumScaleFactor(labelScale)
            Text(time).font(.system(size: large, weight: .semibold, design: .rounded)).monospacedDigit().foregroundColor(palette.ink).lineLimit(1)
        }
        .multilineTextAlignment(alignment == .center ? .center : .leading)
        .accessibilityElement(children: .combine)
    }
}

struct KZOpenApp: View {
    let palette: KZPalette
    var body: some View {
        VStack(spacing: 6) {
            Text("כזוהר הרקיע").font(.system(size: 17, weight: .semibold, design: .serif)).foregroundColor(palette.gold)
            Text("פתחו את האפליקציה לעדכון זמני היום").font(.system(size: 15)).foregroundColor(palette.muted).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Home screen

struct KZSmallView: View {
    let entry: KZEntry
    let palette: KZPalette
    var body: some View {
        if let snapshot = entry.snapshot, let state = entry.state, let day = state.day, !state.stale {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top, spacing: 6) {
                    // The date and the day, centred in their block (as in every widget's header).
                    VStack(alignment: .center, spacing: 1) {
                        Text(day.dayMonth).font(.system(size: 17, weight: .semibold, design: .serif)).foregroundColor(palette.ink).lineLimit(1).minimumScaleFactor(0.8)
                        Text(day.weekday).font(.system(size: 15)).foregroundColor(palette.muted).lineLimit(1)
                    }
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity, alignment: .center)
                    Spacer(minLength: 2)
                    KZRing(value: state.ring, goal: state.goal, size: 42, palette: palette)
                }
                KZGoldRule(palette: palette)
                Spacer(minLength: 0)
                if let next = state.next {
                    KZLabeledTime(label: next.name, time: snapshot.time(next.at), palette: palette, large: 30, alignment: .center)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            }
            .widgetURL(URL(string: "kzohaar://open/zmanim"))
        } else {
            KZOpenApp(palette: palette).widgetURL(URL(string: "kzohaar://open/today"))
        }
    }
}

struct KZMediumView: View {
    let entry: KZEntry
    let palette: KZPalette
    var body: some View {
        if let snapshot = entry.snapshot, let state = entry.state, let day = state.day, !state.stale {
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 5) {
                    // The header — the Jewish date, then the day and the week's reading — centred in its block, on the
                    // same axis as the three zmanim columns below it.
                    VStack(alignment: .center, spacing: 5) {
                        Text(day.date).font(.system(size: 18, weight: .semibold, design: .serif)).foregroundColor(palette.ink).lineLimit(1).minimumScaleFactor(0.8)
                        Text([day.weekday, day.parasha].compactMap { $0 }.joined(separator: " · "))
                            .font(.system(size: 15)).foregroundColor(palette.muted).lineLimit(1).minimumScaleFactor(0.85)
                    }
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity, alignment: .center)
                    KZGoldRule(palette: palette).padding(.vertical, 1)
                    // The next three zmanim in sequence (Shabbat's candles and havdalah among them), in three equal
                    // columns — no gap, nothing unrelated between them. Each column's label and time share one centre,
                    // and the three labels share one size (smaller when any of them is long, so none shrinks alone).
                    let labelSize: CGFloat = state.upcoming.contains { $0.name.count > 8 } ? 13 : 15
                    HStack(alignment: .top, spacing: 8) {
                        ForEach(Array(state.upcoming.enumerated()), id: \.offset) { _, zman in
                            Link(destination: URL(string: zman.key == "candles" || zman.key == "havdalah" ? "kzohaar://open/parasha" : "kzohaar://open/zmanim")!) {
                                KZLabeledTime(label: zman.name, time: snapshot.time(zman.at), palette: palette, large: 21, labelSize: labelSize, labelScale: 0.72, alignment: .center)
                                    .frame(maxWidth: .infinity, alignment: .center)
                            }
                            .frame(maxWidth: .infinity)
                        }
                        ForEach(0..<max(0, 3 - state.upcoming.count), id: \.self) { _ in Color.clear.frame(maxWidth: .infinity, maxHeight: 1) }
                    }
                    if let first = day.tzaddik.first {
                        Text("נר ה׳ · \(first)\(day.tzaddikCount > 1 ? " ועוד \(day.tzaddikCount - 1)" : "")")
                            .font(.system(size: 15)).foregroundColor(palette.gold).lineLimit(1).minimumScaleFactor(0.8)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
                Link(destination: URL(string: "kzohaar://open/ring")!) {
                    VStack(spacing: 4) {
                        KZRing(value: state.ring, goal: state.goal, size: 62, palette: palette)
                        Text("מתוך \(state.goal)").font(.system(size: 15)).foregroundColor(palette.muted).monospacedDigit()
                    }
                }
            }
            .widgetURL(URL(string: "kzohaar://open/today"))
        } else {
            KZOpenApp(palette: palette).widgetURL(URL(string: "kzohaar://open/today"))
        }
    }
}

// MARK: - Lock screen (and StandBy / the Smart Stack on iPhone)

private struct KZAccessoryView: View {
    let entry: KZEntry
    let family: WidgetFamily
    var body: some View {
        let state = entry.state
        let snapshot = entry.snapshot
        switch family {
        case .accessoryCircular:
            Gauge(value: Double(state?.ring ?? 0), in: 0...Double(state?.goal ?? 26)) {
                Text("מעגל")
            } currentValueLabel: {
                Text("\(state?.ring ?? 0)").monospacedDigit()
            }
            .gaugeStyle(.accessoryCircularCapacity)
            .tint(KZPalette.progressLight)
            .accessibilityLabel("המעגל הרוחני: \(state?.ring ?? 0) מתוך \(state?.goal ?? 26)")
            .widgetURL(URL(string: "kzohaar://open/ring"))
        case .accessoryInline:
            if let snapshot, let next = state?.next, let day = state?.day {
                Text("\(next.name) \(snapshot.time(next.at)) · \(day.dayMonth)")
            } else {
                Text("כזוהר הרקיע")
            }
        default:
            if let snapshot, let state, let day = state.day, !state.stale {
                VStack(alignment: .leading, spacing: 1) {
                    Text(day.dayMonth).font(.headline).widgetAccentable()
                    if let next = state.next { Text("\(next.name) \(snapshot.time(next.at))").monospacedDigit() }
                    if let parasha = day.parasha { Text(parasha).foregroundStyle(.secondary) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .widgetURL(URL(string: "kzohaar://open/zmanim"))
            } else {
                Text("פתחו את כזוהר הרקיע")
            }
        }
    }
}

// MARK: - The widget

struct KZWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    let entry: KZEntry

    var body: some View {
        let palette = KZPalette.of(scheme)
        Group {
            switch family {
            case .systemSmall: KZSmallView(entry: entry, palette: palette)
            case .systemMedium: KZMediumView(entry: entry, palette: palette)
            default: KZAccessoryView(entry: entry, family: family)
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
        .containerBackground(for: .widget) {
            if family == .systemSmall || family == .systemMedium {
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

struct KZTodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "KZToday", provider: KZProvider()) { entry in
            KZWidgetView(entry: entry)
        }
        .configurationDisplayName("כזוהר הרקיע · היום")
        .description("התאריך העברי, שלושת הזמנים הבאים (כניסת שבת וצאת שבת ביניהם), פרשת השבוע, המעגל הרוחני והצדיק של היום.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

@main
struct KZWidgetsBundle: WidgetBundle {
    var body: some Widget {
        KZTodayWidget()
        // The second set (KZMoreWidgets.swift): זמנים ומזג אוויר, התפילה הבאה, רביעיית תפילות, אכלתי בשרי, דברי חכמים,
        // ספירת העומר, שבת קודש.
        KZZmanimWeatherWidget()
        KZNextPrayerWidget()
        KZQuartetWidget()
        KZMeatWidget()
        KZSayingsWidget()
        KZOmerWidget()
        KZShabbatWidget()
        // התבודדות on the Lock Screen and in the Dynamic Island (KZHitbodedutLiveActivity.swift).
        KZHitbodedutLiveActivity()
    }
}

// MARK: - The gallery preview before the app has written a snapshot (illustrative only; never shown as real data)

enum KZSample {
    static let snapshot: KZSnapshot? = {
        let now = Date().timeIntervalSince1970 * 1000
        let json = """
        {"v":1,"generatedAt":\(now),"validUntil":\(now + 86_400_000),"place":"","tzid":"\(TimeZone.current.identifier)",
         "days":[{"key":"","from":\(now - 3_600_000),"to":\(now + 86_400_000),"date":"כזוהר הרקיע","dayMonth":"כזוהר הרקיע","weekday":"זמני היום","parasha":null,"tzaddik":[],"tzaddikCount":0,"omer":0}],
         "zmanim":[{"key":"sunset","name":"שקיעה","at":\(now + 3_600_000)}],
         "shabbat":[],"ring":{"active":18,"goal":26,"completedThisWeek":0,"lifetime":0,"until":\(now + 86_400_000)},"omer":null}
        """
        return try? JSONDecoder().decode(KZSnapshot.self, from: Data(json.utf8))
    }()
}
