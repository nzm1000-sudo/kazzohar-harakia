import Capacitor
import Foundation
#if KZ_FAMILY_CONTROLS
import DeviceActivity
import FamilyControls
import ManagedSettings
import SwiftUI
#endif

// שומר הסף — shields the apps the person chose, only while a התבודדות session runs (JS name "KZGatekeeper").
//
// OFF in this build. Screen Time's FamilyControls needs the com.apple.developer.family-controls entitlement, which
// Apple grants on request to paid Apple Developer Program teams only; the app is signed with a free personal team, and
// adding the entitlement would make signing fail. So everything that touches FamilyControls / ManagedSettings /
// DeviceActivity is compiled only when the KZ_FAMILY_CONTROLS condition is defined (Build Settings → Swift Compiler →
// Active Compilation Conditions), together with the entitlement and the two extensions in ios/App/KZGatekeeper/.
// Without it, `status` answers { compiled: false } and the screen explains — honestly — that it needs Apple's approval.
// See docs/leatzmi/shomer-hasaf.md.
@objc(KZGatekeeperPlugin)
public class KZGatekeeperPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KZGatekeeperPlugin"
    public let jsName = "KZGatekeeper"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shield", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unshield", returnType: CAPPluginReturnPromise),
    ]

    #if KZ_FAMILY_CONTROLS
    static let store = ManagedSettingsStore(named: ManagedSettingsStore.Name("kz.hitbodedut"))
    static let selectionKey = "kz.gatekeeper.selection"

    static var selection: FamilyActivitySelection {
        get {
            guard let data = UserDefaults(suiteName: "group.com.kzohaar.app")?.data(forKey: selectionKey),
                  let value = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) else { return FamilyActivitySelection() }
            return value
        }
        set { UserDefaults(suiteName: "group.com.kzohaar.app")?.set(try? JSONEncoder().encode(newValue), forKey: selectionKey) }
    }

    @objc func status(_ call: CAPPluginCall) {
        let state: String
        switch AuthorizationCenter.shared.authorizationStatus {
        case .approved: state = "approved"
        case .denied: state = "denied"
        default: state = "notDetermined"
        }
        call.resolve(["compiled": true, "authorization": state, "apps": Self.selection.applicationTokens.count])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        Task { @MainActor in
            do { try await AuthorizationCenter.shared.requestAuthorization(for: .individual); call.resolve(["authorization": "approved"]) }
            catch { call.resolve(["authorization": "denied", "error": String(describing: error)]) }
        }
    }

    @objc func pickApps(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let host = UIHostingController(rootView: KZGatekeeperPicker { selection in
                Self.selection = selection
                self.bridge?.viewController?.dismiss(animated: true)
                call.resolve(["apps": selection.applicationTokens.count])
            })
            self.bridge?.viewController?.present(host, animated: true)
        }
    }

    // Shields the chosen apps until `until` (ms); the DeviceActivity monitor lifts the shield at the end even if the
    // app is not running, and unshield() lifts it at once when the session ends early.
    @objc func shield(_ call: CAPPluginCall) {
        let selection = Self.selection
        Self.store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
        Self.store.shield.applicationCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
        if let until = call.getDouble("until") {
            let end = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: Date(timeIntervalSince1970: until / 1000))
            let start = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: Date())
            try? DeviceActivityCenter().startMonitoring(DeviceActivityName("kz.hitbodedut"), during: DeviceActivitySchedule(intervalStart: start, intervalEnd: end, repeats: false))
        }
        call.resolve(["shielded": true])
    }

    @objc func unshield(_ call: CAPPluginCall) {
        Self.store.clearAllSettings()
        DeviceActivityCenter().stopMonitoring([DeviceActivityName("kz.hitbodedut")])
        call.resolve()
    }
    #else
    @objc func status(_ call: CAPPluginCall) { call.resolve(["compiled": false, "reason": "family-controls-entitlement"]) }
    @objc func requestAuthorization(_ call: CAPPluginCall) { call.unavailable("שומר הסף דורש אישור מאפל") }
    @objc func pickApps(_ call: CAPPluginCall) { call.unavailable("שומר הסף דורש אישור מאפל") }
    @objc func shield(_ call: CAPPluginCall) { call.unavailable("שומר הסף דורש אישור מאפל") }
    @objc func unshield(_ call: CAPPluginCall) { call.resolve() }
    #endif
}

#if KZ_FAMILY_CONTROLS
private struct KZGatekeeperPicker: View {
    @State private var selection = KZGatekeeperPlugin.selection
    let done: (FamilyActivitySelection) -> Void
    var body: some View {
        NavigationStack {
            FamilyActivityPicker(selection: $selection)
                .navigationTitle("אפליקציות לחסימה")
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("שמירה") { done(selection) } } }
        }
    }
}
#endif
