(function() {
  "use strict";

  var log = function() { var a = ["[xion-resolver]"]; for (var i = 0; i < arguments.length; i++) a.push(arguments[i]); console.log.apply(console, a); };

  var UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  var DEFAULT_REFERER = "https://jack27eo.mpgreatestclgczbmiddle.my/";
  var PLAY_DOMAINS_RE = /fctv33|fctv|rbtv|rbsports|superabbit|madplay|hubu\.ru|mpgreatestclgczbmiddle|tm3troops31patrol|tcdru136ovur|2wc4tool8utphnumber|8l3duspoken587uclock|tn76degree12ec3out|fut0newsiryroquite/i;
  var LOCALE_CODES = new Set(["en","zh","th","vi","id","pt","es","tr","ru","ko","ja","nl","ar","hi","bn","fr","de","it"]);
  var MATCH_DETAIL_SIGNATURE_CODE = 0x66;
  var SIGNATURE_BOOTSTRAP_CODES = [0x66, 0x67, 0x68, 0x69];
  var REQUEST_PARAM_ORDER = ["matchId","leagueId","seasonId","sportType","language","stream"];
  var NUMERIC_KEYS = new Set(["sportType","language","leagueId","seasonId","siteType"]);

  var textDecoder = new TextDecoder("utf-8");

  function readVarint(buf, off) {
    var v = 0, s = 0, i = off;
    while (i < buf.length) { var b = buf[i++]; v |= (b & 127) << s; if ((b & 128) === 0) break; s += 7; }
    return [v, i];
  }
  function readLD(buf, off) { var r = readVarint(buf, off); return [buf.subarray(r[1], r[1] + r[0]), r[1] + r[0]]; }
  function td(b) { return textDecoder.decode(b); }

  function readFields(buf) {
    var fields = new Map(); var off = 0;
    while (off < buf.length) {
      var tag = readVarint(buf, off); off = tag[1];
      var fnum = tag[0] >> 3, wire = tag[0] & 7;
      if (wire === 0) { var val = readVarint(buf, off); off = val[1]; var tmp = new Uint8Array(8); var sz = 0, v2 = val[0]; while (v2 > 0x7F) { tmp[sz++] = (v2 & 0x7F) | 0x80; v2 >>>= 7; } tmp[sz++] = v2; var list = fields.get(fnum) || []; list.push(tmp.subarray(0, sz)); fields.set(fnum, list); continue; }
      if (wire === 2) { var chunk = readLD(buf, off); off = chunk[1]; var list2 = fields.get(fnum) || []; list2.push(chunk[0]); fields.set(fnum, list2); continue; }
      break;
    }
    return fields;
  }

  function parseApiEnvelope(buf) {
    var fields = readFields(buf);
    return { message: fields.get(3) ? td(fields.get(3)[0]) : "", payload: fields.get(10) || [] };
  }

  function parseSignatureEntries(chunk) {
    var entries = []; var off = 0;
    while (off < chunk.length) {
      var tag = readVarint(chunk, off); off = tag[1];
      if ((tag[0] & 7) !== 2) continue;
      var ld = readLD(chunk, off); off = ld[1]; var inner = ld[0];
      var code = 0, value = "", ii = 0;
      while (ii < inner.length) {
        var it = readVarint(inner, ii); ii = it[1]; var ifn = it[0] >> 3, iwire = it[0] & 7;
        if (iwire === 0) { var iv = readVarint(inner, ii); ii = iv[1]; if (ifn === 1) code = iv[0]; continue; }
        if (iwire === 2) { var ild = readLD(inner, ii); ii = ild[1]; if (ifn === 2) value = td(ild[0]); }
      }
      if (code) entries.push({ code: code, value: value });
    }
    return entries;
  }

  function parseUserGeo(buf) {
    var env = parseApiEnvelope(buf);
    if (!env.payload[0]) return {};
    var fields = readFields(env.payload[0]);
    return { country: fields.get(2) ? td(fields.get(2)[0]) : "", continent: fields.get(3) ? td(fields.get(3)[0]) : "" };
  }

  function readVarintField(buf) {
    if (!buf) return undefined;
    return readVarint(buf, 0)[0];
  }

  function parseStreamItem(buf) {
    var fields = readFields(buf);
    var streamIdChunk = fields.get(1) ? fields.get(1)[0] : null;
    var streamId = streamIdChunk && streamIdChunk.length <= 8 ? String(readVarint(streamIdChunk, 0)[0]) : (streamIdChunk ? td(streamIdChunk) : "");
    return {
      streamId: streamId,
      url: fields.get(4) ? td(fields.get(4)[0]) : "",
      name: fields.get(3) ? td(fields.get(3)[0]) : "",
      siteType: readVarintField(fields.get(9) ? fields.get(9)[0] : null)
    };
  }

  function parseMatchDetail(buf) {
    var env = parseApiEnvelope(buf);
    if (!env.payload[0]) return { stream: [] };
    var root = readFields(env.payload[0]);
    return { stream: (root.get(2) || []).map(parseStreamItem) };
  }

  function parseStreamDetail(buf) {
    var env = parseApiEnvelope(buf);
    if (!env.payload[0]) return {};
    var fields = readFields(env.payload[0]);
    var streamBuffer = (fields.get(2) ? fields.get(2)[0] : null) || (fields.get(1) ? fields.get(1)[0] : null) || env.payload[0];
    return parseStreamItem(streamBuffer);
  }

  function rot47(s) {
    return s.split("").map(function(c) {
      var code = c.charCodeAt(0);
      if (code >= 33 && code <= 79) return String.fromCharCode(code + 47);
      if (code >= 80 && code <= 126) return String.fromCharCode(code - 47);
      return c;
    }).join("");
  }

  function normalizeValue(key, value) {
    if (typeof value === "string" && NUMERIC_KEYS.has(key) && /^\d+$/.test(value)) return Number(value);
    return value;
  }
  function sortRequestParams(params) {
    var normalized = {};
    for (var k in params) normalized[k] = normalizeValue(k, params[k]);
    var order = new Map(REQUEST_PARAM_ORDER.map(function(key, index) { return [key, index]; }));
    var keys = Object.keys(normalized).sort(function(a, b) { return (order.get(a) ?? -1) - (order.get(b) ?? -1); });
    var sorted = {};
    keys.forEach(function(k) { sorted[k] = normalized[k]; });
    return sorted;
  }

  function requestHashPrefix(params) {
    var str = JSON.stringify(sortRequestParams(params));
    var md5hex = md5(str);
    return md5hex.slice(0, 6);
  }

  function md5(string) {
    function md5cycle(x, k) { var a = x[0], b = x[1], c = x[2], d = x[3]; a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586); c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330); a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426); c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983); a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417); c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162); a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101); c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329); a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632); c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302); a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083); c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848); a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690); c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501); a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784); c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734); a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463); c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556); a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353); c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640); a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222); c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189); a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835); c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651); a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415); c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055); a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606); c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799); a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744); c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649); a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379); c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551); x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]); }
    function cmn(q, a, b, x, s, t) { a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b); }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
    function md51(s) {
      var n = s.length, state = [1732584193, -271733879, -1732584194, 271733878], i;
      for (i = 64; i <= n; i += 64) md5cycle(state, md5blk(s.substring(i - 64, i)));
      s = s.substring(i - 64);
      var tail = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
      for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
      tail[i >> 2] |= 0x80 << ((i % 4) << 3);
      if (i > 55) { md5cycle(state, tail); for (i = 0; i < 16; i++) tail[i] = 0; }
      tail[14] = n * 8;
      md5cycle(state, tail);
      return state;
    }
    function md5blk(s) {
      var md5blks = [], i;
      for (i = 0; i < 64; i += 4) md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
      return md5blks;
    }
    var hex_chr = "0123456789abcdef".split("");
    function rhex(n) { var s = "", j = 0; for (; j < 4; j++) s += hex_chr[(n >> (j * 8 + 4)) & 0x0f] + hex_chr[(n >> (j * 8)) & 0x0f]; return s; }
    function hex(x) { for (var i = 0; i < x.length; i++) x[i] = rhex(x[i]); return x.join(""); }
    function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
    return hex(md51(string));
  }

  function normalizePlayerReferer(host) {
    return "https://" + host.replace(/^https?:\/\//, "").replace(/\/$/, "") + "/";
  }

  function buildHeaders(context) {
    return { "Referer": context.pageReferer, "Origin": context.pageOrigin, "Accept": "application/json, text/plain, */*", "User-Agent": UA };
  }

  function parseMatchPagePath(input) {
    var url;
    try { url = new URL(input.trim()); } catch { return null; }
    var parts = url.pathname.split("/").filter(Boolean);
    var index = 0;
    if (parts[index] && LOCALE_CODES.has(parts[index])) index += 1;
    var sportSlug = parts[index];
    if (!sportSlug) return null;
    var sportType = {football:1,basketball:2,tennis:3,baseball:4,cricket:6,motorsport:7,rugby:8,"american-football":9,"aussie-rules":10,hockey:11,badminton:12,volleyball:13,fighting:14,cycling:15,handball:16,others:90}[sportSlug];
    if (sportType === undefined) return null;
    var slugSegment = parts[index + 1];
    if (!slugSegment || slugSegment.indexOf("-") === -1) return null;
    var cleanSegment = slugSegment.replace(/\.html$/i, "");
    var matchId = cleanSegment.slice(cleanSegment.lastIndexOf("-") + 1);
    if (!/^\d+$/.test(matchId)) return null;
    var pageReferer = url.origin + "/";
    var metadata = url.searchParams.get("mdata");
    if (metadata) {
      try {
        var normalized = decodeURIComponent(metadata).replace(/\s/g, "");
        var padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
        var plain = atob(padded);
        var parts2 = plain.split("_");
        if (parts2[0] && parts2[1] && /^\d+$/.test(parts2[0])) {
          return { matchId: parts2[0], sportType: Number(parts2[1]), pageReferer: pageReferer, pageOrigin: url.origin };
        }
      } catch {}
    }
    return { matchId: matchId, sportType: sportType, pageReferer: pageReferer, pageOrigin: url.origin };
  }

  function parseStreamSiteDigitFromPage(pageHtml, pageUrl) {
    var match;
    match = pageHtml.match(/layout:"livestream-([^"]+)"/);
    if (match && match[1]) return match[1];
    match = pageHtml.match(/DIGIT_ENV['"]\s*:\s*['"]([^'"]+)['"]/);
    if (match && match[1] && match[1] !== "production" && match[1].length < 10) return match[1];
    match = pageHtml.match(/cDigit['"]\s*:\s*['"]([^'"]+)['"]/);
    if (match && match[1] && match[1] !== "production" && match[1].length < 10) return match[1];
    match = pageHtml.match(/DIGIT_ENV_MIRROR['"]\s*:\s*['"]([^'"]+)['"]/);
    if (match && match[1] !== "" && match[1].length < 10) return match[1];
    if (pageHtml.indexOf("fctv33") !== -1 || PLAY_DOMAINS_RE.test(pageUrl || "")) return "foth";
    throw new Error("stream site digit not found on match page");
  }

  function parseDataApiBaseUrlFromPage(pageHtml) {
    var match = pageHtml.match(/apis-data\d+\.[a-z0-9.-]+/);
    if (!match) throw new Error("data api host not found on match page");
    return "https://" + match[0];
  }

  function buildPlaySiteUrl(playerDomainBase, pageUrl) {
    var source = new URL(pageUrl.trim());
    var target = new URL(playerDomainBase);
    target.pathname = source.pathname.replace(/-match-(\d+)/, "-$1").replace(/-\d{2}-\d{4}(\.html)$/i, "$1");
    target.searchParams.set("icg", "UEs");
    target.searchParams.set("ilang", source.searchParams.get("ilang") || "en");
    return target.href;
  }

  async function proxyFetch(url, opts) {
    opts = opts || {};
    var headers = {};
    if (opts.headers) {
      if (opts.headers instanceof Headers) { opts.headers.forEach(function(v, k) { headers[k] = v; }); }
      else if (typeof opts.headers === "object") { for (var k in opts.headers) headers[k] = opts.headers[k]; }
    }
    var params = "url=" + encodeURIComponent(url);
    if (headers["Referer"]) params += "&referer=" + encodeURIComponent(headers["Referer"]);
    if (headers["Origin"]) params += "&origin=" + encodeURIComponent(headers["Origin"]);
    if (Object.keys(headers).length > 2) params += "&headers=" + encodeURIComponent(JSON.stringify(headers));
    var proxyUrl = "xion://proxy?" + params;
    var resp = await fetch(proxyUrl, { method: opts.method || "GET" });
    return resp;
  }

  async function apiFetch(url, headers) {
    try {
      var resp = await proxyFetch(url, { headers: headers });
      return resp;
    } catch (e) {
      log("proxyFetch failed, trying direct:", e.message);
      return fetch(url, { headers: headers, redirect: "follow" });
    }
  }

  async function resolveXionMatch(matchUrl, requestedStreamId) {
    log("resolving:", matchUrl);
    var input = (matchUrl || "").trim();

    var isM3u8 = input.toLowerCase().indexOf(".m3u8") !== -1;
    if (isM3u8) {
      try {
        var u = new URL(input);
        var referer = u.searchParams.get("referer") || DEFAULT_REFERER;
        var clean = new URL(input);
        clean.searchParams.delete("referer");
        var name = decodeURIComponent(u.pathname.split("/").pop() || "Brugge").replace(/\.m3u8.*$/i, "") || "XionLive";
        var playableUrl = "xion://proxy?url=" + encodeURIComponent(clean.href) + "&referer=" + encodeURIComponent(referer);
        return { name: name, streamUrl: clean.href, referer: referer, playableUrl: playableUrl };
      } catch (e) {
        throw new Error("invalid m3u8 url");
      }
    }

    var parsed = parseMatchPagePath(input);
    if (!parsed) throw new Error("Could not parse match page URL");
    var requestContext = { pageReferer: parsed.pageReferer, pageOrigin: parsed.pageOrigin };

    log("fetching match page");
    var pageResp = await apiFetch(input, buildHeaders(requestContext));
    var pageHtml = await pageResp.text();
    var dataApiBaseUrl = parseDataApiBaseUrlFromPage(pageHtml);
    var streamSiteDigit = parseStreamSiteDigitFromPage(pageHtml, input);
    log("dataApi:", dataApiBaseUrl, "digit:", streamSiteDigit);

    log("fetching config");
    var configResp = await apiFetch(dataApiBaseUrl + "/api/common/params", buildHeaders(requestContext));
    var configText = rot47(await configResp.text());
    var siteConfig = JSON.parse(configText);
    var webClients = JSON.parse(siteConfig["common:web:client"] || "{}");
    var gPlayerDomains = JSON.parse(siteConfig["g_player_domains"] || "{}");

    var playerDomain = null;
    var wcKeys = Object.keys(webClients);
    for (var i = 0; i < wcKeys.length; i++) {
      var h = webClients[wcKeys[i]] && webClients[wcKeys[i]].iframePlayerDomains && webClients[wcKeys[i]].iframePlayerDomains[0];
      if (h) { playerDomain = h; break; }
    }
    if (!playerDomain) {
      var gdKeys = Object.keys(gPlayerDomains);
      for (var gi = 0; gi < gdKeys.length; gi++) {
        var arr = gPlayerDomains[gdKeys[gi]];
        if (Array.isArray(arr)) {
          for (var gj = 0; gj < arr.length; gj++) {
            if (/^https?:\/\//i.test(arr[gj])) { playerDomain = arr[gj]; break; }
          }
          if (playerDomain) break;
        }
      }
    }
    var playerReferer = playerDomain ? normalizePlayerReferer(playerDomain) : DEFAULT_REFERER;

    var isInputPlayDomain = PLAY_DOMAINS_RE.test(input);
    if (!isInputPlayDomain && playerDomain && PLAY_DOMAINS_RE.test(playerDomain)) {
      var playUrl = buildPlaySiteUrl(playerDomain, input);
      log("fetching play site:", playUrl);
      var playPageResp = await apiFetch(playUrl, buildHeaders(requestContext));
      var playPageHtml = await playPageResp.text();
      dataApiBaseUrl = parseDataApiBaseUrlFromPage(playPageHtml);
      streamSiteDigit = parseStreamSiteDigitFromPage(playPageHtml, playUrl);
      var playParsed = new URL(playUrl);
      requestContext = { pageReferer: playParsed.origin + "/", pageOrigin: playParsed.origin };
    }

    log("fetching geo");
    var geoResp = await apiFetch(dataApiBaseUrl + "/api/user/info", buildHeaders(requestContext));
    var geoBuf = new Uint8Array(await geoResp.arrayBuffer());
    var geo = parseUserGeo(geoBuf);

    log("fetching signatures");
    var query = new URLSearchParams();
    query.set("stream", "true");
    query.set("sportType", String(parsed.sportType));
    query.set("matchId", parsed.matchId);
    for (var ci = 0; ci < SIGNATURE_BOOTSTRAP_CODES.length; ci++) query.append("code", String(SIGNATURE_BOOTSTRAP_CODES[ci]));
    var sigResp = await apiFetch(dataApiBaseUrl + "/api/common/bs?" + query.toString(), buildHeaders(requestContext));
    var sigBuf = new Uint8Array(await sigResp.arrayBuffer());
    var sigEnv = parseApiEnvelope(sigBuf);
    if (sigEnv.message !== "Success") throw new Error("signature bootstrap failed: " + sigEnv.message);
    var signatureKeys = new Map();
    sigEnv.payload.forEach(function(chunk) { parseSignatureEntries(chunk).forEach(function(entry) { signatureKeys.set(entry.code, entry.value); }); });

    var suffix = signatureKeys.get(MATCH_DETAIL_SIGNATURE_CODE);
    if (!suffix) throw new Error("missing body signature");

    log("fetching match detail");
    var detailQuery = sortRequestParams({ matchId: parsed.matchId, sportType: parsed.sportType, language: 0, stream: true });
    var qs = new URLSearchParams();
    for (var dk in detailQuery) qs.set(dk, String(detailQuery[dk]));
    var detailUrl = dataApiBaseUrl + "/sfver" + requestHashPrefix({ matchId: parsed.matchId, sportType: parsed.sportType, language: 0, stream: true }) + suffix + "/api/match/detail?" + qs.toString();
    var detailResp = await apiFetch(detailUrl, buildHeaders(requestContext));
    var detailBuf = new Uint8Array(await detailResp.arrayBuffer());
    var match = parseMatchDetail(detailBuf);
    var liveStreams = match.stream.filter(function(s) { return s.streamId; });
    if (!liveStreams.length) throw new Error("no stream on match (not live yet?)");

    if (!requestedStreamId && input.indexOf("?") !== -1) {
      try { requestedStreamId = new URL(input).searchParams.get("streamId"); } catch {}
    }

    if (!requestedStreamId) {
      return {
        name: "Match " + parsed.matchId,
        matchId: parsed.matchId,
        streams: liveStreams.map(function(s) { return { streamId: s.streamId, name: s.name || "Stream " + s.streamId, siteType: s.siteType }; }),
        referer: playerReferer,
      };
    }

    var stream = liveStreams.find(function(s) { return String(s.streamId) === String(requestedStreamId); }) || liveStreams[0];
    if (!stream) throw new Error("stream not found");

    log("fetching stream detail");
    var streamDetailUrl = new URL(dataApiBaseUrl + "/api/stream/detail");
    streamDetailUrl.searchParams.set("streamId", stream.streamId);
    streamDetailUrl.searchParams.set("matchId", parsed.matchId);
    streamDetailUrl.searchParams.set("sportType", String(parsed.sportType));
    streamDetailUrl.searchParams.set("siteType", String(stream.siteType));
    streamDetailUrl.searchParams.set("digit", streamSiteDigit);
    if (geo.continent) streamDetailUrl.searchParams.set("continent", geo.continent);
    if (geo.country) streamDetailUrl.searchParams.set("country", geo.country);
    var sdResp = await apiFetch(streamDetailUrl.toString(), buildHeaders(requestContext));
    var sdHeaders = {};
    sdResp.headers.forEach(function(v, k) { sdHeaders[k.toLowerCase()] = v; });
    var sdBuf = new Uint8Array(await sdResp.arrayBuffer());
    var sdEnvelope = parseApiEnvelope(sdBuf);
    if (sdEnvelope.message !== "Success") throw new Error("stream detail failed: " + sdEnvelope.message);
    var sessionToken = sdHeaders["rb-session"];
    if (!sessionToken) throw new Error("stream detail missing session token");
    var detail = parseStreamDetail(sdBuf);
    if (!detail.url) throw new Error("stream detail missing url");

    var decoded = rot47(detail.url).slice(8);
    if (!decoded.startsWith("http://") && !decoded.startsWith("https://")) throw new Error("stream URL not HTTP");
    var streamParsed = new URL(decoded);

    var keyBytes = new TextEncoder().encode("a7981cc9eb2f4d19dcfea57b101ecd89");
    var ivBytes = new TextEncoder().encode("8017d3a8f1400d2f");
    var tokenBytes = new TextEncoder().encode(sessionToken);

    var cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["encrypt"]);
    var encrypted = await crypto.subtle.encrypt({ name: "AES-CBC", iv: ivBytes }, cryptoKey, tokenBytes);
    var token = encodeURIComponent(btoa(String.fromCharCode.apply(null, new Uint8Array(encrypted)))) + "a";
    var signedUrl = streamParsed.origin + "/token-" + token + streamParsed.pathname + streamParsed.search;

    var playableUrl = "xion://proxy?url=" + encodeURIComponent(signedUrl) + "&referer=" + encodeURIComponent(playerReferer);

    log("resolved stream:", stream.name);
    return {
      name: stream.name || "Brugge " + parsed.matchId,
      streamUrl: signedUrl,
      referer: playerReferer,
      playableUrl: playableUrl,
    };
  }

  window.resolveXionMatch = resolveXionMatch;
})();
