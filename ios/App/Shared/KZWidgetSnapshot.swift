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
        if writeKeychain(data) { saved = true }
        return saved
    }

    static func read() -> KZSnapshot? {
        let decoder = JSONDecoder()
        let fromGroup = groupDefaults?.data(forKey: defaultsKey).flatMap { try? decoder.decode(KZSnapshot.self, from: $0) }
        let fromKeychain = readKeychain().flatMap { try? decoder.decode(KZSnapshot.self, from: $0) }
        switch (fromGroup, fromKeychain) {
        case let (a?, b?): return a.generatedAt >= b.generatedAt ? a : b
        case let (a?, nil): return a
        case let (nil, b?): return b
        default: return nil
        }
    }

    private static func baseQuery() -> [String: Any]? {
        guard let group = keychainGroup else { return nil }
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: group,
        ]
    }

    private static func writeKeychain(_ data: Data) -> Bool {
        guard let query = baseQuery() else { return false }
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

    private static func readKeychain() -> Data? {
        guard var query = baseQuery() else { return nil }
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }
}
