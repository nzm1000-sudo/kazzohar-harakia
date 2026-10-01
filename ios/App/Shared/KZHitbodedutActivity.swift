import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif
#if canImport(AppIntents)
import AppIntents
#endif

// התבודדות on the Lock Screen and in the Dynamic Island (ActivityKit). Compiled into the app (which starts, updates and
// ends the activity — KZHitbodedutPlugin.swift) and into the KZWidgets extension (which draws it —
// KZHitbodedutLiveActivity.swift). The countdown is drawn by the system from `endsAt` (Text(timerInterval:)), so the
// app sends nothing while it runs: only on pause, resume and end.
//
// The buttons (iOS 17+) are LiveActivityIntents: they run in the app's process (launched in the background if needed),
// update the activity at once, and leave the action — with its instant — for the web page, which applies it to its
// own timer (src/services/hitbodedut/session.mjs). Nothing leaves the device.

#if canImport(ActivityKit)
@available(iOS 16.2, *)
struct KZHitbodedutAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// When the time is up (meaningful while running).
        var endsAt: Date
        var paused: Bool
        /// Seconds left, frozen while paused.
        var remaining: Double
    }
    var title: String
    var startedAt: Date
    var duration: Double
}
#endif

/// The actions taken outside the page (Live Activity buttons, the Lock Screen's play / pause) — kept until the page
/// takes them, each with an id (so one delivered twice is applied once) and the instant it happened.
enum KZHitbodedutActions {
    static let pendingKey = "kz.hitbodedut.pendingActions"
    static let notification = Notification.Name("KZHitbodedutAction")

    /// Set by the running app (KZHitbodedutPlugin) to act at once: the sound, and a live web page.
    static var handler: ((_ action: String, _ id: String, _ at: Date) -> Void)?

    static func record(_ action: String, at: Date) -> String {
        let id = UUID().uuidString
        var list = UserDefaults.standard.array(forKey: pendingKey) as? [[String: Any]] ?? []
        list.append(["action": action, "at": at.timeIntervalSince1970 * 1000, "id": id])
        UserDefaults.standard.set(Array(list.suffix(20)), forKey: pendingKey)
        return id
    }

    static func take() -> [[String: Any]] {
        let list = UserDefaults.standard.array(forKey: pendingKey) as? [[String: Any]] ?? []
        UserDefaults.standard.removeObject(forKey: pendingKey)
        return list
    }

    /// Applies an action everywhere it shows: the activity (at once), the pending list (for the page), the live app.
    static func apply(_ action: String, at now: Date = Date()) async {
        let id = record(action, at: now)
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) { await KZHitbodedutLive.apply(action, at: now) }
        #endif
        if let handler {
            await MainActor.run { handler(action, id, now) }
        }
    }
}

#if canImport(ActivityKit)
@available(iOS 16.2, *)
enum KZHitbodedutLive {
    static func apply(_ action: String, at now: Date) async {
        for activity in Activity<KZHitbodedutAttributes>.activities {
            let state = activity.content.state
            switch action {
            case "pause":
                guard !state.paused else { continue }
                let left = max(0, state.endsAt.timeIntervalSince(now))
                await activity.update(ActivityContent(state: .init(endsAt: state.endsAt, paused: true, remaining: left), staleDate: nil))
            case "resume":
                guard state.paused else { continue }
                let ends = now.addingTimeInterval(state.remaining)
                await activity.update(ActivityContent(state: .init(endsAt: ends, paused: false, remaining: state.remaining), staleDate: ends))
            case "end":
                await activity.end(nil, dismissalPolicy: .immediate)
            default:
                break
            }
        }
    }
}
#endif

#if canImport(AppIntents) && canImport(ActivityKit)
@available(iOS 17.0, *)
struct KZHitbodedutPauseIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "השהיית ההתבודדות"
    static var isDiscoverable: Bool = false
    init() {}
    func perform() async throws -> some IntentResult {
        await KZHitbodedutActions.apply("pause")
        return .result()
    }
}

@available(iOS 17.0, *)
struct KZHitbodedutResumeIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "המשך ההתבודדות"
    static var isDiscoverable: Bool = false
    init() {}
    func perform() async throws -> some IntentResult {
        await KZHitbodedutActions.apply("resume")
        return .result()
    }
}

@available(iOS 17.0, *)
struct KZHitbodedutEndIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "סיום ההתבודדות"
    static var isDiscoverable: Bool = false
    init() {}
    func perform() async throws -> some IntentResult {
        await KZHitbodedutActions.apply("end")
        return .result()
    }
}
#endif
