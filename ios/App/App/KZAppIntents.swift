import Foundation
#if canImport(AppIntents)
import AppIntents

// Siri and Shortcuts (iOS 16+). The answers come from the on-device snapshot (KZSharedStore) — no network, nothing sent.
// Phrases are Hebrew (the app's development language); every phrase must name the app, as Apple requires.
//   "מה מברכים ב<כזוהר הרקיע>"         → asks "על מה?", then opens the blessings engine with the words searched
//   "ספירת העומר ב<כזוהר הרקיע>"        → "היום 13 לעומר · נותרו 36 ימים" (or when the count begins)
//   "<שקיעה> ב<כזוהר הרקיע>"           → "שקיעה היום בשעה 18:27" (any of the listed zmanim, or כניסת שבת)
//   "הזמן הבא ב<כזוהר הרקיע>"          → the next zman and its time

@available(iOS 16.0, *)
enum KZIntentText {
    static let missing = "פתחו את כזוהר הרקיע פעם אחת כדי לחשב את זמני היום"
}

@available(iOS 16.0, *)
enum KZZmanChoice: String, AppEnum {
    case sunset, tzeit85deg, sunrise, alotHaShachar, chatzot, sofZmanShma, sofZmanTfilla, minchaGedola, plagHaMincha, candles

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "זמן"
    static var caseDisplayRepresentations: [KZZmanChoice: DisplayRepresentation] = [
        .sunset: "שקיעה",
        .tzeit85deg: "צאת הכוכבים",
        .sunrise: "הנץ החמה",
        .alotHaShachar: "עלות השחר",
        .chatzot: "חצות היום",
        .sofZmanShma: "סוף זמן קריאת שמע",
        .sofZmanTfilla: "סוף זמן תפילה",
        .minchaGedola: "מנחה גדולה",
        .plagHaMincha: "פלג המנחה",
        .candles: "כניסת שבת",
    ]
}

@available(iOS 16.0, *)
struct KZZmanIntent: AppIntent {
    static var title: LocalizedStringResource = "זמן היום"
    static var description = IntentDescription("זמן מזמני היום לפי המיקום השמור באפליקציה, בלי רשת.")

    @Parameter(title: "זמן", default: .sunset) var zman: KZZmanChoice

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = KZSharedStore.read() else { return .result(dialog: IntentDialog(stringLiteral: KZIntentText.missing)) }
        let now = Date()
        let name = KZZmanChoice.caseDisplayRepresentations[zman].map { String(localized: $0.title) } ?? ""
        if zman == .candles {
            guard let shabbat = snapshot.state(at: now).shabbat, let candles = shabbat.candles else { return .result(dialog: IntentDialog(stringLiteral: KZIntentText.missing)) }
            let text = candles > KZSnapshot.ms(now) ? "כניסת שבת בשעה \(snapshot.time(candles))" : "צאת השבת בשעה \(snapshot.time(shabbat.havdalah))"
            return .result(dialog: IntentDialog(stringLiteral: text))
        }
        guard let next = snapshot.zmanim.first(where: { $0.key == zman.rawValue && $0.at > KZSnapshot.ms(now) }) else {
            return .result(dialog: IntentDialog(stringLiteral: KZIntentText.missing))
        }
        let sameDay = Calendar.current.isDate(KZSnapshot.date(next.at), inSameDayAs: now)
        return .result(dialog: IntentDialog(stringLiteral: "\(name) \(sameDay ? "היום" : "מחר") בשעה \(snapshot.time(next.at))"))
    }
}

@available(iOS 16.0, *)
struct KZNextZmanIntent: AppIntent {
    static var title: LocalizedStringResource = "הזמן הבא"
    static var description = IntentDescription("הזמן הבא מזמני היום, לפי המיקום השמור באפליקציה.")

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = KZSharedStore.read(), let next = snapshot.state(at: Date()).next else {
            return .result(dialog: IntentDialog(stringLiteral: KZIntentText.missing))
        }
        return .result(dialog: IntentDialog(stringLiteral: "\(next.name) בשעה \(snapshot.time(next.at))"))
    }
}

@available(iOS 16.0, *)
struct KZOmerIntent: AppIntent {
    static var title: LocalizedStringResource = "ספירת העומר"
    static var description = IntentDescription("כמה ימים לעומר היום, וכמה נותרו.")

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = KZSharedStore.read() else { return .result(dialog: IntentDialog(stringLiteral: KZIntentText.missing)) }
        return .result(dialog: IntentDialog(stringLiteral: snapshot.omerAnswer(at: Date())))
    }
}

@available(iOS 16.0, *)
struct KZBlessingIntent: AppIntent {
    static var title: LocalizedStringResource = "מה מברכים"
    static var description = IntentDescription("פותח את מנוע הברכות עם המאכל או המשקה.")
    static var openAppWhenRun = true

    @Parameter(title: "מאכל או משקה", requestValueDialog: IntentDialog("על מה?")) var food: String

    @MainActor
    func perform() async throws -> some IntentResult {
        var components = URLComponents()
        components.scheme = "kzohaar"
        components.host = "open"
        components.path = "/brachot"
        components.queryItems = [URLQueryItem(name: "q", value: String(food.prefix(80)))]
        KZWidgetsPlugin.open(components.url?.absoluteString ?? "kzohaar://open/brachot")
        return .result()
    }
}

@available(iOS 16.0, *)
struct KZOpenZmanimIntent: AppIntent {
    static var title: LocalizedStringResource = "פתיחת זמני היום"
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        KZWidgetsPlugin.open("kzohaar://open/zmanim")
        return .result()
    }
}

// התבודדות — opens the quiet-time screen. Meant also for a Focus automation ("when the Focus התבודדות turns on"), so
// turning the Focus on brings the session's screen; the Focus itself is the system's, the app never changes it.
@available(iOS 16.0, *)
struct KZStartHitbodedutIntent: AppIntent {
    static var title: LocalizedStringResource = "התחל התבודדות"
    static var description = IntentDescription("פותח את מסך ההתבודדות בכזוהר הרקיע.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        KZWidgetsPlugin.open("kzohaar://open/hitbodedut")
        return .result()
    }
}

@available(iOS 16.0, *)
struct KZAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: KZBlessingIntent(), phrases: [
            "מה מברכים ב\(.applicationName)",
            "איזו ברכה ב\(.applicationName)",
        ], shortTitle: "מה מברכים", systemImageName: "leaf")
        AppShortcut(intent: KZOmerIntent(), phrases: [
            "ספירת העומר ב\(.applicationName)",
            "כמה נשאר לספירה ב\(.applicationName)",
        ], shortTitle: "ספירת העומר", systemImageName: "calendar")
        AppShortcut(intent: KZZmanIntent(), phrases: [
            "\(\.$zman) ב\(.applicationName)",
            "זמן \(\.$zman) ב\(.applicationName)",
            "זמן שקיעה ב\(.applicationName)",
        ], shortTitle: "זמן היום", systemImageName: "sunset")
        AppShortcut(intent: KZNextZmanIntent(), phrases: [
            "הזמן הבא ב\(.applicationName)",
        ], shortTitle: "הזמן הבא", systemImageName: "clock")
        AppShortcut(intent: KZOpenZmanimIntent(), phrases: [
            "זמני היום ב\(.applicationName)",
        ], shortTitle: "זמני היום", systemImageName: "sun.horizon")
        AppShortcut(intent: KZStartHitbodedutIntent(), phrases: [
            "התחל התבודדות ב\(.applicationName)",
            "התבודדות ב\(.applicationName)",
        ], shortTitle: "התחל התבודדות", systemImageName: "water.waves")
    }
}
#endif
