import Capacitor
import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

// The native side of the widgets (JS name "KZWidgets", src/services/nativeWidgets.mjs).
//   setSnapshot({ json })  — keeps the snapshot the app computed (KZSharedStore) and asks WidgetKit to redraw.
//   takePendingRoute()     — a way into the app left by Siri (KZAppIntents.swift) before the web view was listening.
// A route that arrives while the app is open is also sent at once as a "route" event.
@objc(KZWidgetsPlugin)
public class KZWidgetsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KZWidgetsPlugin"
    public let jsName = "KZWidgets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takePendingRoute", returnType: CAPPluginReturnPromise),
    ]

    static let routeNotification = Notification.Name("KZWidgetsRoute")
    static let pendingKey = "kz.widget.pendingRoute"

    private var observer: NSObjectProtocol?

    public override func load() {
        observer = NotificationCenter.default.addObserver(forName: KZWidgetsPlugin.routeNotification, object: nil, queue: .main) { [weak self] note in
            guard let url = note.userInfo?["url"] as? String else { return }
            UserDefaults.standard.removeObject(forKey: KZWidgetsPlugin.pendingKey)
            self?.notifyListeners("route", data: ["url": url])
        }
    }

    deinit {
        if let observer { NotificationCenter.default.removeObserver(observer) }
    }

    // Siri / Shortcuts: remember the route (the web view may not be ready yet) and tell a running app at once.
    static func open(_ url: String) {
        UserDefaults.standard.set(url, forKey: pendingKey)
        DispatchQueue.main.async { NotificationCenter.default.post(name: routeNotification, object: nil, userInfo: ["url": url]) }
    }

    @objc func setSnapshot(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else { call.reject("json"); return }
        let saved = KZSharedStore.write(json)
        #if canImport(WidgetKit)
        if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
        #endif
        call.resolve(["saved": saved, "appGroup": KZSharedStore.groupDefaults != nil])
    }

    @objc func takePendingRoute(_ call: CAPPluginCall) {
        let url = UserDefaults.standard.string(forKey: KZWidgetsPlugin.pendingKey)
        UserDefaults.standard.removeObject(forKey: KZWidgetsPlugin.pendingKey)
        call.resolve(url.map { ["url": $0] } ?? [:])
    }
}
