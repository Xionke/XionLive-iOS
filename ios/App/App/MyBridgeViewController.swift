import UIKit
import Capacitor
import WebKit

class MyBridgeViewController: CAPBridgeViewController {

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)

        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsAirPlayForMediaPlayback = true
        config.mediaPlaybackAllowsAirPlay = true

        if #available(iOS 16.4, *) {
            config.preferences.isElementFullscreenEnabled = true
        }

        return config
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        webView?.allowsBackForwardNavigationGestures = true
        webView?.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView?.scrollView.bounces = true
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return .all
    }

    override var prefersStatusBarHidden: Bool {
        return false
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }
}
