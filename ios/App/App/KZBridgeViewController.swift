import UIKit
import Capacitor

final class KZBridgeViewController: CAPBridgeViewController, UIGestureRecognizerDelegate {
    private var edgeBackGesture: UIScreenEdgePanGestureRecognizer!

    override func viewDidLoad() {
        super.viewDidLoad()

        let gesture = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(handleEdgeBack(_:)))
        gesture.edges = .left
        gesture.cancelsTouchesInView = false
        gesture.delegate = self
        view.addGestureRecognizer(gesture)
        edgeBackGesture = gesture
    }

    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard let edgeGesture = gestureRecognizer as? UIScreenEdgePanGestureRecognizer else { return true }
        let velocity = edgeGesture.velocity(in: view)
        return velocity.x > 0 && velocity.x > abs(velocity.y)
    }

    @objc private func handleEdgeBack(_ gesture: UIScreenEdgePanGestureRecognizer) {
        guard gesture.state == .ended else { return }
        let translation = gesture.translation(in: view)
        guard translation.x > 0 else { return }

        let point = gesture.location(in: view)
        bridge?.webView?.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('kz-ios-edge-back',{detail:{startX:\(point.x),startY:\(point.y)}}));"
        )
    }
}