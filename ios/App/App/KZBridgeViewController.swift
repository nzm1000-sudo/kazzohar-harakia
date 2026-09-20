import Capacitor
import CoreLocation
import WebKit

final class KZBridgeViewController: CAPBridgeViewController, CLLocationManagerDelegate, WKScriptMessageHandler {
    private let appBackground = UIColor(red: 245.0 / 255.0, green: 242.0 / 255.0, blue: 234.0 / 255.0, alpha: 1.0)
    private let headingManager = CLLocationManager()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = appBackground
        guard let webView = bridge?.webView else { return }
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = true
        webView.backgroundColor = appBackground
        webView.scrollView.backgroundColor = appBackground
        view.window?.backgroundColor = appBackground
        webView.configuration.userContentController.add(self, name: "kzHeading")
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
        if action == "start" {
            guard CLLocationManager.headingAvailable() else {
                emitHeading(["heading": -1, "headingAccuracy": -1, "available": false])
                return
            }
            headingManager.requestWhenInUseAuthorization()
            headingManager.startUpdatingHeading()
        } else if action == "stop" {
            headingManager.stopUpdatingHeading()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        let trueHeading = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
        emitHeading(["trueHeading": trueHeading, "magneticHeading": newHeading.magneticHeading, "headingAccuracy": newHeading.headingAccuracy, "available": true])
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
        bridge?.webView?.configuration.userContentController.removeScriptMessageHandler(forName: "kzHeading")
    }
}