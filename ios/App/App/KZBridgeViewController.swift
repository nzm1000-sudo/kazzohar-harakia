import Capacitor

final class KZBridgeViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        guard let webView = bridge?.webView else { return }
        webView.allowsBackForwardNavigationGestures = true
    }
}