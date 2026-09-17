(function () {
  "use strict";

  var SPORT_SLUGS = {
    football: 1,
    basketball: 2,
    tennis: 3,
    baseball: 4,
    cricket: 6,
    motorsport: 7,
    rugby: 8,
    "american-football": 9,
    "aussie-rules": 10,
    hockey: 11,
    badminton: 12,
    volleyball: 13,
    fighting: 14,
    cycling: 15,
    handball: 16,
    others: 90
  };

  var SPORT_NAMES = Object.fromEntries(
    Object.entries(SPORT_SLUGS).map(function (entry) { return [entry[1], entry[0]]; })
  );

  var MATCH_SOURCE = "jack27eo.mpgreatestclgczbmiddle.my";
  var MATCH_ORIGIN = "https://" + MATCH_SOURCE;

  var textDecoder = new TextDecoder("utf-8");

  function readVarint2(buffer, offset) {
    var value = 0;
    var shift = 0;
    var index = offset;
    while (index < buffer.length) {
      var byte = buffer[index++];
      value |= (byte & 127) << shift;
      if ((byte & 128) === 0) break;
      shift += 7;
    }
    return [value, index];
  }

  function readLengthDelimited2(buffer, offset) {
    var result = readVarint2(buffer, offset);
    var length = result[0];
    var start = result[1];
    return [buffer.subarray(start, start + length), start + length];
  }

  function readFields2(buffer) {
    var fields = new Map();
    var offset = 0;
    while (offset < buffer.length) {
      var tagResult = readVarint2(buffer, offset);
      var tag = tagResult[0];
      offset = tagResult[1];
      var field = tag >> 3;
      var wire = tag & 7;
      if (wire === 0) {
        var valResult = readVarint2(buffer, offset);
        var value = valResult[0];
        offset = valResult[1];
        var buf = new Uint8Array(8);
        var size = 0;
        var temp = value;
        while (temp >= 128) {
          buf[size++] = (temp & 127) | 128;
          temp >>>= 7;
        }
        buf[size++] = temp;
        var list = fields.get(field) || [];
        list.push(buf.subarray(0, size));
        fields.set(field, list);
        continue;
      }
      if (wire === 2) {
        var chunkResult = readLengthDelimited2(buffer, offset);
        var chunk = chunkResult[0];
        offset = chunkResult[1];
        var list2 = fields.get(field) || [];
        list2.push(chunk);
        fields.set(field, list2);
        continue;
      }
      break;
    }
    return fields;
  }

  function readVarintField2(buffer) {
    if (!buffer) return undefined;
    try {
      return readVarint2(buffer, 0)[0];
    } catch (e) {
      return undefined;
    }
  }

  function extractStringsFromBuffer(buffer) {
    var strings = [];
    var offset = 0;
    while (offset < buffer.length) {
      try {
        var tagResult = readVarint2(buffer, offset);
        var tag = tagResult[0];
        offset = tagResult[1];
        var wire = tag & 7;
        if (wire === 2) {
          var chunkResult = readLengthDelimited2(buffer, offset);
          var chunk = chunkResult[0];
          offset = chunkResult[1];
          var str = textDecoder.decode(chunk);
          if (str.length > 1) strings.push(str);
        } else if (wire === 0) {
          var skipResult = readVarint2(buffer, offset);
          offset = skipResult[1];
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    }
    return strings;
  }

  function base64Encode(input) {
    var bytes = new TextEncoder().encode(input);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function parseMatchListResponse(arrayBuffer, sportType) {
    var buffer = new Uint8Array(arrayBuffer);
    var matches = [];
    var topFields = readFields2(buffer);
    var statusChunk = topFields.get(3) && topFields.get(3)[0];
    var status = statusChunk ? textDecoder.decode(statusChunk) : "";
    if (status !== "Success") return matches;

    var payloadChunk = topFields.get(10) && topFields.get(10)[0];
    if (!payloadChunk) return matches;

    var payloadFields = readFields2(payloadChunk);
    var liveMatchIds = new Set();

    var field2 = payloadFields.get(2) || [];
    for (var i = 0; i < field2.length; i++) {
      try {
        var inner = readFields2(field2[i]);
        var matchId = readVarintField2(inner.get(50) && inner.get(50)[0]);
        if (matchId && matchId > 1e5) liveMatchIds.add(matchId);
      } catch (e) {
      }
    }

    var entries = payloadFields.get(1) || [];
    for (var j = 0; j < entries.length; j++) {
      try {
        var entryBuf = entries[j];
        var fields = readFields2(entryBuf);
        var matchId2 = readVarintField2(fields.get(1) && fields.get(1)[0]);
        if (!matchId2 || matchId2 < 1e5) continue;

        var statusValue = readVarintField2(fields.get(22) && fields.get(22)[0]);
        if (statusValue === 3) continue;

        var isLive = liveMatchIds.has(matchId2);
        if (!isLive) continue;

        var strings = extractStringsFromBuffer(entryBuf);

        var cleanCtrl = function (s) {
          return s.replace(/[^\x20-\x7E]+/g, " ").replace(/^\W+/, "").trim();
        };

        var leagueStrRaw = undefined;
        for (var k = 0; k < strings.length; k++) {
          var s = cleanCtrl(strings[k]);
          if (!s.startsWith("http") && s.length > 3 && !/^\d/.test(s) && s.split(" ").length > 1) {
            leagueStrRaw = s;
            break;
          }
        }
        var leagueStr = leagueStrRaw ? leagueStrRaw.split("http")[0].split('"')[0].trim() : "";

        var vsRaw = undefined;
        for (var m = 0; m < strings.length; m++) {
          if (strings[m].includes(" vs ")) {
            vsRaw = strings[m];
            break;
          }
        }
        var vsStr = vsRaw ? cleanCtrl(vsRaw) : null;

        if (vsStr) {
          var cleaned = vsStr.replace(/\s+/g, " ").trim();
          var parts = cleaned.split(" vs ");
          var home = parts[0].trim();
          var away = parts[1].trim();
          var slug = (home + " " + away).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
          var mdata = base64Encode(matchId2 + "_" + sportType);
          var sportSlug = SPORT_NAMES[sportType] || "others";
          matches.push({
            matchId: matchId2,
            league: leagueStr || "",
            home: home,
            away: away,
            name: cleaned,
            url: MATCH_ORIGIN + "/" + sportSlug + "/" + slug + "-" + matchId2 + ".html?mdata=" + encodeURIComponent(mdata),
            source: MATCH_SOURCE,
            status: "live",
            sport: sportSlug
          });
        }
      } catch (e) {
      }
    }
    return matches;
  }

  window.parseMatchesFromBuffer = parseMatchListResponse;
})();
