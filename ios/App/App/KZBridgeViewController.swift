import Capacitor

final class KZBridgeViewController: CAPBridgeViewController {
    private let appBackground = UIColor(red: 245.0 / 255.0, green: 242.0 / 255.0, blue: 234.0 / 255.0, alpha: 1.0)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = appBackground
        guard let webView = bridge?.webView else { return }
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = true
        webView.backgroundColor = appBackground
        webView.scrollView.backgroundColor = appBackground
        view.window?.backgroundColor = appBackground
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        view.backgroundColor = appBackground
        view.window?.backgroundColor = appBackground
    }
}