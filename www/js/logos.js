(function() {
  "use strict";

  var LEAGUE_LOGOS = {
    "premier league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/17/image.png",
    "la liga": "https://img.cdn.sofascore.app/api/v1/unique-tournament/8/image.png",
    "liga bbva": "https://img.cdn.sofascore.app/api/v1/unique-tournament/8/image.png",
    "serie a": "https://img.cdn.sofascore.app/api/v1/unique-tournament/23/image.png",
    "bundesliga": "https://img.cdn.sofascore.app/api/v1/unique-tournament/35/image.png",
    "ligue 1": "https://img.cdn.sofascore.app/api/v1/unique-tournament/34/image.png",
    "eredivisie": "https://img.cdn.sofascore.app/api/v1/unique-tournament/37/image.png",
    "champions league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/7/image.png",
    "uefa champions league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/7/image.png",
    "europa league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/679/image.png",
    "uefa europa league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/679/image.png",
    "conference league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/17014/image.png",
    "uefa conference league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/17014/image.png",
    "jupiler pro league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/52/image.png",
    "belgian pro league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/52/image.png",
    "pro league": "https://img.cdn.sofascore.app/api/v1/unique-tournament/52/image.png",
    "primeira liga": "https://img.cdn.sofascore.app/api/v1/unique-tournament/238/image.png",
    "liga portugal": "https://img.cdn.sofascore.app/api/v1/unique-tournament/238/image.png",
    "scottish premiership": "https://img.cdn.sofascore.app/api/v1/unique-tournament/196/image.png",
    "turkish super lig": "https://img.cdn.sofascore.app/api/v1/unique-tournament/52/image.png",
    "super lig": "https://img.cdn.sofascore.app/api/v1/unique-tournament/52/image.png",
    "nfl": "https://img.cdn.sofascore.app/api/v1/unique-tournament/1/image.png",
    "mlb": "https://img.cdn.sofascore.app/api/v1/unique-tournament/20/image.png",
    "nba": "https://img.cdn.sofascore.app/api/v1/unique-tournament/4/image.png",
    "nhl": "https://img.cdn.sofascore.app/api/v1/unique-tournament/6/image.png"
  };

  var TEAM_LOGOS = {
    "manchester city": "https://img.cdn.sofascore.app/api/v1/team/17/image.png",
    "man city": "https://img.cdn.sofascore.app/api/v1/team/17/image.png",
    "arsenal": "https://img.cdn.sofascore.app/api/v1/team/42/image.png",
    "liverpool": "https://img.cdn.sofascore.app/api/v1/team/44/image.png",
    "chelsea": "https://img.cdn.sofascore.app/api/v1/team/35/image.png",
    "manchester united": "https://img.cdn.sofascore.app/api/v1/team/35/image.png",
    "man united": "https://img.cdn.sofascore.app/api/v1/team/35/image.png",
    "man utd": "https://img.cdn.sofascore.app/api/v1/team/35/image.png",
    "tottenham": "https://img.cdn.sofascore.app/api/v1/team/46/image.png",
    "tottenham hotspur": "https://img.cdn.sofascore.app/api/v1/team/46/image.png",
    "spurs": "https://img.cdn.sofascore.app/api/v1/team/46/image.png",
    "newcastle": "https://img.cdn.sofascore.app/api/v1/team/56/image.png",
    "newcastle united": "https://img.cdn.sofascore.app/api/v1/team/56/image.png",
    "aston villa": "https://img.cdn.sofascore.app/api/v1/team/40/image.png",
    "west ham": "https://img.cdn.sofascore.app/api/v1/team/48/image.png",
    "west ham united": "https://img.cdn.sofascore.app/api/v1/team/48/image.png",
    "brighton": "https://img.cdn.sofascore.app/api/v1/team/51/image.png",
    "brighton & hove albion": "https://img.cdn.sofascore.app/api/v1/team/51/image.png",
    "crystal palace": "https://img.cdn.sofascore.app/api/v1/team/33/image.png",
    "wolves": "https://img.cdn.sofascore.app/api/v1/team/49/image.png",
    "wolverhampton": "https://img.cdn.sofascore.app/api/v1/team/49/image.png",
    "fulham": "https://img.cdn.sofascore.app/api/v1/team/36/image.png",
    "brentford": "https://img.cdn.sofascore.app/api/v1/team/55/image.png",
    "nottingham forest": "https://img.cdn.sofascore.app/api/v1/team/65/image.png",
    "everton": "https://img.cdn.sofascore.app/api/v1/team/29/image.png",
    "bournemouth": "https://img.cdn.sofascore.app/api/v1/team/1/image.png",
    "afc bournemouth": "https://img.cdn.sofascore.app/api/v1/team/1/image.png",
    "ipswich": "https://img.cdn.sofascore.app/api/v1/team/38/image.png",
    "ipswich town": "https://img.cdn.sofascore.app/api/v1/team/38/image.png",
    "leicester": "https://img.ciden.sofascore.app/api/v1/team/30/image.png",
    "leicester city": "https://img.cdn.sofascore.app/api/v1/team/30/image.png",
    "southampton": "https://img.cdn.sofascore.app/api/v1/team/45/image.png",
    "burnley": "https://img.cdn.sofascore.app/api/v1/team/90/image.png",

    "real madrid": "https://img.cdn.sofascore.app/api/v1/team/2829/image.png",
    "fc barcelona": "https://img.cdn.sofascore.app/api/v1/team/2817/image.png",
    "barcelona": "https://img.cdn.sofascore.app/api/v1/team/2817/image.png",
    "atletico madrid": "https://img.cdn.sofascore.app/api/v1/team/2833/image.png",
    "atl. madrid": "https://img.cdn.sofascore.app/api/v1/team/2833/image.png",
    "real sociedad": "https://img.cdn.sofascore.app/api/v1/team/2832/image.png",
    "real betis": "https://img.cdn.sofascore.app/api/v1/team/2828/image.png",
    "villarreal": "https://img.cdn.sofascore.app/api/v1/team/2838/image.png",
    "athletic club": "https://img.cdn.sofascore.app/api/v1/team/2819/image.png",
    "athletic bilbao": "https://img.cdn.sofascore.app/api/v1/team/2819/image.png",
    "girona": "https://img.cdn.sofascore.app/api/v1/team/2837/image.png",
    "real valladolid": "https://img.cdn.sofascore.app/api/v1/team/2835/image.png",
    "rayo vallecano": "https://img.cdn.sofascore.app/api/v1/team/2831/image.png",
    "celta vigo": "https://img.cdn.sofascore.app/api/v1/team/2822/image.png",
    "sevilla": "https://img.cdn.sofascore.app/api/v1/team/2834/image.png",
    "getafe": "https://img.cdn.sofascore.app/api/v1/team/2825/image.png",
    "espanyol": "https://img.cdn.sofascore.app/api/v1/team/2824/image.png",
    "mallorca": "https://img.cdn.sofascore.app/api/v1/team/2827/image.png",
    "las palmas": "https://img.cdn.sofascore.app/api/v1/team/2826/image.png",
    "osasuna": "https://img.cdn.sofascore.app/api/v1/team/2830/image.png",
    "alaves": "https://img.cdn.sofascore.app/api/v1/team/2818/image.png",
    "leganes": "https://img.cdn.sofascore.app/api/v1/team/3692/image.png",
    "valencia": "https://img.cdn.sofascore.app/api/v1/team/2837/image.png",

    "bayern munchen": "https://img.cdn.sofascore.app/api/v1/team/35/image.png",
    "bayern munich": "https://img.cdn.sofascore.app/api/v1/team/35/image.png",
    "bayern": "https://img.cdn.sofascore.app/api/v1/team/35/image.png",
    "borussia dortmund": "https://img.cdn.sofascore.app/api/v1/team/36/image.png",
    "dortmund": "https://img.cdn.sofascore.app/api/v1/team/36/image.png",
    "bvb": "https://img.cdn.sofascore.app/api/v1/team/36/image.png",
    "bayer leverkusen": "https://img.cdn.sofascore.app/api/v1/team/38/image.png",
    "leverkusen": "https://img.cdn.sofascore.app/api/v1/team/38/image.png",
    "rb leipzig": "https://img.cdn.sofascore.app/api/v1/team/44/image.png",
    "leipzig": "https://img.cdn.sofascore.app/api/v1/team/44/image.png",
    "eintracht frankfurt": "https://img.cdn.sofascore.app/api/v1/team/41/image.png",
    "frankfurt": "https://img.cdn.sofascore.app/api/v1/team/41/image.png",
    "vfb stuttgart": "https://img.cdn.sofascore.app/api/v1/team/47/image.png",
    "stuttgart": "https://img.cdn.sofascore.app/api/v1/team/47/image.png",
    "vfl wolfsburg": "https://img.cdn.sofascore.app/api/v1/team/48/image.png",
    "wolfsburg": "https://img.cdn.sofascore.app/api/v1/team/48/image.png",
    "borussia monchengladbach": "https://img.cdn.sofascore.app/api/v1/team/39/image.png",
    "gladbach": "https://img.cdn.sofascore.app/api/v1/team/39/image.png",
    "union berlin": "https://img.cdn.sofascore.app/api/v1/team/49/image.png",
    "freiburg": "https://img.cdn.sofascore.app/api/v1/team/42/image.png",
    "sc freiburg": "https://img.cdn.sofascore.app/api/v1/team/42/image.png",
    "mainz": "https://img.cdn.sofascore.app/api/v1/team/44/image.png",
    "1. mainz 05": "https://img.cdn.sofascore.app/api/v1/team/44/image.png",
    "augsburg": "https://img.cdn.sofascore.app/api/v1/team/37/image.png",
    "fc augsburg": "https://img.cdn.sofascore.app/api/v1/team/37/image.png",
    "werder bremen": "https://img.cdn.sofascore.app/api/v1/team/46/image.png",
    "hoffenheim": "https://img.cdn.sofascore.app/api/v1/team/43/image.png",

    "inter": "https://img.cdn.sofascore.app/api/v1/team/86/image.png",
    "inter milan": "https://img.cdn.sofascore.app/api/v1/team/86/image.png",
    "internazionale": "https://img.cdn.sofascore.app/api/v1/team/86/image.png",
    "ac milan": "https://img.cdn.sofascore.app/api/v1/team/85/image.png",
    "milan": "https://img.cdn.sofascore.app/api/v1/team/85/image.png",
    "juventus": "https://img.cdn.sofascore.app/api/v1/team/87/image.png",
    "napoli": "https://img.cdn.sofascore.app/api/v1/team/89/image.png",
    "ssc napoli": "https://img.cdn.sofascore.app/api/v1/team/89/image.png",
    "roma": "https://img.cdn.sofascore.app/api/v1/team/88/image.png",
    "as roma": "https://img.cdn.sofascore.app/api/v1/team/88/image.png",
    "lazio": "https://img.cdn.sofascore.app/api/v1/team/84/image.png",
    "ss lazio": "https://img.cdn.sofascore.app/api/v1/team/84/image.png",
    "atalanta": "https://img.cdn.sofascore.app/api/v1/team/80/image.png",
    "us atalanta": "https://img.cdn.sofascore.app/api/v1/team/80/image.png",
    "fiorentina": "https://img.cdn.sofascore.app/api/v1/team/83/image.png",
    "us la spezia": "https://img.cdn.sofascore.app/api/v1/team/83/image.png",
    "torino": "https://img.cdn.sofascore.app/api/v1/team/91/image.png",
    "ac torino": "https://img.cdn.sofascore.app/api/v1/team/91/image.png",
    "bologna": "https://img.cdn.sofascore.app/api/v1/team/82/image.png",
    "us bologna": "https://img.cdn.sofascore.app/api/v1/team/82/image.png",
    "genoa": "https://img.cdn.sofascore.app/api/v1/team/90/image.png",
    "cagliari": "https://img.cdn.sofascore.app/api/v1/team/79/image.png",
    "udinese": "https://img.cdn.sofascore.app/api/v1/team/92/image.png",
    "sassuolo": "https://img.cdn.sofascore.app/api/v1/team/90/image.png",
    "parma": "https://img.cdn.sofascore.app/api/v1/team/86/image.png",
    "empoli": "https://img.cdn.sofascore.app/api/v1/team/95/image.png",
    "venezia": "https://img.cdn.sofascore.app/api/v1/team/93/image.png",
    "monza": "https://img.cdn.sofascore.app/api/v1/team/96/image.png",

    "psg": "https://img.cdn.sofascore.app/api/v1/team/524/image.png",
    "paris saint-germain": "https://img.cdn.sofascore.app/api/v1/team/524/image.png",
    "paris saint germain": "https://img.cdn.sofascore.app/api/v1/team/524/image.png",
    "paris": "https://img.cdn.sofascore.app/api/v1/team/524/image.png",
    "marseille": "https://img.cdn.sofascore.app/api/v1/team/518/image.png",
    "olympique marseille": "https://img.cdn.sofascore.app/api/v1/team/518/image.png",
    "monaco": "https://img.cdn.sofascore.app/api/v1/team/519/image.png",
    "as monaco": "https://img.cdn.sofascore.app/api/v1/team/519/image.png",
    "lyon": "https://img.cdn.sofascore.app/api/v1/team/516/image.png",
    "ol": "https://img.cdn.sofascore.app/api/v1/team/516/image.png",
    "losc": "https://img.cdn.sofascore.app/api/v1/team/514/image.png",
    "lille": "https://img.cdn.sofascore.app/api/v1/team/514/image.png",
    "nice": "https://img.cdn.sofascore.app/api/v1/team/522/image.png",
    "ogc nice": "https://img.cdn.sofascore.app/api/v1/team/522/image.png",
    "rennes": "https://img.cdn.sofascore.app/api/v1/team/523/image.png",
    "stade rennais": "https://img.cdn.sofascore.app/api/v1/team/523/image.png",
    "strasbourg": "https://img.cdn.sofascore.app/api/v1/team/526/image.png",
    "montpellier": "https://img.cdn.sofascore.app/api/v1/team/520/image.png",

    "ajax": "https://img.cdn.sofascore.app/api/v1/team/265/image.png",
    "afc ajax": "https://img.cdn.sofascore.app/api/v1/team/265/image.png",
    "psv": "https://img.cdn.sofascore.app/api/v1/team/266/image.png",
    "psv eindhoven": "https://img.cdn.sofascore.app/api/v1/team/266/image.png",
    "feyenoord": "https://img.cdn.sofascore.app/api/v1/team/264/image.png",
    "az alkmaar": "https://img.cdn.sofascore.app/api/v1/team/263/image.png",

    "celtic": "https://img.cdn.sofascore.app/api/v1/team/299/image.png",
    "rangers": "https://img.cdn.sofascore.app/api/v1/team/300/image.png",

    "benfica": "https://img.cdn.sofascore.app/api/v1/team/1619/image.png",
    "sl benfica": "https://img.cdn.sofascore.app/api/v1/team/1619/image.png",
    "sporting": "https://img.cdn.sofascore.app/api/v1/team/1622/image.png",
    "sporting cp": "https://img.cdn.sofascore.app/api/v1/team/1622/image.png",
    "fc porto": "https://img.cdn.sofascore.app/api/v1/team/1621/image.png",
    "porto": "https://img.cdn.sofascore.app/api/v1/team/1621/image.png",

    "galatasaray": "https://img.cdn.sofascore.app/api/v1/team/1727/image.png",
    "fenerbahce": "https://img.cdn.sofascore.app/api/v1/team/1726/image.png",
    "besiktas": "https://img.cdn.sofascore.app/api/v1/team/1725/image.png",

    "club brugge": "https://img.cdn.sofascore.app/api/v1/team/1629/image.png",
    "racing genk": "https://img.cdn.sofascore.app/api/v1/team/1631/image.png",
    "genk": "https://img.cdn.sofascore.app/api/v1/team/1631/image.png",
    "aa gent": "https://img.cdn.sofascore.app/api/v1/team/1632/image.png",
    "gent": "https://img.cdn.sofascore.app/api/v1/team/1632/image.png",
    "antwerp": "https://img.cdn.sofascore.app/api/v1/team/1628/image.png",
    "rafc antwerp": "https://img.cdn.sofascore.app/api/v1/team/1628/image.png",
    "union saint-gilloise": "https://img.cdn.sofascore.app/api/v1/team/1636/image.png",
    "standard liege": "https://img.cdn.sofascore.app/api/v1/team/1635/image.png",
    "anderecht": "https://img.cdn.sofascore.app/api/v1/team/1627/image.png",
    "rsc anderlecht": "https://img.cdn.sofascore.app/api/v1/team/1627/image.png",
    "anderlecht": "https://img.cdn.sofascore.app/api/v1/team/1627/image.png"
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

  function getTeamLogo(teamName) {
    if (!teamName) return null;
    var key = teamName.toLowerCase().trim();
    if (TEAM_LOGOS[key]) return TEAM_LOGOS[key];
    for (var k in TEAM_LOGOS) {
      if (key.indexOf(k) !== -1 || k.indexOf(key) !== -1) return TEAM_LOGOS[k];
    }
    return null;
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

  window.XionLogos = {
    getLeagueLogo: getLeagueLogo,
    getTeamLogo: getTeamLogo,
    getInitials: getInitials,
    getColorForName: getColorForName
  };
})();
