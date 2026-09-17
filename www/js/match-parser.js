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

  function extractAllFields(buffer) {
    var result = { varints: {}, strings: {}, nested: {} };
    var offset = 0;
    while (offset < buffer.length) {
      try {
        var tagResult = readVarint2(buffer, offset);
        var tag = tagResult[0];
        offset = tagResult[1];
        var field = tag >> 3;
        var wire = tag & 7;
        if (wire === 0) {
          var valResult = readVarint2(buffer, offset);
          var value = valResult[0];
          offset = valResult[1];
          if (!result.varints[field]) result.varints[field] = [];
          result.varints[field].push(value);
        } else if (wire === 2) {
          var chunkResult = readLengthDelimited2(buffer, offset);
          var chunk = chunkResult[0];
          offset = chunkResult[1];
          var str = textDecoder.decode(chunk);
          if (str.length > 1 && /^[\x20-\x7E\s]+$/.test(str)) {
            if (!result.strings[field]) result.strings[field] = [];
            result.strings[field].push(str);
          }
          if (chunk.length > 2) {
            try {
              var inner = readFields2(chunk);
              var hasVarints = false;
              inner.forEach(function(v, k) {
                if (v.length > 0) {
                  var sample = v[0];
                  if (sample.length <= 8) hasVarints = true;
                }
              });
              if (hasVarints && inner.size > 0) {
                if (!result.nested[field]) result.nested[field] = [];
                result.nested[field].push(inner);
              }
            } catch (e) {}
          }
        } else if (wire === 1) {
          offset += 8;
        } else if (wire === 5) {
          offset += 4;
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    }
    return result;
  }

  function base64Encode(input) {
    var bytes = new TextEncoder().encode(input);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  var MATCH_STATUS = {
    0: "not_started",
    1: "first_half",
    2: "halftime",
    3: "second_half",
    4: "extra_time",
    5: "penalties",
    6: "finished",
    7: "postponed",
    8: "cancelled",
    9: "suspended"
  };

  function formatMatchTime(startTime) {
    if (!startTime) return null;
    var now = Date.now();
    var diff = startTime - now;
    if (diff > 0) {
      var mins = Math.floor(diff / 60000);
      var hours = Math.floor(mins / 60);
      mins = mins % 60;
      if (hours > 24) {
        var days = Math.floor(hours / 24);
        hours = hours % 24;
        return days + "d " + hours + "h";
      }
      if (hours > 0) return hours + "h " + mins + "m";
      return mins + "m";
    }
    return null;
  }

  function formatKickoffTime(startTime) {
    if (!startTime) return null;
    var d = new Date(startTime);
    var h = d.getHours().toString().padStart(2, "0");
    var m = d.getMinutes().toString().padStart(2, "0");
    return h + ":" + m;
  }

  function formatDate(startTime) {
    if (!startTime) return null;
    var d = new Date(startTime);
    var now = new Date();
    var diff = d.setHours(0,0,0,0) - now.setHours(0,0,0,0);
    var dayMs = 86400000;
    if (diff === 0) return "Today";
    if (diff === dayMs) return "Tomorrow";
    if (diff === -dayMs) return "Yesterday";
    var days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return days[d.getDay()] + " " + months[d.getMonth()] + " " + d.getDate();
  }

  function getMatchStatus(matchObj) {
    if (matchObj.matchStatus !== undefined && matchObj.matchStatus !== null) {
      return MATCH_STATUS[matchObj.matchStatus] || "unknown";
    }
    if (matchObj.isLive) return "live";
    if (matchObj.homeScore !== null && matchObj.homeScore !== undefined) return "finished";
    return "not_started";
  }

  function getStatusDisplay(matchObj) {
    var status = getMatchStatus(matchObj);
    switch (status) {
      case "not_started":
        if (matchObj.startTime) {
          return { text: formatKickoffTime(matchObj.startTime), color: "scheduled", icon: "clock" };
        }
        return { text: "SCHEDULED", color: "scheduled", icon: "clock" };
      case "first_half":
      case "second_half":
      case "extra_time":
      case "penalties":
        var minute = matchObj.minute || "";
        return { text: (minute ? minute + "' " : "") + "LIVE", color: "live", icon: "pulse" };
      case "halftime":
        return { text: "HT", color: "ht", icon: "pause" };
      case "finished":
        return { text: "FT", color: "ft", icon: "flag" };
      case "postponed":
        return { text: "POSTPONED", color: "postponed", icon: "clock" };
      case "cancelled":
        return { text: "CANCELLED", color: "cancelled", icon: "x" };
      case "suspended":
        return { text: "SUSPENDED", color: "suspended", icon: "pause" };
      default:
        if (matchObj.isLive) return { text: "LIVE", color: "live", icon: "pulse" };
        return { text: "", color: "", icon: "" };
    }
  }

  function tryIdentifyScores(allVarints) {
    var scores = {};
    var keys = Object.keys(allVarints);
    for (var i = 0; i < keys.length; i++) {
      var fnum = parseInt(keys[i], 10);
      var vals = allVarints[fnum];
      if (vals && vals.length === 1 && vals[0] >= 0 && vals[0] <= 30) {
        scores[fnum] = vals[0];
      }
    }
    return scores;
  }

  function tryIdentifyTime(allVarints) {
    var timestamps = {};
    var keys = Object.keys(allVarints);
    for (var i = 0; i < keys.length; i++) {
      var fnum = parseInt(keys[i], 10);
      var vals = allVarints[fnum];
      if (vals && vals.length === 1 && vals[0] > 1000000000 && vals[0] < 4000000000) {
        timestamps[fnum] = vals[0] * 1000;
      }
    }
    return timestamps;
  }

  function tryIdentifyMinute(allVarints) {
    var minutes = {};
    var keys = Object.keys(allVarints);
    for (var i = 0; i < keys.length; i++) {
      var fnum = parseInt(keys[i], 10);
      var vals = allVarints[fnum];
      if (vals && vals.length === 1 && vals[0] >= 0 && vals[0] <= 120) {
        minutes[fnum] = vals[0];
      }
    }
    return minutes;
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

        var allData = extractAllFields(entryBuf);

        var isLive = liveMatchIds.has(matchId2);
        var homeScore = null;
        var awayScore = null;
        var startTime = null;
        var matchMinute = null;
        var matchStatus = null;
        var homeTeamId = null;
        var awayTeamId = null;

        var possibleScores = tryIdentifyScores(allData.varints);
        var possibleTimes = tryIdentifyTime(allData.varints);
        var possibleMinutes = tryIdentifyMinute(allData.varints);

        var scoreFields = Object.keys(possibleScores);
        if (scoreFields.length >= 2) {
          var sf = scoreFields.map(Number).sort(function(a, b) { return a - b; });
          homeScore = possibleScores[sf[0]];
          awayScore = possibleScores[sf[1]];
        } else if (scoreFields.length === 1) {
          homeScore = possibleScores[scoreFields[0]];
          awayScore = 0;
        }

        var timeFields = Object.keys(possibleTimes);
        if (timeFields.length > 0) {
          var tf = timeFields.map(Number).sort(function(a, b) { return a - b; });
          startTime = possibleTimes[tf[0]];
        }

        var minuteFields = Object.keys(possibleMinutes);
        if (minuteFields.length > 0) {
          var mf = minuteFields.map(Number).sort(function(a, b) { return a - b; });
          matchMinute = possibleMinutes[mf[0]];
        }

        if (statusValue !== undefined && statusValue !== null) {
          matchStatus = statusValue;
        }

        var teamIdFields = [2, 3, 4, 5, 6, 7, 8];
        for (var t = 0; t < teamIdFields.length; t++) {
          var tfn = teamIdFields[t];
          var tv = allData.varints[tfn];
          if (tv && tv.length === 1 && tv[0] > 1000) {
            if (homeTeamId === null) homeTeamId = tv[0];
            else if (awayTeamId === null) awayTeamId = tv[0];
          }
        }

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

          var matchObj = {
            matchId: matchId2,
            league: leagueStr || "",
            home: home,
            away: away,
            name: cleaned,
            url: MATCH_ORIGIN + "/" + sportSlug + "/" + slug + "-" + matchId2 + ".html?mdata=" + encodeURIComponent(mdata),
            source: MATCH_SOURCE,
            sport: sportSlug,
            homeScore: homeScore,
            awayScore: awayScore,
            startTime: startTime,
            matchMinute: matchMinute,
            matchStatus: matchStatus,
            isLive: isLive,
            homeTeamId: homeTeamId,
            awayTeamId: awayTeamId,
            statusValue: statusValue,
            statusDisplay: null,
            matchStatusText: null,
            kickoffTime: null,
            kickoffDate: null,
            timeUntil: null
          };

          matchObj.statusDisplay = getStatusDisplay(matchObj);
          matchObj.matchStatusText = getMatchStatus(matchObj);
          matchObj.kickoffTime = startTime ? formatKickoffTime(startTime) : null;
          matchObj.kickoffDate = startTime ? formatDate(startTime) : null;
          matchObj.timeUntil = startTime ? formatMatchTime(startTime) : null;

          matches.push(matchObj);
        }
      } catch (e) {
      }
    }
    return matches;
  }

  window.parseMatchesFromBuffer = parseMatchListResponse;
})();
