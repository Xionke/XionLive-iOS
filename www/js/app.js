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
  var currentData = null;
  var hls = null;
  var currentSport = "all";
  var currentView = "home";
  var resolvingMatchId = null;
  var controlsTimer = null;
  var headerTimer = null;

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

  try {
    streamHistory = JSON.parse(localStorage.getItem("xion_history") || "[]");
  } catch(e) { streamHistory = []; }
  try {
    playedIds = JSON.parse(localStorage.getItem("xion_played") || "[]");
  } catch(e) { playedIds = []; }

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
      renderContent();
      XionLogos.fetchAllTeamLogos(matchData);
      setTimeout(function() { renderContent(); }, 2000);
    }

    tryHost(0, 0);
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

  function renderMatchCard(match) {
    var idx = matchData.indexOf(match);
    var ir = resolvingMatchId === match.matchId;
    var leagueLogo = XionLogos.getLeagueLogo(match.league);
    var sportClass = (match.sport || "others").toLowerCase().replace(/[^a-z]/g, "");

    var leagueLogoHtml = leagueLogo
      ? '<div class="card-league-logo"><img src="' + esc(leagueLogo) + '" alt="" onerror="this.style.display=\'none\'"></div>'
      : '<div class="card-league-logo"><span class="logo-fallback">' + esc((match.league || "?").substring(0, 2).toUpperCase()) + '</span></div>';

    return '<div class="match-card' + (ir ? " resolving" : "") + '" data-idx="' + idx + '">' +
      '<div class="card-league-row">' +
        leagueLogoHtml +
        '<span class="card-league-name">' + esc(match.league || match.sport || "Live") + '</span>' +
        '<span class="card-live-badge"><span class="live-dot"></span>LIVE</span>' +
      '</div>' +
      '<div class="card-teams">' +
        '<div class="card-team-row">' +
          teamLogoHtml(match.home) +
          '<span class="card-team-name">' + esc(match.home || "?") + '</span>' +
        '</div>' +
        '<div class="card-team-row">' +
          teamLogoHtml(match.away) +
          '<span class="card-team-name">' + esc(match.away || "?") + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="card-footer">' +
        '<span class="sport-badge ' + sportClass + '">' + esc(match.sport || "live") + '</span>' +
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

    return '<div class="hero-banner">' +
      '<div class="hero-glow"></div>' +
      '<div class="hero-inner">' +
        '<div class="hero-league">' + leagueLogoHtml + esc(featured.league || "Live Football") + '</div>' +
        '<div class="hero-headline">' +
          esc(featured.home || "Featured") + ' <span>vs</span> ' + esc(featured.away || "Match") +
        '</div>' +
        '<div class="hero-desc">Follow it all live on XionLive.</div>' +
        '<button class="hero-cta" data-idx="' + matchData.indexOf(featured) + '">' +
          '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>' +
          'Watch Live' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function renderContent() {
    var matches = getFilteredMatches();
    if (!matches.length) {
      matchContent.innerHTML = '<div class="empty-state"><p>' +
        (searchInput.value ? "No matches found" : "No live matches") + '</p></div>';
      return;
    }

    if (currentView === "home") {
      var html = renderHero(matches);
      var remaining = matches.slice(1);
      if (remaining.length) {
        html += '<div class="section-header"><div class="section-title"><span class="live-indicator"></span>LIVE NOW</div></div>';
        html += '<div class="match-grid">';
        for (var i = 0; i < remaining.length; i++) html += renderMatchCard(remaining[i]);
        html += '</div>';
      }
      matchContent.innerHTML = html;
    } else if (currentView === "live") {
      var html = '<div class="section-header"><div class="section-title"><span class="live-indicator"></span>ALL LIVE</div></div>';
      html += '<div class="match-grid">';
      for (var i = 0; i < matches.length; i++) html += renderMatchCard(matches[i]);
      html += '</div>';
      matchContent.innerHTML = html;
    } else if (currentView === "history") {
      renderHistoryView();
    }
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
  });

  matchContent.addEventListener("click", function(e) {
    var heroBtn = e.target.closest(".hero-cta");
    if (heroBtn) {
      var idx = heroBtn.getAttribute("data-idx");
      if (idx !== null) playMatch(parseInt(idx, 10));
      return;
    }
    var card = e.target.closest(".match-card");
    if (!card) return;
    var idx = card.getAttribute("data-idx");
    if (idx !== null) playMatch(parseInt(idx, 10));
    var histIdx = card.getAttribute("data-hist-idx");
    if (histIdx !== null) {
      var h = streamHistory[parseInt(histIdx, 10)];
      if (h) {
        currentData = { playableUrl: h.playableUrl, name: h.name, inputUrl: h.inputUrl };
        showPlayer(h.name);
        startPlayback(h.playableUrl, h.name);
      }
    }
  });

  /* === INIT === */
  loadMatches();
  setInterval(loadMatches, 30000);
})();
