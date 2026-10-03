import SwiftUI
import WidgetKit

// "כזוהר הרקיע" on the home screen (small, medium; StandBy shows the small one) and on the lock screen (circular: the
// spiritual ring; rectangular and inline: the date and the next zman). Everything is read from the snapshot the app
// wrote (KZSharedStore); the timeline has an entry at every instant something changes (each zman, each sunset, the end
// of the ring's week, havdalah), so "the next zman" advances on time without the app being opened.

// MARK: - Palette: the app's CLAY material (src/styles/clay/tokens.css; docs/design-system.md › CLAY)

extension Color {
    init(kzHex hex: UInt32, _ opacity: Double = 1) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255, opacity: opacity)
    }
}

/// One palette of the clay, as the app's eight (tokens.css): the card's two stops (lit upper left → lower right), the
/// well and the sunk ground, the raised control, the words (ink, muted, copper — every one AA on every stop), the
/// palette's gold (ornaments and arrows only — base.css --gold) and the light and shade, tinted with the palette's own
/// shade. The widgets follow the system's light / dark; the palette the user chose in the app (written into the
/// snapshot, "palette") is used when it is of the same kind (a light palette by day, כהה or זהב לילי by night) —
/// otherwise בהיר (light) or כהה (dark).
struct KZPalette {
    let cardA: Color, cardB: Color, well: Color, sunk: Color, controlA: Color, controlB: Color
    let ink: Color, muted: Color, copper: Color, gold: Color
    let edgeHi: Color, edgeLo: Color, drop: Color, sink: Color, sinkHi: Color, halo: Color
    var isDark = false
    // The ring's track stays gold, quiet.
    var track: Color { gold.opacity(isDark ? 0.26 : 0.24) }
    // The ONE colour of the spiritual circle's progress, as in the app (src/services/progressColor.mjs): royal blue
    // #2A55D0, and in the dark #789CF8 (the same royal blue, lighter for a dark ground). The track stays gold.
    static let progressLight = Color(red: 42 / 255, green: 85 / 255, blue: 208 / 255)
    static let progressDark = Color(red: 120 / 255, green: 156 / 255, blue: 248 / 255)
    var progress: Color { isDark ? KZPalette.progressDark : KZPalette.progressLight }

    static let lightIDs: Set<String> = ["light", "sage", "blue", "plum", "coral", "teal"]
    static let darkIDs: Set<String> = ["dark", "amber"]

    static func of(_ scheme: ColorScheme, _ id: String? = nil) -> KZPalette {
        let chosen = id ?? ""
        if scheme == .dark { return named(darkIDs.contains(chosen) ? chosen : "dark") }
        return named(lightIDs.contains(chosen) ? chosen : "light")
    }

    // tokens.css, palette by palette (card a/b, well, sunk, control a/b, text, text-muted, copper; gold = base.css --gold).
    static func named(_ id: String) -> KZPalette {
        switch id {
        case "dark":
            return night(card: (0x272A30, 0x1E2127), well: 0x101216, sunk: 0x181B21, control: (0x303238, 0x23262B), ink: 0xF1EDE6, muted: 0xA7AAB2, copper: 0xD4915F)
        case "amber":
            return night(card: (0x2F2B38, 0x262230), well: 0x16131D, sunk: 0x201C2A, control: (0x373340, 0x2A2734), ink: 0xFFF6DC, muted: 0xC9BFA6, copper: 0xE1A83B)
        case "sage":
            return day(card: (0xF9FBF8, 0xF0F4EE), well: 0xDFE6DC, sunk: 0xDAE1D8, control: (0xFCFDFC, 0xEFF3ED), ink: 0x223027, muted: 0x56645A, copper: 0x3F634B, gold: 0xA78B34, shade: 0x2C4433)
        case "blue":
            return day(card: (0xF9FAFC, 0xEFF3F7), well: 0xDDE4EA, sunk: 0xD8E0E6, control: (0xFCFDFE, 0xEEF2F6), ink: 0x1D2933, muted: 0x51626F, copper: 0x325A77, gold: 0xA1883D, shade: 0x24394B)
        case "plum":
            return day(card: (0xFBF9FA, 0xF5F0F3), well: 0xE7DFE5, sunk: 0xE2DAE1, control: (0xFDFCFD, 0xF4EFF2), ink: 0x302530, muted: 0x685A68, copper: 0x6A4A63, gold: 0xAD8738, shade: 0x45304A)
        case "coral":
            return day(card: (0xFEFAF8, 0xFCF2EE), well: 0xF3E2DC, sunk: 0xF0DDD7, control: (0xFFFDFC, 0xFCF1ED), ink: 0x3B2422, muted: 0x735552, copper: 0xA73F37, gold: 0xB88831, shade: 0x6E3528)
        case "teal":
            return day(card: (0xF8FCFB, 0xEDF7F5), well: 0xDAEAE7, sunk: 0xD5E5E3, control: (0xFCFEFD, 0xECF6F4), ink: 0x173B3D, muted: 0x4C6566, copper: 0x06696D, gold: 0x9E8E3B, shade: 0x1C4A4A)
        default: // בהיר — ivory porcelain, copper
            return day(card: (0xFBF9F5, 0xF4EFE8), well: 0xE8E0D3, sunk: 0xE5DCCF, control: (0xFDFCFB, 0xF3EEE6), ink: 0x241E17, muted: 0x695F51, copper: 0x96491F, gold: 0xB8912F, shade: 0x6E502D)
        }
    }

    private static func day(card: (UInt32, UInt32), well: UInt32, sunk: UInt32, control: (UInt32, UInt32), ink: UInt32, muted: UInt32, copper: UInt32, gold: UInt32, shade: UInt32) -> KZPalette {
        KZPalette(cardA: Color(kzHex: card.0), cardB: Color(kzHex: card.1), well: Color(kzHex: well), sunk: Color(kzHex: sunk),
                  controlA: Color(kzHex: control.0), controlB: Color(kzHex: control.1),
                  ink: Color(kzHex: ink), muted: Color(kzHex: muted), copper: Color(kzHex: copper), gold: Color(kzHex: gold),
                  edgeHi: Color.white.opacity(0.95), edgeLo: Color(kzHex: shade, 0.1), drop: Color(kzHex: shade, 0.26),
                  sink: Color(kzHex: shade, 0.2), sinkHi: Color.white.opacity(0.75), halo: Color.white.opacity(0.66))
    }

    private static func night(card: (UInt32, UInt32), well: UInt32, sunk: UInt32, control: (UInt32, UInt32), ink: UInt32, muted: UInt32, copper: UInt32) -> KZPalette {
        KZPalette(cardA: Color(kzHex: card.0), cardB: Color(kzHex: card.1), well: Color(kzHex: well), sunk: Color(kzHex: sunk),
                  controlA: Color(kzHex: control.0), controlB: Color(kzHex: control.1),
                  ink: Color(kzHex: ink), muted: Color(kzHex: muted), copper: Color(kzHex: copper), gold: Color(kzHex: 0xD4B25A),
                  edgeHi: Color.white.opacity(0.09), edgeLo: Color.black.opacity(0.3), drop: Color.black.opacity(0.62),
                  sink: Color.black.opacity(0.58), sinkHi: Color.white.opacity(0.05), halo: Color.white.opacity(0.04), isDark: true)
    }
}

// MARK: - The material: the card, wells, raised bodies, the chosen and the current (CLAY › Layers, States)

// The light is fixed at the upper left (absolute points, so a right-to-left layout never turns it).
let kzLit = UnitPoint(x: 0, y: 0)
let kzShade = UnitPoint(x: 1, y: 1)

/// The widget's own body — one clay card: the two stops lit from the upper left, a faint pool of light at the top,
/// a bright rim toward the light and a soft inner shade away from it. (A widget cannot cast a shadow onto the wallpaper,
/// so its volume is all inside: the rim and the shade.)
struct KZClayBackground: View {
    let palette: KZPalette
    var body: some View {
        ZStack {
            LinearGradient(colors: [palette.cardA, palette.cardB], startPoint: kzLit, endPoint: kzShade)
            RadialGradient(colors: [palette.halo, palette.halo.opacity(0)], center: UnitPoint(x: 0.1, y: 0), startRadius: 0, endRadius: 240)
            ContainerRelativeShape()
                .strokeBorder(LinearGradient(colors: [.clear, .clear, palette.edgeLo], startPoint: kzLit, endPoint: kzShade), lineWidth: 10)
                .blur(radius: 7)
            ContainerRelativeShape()
                .strokeBorder(LinearGradient(stops: [.init(color: palette.edgeHi, location: 0), .init(color: palette.edgeHi.opacity(0), location: 0.4),
                                                     .init(color: palette.edgeLo.opacity(0), location: 0.6), .init(color: palette.edgeLo, location: 1)],
                                             startPoint: kzLit, endPoint: kzShade), lineWidth: 1.25)
        }
    }
}

extension View {
    /// A well: secondary information sunk into the card (CLAY › Wells).
    func kzWell(_ palette: KZPalette, radius: CGFloat = 13) -> some View {
        background(
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(palette.well
                    .shadow(.inner(color: palette.sink, radius: 2.5, x: 1.5, y: 1.5))
                    .shadow(.inner(color: palette.sinkHi, radius: 2, x: -1.5, y: -1.5)))
        )
    }

    /// A raised body on the card (a door, a button): lit rim, inner shade, a soft shadow to the lower right.
    func kzRaised(_ palette: KZPalette, radius: CGFloat = 14) -> some View {
        background(
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(LinearGradient(colors: [palette.controlA, palette.controlB], startPoint: kzLit, endPoint: kzShade)
                    .shadow(.inner(color: palette.edgeHi, radius: 0.5, x: 1, y: 1))
                    .shadow(.inner(color: palette.edgeLo, radius: 3, x: -1.5, y: -2)))
                .shadow(color: palette.drop.opacity(0.75), radius: 4, x: 2, y: 3)
                .shadow(color: palette.halo, radius: 3, x: -1.5, y: -1.5)
        )
    }

    /// The chosen / the prayer of the hour (CLAY › States › Selected): sunk into the material with a thin copper
    /// outline in its own shape — never a filled colour, never a glow.
    func kzSelected(_ palette: KZPalette, radius: CGFloat = 14) -> some View {
        background(
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(palette.sunk
                    .shadow(.inner(color: palette.sink, radius: 2.5, x: 1.5, y: 1.5))
                    .shadow(.inner(color: palette.sinkHi, radius: 2, x: -1.5, y: -1.5)))
        )
        .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(palette.copper.opacity(0.9), lineWidth: 1))
    }

    /// The current, not chosen (the next zman, the deadline that runs now): a thin copper outline only — no fill.
    func kzCurrent(_ palette: KZPalette, radius: CGFloat = 9) -> some View {
        overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(palette.copper.opacity(0.8), lineWidth: 1))
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

/// A raised clay disc — the plate the circle (and the Omer's count) stands on.
struct KZPlate: View {
    let palette: KZPalette
    var body: some View {
        Circle()
            .fill(LinearGradient(colors: [palette.controlA, palette.controlB], startPoint: kzLit, endPoint: kzShade)
                .shadow(.inner(color: palette.edgeHi, radius: 0.5, x: 1, y: 1))
                .shadow(.inner(color: palette.edgeLo, radius: 3, x: -1.5, y: -2)))
            .shadow(color: palette.drop.opacity(0.75), radius: 3.5, x: 1.5, y: 2.5)
            .shadow(color: palette.halo, radius: 2.5, x: -1.5, y: -1.5)
    }
}

/// The sunken centre of a plate.
struct KZHollow: View {
    let palette: KZPalette
    var body: some View {
        Circle().fill(palette.well
            .shadow(.inner(color: palette.sink, radius: 2, x: 1, y: 1.5))
            .shadow(.inner(color: palette.sinkHi, radius: 1.5, x: -1, y: -1)))
    }
}

/// The spiritual circle as in the app's Clay (ring.css): a raised plate, the gold band with the royal-blue ribbon on
/// it, a sunken centre with the count.
struct KZRing: View {
    let value: Int
    let goal: Int
    let size: CGFloat
    let palette: KZPalette
    var body: some View {
        let progress = min(1, max(0, Double(value) / Double(max(1, goal))))
        let band = size * 0.1
        ZStack {
            KZPlate(palette: palette)
            ZStack {
                Circle().stroke(palette.track, lineWidth: band)
                Circle().trim(from: 0, to: progress)
                    .stroke(LinearGradient(colors: [palette.progress.opacity(0.8), palette.progress], startPoint: .top, endPoint: .bottom),
                            style: StrokeStyle(lineWidth: band, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            .padding(size * 0.11)
            KZHollow(palette: palette).padding(size * 0.2)
            Text("\(value)")
                .font(.system(size: size * 0.29, weight: .medium, design: .serif))
                .monospacedDigit()
                .foregroundColor(palette.ink)
                .minimumScaleFactor(0.7)
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("המעגל הרוחני: \(value) מתוך \(goal)")
    }
}

/// The gold inlay of a rule: a hairline fading toward the outer edge, with a bright lip under it toward the light.
struct KZInlay: View {
    let palette: KZPalette
    let outerOnLeft: Bool
    var body: some View {
        Rectangle()
            .fill(LinearGradient(colors: outerOnLeft ? [palette.gold.opacity(0), palette.gold.opacity(0.75)] : [palette.gold.opacity(0.75), palette.gold.opacity(0)],
                                 startPoint: UnitPoint(x: 0, y: 0.5), endPoint: UnitPoint(x: 1, y: 0.5)))
            .frame(height: 0.75)
            .shadow(color: palette.edgeHi.opacity(palette.isDark ? 1 : 0.9), radius: 0, x: 0, y: 0.75)
    }
}

/// The small raised gold diamond at the centre of a rule.
struct KZGem: View {
    let palette: KZPalette
    var size: CGFloat = 5
    var body: some View {
        Rectangle()
            .fill(LinearGradient(colors: [palette.gold.opacity(0.72), palette.gold], startPoint: kzLit, endPoint: kzShade))
            .frame(width: size, height: size)
            .shadow(color: palette.drop, radius: 0.8, x: 0.5, y: 1)
            .rotationEffect(.degrees(45))
    }
}

/// The gold rule under a header: two inlaid hairlines and the raised diamond, mirror-equal.
struct KZGoldRule: View {
    let palette: KZPalette
    var body: some View {
        HStack(spacing: 6) {
            KZInlay(palette: palette, outerOnLeft: true)
            KZGem(palette: palette)
            KZInlay(palette: palette, outerOnLeft: false)
        }
        .environment(\.layoutDirection, .leftToRight)
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
            Text(time).font(.system(size: large, weight: .medium, design: .rounded)).monospacedDigit().foregroundColor(palette.ink).lineLimit(1)
        }
        .multilineTextAlignment(alignment == .center ? .center : .leading)
        .accessibilityElement(children: .combine)
    }
}

struct KZOpenApp: View {
    let palette: KZPalette
    var body: some View {
        VStack(spacing: 6) {
            Text("כזוהר הרקיע").font(.system(size: 17, weight: .regular, design: .serif)).foregroundColor(palette.copper)
            KZGoldRule(palette: palette).frame(width: 90)
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
            VStack(alignment: .center, spacing: 7) {
                HStack(alignment: .center, spacing: 6) {
                    // The date and the day, centred in their block (as in every widget's header).
                    VStack(alignment: .center, spacing: 1) {
                        Text(day.dayMonth).font(.system(size: 17, weight: .regular, design: .serif)).foregroundColor(palette.ink).lineLimit(1).minimumScaleFactor(0.8)
                        Text(day.weekday).font(.system(size: 15)).foregroundColor(palette.muted).lineLimit(1)
                    }
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity, alignment: .center)
                    KZRing(value: state.ring, goal: state.goal, size: 46, palette: palette)
                }
                KZGoldRule(palette: palette)
                Spacer(minLength: 0)
                if let next = state.next {
                    // The next zman in a well, its label over its time on the widget's own axis.
                    KZLabeledTime(label: next.name, time: snapshot.time(next.at), palette: palette, large: 30, alignment: .center)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 5)
                        .kzWell(palette)
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
                VStack(alignment: .center, spacing: 5) {
                    // The header — the Jewish date, then the day and the week's reading — centred in its block, on the
                    // same axis as the three zmanim columns below it.
                    VStack(alignment: .center, spacing: 1) {
                        Text(day.date).font(.system(size: 18, weight: .regular, design: .serif)).foregroundColor(palette.ink).lineLimit(1).minimumScaleFactor(0.8)
                        Text([day.weekday, day.parasha].compactMap { $0 }.joined(separator: " · "))
                            .font(.system(size: 15)).foregroundColor(palette.muted).lineLimit(1).minimumScaleFactor(0.85)
                    }
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity, alignment: .center)
                    KZGoldRule(palette: palette).padding(.horizontal, 10)
                    // The next three zmanim in sequence (Shabbat's candles and havdalah among them), in three equal
                    // columns sunk in one well — no gap, nothing unrelated between them. Each column's label and time
                    // share one centre, and the three labels share one size (smaller when any of them is long, so none
                    // shrinks alone).
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
                    .padding(.vertical, 4)
                    .padding(.horizontal, 4)
                    .kzWell(palette)
                    if let first = day.tzaddik.first {
                        Text("נר ה׳ · \(first)\(day.tzaddikCount > 1 ? " ועוד \(day.tzaddikCount - 1)" : "")")
                            .font(.system(size: 14)).foregroundColor(palette.copper).lineLimit(1).minimumScaleFactor(0.8)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
                Link(destination: URL(string: "kzohaar://open/ring")!) {
                    VStack(spacing: 5) {
                        KZRing(value: state.ring, goal: state.goal, size: 66, palette: palette)
                        Text(verbatim: "מתוך \(state.goal)").font(.system(size: 14)).foregroundColor(palette.muted).monospacedDigit()
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
// Monochrome by the system: no material here — the words centred, the date the one accent.

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
                VStack(alignment: .center, spacing: 1) {
                    Text(day.dayMonth).font(.system(size: 15, weight: .medium)).widgetAccentable()
                    if let next = state.next { Text("\(next.name) \(snapshot.time(next.at))").monospacedDigit().lineLimit(1).minimumScaleFactor(0.8) }
                    if let parasha = day.parasha { Text(parasha).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.8) }
                }
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, alignment: .center)
                .widgetURL(URL(string: "kzohaar://open/zmanim"))
            } else {
                Text("פתחו את כזוהר הרקיע").frame(maxWidth: .infinity, alignment: .center)
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
        let palette = KZPalette.of(scheme, entry.snapshot?.palette)
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
                KZClayBackground(palette: palette)
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
