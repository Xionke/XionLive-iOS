(function() {
  "use strict";

  var API_HOSTS = [
    "https://apis-data10.tcdru136ovur.ru",
    "https://apis-data8.tcdru136ovur.ru",
    "https://apis-data11.tcdru136ovur.ru"
  ];
  var SPORT_TYPES = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 90];
  var API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    "Referer": "https://jack27eo.mpgreatestclgczbmiddle.my/",
    "Origin": "https://jack27eo.mpgreatestclgczbmiddle.my"
  };
  var VERCEL_BASE = "https://xionlive.vercel.app";

  var matchData = [];
  var streamHistory = [];
  var playedIds = [];
  var favorites = [];
  var currentData = null;
  var hls = null;
  var currentSport = "all";
  var currentView = "home";
  var resolvingMatchId = null;
  var controlsTimer = null;
  var headerTimer = null;
  var pullRefreshing = false;
  var lastRefresh = 0;
  var previousScores = {};
  var workingHost = null;
  var isDarkTheme = true;
  var contextMenuEl = null;

  var video = document.getElementById("video");
  var playerView = document.getElementById("player-view");
  var playerTitle = document.getElementById("player-title");
  var playerStreamName = document.getElementById("player-stream-name");
  var playerLoading = document.getElementById("player-loading");
  var playerHeader = document.getElementById("player-header");
  var playerBottom = document.getElementById("player-bottom");
  var matchContent = document.getElementById("match-content");
  var searchInput = document.getElementById("search-input");
  var errorToast = document.getElementById("error-toast");
  var toastEl = document.getElementById("toast");
  var contentEl = document.getElementById("content");
  var tickerEl = document.getElementById("score-ticker");

  try {
    streamHistory = JSON.parse(localStorage.getItem("xion_history") || "[]");
  } catch(e) { streamHistory = []; }
  try {
    playedIds = JSON.parse(localStorage.getItem("xion_played") || "[]");
  } catch(e) { playedIds = []; }
  try {
    favorites = JSON.parse(localStorage.getItem("xion_favorites") || "[]");
  } catch(e) { favorites = []; }

  try {
    isDarkTheme = localStorage.getItem("xion_theme") !== "light";
  } catch(e) { isDarkTheme = true; }
  if (!isDarkTheme) document.documentElement.classList.add("light-theme");

  function log() { var a = ["[xion-app]"]; for (var i = 0; i < arguments.length; i++) a.push(arguments[i]); console.log.apply(console, a); }
  function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
  function showError(msg) {
    errorToast.textContent = msg;
    errorToast.classList.add("show");
    setTimeout(function() { errorToast.classList.remove("show"); }, 4000);
  }
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(function() { toastEl.classList.remove("show"); }, 1500);
  }

  function isFavorite(match) {
    return favorites.indexOf(match.home) !== -1 || favorites.indexOf(match.away) !== -1;
  }

  function toggleFavorite(teamName) {
    var idx = favorites.indexOf(teamName);
    if (idx === -1) {
      favorites.push(teamName);
      showToast("Added " + teamName + " to favorites");
    } else {
      favorites.splice(idx, 1);
      showToast("Removed " + teamName + " from favorites");
    }
    localStorage.setItem("xion_favorites", JSON.stringify(favorites));
    renderContent();
  }

  function addToHistory(name, inputUrl, playableUrl) {
    var item = { name: name, inputUrl: inputUrl, playableUrl: playableUrl, time: Date.now() };
    streamHistory = streamHistory.filter(function(h) { return h.inputUrl !== inputUrl; });
    streamHistory.unshift(item);
    if (streamHistory.length > 30) streamHistory = streamHistory.slice(0, 30);
    localStorage.setItem("xion_history", JSON.stringify(streamHistory));
  }

  function markPlayed(mid) {
    if (playedIds.indexOf(mid) === -1) {
      playedIds.push(mid);
      try { localStorage.setItem("xion_played", JSON.stringify(playedIds)); } catch(e) {}
    }
  }

  function getLiveMatches() {
    return matchData.filter(function(m) { return m.isLive; });
  }

  function getScheduledMatches() {
    return matchData.filter(function(m) { return !m.isLive && m.matchStatusText !== "finished"; });
  }

  function getFinishedMatches() {
    return matchData.filter(function(m) { return m.matchStatusText === "finished"; });
  }

  function updateTicker() {
    if (!tickerEl) return;
    var live = getLiveMatches();
    if (live.length === 0) {
      tickerEl.classList.remove("visible");
      return;
    }
    tickerEl.classList.add("visible");
    var html = "";
    for (var i = 0; i < live.length; i++) {
      var m = live[i];
      var scoreText = (m.homeScore !== null ? m.homeScore : "-") + " - " + (m.awayScore !== null ? m.awayScore : "-");
      var minuteText = m.matchMinute ? m.matchMinute + "'" : "";
      html += '<div class="ticker-item" data-idx="' + matchData.indexOf(m) + '">' +
        '<span class="ticker-league">' + esc((m.league || "").substring(0, 20)) + '</span>' +
        '<span class="ticker-teams">' + esc(m.home.substring(0, 12)) + '</span>' +
        '<span class="ticker-score">' + scoreText + '</span>' +
        '<span class="ticker-teams">' + esc(m.away.substring(0, 12)) + '</span>' +
        (minuteText ? '<span class="ticker-minute">' + minuteText + '</span>' : '') +
      '</div>';
    }
    tickerEl.innerHTML = html;
  }

  function detectScoreChanges() {
    for (var i = 0; i < matchData.length; i++) {
      var m = matchData[i];
      var key = m.matchId;
      var prev = previousScores[key];
      if (prev && m.homeScore !== null && m.awayScore !== null) {
        if (prev.home !== m.homeScore || prev.away !== m.awayScore) {
          if (prev.home !== undefined) {
            showToast("GOAL! " + m.home + " " + m.homeScore + " - " + m.awayScore + " " + m.away);
          }
        }
      }
      if (m.homeScore !== null && m.awayScore !== null) {
        previousScores[key] = { home: m.homeScore, away: m.awayScore };
      }
    }
  }

  /* === MATCH LOADING === */
  function loadMatches() {
    var workingHost = null;
    var allMatches = [];
    var completed = 0;

    function tryHost(hostIdx, sportIdx) {
      if (hostIdx >= API_HOSTS.length) { finishLoad(); return; }
      var host = API_HOSTS[hostIdx];
      var sport = SPORT_TYPES[sportIdx];
      var url = host + "/api/match/live?sportType=" + sport;
      var controller = new AbortController();
      var timeout = setTimeout(function() { controller.abort(); }, 8000);

      fetch(url, { headers: API_HEADERS, signal: controller.signal, redirect: "follow" })
        .then(function(r) {
          clearTimeout(timeout);
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.arrayBuffer();
        })
        .then(function(buf) {
          var matches = window.parseMatchesFromBuffer(buf, sport);
          if (!workingHost) workingHost = host;
          for (var i = 0; i < matches.length; i++) allMatches.push(matches[i]);
          completed++;
          nextSport();
        })
        .catch(function(e) {
          clearTimeout(timeout);
          tryHost(hostIdx + 1, sportIdx);
        });
    }

    function nextSport() {
      if (completed >= SPORT_TYPES.length) { finishLoad(); return; }
      tryHost(workingHost ? API_HOSTS.indexOf(workingHost) : 0, completed);
    }

    function finishLoad() {
      var nids = {};
      for (var i = 0; i < allMatches.length; i++) nids[allMatches[i].matchId] = true;
      var merged = [];
      for (var i = 0; i < matchData.length; i++) {
        if (nids[matchData[i].matchId]) merged.push(matchData[i]);
      }
      for (var i = 0; i < allMatches.length; i++) {
        var ex = false;
        for (var j = 0; j < merged.length; j++) {
          if (merged[j].matchId === allMatches[i].matchId) { ex = true; break; }
        }
        if (!ex) merged.push(allMatches[i]);
      }
      matchData = merged;
      lastRefresh = Date.now();
      detectScoreChanges();
      renderContent();
      updateTicker();
      XionLogos.fetchAllTeamLogos(matchData);
      setTimeout(function() { renderContent(); }, 2000);
      hidePullRefresh();
    }

    tryHost(0, 0);
  }

  function hidePullRefresh() {
    pullRefreshing = false;
    var indicator = document.getElementById("pull-indicator");
    if (indicator) indicator.classList.remove("visible");
  }

  /* === RENDERING === */
  function getFilteredMatches() {
    var filter = searchInput.value.toLowerCase().trim();
    var filtered = matchData;
    if (filter) {
      filtered = filtered.filter(function(m) {
        return (m.name || "").toLowerCase().indexOf(filter) !== -1 ||
               (m.league || "").toLowerCase().indexOf(filter) !== -1 ||
               (m.home || "").toLowerCase().indexOf(filter) !== -1 ||
               (m.away || "").toLowerCase().indexOf(filter) !== -1;
      });
    }
    if (currentSport !== "all") {
      filtered = filtered.filter(function(m) { return m.sport === currentSport; });
    }
    return filtered;
  }

  function getLeagueGroups(matches) {
    var groups = {};
    var order = [];
    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      var k = m.league || m.sport || "Other";
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(m);
    }
    order.sort(function(a, b) {
      function lp(l) {
        l = l.toLowerCase();
        if (l.indexOf("jupiler") !== -1 || l.indexOf("belgian pro") !== -1 || l.indexOf("pro league") !== -1) return 1;
        if (l.indexOf("champion") !== -1 && l.indexOf("league") !== -1) return 2;
        if (l.indexOf("europa") !== -1 && l.indexOf("league") !== -1) return 3;
        if (l.indexOf("conference") !== -1 && l.indexOf("league") !== -1) return 4;
        if (l.indexOf("premier") !== -1) return 5;
        if (l.indexOf("primera") !== -1 || l.indexOf("la liga") !== -1 || l.indexOf("spain") !== -1) return 6;
        if (l.indexOf("serie a") !== -1 && l.indexOf("serie c") === -1) return 7;
        if (l.indexOf("bundesliga") !== -1) return 8;
        if (l.indexOf("ligue 1") !== -1) return 9;
        if (l.indexOf("eredivisie") !== -1) return 10;
        if (l.indexOf("primeira") !== -1 || l.indexOf("liga portugal") !== -1) return 11;
        return 20;
      }
      var pa = lp(a), pb = lp(b);
      if (pa !== pb) return pa - pb;
      return a.localeCompare(b);
    });
    return { groups: groups, order: order };
  }

  function teamLogoHtml(teamName) {
    var url = XionLogos.getTeamLogo(teamName);
    var initials = XionLogos.getInitials(teamName);
    var color = XionLogos.getColorForName(teamName);
    if (url) {
      return '<div class="card-team-logo"><img src="' + esc(url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="initials" style="display:none;background:' + color + ';width:100%;height:100%;align-items:center;justify-content:center;font-size:0.55rem">' + esc(initials) + '</div></div>';
    }
    return '<div class="card-team-logo"><div class="initials" style="background:' + color + ';width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:0.55rem">' + esc(initials) + '</div></div>';
  }

  function scoreHtml(match) {
    if (match.homeScore === null && match.awayScore === null) return "";
    var home = match.homeScore !== null ? match.homeScore : "-";
    var away = match.awayScore !== null ? match.awayScore : "-";
    return '<div class="card-score"><span class="score-home">' + home + '</span><span class="score-sep">-</span><span class="score-away">' + away + '</span></div>';
  }

  function statusBadgeHtml(match) {
    var sd = match.statusDisplay;
    if (!sd || !sd.text) return "";
    var cls = "status-badge status-" + sd.color;
    if (sd.color === "live") cls += " status-pulse";
    return '<span class="' + cls + '">' + esc(sd.text) + '</span>';
  }

  function renderMatchCard(match) {
    var idx = matchData.indexOf(match);
    var ir = resolvingMatchId === match.matchId;
    var leagueLogo = XionLogos.getLeagueLogo(match.league);
    var sportClass = (match.sport || "others").toLowerCase().replace(/[^a-z]/g, "");
    var isFav = isFavorite(match);
    var isPlayed = playedIds.indexOf(match.matchId) !== -1;
    var teamBg = XionLogos.getTeamGradient(match.home, match.away);

    var leagueLogoHtml = leagueLogo
      ? '<div class="card-league-logo"><img src="' + esc(leagueLogo) + '" alt="" onerror="this.style.display=\'none\'"></div>'
      : '<div class="card-league-logo"><span class="logo-fallback">' + esc((match.league || "?").substring(0, 2).toUpperCase()) + '</span></div>';

    var favHtml = '<button class="card-fav-btn' + (isFav ? " active" : "") + '" data-fav="' + esc(match.home) + '" onclick="event.stopPropagation()">' +
      '<svg viewBox="0 0 24 24" fill="' + (isFav ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
    '</button>';

    var playedHtml = isPlayed ? '<span class="card-played-badge">&#10003;</span>' : '';

    var timeHtml = "";
    if (!match.isLive && match.matchStatusText !== "finished") {
      if (match.kickoffTime) {
        timeHtml = '<span class="card-kickoff">' + esc(match.kickoffTime) + '</span>';
      } else if (match.timeUntil) {
        timeHtml = '<span class="card-kickoff">In ' + esc(match.timeUntil) + '</span>';
      }
    }

    return '<div class="match-card' + (ir ? " resolving" : "") + (isFav ? " favorited" : "") + '" data-idx="' + idx + '" style="background:' + teamBg + '">' +
      '<div class="card-league-row">' +
        leagueLogoHtml +
        '<span class="card-league-name">' + esc(match.league || match.sport || "Live") + '</span>' +
        statusBadgeHtml(match) +
        timeHtml +
        playedHtml +
        favHtml +
      '</div>' +
      '<div class="card-teams">' +
        '<div class="card-team-row">' +
          teamLogoHtml(match.home) +
          '<span class="card-team-name">' + esc(match.home || "?") + '</span>' +
          (match.homeScore !== null ? '<span class="card-team-score">' + match.homeScore + '</span>' : '') +
        '</div>' +
        '<div class="card-team-row">' +
          teamLogoHtml(match.away) +
          '<span class="card-team-name">' + esc(match.away || "?") + '</span>' +
          (match.awayScore !== null ? '<span class="card-team-score">' + match.awayScore + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="card-footer">' +
        '<span class="sport-badge ' + sportClass + '">' + esc(match.sport || "live") + '</span>' +
        (match.isLive ? '<span class="card-live-dot"></span>' : '') +
      '</div>' +
    '</div>';
  }

  function renderHero(matches) {
    if (!matches.length) return "";
    var featured = matches[0];
    var leagueLogo = XionLogos.getLeagueLogo(featured.league);
    var leagueLogoHtml = leagueLogo
      ? '<img src="' + esc(leagueLogo) + '" alt="" style="width:18px;height:18px;border-radius:3px">'
      : '';

    var scoreHtml2 = "";
    if (featured.homeScore !== null) {
      scoreHtml2 = '<div class="hero-score">' + featured.homeScore + ' - ' + featured.awayScore + '</div>';
    }

    var statusHtml = statusBadgeHtml(featured);

    return '<div class="hero-banner">' +
      '<div class="hero-glow"></div>' +
      '<div class="hero-inner">' +
        '<div class="hero-league">' + leagueLogoHtml + esc(featured.league || "Live Football") + '</div>' +
        '<div class="hero-headline">' +
          esc(featured.home || "Featured") + ' <span>vs</span> ' + esc(featured.away || "Match") +
        '</div>' +
        scoreHtml2 +
        statusHtml +
        '<button class="hero-cta" data-idx="' + matchData.indexOf(featured) + '">' +
          '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>' +
          (featured.isLive ? 'Watch Live' : 'Watch Match') +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function renderContent() {
    var matches = getFilteredMatches();

    if (currentView === "home") {
      var liveMatches = matches.filter(function(m) { return m.isLive; });
      var scheduledMatches = matches.filter(function(m) { return !m.isLive && m.matchStatusText !== "finished"; });
      var favMatches = liveMatches.filter(isFavorite);

      if (!matches.length) {
        matchContent.innerHTML = '<div class="empty-state"><p>' +
          (searchInput.value ? "No matches found" : "No matches available") + '</p></div>';
        return;
      }

      var html = "";

      if (favMatches.length > 0) {
        html += '<div class="section-header"><div class="section-title"><span class="star-indicator">&#9733;</span>YOUR TEAMS</div></div>';
        html += '<div class="match-grid">';
        for (var i = 0; i < favMatches.length; i++) html += renderMatchCard(favMatches[i]);
        html += '</div>';
      }

      if (liveMatches.length > 0) {
        var nonFavLive = liveMatches.filter(function(m) { return !isFavorite(m); });
        if (nonFavLive.length > 0 || favMatches.length === 0) {
          html += renderHero(liveMatches);
          html += '<div class="section-header"><div class="section-title"><span class="live-indicator"></span>LIVE NOW</div></div>';
          html += '<div class="match-grid">';
          var shown = favMatches.length > 0 ? nonFavLive : liveMatches;
          for (var i = 0; i < shown.length; i++) html += renderMatchCard(shown[i]);
          html += '</div>';
        }
      }

      if (scheduledMatches.length > 0) {
        html += '<div class="section-header"><div class="section-title">UPCOMING</div></div>';
        html += '<div class="match-grid">';
        for (var i = 0; i < Math.min(scheduledMatches.length, 20); i++) html += renderMatchCard(scheduledMatches[i]);
        html += '</div>';
      }

      matchContent.innerHTML = html;

    } else if (currentView === "live") {
      var liveOnly = matches.filter(function(m) { return m.isLive; });
      if (!liveOnly.length) {
        matchContent.innerHTML = '<div class="empty-state"><p>No live matches right now</p></div>';
        return;
      }
      var html = '<div class="section-header"><div class="section-title"><span class="live-indicator"></span>ALL LIVE (' + liveOnly.length + ')</div></div>';
      html += '<div class="match-grid">';
      for (var i = 0; i < liveOnly.length; i++) html += renderMatchCard(liveOnly[i]);
      html += '</div>';
      matchContent.innerHTML = html;

    } else if (currentView === "scheduled") {
      var scheduledOnly = matches.filter(function(m) { return !m.isLive && m.matchStatusText !== "finished"; });
      if (!scheduledOnly.length) {
        matchContent.innerHTML = '<div class="empty-state"><p>No upcoming matches</p></div>';
        return;
      }
      var html = '<div class="section-header"><div class="section-title">UPCOMING MATCHES</div></div>';
      html += '<div class="match-grid">';
      for (var i = 0; i < scheduledOnly.length; i++) html += renderMatchCard(scheduledOnly[i]);
      html += '</div>';
      matchContent.innerHTML = html;

    } else if (currentView === "more") {
      renderMoreView();

    } else if (currentView === "history") {
      renderHistoryView();
    }
  }

  function renderMoreView() {
    var html = '<div class="more-view">';
    html += '<div class="more-section">';
    html += '<div class="more-item" data-action="favorites"><span class="more-icon">&#9733;</span><span>My Favorites</span><span class="more-badge">' + favorites.length + '</span><span class="more-arrow">&#8250;</span></div>';
    html += '<div class="more-item" data-action="history"><span class="more-icon">&#128337;</span><span>Watch History</span><span class="more-badge">' + streamHistory.length + '</span><span class="more-arrow">&#8250;</span></div>';
    html += '</div>';
    html += '<div class="more-section">';
    html += '<div class="more-item" data-action="theme"><span class="more-icon">' + (isDarkTheme ? '&#9790;' : '&#9728;') + '</span><span>' + (isDarkTheme ? 'Dark Mode' : 'Light Mode') + '</span><span class="more-arrow">&#8250;</span></div>';
    html += '<div class="more-item" data-action="about"><span class="more-icon">&#9432;</span><span>About XionLive</span><span class="more-arrow">&#8250;</span></div>';
    html += '</div>';
    html += '<div class="more-section">';
    html += '<div class="more-stats">';
    html += '<div class="stat-item"><div class="stat-value">' + matchData.length + '</div><div class="stat-label">Total Matches</div></div>';
    html += '<div class="stat-item"><div class="stat-value">' + getLiveMatches().length + '</div><div class="stat-label">Live Now</div></div>';
    html += '<div class="stat-item"><div class="stat-value">' + favorites.length + '</div><div class="stat-label">Favorites</div></div>';
    html += '</div>';
    html += '<div style="text-align:center;padding:0 16px 16px"><span class="host-status" id="host-status">checking</span></div>';
    html += '</div>';
    html += '</div>';
    matchContent.innerHTML = html;
    if (workingHost) {
      var statusEl = document.getElementById("host-status");
      if (statusEl) {
        statusEl.textContent = workingHost.replace("https://", "").split(".")[0] + " online";
        statusEl.className = "host-status";
      }
    }
  }

  function renderFavoritesView() {
    var favMatches = matchData.filter(isFavorite);
    if (!favMatches.length) {
      matchContent.innerHTML = '<div class="empty-state"><p>No favorites yet. Tap the heart on any match card to add a team.</p></div>';
      return;
    }
    var html = '<div class="section-header"><div class="section-title">&#9733; MY FAVORITES</div></div>';
    html += '<div class="match-grid">';
    for (var i = 0; i < favMatches.length; i++) html += renderMatchCard(favMatches[i]);
    html += '</div>';
    matchContent.innerHTML = html;
  }

  function renderHistoryView() {
    if (!streamHistory.length) {
      matchContent.innerHTML = '<div class="empty-state"><p>No watch history</p></div>';
      return;
    }
    var html = '<div class="section-header"><div class="section-title">RECENTLY WATCHED</div></div>';
    html += '<div class="match-grid single-col">';
    for (var i = 0; i < streamHistory.length; i++) {
      var h = streamHistory[i];
      if (!h || !h.name) continue;
      html += '<div class="match-card" data-hist-idx="' + i + '">' +
        '<div class="card-league-row">' +
          '<div class="card-league-logo"><span class="logo-fallback" style="background:var(--accent);color:#fff;width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:3px;font-size:0.5rem">&#9654;</span></div>' +
          '<span class="card-league-name" style="color:var(--muted)">SAVED STREAM</span>' +
          '<span style="font-size:0.65rem;color:var(--muted)">' + timeAgo(h.time) + '</span>' +
        '</div>' +
        '<div class="card-teams">' +
          '<div class="card-team-row"><span class="card-team-name">' + esc(h.name) + '</span></div>' +
        '</div>' +
        '<div class="card-footer"><span class="sport-badge others">saved</span></div>' +
      '</div>';
    }
    html += '</div>';
    matchContent.innerHTML = html;
  }

  function timeAgo(t) {
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return "now";
    if (s < 3600) return Math.floor(s / 60) + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    return Math.floor(s / 86400) + "d";
  }

  /* === PLAY MATCH === */
  function playMatch(idx) {
    var match = matchData[idx];
    if (!match || resolvingMatchId) return;
    resolvingMatchId = match.matchId;
    renderContent();
    showPlayer(match.name);

    log("resolving:", match.url);
    window.resolveXionMatch(match.url)
      .then(function(d) {
        log("resolved:", JSON.stringify(d));
        if (d.streams && d.streams.length) {
          if (d.streams.length === 1) resolveAndPlay(match, d.streams[0].streamId, d);
          else showStreamPicker(d.streams, match, d);
        } else if (d.playableUrl) {
          resolveAndPlayDirect(d, match);
        } else {
          throw new Error("No streams found");
        }
      })
      .catch(function(e) {
        log("error:", e.message || e);
        showError(e.message || "Failed to resolve stream");
        resolvingMatchId = null;
        renderContent();
        hidePlayer();
      });
  }

  function resolveAndPlay(match, streamId, listData) {
    window.resolveXionMatch(match.url, streamId)
      .then(function(d) {
        currentData = {
          playableUrl: d.playableUrl, directUrl: d.streamUrl || match.url,
          referer: d.referer || "", name: d.name || match.name, inputUrl: match.url
        };
        addToHistory(d.name || match.name, match.url, d.playableUrl);
        markPlayed(match.matchId);
        startPlayback(d.playableUrl, d.name || match.name);
      })
      .catch(function(e) { showError(e.message || "Failed"); })
      .finally(function() { resolvingMatchId = null; renderContent(); });
  }

  function resolveAndPlayDirect(d, match) {
    currentData = {
      playableUrl: d.playableUrl, directUrl: d.streamUrl || match.url,
      referer: d.referer || "", name: d.name || match.name, inputUrl: match.url
    };
    addToHistory(d.name || match.name, match.url, d.playableUrl);
    markPlayed(match.matchId);
    startPlayback(d.playableUrl, d.name || match.name);
    resolvingMatchId = null;
    renderContent();
  }

  function showStreamPicker(streams, match, listData) {
    var picker = document.createElement("div");
    picker.className = "player-loading";
    picker.id = "stream-picker";
    var list = document.createElement("div");
    list.style.cssText = "display:flex;flex-direction:column;gap:8px;width:80%;max-width:320px";
    streams.forEach(function(s) {
      var btn = document.createElement("button");
      btn.textContent = s.name || ("Stream " + s.streamId);
      btn.style.cssText = "padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font:0.9rem system-ui;cursor:pointer;text-align:center";
      btn.onclick = function() { picker.remove(); resolveAndPlay(match, s.streamId, listData); };
      list.appendChild(btn);
    });
    picker.appendChild(list);
    playerView.appendChild(picker);
  }

  /* === PLAYER === */
  function showPlayer(name) {
    playerView.classList.add("active");
    playerTitle.textContent = name || "XionLive";
    playerStreamName.textContent = "Resolving...";
    playerLoading.style.display = "flex";
    showControls();
  }

  function hidePlayer() {
    playerView.classList.remove("active");
    playerLoading.style.display = "none";
  }

  function showControls() {
    playerHeader.classList.remove("hidden");
    playerBottom.classList.remove("hidden");
    clearTimeout(headerTimer);
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(function() {
      playerHeader.classList.add("hidden");
      playerBottom.classList.add("hidden");
    }, 4000);
  }

  function startPlayback(url, name) {
    if (hls) { hls.destroy(); hls = null; }
    playerLoading.style.display = "none";
    playerTitle.textContent = name || "XionLive";
    playerStreamName.textContent = "Live";
    showControls();

    log("startPlayback:", url.substring(0, 120));

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true, lowLatencyMode: true,
        backBufferLength: 30, maxBufferLength: 60, maxMaxBufferLength: 120,
        startFragPrefetch: true, liveSyncDurationCount: 4,
        liveMaxLatencyDurationCount: 8, liveDurationInfinity: true,
        highBufferWatchdogPeriod: 2, overrideNative: true
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, function() {
        log("HLS manifest parsed");
        video.play().catch(function(e) { log("autoplay blocked:", e.message); });
        if (castSession && currentData) castCurrentMedia();
      });
      hls.on(Hls.Events.ERROR, function(_, d) {
        log("HLS error:", d.type, d.details, d.fatal);
        if (d.fatal) {
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
            showError("Network error: " + d.details);
            hls.startLoad();
          } else {
            showError("Playback error: " + d.details);
          }
        }
      });
    } else {
      log("native player:", url.substring(0, 120));
      video.onloadeddata = function() {
        log("video loaded");
        video.play().catch(function(e) { log("native play failed:", e.message); });
        if (castSession && currentData) castCurrentMedia();
      };
      video.onerror = function() {
        var err = video.error;
        var msg = "Error " + (err ? err.code : 0) + ": " + (err ? err.message : "unknown");
        log(msg, "url:", url);
        showError(msg);
      };
      video.src = url;
    }
  }

  function stopPlayback() {
    if (hls) { hls.destroy(); hls = null; }
    video.src = "";
    currentData = null;
    hidePlayer();
  }

  /* === TOUCH GESTURES === */
  (function() {
    var lastTap = 0;
    var startDist = 0, startScale = 1, curScale = 1;
    var dragX = 0, dragY = 0, dragging = false;
    var startDragX = 0, startDragY = 0;

    function dist(a, b) {
      var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    video.addEventListener("click", function(e) {
      var now = Date.now();
      if (now - lastTap < 300) {
        var rect = video.getBoundingClientRect();
        var x = e.clientX - rect.left;
        if (x < rect.width / 3) {
          video.currentTime = Math.max(0, video.currentTime - 10);
          showSkipIndicator(e.clientX, e.clientY, "-10s");
        } else if (x > rect.width * 2 / 3) {
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
          showSkipIndicator(e.clientX, e.clientY, "+10s");
        } else {
          if (video.paused) video.play(); else video.pause();
        }
        lastTap = 0;
      } else {
        lastTap = now;
        showControls();
      }
    });

    function showSkipIndicator(x, y, text) {
      var el = document.createElement("div");
      el.textContent = text;
      el.style.cssText = "position:fixed;left:" + x + "px;top:" + y + "px;transform:translate(-50%,-50%);color:#fff;font-size:1.2rem;font-weight:700;pointer-events:none;z-index:9999;text-shadow:0 2px 8px rgba(0,0,0,0.8);transition:opacity 0.5s";
      document.body.appendChild(el);
      requestAnimationFrame(function() { el.style.opacity = "0"; });
      setTimeout(function() { el.remove(); }, 600);
    }

    video.addEventListener("touchstart", function(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        startDist = dist(e.touches[0], e.touches[1]);
        startScale = curScale;
      } else if (e.touches.length === 1) {
        dragging = true;
        startDragX = e.touches[0].clientX;
        startDragY = e.touches[0].clientY;
      }
    }, { passive: false });

    video.addEventListener("touchmove", function(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        var d = dist(e.touches[0], e.touches[1]);
        curScale = Math.min(Math.max(startScale * (d / startDist), 1), 4);
        applyTransform();
      } else if (e.touches.length === 1 && dragging && curScale > 1) {
        e.preventDefault();
        var dx = e.touches[0].clientX - startDragX;
        var dy = e.touches[0].clientY - startDragY;
        dragX = Math.min(Math.max(dragX + dx, -(curScale - 1) * video.clientWidth / 2), (curScale - 1) * video.clientWidth / 2);
        dragY = Math.min(Math.max(dragY + dy, -(curScale - 1) * video.clientHeight / 2), (curScale - 1) * video.clientHeight / 2);
        startDragX = e.touches[0].clientX;
        startDragY = e.touches[0].clientY;
        applyTransform();
      }
    }, { passive: false });

    video.addEventListener("touchend", function() {
      if (curScale <= 1.05) {
        curScale = 1; dragX = 0; dragY = 0;
        video.style.transform = "";
        video.style.objectFit = "contain";
      }
      dragging = false;
    });

    function applyTransform() {
      video.style.transform = "scale(" + curScale + ") translate(" + (dragX / curScale) + "px," + (dragY / curScale) + "px)";
      video.style.objectFit = curScale > 1.05 ? "cover" : "contain";
    }
  })();

  /* === PULL TO REFRESH === */
  (function() {
    var startY = 0;
    var pulling = false;
    var indicator = document.getElementById("pull-indicator");

    contentEl.addEventListener("touchstart", function(e) {
      if (contentEl.scrollTop <= 0 && e.touches.length === 1) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    }, { passive: true });

    contentEl.addEventListener("touchmove", function(e) {
      if (!pulling) return;
      var dy = e.touches[0].clientY - startY;
      if (dy > 10 && contentEl.scrollTop <= 0) {
        if (indicator) indicator.classList.add("visible");
      }
    }, { passive: true });

    contentEl.addEventListener("touchend", function() {
      if (!pulling) return;
      pulling = false;
      var indicator = document.getElementById("pull-indicator");
      if (indicator && indicator.classList.contains("visible")) {
        loadMatches();
      }
    });
  })();

  /* === CHROMECAST === */
  var castSession = null;
  var castMedia = null;

  function initCast() {
    if (!window.chrome || !window.chrome.cast || !window.cast || !window.cast.framework) {
      setTimeout(initCast, 500);
      return;
    }
    try {
      var castContext = cast.framework.CastContext.getInstance();
      castContext.setOptions({
        receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.SCOPED_THIS_TAB_ONLY
      });
      castContext.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, function(e) {
        if (e.sessionState === cast.framework.SessionState.SESSION_STARTED) {
          castSession = castContext.getCurrentSession();
          document.getElementById("cast-btn").classList.add("active");
          document.getElementById("cast-btn").style.display = "";
          log("cast session started");
          if (currentData && currentData.playableUrl) castCurrentMedia();
        } else if (e.sessionState === cast.framework.SessionState.SESSION_ENDED) {
          castSession = null; castMedia = null;
          document.getElementById("cast-btn").classList.remove("active");
          log("cast session ended");
        }
      });
      var castBtn = document.getElementById("cast-btn");
      castBtn.style.display = "";
      castBtn.onclick = function() {
        if (castSession) {
          castSession.endSession(true);
        } else {
          castContext.requestSession().catch(function() {
            showToast("No Chromecast devices found");
          });
        }
      };
      log("Cast SDK initialized");
    } catch(e) {
      setTimeout(initCast, 2000);
    }
  }
  setTimeout(initCast, 1500);

  function castCurrentMedia() {
    if (!castSession || !currentData) return;
    var mediaUrl = VERCEL_BASE + currentData.playableUrl;
    var contentType = "application/x-mpegURL";
    if (!/\.m3u8/i.test(mediaUrl)) contentType = "video/mp2t";
    var mediaInfo = new cast.media.MediaInfo(mediaUrl, contentType);
    mediaInfo.metadata = new cast.media.GenericMediaMetadata();
    mediaInfo.metadata.title = currentData.name || "XionLive";
    if (currentData.referer) {
      mediaInfo.customData = { headers: { Referer: currentData.referer } };
    }
    var request = new cast.media.LoadRequest(mediaInfo);
    request.autoplay = true;
    castSession.loadMedia(request).then(function(media) {
      castMedia = media;
      log("cast media loaded");
    }).catch(function(e) { log("cast load error:", e.message); });
  }

  /* === AIRPLAY === */
  (function() {
    var btn = document.getElementById("airplay-btn");
    if (video.webkitShowPlaybackTargetPicker) {
      btn.style.display = "";
    } else if (window.MediaSource && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)) {
      btn.style.display = "";
    }
  })();

  function startAirPlay() {
    if (video.webkitShowPlaybackTargetPicker) {
      video.webkitShowPlaybackTargetPicker();
    } else {
      showToast("AirPlay not available");
    }
  }

  /* === FULLSCREEN === */
  function enterFullscreen() {
    if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(function() {});
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function() {});
  }
  document.addEventListener("fullscreenchange", function() {});

  /* === EVENT HANDLERS === */
  document.getElementById("player-back").onclick = stopPlayback;
  document.getElementById("airplay-btn").onclick = startAirPlay;
  document.getElementById("fullscreen-btn").onclick = enterFullscreen;
  document.getElementById("sleep-btn").onclick = showSleepTimer;
  document.getElementById("audio-btn").onclick = toggleAudioOnly;

  video.addEventListener("click", function() { showControls(); });

  searchInput.addEventListener("input", function() { renderContent(); });

  document.getElementById("tabs").addEventListener("click", function(e) {
    var btn = e.target.closest(".tab-btn");
    if (!btn) return;
    document.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
    btn.classList.add("active");
    currentSport = btn.getAttribute("data-sport");
    renderContent();
  });

  document.getElementById("bottomnav").addEventListener("click", function(e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    document.querySelectorAll(".bottomnav button").forEach(function(b) { b.classList.remove("active"); });
    btn.classList.add("active");
    currentView = btn.getAttribute("data-view");
    renderContent();
    contentEl.scrollTop = 0;
  });

  matchContent.addEventListener("click", function(e) {
    if (contextMenuEl) return;
    var heroBtn = e.target.closest(".hero-cta");
    if (heroBtn) {
      var idx = heroBtn.getAttribute("data-idx");
      if (idx !== null) playMatch(parseInt(idx, 10));
      return;
    }

    var favBtn = e.target.closest(".card-fav-btn");
    if (favBtn) {
      e.stopPropagation();
      var teamName = favBtn.getAttribute("data-fav");
      if (teamName) toggleFavorite(teamName);
      return;
    }

    var moreItem = e.target.closest(".more-item");
    if (moreItem) {
      var action = moreItem.getAttribute("data-action");
      if (action === "favorites") {
        currentView = "favorites";
        renderContent();
      } else if (action === "history") {
        currentView = "history";
        renderContent();
      } else if (action === "theme") {
        window.toggleTheme();
        renderContent();
      } else if (action === "about") {
        showAboutModal();
      }
      return;
    }

    var card = e.target.closest(".match-card");
    if (!card) return;
    var idx = card.getAttribute("data-idx");
    if (idx !== null) {
      var match = matchData[parseInt(idx, 10)];
      if (match && match.isLive) {
        showMatchDetail(parseInt(idx, 10));
      } else {
        playMatch(parseInt(idx, 10));
      }
    }
    var histIdx = card.getAttribute("data-hist-idx");
    if (histIdx !== null) {
      var h = streamHistory[parseInt(histIdx, 10)];
      if (h) {
        currentData = { playableUrl: h.playableUrl, name: h.name, inputUrl: h.inputUrl };
        showPlayer(h.name);
        startPlayback(h.playableUrl, h.name);
      }
    }

    var tickerItem = e.target.closest(".ticker-item");
    if (tickerItem) {
      var tidx = tickerItem.getAttribute("data-idx");
      if (tidx !== null) playMatch(parseInt(tidx, 10));
    }
  });

  (function() {
    var pressTimer = null;
    var pressTarget = null;

    matchContent.addEventListener("touchstart", function(e) {
      var card = e.target.closest(".match-card");
      if (!card) return;
      var idx = card.getAttribute("data-idx");
      if (idx === null) return;
      pressTarget = card;
      pressTimer = setTimeout(function() {
        showContextMenu(e, parseInt(idx, 10));
      }, 500);
    }, { passive: true });

    matchContent.addEventListener("touchmove", function() {
      clearTimeout(pressTimer);
      pressTarget = null;
    }, { passive: true });

    matchContent.addEventListener("touchend", function() {
      clearTimeout(pressTimer);
      pressTarget = null;
    }, { passive: true });
  })();

  function showAboutModal() {
    var modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = '<div class="modal-sheet">' +
      '<div class="modal-handle"></div>' +
      '<div class="modal-header"><span class="modal-title">About XionLive</span><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="about-logo"><svg viewBox="0 0 24 24" fill="none" width="48" height="48"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="var(--accent)"/></svg></div>' +
        '<h2 class="about-name">XIONLIVE</h2>' +
        '<p class="about-version">v2.1.0</p>' +
        '<div class="about-features">' +
          '<div class="about-feature">Live scores across 16 sports</div>' +
          '<div class="about-feature">HD streams with Chromecast & AirPlay</div>' +
          '<div class="about-feature">Favorite teams & leagues</div>' +
          '<div class="about-feature">Match detail view with standings</div>' +
          '<div class="about-feature">Score ticker & pull to refresh</div>' +
          '<div class="about-feature">Sleep timer & audio-only mode</div>' +
          '<div class="about-feature">Long-press context menu</div>' +
          '<div class="about-feature">Dark & light theme</div>' +
          '<div class="about-feature">Share matches</div>' +
          '<div class="about-feature">Score change alerts</div>' +
        '</div>' +
        '<div class="about-credits">' +
          '<p>Powered by HLS.js, TheSportsDB, Capacitor</p>' +
        '</div>' +
        '<div class="about-api-status" id="api-status">Checking API status...</div>' +
      '</div>' +
    '</div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", function(e) { if (e.target === modal) modal.remove(); });

    var statusEl = document.getElementById("api-status");
    var checked = 0;
    var online = 0;
    API_HOSTS.forEach(function(host) {
      var c = new AbortController();
      var t = setTimeout(function() { c.abort(); }, 3000);
      fetch(host, { method: "HEAD", signal: c.signal })
        .then(function(r) { clearTimeout(t); checked++; if (r.ok) online++; updateStatus(); })
        .catch(function() { clearTimeout(t); checked++; updateStatus(); });
    });
    function updateStatus() {
      if (statusEl) statusEl.textContent = "API Status: " + online + "/" + API_HOSTS.length + " hosts online";
    }
  }

  /* === MATCH DETAIL MODAL === */
  function showMatchDetail(idx) {
    var match = matchData[idx];
    if (!match) return;
    var leagueLogo = XionLogos.getLeagueLogo(match.league);
    var homeLogo = XionLogos.getTeamLogo(match.home);
    var awayLogo = XionLogos.getTeamLogo(match.away);
    var homeColor = XionLogos.getTeamColor(match.home) || XionLogos.getColorForName(match.home);
    var awayColor = XionLogos.getTeamColor(match.away) || XionLogos.getColorForName(match.away);
    var isFav = isFavorite(match);
    var isPlayed = playedIds.indexOf(match.matchId) !== -1;

    var leagueLogoHtml = leagueLogo
      ? '<img src="' + esc(leagueLogo) + '" alt="" style="width:24px;height:24px;border-radius:4px">'
      : '<span style="display:inline-flex;width:24px;height:24px;border-radius:4px;background:var(--surface3);align-items:center;justify-content:center;font-size:0.6rem;font-weight:700;color:var(--muted)">' + esc((match.league || "?").substring(0, 2).toUpperCase()) + '</span>';

    var homeLogoHtml = homeLogo
      ? '<img src="' + esc(homeLogo) + '" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:contain;background:var(--surface3)">'
      : '<div style="width:64px;height:64px;border-radius:50%;background:' + homeColor + ';display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;color:#fff">' + esc(XionLogos.getInitials(match.home)) + '</div>';

    var awayLogoHtml = awayLogo
      ? '<img src="' + esc(awayLogo) + '" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:contain;background:var(--surface3)">'
      : '<div style="width:64px;height:64px;border-radius:50%;background:' + awayColor + ';display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;color:#fff">' + esc(XionLogos.getInitials(match.away)) + '</div>';

    var scoreHtml = "";
    if (match.homeScore !== null && match.awayScore !== null) {
      scoreHtml = '<div class="detail-score"><span class="detail-score-num">' + match.homeScore + '</span><span class="detail-score-sep">-</span><span class="detail-score-num">' + match.awayScore + '</span></div>';
    } else if (match.kickoffTime) {
      scoreHtml = '<div class="detail-kickoff">' + esc(match.kickoffDate || "") + ' ' + esc(match.kickoffTime || "") + '</div>';
    }

    var statusHtml = statusBadgeHtml(match);

    var minuteHtml = "";
    if (match.isLive && match.matchMinute) {
      minuteHtml = '<div class="detail-minute">' + match.matchMinute + "'</div>";
    }

    var gradient = "linear-gradient(135deg, " + hexToRgbaLocal(homeColor, 0.2) + " 0%, " + hexToRgbaLocal(awayColor, 0.2) + " 100%)";

    var modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = '<div class="modal-sheet detail-modal" style="background:' + gradient + ', var(--surface)">' +
      '<div class="modal-handle"></div>' +
      '<div class="modal-header"><span class="modal-title">Match Details</span><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="detail-league">' + leagueLogoHtml + ' ' + esc(match.league || match.sport || "Live") + '</div>' +
        '<div class="detail-status-row">' + statusHtml + minuteHtml + '</div>' +
        '<div class="detail-teams">' +
          '<div class="detail-team">' +
            homeLogoHtml +
            '<div class="detail-team-name">' + esc(match.home || "?") + '</div>' +
          '</div>' +
          '<div class="detail-center">' + scoreHtml + '</div>' +
          '<div class="detail-team">' +
            awayLogoHtml +
            '<div class="detail-team-name">' + esc(match.away || "?") + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="detail-actions">' +
          '<button class="detail-action-btn' + (isFav ? " active" : "") + '" data-detail-fav="' + esc(match.home) + '">' +
            '<svg viewBox="0 0 24 24" fill="' + (isFav ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
            '<span>' + (isFav ? "Favorited" : "Favorite") + '</span>' +
          '</button>' +
          '<button class="detail-action-btn detail-share-btn" data-detail-share="' + idx + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' +
            '<span>Share</span>' +
          '</button>' +
          (match.league ? '<button class="detail-action-btn" data-detail-standings="' + esc(match.league) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' +
            '<span>Standings</span>' +
          '</button>' : '') +
          (match.isLive ? '<button class="detail-action-btn detail-watch-btn" data-detail-watch="' + idx + '">' +
            '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>' +
            '<span>Watch Live</span>' +
          '</button>' : '') +
          (isPlayed ? '<div class="detail-played-label">&#10003; Watched</div>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", function(e) { if (e.target === modal) modal.remove(); });

    modal.querySelector("[data-detail-fav]").addEventListener("click", function() {
      toggleFavorite(match.home);
      modal.remove();
    });

    var watchBtn = modal.querySelector("[data-detail-watch]");
    if (watchBtn) {
      watchBtn.addEventListener("click", function() {
        modal.remove();
        playMatch(idx);
      });
    }

    var shareBtn = modal.querySelector("[data-detail-share]");
    if (shareBtn) {
      shareBtn.addEventListener("click", function() {
        shareMatch(match);
      });
    }

    var standingsBtn = modal.querySelector("[data-detail-standings]");
    if (standingsBtn) {
      standingsBtn.addEventListener("click", function() {
        modal.remove();
        showStandings(match.league);
      });
    }
  }

  function hexToRgbaLocal(hex, alpha) {
    if (!hex) return "rgba(20,20,24," + alpha + ")";
    hex = hex.replace("#", "");
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  /* === SLEEP TIMER === */
  var sleepTimerId = null;
  var sleepTimerEnd = 0;

  function showSleepTimer() {
    var modal = document.createElement("div");
    modal.className = "modal-overlay";
    var remainText = "";
    if (sleepTimerId) {
      var rem = Math.max(0, Math.floor((sleepTimerEnd - Date.now()) / 60000));
      remainText = '<div class="sleep-remaining">Active: ' + rem + ' min remaining</div>';
    }
    modal.innerHTML = '<div class="modal-sheet">' +
      '<div class="modal-handle"></div>' +
      '<div class="modal-header"><span class="modal-title">Sleep Timer</span><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">&times;</button></div>' +
      '<div class="modal-body">' +
        remainText +
        '<div class="sleep-options">' +
          '<button class="sleep-opt" data-mins="15">15 min</button>' +
          '<button class="sleep-opt" data-mins="30">30 min</button>' +
          '<button class="sleep-opt" data-mins="45">45 min</button>' +
          '<button class="sleep-opt" data-mins="60">1 hour</button>' +
          '<button class="sleep-opt" data-mins="120">2 hours</button>' +
          (sleepTimerId ? '<button class="sleep-opt sleep-cancel" data-mins="0">Cancel Timer</button>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", function(e) { if (e.target === modal) modal.remove(); });

    modal.querySelectorAll(".sleep-opt").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var mins = parseInt(btn.getAttribute("data-mins"), 10);
        if (sleepTimerId) { clearTimeout(sleepTimerId); sleepTimerId = null; }
        if (mins > 0) {
          sleepTimerEnd = Date.now() + mins * 60000;
          sleepTimerId = setTimeout(function() {
            stopPlayback();
            showToast("Sleep timer: stopped playback");
            sleepTimerId = null;
          }, mins * 60000);
          showToast("Sleep timer set: " + mins + " min");
        } else {
          showToast("Sleep timer cancelled");
        }
        modal.remove();
      });
    });
  }

  /* === AUDIO ONLY MODE === */
  var audioOnlyMode = false;

  function toggleAudioOnly() {
    audioOnlyMode = !audioOnlyMode;
    if (audioOnlyMode) {
      video.style.opacity = "0";
      video.style.position = "absolute";
      var overlay = document.createElement("div");
      overlay.id = "audio-only-overlay";
      overlay.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#000;z-index:1;color:#fff;text-align:center;padding:20px";
      overlay.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64" style="color:var(--accent);margin-bottom:16px"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' +
        '<div style="font-size:1.1rem;font-weight:700;margin-bottom:4px">Audio Only</div>' +
        '<div style="font-size:0.8rem;color:var(--muted)">Lower battery usage</div>';
      var playerVideo = document.querySelector(".player-video");
      if (playerVideo) playerVideo.appendChild(overlay);
      showToast("Audio-only mode ON");
    } else {
      video.style.opacity = "1";
      video.style.position = "";
      var overlay = document.getElementById("audio-only-overlay");
      if (overlay) overlay.remove();
      showToast("Audio-only mode OFF");
    }
  }

  /* === INIT === */
  loadMatches();
  setInterval(loadMatches, 30000);
  setInterval(function() {
    var statusEl = document.getElementById("host-status");
    if (statusEl && workingHost) {
      statusEl.textContent = workingHost.replace("https://", "").split(".")[0];
      statusEl.className = "host-status";
    }
  }, 5000);

  /* === ONBOARDING === */
  (function() {
    var seen = localStorage.getItem("xion_onboarding_done");
    if (seen) return;
    var overlay = document.getElementById("onboarding");
    if (!overlay) return;
    overlay.style.display = "flex";
    var steps = [
      "Live scores, HD streams, and your favorite teams — all in one place.",
      "Tap the heart on any match card to star your favorite teams. They'll always appear at the top.",
      "Pull down to refresh, tap Live for all matches, or use search to find any game."
    ];
    var step = 0;
    var dots = overlay.querySelectorAll(".onboarding-dot");
    var desc = overlay.querySelector(".onboarding-desc");
    var btn = document.getElementById("onboarding-btn");
    var skip = document.getElementById("onboarding-skip");

    function goTo(s) {
      step = s;
      dots.forEach(function(d, i) { d.classList.toggle("active", i === step); });
      desc.textContent = steps[step];
      btn.textContent = step === 2 ? "Start Watching" : "Next";
    }

    btn.addEventListener("click", function() {
      if (step < 2) { goTo(step + 1); } else { close(); }
    });
    skip.addEventListener("click", close);
    function close() {
      overlay.style.display = "none";
      localStorage.setItem("xion_onboarding_done", "1");
    }
  })();

  /* === THEME TOGGLE === */
  window.toggleTheme = function() {
    isDarkTheme = !isDarkTheme;
    if (isDarkTheme) {
      document.documentElement.classList.remove("light-theme");
    } else {
      document.documentElement.classList.add("light-theme");
    }
    localStorage.setItem("xion_theme", isDarkTheme ? "dark" : "light");
  };

  /* === SHARE MATCH === */
  function shareMatch(match) {
    var text = match.home + " vs " + match.away;
    if (match.homeScore !== null) text += " (" + match.homeScore + " - " + match.awayScore + ")";
    text += " — " + (match.league || "Live") + " on XionLive";
    if (navigator.share) {
      navigator.share({ title: "XionLive", text: text }).catch(function() {});
    } else {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() { showToast("Copied to clipboard"); });
      }
    }
  }
  window.shareMatch = shareMatch;

  /* === CONTEXT MENU === */
  function showContextMenu(e, idx) {
    closeContextMenu();
    var match = matchData[idx];
    if (!match) return;
    var isFav = isFavorite(match);
    var menu = document.createElement("div");
    menu.className = "context-menu";
    menu.style.left = Math.min(e.clientX || 100, window.innerWidth - 200) + "px";
    menu.style.top = Math.min(e.clientY || 100, window.innerHeight - 200) + "px";
    menu.innerHTML =
      '<div class="context-menu-item" data-cm="watch"><span class="cm-icon">&#9654;</span>Watch Match</div>' +
      '<div class="context-menu-item" data-cm="fav"><span class="cm-icon">' + (isFav ? '&#9733;' : '&#9734;') + '</span>' + (isFav ? 'Unfavorite' : 'Favorite') + '</div>' +
      '<div class="context-menu-item" data-cm="share"><span class="cm-icon">&#128279;</span>Share</div>';
    document.body.appendChild(menu);
    contextMenuEl = menu;

    menu.querySelector("[data-cm='watch']").addEventListener("click", function() {
      closeContextMenu(); playMatch(idx);
    });
    menu.querySelector("[data-cm='fav']").addEventListener("click", function() {
      closeContextMenu(); toggleFavorite(match.home);
    });
    menu.querySelector("[data-cm='share']").addEventListener("click", function() {
      closeContextMenu(); shareMatch(match);
    });

    setTimeout(function() {
      document.addEventListener("click", closeContextMenu, { once: true });
    }, 10);
  }
  function closeContextMenu() {
    if (contextMenuEl) { contextMenuEl.remove(); contextMenuEl = null; }
  }
  window.closeContextMenu = closeContextMenu;

  /* === STANDINGS TABLE === */
  function showStandings(league) {
    var modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = '<div class="modal-sheet">' +
      '<div class="modal-handle"></div>' +
      '<div class="modal-header"><span class="modal-title">' + esc(league || "Standings") + '</span><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">&times;</button></div>' +
      '<div class="modal-body"><div class="standings-loading">Loading standings...</div></div>' +
    '</div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", function(e) { if (e.target === modal) modal.remove(); });

    var body = modal.querySelector(".modal-body");

    var leagueId = null;
    var leagueMap = {
      "premier league": 2021, "la liga": 2014, "serie a": 2019,
      "bundesliga": 2002, "ligue 1": 2015, "eredivisie": 2003,
      "champions league": 2001, "europa league": 2146, "conference league": 2147,
      "jupiler pro league": 2012, "belgian pro league": 2012, "pro league": 2012
    };
    var lKey = (league || "").toLowerCase().trim();
    for (var k in leagueMap) {
      if (lKey.indexOf(k) !== -1 || k.indexOf(lKey) !== -1) { leagueId = leagueMap[k]; break; }
    }

    if (!leagueId) {
      body.innerHTML = '<div class="standings-loading">Standings not available for this league</div>';
      return;
    }

    fetch("https://api.football-data.org/v4/competitions/" + leagueId + "/standings", {
      headers: { "X-Auth-Token": "b1675e81be5b4a0d987ed68e7a66e0a2" }
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var table = d.standings && d.standings[0] && d.standings[0].table;
        if (!table || !table.length) {
          body.innerHTML = '<div class="standings-loading">No standings data available</div>';
          return;
        }
        var html = '<table class="standings-table"><thead><tr><th class="pos">#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th class="pts">Pts</th></tr></thead><tbody>';
        for (var i = 0; i < Math.min(table.length, 20); i++) {
          var t = table[i];
          html += '<tr><td class="pos">' + t.position + '</td><td class="team">' + esc(t.team.shortName || t.team.name) + '</td><td>' + t.playedGames + '</td><td>' + t.won + '</td><td>' + t.draw + '</td><td>' + t.lost + '</td><td>' + (t.goalDifference > 0 ? "+" : "") + t.goalDifference + '</td><td class="pts">' + t.points + '</td></tr>';
        }
        html += '</tbody></table>';
        body.innerHTML = html;
      })
      .catch(function() {
        body.innerHTML = '<div class="standings-loading">Failed to load standings</div>';
      });
  }
  window.showStandings = showStandings;
})();
