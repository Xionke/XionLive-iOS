(function() {
  "use strict";
  var log = function() { var a = ["[xion-resolver]"]; for (var i = 0; i < arguments.length; i++) a.push(arguments[i]); console.log.apply(console, a); };

  var BASE = "https://xionlive.vercel.app";

  async function resolveXionMatch(matchUrl, requestedStreamId) {
    var api = BASE + "/api/xion?url=" + encodeURIComponent(matchUrl);
    if (requestedStreamId) api += "&streamId=" + encodeURIComponent(requestedStreamId);
    log("calling server:", api);
    var resp = await fetch(api);
    var data;
    try { data = await resp.json(); } catch(e) { data = {}; }
    if (!resp.ok || data.error) throw new Error((data.error || "Server error") + " | status:" + resp.status);
    log("resolved:", data);
    return data;
  }

  window.resolveXionMatch = resolveXionMatch;
})();
