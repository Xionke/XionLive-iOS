(function() {
  "use strict";

  var LEAGUE_LOGOS = {
    "premier league": "https://r2.thesportsdb.com/images/media/league/logo/1on3vo1689350268.png",
    "la liga": "https://r2.thesportsdb.com/images/media/league/logo/xzqdr11517660252.png",
    "liga bbva": "https://r2.thesportsdb.com/images/media/league/logo/xzqdr11517660252.png",
    "serie a": "https://r2.thesportsdb.com/images/media/league/logo/iu0qtv1508194834.png",
    "bundesliga": "https://r2.thesportsdb.com/images/media/league/logo/rwqtbl1473502969.png",
    "ligue 1": "https://r2.thesportsdb.com/images/media/league/logo/piitxo1517841263.png",
    "eredivisie": "https://r2.thesportsdb.com/images/media/league/logo/uetcuq1436067553.png",
    "champions league": "https://r2.thesportsdb.com/images/media/league/logo/uvxuyq1430812772.png",
    "uefa champions league": "https://r2.thesportsdb.com/images/media/league/logo/uvxuyq1430812772.png",
    "europa league": "https://r2.thesportsdb.com/images/media/league/logo/irock0p1487707575.png",
    "uefa europa league": "https://r2.thesportsdb.com/images/media/league/logo/irock0p1487707575.png",
    "conference league": "https://r2.thesportsdb.com/images/media/league/logo/y46j5i1689350480.png",
    "jupiler pro league": "https://r2.thesportsdb.com/images/media/league/logo/jhlv1u1517701970.png",
    "belgian pro league": "https://r2.thesportsdb.com/images/media/league/logo/jhlv1u1517701970.png",
    "pro league": "https://r2.thesportsdb.com/images/media/league/logo/jhlv1u1517701970.png",
    "primeira liga": "https://r2.thesportsdb.com/images/media/league/logo/z0v42n1588105413.png",
    "liga portugal": "https://r2.thesportsdb.com/images/media/league/logo/z0v42n1588105413.png",
    "scottish premiership": "https://r2.thesportsdb.com/images/media/league/logo/vwqwrw1473503021.png",
    "nfl": "https://r2.thesportsdb.com/images/media/league/i9a2dr1517660255.png",
    "nba": "https://r2.thesportsdb.com/images/media/league/1588102312.png",
    "mlb": "https://r2.thesportsdb.com/images/media/league/wbosia1517702837.png",
    "nhl": "https://r2.thesportsdb.com/images/media/league/u0q1l11517701590.png"
  };

  var LOGOS_CACHE_KEY = "xion_team_logos";
  var COLORS_CACHE_KEY = "xion_team_colors";
  var logoCache = {};
  var colorCache = {};
  try { logoCache = JSON.parse(localStorage.getItem(LOGOS_CACHE_KEY) || "{}"); } catch(e) {}
  try { colorCache = JSON.parse(localStorage.getItem(COLORS_CACHE_KEY) || "{}"); } catch(e) {}

  function saveCache() {
    try { localStorage.setItem(LOGOS_CACHE_KEY, JSON.stringify(logoCache)); } catch(e) {}
  }

  function saveColorCache() {
    try { localStorage.setItem(COLORS_CACHE_KEY, JSON.stringify(colorCache)); } catch(e) {}
  }

  var FALLBACK_COLORS = [
    "#1e90ff", "#e74c3c", "#2ecc71", "#f39c12", "#9b59b6",
    "#1abc9c", "#e67e22", "#3498db", "#e91e63", "#00bcd4"
  ];

  function getColorForName(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
    return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
  }

  function getTeamColor(teamName) {
    if (!teamName) return null;
    var key = teamName.toLowerCase().trim();
    if (colorCache[key]) return colorCache[key];
    return null;
  }

  function getInitials(name) {
    if (!name) return "?";
    var parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }

  function getTeamLogo(teamName) {
    if (!teamName) return null;
    var key = teamName.toLowerCase().trim();
    return logoCache[key] || null;
  }

  function getLeagueLogo(league) {
    if (!league) return null;
    var key = league.toLowerCase().trim();
    if (LEAGUE_LOGOS[key]) return LEAGUE_LOGOS[key];
    for (var k in LEAGUE_LOGOS) {
      if (key.indexOf(k) !== -1 || k.indexOf(key) !== -1) return LEAGUE_LOGOS[k];
    }
    return null;
  }

  var pendingFetches = {};
  function fetchTeamLogo(teamName) {
    if (!teamName) return Promise.resolve(null);
    var key = teamName.toLowerCase().trim();
    if (logoCache[key]) return Promise.resolve(logoCache[key]);
    if (pendingFetches[key]) return pendingFetches[key];

    var url = "https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=" + encodeURIComponent(teamName);
    var p = fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var teams = d && d.teams;
        if (teams && teams.length) {
          var team = teams[0];
          var badge = team.strBadge || team.strLogo;
          if (badge) {
            logoCache[key] = badge;
            saveCache();
          }
          var colour = team.strColour1;
          if (colour && !colorCache[key]) {
            colorCache[key] = colour.startsWith("#") ? colour : "#" + colour;
            saveColorCache();
          }
          delete pendingFetches[key];
          return badge;
        }
        logoCache[key] = null;
        saveCache();
        delete pendingFetches[key];
        return null;
      })
      .catch(function() {
        delete pendingFetches[key];
        return null;
      });
    pendingFetches[key] = p;
    return p;
  }

  function fetchAllTeamLogos(matches) {
    var names = {};
    for (var i = 0; i < matches.length; i++) {
      if (matches[i].home) names[matches[i].home] = true;
      if (matches[i].away) names[matches[i].away] = true;
    }
    for (var name in names) {
      if (!logoCache[name.toLowerCase().trim()]) fetchTeamLogo(name);
    }
  }

  function getTeamGradient(homeName, awayName) {
    var hColor = getTeamColor(homeName) || getColorForName(homeName);
    var aColor = getTeamColor(awayName) || getColorForName(awayName);
    return "linear-gradient(135deg, " + hexToRgba(hColor, 0.12) + " 0%, " + hexToRgba(aColor, 0.12) + " 100%)";
  }

  function hexToRgba(hex, alpha) {
    hex = hex.replace("#", "");
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  window.XionLogos = {
    getLeagueLogo: getLeagueLogo,
    getTeamLogo: getTeamLogo,
    getInitials: getInitials,
    getColorForName: getColorForName,
    getTeamColor: getTeamColor,
    getTeamGradient: getTeamGradient,
    fetchTeamLogo: fetchTeamLogo,
    fetchAllTeamLogos: fetchAllTeamLogos
  };
})();
