(function () {
  "use strict";

  var SPORT_SLUGS = {
    football: 1, basketball: 2, tennis: 3, baseball: 4, cricket: 6,
    motorsport: 7, rugby: 8, "american-football": 9, "aussie-rules": 10,
    hockey: 11, badminton: 12, volleyball: 13, fighting: 14, cycling: 15,
    handball: 16, others: 90
  };

  var SPORT_NAMES = {};
  Object.keys(SPORT_SLUGS).forEach(function(k) { SPORT_NAMES[SPORT_SLUGS[k]] = k; });

  var MATCH_SOURCE = "jack27eo.mpgreatestclgczbmiddle.my";
  var MATCH_ORIGIN = "https://" + MATCH_SOURCE;

  var textDecoder = new TextDecoder("utf-8");

  function readVarint(buf, off) {
    var value = 0, shift = 0;
    while (off < buf.length) {
      var byte = buf[off++];
      value |= (byte & 127) << shift;
      if ((byte & 128) === 0) break;
      shift += 7;
    }
    return [value, off];
  }

  function readField(buf, off) {
    var tag = readVarint(buf, off);
    var field = tag[0] >> 3;
    var wire = tag[0] & 7;
    off = tag[1];

    if (wire === 0) {
      var val = readVarint(buf, off);
      return { field: field, wire: wire, value: val[0], next: val[1] };
    }
    if (wire === 2) {
      var len = readVarint(buf, off);
      var start = len[1];
      var end = start + len[0];
      return { field: field, wire: wire, data: buf.subarray(start, end), len: len[0], next: end };
    }
    if (wire === 1) return { field: field, wire: wire, next: off + 8 };
    if (wire === 5) return { field: field, wire: wire, next: off + 4 };
    return null;
  }

  function parseFields(buf) {
    var fields = [];
    var off = 0;
    while (off < buf.length) {
      try {
        var f = readField(buf, off);
        if (!f) break;
        fields.push(f);
        off = f.next;
      } catch (e) {
        break;
      }
    }
    return fields;
  }

  function getField(fields, num) {
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].field === num) return fields[i];
    }
    return null;
  }

  function getAllFields(fields, num) {
    var result = [];
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].field === num) result.push(fields[i]);
    }
    return result;
  }

  function getVarint(fields, num) {
    var f = getField(fields, num);
    return (f && f.wire === 0) ? f.value : undefined;
  }

  function getString(fields, num) {
    var f = getField(fields, num);
    if (f && f.wire === 2) {
      var s = textDecoder.decode(f.data);
      if (/^[\x20-\x7E\s]+$/.test(s) && s.length > 1) return s;
    }
    return undefined;
  }

  function base64Encode(input) {
    var bytes = new TextEncoder().encode(input);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  var MATCH_STATUS = {
    0: "not_started", 1: "first_half", 2: "halftime", 3: "second_half",
    4: "extra_time", 5: "penalties", 6: "finished",
    7: "postponed", 8: "cancelled", 9: "suspended"
  };

  function formatKickoffTime(startTime) {
    if (!startTime) return null;
    var d = new Date(startTime);
    return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
  }

  function formatDateLabel(startTime) {
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

  function getStatusDisplay(matchObj) {
    var status = matchObj.matchStatusText;
    switch (status) {
      case "not_started":
        if (matchObj.kickoffTime) {
          return { text: matchObj.kickoffTime, color: "scheduled", icon: "clock" };
        }
        return { text: "SCHEDULED", color: "scheduled", icon: "clock" };
      case "first_half":
      case "second_half":
      case "extra_time":
      case "penalties":
        var minute = matchObj.matchMinute || "";
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
        return { text: "", color: "", icon: "" };
    }
  }

  function parseMatchListResponse(arrayBuffer, sportType) {
    var buffer = new Uint8Array(arrayBuffer);
    var matches = [];

    var topFields = parseFields(buffer);
    var statusField = getField(topFields, 3);
    var status = statusField && statusField.data ? textDecoder.decode(statusField.data) : "";
    if (status !== "Success") return matches;

    var payloadField = getField(topFields, 10);
    if (!payloadField || !payloadField.data) return matches;

    var payloadFields = parseFields(payloadField.data);

    var liveIdEntries = getAllFields(payloadFields, 2);
    var liveIds = new Set();
    for (var i = 0; i < liveIdEntries.length; i++) {
      if (liveIdEntries[i].wire !== 2) continue;
      var inner = parseFields(liveIdEntries[i].data);
      var mid = getVarint(inner, 50);
      if (mid && mid > 100000) liveIds.add(mid);
    }

    var entries = getAllFields(payloadFields, 1);
    for (var j = 0; j < entries.length; j++) {
      if (entries[j].wire !== 2) continue;
      try {
        var fields = parseFields(entries[j].data);

        var matchId = getVarint(fields, 1);
        if (!matchId || matchId < 100000) continue;

        var statusValue = getVarint(fields, 22);
        var minuteRaw = getVarint(fields, 4);
        var matchMinute = (minuteRaw !== undefined && minuteRaw > 0 && minuteRaw < 120) ? minuteRaw : null;

        var matchStatusText = MATCH_STATUS[statusValue] || "unknown";

        var isLive;
        if (statusValue !== undefined && statusValue > 0 && statusValue < 6) {
          isLive = true;
        } else if (statusValue === 6) {
          isLive = false;
        } else {
          isLive = liveIds.has(matchId);
          if (isLive) matchStatusText = "first_half";
        }

        var homeScore = null;
        var awayScore = null;
        var f100 = getField(fields, 100);
        if (f100 && f100.wire === 2 && f100.len > 2) {
          var inner100 = parseFields(f100.data);
          var homeScoreData = getField(inner100, 1);
          var awayScoreData = getField(inner100, 2);
          if (homeScoreData && homeScoreData.wire === 2) {
            var hFields = parseFields(homeScoreData.data);
            var hScore = getVarint(hFields, 10);
            if (hScore !== undefined) homeScore = hScore;
          }
          if (awayScoreData && awayScoreData.wire === 2) {
            var aFields = parseFields(awayScoreData.data);
            var aScore = getVarint(aFields, 10);
            if (aScore !== undefined) awayScore = aScore;
          }
        }

        var startTime = null;
        var f150 = getField(fields, 150);
        var leagueSlug = "";
        var matchSlug = "";
        if (f150 && f150.wire === 2) {
          var inner150 = parseFields(f150.data);
          leagueSlug = getString(inner150, 21) || "";
          matchSlug = getString(inner150, 20) || "";
          var tsField = getField(inner150, 3);
          if (tsField && tsField.wire === 0) {
            var ts = tsField.value;
            if (ts > 1000000000 && ts < 4000000000) startTime = ts * 1000;
          }
        }

        var homeTeam = "";
        var awayTeam = "";
        var teamInfoEntries = getAllFields(fields, 30);
        if (teamInfoEntries.length >= 3) {
          var homeInfoField = teamInfoEntries[1];
          if (homeInfoField.wire === 2) {
            var homeInner = parseFields(homeInfoField.data);
            var homeTeamField = getField(homeInner, 10);
            if (homeTeamField && homeTeamField.wire === 2) {
              var ht = parseFields(homeTeamField.data);
              var nameField = getField(ht, 3);
              if (nameField && nameField.wire === 2) {
                var nameInner = parseFields(nameField.data);
                homeTeam = getString(nameInner, 2) || "";
              }
            }
          }
          var awayInfoField = teamInfoEntries[2];
          if (awayInfoField.wire === 2) {
            var awayInner = parseFields(awayInfoField.data);
            var awayTeamField = getField(awayInner, 10);
            if (awayTeamField && awayTeamField.wire === 2) {
              var at = parseFields(awayTeamField.data);
              var nameField2 = getField(at, 3);
              if (nameField2 && nameField2.wire === 2) {
                var nameInner2 = parseFields(nameField2.data);
                awayTeam = getString(nameInner2, 2) || "";
              }
            }
          }
        }

        if (!homeTeam || !awayTeam) {
          var nameField30 = teamInfoEntries.length > 0 ? teamInfoEntries[0] : null;
          if (nameField30 && nameField30.wire === 2) {
            var inner30 = parseFields(nameField30.data);
            var vsStr = getString(inner30, 2) || "";
            if (vsStr.indexOf(" vs ") !== -1) {
              var parts = vsStr.split(" vs ");
              if (!homeTeam) homeTeam = parts[0].trim();
              if (!awayTeam) awayTeam = parts.slice(1).join(" vs ").trim();
            }
          }
        }

        if (!homeTeam || !awayTeam) continue;
        if (homeTeam.length < 2 || awayTeam.length < 2) continue;

        var slug = (homeTeam + " " + awayTeam).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        var mdata = base64Encode(matchId + "_" + sportType);
        var sportSlug = SPORT_NAMES[sportType] || "others";

        var homeTeamId = null;
        var awayTeamId = null;
        var teamIdFields = [2, 3, 4, 5, 6, 7, 8];
        for (var t = 0; t < teamIdFields.length; t++) {
          var tv = getVarint(fields, teamIdFields[t]);
          if (tv !== undefined && tv > 1000) {
            if (homeTeamId === null) homeTeamId = tv;
            else if (awayTeamId === null) awayTeamId = tv;
          }
        }

        var matchObj = {
          matchId: matchId,
          league: leagueSlug ? leagueSlug.replace(/-{2,}/g, "-").replace(/-/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); }) : "",
          leagueSlug: leagueSlug,
          home: homeTeam,
          away: awayTeam,
          name: homeTeam + " vs " + awayTeam,
          url: MATCH_ORIGIN + "/" + sportSlug + "/" + (matchSlug || slug) + "-" + matchId + ".html?mdata=" + encodeURIComponent(mdata),
          source: MATCH_SOURCE,
          sport: sportSlug,
          homeScore: homeScore,
          awayScore: awayScore,
          startTime: startTime,
          matchMinute: matchMinute,
          matchStatus: statusValue,
          isLive: isLive,
          homeTeamId: homeTeamId,
          awayTeamId: awayTeamId,
          statusValue: statusValue,
          statusDisplay: null,
          matchStatusText: matchStatusText,
          kickoffTime: startTime ? formatKickoffTime(startTime) : null,
          kickoffDate: startTime ? formatDateLabel(startTime) : null,
          timeUntil: null
        };

        matchObj.statusDisplay = getStatusDisplay(matchObj);

        matches.push(matchObj);
      } catch (e) {
      }
    }
    return matches;
  }

  window.parseMatchesFromBuffer = parseMatchListResponse;
})();
