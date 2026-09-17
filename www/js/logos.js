(function() {
  "use strict";

  var LEAGUE_LOGOS = {
    "premier league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/17/image.png",
    "la liga": "https://img.cdn.sofascore.app/api/v1/unique-tournament/8/image.png",
    "serie a": "https://img.cdn.sofascore.app/api/v1/unique-tournament/23/image.png",
    "bundesliga": "https://img.cdn.sofascore.app/api/v1/unique-tournament/35/image.png",
    "ligue 1": "https://img.cdn.sofascore.app/api/v1/unique-tournament/34/image.png",
    "eredivisie": "https://img.cdn.sofascore.app/api/v1/unique-tournament/37/image.png",
    "champions league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/7/image.png",
    "europa league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/679/image.png",
    "conference league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/17014/image.png",
    "jupiler pro league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/52/image.png",
    "belgian pro league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/52/image.png",
    "pro league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/52/image.png",
    "eredivisie": "https://img.cdn.sofascore.app/api/v1/unique-tournament/37/image.png",
    "nfl": "https://img.cdn.sofascore.app/api/v1/unique-tournament/1/image.png",
    "mlb": "https://img.cdn.sofascore.app/api/v1/unique-tournament/20/image.png",
    "nba": "https://img.cdn.sofascore.app/api/v1/unique-tournament/4/image.png",
    "nhl": "https://img.cdn.sofascore.app/api/v1/unique-tournament/6/image.png"
  };

  var SPORT_ICONS = {
    football: "\u26BD",
    basketball: "\uD83C\uDFC0",
    tennis: "\uD83C\uDFBE",
    baseball: "\u26BE",
    cricket: "\uD83C\uDFCF",
    motorsport: "\uD83C\uDFCE\uFE0F",
    rugby: "\uD83C\uDFC9",
    "american-football": "\uD83C\uDFC8",
    hockey: "\uD83C\uDFD2",
    badminton: "\uD83C\uDFD8\uFE0F",
    volleyball: "\uD83C\uDFD0",
    fighting: "\uD83E\uDD4A",
    cycling: "\uD83D\uDEB4",
    handball: "\uD83C\uDFD0"
  };

  var COLORS = [
    "#1e90ff", "#e74c3c", "#2ecc71", "#f39c12", "#9b59b6",
    "#1abc9c", "#e67e22", "#3498db", "#e91e63", "#00bcd4"
  ];

  function getColorForName(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
    return COLORS[Math.abs(hash) % COLORS.length];
  }

  function getInitials(name) {
    if (!name) return "?";
    var parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }

  function getLeagueLogo(league) {
    if (!league) return null;
    var key = league.toLowerCase().trim();
    for (var k in LEAGUE_LOGOS) {
      if (key.indexOf(k) !== -1 || k.indexOf(key) !== -1) return LEAGUE_LOGOS[k];
    }
    return null;
  }

  function getSportIcon(sport) {
    return SPORT_ICONS[sport] || "\uD83C\uDFC6";
  }

  window.XionLogos = {
    getLeagueLogo: getLeagueLogo,
    getSportIcon: getSportIcon,
    getInitials: getInitials,
    getColorForName: getColorForName
  };
})();
