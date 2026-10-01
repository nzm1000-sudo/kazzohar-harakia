import Capacitor
import CoreLocation
import UIKit
import WebKit
#if canImport(FoundationModels)
import FoundationModels
#endif

final class KZBridgeViewController: CAPBridgeViewController, CLLocationManagerDelegate, WKScriptMessageHandler {
    private let appBackground = UIColor(red: 245.0 / 255.0, green: 242.0 / 255.0, blue: 234.0 / 255.0, alpha: 1.0)
    private let headingManager = CLLocationManager()

    // The app's own native plugins: השעון היהודי (AlarmKit on iOS 26+).
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(KZAlarmPlugin())
        // The home-screen widgets and Siri (KZWidgetsPlugin.swift).
        bridge?.registerPluginInstance(KZWidgetsPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = appBackground
        guard let webView = bridge?.webView else { return }
        webView.allowsBackForwardNavigationGestures = true
        // Hebrew app: the back swipe starts at the right edge (as in iOS in Hebrew). iOS takes the
        // direction from the app's language (Info.plist: he); this keeps the web view consistent.
        webView.semanticContentAttribute = .forceRightToLeft
        webView.isOpaque = true
        webView.backgroundColor = appBackground
        webView.scrollView.backgroundColor = appBackground
        view.window?.backgroundColor = appBackground
        webView.configuration.userContentController.add(self, name: "kzHeading")
        // Halacha assistant: Apple's on-device model, when the device and language support it (see handleHalachaModel).
        webView.configuration.userContentController.add(self, name: "kzHalachaModel")
        headingManager.delegate = self
        headingManager.headingFilter = 1
        headingManager.headingOrientation = .portrait
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        view.backgroundColor = appBackground
        view.window?.backgroundColor = appBackground
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        if message.name == "kzHalachaModel" { handleHalachaModel(body, action: action); return }
        if action == "start" {
            guard CLLocationManager.headingAvailable() else {
                emitHeading(["heading": -1, "headingAccuracy": -1, "available": false])
                return
            }
            headingManager.requestWhenInUseAuthorization()
            headingManager.headingOrientation = .portrait
            headingManager.startUpdatingLocation()
            headingManager.startUpdatingHeading()
        } else if action == "stop" {
            headingManager.stopUpdatingHeading()
            headingManager.stopUpdatingLocation()
        } else if action == "haptic" {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.prepare()
            generator.impactOccurred()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        let trueHeading = newHeading.trueHeading >= 0 ? newHeading.trueHeading : nil
        let magneticHeading = newHeading.magneticHeading >= 0 ? newHeading.magneticHeading : nil
        let source = trueHeading == nil ? "magnetic" : "true"
        emitHeading(["trueHeading": trueHeading as Any, "magneticHeading": magneticHeading as Any, "headingAccuracy": newHeading.headingAccuracy, "timestamp": newHeading.timestamp.timeIntervalSince1970 * 1000, "source": source, "available": true])
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        emitHeading(["heading": -1, "headingAccuracy": -1, "available": false])
    }

    private func emitHeading(_ values: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: values), let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.bridge?.webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('kz-native-heading',{detail:\(json)}));")
        }
    }

    deinit {
        headingManager.stopUpdatingHeading()
        headingManager.stopUpdatingLocation()
        bridge?.webView?.configuration.userContentController.removeScriptMessageHandler(forName: "kzHeading")
    }
}

// MARK: - Halacha assistant · Apple Foundation Models (iOS 26+, Apple Intelligence on)
// The web app retrieves verified material itself and sends one small JSON packet; this only phrases/understands.
// Hebrew is not a supported language of the on-device model today, so availability says so and the app falls back to
// its deterministic engine. The answer is validated again in JavaScript before anything is shown.
extension KZBridgeViewController {
    private static let halachaTasks: [String: String] = [
        "map-option": "The user is answering a multiple-choice question. Reply only with JSON {\"index\": n} (0-based) or {\"index\": null}.",
        "interpret": "Map the Hebrew question to one of the given flow ids: {\"flowId\": \"...\"}, or a short clear Hebrew search query: {\"query\": \"...\"}, or {}. Never answer the question.",
        "explain": "Explain the already-decided answer using ONLY the packet. Every sentence is a claim with sourceIds from the packet; quotes verbatim; no new rulings, rabbis or books. Reply only with JSON.",
    ]

    func handleHalachaModel(_ body: [String: Any], action: String) {
        let id = body["id"] as? String ?? ""
        if action == "availability" {
            replyHalachaModel(id, halachaModelAvailability(locale: body["locale"] as? String ?? "he"))
        } else if action == "respond" {
            let task = body["task"] as? String ?? ""
            let packet = body["packet"] as? String ?? "{}"
            let maxTokens = min(body["maxOutputTokens"] as? Int ?? 300, 600)
            guard let instructions = Self.halachaTasks[task] else { replyHalachaModel(id, ["error": "task"]); return }
            #if canImport(FoundationModels)
            if #available(iOS 26.0, *) {
                Task { @MainActor in
                    do {
                        let session = LanguageModelSession(instructions: instructions)
                        let response = try await session.respond(to: packet, options: GenerationOptions(temperature: 0.1, maximumResponseTokens: maxTokens))
                        self.replyHalachaModel(id, ["json": response.content])
                    } catch {
                        self.replyHalachaModel(id, ["error": String(describing: error)])
                    }
                }
                return
            }
            #endif
            replyHalachaModel(id, ["error": "unavailable"])
        }
    }

    private func halachaModelAvailability(locale: String) -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            let model = SystemLanguageModel.default
            switch model.availability {
            case .available:
                return model.supportsLocale(Locale(identifier: locale)) ? ["available": true] : ["available": false, "reason": "language-not-supported"]
            case .unavailable(let reason):
                return ["available": false, "reason": String(describing: reason)]
            }
        }
        #endif
        return ["available": false, "reason": "os-too-old"]
    }

    private func replyHalachaModel(_ id: String, _ payload: [String: Any]) {
        var message = payload
        message["id"] = id
        guard let data = try? JSONSerialization.data(withJSONObject: message), let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.bridge?.webView?.evaluateJavaScript("window.__kzHalachaModelReply && window.__kzHalachaModelReply(\(json))")
        }
    }
}
