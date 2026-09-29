import Capacitor
import Foundation
import UIKit
#if canImport(AlarmKit)
import AlarmKit
import AppIntents
import SwiftUI
#endif

// השעון היהודי — the native side of the alarm (JS name "KZAlarm").
// It receives ready absolute instants from the app's engine ({ id, at, title, snoozeMinutes }); it never calculates a
// zman. On iOS 26+ each occurrence is a real AlarmKit alarm (system alarm presentation, rings per the system's alarm
// rules, stop and snooze). On older iOS `availability` says "notifications" and the app uses its local-notification
// fallback instead — no AlarmKit symbol is touched there (the framework is weak-linked, every use is behind
// `if #available(iOS 26.0, *)`).
@objc(KZAlarmPlugin)
public class KZAlarmPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KZAlarmPlugin"
    public let jsName = "KZAlarm"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "availability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "permissionState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "list", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "schedule", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "test", returnType: CAPPluginReturnPromise),
    ]

    @objc func availability(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) { call.resolve(["engine": "alarmkit"]); return }
        #endif
        call.resolve(["engine": "notifications"])
    }

    @objc func permissionState(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) { call.resolve(["state": KZAlarmKit.state(AlarmManager.shared.authorizationState)]); return }
        #endif
        call.resolve(["state": "unsupported"])
    }

    @objc func requestPermission(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            Task {
                do { call.resolve(["state": KZAlarmKit.state(try await AlarmManager.shared.requestAuthorization())]) }
                catch { call.resolve(["state": KZAlarmKit.state(AlarmManager.shared.authorizationState)]) }
            }
            return
        }
        #endif
        call.resolve(["state": "unsupported"])
    }

    @objc func list(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            let extra = KZAlarmKit.extraIds()
            let ids = ((try? AlarmManager.shared.alarms) ?? []).map { $0.id.uuidString.uppercased() }.filter { !extra.contains($0) }
            call.resolve(["ids": ids]); return
        }
        #endif
        call.resolve(["ids": []])
    }

    @objc func schedule(_ call: CAPPluginCall) {
        let alarms = call.getArray("alarms", JSObject.self) ?? []
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            Task {
                var scheduled: [String] = []
                var limit = false
                for item in alarms {
                    guard let idText = item["id"] as? String, let uuid = UUID(uuidString: idText),
                          let atMs = (item["at"] as? NSNumber)?.doubleValue else { continue }
                    let date = Date(timeIntervalSince1970: atMs / 1000)
                    if date <= Date() { continue }
                    let title = (item["title"] as? String) ?? "השעון היהודי"
                    let snooze = (item["snoozeMinutes"] as? NSNumber)?.intValue ?? 10
                    do {
                        try? AlarmManager.shared.cancel(id: uuid) // replace, never a second copy
                        try await KZAlarmKit.schedule(id: uuid, at: date, title: title, snoozeMinutes: snooze)
                        scheduled.append(idText.uppercased())
                    } catch AlarmManager.AlarmError.maximumLimitReached {
                        limit = true
                        break
                    } catch {
                        continue
                    }
                }
                call.resolve(["scheduled": scheduled, "limit": limit])
            }
            return
        }
        #endif
        call.resolve(["scheduled": [], "limit": false])
    }

    @objc func cancel(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            for text in ids { if let uuid = UUID(uuidString: text) { try? AlarmManager.shared.cancel(id: uuid) } }
        }
        #endif
        call.resolve()
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
            call.resolve()
        }
    }

    // "בדיקת צליל": a real alarm five seconds from now, so the owner hears exactly what will ring.
    @objc func test(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? "בדיקת צליל"
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            Task {
                guard AlarmManager.shared.authorizationState == .authorized else { call.resolve(["ok": false]); return }
                let id = UUID()
                KZAlarmKit.markExtra(id)
                do { try await KZAlarmKit.schedule(id: id, at: Date().addingTimeInterval(5), title: title, snoozeMinutes: 5); call.resolve(["ok": true]) }
                catch { call.resolve(["ok": false]) }
            }
            return
        }
        #endif
        call.resolve(["ok": false])
    }
}

#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct KZAlarmMetadata: AlarmMetadata {
    var title: String
}

@available(iOS 26.0, *)
enum KZAlarmKit {
    // The app's accent (#9a4a1f) for the system alarm's tint.
    static let tint = Color(red: 154.0 / 255.0, green: 74.0 / 255.0, blue: 31.0 / 255.0)
    private static let extraKey = "kz.jewishAlarm.extraIds"

    static func state(_ value: AlarmManager.AuthorizationState) -> String {
        switch value {
        case .authorized: return "granted"
        case .denied: return "denied"
        case .notDetermined: return "prompt"
        @unknown default: return "prompt"
        }
    }

    // Snoozes and sound tests are the system's own follow-ups, not the app's plan: reconciliation leaves them alone.
    static func extraIds() -> Set<String> {
        let saved = UserDefaults.standard.stringArray(forKey: extraKey) ?? []
        let live = Set(((try? AlarmManager.shared.alarms) ?? []).map { $0.id.uuidString.uppercased() })
        let kept = saved.filter { live.contains($0) }
        if kept.count != saved.count { UserDefaults.standard.set(kept, forKey: extraKey) }
        return Set(kept)
    }

    static func markExtra(_ id: UUID) {
        var saved = UserDefaults.standard.stringArray(forKey: extraKey) ?? []
        saved.append(id.uuidString.uppercased())
        UserDefaults.standard.set(Array(saved.suffix(64)), forKey: extraKey)
    }

    static func schedule(id: UUID, at date: Date, title: String, snoozeMinutes: Int) async throws {
        let minutes = [5, 10, 15].contains(snoozeMinutes) ? snoozeMinutes : 10
        let label = LocalizedStringResource(String.LocalizationValue(title))
        let snoozeButton = AlarmButton(text: LocalizedStringResource(String.LocalizationValue("נודניק · \(minutes) דק׳")), textColor: .white, systemImageName: "zzz")
        let alert: AlarmPresentation.Alert
        if #available(iOS 26.1, *) {
            alert = AlarmPresentation.Alert(title: label, secondaryButton: snoozeButton, secondaryButtonBehavior: .custom)
        } else {
            let stopButton = AlarmButton(text: "עצירה", textColor: .white, systemImageName: "stop.circle")
            alert = AlarmPresentation.Alert(title: label, stopButton: stopButton, secondaryButton: snoozeButton, secondaryButtonBehavior: .custom)
        }
        let attributes = AlarmAttributes<KZAlarmMetadata>(presentation: AlarmPresentation(alert: alert), metadata: KZAlarmMetadata(title: title), tintColor: tint)
        let snooze = KZSnoozeIntent(alarmID: id.uuidString, minutes: minutes, alarmTitle: title)
        let configuration = AlarmManager.AlarmConfiguration<KZAlarmMetadata>.alarm(schedule: .fixed(date), attributes: attributes, stopIntent: nil, secondaryIntent: snooze, sound: .default)
        _ = try await AlarmManager.shared.schedule(id: id, configuration: configuration)
    }
}

// The snooze button: stops the ringing alarm and sets a one-off alarm N minutes from now (5 / 10 / 15, chosen per alarm).
@available(iOS 26.0, *)
struct KZSnoozeIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "נודניק"
    static let isDiscoverable = false

    @Parameter(title: "Alarm") var alarmID: String
    @Parameter(title: "Minutes") var minutes: Int
    @Parameter(title: "Title") var alarmTitle: String

    init() {}
    init(alarmID: String, minutes: Int, alarmTitle: String) {
        self.alarmID = alarmID
        self.minutes = minutes
        self.alarmTitle = alarmTitle
    }

    func perform() async throws -> some IntentResult {
        if let uuid = UUID(uuidString: alarmID) { try? AlarmManager.shared.stop(id: uuid) }
        let next = UUID()
        KZAlarmKit.markExtra(next)
        try await KZAlarmKit.schedule(id: next, at: Date().addingTimeInterval(TimeInterval(max(1, minutes) * 60)), title: alarmTitle, snoozeMinutes: minutes)
        return .result()
    }
}
#endif
