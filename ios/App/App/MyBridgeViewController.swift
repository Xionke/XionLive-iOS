import UIKit
import Capacitor
import WebKit

class MyBridgeViewController: CAPBridgeViewController {

    private let xionHandler = XionSchemeHandler()

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)

        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsAirPlayForMediaPlayback = true
        config.mediaPlaybackAllowsAirPlay = true

        config.setURLSchemeHandler(xionHandler, forURLScheme: "xion")

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
