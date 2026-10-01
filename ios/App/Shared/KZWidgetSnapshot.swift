import Foundation
import Security

// The snapshot the web app computes (src/services/widgetSnapshot.mjs) and the widget, the lock-screen accessories and
// Siri read. Compiled into the app and into the widget extension. Instants are epoch milliseconds; every text is
// ready Hebrew. The rules of `state(at:)` are the same as widgetStateAt() in JavaScript (pinned by
// tests/widgetSnapshot.test.mjs): the Jewish day that contains the instant, the first zman after it, the first
// Shabbat whose havdalah is still ahead, and the ring (empty once the week has ended at Motzaei Shabbat).
struct KZSnapshot: Codable {
    struct Day: Codable {
        let key: String
        let from: Double
        let to: Double
        let date: String
        let dayMonth: String
        let weekday: String
        let parasha: String?
        let tzaddik: [String]
        let tzaddikCount: Int
        let omer: Int
    }
    struct Zman: Codable {
        let key: String
        let name: String
        let at: Double
    }
    struct Shabbat: Codable {
        let key: String
        let candles: Double?
        let havdalah: Double
        let rabbenuTam: Double?
        let parasha: String?
    }
    struct Ring: Codable {
        let active: Int
        let goal: Int
        let completedThisWeek: Int
        let lifetime: Int
        let until: Double?
    }
    struct Omer: Codable {
        let startsAt: Double?
    }
    // The prayer of the hour (prayerWindows() in JavaScript): its window, when it properly begins, its deadlines.
    struct Mark: Codable {
        let name: String
        let at: Double
    }
    struct Prayer: Codable {
        let key: String
        let name: String
        let from: Double
        let to: Double
        let opens: Mark?
        let ends: [Mark]
    }
    // The app's last weather reading (Open-Meteo, read by the app) — the widget never fetches.
    struct Weather: Codable {
        let temp: Int
        let kind: String
        let label: String
        let high: Int?
        let low: Int?
        let at: Double
    }
    struct Saying: Codable {
        let id: String
        let text: String
        let source: String
    }
    struct Sayings: Codable {
        let from: Double
        let period: Double
        let items: [Saying]
    }

    let v: Int
    let generatedAt: Double
    let validUntil: Double
    let place: String
    let tzid: String
    let days: [Day]
    let zmanim: [Zman]
    let shabbat: [Shabbat]
    let ring: Ring
    let omer: Omer?
    // Added with the second set of widgets; optional so an older snapshot still reads.
    let prayers: [Prayer]?
    let weather: Weather?
    let sayings: Sayings?
    let meat: KZMeat?

    struct State {
        let day: Day?
        let next: Zman?
        let shabbat: Shabbat?
        let ring: Int
        let goal: Int
        let stale: Bool
    }

    static func ms(_ date: Date) -> Double { date.timeIntervalSince1970 * 1000 }
    static func date(_ ms: Double) -> Date { Date(timeIntervalSince1970: ms / 1000) }

    func state(at date: Date) -> State {
        let t = KZSnapshot.ms(date)
        let ringValue = t < (ring.until ?? 0) ? ring.active : 0
        return State(
            day: days.first { t >= $0.from && t < $0.to },
            next: zmanim.first { $0.at > t },
            shabbat: shabbat.first { $0.havdalah > t },
            ring: ringValue,
            goal: max(1, ring.goal),
            stale: t >= validUntil
        )
    }

    // The instants at which what the widget shows changes: every zman, every sunset, the end of the ring's week, the
    // end of a Shabbat — from `from` on, at most `limit` of them.
    func changes(after from: Date, limit: Int) -> [Date] {
        let t = KZSnapshot.ms(from)
        var instants = Set<Double>()
        zmanim.forEach { if $0.at > t { instants.insert($0.at) } }
        days.forEach { if $0.to > t { instants.insert($0.to) } }
        shabbat.forEach { if $0.havdalah > t { instants.insert($0.havdalah) } }
        if let until = ring.until, until > t { instants.insert(until) }
        if validUntil > t { instants.insert(validUntil) }
        return instants.sorted().prefix(limit).map { KZSnapshot.date($0) }
    }

    // The prayer of the hour — the same rule as prayerStateAt() in JavaScript.
    struct PrayerState {
        let current: Prayer
        let deadline: Mark?
        let opens: Mark?
        let next: Prayer?
    }
    func prayerState(at date: Date) -> PrayerState? {
        let t = KZSnapshot.ms(date)
        let list = prayers ?? []
        guard let index = list.firstIndex(where: { t >= $0.from && t < $0.to }) else { return nil }
        let current = list[index]
        return PrayerState(current: current, deadline: current.ends.first { $0.at > t },
                           opens: (current.opens?.at ?? 0) > t ? current.opens : nil,
                           next: index + 1 < list.count ? list[index + 1] : nil)
    }

    // Weather — weatherStateAt(): dimmed after three hours, gone after twelve.
    func weatherState(at date: Date) -> (weather: Weather, dim: Bool)? {
        guard let weather else { return nil }
        let age = KZSnapshot.ms(date) - weather.at
        if age >= 12 * 3_600_000 { return nil }
        return (weather, age >= 3 * 3_600_000)
    }

    // The saying of the three-hour slot — sayingStateAt(): past the carried slots, the same ones again.
    func saying(at date: Date) -> (saying: Saying, until: Double)? {
        guard let sayings, !sayings.items.isEmpty, sayings.period > 0 else { return nil }
        let slot = Int(floor((KZSnapshot.ms(date) - sayings.from) / sayings.period))
        let count = sayings.items.count
        return (sayings.items[((slot % count) + count) % count], sayings.from + Double(slot + 1) * sayings.period)
    }

    // The instants the second set of widgets change at: every prayer boundary and deadline, the saying slots, the
    // weather dimming and going, and the meat wait's end and rest.
    func moreChanges(after from: Date, meat: KZMeat?, limit: Int) -> [Date] {
        let t = KZSnapshot.ms(from)
        var instants = Set(changes(after: from, limit: limit).map { KZSnapshot.ms($0) })
        for prayer in prayers ?? [] {
            [prayer.from, prayer.to, prayer.opens?.at ?? 0].forEach { if $0 > t { instants.insert($0) } }
            prayer.ends.forEach { if $0.at > t { instants.insert($0.at) } }
        }
        if let sayings, sayings.period > 0 {
            var at = sayings.from + (floor((t - sayings.from) / sayings.period) + 1) * sayings.period
            while at < t + 2 * 86_400_000 { instants.insert(at); at += sayings.period }
        }
        if let weather { [weather.at + 3 * 3_600_000, weather.at + 12 * 3_600_000].forEach { if $0 > t { instants.insert($0) } } }
        if let state = meat?.state(at: from), state.phase != .idle { [state.end, state.restAt + 1000].forEach { if $0 > t { instants.insert($0) } } }
        return instants.sorted().prefix(limit).map { KZSnapshot.date($0) }
    }

    func time(_ ms: Double) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "he_IL")
        formatter.timeZone = TimeZone(identifier: tzid) ?? .current
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: KZSnapshot.date(ms))
    }

    // Siri: the Omer (the same words as omerAnswer() in JavaScript).
    func omerAnswer(at date: Date) -> String {
        guard let day = state(at: date).day else { return "פתחו את האפליקציה לעדכון הלוח" }
        if day.omer > 0 { return "היום \(day.omer) לעומר · נותרו \(49 - day.omer) ימים" }
        if let start = omer?.startsAt {
            let inDays = Int(ceil((start - KZSnapshot.ms(date)) / 86_400_000))
            if inDays == 1 { return "ספירת העומר מתחילה הערב" }
            if inDays > 1 { return "ספירת העומר מתחילה בעוד \(inDays) ימים" }
        }
        return "אין ספירת העומר היום"
    }
}

// אכלתי בשרי — the wait between meat and dairy. The app's state rides in the snapshot; the widget's own button writes the
// same record to the shared store (KZMeatStore). Whichever changed last wins (newerMeat() in JavaScript), and the app
// takes a newer widget record in on its next start or return (KZWidgetsPlugin.getMeatState).
struct KZMeat: Codable {
    let startedAt: Double?
    let hours: Int
    let preferred: Int?
    let updatedAt: Double

    enum Phase { case idle, waiting, done }
    struct State {
        let phase: Phase
        let hours: Int
        let start: Double
        let end: Double
        let restAt: Double
    }
    static let lingerMs: Double = 3 * 3_600_000

    // The same rule as meatStateAt() / meatDairyStatus(): waiting until start + hours, "אפשר חלבי" for three hours more.
    func state(at date: Date) -> State {
        let t = KZSnapshot.ms(date)
        let wait = [6, 3].contains(hours) ? hours : 6
        let rest = [6, 3].contains(preferred ?? 6) ? (preferred ?? 6) : 6
        guard let start = startedAt else { return State(phase: .idle, hours: rest, start: 0, end: 0, restAt: 0) }
        let end = start + Double(wait) * 3_600_000
        if t > end + KZMeat.lingerMs { return State(phase: .idle, hours: rest, start: 0, end: 0, restAt: 0) }
        return State(phase: t < end ? .waiting : .done, hours: wait, start: start, end: end, restAt: end + KZMeat.lingerMs)
    }

    static func newer(_ a: KZMeat?, _ b: KZMeat?) -> KZMeat? {
        guard let a else { return b }
        guard let b else { return a }
        return b.updatedAt > a.updatedAt ? b : a
    }
}

enum KZMeatStore {
    static let defaultsKey = "kz.widget.meat.v1"
    static let account = "meat-v1"
    // The card's reminder id (stableId('meat-dairy-wait') in JavaScript; Capacitor's request identifier is the number).
    static let reminderIdentifier = "887275348"

    static func read() -> KZMeat? {
        let decoder = JSONDecoder()
        let fromGroup = KZSharedStore.groupDefaults?.data(forKey: defaultsKey).flatMap { try? decoder.decode(KZMeat.self, from: $0) }
        let fromKeychain = KZSharedStore.readKeychain(account: account).flatMap { try? decoder.decode(KZMeat.self, from: $0) }
        return KZMeat.newer(fromGroup, fromKeychain)
    }

    @discardableResult
    static func write(_ meat: KZMeat) -> Bool {
        guard let data = try? JSONEncoder().encode(meat) else { return false }
        var saved = false
        if let defaults = KZSharedStore.groupDefaults { defaults.set(data, forKey: defaultsKey); saved = true }
        if KZSharedStore.writeKeychain(data, account: account) { saved = true }
        return saved
    }

    // What the widget, the button and the app go by: the newer of the app's (in the snapshot) and the widget's.
    static func effective(_ snapshot: KZSnapshot?) -> KZMeat? { KZMeat.newer(snapshot?.meat, read()) }
}

// Where the snapshot lives, shared by the app and its widget extension:
//   • the App Group's UserDefaults ("group.com.kzohaar.app") when the build carries that entitlement, and always
//   • one keychain item in the team's shared access group ("<Team ID>.com.kzohaar.shared") — this needs no App Group
//     (the personal-team provisioning profile already allows the team's keychain groups), so the widget works with the
//     owner's automatic signing either way. The reader takes the newer of the two.
// Nothing leaves the device: no iCloud keychain sync (kSecAttrSynchronizable is never set), no network.
enum KZSharedStore {
    static let appGroup = "group.com.kzohaar.app"
    static let defaultsKey = "kz.widget.snapshot.v1"
    static let service = "com.kzohaar.app.widget-snapshot"
    static let account = "snapshot-v1"

    static var keychainGroup: String? {
        guard let prefix = Bundle.main.object(forInfoDictionaryKey: "KZAppIdentifierPrefix") as? String, !prefix.isEmpty, !prefix.contains("$(") else { return nil }
        return "\(prefix)com.kzohaar.shared"
    }

    static var groupDefaults: UserDefaults? {
        guard FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) != nil else { return nil }
        return UserDefaults(suiteName: appGroup)
    }

    @discardableResult
    static func write(_ json: String) -> Bool {
        guard let data = json.data(using: .utf8), (try? JSONDecoder().decode(KZSnapshot.self, from: data)) != nil else { return false }
        var saved = false
        if let defaults = groupDefaults { defaults.set(data, forKey: defaultsKey); saved = true }
        if writeKeychain(data, account: account) { saved = true }
        return saved
    }

    static func read() -> KZSnapshot? {
        let decoder = JSONDecoder()
        let fromGroup = groupDefaults?.data(forKey: defaultsKey).flatMap { try? decoder.decode(KZSnapshot.self, from: $0) }
        let fromKeychain = readKeychain(account: account).flatMap { try? decoder.decode(KZSnapshot.self, from: $0) }
        switch (fromGroup, fromKeychain) {
        case let (a?, b?): return a.generatedAt >= b.generatedAt ? a : b
        case let (a?, nil): return a
        case let (nil, b?): return b
        default: return nil
        }
    }

    private static func baseQuery(account: String) -> [String: Any]? {
        guard let group = keychainGroup else { return nil }
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: group,
        ]
    }

    static func writeKeychain(_ data: Data, account: String) -> Bool {
        guard let query = baseQuery(account: account) else { return false }
        let attributes: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecSuccess { return true }
        if status == errSecItemNotFound {
            var add = query
            attributes.forEach { add[$0.key] = $0.value }
            return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
        }
        return false
    }

    static func readKeychain(account: String) -> Data? {
        guard var query = baseQuery(account: account) else { return nil }
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }
}
