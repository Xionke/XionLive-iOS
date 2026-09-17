import Foundation
import WebKit

class XionSchemeHandler: NSObject, WKURLSchemeHandler {

    private let userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    private let fallbackReferers = [
        "https://jack27eo.mpgreatestclgczbmiddle.my/",
        "https://mimi01eo.fut0newsiryroquite.cfd/",
        "https://tim01bp.2wc4tool8utphnumber.cfd/",
        "https://morgan01cf.8l3duspoken587uclock.cfd/",
        "https://nadia01eo.tn76degree12ec3out.cfd/"
    ]

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(NSError(domain: "xion", code: -1, userInfo: nil))
            return
        }

        let urlString = url.absoluteString

        if urlString.hasPrefix("xion://proxy?") {
            let query = String(urlString.dropFirst("xion://proxy?".count))
            handleProxy(query: query, schemeTask: urlSchemeTask)
        } else {
            urlSchemeTask.didFailWithError(NSError(domain: "xion", code: -1, userInfo: nil))
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func handleProxy(query: String, schemeTask: WKURLSchemeTask) {
        var params: [String: String] = [:]
        for component in query.components(separatedBy: "&") {
            let parts = component.components(separatedBy: "=")
            if parts.count >= 2 {
                let key = parts[0].removingPercentEncoding ?? parts[0]
                let value = parts[1...].joined(separator: "=").removingPercentEncoding ?? ""
                params[key] = value
            }
        }

        guard let targetStr = params["url"], let targetUrl = URL(string: targetStr) else {
            schemeTask.didFailWithError(NSError(domain: "xion", code: -1, userInfo: nil))
            return
        }

        let referer = params["referer"] ?? fallbackReferers[0]
        let origin = params["origin"] ?? referer

        performFetch(url: targetUrl, referer: referer, origin: origin, attempt: 0, schemeTask: schemeTask)
    }

    private func performFetch(url: URL, referer: String, origin: String, attempt: Int, schemeTask: WKURLSchemeTask) {
        let activeReferer = attempt < fallbackReferers.count ? fallbackReferers[attempt] : referer

        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        request.setValue(activeReferer, forHTTPHeaderField: "Referer")
        request.setValue(activeReferer, forHTTPHeaderField: "Origin")

        let session = URLSession.shared
        let dataTask = session.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }

            if let error = error {
                if attempt < self.fallbackReferers.count - 1 {
                    self.performFetch(url: url, referer: referer, origin: origin, attempt: attempt + 1, schemeTask: schemeTask)
                } else {
                    schemeTask.didFailWithError(error)
                }
                return
            }

            guard let data = data, let httpResponse = response as? HTTPURLResponse else {
                schemeTask.didFailWithError(NSError(domain: "xion", code: -1, userInfo: nil))
                return
            }

            let contentType = httpResponse.mimeType ?? "application/octet-stream"
            let head200 = String(data: data.prefix(200), encoding: .utf8)?.lowercased() ?? ""

            if httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 && !data.isEmpty && !head200.contains("<html") {
                let head512 = String(data: data.prefix(512), encoding: .utf8) ?? ""

                if contentType.contains("mpegurl") || head512.contains("#EXTM3U") {
                    self.handleM3U8(data: data, m3u8Url: url.absoluteString, referer: referer, schemeTask: schemeTask)
                    return
                } else {
                    let unwrapped = self.unwrapTs(data: data)
                    let urlResponse = URLResponse(url: url, mimeType: contentType.contains("mpeg") || contentType.contains("video") ? "video/mp2t" : contentType, expectedContentLength: unwrapped.count, textEncodingName: nil)
                    schemeTask.didReceive(urlResponse)
                    schemeTask.didReceive(unwrapped)
                    schemeTask.didFinish()
                    return
                }
            }

            if attempt < self.fallbackReferers.count - 1 && (httpResponse.statusCode == 403 || httpResponse.statusCode == 502) {
                self.performFetch(url: url, referer: referer, origin: origin, attempt: attempt + 1, schemeTask: schemeTask)
            } else {
                let urlResponse = URLResponse(url: url, mimeType: contentType, expectedContentLength: data.count, textEncodingName: httpResponse.textEncodingName)
                schemeTask.didReceive(urlResponse)
                schemeTask.didReceive(data)
                schemeTask.didFinish()
            }
        }
        dataTask.resume()
    }

    private func handleM3U8(data: Data, m3u8Url: String, referer: String, schemeTask: WKURLSchemeTask) {
        guard let text = String(data: data, encoding: .utf8) else {
            let urlResponse = URLResponse(url: schemeTask.request.url!, mimeType: "application/vnd.apple.mpegurl", expectedContentLength: data.count, textEncodingName: nil)
            schemeTask.didReceive(urlResponse)
            schemeTask.didReceive(data)
            schemeTask.didFinish()
            return
        }

        let lines = text.components(separatedBy: .newlines)
        var rewritten: [String] = []
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty || trimmed.hasPrefix("#") {
                rewritten.append(line)
            } else {
                var absUrl = trimmed
                if !trimmed.hasPrefix("http") {
                    if let base = URL(string: m3u8Url), let resolved = URL(string: trimmed, relativeTo: base) {
                        absUrl = resolved.absoluteString
                    }
                }
                let encodedUrl = absUrl.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? absUrl
                let encodedRef = referer.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? referer
                rewritten.append("xion://proxy?url=\(encodedUrl)&referer=\(encodedRef)")
            }
        }

        let result = rewritten.joined(separator: "\n")
        if let resultData = result.data(using: .utf8) {
            let urlResponse = URLResponse(url: schemeTask.request.url!, mimeType: "application/vnd.apple.mpegurl", expectedContentLength: resultData.count, textEncodingName: "utf-8")
            schemeTask.didReceive(urlResponse)
            schemeTask.didReceive(resultData)
            schemeTask.didFinish()
        }
    }

    private func unwrapTs(data: Data) -> Data {
        let buf = [UInt8](data)
        if buf.count < 4 { return data }
        if buf[0] == 0x47 { return data }
        if buf[0] == 0x89 && buf[1] == 0x50 && buf[2] == 0x4e && buf[3] == 0x53 {
            let iendData = Data(buf)
            if let range = iendData.range(of: Data("IEND".utf8)) {
                let end = range.upperBound + 8
                if end < data.count {
                    return data.subdata(in: end..<data.count)
                }
            }
            for i in 0..<min(buf.count, 65536) {
                if buf[i] == 0x47 && i + 188 < buf.count && buf[i + 188] == 0x47 {
                    return data.subdata(in: i..<data.count)
                }
            }
        }
        return data
    }
}
