(function() {
  'use strict';

  /* === CONFIG === */
  var API_HOSTS = [
    'https://apis-data10.tcdru136ovur.ru',
    'https://apis-data8.tcdru136ovur.ru',
    'https://apis-data11.tcdru136ovur.ru'
  ];
  var SPORT_TYPES = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 90];
  var API_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://jack27eo.mpgreatestclgczbmiddle.my/',
    'Origin': 'https://jack27eo.mpgreatestclgczbmiddle.my'
  };

  var LEAGUE_PRIORITY = {
    'jupiler': 1, 'belgian pro': 1, 'pro league': 1,
    'champions': 2, 'champion league': 2,
    'europa': 3, 'europa league': 3,
    'conference': 4, 'conference league': 4,
    'premier': 5, 'premier league': 5,
    'primera': 6, 'la liga': 6, 'spain': 6,
    'serie a': 7,
    'bundesliga': 8,
    'ligue 1': 9,
    'eredivisie': 10,
    'primeira': 11, 'liga portugal': 11
  };

  var matchData = [];
  var streamHistory = [];
  var resolvingMatchId = null;
  var currentTab = 'live';

  try { var r = localStorage.getItem('xion_history'); if (r) { var p = JSON.parse(r); if (Array.isArray(p)) streamHistory = p.filter(function(h){return h&&h.name}); } } catch(e){}

  var matchList = document.getElementById('match-list');
  var playerEmpty = document.getElementById('player-empty');
  var playerBar = document.getElementById('player-bar');
  var playerLoading = document.getElementById('player-loading');
  var streamInfo = document.getElementById('stream-info');

  /* === HELPERS === */
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function showToast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2000);
  }

  function timeAgo(t) {
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  function getLeaguePriority(league) {
    var l = (league || '').toLowerCase();
    for (var key in LEAGUE_PRIORITY) {
      if (l.indexOf(key) !== -1) return LEAGUE_PRIORITY[key];
    }
    return 20;
  }

  /* === LEAGUE LOGOS === */
  var LEAGUE_LOGOS = {
    'premier league': 'https://www.thesportsdb.com/images/media/league/vuvtsu1473502969.png',
    'la liga': 'https://www.thesportsdb.com/images/media/league/3jvar41448813215.png',
    'serie a': 'https://www.thesportsdb.com/images/media/league/uXFo6j1549154717.png',
    'bundesliga': 'https://www.thesportsdb.com/images/media/league/z4xls61473502896.png',
    'ligue 1': 'https://www.thesportsdb.com/images/media/league/1m4g361517662178.png',
    'champions league': 'https://www.thesportsdb.com/images/media/league/vwvwrw1473502969.png',
    'europa league': 'https://www.thesportsdb.com/images/media/league/6 UNU1532152840.png',
    'conference league': 'https://www.thesportsdb.com/images/media/league/6 UNU1532152840.png',
    'eredivisie': 'https://www.thesportsdb.com/images/media/league/wpojwr1473502969.png',
    'primeira liga': 'https://www.thesportsdb.com/images/media/league/2hn57q1593386478.png'
  };

  function getLeagueLogo(league) {
    var l = (league || '').toLowerCase();
    for (var key in LEAGUE_LOGOS) {
      if (l.indexOf(key) !== -1) return LEAGUE_LOGOS[key];
    }
    return null;
  }

  /* === MATCH LOADING === */
  function loadMatches() {
    console.log('[xion] loadMatches: fetching directly from API');
    var workingHost = null;
    var allMatches = [];
    var completed = 0;

    function tryHost(hostIdx, sportIdx) {
      if (hostIdx >= API_HOSTS.length) { finishLoad(); return; }
      var host = API_HOSTS[hostIdx];
      var sport = SPORT_TYPES[sportIdx];
      var url = host + '/api/match/live?sportType=' + sport;

      var controller = new AbortController();
      var timeout = setTimeout(function() { controller.abort(); }, 8000);

      fetch(url, {
        headers: API_HEADERS,
        signal: controller.signal
      })
      .then(function(r) {
        clearTimeout(timeout);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer();
      })
      .then(function(buf) {
        var matches = window.parseMatchesFromBuffer(buf, sport);
        console.log('[xion] host=' + hostIdx + ' sport=' + sport + ' got ' + matches.length + ' matches');
        if (!workingHost) workingHost = host;
        for (var i = 0; i < matches.length; i++) allMatches.push(matches[i]);
        completed++;
        nextSportOrHost();
      })
      .catch(function(e) {
        clearTimeout(timeout);
        console.warn('[xion] fetch failed host=' + hostIdx + ' sport=' + sport + ': ' + e.message);
        if (sportIdx === 0) tryHost(hostIdx + 1, 0);
        else nextSportOrHost();
      });
    }

    function nextSportOrHost() {
      var nextIdx = completed;
      if (nextIdx >= SPORT_TYPES.length) { finishLoad(); return; }
      tryHost(workingHost ? API_HOSTS.indexOf(workingHost) : 0, nextIdx);
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
      renderList();
      XionLogos.fetchAllTeamLogos(matchData);
      setTimeout(function() { renderList(); }, 2000);
    }

    tryHost(0, 0);
  }

  /* === RENDERING === */
  function renderList() {
    var html = '';

    if (currentTab === 'history') {
      if (!streamHistory.length) {
        html = '<div class="tv-sidebar-empty">No saved streams</div>';
      } else {
        for (var i = 0; i < streamHistory.length; i++) {
          var h = streamHistory[i];
          if (!h || !h.name) continue;
          html += '<div class="tv-match" tabindex="0" data-hist-idx="' + i + '">' +
            '<div class="tv-match-info">' +
              '<div class="tv-match-teams">' + esc(h.name) + '</div>' +
              '<div class="tv-match-meta"><span class="tv-match-time">' + timeAgo(h.time) + '</span></div>' +
            '</div>' +
            '<button class="remove-btn" data-remove-hist="' + i + '" title="Remove">x</button>' +
          '</div>';
        }
      }
      matchList.innerHTML = html;
      return;
    }

    var displayMatches = [];
    for (var i = 0; i < matchData.length; i++) {
      var m = matchData[i];
      if (currentTab === 'live') {
        if (m.isLive) displayMatches.push(m);
      } else if (currentTab === 'scheduled') {
        if (!m.isLive) displayMatches.push(m);
      }
    }

    if (!displayMatches.length) {
      html = '<div class="tv-sidebar-empty">' + (currentTab === 'scheduled' ? 'No upcoming matches' : 'No live matches') + '</div>';
      matchList.innerHTML = html;
      return;
    }

    var groups = {};
    var order = [];
    for (var i = 0; i < displayMatches.length; i++) {
      var m = displayMatches[i];
      var k = m.league || m.sport || 'Other';
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(m);
    }
    order.sort(function(a, b) {
      var pa = getLeaguePriority(a), pb = getLeaguePriority(b);
      if (pa !== pb) return pa - pb;
      return a.localeCompare(b);
    });

    for (var oi = 0; oi < order.length; oi++) {
      var leagueName = order[oi];
      var leagueLogo = getLeagueLogo(leagueName);
      var logoHtml = leagueLogo ? '<img src="' + leagueLogo + '" class="tv-match-logo" onerror="this.style.display=\'none\'">' : '';
      html += '<div class="tv-league">' + logoHtml + ' ' + esc(leagueName) + '</div>';

      var lm = groups[leagueName];
      for (var j = 0; j < lm.length; j++) {
        var mm = lm[j];
        var idx = matchData.indexOf(mm);
        var ir = resolvingMatchId === mm.matchId;
        var sc = (mm.sport || 'others').toLowerCase().replace(/[^a-z]/g, '');
        var statusText = '';
        var statusClass = '';
        var ms = mm.matchStatus;
        if (ms === 1 || ms === 3 || ms === 4 || ms === 5) {
          statusText = mm.matchMinute ? mm.matchMinute + "'" : 'LIVE';
          statusClass = 'tv-match-status';
        } else if (ms === 2) {
          statusText = 'HT';
          statusClass = 'tv-match-status';
        }

        var teamLogoHtml = '';
        var logoUrl = XionLogos.getTeamLogo(mm.home);
        if (logoUrl) teamLogoHtml = '<img src="' + logoUrl + '" class="tv-match-logo" onerror="this.style.display=\'none\'">';

        html += '<div class="tv-match' + (ir ? ' resolving' : '') + '" tabindex="0" data-match-idx="' + idx + '">' +
          teamLogoHtml +
          '<div class="tv-match-info">' +
            '<div class="tv-match-teams">' + esc(mm.home || '?') + ' vs ' + esc(mm.away || '?') + '</div>' +
            '<div class="tv-match-meta">' +
              '<span class="tv-sport-badge ' + sc + '">' + esc(mm.sport || 'live') + '</span>' +
              (statusText ? '<span class="' + statusClass + '">' + statusText + '</span>' : '') +
            '</div>' +
          '</div>' +
          (ir ? '<span class="resolving-badge">Resolving...</span>' : '') +
        '</div>';
      }
    }

    matchList.innerHTML = html;
  }

  /* === TAB SWITCHING === */
  document.querySelectorAll('.tv-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tv-tab').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentTab = btn.getAttribute('data-tab');
      renderList();
    });
  });

  /* === MATCH CLICK === */
  matchList.addEventListener('click', function(e) {
    var removeBtn = e.target.closest('[data-remove-hist]');
    if (removeBtn) {
      e.stopPropagation();
      var ri = parseInt(removeBtn.getAttribute('data-remove-hist'), 10);
      streamHistory.splice(ri, 1);
      localStorage.setItem('xion_history', JSON.stringify(streamHistory));
      renderList();
      return;
    }

    var item = e.target.closest('.tv-match');
    if (!item) return;

    var histIdx = item.getAttribute('data-hist-idx');
    if (histIdx !== null) {
      var h = streamHistory[parseInt(histIdx, 10)];
      if (h) {
        openStream({ name: h.name, url: h.inputUrl });
      }
      return;
    }

    var matchIdx = parseInt(item.getAttribute('data-match-idx'), 10);
    if (!isNaN(matchIdx)) showMatchModal(matchData[matchIdx]);
  });

  /* === D-PAD KEYBOARD NAVIGATION === */
  document.addEventListener('keydown', function(e) {
    var focusable = matchList.querySelectorAll('.tv-match');
    if (!focusable.length) return;
    var current = document.activeElement;
    var items = Array.from(focusable);
    var idx = items.indexOf(current);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      var next = idx < items.length - 1 ? idx + 1 : 0;
      items[next].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      var prev = idx > 0 ? idx - 1 : items.length - 1;
      items[prev].focus();
    } else if (e.key === 'Enter' && current && current.classList.contains('tv-match')) {
      e.preventDefault();
      current.click();
    } else if (e.key === 'Escape') {
      document.getElementById('match-modal').style.display = 'none';
      document.getElementById('stream-picker').style.display = 'none';
    } else if (e.key === 'ArrowRight') {
      if (current && current.classList.contains('tv-match')) {
        var matchIdx = parseInt(current.getAttribute('data-match-idx'), 10);
        if (!isNaN(matchIdx)) {
          e.preventDefault();
          showMatchModal(matchData[matchIdx]);
        }
      }
    }
  });

  /* === MATCH DETAIL MODAL === */
  var matchModal = document.getElementById('match-modal');
  var modalHome = document.getElementById('modal-home');
  var modalAway = document.getElementById('modal-away');
  var modalLeague = document.getElementById('modal-league');
  var modalSport = document.getElementById('modal-sport');
  var modalStatus = document.getElementById('modal-status');
  var modalHomeLogo = document.getElementById('modal-home-logo');
  var modalAwayLogo = document.getElementById('modal-away-logo');
  var modalWatch = document.getElementById('modal-watch');

  function showMatchModal(match) {
    if (!match) return;
    modalHome.textContent = match.home || '?';
    modalAway.textContent = match.away || '?';
    modalLeague.textContent = match.league || match.sport || '';
    modalSport.textContent = (match.sport || 'Sport').toUpperCase();

    var homeLogo = XionLogos.getTeamLogo(match.home);
    var awayLogo = XionLogos.getTeamLogo(match.away);
    modalHomeLogo.src = homeLogo || '';
    modalHomeLogo.style.display = homeLogo ? '' : 'none';
    modalAwayLogo.src = awayLogo || '';
    modalAwayLogo.style.display = awayLogo ? '' : 'none';

    var ms = match.matchStatus;
    if (ms === 1 || ms === 2 || ms === 3 || ms === 4 || ms === 5) {
      if (ms === 1 || ms === 3 || ms === 4 || ms === 5) modalStatus.textContent = 'LIVE';
      else if (ms === 2) modalStatus.textContent = 'HT';
    } else if (ms === 6) {
      modalStatus.textContent = 'FINISHED';
    } else {
      modalStatus.textContent = 'vs';
    }

    var isLive = match.isLive;
    modalWatch.style.display = isLive ? '' : 'none';

    matchModal.style.display = 'flex';
    matchModal._match = match;

    if (isLive) modalWatch.focus();
    else document.getElementById('modal-close').focus();
  }

  document.getElementById('modal-close').addEventListener('click', function() {
    matchModal.style.display = 'none';
  });

  modalWatch.addEventListener('click', function() {
    var match = matchModal._match;
    matchModal.style.display = 'none';
    if (match) openStream(match);
  });

  matchModal.addEventListener('click', function(e) {
    if (e.target === matchModal) matchModal.style.display = 'none';
  });

  /* === STREAM PLAYBACK VIA IFRAME === */
  var VERCEL_BASE = 'https://xionlive.vercel.app';
  var playerIframe = document.getElementById('player-iframe');
  var iframeBack = document.getElementById('iframe-back');

  function openStream(match) {
    playerEmpty.style.display = 'none';
    playerLoading.style.display = 'none';
    playerBar.style.display = 'flex';
    streamInfo.textContent = match.name || 'Live';
    playerIframe.style.display = 'block';
    iframeBack.style.display = 'flex';
    playerIframe.src = VERCEL_BASE + '/?match=' + encodeURIComponent(match.url);
    addToHistory(match.name || match.name, match.url, match.url);
  }

  iframeBack.addEventListener('click', function() {
    playerIframe.style.display = 'none';
    playerIframe.src = 'about:blank';
    iframeBack.style.display = 'none';
    playerEmpty.style.display = 'flex';
    playerBar.style.display = 'none';
  });

  /* === MATCH DETAIL MODAL === */

  /* === INIT === */
  renderList();
  loadMatches();
  setInterval(loadMatches, 30000);

})();
