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
        if (l.indexOf("jupiler") !== -1 || l.indexOf("belgian") !== -1 || l.indexOf("pro league") !== -1) return 1;
        if (l.indexOf("primera") !== -1 || l.indexOf("la liga") !== -1 || l.indexOf("spain") !== -1) return 2;
        if (l.indexOf("champion") !== -1 && l.indexOf("league") !== -1) return 3;
        if (l.indexOf("europa") !== -1 && l.indexOf("league") !== -1) return 4;
        if (l.indexOf("conference") !== -1 && l.indexOf("league") !== -1) return 4;
        if (l.indexOf("premier") !== -1) return 5;
        if (l.indexOf("ligue 1") !== -1) return 6;
        if (l.indexOf("serie a") !== -1 && l.indexOf("serie c") === -1) return 7;
        if (l.indexOf("bundesliga") !== -1) return 8;
        if (l.indexOf("eredivisie") !== -1) return 9;
        return 20;
      }
      var pa = lp(a), pb = lp(b);
      if (pa !== pb) return pa - pb;
      return a.localeCompare(b);
    });
    return { groups: groups, order: order };
  }

  function renderMatchCard(match) {
    var idx = matchData.indexOf(match);
    var ir = resolvingMatchId === match.matchId;
    var ip = playedIds.indexOf(match.matchId) !== -1;
    var leagueLogo = XionLogos.getLeagueLogo(match.league);
    var sportClass = (match.sport || "others").toLowerCase().replace(/[^a-z]/g, "");
    var initials = XionLogos.getInitials(match.home || "?") + " " + XionLogos.getInitials(match.away || "?");
    var color = XionLogos.getColorForName(match.home || "team");

    var logoHtml = leagueLogo
      ? '<img src="' + esc(leagueLogo) + '" alt="" onerror="this.parentElement.innerHTML=\'' + esc(XionLogos.getSportIcon(match.sport)) + '\'">'
      : esc(XionLogos.getSportIcon(match.sport));

    return '<div class="match-card' + (ir ? " resolving" : "") + (ip ? " played" : "") + '" data-idx="' + idx + '">' +
      '<div class="card-header">' +
        '<div class="card-logo" style="background:' + color + '20">' + logoHtml + '</div>' +
        '<div class="card-league">' + esc(match.league || match.sport || "Live") + '</div>' +
      '</div>' +
      '<div class="card-teams">' +
        '<div class="card-team">' + esc(match.home || "?") + '</div>' +
        '<div class="card-vs">vs</div>' +
        '<div class="card-team">' + esc(match.away || "?") + '</div>' +
      '</div>' +
      '<div class="card-footer">' +
        '<span class="sport-badge ' + sportClass + '">' + esc(match.sport || "live") + '</span>' +
        '<span class="live-badge"><span class="live-dot"></span>LIVE</span>' +
      '</div>' +
    '</div>';
  }

  function renderContent() {
    var matches = getFilteredMatches();
    if (!matches.length) {
      matchContent.innerHTML = '<div class="empty-state"><div class="empty-icon">&#127941;</div><p>' +
        (searchInput.value ? "No matches found" : "No live matches") + '</p></div>';
      return;
    }

    if (currentView === "home") {
      var featured = matches.slice(0, 6);
      var rest = matches.slice(6);
      var html = "";
      if (featured.length) {
        html += '<div class="section-title">Live Now</div>';
        html += '<div class="match-grid">';
        for (var i = 0; i < featured.length; i++) html += renderMatchCard(featured[i]);
        html += '</div>';
      }
      if (rest.length) {
        var groups = getLeagueGroups(rest);
        for (var oi = 0; oi < groups.order.length; oi++) {
          html += '<div class="section-title">' + esc(groups.order[oi]) + '</div>';
          html += '<div class="match-grid">';
          var lm = groups.groups[groups.order[oi]];
          for (var j = 0; j < lm.length; j++) html += renderMatchCard(lm[j]);
          html += '</div>';
        }
      }
      matchContent.innerHTML = html;
    } else if (currentView === "live") {
      var html = '<div class="match-grid" style="padding-top:8px">';
      for (var i = 0; i < matches.length; i++) html += renderMatchCard(matches[i]);
      html += '</div>';
      matchContent.innerHTML = html;
    } else if (currentView === "history") {
      renderHistoryView();
    }
  }

  function renderHistoryView() {
    if (!streamHistory.length) {
      matchContent.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128337;</div><p>No watch history</p></div>';
      return;
    }
    var html = '<div class="match-grid" style="padding-top:8px">';
    for (var i = 0; i < streamHistory.length; i++) {
      var h = streamHistory[i];
      if (!h || !h.name) continue;
      html += '<div class="match-card" data-hist-idx="' + i + '">' +
        '<div class="card-header">' +
          '<div class="card-logo" style="background:var(--accent)">&#9654;</div>' +
          '<div class="card-league">Saved Stream</div>' +
        '</div>' +
        '<div class="card-teams">' +
          '<div class="card-team">' + esc(h.name) + '</div>' +
        '</div>' +
        '<div class="card-footer">' +
          '<span class="sport-badge others">saved</span>' +
          '<span class="live-badge" style="color:var(--muted)">' + timeAgo(h.time) + '</span>' +
        '</div>' +
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
