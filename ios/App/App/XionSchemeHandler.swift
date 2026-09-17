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
            urlSchemeTask.didFailWithError(NSError(domain: "xion", code: -1, userInfo: [NSLocalizedDescriptionKey: "no url"]))
            return
        }

        let urlString = url.absoluteString

        if urlString.hasPrefix("xion://proxy?") {
            let query = String(urlString.dropFirst("xion://proxy?".count))
            handleProxy(query: query, task: urlSchemeTask)
        } else {
            urlSchemeTask.didFailWithError(NSError(domain: "xion", code: -1, userInfo: [NSLocalizedDescriptionKey: "unknown scheme path"]))
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func handleProxy(query: String, task: WKURLSchemeTask) {
        var params: [String: String] = [:]
        for component in query.components(separatedBy: "&") {
            let parts = component.components(separatedBy: "=")
            if parts.count == 2, let name = parts[0].removingPercentEncoding, let value = parts[1].removingPercentEncoding {
                params[name] = value
            }
        }

        guard let targetStr = params["url"], let targetUrl = URL(string: targetStr) else {
            task.didFailWithError(NSError(domain: "xion", code: -1, userInfo: [NSLocalizedDescriptionKey: "missing url param"]))
            return
        }

        let referer = params["referer"] ?? fallbackReferers[0]
        let origin = params["origin"] ?? referer

        fetchWithRetry(url: targetUrl, referer: referer, origin: origin, attempt: 0, task: task)
    }

    private func fetchWithRetry(url: URL, referer: String, origin: String, attempt: Int, task: WKURLSchemeTask) {
        let referers = attempt == 0 ? [referer] + fallbackReferers : [referer]
        let currentReferer = attempt < referers.count ? referers[attempt] : referers[0]

        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        request.setValue(currentReferer, forHTTPHeaderField: "Referer")
        request.setValue(currentReferer.replacingOccurrences(of: "/", with: "", options: [], range: url.absoluteString.startIndex..<url.absoluteString.endIndex), forHTTPHeaderField: "Origin")

        let session = URLSession(configuration: .default, delegate: nil, delegateQueue: nil)
        let task = session.dataTask(with: request) { [weak self] data, response, error in
            if let error = error {
                if attempt < 5 {
                    self?.fetchWithRetry(url: url, referer: referer, origin: origin, attempt: attempt + 1, task: task)
                } else {
                    task.didFailWithError(error)
                }
                return
            }

            guard let data = data, let resp = response as? HTTPURLResponse else {
                task.didFailWithError(NSError(domain: "xion", code: -1, userInfo: [NSLocalizedDescriptionKey: "no response"]))
                return
            }

            let contentType = resp.mimeType ?? "application/octet-stream"
            let head200 = String(data: data.prefix(200), encoding: .utf8)?.lowercased() ?? ""

            if resp.statusCode >= 200 && resp.statusCode < 300 && !data.isEmpty && !head200.contains("<html") {
                let head512 = String(data: data.prefix(512), encoding: .utf8) ?? ""

                if contentType.contains("mpegurl") || head512.contains("#EXTM3U") {
                    self?.handleM3U8(data: data, m3u8Url: url.absoluteString, referer: referer, task: task)
                    return
                } else {
                    let unwrapped = self?.unwrapTs(data: data) ?? data
                    var respHeaders: [String: String] = [:]
                    for (key, value) in resp.allHeaderFields {
                        if let k = key as? String, let v = value as? String { respHeaders[k] = v }
                    }
                    let ct = contentType.contains("mpeg") || contentType.contains("video") ? "video/mp2t" : contentType
                    let urlResponse = URLResponse(url: url, mimeType: ct, expectedContentLength: unwrapped.count, textEncodingName: nil)
                    task.didReceive(urlResponse)
                    task.didReceive(unwrapped)
                    task.didFinish()
                    return
                }
            }

            if attempt < 5 && (resp.statusCode == 403 || resp.statusCode == 502) {
                self?.fetchWithRetry(url: url, referer: referer, origin: origin, attempt: attempt + 1, task: task)
            } else {
                var respHeaders: [String: String] = [:]
                for (key, value) in resp.allHeaderFields {
                    if let k = key as? String, let v = value as? String { respHeaders[k] = v }
                }
                let urlResponse = URLResponse(url: url, mimeType: contentType, expectedContentLength: data.count, textEncodingName: resp.textEncodingName)
                task.didReceive(urlResponse)
                task.didReceive(data)
                task.didFinish()
            }
        }
        task.resume()
    }

    private func handleM3U8(data: Data, m3u8Url: String, referer: String, task: WKURLSchemeTask) {
        guard let text = String(data: data, encoding: .utf8) else {
            task.didReceive(URLResponse(url: task.request.url!, mimeType: "application/vnd.apple.mpegurl", expectedContentLength: data.count, textEncodingName: nil))
            task.didReceive(data)
            task.didFinish()
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
                let proxyLine = "xion://proxy?url=" + absUrl.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)! + "&referer=" + referer.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)!
                rewritten.append(proxyLine)
            }
        }

        let result = rewritten.joined(separator: "\n")
        if let resultData = result.data(using: .utf8) {
            let urlResponse = URLResponse(url: task.request.url!, mimeType: "application/vnd.apple.mpegurl", expectedContentLength: resultData.count, textEncodingName: "utf-8")
            task.didReceive(urlResponse)
            task.didReceive(resultData)
            task.didFinish()
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
