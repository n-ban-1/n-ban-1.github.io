/* Indiana Hoosiers Football — Hardened & Expanded
   Security: input sanitization, CSP-ready, safe DOM methods
   Logging: human-readable categories instead of emojis
   Stats: turnover margin, red zone, first downs, avg possession (ESPN team boxscore)
   Depth chart: manually curated — ESPN roster API does not expose depth order
   Version: 5.0
*/

(function () {
  'use strict';

  /* ============================================================
     LOGGER — human-readable, categorized, no emojis
  ============================================================ */
  const LOG = {
    _ts() { return new Date().toISOString(); },
    info(msg, data)    { console.log(`[INFO]  ${this._ts()} | ${msg}`,  data !== undefined ? data : ''); },
    warn(msg, data)    { console.warn(`[WARN]  ${this._ts()} | ${msg}`, data !== undefined ? data : ''); },
    error(msg, data)   { console.error(`[ERROR] ${this._ts()} | ${msg}`, data !== undefined ? data : ''); },
    net(msg, data)     { console.log(`[NET]   ${this._ts()} | ${msg}`,  data !== undefined ? data : ''); },
    cache(msg, data)   { console.log(`[CACHE] ${this._ts()} | ${msg}`,  data !== undefined ? data : ''); },
    debug(msg, data)   { console.debug(`[DEBUG] ${this._ts()} | ${msg}`, data !== undefined ? data : ''); },
    load(msg, data)    { console.log(`[LOAD]  ${this._ts()} | ${msg}`,  data !== undefined ? data : ''); },
    api(msg, data)     { console.log(`[API]   ${this._ts()} | ${msg}`,  data !== undefined ? data : ''); },
  };

  /* ============================================================
     SECURITY UTILITIES
  ============================================================ */
  const SEC = {
    /** Escape HTML entities — applied to every API value injected via innerHTML. */
    esc(str, maxLen = 500) {
      if (str == null) return '';
      return String(str).slice(0, maxLen)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    },

    /** Validate safe finite number. */
    safeNum(v, fallback = '--') {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    },

    /**
     * Validate URLs used in href/src attributes.
     * Blocks javascript:, data:, vbscript: and any non-http(s) scheme.
     * Only allows known-safe origins for external links.
     */
    safeUrl(url, allowedPrefixes = []) {
      if (!url || typeof url !== 'string') return null;
      const s = url.trim().toLowerCase();
      // Block dangerous schemes — including encoded variants
      if (/^(javascript|data|vbscript|blob):/i.test(s)) {
        LOG.warn('Blocked dangerous URL scheme', url);
        return null;
      }
      // Must be https
      if (!s.startsWith('https://')) return null;
      // If a prefix allowlist is provided, enforce it
      if (allowedPrefixes.length && !allowedPrefixes.some(p => s.startsWith(p.toLowerCase()))) {
        LOG.warn('Blocked URL not in allowlist', url);
        return null;
      }
      return url;
    },

    /** Allow only ESPN CDN URLs for image src. */
    safeImgSrc(url, fallback) {
      return SEC.safeUrl(url, ['https://a.espncdn.com/', 'https://cdn.espn.com/']) || fallback;
    },

    /** Allow only ESPN player profile URLs for links. */
    safePlayerUrl(url) {
      return SEC.safeUrl(url, ['https://www.espn.com/college-football/player/']) || null;
    },

    /** Strip to alphanumeric + dash + underscore for data attributes / cache keys. */
    safeKey(v) {
      return String(v).replace(/[^a-zA-Z0-9_\-]/g, '');
    },

    /** Validate a year is within sane range — prevents crafted years in API URLs. */
    safeYear(v, min = 1990, max = new Date().getFullYear() + 2) {
      const n = parseInt(v, 10);
      return (Number.isFinite(n) && n >= min && n <= max) ? n : null;
    },
  };

  /* ============================================================
     MAIN APP CLASS
  ============================================================ */
  class IndianaFootball {
    constructor() {
      this.TEAM_ID = 84;
      this.DATA_BASE = './indiana_football_history';
      this.MIN_YEAR = 1995;
      this.ESPN = { site: 'https://site.api.espn.com' };

      const nowY  = new Date().getFullYear();
      const month = new Date().getMonth(); // 0=Jan
      // Off-season is Jan–Jul: the most recent complete season is prior calendar year
      this.currentYear    = month < 7 ? nowY - 1 : nowY;
      this.availableYears = this.rangeYears(nowY, this.MIN_YEAR);

      LOG.info(`Off-season detection — calendar year ${nowY}, month ${month + 1}, defaulting to ${this.currentYear} season`);

      this.isMobile = typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 768px)').matches
        : false;
      this.summaryConcurrency = this.isMobile ? 2 : 4;

      this.mem = new Map();
      this._statKeysDumped = false;
      this.depthCharts = { 2026: this.dc2026(), 2025: this.dc2025(), 2024: this.dc2024() };
      this.currentRosterYear = 2026;
      this.winsChart = null;
      this.rankingChart = null;
      this._winProbCharts = new Map();

      this.dom = {
        loading:       document.getElementById('loading'),
        teamLogo:      document.getElementById('team-logo'),
        teamName:      document.getElementById('team-name'),
        teamRecord:    document.getElementById('team-record'),
        confName:      document.getElementById('conference-name'),
        teamRank:      document.getElementById('team-ranking'),
        ppg:           document.getElementById('ppg'),
        ypg:           document.getElementById('ypg'),
        passYpg:       document.getElementById('pass-ypg'),
        rushYpg:       document.getElementById('rush-ypg'),
        defPpg:        document.getElementById('def-ppg'),
        oppThirdDown:  document.getElementById('opp-third-down'),
        oppFourthDown: document.getElementById('opp-fourth-down'),
        oppYpg:        document.getElementById('opp-ypg'),
        oppPassYpg:    document.getElementById('opp-pass-ypg'),
        oppRushYpg:    document.getElementById('opp-rush-ypg'),
        turnoverMargin:document.getElementById('turnover-margin'),
        ourThirdDown:  document.getElementById('red-zone-pct'),
        firstDownsPg:  document.getElementById('first-downs-pg'),
        recentGames:       document.getElementById('recent-games'),
        scheduleList:      document.getElementById('schedule-list'),
        seasonSelect:      document.getElementById('season-select'),
        rosterTab:         document.getElementById('roster-tab'),
        seasonRecords:     document.getElementById('season-records'),
        newsContainer:     document.getElementById('news-container'),
        recordHome:        document.getElementById('record-home'),
        recordAway:        document.getElementById('record-away'),
        recordConf:        document.getElementById('record-conf'),
        standingsContainer:   document.getElementById('standings-container'),
        scoreboardContainer:  document.getElementById('scoreboard-container'),
        statLeaders:          document.getElementById('stat-leaders-container'),
        nextGame:             document.getElementById('next-game-container'),
        rankingsContainer:    document.getElementById('rankings-container'),
        tickerStatic:         document.getElementById('ticker-static'),
        tickerBelt:           document.getElementById('ticker-belt'),
        tickerDivider:        document.getElementById('ticker-divider'),
      };

      // ESPN team IDs of Big Ten members — conference detection + filters
      this.BIG_TEN_IDS = new Set([84, 77, 120, 127, 130, 135, 158, 164, 194, 213, 275, 356, 2294, 2509, 26, 30, 264, 2483]);

      // Venue coordinates (ESPN team ID → lat/lon) for weather lookups
      this.VENUE_COORDS = {
        84:   { lat: 39.184, lon: -86.523, label: 'Memorial Stadium, Bloomington IN' },
        194:  { lat: 39.990, lon: -82.995, label: 'Ohio Stadium, Columbus OH' },
        130:  { lat: 42.266, lon: -83.749, label: 'Michigan Stadium, Ann Arbor MI' },
        213:  { lat: 40.812, lon: -77.856, label: 'Beaver Stadium, State College PA' },
        127:  { lat: 42.728, lon: -84.483, label: 'Spartan Stadium, East Lansing MI' },
        275:  { lat: 43.070, lon: -89.412, label: 'Camp Randall, Madison WI' },
        2294: { lat: 41.659, lon: -91.553, label: 'Kinnick Stadium, Iowa City IA' },
        135:  { lat: 44.976, lon: -93.222, label: 'Huntington Bank Stadium, Minneapolis MN' },
        77:   { lat: 42.062, lon: -87.674, label: 'Ryan Field, Evanston IL' },
        356:  { lat: 40.096, lon: -88.236, label: 'Memorial Stadium, Champaign IL' },
        2509: { lat: 40.445, lon: -86.917, label: 'Ross-Ade Stadium, West Lafayette IN' },
        120:  { lat: 38.889, lon: -76.950, label: 'SECU Stadium, College Park MD' },
        164:  { lat: 40.521, lon: -74.451, label: 'SHI Stadium, Piscataway NJ' },
        158:  { lat: 40.820, lon: -96.705, label: 'Memorial Stadium, Lincoln NE' },
        26:   { lat: 34.161, lon: -118.168, label: 'Rose Bowl, Pasadena CA' },
        30:   { lat: 34.014, lon: -118.288, label: 'LA Memorial Coliseum, Los Angeles CA' },
        264:  { lat: 47.650, lon: -122.302, label: 'Husky Stadium, Seattle WA' },
        2483: { lat: 44.058, lon: -123.069, label: 'Autzen Stadium, Eugene OR' },
      };

      LOG.info('Indiana Football App initialized — Version 5.0 (Hardened)');
      this.init();
    }

    /* ============================================================
       UTILITIES
    ============================================================ */
    rangeYears(max, min) {
      const a = [];
      for (let y = max; y >= min; y--) a.push(y);
      return a;
    }

    lsk(k) { return `iu:${SEC.safeKey(k)}`; }

    getLS(key) {
      try {
        const raw = localStorage.getItem(this.lsk(key));
        if (!raw) return null;
        const { t, ttl, data } = JSON.parse(raw);
        if (Date.now() - t > ttl) { localStorage.removeItem(this.lsk(key)); return null; }
        LOG.cache('Cache hit', key);
        return data;
      } catch { return null; }
    }

    setLS(key, data, ttl) {
      // Game summaries are 200–500KB each — never persist them to localStorage.
      // They already live in the in-memory Map (this.mem) for the session.
      if (key.startsWith('sum:') || key.startsWith('livedc:')) {
        LOG.cache('Skipping localStorage for large key', key);
        return;
      }
      try {
        const serialized = JSON.stringify({ t: Date.now(), ttl, data });
        // Guard: skip anything over 150 KB to avoid quota errors
        if (serialized.length > 150_000) {
          LOG.cache('Skipping localStorage — payload too large', `${Math.round(serialized.length / 1024)} KB`);
          return;
        }
        // Evict stale iu: entries if we're approaching quota
        try {
          localStorage.setItem(this.lsk(key), serialized);
        } catch (quotaErr) {
          LOG.warn('localStorage quota hit — evicting stale entries and retrying');
          this._evictStaleLS();
          try { localStorage.setItem(this.lsk(key), serialized); } catch { /* give up gracefully */ }
        }
        LOG.cache('Cache set', key);
      } catch (e) {
        LOG.warn('localStorage write failed', e.message);
      }
    }

    _evictStaleLS() {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('iu:')) continue;
        try {
          const { t, ttl } = JSON.parse(localStorage.getItem(k));
          if (Date.now() - t > ttl) keysToRemove.push(k);
        } catch { keysToRemove.push(k); }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      LOG.cache(`Evicted ${keysToRemove.length} stale localStorage entries`);
    }

    setText(el, v) { if (el) el.textContent = String(v ?? ''); }
    setStat(el, v) { if (el) el.textContent = v == null ? '--' : String(v); }
    showLoading() { if (this.dom.loading) this.dom.loading.style.display = 'block'; }
    hideLoading() { if (this.dom.loading) this.dom.loading.style.display = 'none'; }

    fmtDateTime(s) {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    fmtDateOnly(s) {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }

    top25(n) {
      const x = Number(n);
      return Number.isFinite(x) && x >= 1 && x <= 25 ? x : null;
    }

    getScore(scoreObj) {
      if (!scoreObj) return null;
      if (typeof scoreObj === 'object' && scoreObj.value !== undefined) {
        const val = Number(scoreObj.value);
        return Number.isFinite(val) ? val : null;
      }
      const val = Number(scoreObj);
      return Number.isFinite(val) ? val : null;
    }

    useLocalData(year) {
      // Only attempt local JSON files for past seasons, not the active one
      return year < this.currentYear;
    }

    /* ============================================================
       NETWORK — hardened fetch with timeout + retry
    ============================================================ */
    async fetchJson(url, { retries = 1, timeout = 12000 } = {}) {
      // Enforce ESPN-only origins — never fetch from arbitrary URLs
      const ALLOWED_ORIGINS = [
        'https://site.api.espn.com',
        'https://site.web.api.espn.com',
        'https://sports.core.api.espn.com',
        'https://cdn.espn.com',
        'https://api.open-meteo.com',
      ];
      let origin;
      try { origin = new URL(url).origin; }
      catch { LOG.error('Blocked malformed URL', url); return null; }
      if (!ALLOWED_ORIGINS.includes(origin)) {
        LOG.error('Blocked fetch to disallowed origin', origin);
        return null;
      }
      // Client-side rate limit: max 120 ESPN API calls per 60-second window
      const now = Date.now();
      this._fetchLog = (this._fetchLog || []).filter(t => now - t < 60000);
      if (this._fetchLog.length >= 120) {
        LOG.warn('Rate limit reached — throttling ESPN fetch', url);
        await new Promise(r => setTimeout(r, 1000));
      }
      this._fetchLog.push(now);

      LOG.net('Fetching', url);
      for (let attempt = 0; attempt <= retries; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeout);
        try {
          const res = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: ctrl.signal,
            credentials: 'omit', // Never send cookies to third-party API
          });
          clearTimeout(timer);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          LOG.api('Api debug response — success', { url, status: res.status });
          return json;
        } catch (e) {
          clearTimeout(timer);
          LOG.warn(`Fetch failed — attempt ${attempt + 1} of ${retries + 1}`, { url, reason: e.message });
          if (attempt === retries) return null;
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        }
      }
      return null;
    }

    async fetchLocal(path) {
      // One 404 means the history folder is not deployed — stop trying for
      // the whole session so the console is not flooded with failed requests.
      // The first request acts as a probe: parallel callers wait for it, so a
      // missing folder produces one 404 instead of one per season.
      if (this._noLocalData) return null;
      if (this._localGate) {
        await this._localGate;
        if (this._noLocalData) return null;
      }
      let release;
      if (!this._localGate) this._localGate = new Promise(r => { release = r; });
      try {
        const res = await fetch(`${this.DATA_BASE}/${path}`, {
          headers: { Accept: 'application/json' },
          credentials: 'omit',
        });
        if (res.status === 404) {
          this._noLocalData = true;
          LOG.info('local history data not present — using API only');
          return null;
        }
        if (!res.ok) return null;
        return await res.json();
      } catch { return null; }
      finally { if (release) release(); }
    }

    /* ============================================================
       LIVE ROSTER / DEPTH CHART — ESPN roster API
    ============================================================ */
    async fetchLiveRoster(year) {
      LOG.load('Fetching live roster from ESPN', year);
      const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}/roster?enable=roster,projection,stats&season=${year}`;
      const data = await this.fetchJson(url);
      if (!data?.athletes) {
        LOG.warn('Live roster fetch returned no athletes');
        return null;
      }

      // ESPN roster returns position groups as arrays of athletes
      // We reshape them into our depth-chart format (position -> [name, ...])
      const groups = {};
      for (const group of (data.athletes || [])) {
        const pos = SEC.esc(group.position || group.name || 'UNKN');
        if (!groups[pos]) groups[pos] = [];
        for (const athlete of (group.items || [])) {
          const name = SEC.esc(
            athlete.displayName || athlete.fullName || athlete.shortName || 'Unknown'
          );
          groups[pos].push(name);
        }
      }

      LOG.api('Live roster loaded — position groups', Object.keys(groups));
      return groups;
    }

    /**
     * Try to build a live depth chart from the ESPN roster endpoint.
     * Falls back to our hardcoded charts if the API fails or returns no data.
     */
    async getLiveOrStaticDepthChart(year) {
      const cacheKey = `livedc:${year}`;
      const cached = this.mem.get(cacheKey) || this.getLS(cacheKey);
      if (cached) {
        LOG.cache('Using cached live depth chart', year);
        return cached;
      }

      const live = await this.fetchLiveRoster(year);
      if (live && Object.keys(live).length > 0) {
        this.mem.set(cacheKey, live);
        this.setLS(cacheKey, live, 6 * 60 * 60 * 1000); // 6 h
        return live;
      }

      LOG.warn('Live depth chart unavailable — using static fallback', year);
      return null; // caller will fall back to hardcoded
    }

    /* ============================================================
       HARDCODED DEPTH CHARTS (fallback)
    ============================================================ */
    dc2026() {
      // Source: IU Reactionary @ Hoosier Huddle depth chart, as of 2/10/2026
      return {
        offense: {
          'WR':    ['Nick Marsh', 'Davion Chandler', 'Kortez Rupert'],
          'Slot':  ['Tyler Morris', 'LeBron Bond', 'Lavar Keys'],
          'WR2':   ['Charlie Becker', 'Shazz Preston', 'Myles Kendrick'],
          'LT':    ['Carter Smith', 'Benjamin Novak'],
          'LG':    ['Drew Evans', 'Austin Leibfried'],
          'C':     ['Bray Lynch', 'Matt Marek'],
          'RG':    ['Joe Brunner', 'Evan Parker'],
          'RT':    ['Adedamola Ajani', 'Baylor Wilkin', 'Sam Simpson'],
          'TE':    ['Brock Schott', 'Andrew Barker', 'Blake Thiry', 'Parker Elmore'],
          'QB':    ['Josh Hoover', 'Grant Wilson', 'Tyler Cherry', 'Jacob Bell'],
          'HB':    ['Lee Beebe', 'Turbo Richard', 'Khobie Martin', 'Sean Cuono'],
        },
        defense: {
          'CB1':   ['Jamari Sharpe', 'Carson Williams', 'Jaylen Bell'],
          'CB2':   ['Ryland Gandy', 'AJ Harris', 'Zacharey Smith'],
          'STUD':  ['Tobi Osunsanmi', 'Daniel Ndukwe', 'Quentin Clark', 'Triston Abram'],
          'SDE':   ['Chiddi Obiazor', 'Joshua Burnham', 'Tyrone Burrus'],
          'DT':    ['Mario Landino', 'Joe Hjelle', 'Kyler Garcia'],
          'NT':    ['Tyrique Tucker', 'Jhrevious Hall', 'Cameron McHaney'],
          'MLB':   ['Isaiah Jones', 'Kaiden Turner', 'Henry Ohlinger'],
          'WILL':  ['Rolijah Hardy', 'PJ Nelson', 'Amari Kamara'],
          'S1':    ['Preston Zachman', 'Seaonta Stewart'],
          'S2':    ['Amare Ferrell', 'Garrett Reese'],
          'Rover': ['Byron Baldwin', 'Quan Sanks'],
        },
        specialists: {
          'K':   ['Nicolas Radicic', 'Josh Placzek'],
          'P':   ['Billy Gowers'],
          'LS':  ['Drew Clausen', 'Sam Lindsey'],
          'KOS': ['Paddy McAteer', 'Quinn Warren'],
        },
      };
    }


    dc2025() {
      return {
        offense: {
          'X-WR':  ['Elijah Sarratt', 'EJ Williams Jr', 'Davion Chandler'],
          'SL-WR': ['Tyler Morris', 'Jonathan Brady', 'LeBron Bond', 'Myles Kendrick'],
          'Z-WR':  ['Omar Cooper Jr', 'Makai Jackson', 'Charlie Becker'],
          'LT':    ['Carter Smith', 'Evan Lawrence', 'Matt Marek'],
          'LG':    ['Drew Evans', 'Kahlil Benson', 'Baylor Wilkin'],
          'C':     ['Pat Coogan', 'Jack Greer', 'Mitch Verstegen'],
          'RG':    ['Bray Lynch', 'Adedamola Ajani', 'Austin Leibfried'],
          'RT':    ['Zen Michalski', 'Austin Barrett', 'Max Williams'],
          'TE':    ['Holden Staes', 'Riley Nowakowski', 'James Bomba', 'Andrew Barker'],
          'QB':    ['Fernando Mendoza', 'Alberto Mendoza', 'Grant Wilson', 'Jacob Bell', 'Tyler Cherry'],
          'HB':    ['Kaelon Black', 'Roman Hemby', 'Lee Beebe', 'Khobie Martin', 'Sean Cuono', 'Solomon Vanhorse'],
        },
        defense: {
          'CB1':   ["D'Angelo Ponds", 'Amariyun Knighten', 'Dontrae Henderson'],
          'CB2':   ['Jamari Sharpe', 'Ryland Gandy', 'Jaylen Bell'],
          'STUD':  ['Mikail Kamara', 'Kellan Wyatt', 'Daniel Ndukwe', 'Triston Abram', 'Andrew Turvy'],
          'DT1':   ['Hosea Wheeler', 'Dominique Ratcliff', 'Kyler Garcia'],
          'DT2':   ['Tyrique Tucker', "J'Mari Monette", 'Jhrevious Hall'],
          'DE':    ['Stephen Daley', 'Mario Landino', 'Andrew Depaepe', 'Tyrone Burrus Jr'],
          'LB1':   ['Rolijah Hardy', 'Isaiah Jones', 'Jeff Utzinger', 'Paul Nelson', 'Amari Kamara'],
          'LB2':   ['Aiden Fisher', 'Kaiden Turner', 'Quentin Clark', 'Jamari Farmer'],
          'FS':    ['Louis Moore', 'Bryson Bonds', 'Seaonta Stewart'],
          'SS':    ['Amare Ferrell', 'Byron Baldwin'],
          'Rover': ['Devan Boykin', 'Jah Jah Boyd', 'Zacharey Smith', 'Garrett Reese'],
        },
        specialists: {
          'PK':  ['Nicolas Radicic', 'Brendan Franke'],
          'KO':  ['Brendan Franke', 'Alejandro Quintero'],
          'LS':  ['Mark Langston', 'Sam Lindsey'],
          'PT':  ['Mitch McCarthy', 'Alejandro Quintero'],
          'KR':  ['Solomon Vanhorse', 'EJ Williams Jr'],
          'PR':  ['Tyler Morris', 'Solomon Vanhorse'],
        },
      };
    }

    dc2024() {
      return {
        offense: {
          'X-WR':  ['Elijah Sarratt', 'EJ Williams Jr', 'Davion Chandler'],
          'SL-WR': ['Tyler Morris', 'Jonathan Brady', 'LeBron Bond', 'Myles Kendrick'],
          'Z-WR':  ['Omar Cooper Jr', 'Makai Jackson', 'Charlie Becker'],
          'LT':    ['Carter Smith', 'Evan Lawrence', 'Matt Marek'],
          'LG':    ['Drew Evans', 'Kahlil Benson', 'Baylor Wilkin'],
          'C':     ['Zach Carpenter', 'Jack Greer', 'Mitch Verstegen'],
          'RG':    ['Bray Lynch', 'Adedamola Ajani', 'Austin Leibfried'],
          'RT':    ['Zen Michalski', 'Austin Barrett', 'Max Williams'],
          'TE':    ['James Bomba', 'Riley Nowakowski', 'Andrew Barker'],
          'QB':    ['Brendan Sorsby', 'Tayven Jackson', 'Grant Wilson'],
          'HB':    ['Trent Howland', 'Josh Henderson', 'Jaylin Lucas'],
        },
        defense: {
          'CB1':   ['Jamari Sharpe', 'Ryland Gandy', 'Jaylen Bell'],
          'CB2':   ['Noah Pierre', 'Amariyun Knighten'],
          'STUD':  ['Myles Jackson', 'Kellan Wyatt'],
          'DT1':   ['Hosea Wheeler', 'Dominique Ratcliff'],
          'DT2':   ['Tyrique Tucker', "J'Mari Monette"],
          'DE':    ['Andre Carter', 'Anthony Jones'],
          'LB1':   ['Aaron Casey', 'Aiden Fisher'],
          'LB2':   ['Kaiden Turner', 'Isaiah Jones'],
          'FS':    ['Louis Moore', 'Bryson Bonds'],
          'SS':    ['Amare Ferrell', 'Josh Sanguinetti'],
          'Rover': ['Devan Boykin', 'Noah Pierre'],
        },
        specialists: {
          'PK':  ['Nicolas Radicic', 'Chris Freeman'],
          'KO':  ['Chris Freeman'],
          'LS':  ['Sean Wracher'],
          'PT':  ['James Evans'],
          'KR':  ['Jaylin Lucas'],
          'PR':  ['Jaylin Lucas'],
        },
      };
    }

    /* ============================================================
       DATA RETRIEVAL — schedule
    ============================================================ */
    /* ============================================================
       STATIC SCHEDULES — 1995-1998, ESPN API has no data pre-1999.
       Verified: Wikipedia season pages, Winsipedia, Sports-Reference.
    ============================================================ */
    _staticSchedule(year) {
      // [month, day, oppEspnId, opponent, home(1)/away(0), iuPts, oppPts]
      const DATA = {
        1995: [ // 2-9 (0-8 Big Ten), Bill Mallory
          [ 9,  9, 2711, 'Western Michigan', 1, 24, 10],
          [ 9, 16,   96, 'Kentucky',         1, 10, 17],
          [ 9, 23, 2572, 'Southern Miss',    1, 27, 26],
          [ 9, 30,   77, 'Northwestern',     0,  7, 31],
          [10,  7,  356, 'Illinois',         1, 10, 17],
          [10, 14, 2294, 'Iowa',             0, 13, 22],
          [10, 21,  130, 'Michigan',         1, 17, 34],
          [10, 28,  213, 'Penn State',       0, 21, 45],
          [11, 11,  127, 'Michigan State',   1, 13, 31],
          [11, 18,  194, 'Ohio State',       0,  3, 42],
          [11, 24, 2509, 'Purdue',           1, 14, 51],
        ],
        1996: [ // 3-8 (1-7 Big Ten), Bill Mallory's final season
          [ 9,  7, 2649, 'Toledo',           0, 40,  6],
          [ 9, 14,  193, 'Miami (OH)',       1, 21, 14],
          [ 9, 21,   96, 'Kentucky',         0,  0,  3],
          [ 9, 28,   77, 'Northwestern',     1, 17, 35],
          [10,  5,  356, 'Illinois',         0, 43, 46],
          [10, 12, 2294, 'Iowa',             1, 10, 31],
          [10, 19,  130, 'Michigan',         0, 20, 27],
          [10, 26,  213, 'Penn State',       1, 26, 48],
          [11,  9,  127, 'Michigan State',   0, 15, 38],
          [11, 16,  194, 'Ohio State',       1, 17, 27],
          [11, 23, 2509, 'Purdue',           0, 33, 16],
        ],
        1997: [ // 2-9 (1-7 Big Ten), Cam Cameron's first season
          [ 9,  6,  153, 'North Carolina',   0,  6, 23],
          [ 9, 13, 2050, 'Ball State',       1, 33,  6],
          [ 9, 20,   96, 'Kentucky',         1,  7, 49],
          [ 9, 27,  275, 'Wisconsin',        0, 26, 27],
          [10,  4,  130, 'Michigan',         1,  0, 37],
          [10, 11,  127, 'Michigan State',   1,  6, 38],
          [10, 18,  194, 'Ohio State',       0,  0, 31],
          [10, 25, 2294, 'Iowa',             0,  0, 62],
          [11,  1,  356, 'Illinois',         1, 23,  6],
          [11, 15,  135, 'Minnesota',        0, 12, 24],
          [11, 22, 2509, 'Purdue',           1,  7, 56],
        ],
        1998: [ // 4-7 (2-6 Big Ten), Cam Cameron
          [ 9, 12, 2711, 'Western Michigan', 1, 45, 30],
          [ 9, 19,   96, 'Kentucky',         0, 27, 31],
          [ 9, 26, 2132, 'Cincinnati',       0, 48, 14],
          [10,  3,  275, 'Wisconsin',        1, 20, 24],
          [10, 10,  127, 'Michigan State',   0, 31, 38],
          [10, 17, 2294, 'Iowa',             1, 14,  7],
          [10, 24,  130, 'Michigan',         0, 10, 21],
          [10, 31,  194, 'Ohio State',       1,  7, 38],
          [11,  7,  356, 'Illinois',         0, 16, 31],
          [11, 14,  135, 'Minnesota',        1, 20, 19],
          [11, 21, 2509, 'Purdue',           0,  7, 52],
        ],
      };
      const games = DATA[year];
      if (!games) return null;

      return games.map(([m, d, oppId, oppName, home, iuPts, oppPts], i) => {
        // Kickoff times unknown for these seasons — 17:00Z keeps the calendar
        // date stable in US timezones; timeValid:false hides the fake time
        const date = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T17:00Z`;
        const id   = `st${year}${i}`;
        return {
          id, date, timeValid: false,
          competitions: [{
            id, date, timeValid: false,
            status: { type: { completed: true, name: 'STATUS_FINAL', state: 'post' } },
            competitors: [
              { homeAway: home ? 'home' : 'away', winner: iuPts > oppPts,
                score: { value: iuPts, displayValue: String(iuPts) },
                team: { id: '84', displayName: 'Indiana Hoosiers', abbreviation: 'IND' } },
              { homeAway: home ? 'away' : 'home', winner: oppPts > iuPts,
                score: { value: oppPts, displayValue: String(oppPts) },
                team: { id: String(oppId), displayName: oppName } },
            ],
          }],
        };
      });
    }

    async getSeasonSchedule(year) {
      year = SEC.safeYear(year) || this.currentYear;
      LOG.load(`Getting schedule for season ${year}`);
      const key = `sched:${year}`;

      // Pre-1999 seasons: static data, checked before cache so stale empty
      // localStorage entries from failed API fetches never win
      const staticEvents = this._staticSchedule(year);
      if (staticEvents) {
        LOG.load(`Using static schedule for ${year}`);
        this.mem.set(key, staticEvents);
        return staticEvents;
      }

      const cached = this.mem.get(key) || this.getLS(key);
      if (cached) {
        LOG.cache(`Using cached schedule for ${year}`);
        return cached;
      }

      let events = [];
      if (this.useLocalData(year)) {
        LOG.load(`Trying local data for ${year}`);
        const local = await this.fetchLocal(`${year}/schedule.json`);
        events = this.pickEventsArray(local);
        if (!events || events.length === 0) {
          LOG.warn(`Local data empty — falling back to API for ${year}`);
          const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}/schedule?season=${year}`;
          const json = await this.fetchJson(url);
          events = this.pickEventsArray(json);
        }
      } else {
        LOG.load(`Using ESPN API for ${year}`);
        const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}/schedule?season=${year}`;
        const json = await this.fetchJson(url);
        LOG.api('Api debug response — schedule', { year, eventCount: json ? 'received' : 'null' });
        events = this.pickEventsArray(json);
      }

      events = Array.isArray(events) ? events : [];
      LOG.load(`Schedule loaded — ${events.length} events for ${year}`);
      this.mem.set(key, events);
      // Finished seasons never change — cache them much longer
      const ttl = year < this.currentYear ? 180 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
      this.setLS(key, events, ttl);
      return events;
    }

    pickEventsArray(json) {
      if (!json) return [];
      if (Array.isArray(json.events)) return json.events;
      if (Array.isArray(json?.team?.events)) return json.team.events;
      if (Array.isArray(json?.season?.events)) return json.season.events;
      return [];
    }

    async getSummary(year, eventId) {
      const safeId = SEC.safeKey(eventId);
      if (safeId.startsWith('st')) return null; // static pre-1999 events have no summaries
      const key = `sum:${year}:${safeId}`;
      const cached = this.mem.get(key) || this.getLS(key);
      if (cached) {
        LOG.cache(`Using cached summary — event ${safeId}`);
        return cached;
      }

      LOG.load(`Fetching game summary — event ${safeId} (${year})`);
      let data = null;
      if (this.useLocalData(year)) {
        data = await this.fetchLocal(`${year}/game_${safeId}/summary.json`);
        if (!data) {
          const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/summary?event=${safeId}`;
          data = await this.fetchJson(url);
        }
      } else {
        const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/summary?event=${safeId}`;
        data = await this.fetchJson(url);
        LOG.api('Api debug response — game summary', { eventId: safeId, ok: data != null });
      }

      if (data) {
        this.mem.set(key, data);
        this.setLS(key, data, 6 * 60 * 60 * 1000);
      }
      return data;
    }

    /* ============================================================
       TEAM NEWS — fetched live from ESPN
    ============================================================ */
    async loadNews() {
      const container = this.dom.newsContainer;
      if (!container) return;
      container.innerHTML = '<p style="color:#666;">Loading news...</p>';

      const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/news?team=${this.TEAM_ID}&limit=6`;
      const data = await this.fetchJson(url);
      LOG.api('Api debug response — news', { ok: data != null, count: data?.articles?.length });

      // Static fallback stories — shown when ESPN returns fewer than 6
      const FALLBACK_STORIES = [
        {
          headline: 'Curt Cignetti Entering 2026 Campaign',
          description: 'Head coach Curt Cignetti enters 2026 as defending national champion, looking to sustain Indiana\'s historic run with a revamped roster.',
          link: 'https://iuhoosiers.com/sports/football',
          date: '',
        },
        {
          headline: 'Fernando Mendoza Returns as Starter',
          description: 'QB Fernando Mendoza is back for his senior season after a standout 2025 campaign leading the Hoosiers offense.',
          link: 'https://iuhoosiers.com/sports/football',
          date: '',
        },
        {
          headline: '2025 Hoosiers: National Champions',
          description: 'Indiana went 16-0 in the 2025 season, winning the CFP National Championship over Miami on January 19, 2026 — the first 16-0 season in major college football since 1894.',
          link: 'https://iuhoosiers.com/sports/football',
          date: '',
        },
        {
          headline: 'Memorial Stadium Upgrades Underway',
          description: 'IU Athletics continues facility improvements at Memorial Stadium ahead of the 2026 Big Ten season.',
          link: 'https://iuhoosiers.com/sports/football',
          date: '',
        },
        {
          headline: 'Recruiting Class 2026 Taking Shape',
          description: 'The Hoosiers have secured commitments at key positions as the 2026 recruiting cycle heats up.',
          link: 'https://iuhoosiers.com/sports/football',
          date: '',
        },
        {
          headline: 'Big Ten Expansion: What It Means for IU',
          description: 'Indiana navigates a new conference landscape with 18 Big Ten members, bringing marquee matchups to Bloomington.',
          link: 'https://iuhoosiers.com/sports/football',
          date: '',
        },
      ];

      const liveArticles = Array.isArray(data?.articles) ? data.articles : [];
      const combined = [...liveArticles];
      // Pad with static stories until we have 6
      for (const fb of FALLBACK_STORIES) {
        if (combined.length >= 6) break;
        combined.push({ headline: fb.headline, description: fb.description, links: { web: { href: fb.link } }, published: fb.date, _static: true });
      }

      container.innerHTML = '';
      for (const a of combined.slice(0, 6)) {
        const title = SEC.esc(a.headline || a.title || 'No headline');
        const desc  = SEC.esc(a.description || '');
        const rawLink = a.links?.web?.href || '';
        const link  = SEC.safeUrl(rawLink, ['https://']) ? SEC.esc(rawLink) : '#';
        const date  = (!a._static && a.published) ? this.fmtDateTime(a.published) : '';
        const el = document.createElement('div');
        el.className = 'news-item';
        el.innerHTML = `
          <div class="news-title"><a href="${link}" target="_blank" rel="noopener noreferrer">${title}</a></div>
          ${desc ? `<div class="news-desc">${desc}</div>` : ''}
          ${date ? `<div class="news-date">${date}</div>` : ''}`;
        container.appendChild(el);
      }
    }

    /* ============================================================
       GAME LEADERS EXTRACTION
    ============================================================ */
    extractGameLeaders(summary, teamId) {
      try {
        const cats = summary?.leaders?.leaders;
        if (!Array.isArray(cats)) return null;
        const find = (needle) => cats.find(c => (c.name || c.displayName || '').toLowerCase().includes(needle));
        const pack = (cat) => {
          if (!cat || !Array.isArray(cat.leaders)) return null;
          const mine = cat.leaders.find(l => String(l.team?.id) === String(teamId)) || cat.leaders[0];
          if (!mine?.athlete) return null;
          return {
            name: SEC.esc(mine.athlete.displayName || mine.athlete.shortName || '—'),
            stat: SEC.esc(String(mine.displayValue || mine.value || '')),
          };
        };
        return {
          passing:   pack(find('pass')),
          rushing:   pack(find('rush')),
          receiving: pack(find('receiv')),
        };
      } catch (e) {
        LOG.warn('Failed to extract game leaders', e.message);
        return null;
      }
    }

    /* ============================================================
       TEAM INFO
    ============================================================ */
    async loadTeamInfo() {
      LOG.load('Loading team info');
      this.setText(this.dom.confName, 'Big Ten');

      try {
        const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}?enable=record,rankings,logos,conference`;
        const resp = await this.fetchJson(url);
        LOG.api('Api debug response — team info', { ok: resp != null });
        const team = resp?.team;

        if (team) {
          const rawLogo = team.logos?.[0]?.href;
          const logo = SEC.safeImgSrc(rawLogo, 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png');
          this.dom.teamLogo.src = logo;
          this.setText(this.dom.teamName, SEC.esc(team.displayName || 'Indiana Hoosiers'));

          let overall = 'TBD';
          const items = team.record?.items;
          if (Array.isArray(items) && items.length) {
            const total = items.find(i => i.type === 'total') || items[0];
            if (total?.summary) overall = SEC.esc(total.summary);
          }
          this.setText(this.dom.teamRecord, overall);

          let rankOut = 'Unranked';
          if (typeof team.rank === 'number') {
            const top = this.top25(team.rank);
            rankOut = top ? `#${top}` : 'Unranked';
          } else if (Array.isArray(team.rankings) && team.rankings.length) {
            const ap = team.rankings.find(r => (r.type || '').toLowerCase().includes('ap'));
            const any = ap || team.rankings[0];
            const top = this.top25(any?.rank);
            rankOut = top ? `#${top}` : 'Unranked';
          }
          this.setText(this.dom.teamRank, rankOut);
          LOG.load('Team info loaded successfully');
          return;
        }
      } catch (e) {
        LOG.warn('Team API failed — computing from games', e.message);
      }

      const events = await this.getSeasonSchedule(this.currentYear);
      const rec = await this.computeSeasonRecordFromEvents(this.currentYear, events);
      const overall = (rec.w + rec.l + rec.t) > 0
        ? `${rec.w}-${rec.l}${rec.t ? `-${rec.t}` : ''}`
        : 'TBD';
      this.dom.teamLogo.src = 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png';
      this.setText(this.dom.teamName, 'Indiana Hoosiers');
      this.setText(this.dom.teamRecord, overall);
      this.setText(this.dom.teamRank, 'Unranked');
    }

    /* ============================================================
       NEXT GAME
    ============================================================ */
    async loadNextGame() {
      const c = this.dom.nextGame;
      if (!c) return;
      c.innerHTML = '<div class="stat-row" style="color:#999;font-style:italic"><span>Loading…</span><span></span></div>';

      const now = Date.now();
      const findNext = (events) => {
        const sorted = (events || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        for (const e of sorted) {
          const comp   = e.competitions?.[0];
          const status = comp?.status?.type;
          const gameMs = new Date(e.date).getTime();
          // Game is upcoming if: not completed, or date is in future (status sometimes lags)
          if (status?.completed !== true && (status?.state === 'pre' || gameMs > now - 3 * 60 * 60 * 1000)) {
            return e;
          }
        }
        return null;
      };

      const events = await this.getSeasonSchedule(this.currentYear);
      let next = findNext(events);

      // Off-season: current season is done — look ahead to next season's opener
      if (!next) {
        const nextSeason = await this.getSeasonSchedule(this.currentYear + 1);
        next = findNext(nextSeason);
      }

      // ESPN publishes next season's opener on the scoreboard before the
      // schedule endpoint has it — final fallback
      if (!next) {
        const sb = await this._fetchScoreboard();
        next = findNext(sb.filter(ev =>
          ev.competitions?.[0]?.competitors?.some(x => String(x.team?.id) === String(this.TEAM_ID))
        ));
      }

      if (!next) {
        c.innerHTML = '<div class="stat-row"><span>Season complete</span><span></span></div>';
        return;
      }

      const comp   = next.competitions?.[0];
      const comps  = comp?.competitors || [];
      const mine   = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
      const opp    = comps.find(x => x !== mine);
      const isHome = mine?.homeAway === 'home';
      const oppName= SEC.esc(opp?.team?.displayName || 'TBD');
      const oppTop = this.top25(opp?.curatedRank?.current);
      const rankPfx= oppTop ? `#${oppTop} ` : '';
      const venue  = SEC.esc(comp?.venue?.fullName || (isHome ? 'Memorial Stadium' : 'Away'));
      const tv     = SEC.esc(comp?.broadcasts?.[0]?.names?.[0] || comp?.geoBroadcasts?.[0]?.shortName || '');
      const dateStr= SEC.esc(this.fmtDateTime(next.date));
      const logo   = opp?.team?.logos?.[0]?.href || opp?.team?.logo;
      const safeLogo = logo ? SEC.safeImgSrc(logo, '') : '';

      c.innerHTML = `
        <div class="next-game-matchup">
          ${safeLogo ? `<img src="${safeLogo}" alt="${oppName}" class="next-game-logo" loading="lazy">` : ''}
          <div class="next-game-opp">${isHome ? 'vs' : '@'} ${rankPfx}${oppName}</div>
        </div>
        <div class="stat-row"><span>Date</span><span>${dateStr}</span></div>
        <div class="stat-row"><span>Location</span><span>${venue}</span></div>
        ${tv ? `<div class="stat-row"><span>TV</span><span>${tv}</span></div>` : ''}
        <div id="next-game-weather"></div>`;

      LOG.load('Next game loaded', oppName);

      // Forecast row when kickoff is inside the 16-day forecast window
      try {
        const gameDate = new Date(next.date);
        const daysOut  = Math.ceil((gameDate.getTime() - now) / 86400000);
        if (daysOut >= 0 && daysOut <= 16) {
          const venueId = isHome ? '84' : String(opp?.team?.id || '');
          const coords  = this.VENUE_COORDS[venueId] || this.VENUE_COORDS['84'];
          const wx      = await this._fetchWeather(coords.lat, coords.lon, gameDate.toISOString().split('T')[0]);
          const slot    = document.getElementById('next-game-weather');
          if (wx && slot) {
            const wxStr = `${wx.desc}, ${wx.high}/${wx.low}°F${wx.precip > 20 ? `, ${wx.precip}% rain` : ''}`;
            slot.outerHTML = `<div class="stat-row"><span>Forecast</span><span>${SEC.esc(wxStr)}</span></div>`;
          }
        }
      } catch (e) {
        LOG.warn('next game weather failed', e.message);
      }
    }

    /* ============================================================
       RECORD SPLIT — home / road / conference
    ============================================================ */
    async loadRecordSplit() {
      try {
        const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}/record?season=${this.currentYear}&seasontype=2`;
        const data = await this.fetchJson(url);
        LOG.api('Api debug response — record split', { ok: data != null });
        const items = data?.items;
        if (!Array.isArray(items)) return;

        const fmt = (item) => {
          if (!item) return '—';
          // Try summary string first
          if (item.summary) return SEC.esc(item.summary);
          // Fall back to building from stats array
          const stats = item.stats || [];
          const w = stats.find(s => s.name === 'wins')?.value;
          const l = stats.find(s => s.name === 'losses')?.value;
          if (w != null && l != null) return `${w}-${l}`;
          return '—';
        };

        const home   = items.find(i => (i.type?.name || i.name || '').toLowerCase().includes('home'));
        const road   = items.find(i => {
          const n = (i.type?.name || i.name || '').toLowerCase();
          return n.includes('road') || n.includes('away');
        });
        const conf   = items.find(i => {
          const n = (i.type?.name || i.name || '').toLowerCase();
          return n.includes('conf') || n.includes('vsconf') || n.includes('division');
        });

        this.setStat(this.dom.recordHome, fmt(home));
        this.setStat(this.dom.recordAway, fmt(road));
        this.setStat(this.dom.recordConf, fmt(conf));
        LOG.load('Record split loaded');
      } catch (e) {
        LOG.warn('Record split failed', e.message);
      }
    }

    /* ============================================================
       BIG TEN STANDINGS
    ============================================================ */
    async loadStandings() {
      const c = this.dom.standingsContainer;
      if (!c) return;
      c.innerHTML = '<p style="color:#999;padding:0.5rem;font-size:0.85rem;">Loading standings…</p>';

      try {
        const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/standings?group=80`;
        const data = await this.fetchJson(url);
        LOG.api('Api debug response — standings', { ok: data != null });

        // ESPN standings structure: data.standings[].entries[] — each entry has team + stats
        const entries = [];
        for (const div of (data?.standings || [])) {
          for (const entry of (div?.entries || [])) {
            const team    = entry.team;
            const stats   = entry.stats || [];
            const getStat = (name) => stats.find(s => s.name === name || s.abbreviation === name);

            const confW   = Number(getStat('wins')?.value   ?? getStat('w')?.value   ?? 0);
            const confL   = Number(getStat('losses')?.value ?? getStat('l')?.value   ?? 0);
            const ovW     = Number(getStat('totalWins')?.value    ?? getStat('overallWins')?.value    ?? 0);
            const ovL     = Number(getStat('totalLosses')?.value  ?? getStat('overallLosses')?.value  ?? 0);

            entries.push({
              id:      String(team?.id || ''),
              name:    SEC.esc(team?.shortDisplayName || team?.displayName || 'TBD'),
              logo:    SEC.safeImgSrc(team?.logos?.[0]?.href, ''),
              confW, confL, ovW, ovL,
            });
          }
        }

        if (!entries.length) {
          c.innerHTML = '<p style="color:#999;padding:0.5rem;font-size:0.85rem;">Standings not available — season may not have started.</p>';
          return;
        }

        // Sort by conf wins desc, then conf losses asc
        entries.sort((a, b) => b.confW - a.confW || a.confL - b.confL);

        const headerRow = `<div class="standings-header">
          <span></span><span></span>
          <span>Team</span><span style="text-align:center">Conf</span><span style="text-align:center">Overall</span>
        </div>`;

        const rows = entries.map((e, i) => {
          const isIU  = e.id === String(this.TEAM_ID);
          const logo  = e.logo ? `<img src="${e.logo}" alt="${e.name}" class="standings-logo" loading="lazy">` : '<span></span>';
          return `<div class="standings-row${isIU ? ' standings-iu' : ''}">
            <span class="standings-rank">${i + 1}</span>
            ${logo}
            <span class="standings-team">${e.name}</span>
            <span class="standings-conf">${e.confW}-${e.confL}</span>
            <span class="standings-overall">${e.ovW}-${e.ovL}</span>
          </div>`;
        }).join('');

        c.innerHTML = headerRow + rows;
        LOG.load(`Standings loaded — ${entries.length} teams`);
      } catch (e) {
        LOG.warn('Standings failed', e.message);
        c.innerHTML = '<p style="color:#999;padding:0.5rem;font-size:0.85rem;">Standings unavailable.</p>';
      }
    }

    /* ============================================================
       SHARED SCOREBOARD FETCH (cached 45s, used by ticker + scores tab)
    ============================================================ */
    async _fetchScoreboard() {
      const key    = 'sb:cfb';
      const cached = this.mem.get(key);
      if (cached && (Date.now() - cached.ts) < 45000) return cached.events;
      const url    = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/scoreboard?limit=25`;
      const data   = await this.fetchJson(url);
      const events = Array.isArray(data?.events) ? data.events : [];
      this.mem.set(key, { events, ts: Date.now() });
      return events;
    }

    /* ============================================================
       SCORES TAB
    ============================================================ */
    async loadScoresTab() {
      const c = this.dom.scoreboardContainer;
      if (!c) return;
      try {
        const events = await this._fetchScoreboard();
        LOG.api('Api debug response — scores tab', { count: events.length });
        if (events.length === 0) {
          c.innerHTML = '<div class="no-data"><p>No games currently in progress.</p></div>';
          return;
        }
        const filtered = events.filter(ev => this._scoreMatchesFilter(ev));
        if (filtered.length === 0) {
          c.innerHTML = '<div class="no-data"><p>No games match this filter.</p></div>';
          return;
        }
        c.innerHTML = filtered.map(ev => this._renderScoreCard(ev)).join('');
        LOG.load(`Scores tab loaded — ${filtered.length} of ${events.length} games`);
      } catch (e) {
        LOG.warn('Scores tab failed', e.message);
      }
    }

    _scoreMatchesFilter(ev) {
      const f = this._scoresFilter || 'all';
      if (f === 'all') return true;
      const comp  = ev.competitions?.[0];
      const comps = comp?.competitors || [];
      if (f === 'live')  return (comp?.status?.type?.state || '').toLowerCase() === 'in';
      if (f === 'b10')   return comps.some(t => this.BIG_TEN_IDS.has(parseInt(t.team?.id || '0', 10)) || String(t.team?.conferenceId) === '5');
      if (f === 'top25') return comps.some(t => this.top25(t.curatedRank?.current));
      return true;
    }

    _renderScoreCard(ev) {
      const comp        = ev.competitions?.[0];
      const comps       = comp?.competitors || [];
      const home        = comps.find(x => x.homeAway === 'home');
      const away        = comps.find(x => x.homeAway === 'away');
      const status      = comp?.status;
      const stateDetail = SEC.esc(status?.type?.shortDetail || status?.type?.description || '');
      const isComplete  = status?.type?.completed === true;
      const isLive      = !isComplete && (status?.type?.state || '').toLowerCase() === 'in';
      const net         = SEC.esc(comp?.broadcasts?.[0]?.names?.[0] || comp?.geoBroadcasts?.[0]?.shortName || '');
      const isIUGame    = comps.some(x => String(x.team?.id) === String(this.TEAM_ID));
      const odds        = comp?.odds?.[0];
      const spread      = odds?.details   ? SEC.esc(String(odds.details))          : '';
      const total       = odds?.overUnder > 0 ? `O/U ${SEC.esc(String(odds.overUnder))}` : '';
      const oddsLine    = [spread, total].filter(Boolean).join(' \u2022 ');
      const statusCls   = isLive ? 'live' : isComplete ? 'final' : 'upcoming';

      const teamRow = (t) => {
        if (!t) return '';
        const name   = SEC.esc(t.team?.shortDisplayName || t.team?.displayName || 'TBD');
        const pts    = t.score != null ? SEC.esc(String(t.score)) : '';
        const isIU   = String(t.team?.id) === String(this.TEAM_ID);
        const winner = isComplete && t.winner === true;
        return `<div class="score-team-row">
          <span class="score-team-name${isIU ? ' iu-name' : ''}">${name}</span>
          <span class="score-pts${winner ? ' winner' : ''}">${pts}</span>
        </div>`;
      };

      return `<div class="score-card${isIUGame ? ' iu-game' : ''}">
        <div class="score-card-header">
          <span class="score-network">${net}</span>
          <span class="score-status ${statusCls}">${stateDetail}</span>
        </div>
        <div class="score-teams">${teamRow(away)}${teamRow(home)}</div>
        ${oddsLine ? `<div class="score-odds">${oddsLine}</div>` : ''}
      </div>`;
    }

    /* ============================================================
       GAME TICKER
    ============================================================ */
    initTicker() {
      // Sync ticker top with header height (accounts for responsive wrapping)
      const syncHeight = () => {
        const h = document.querySelector('.header')?.offsetHeight || 68;
        document.documentElement.style.setProperty('--header-h', `${h}px`);
      };
      syncHeight();
      window.addEventListener('resize', syncHeight);

      // On/off toggle — persisted across visits
      let pref = '1';
      try { pref = localStorage.getItem('iufb:ticker') || '1'; } catch {}
      this._tickerOn = pref !== '0';
      const btn = document.getElementById('ticker-toggle');
      const applyToggle = () => {
        document.body.classList.toggle('ticker-off', !this._tickerOn);
        if (btn) {
          btn.textContent = `Ticker: ${this._tickerOn ? 'On' : 'Off'}`;
          btn.setAttribute('aria-pressed', String(this._tickerOn));
          btn.classList.toggle('off', !this._tickerOn);
        }
      };
      if (btn) btn.addEventListener('click', () => {
        this._tickerOn = !this._tickerOn;
        try { localStorage.setItem('iufb:ticker', this._tickerOn ? '1' : '0'); } catch {}
        LOG.info(`ticker ${this._tickerOn ? 'on' : 'off'}`);
        applyToggle();
        if (this._tickerOn) this.updateTicker();
      });
      applyToggle();

      this.updateTicker();
      this._tickerInterval = setInterval(() => this.updateTicker(), 30000);
    }

    async updateTicker() {
      const belt     = this.dom.tickerBelt;
      const staticEl = this.dom.tickerStatic;
      const divider  = this.dom.tickerDivider;
      if (!belt || !this._tickerOn) return;

      try {
        const events = await this._fetchScoreboard();
        const iuEv   = events.find(ev =>
          ev.competitions?.[0]?.competitors?.some(c => String(c.team?.id) === String(this.TEAM_ID))
        );

        if (iuEv) {
          // IU game active — static panel (desktop) + other scores in belt
          this._renderTickerIUStatic(staticEl, divider, iuEv);
          const others = events.filter(ev => ev !== iuEv);
          const beltHtml = others.length
            ? others.map(ev => this._tickerGameItem(ev)).join('<span class="ticker-sep" aria-hidden="true">|</span>')
            : `<span class="ticker-item">IU game in progress &mdash; check the Scores tab</span>`;
          this._setBelt(belt, beltHtml);
          await this._liveRefresh(iuEv);
        } else if (events.length > 0) {
          // Other CFB games, no IU game — clear static panel, roll all scores
          if (staticEl) staticEl.innerHTML = '';
          if (divider)  divider.style.display = 'none';
          this._setBelt(belt, events.map(ev => this._tickerGameItem(ev)).join('<span class="ticker-sep" aria-hidden="true">|</span>'));
        } else {
          // No games — show next IU game info
          if (staticEl) staticEl.innerHTML = '';
          if (divider)  divider.style.display = 'none';
          const nextHtml = await this._buildNextGameBelt();
          this._setBelt(belt, nextHtml);
        }
      } catch (e) {
        LOG.warn('Ticker update failed', e.message);
      }
    }

    /* Game-day auto-refresh: while an IU game is live, keep the visible tab
       fresh on the ticker cadence (at most once per 60s) */
    async _liveRefresh(iuEv) {
      const state = (iuEv.competitions?.[0]?.status?.type?.state || '').toLowerCase();
      if (state !== 'in') return;
      const now = Date.now();
      if (now - (this._lastLiveRefresh || 0) < 60000) return;
      this._lastLiveRefresh = now;

      const active = document.querySelector('.nav-btn.active')?.dataset.tab;
      if (active === 'scores') {
        await this.loadScoresTab();
      } else if (active === 'current') {
        // Bust the schedule cache so the live score reaches Recent Games
        const key = `sched:${this.currentYear}`;
        this.mem.delete(key);
        try { localStorage.removeItem(this.lsk(key)); } catch {}
        await Promise.all([this.loadRecentGames(), this.loadTeamInfo()]);
      }
      LOG.load('live refresh', active);
    }

    _renderTickerIUStatic(el, divider, ev) {
      if (!el) return;
      const comp   = ev.competitions?.[0];
      const iu     = comp?.competitors?.find(c => String(c.team?.id) === String(this.TEAM_ID));
      const opp    = comp?.competitors?.find(c => String(c.team?.id) !== String(this.TEAM_ID));
      if (!iu || !opp) return;

      const status  = comp.status;
      const state   = (status?.type?.state || '').toLowerCase();
      const isLive  = state === 'in';
      const isPre   = state === 'pre';
      const detail  = SEC.esc(status?.type?.shortDetail || '');
      const iuPts   = SEC.esc(String(iu.score  ?? 0));
      const oppPts  = SEC.esc(String(opp.score ?? 0));
      const oppAbbr = SEC.esc(opp.team?.abbreviation || opp.team?.shortDisplayName || 'OPP');

      const situation = comp.situation || {};
      const dd        = SEC.esc(situation.downDistanceText || situation.shortDownDistanceText || '');
      const ballTxt   = situation.possession
        ? (String(situation.possession) === String(this.TEAM_ID) ? 'IU ball' : `${oppAbbr} ball`)
        : '';
      const lastPlay  = SEC.esc((situation.lastPlay?.text || '').slice(0, 80));
      const tv        = SEC.esc(comp.broadcasts?.[0]?.names?.[0] || comp.geoBroadcasts?.[0]?.shortName || '');
      const spread    = SEC.esc(String(comp.odds?.[0]?.details || ''));

      const bits = [
        `<span class="ticker-iu-badge">IU</span>`,
        `<span class="ticker-iu-score">${iuPts}&ndash;${oppPts} ${oppAbbr}</span>`,
        `<span class="ticker-iu-detail">${detail}${isLive ? '<span class="ticker-live-dot" aria-hidden="true"></span>' : ''}</span>`,
      ];
      if (isLive && dd)       bits.push(`<span class="ticker-iu-detail">${dd}${ballTxt ? ` &middot; ${ballTxt}` : ''}</span>`);
      else if (isLive && ballTxt) bits.push(`<span class="ticker-iu-detail">${ballTxt}</span>`);
      if (isLive && lastPlay) bits.push(`<span class="ticker-iu-play">${lastPlay}</span>`);
      if (isPre && tv)        bits.push(`<span class="ticker-iu-detail">TV: ${tv}</span>`);
      if (isPre && spread)    bits.push(`<span class="ticker-iu-detail">${spread}</span>`);
      if (isPre) {
        const kick = new Date(ev.date || comp.date);
        const ms   = kick.getTime() - Date.now();
        if (!isNaN(ms) && ms > 0) {
          const d = Math.floor(ms / 86400000);
          const h = Math.floor((ms % 86400000) / 3600000);
          const m = Math.floor((ms % 3600000) / 60000);
          const countdown = d > 0 ? `in ${d}d ${h}h` : h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
          bits.push(`<span class="ticker-iu-detail">${SEC.esc(countdown)}</span>`);
        }
      }

      el.innerHTML = bits.join('');
      if (divider) divider.style.display = 'block';
    }

    _tickerGameItem(ev) {
      const comp     = ev.competitions?.[0];
      const comps    = comp?.competitors || [];
      const home     = comps.find(c => c.homeAway === 'home');
      const away     = comps.find(c => c.homeAway === 'away');
      const status   = comp?.status;
      const detail   = SEC.esc(status?.type?.shortDetail || '');
      const isLive   = (status?.type?.state || '').toLowerCase() === 'in';
      const isComp   = status?.type?.completed === true;

      const side = (t) => {
        if (!t) return '';
        const abbr  = SEC.esc(t.team?.abbreviation || t.team?.shortDisplayName || '?');
        const pts   = t.score != null ? ` ${SEC.esc(String(t.score))}` : '';
        const win   = isComp && t.winner ? ' class="ticker-score-pts winner"' : ' class="ticker-score-pts"';
        return `<span>${abbr}<span${win}>${pts}</span></span>`;
      };

      return `<span class="ticker-item">${isLive ? '<span class="ticker-live-dot" aria-hidden="true"></span>' : ''}${side(away)}<span class="ticker-sep" aria-hidden="true">&ndash;</span>${side(home)}<span class="ticker-game-status">${detail}</span></span>`;
    }

    _setBelt(belt, html) {
      // Duplicate content for seamless CSS loop (animate -50%)
      belt.innerHTML = html
        + '<span class="ticker-gap" aria-hidden="true">&emsp;&emsp;&emsp;</span>'
        + html;
      // Adjust speed so text moves at ~85px/s regardless of content length
      requestAnimationFrame(() => {
        const halfW = belt.scrollWidth / 2;
        const dur   = Math.max(14, halfW / 85);
        belt.style.animationDuration = `${dur.toFixed(1)}s`;
      });
    }

    async _buildNextGameBelt() {
      try {
        const now      = Date.now();
        const upcoming = (events) => (events || []).find(ev => {
          const d = new Date(ev.date || ev.competitions?.[0]?.date);
          return !isNaN(d.getTime()) && d.getTime() > now;
        });

        let next = upcoming(await this.getSeasonSchedule(this.currentYear));
        if (!next) next = upcoming(await this.getSeasonSchedule(this.currentYear + 1));

        if (!next) return `<span class="ticker-item">Indiana Hoosiers Football &mdash; 2025 CFP National Champions</span>`;

        const comp     = next.competitions?.[0];
        const iu       = comp?.competitors?.find(c => String(c.team?.id) === String(this.TEAM_ID));
        const opp      = comp?.competitors?.find(c => String(c.team?.id) !== String(this.TEAM_ID));
        const isHome   = iu?.homeAway === 'home';
        const oppName  = SEC.esc(opp?.team?.shortDisplayName || opp?.team?.displayName || 'TBD');
        const oppId    = String(opp?.team?.id || '');
        const gameDate = new Date(next.date || comp?.date);
        const dateStr  = gameDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr  = gameDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
        const tv       = SEC.esc(comp?.broadcasts?.[0]?.names?.[0] || comp?.geoBroadcasts?.[0]?.shortName || '');
        const venue    = SEC.esc(comp?.venue?.fullName || (isHome ? 'Memorial Stadium' : `at ${oppName}`));
        const city     = SEC.esc([comp?.venue?.address?.city, comp?.venue?.address?.state].filter(Boolean).join(', '));
        const daysOut  = Math.ceil((gameDate.getTime() - now) / 86400000);
        const countdown = daysOut <= 0 ? 'Today' : daysOut === 1 ? 'Tomorrow' : `${daysOut} days`;

        const parts = [
          `<span class="ticker-item"><span class="ticker-next-label">NEXT</span>&nbsp;IU ${isHome ? 'vs' : 'at'} <strong>${oppName}</strong></span>`,
          `<span class="ticker-item">${SEC.esc(dateStr)} &bull; ${SEC.esc(timeStr)}</span>`,
          venue ? `<span class="ticker-item">${venue}</span>` : null,
          city  ? `<span class="ticker-item">${city}</span>` : null,
          tv    ? `<span class="ticker-item">TV: ${tv}</span>` : null,
          `<span class="ticker-item">${SEC.esc(countdown)}</span>`,
        ].filter(Boolean);

        // Weather for games within 16 days
        if (daysOut >= 0 && daysOut <= 16) {
          const venueId  = isHome ? '84' : oppId;
          const coords   = this.VENUE_COORDS[venueId] || this.VENUE_COORDS['84'];
          const dateISO  = gameDate.toISOString().split('T')[0];
          const wx       = await this._fetchWeather(coords.lat, coords.lon, dateISO);
          if (wx) {
            const wxStr = `${wx.desc} ${wx.high}/${wx.low}\u00b0F, Wind ${wx.wind} mph${wx.precip > 20 ? `, ${wx.precip}% rain` : ''}`;
            parts.push(`<span class="ticker-item">Weather: ${SEC.esc(wxStr)}</span>`);
          }
        }

        return parts.join('<span class="ticker-sep" aria-hidden="true">|</span>');
      } catch (e) {
        LOG.warn('Ticker next game content failed', e.message);
        return `<span class="ticker-item">Indiana Hoosiers Football</span>`;
      }
    }

    async _fetchWeather(lat, lon, dateISO) {
      try {
        const url  = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=16`;
        const data = await this.fetchJson(url);
        const idx  = data?.daily?.time?.indexOf(dateISO);
        if (idx == null || idx < 0) return null;
        return {
          high:   Math.round(data.daily.temperature_2m_max[idx]),
          low:    Math.round(data.daily.temperature_2m_min[idx]),
          precip: data.daily.precipitation_probability_max[idx] || 0,
          wind:   Math.round(data.daily.windspeed_10m_max[idx]),
          desc:   this._wmoDesc(data.daily.weathercode[idx]),
        };
      } catch (e) {
        LOG.warn('Weather fetch failed', e.message);
        return null;
      }
    }

    _wmoDesc(code) {
      if (code == null) return 'Unknown';
      if (code === 0)   return 'Clear';
      if (code <= 3)    return 'Partly Cloudy';
      if (code <= 48)   return 'Foggy';
      if (code <= 55)   return 'Drizzle';
      if (code <= 67)   return 'Rain';
      if (code <= 77)   return 'Snow';
      if (code <= 82)   return 'Rain Showers';
      if (code <= 86)   return 'Snow Showers';
      if (code >= 95)   return 'Thunderstorm';
      return 'Cloudy';
    }

    /* ============================================================
       AP RANKINGS
    ============================================================ */
    async loadRankings() {
      const c = this.dom.rankingsContainer;
      if (!c) return;
      try {
        const url  = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/rankings`;
        const data = await this.fetchJson(url);
        const polls = data?.rankings;
        if (!Array.isArray(polls) || polls.length === 0) {
          c.innerHTML = '<div class="no-data"><p>No rankings available</p></div>';
          return;
        }
        const ap    = polls.find(p => (p.shortName || '').toUpperCase().includes('AP')) || polls[0];
        const ranks = ap?.ranks || [];
        if (ranks.length === 0) {
          c.innerHTML = '<div class="no-data"><p>No rankings available</p></div>';
          return;
        }

        const label   = SEC.esc(ap.headline || ap.name || 'AP Top 25');
        const top15   = ranks.slice(0, 15);
        const iuEntry = ranks.find(r => String(r.team?.id) === String(this.TEAM_ID));

        const rows = top15.map(r => {
          const num  = SEC.esc(String(r.current));
          const name = SEC.esc(r.team?.shortDisplayName || r.team?.displayName || 'TBD');
          const rec  = SEC.esc(r.record?.summary || '');
          const isIU = String(r.team?.id) === String(this.TEAM_ID);
          return `<div class="ap-rank-row${isIU ? ' ap-rank-iu' : ''}">
            <span class="ap-rank-num">${num}</span>
            <span class="ap-rank-name">${name}</span>
            <span class="ap-rank-rec">${rec}</span>
          </div>`;
        }).join('');

        const footer = iuEntry && iuEntry.current > 15
          ? `<div class="ap-rank-footer">IU ranked #${SEC.esc(String(iuEntry.current))}</div>` : '';

        c.innerHTML = `<div class="ap-rank-label">${label}</div>${rows}${footer}`;
        LOG.load(`Rankings loaded — ${ap.name}, ${ranks.length} teams`);
      } catch (e) {
        LOG.warn('Rankings failed', e.message);
      }
    }

    /* ============================================================
       RECORDS
    ============================================================ */
    async computeSeasonRecordFromEvents(year, events) {
      LOG.load(`Computing season record for ${year} — ${events?.length || 0} events`);
      let w = 0, l = 0, t = 0, cw = 0, cl = 0, ct = 0;

      for (const e of (events || [])) {
        // Scores are embedded directly in the schedule event — no summary fetch needed
        const comp   = e.competitions?.[0];
        const comps  = comp?.competitors || [];
        const mine   = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
        const opp    = comps.find(x => x !== mine);
        const my     = this.getScore(mine?.score);
        const th     = this.getScore(opp?.score);
        // Conference detection: ESPN's schedule API inconsistently populates conferenceCompetition.
        // Use multiple fallbacks: API flag → opponent conference ID → known Big Ten member IDs.
        const oppId = parseInt(opp?.team?.id || '0', 10);
        const isConf = !!(comp?.conferenceCompetition)
                    || !!(opp?.team?.conferenceId && opp.team.conferenceId === 5)
                    || (this.BIG_TEN_IDS.has(oppId) && oppId !== 84);
        // Only count completed games (status type 'STATUS_FINAL' or equivalent)
        const status = comp?.status?.type?.completed === true
                    || comp?.status?.type?.name === 'STATUS_FINAL'
                    || (my !== null && th !== null && my + th > 0);
        if (my === null || th === null || !status) continue;
        if (my > th)      { w++; if (isConf) cw++; }
        else if (my < th) { l++; if (isConf) cl++; }
        else              { t++; if (isConf) ct++; }
      }

      LOG.debug('Season record computed', { year, w, l, t, cw, cl, ct });
      return { w, l, t, cw, cl, ct };
    }

    /* ============================================================
       SCHEDULE
    ============================================================ */
    async loadSchedule(year) {
      LOG.load('Load response — loading schedule', year);
      const y = year || this.currentYear;

      // Fetch regular season and postseason in parallel
      const [events, postEvents] = await Promise.all([
        this.getSeasonSchedule(y),
        this._getPostseasonSchedule(y),
      ]);

      await this.renderSchedule(events, y);

      // Postseason section
      const psSection = document.getElementById('postseason-section');
      const psList    = document.getElementById('postseason-list');
      if (psSection && psList) {
        if (postEvents && postEvents.length > 0) {
          psSection.style.display = '';
          await this._renderScheduleInto(psList, postEvents, y);
          this._wireItemsIn(psList);
        } else {
          psSection.style.display = 'none';
          psList.innerHTML = '';
        }
      }

      return events;
    }

    async _getPostseasonSchedule(year) {
      const key = `postsched:${year}`;
      const cached = this.mem.get(key) || this.getLS(key);
      if (cached) return cached;
      const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}/schedule?season=${year}&seasontype=3`;
      const json = await this.fetchJson(url);
      const events = this.pickEventsArray(json);
      // Past seasons never change — cache long, empty results included,
      // so history visits stop refetching 30 years of postseason data
      const ttl = year < this.currentYear ? 180 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
      this.mem.set(key, events);
      this.setLS(key, events, ttl);
      return events;
    }

    async renderSchedule(events, year) {
      const c = this.dom.scheduleList;
      if (!c) return;
      for (const chart of this._winProbCharts.values()) chart.destroy();
      this._winProbCharts.clear();
      c.innerHTML = '';

      if (!events || events.length === 0) {
        const msg = document.createElement('div');
        msg.className = 'schedule-item';
        msg.textContent = 'No games found for this season.';
        c.appendChild(msg);
        return;
      }

      await this._renderScheduleInto(c, events, year);
      this._wireItemsIn(c);
    }

    async _renderScheduleInto(container, events, year) {
      if (!container || !events || events.length === 0) return;
      const sorted = events.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

      for (const e of sorted) {
        const comp  = e.competitions?.[0];
        const comps = comp?.competitors || [];
        const mine  = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
        const opp   = comps.find(x => x !== mine);

        const isHome    = mine?.homeAway === 'home';
        const oppName   = SEC.esc(opp?.team?.displayName || 'TBD');
        const oppTop    = this.top25(opp?.curatedRank?.current);
        const oppRank   = oppTop ? `#${oppTop} ` : '';
        const venue     = SEC.esc(comp?.venue?.fullName || (isHome ? 'Memorial Stadium' : 'Away'));
        const tvSched   = SEC.esc(comp?.broadcasts?.[0]?.names?.[0] || comp?.geoBroadcasts?.[0]?.shortName || '');
        const timeStr   = SEC.esc(e.timeValid === false ? this.fmtDateOnly(e.date) : this.fmtDateTime(e.date));
        const rawLogo   = opp?.team?.logos?.[0]?.href || opp?.team?.logo;
        const oppLogo   = rawLogo ? SEC.safeImgSrc(rawLogo, '') : '';

        const { statusClass, statusText } = await this.resolveStatusAndScore(year, e, comp, mine, opp);

        const item = document.createElement('div');
        item.className = 'schedule-item';
        item.setAttribute('data-event-id', SEC.safeKey(e.id || ''));
        item.setAttribute('data-year', String(parseInt(year, 10)));

        item.innerHTML = `
          <div class="game-details">
            <div class="opponent">${oppLogo ? `<img src="${oppLogo}" alt="" class="schedule-opp-logo" loading="lazy">` : ''}${isHome ? 'vs' : '@'} ${oppRank}${oppName}</div>
            <div class="game-time">${timeStr}${tvSched ? ` &bull; TV: ${tvSched}` : ''}</div>
            <div class="game-location">${venue}</div>
          </div>
          <div class="game-status ${statusClass}">${SEC.esc(statusText)}</div>
          <div class="game-extra" style="display:none;"></div>`;
        container.appendChild(item);
      }
    }

    wireScheduleItemDetails() { this._wireItemsIn(this.dom.scheduleList); }

    _wireItemsIn(container) {
      if (!container) return;
      container.querySelectorAll('.schedule-item').forEach((item) => {
        // Avoid double-wiring
        if (item.dataset.wired) return;
        item.dataset.wired = '1';
        item.addEventListener('click', async () => {
          const eid  = item.getAttribute('data-event-id');
          const year = parseInt(item.getAttribute('data-year'), 10);
          const extra = item.querySelector('.game-extra');
          if (!eid || !extra) return;

          if (extra.style.display === 'block') {
            const oldChart = this._winProbCharts.get(eid);
            if (oldChart) { oldChart.destroy(); this._winProbCharts.delete(eid); }
            extra.style.display = 'none';
            extra.innerHTML = '';
            return;
          }

          extra.style.display = 'block';
          extra.innerHTML = `<div class="game-detail-loading"><div class="spinner" style="border-top-color:#990000;border-color:rgba(153,0,0,0.2);"></div> Loading game details…</div>`;
          await this._populateGameExtra(extra, eid, year);
        });
      });
    }

    async resolveStatusAndScore(year, e, comp, mine, opp) {
      const sum    = await this.getSummary(year, e.id);
      const hcomp  = sum?.header?.competitions?.[0];
      const hcomps = hcomp?.competitors || [];
      const hmine  = hcomps?.find(x => String(x.team?.id) === String(this.TEAM_ID));
      const hopp   = hcomps?.find(x => x !== hmine);

      const my = this.getScore(hmine?.score);
      const th = this.getScore(hopp?.score);

      if (my !== null && th !== null && my >= 0 && th >= 0) {
        const wl = my > th ? 'W' : (my < th ? 'L' : 'T');
        return { statusClass: 'status-final', statusText: `${wl} ${my}-${th}` };
      }

      // No summary — fall back to scores embedded in the schedule event
      // (static pre-1999 seasons carry their scores inline)
      const em   = this.getScore(mine?.score);
      const et   = this.getScore(opp?.score);
      const done = comp?.status?.type?.completed === true || comp?.status?.type?.name === 'STATUS_FINAL';
      if (done && em !== null && et !== null) {
        const wl = em > et ? 'W' : (em < et ? 'L' : 'T');
        return { statusClass: 'status-final', statusText: `${wl} ${em}-${et}` };
      }
      return { statusClass: 'status-upcoming', statusText: 'TBD' };
    }

    async _populateGameExtra(extra, eid, year) {
          const sum    = await this.getSummary(year, eid);
          const rows   = [];

          const hcomp  = sum?.header?.competitions?.[0];
          const hcomps = hcomp?.competitors || [];
          const hmine  = hcomps?.find(x => String(x.team?.id) === String(this.TEAM_ID));
          const hopp   = hcomps?.find(x => x !== hmine);

          const myScore  = this.getScore(hmine?.score);
          const oppScore = this.getScore(hopp?.score);
          const oppName  = SEC.esc(hopp?.team?.displayName || 'Opponent');
          const oppAbbr  = SEC.esc(hopp?.team?.abbreviation || 'OPP');

          // ── Final score ──────────────────────────────────────────────
          if (myScore !== null && oppScore !== null) {
            const wl = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T';
            rows.push(`
              <div class="final-score-box">
                <div class="score-display">
                  <span class="team-name">Indiana</span>
                  <span class="score ${wl === 'W' ? 'score-win' : wl === 'L' ? 'score-loss' : ''}">${myScore}</span>
                </div>
                <div class="score-divider">–</div>
                <div class="score-display">
                  <span class="team-name">${oppName}</span>
                  <span class="score">${oppScore}</span>
                </div>
              </div>`);
          }

          // ── Game Info bar ────────────────────────────────────────────
          try {
            const bs  = hcomp?.broadcasts || [];
            const net = bs[0]?.names?.[0];
            const v   = sum?.gameInfo?.venue?.fullName || hcomp?.venue?.fullName;
            const a   = sum?.gameInfo?.attendance;
            const infoParts = [];
            if (net) infoParts.push(`<span><strong>TV:</strong> ${SEC.esc(net)}</span>`);
            if (v)   infoParts.push(`<span><strong>Venue:</strong> ${SEC.esc(v)}</span>`);
            if (a)   infoParts.push(`<span><strong>Att:</strong> ${Number(a).toLocaleString()}</span>`);
            if (infoParts.length) rows.push(`<div class="game-info-bar">${infoParts.join('<span class="info-sep">·</span>')}</div>`);
          } catch {}

          // ── Betting Odds ──────────────────────────────────────────────
          try {
            const picks = sum?.pickcenter;
            if (Array.isArray(picks) && picks.length) {
              const pick = picks.find(p => (p.provider?.name || '').toLowerCase().includes('consensus'))
                        || picks.find(p => (p.provider?.name || '').toLowerCase().includes('draftkings'))
                        || picks[0];
              if (pick) {
                const iuIsHome = hmine?.homeAway === 'home';
                const provider = SEC.esc(pick.provider?.name || 'Lines');
                LOG.debug('pickcenter pick', { provider: pick.provider?.name, details: pick.details, ou: pick.overUnder, iuIsHome });

                // pick.details is the home team's line (e.g. "-7.5" = home favored by 7.5).
                // Flip sign for IU if IU is the away team.
                let iuSpreadStr = null, iuFav = false;
                const detailsNum = parseFloat(String(pick.details || ''));
                if (!isNaN(detailsNum)) {
                  const iuSpread = iuIsHome ? detailsNum : -detailsNum;
                  iuFav = iuSpread < 0;
                  iuSpreadStr = iuSpread > 0 ? `+${iuSpread}` : String(iuSpread);
                }

                const homeOdds = pick.homeTeamOdds;
                const awayOdds = pick.awayTeamOdds;
                const iuOddsObj  = iuIsHome ? homeOdds : awayOdds;
                const oppOddsObj = iuIsHome ? awayOdds : homeOdds;
                // moneyLine can also live directly on pick for some providers
                const rawIuML  = iuOddsObj?.moneyLine  ?? (iuIsHome  ? pick.homeTeamOdds?.moneyLine  : pick.awayTeamOdds?.moneyLine);
                const rawOppML = oppOddsObj?.moneyLine ?? (iuIsHome  ? pick.awayTeamOdds?.moneyLine : pick.homeTeamOdds?.moneyLine);
                const iuML     = rawIuML  != null && isFinite(Number(rawIuML))  ? Number(rawIuML)  : null;
                const oppML    = rawOppML != null && isFinite(Number(rawOppML)) ? Number(rawOppML) : null;
                const ou       = pick.overUnder != null && isFinite(Number(pick.overUnder)) ? Number(pick.overUnder) : null;

                const oddsItems = [];
                if (iuSpreadStr) oddsItems.push(`
                  <div class="odds-item">
                    <div class="odds-label">IU Spread</div>
                    <div class="odds-value ${iuFav ? 'odds-fav' : 'odds-dog'}">${iuSpreadStr}</div>
                  </div>`);
                if (ou !== null) oddsItems.push(`
                  <div class="odds-item">
                    <div class="odds-label">Over / Under</div>
                    <div class="odds-value">${ou}</div>
                  </div>`);
                if (iuML !== null) oddsItems.push(`
                  <div class="odds-item">
                    <div class="odds-label">IU Moneyline</div>
                    <div class="odds-value ${iuFav ? 'odds-fav' : 'odds-dog'}">${iuML > 0 ? '+' : ''}${iuML}</div>
                  </div>`);
                if (oppML !== null) oddsItems.push(`
                  <div class="odds-item">
                    <div class="odds-label">${oppAbbr} Moneyline</div>
                    <div class="odds-value">${oppML > 0 ? '+' : ''}${oppML}</div>
                  </div>`);

                if (oddsItems.length) {
                  rows.push(`<div class="section-header">BETTING LINES — ${provider}</div>`);
                  rows.push(`<div class="odds-grid">${oddsItems.join('')}</div>`);
                } else {
                  LOG.debug('no data from "pickcenter" — fields empty after parse');
                }
              }
            } else {
              LOG.debug('no data from "pickcenter"');
            }
          } catch (e) {
            LOG.warn('no data from "pickcenter"', e.message);
          }

          // ── Player Stats ─────────────────────────────────────────────
          // ESPN summary.boxscore.players is an array of team entries,
          // each with statistics[] → categories (Passing, Rushing, Receiving, etc.)
          // each category has athletes[] with stats[]
          try {
            const bPlayers = sum?.boxscore?.players;
            if (Array.isArray(bPlayers) && bPlayers.length >= 1) {
              // Find IU's entry
              const iuEntry = bPlayers.find(t => String(t.team?.id) === String(this.TEAM_ID));
              if (iuEntry?.statistics?.length) {
                rows.push(`<div class="section-header">PLAYER STATISTICS — INDIANA</div>`);

                for (const cat of iuEntry.statistics) {
                  const catName = SEC.esc(cat.name || cat.displayName || '');
                  const athletes = cat.athletes || [];
                  if (!athletes.length) continue;

                  // Headers come from cat.labels or cat.keys
                  const labels = (cat.labels || cat.keys || []).map(l => SEC.esc(String(l)));

                  rows.push(`<div class="player-stat-section">`);
                  rows.push(`<div class="player-stat-cat">${catName}</div>`);
                  rows.push(`<table class="player-stat-table">`);
                  rows.push(`<thead><tr><th class="pst-name">Player</th>${labels.map(l => `<th>${l}</th>`).join('')}</tr></thead>`);
                  rows.push(`<tbody>`);

                  // Sort passers by yards (first numeric stat), show top entries
                  const sorted = [...athletes].sort((a, b) => {
                    const aVal = parseFloat(a.stats?.[0]) || 0;
                    const bVal = parseFloat(b.stats?.[0]) || 0;
                    return bVal - aVal;
                  });

                  for (const ath of sorted.slice(0, 8)) {
                    const name    = SEC.esc(ath.athlete?.shortName || ath.athlete?.displayName || '?');
                    const athId   = ath.athlete?.id ? String(parseInt(ath.athlete.id, 10)) : null;
                    const espnUrl = athId ? SEC.safePlayerUrl(`https://www.espn.com/college-football/player/_/id/${athId}`) : null;
                    const nameEl  = espnUrl
                      ? `<a href="${espnUrl}" target="_blank" rel="noopener noreferrer" class="player-espn-link">${name}</a>`
                      : name;
                    const stats = (ath.stats || []).map(s => `<td>${SEC.esc(String(s ?? '—'))}</td>`).join('');
                    rows.push(`<tr><td class="pst-name"><strong>${nameEl}</strong></td>${stats}</tr>`);
                  }

                  rows.push(`</tbody></table></div>`);
                }
              }
            }
          } catch (e) {
            LOG.warn('Player stats extraction failed', e.message);
          }

          // ── Team Stats comparison ────────────────────────────────────
          try {
            const teams = sum?.boxscore?.teams;
            if (Array.isArray(teams) && teams.length === 2) {
              const idxMine = teams.findIndex(t => String(t.team?.id) === String(this.TEAM_ID));
              const idxOpp  = idxMine === 0 ? 1 : 0;
              const me      = teams[idxMine];
              const oppTeam = teams[idxOpp];

              const getStat = (obj, name) => {
                if (!obj?.statistics) return null;
                const stat = obj.statistics.find(s => (s.name || '').toLowerCase() === name.toLowerCase());
                return stat ? SEC.esc(String(stat.displayValue ?? stat.value ?? '')) : null;
              };

              const statsList = [
                { label: '1st Downs',      key: 'firstDowns' },
                { label: 'Total Yards',    key: 'totalYards' },
                { label: 'Passing',        key: 'netPassingYards' },
                { label: 'Comp-Att',       key: 'completionAttempts' },
                { label: 'Yards/Pass',     key: 'yardsPerPass' },
                { label: 'Rushing',        key: 'rushingYards' },
                { label: 'Rush Attempts',  key: 'rushingAttempts' },
                { label: 'Yards/Rush',     key: 'yardsPerRushAttempt' },
                { label: 'Turnovers',      key: 'turnovers' },
                { label: 'Interceptions',  key: 'interceptions' },
                { label: 'Fumbles Lost',   key: 'fumblesLost' },
                { label: '3rd Down',       key: 'thirdDownEff' },
                { label: '4th Down',       key: 'fourthDownEff' },
                { label: 'Red Zone',       key: 'redZoneAttempts' },
                { label: 'Penalties',      key: 'totalPenaltiesYards' },
                { label: 'Possession',     key: 'possessionTime' },
              ];

              const statRows = statsList.map(({ label, key }) => {
                const myStat  = getStat(me, key);
                const oppStat = getStat(oppTeam, key);
                return (myStat || oppStat)
                  ? `<div class="stat-comparison-row">
                      <div class="stat-value indiana-stat">${myStat || '-'}</div>
                      <div class="stat-label">${SEC.esc(label)}</div>
                      <div class="stat-value opp-stat">${oppStat || '-'}</div>
                    </div>`
                  : null;
              }).filter(Boolean);

              if (statRows.length) {
                rows.push(`<div class="section-header">TEAM STATISTICS</div>`);
                rows.push(`<div class="stat-comparison-header">
                  <div class="stat-value indiana-stat" style="font-weight:800;color:#990000">IU</div>
                  <div class="stat-label"></div>
                  <div class="stat-value opp-stat" style="font-weight:800;">${oppAbbr}</div>
                </div>`);
                rows.push(`<div class="stats-comparison">${statRows.join('')}</div>`);
              }
            }
          } catch (e) {
            LOG.warn('Failed to extract boxscore stats', e.message);
          }

          // ── Win Probability Chart ─────────────────────────────────────
          let _wpData = null;
          const _iuIsHome = hmine?.homeAway === 'home';
          try {
            const wp = sum?.winprobability;
            LOG.debug('winprobability check', { exists: !!wp, len: Array.isArray(wp) ? wp.length : 'n/a', sample: wp?.[0] });
            if (Array.isArray(wp) && wp.length > 2) {
              _wpData = wp;
              const chartId = `winprob-${SEC.safeKey(eid)}`;
              rows.push(`<div class="section-header">WIN PROBABILITY</div>`);
              rows.push(`<div class="win-prob-container"><canvas id="${chartId}" role="img" aria-label="Win probability tracker"></canvas></div>`);
            } else {
              LOG.debug('no data from "winprobability" — not available for this game');
            }
          } catch (e) {
            LOG.warn('no data from "winprobability"', e.message);
          }

          extra.innerHTML = rows.length
            ? rows.join('')
            : `<div class="row"><span>No additional details available.</span></div>`;

          // ── Render win probability Chart.js instance ──────────────────
          if (_wpData) {
            try {
              const chartId = `winprob-${SEC.safeKey(eid)}`;
              const canvas  = document.getElementById(chartId);
              if (canvas && typeof Chart !== 'undefined') {
                // Detect scale: ESPN uses 0–1; guard against already-percentage data
                const sampleVal  = parseFloat(_wpData[0]?.homeWinPercentage ?? 0.5);
                const multiplier = sampleVal > 1 ? 1 : 100;

                // Use play index on X-axis — ESPN's period/secondsLeft fields vary by
                // response version (period can be a plain number or {number:N}), so
                // time-based elapsed is unreliable. Quarter boundaries are found by
                // watching when the period value changes across plays.
                const yVals  = [];
                const qBounds = []; // [{index, label}]
                let lastPeriod = null;

                for (let i = 0; i < _wpData.length; i++) {
                  const pt = _wpData[i];
                  // period is either {number:N} or a plain number
                  const rawP = pt.period?.number ?? (typeof pt.period === 'number' ? pt.period : null);
                  const p    = rawP !== null ? parseInt(rawP, 10) : null;

                  if (p !== null && p !== lastPeriod && lastPeriod !== null) {
                    const label = p <= 4 ? `Q${p}` : (p === 5 ? 'OT' : `OT${p - 4}`);
                    qBounds.push({ index: i, label });
                  }
                  if (p !== null) lastPeriod = p;

                  const rawHome = parseFloat(pt.homeWinPercentage ?? 0.5);
                  const iuP     = _iuIsHome ? rawHome : (multiplier === 100 ? 100 - rawHome : 1 - rawHome);
                  yVals.push(Math.round(iuP * multiplier));
                }

                const total = yVals.length;
                LOG.debug('win prob chart data', { plays: total, qBounds: qBounds.map(q => q.label), iuIsHome: _iuIsHome });

                const qPlugin = {
                  id: `qp-${SEC.safeKey(eid)}`,
                  afterDraw(chart) {
                    const { ctx, scales: { x: xs, y: ys } } = chart;
                    ctx.save();
                    for (const { index, label } of qBounds) {
                      const px = xs.getPixelForValue(index);
                      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                      ctx.lineWidth   = 1;
                      ctx.setLineDash([4, 3]);
                      ctx.beginPath(); ctx.moveTo(px, ys.top); ctx.lineTo(px, ys.bottom); ctx.stroke();
                      ctx.setLineDash([]);
                      ctx.fillStyle   = '#999';
                      ctx.font        = '10px Inter, sans-serif';
                      ctx.textAlign   = 'center';
                      ctx.fillText(label, px, ys.top - 4);
                    }
                    ctx.restore();
                  },
                };

                const chart = new Chart(canvas.getContext('2d'), {
                  type: 'line',
                  data: {
                    labels: yVals.map((_, i) => i),
                    datasets: [{
                      label: 'IU Win %',
                      data: yVals,
                      borderColor: '#990000',
                      backgroundColor: 'rgba(153,0,0,0.1)',
                      borderWidth: 2.5,
                      pointRadius: 0,
                      fill: true,
                      tension: 0.3,
                    }],
                  },
                  options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          title: () => '',
                          label: (item) => `IU Win: ${item.raw}%`,
                        },
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        bodyFont: { size: 12, family: 'Inter' },
                        padding: 8,
                        cornerRadius: 6,
                      },
                    },
                    scales: {
                      x: {
                        type: 'linear',
                        min: 0,
                        max: total - 1,
                        ticks: {
                          callback: (v) => {
                            if (v === 0)         return 'Kickoff';
                            if (v >= total - 2)  return 'Final';
                            return '';
                          },
                          color: '#999',
                          font: { size: 10, family: 'Inter' },
                          maxTicksLimit: 3,
                        },
                        grid: { display: false },
                      },
                      y: {
                        min: 0,
                        max: 100,
                        ticks: {
                          callback: (v) => v + '%',
                          stepSize: 25,
                          color: '#999',
                          font: { size: 10, family: 'Inter' },
                        },
                        grid: {
                          color: (ctx) => ctx.tick.value === 50 ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.05)',
                        },
                      },
                    },
                  },
                  plugins: [qPlugin],
                });

                this._winProbCharts.set(eid, chart);
              }
            } catch (e) {
              LOG.warn('no data from "winprobability" render', e.message);
            }
          }
    }

    _leaderCard(category, leader) {
      return `
        <div class="leader-item">
          <div class="leader-category">${SEC.esc(category)}</div>
          <div class="leader-name">${leader.name}</div>
          <div class="leader-stat">${leader.stat}</div>
        </div>`;
    }

    /* ============================================================
       RECENT GAMES
    ============================================================ */
    async loadRecentGames() {
      LOG.load('Load response — loading recent games');
      const c = this.dom.recentGames;
      if (!c) return;
      c.innerHTML = '';

      const events = await this.getSeasonSchedule(this.currentYear);
      if (!events || events.length === 0) {
        const d = document.createElement('div');
        d.className = 'game-item';
        d.textContent = 'No recent games.';
        c.appendChild(d);
        return;
      }

      const completedGames = [];
      for (const e of events) {
        const sum    = await this.getSummary(this.currentYear, e.id);
        const hcomp  = sum?.header?.competitions?.[0];
        const hcomps = hcomp?.competitors || [];
        const hmine  = hcomps?.find(x => String(x.team?.id) === String(this.TEAM_ID));
        const hopp   = hcomps?.find(x => x !== hmine);
        const my = this.getScore(hmine?.score);
        const th = this.getScore(hopp?.score);
        if (my !== null && th !== null && my >= 0 && th >= 0) {
          completedGames.push({ event: e, summary: sum, myScore: my, oppScore: th });
        }
      }

      const recent = completedGames
        .sort((a, b) => new Date(b.event.date) - new Date(a.event.date))
        .slice(0, 5);

      if (recent.length === 0) {
        const d = document.createElement('div');
        d.className = 'game-item';
        d.textContent = 'No completed games yet.';
        c.appendChild(d);
        return;
      }

      for (const { event: e, summary, myScore, oppScore } of recent) {
        const comp   = e.competitions?.[0];
        const comps  = comp?.competitors || [];
        const mine   = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
        const opp    = comps.find(x => x !== mine);
        const isHome = mine?.homeAway === 'home';
        const oppName= SEC.esc(opp?.team?.displayName || 'TBD');

        const wl  = myScore > oppScore ? 'W' : (myScore < oppScore ? 'L' : 'T');
        const cls = wl.toLowerCase();

        let leadersHtml = '';
        const leaders = this.extractGameLeaders(summary, this.TEAM_ID);
        if (leaders) {
          const p   = leaders.passing   ? `${leaders.passing.name} ${leaders.passing.stat}` : '—';
          const r   = leaders.rushing   ? `${leaders.rushing.name} ${leaders.rushing.stat}` : '—';
          const rc  = leaders.receiving ? `${leaders.receiving.name} ${leaders.receiving.stat}` : '—';
          leadersHtml = `
            <div class="game-leaders" style="margin-top:6px;font-size:0.85rem;color:#666;">
              <div><strong>P:</strong> ${p}</div>
              <div><strong>R:</strong> ${r}</div>
              <div><strong>Rec:</strong> ${rc}</div>
            </div>`;
        }

        const d = document.createElement('div');
        d.className = 'game-item';
        d.innerHTML = `
          <div class="game-info">
            <div class="opponent">${isHome ? 'vs' : '@'} ${oppName}</div>
            <div class="game-date">${SEC.esc(this.fmtDateTime(e.date))}</div>
            ${leadersHtml}
          </div>
          <div class="game-result ${cls}">${wl} ${myScore}-${oppScore}</div>`;
        c.appendChild(d);
      }
      LOG.load(`Recent games loaded — ${recent.length} completed`);
    }

    /* ============================================================
       TEAM STATS — turnover margin, red zone, first downs, avg possession
    ============================================================ */
    async loadTeamStats() {
      LOG.load('Load response — loading team stats');
      let year = this.currentYear;
      let events = await this.getSeasonSchedule(year);
      let completed = await this.filterCompleted(events, year);
      let backSteps = 0;

      while ((!completed || completed.length === 0) && year > this.MIN_YEAR && backSteps < 5) {
        year -= 1;
        backSteps++;
        events = await this.getSeasonSchedule(year);
        completed = await this.filterCompleted(events, year);
      }

      if (!completed || completed.length === 0) {
        LOG.warn('No completed games found for stats');
        ['ppg','ypg','passYpg','rushYpg','defPpg','oppThirdDown','oppFourthDown',
         'oppYpg','oppPassYpg','oppRushYpg',
         'turnoverMargin','ourThirdDown','firstDownsPg'].forEach(k => {
          this.setStat(this.dom[k], '--');
        });
        return;
      }

      // Fast path: pre-aggregated /statistics endpoint fills both stat cards
      // in one request. Boxscore loop still runs after for season leaders and
      // opponent 3rd/4th down (not in the endpoint) — without overwriting.
      const endpointLoaded = await this._tryStatisticsEndpoint(year);
      await this._loadStatsFromBoxscores(completed, year, endpointLoaded);
    }

    async _tryStatisticsEndpoint(year) {
      try {
        const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}/statistics?season=${year}`;
        const data = await this.fetchJson(url);
        LOG.api('Api debug response — statistics endpoint', { ok: data != null });
        const own = data?.results?.stats?.categories;
        const opp = data?.results?.opponent;
        if (!Array.isArray(own) || !own.length) return false;

        const st = (cats, catName, statName) => {
          const c = (cats || []).find(x => x.name === catName);
          const s = (c?.stats || []).find(x => x.name === statName);
          return s?.displayValue ?? null;
        };
        const perGame = (cats, catName, statName) => {
          const c = (cats || []).find(x => x.name === catName);
          const s = (c?.stats || []).find(x => x.name === statName);
          return s?.perGameDisplayValue ?? s?.displayValue ?? null;
        };

        const ppg = st(own, 'scoring', 'totalPointsPerGame');
        if (!ppg) {
          LOG.warn('no data from "statistics"', year);
          return false;
        }

        // yardsPerGame in the passing category is total offense per game
        this.setStat(this.dom.ppg,          ppg);
        this.setStat(this.dom.ypg,          st(own, 'passing', 'yardsPerGame'));
        this.setStat(this.dom.passYpg,      st(own, 'passing', 'passingYardsPerGame'));
        this.setStat(this.dom.rushYpg,      st(own, 'rushing', 'rushingYardsPerGame'));
        this.setStat(this.dom.firstDownsPg, perGame(own, 'miscellaneous', 'firstDowns'));

        const to = parseFloat(st(own, 'miscellaneous', 'turnOverDifferential'));
        this.setStat(this.dom.turnoverMargin, Number.isFinite(to) ? (to >= 0 ? `+${to}` : `${to}`) : '--');

        const third = parseFloat(st(own, 'miscellaneous', 'thirdDownConvPct'));
        this.setStat(this.dom.ourThirdDown, Number.isFinite(third) ? `${third.toFixed(1)}%` : '--');

        this.setStat(this.dom.defPpg,     st(opp, 'scoring', 'totalPointsPerGame'));
        this.setStat(this.dom.oppYpg,     st(opp, 'passing', 'yardsPerGame'));
        this.setStat(this.dom.oppPassYpg, st(opp, 'passing', 'passingYardsPerGame'));
        this.setStat(this.dom.oppRushYpg, st(opp, 'rushing', 'rushingYardsPerGame'));

        LOG.load('Team stats loaded from "statistics"', year);
        return true;
      } catch (e) {
        LOG.warn('statistics endpoint failed', e.message);
        return false;
      }
    }

    async _loadStatsFromBoxscores(completed, year, skipOffensive) {
      LOG.load(`Computing stats from ${completed.length} completed games in ${year}`);

      let games = 0;
      let pts = 0, oppPts = 0, passYds = 0, rushYds = 0, totalYds = 0;
      let oppTotalYds = 0, oppPassYds = 0, oppRushYds = 0;
      let oppThirdConv = 0, oppThirdAtt = 0, oppFourthConv = 0, oppFourthAtt = 0;
      let myTurnovers = 0, oppTurnovers = 0;
      let our3Conv = 0, our3Att = 0, firstDowns = 0;

      // Season leaders accumulation
      const leaders = { passing: {}, rushing: {}, receiving: {} };

      for (let i = 0; i < completed.length; i++) {
        const e   = completed[i];
        const sum = await this.getSummary(year, e.id);
        const p   = this.parseSummaryStats(sum, e);

        if (!p) { LOG.warn(`Failed to parse stats for event ${e.id}`); continue; }

        games++;
        pts        += p.pts;      oppPts  += p.oppPts;
        passYds    += p.passYds;  rushYds += p.rushYds; totalYds += p.totalYds;
        if (p.oppTotalYds) oppTotalYds += p.oppTotalYds;
        if (p.oppPassYds)  oppPassYds  += p.oppPassYds;
        if (p.oppRushYds)  oppRushYds  += p.oppRushYds;
        oppThirdConv += p.oppThirdConv;   oppThirdAtt += p.oppThirdAtt;
        oppFourthConv += p.oppFourthConv; oppFourthAtt += p.oppFourthAtt;
        myTurnovers  += p.myTurnovers;    oppTurnovers += p.oppTurnovers;
        our3Conv += p.our3Conv; our3Att += p.our3Att;
        firstDowns   += p.firstDowns;

        // Accumulate per-player stat leaders from boxscore
        this._accumulateLeaders(leaders, sum);

        if (this.isMobile && i % this.summaryConcurrency === 0) {
          await new Promise(r => setTimeout(r, 120));
        }
      }

      const avg = (v) => games ? (v / games) : 0;
      const pct = (c, a) => a > 0 ? ((c / a) * 100).toFixed(1) + '%' : '--';
      const margin    = oppTurnovers - myTurnovers;
      const marginStr = games ? (margin >= 0 ? `+${margin}` : `${margin}`) : '--';

      // When /statistics loaded the cards, only fill what it lacks —
      // do not overwrite official numbers with boxscore-derived ones
      if (!skipOffensive) {
        this.setStat(this.dom.ppg,     games ? avg(pts).toFixed(1)      : '--');
        this.setStat(this.dom.ypg,     games ? avg(totalYds).toFixed(1) : '--');
        this.setStat(this.dom.passYpg, games ? avg(passYds).toFixed(1)  : '--');
        this.setStat(this.dom.rushYpg, games ? avg(rushYds).toFixed(1)  : '--');
        this.setStat(this.dom.firstDownsPg,  games ? avg(firstDowns).toFixed(1) : '--');
        this.setStat(this.dom.turnoverMargin, marginStr);
        this.setStat(this.dom.ourThirdDown,  pct(our3Conv, our3Att));
        this.setStat(this.dom.defPpg,        games ? avg(oppPts).toFixed(1) : '--');
        this.setStat(this.dom.oppYpg,     (games && oppTotalYds) ? avg(oppTotalYds).toFixed(1) : '--');
        this.setStat(this.dom.oppPassYpg, (games && oppPassYds)  ? avg(oppPassYds).toFixed(1)  : '--');
        this.setStat(this.dom.oppRushYpg, (games && oppRushYds)  ? avg(oppRushYds).toFixed(1)  : '--');
      }
      // Not available from /statistics — always boxscore-derived
      this.setStat(this.dom.oppThirdDown,  pct(oppThirdConv, oppThirdAtt));
      this.setStat(this.dom.oppFourthDown, pct(oppFourthConv, oppFourthAtt));

      LOG.load('Team stats loaded from boxscores');
      this._renderSeasonLeaders(leaders);
    }

    _accumulateLeaders(leaders, summary) {
      try {
        const bPlayers = summary?.boxscore?.players;
        if (!Array.isArray(bPlayers)) return;
        const iuEntry = bPlayers.find(t => String(t.team?.id) === String(this.TEAM_ID));
        if (!iuEntry?.statistics) return;

        for (const cat of iuEntry.statistics) {
          const cName = (cat.name || '').toLowerCase();
          let bucket = null;
          if (cName.includes('pass')) bucket = leaders.passing;
          else if (cName.includes('rush')) bucket = leaders.rushing;
          else if (cName.includes('receiv')) bucket = leaders.receiving;
          if (!bucket) continue;

          // Stat index 0 is typically yards for all three categories
          const ydsIdx = (cat.labels || cat.keys || []).findIndex(l =>
            /^(yds|yards|net)$/i.test(String(l))
          );
          const tdIdx = (cat.labels || cat.keys || []).findIndex(l => /^td$/i.test(String(l)));

          for (const ath of (cat.athletes || [])) {
            const name = SEC.esc(ath.athlete?.displayName || ath.athlete?.shortName || '');
            if (!name) continue;
            const yds = parseFloat(ath.stats?.[ydsIdx >= 0 ? ydsIdx : 0]) || 0;
            const tds = parseFloat(ath.stats?.[tdIdx  >= 0 ? tdIdx  : -1]) || 0;
            if (!bucket[name]) bucket[name] = { yds: 0, tds: 0 };
            bucket[name].yds += yds;
            bucket[name].tds += tds;
          }
        }
      } catch (e) {
        LOG.warn('Leader accumulation failed', e.message);
      }
    }

    _renderSeasonLeaders(leaders) {
      const c = this.dom.statLeaders;
      if (!c) return;

      const top = (bucket) => {
        const entries = Object.entries(bucket);
        if (!entries.length) return null;
        entries.sort((a, b) => b[1].yds - a[1].yds);
        const [name, stats] = entries[0];
        return { name, yds: Math.round(stats.yds), tds: Math.round(stats.tds) };
      };

      const passer   = top(leaders.passing);
      const rusher   = top(leaders.rushing);
      const receiver = top(leaders.receiving);

      if (!passer && !rusher && !receiver) {
        c.innerHTML = '<div class="stat-row"><span>No data available yet</span><span>—</span></div>';
        return;
      }

      const row = (label, player) => player
        ? `<div class="stat-row"><span>${SEC.esc(label)}: ${player.name}</span><span>${player.yds} yds${player.tds ? ` / ${player.tds} TD` : ''}</span></div>`
        : '';

      c.innerHTML = [
        row('Passing',   passer),
        row('Rushing',   rusher),
        row('Receiving', receiver),
      ].join('');
      LOG.load('Season leaders rendered');
    }

    async filterCompleted(events, year) {
      const completed = [];
      for (const e of (events || [])) {
        const sum    = await this.getSummary(year, e.id);
        if (!sum) continue;
        const hcomp  = sum?.header?.competitions?.[0];
        const hcomps = hcomp?.competitors || [];
        const hmine  = hcomps.find(x => String(x.team?.id) === String(this.TEAM_ID));
        const hopp   = hcomps.find(x => x !== hmine);
        const my = this.getScore(hmine?.score);
        const th = this.getScore(hopp?.score);
        if (my !== null && th !== null && my >= 0 && th >= 0) completed.push(e);
      }
      return completed;
    }

    parseSummaryStats(summary, eFromSchedule) {
      const comp  = eFromSchedule?.competitions?.[0];
      const comps = comp?.competitors || [];
      const mine  = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
      const opp   = comps.find(x => x !== mine);

      let myPts    = this.getScore(mine?.score) || 0;
      let theirPts = this.getScore(opp?.score) || 0;

      if (!myPts && !theirPts) {
        const hcomp  = summary?.header?.competitions?.[0];
        const hcomps = hcomp?.competitors || [];
        const hmine  = hcomps?.find(x => String(x.team?.id) === String(this.TEAM_ID));
        const hopp   = hcomps?.find(x => x !== hmine);
        myPts    = this.getScore(hmine?.score) || 0;
        theirPts = this.getScore(hopp?.score) || 0;
      }

      let totalYds = 0, passYds = 0, rushYds = 0;
      let oppTotalYds = 0, oppPassYds = 0, oppRushYds = 0;
      let oppThirdConv = 0, oppThirdAtt = 0, oppFourthConv = 0, oppFourthAtt = 0;
      let myTurnovers = 0, oppTurnovers = 0;
      let redZoneConv = 0, redZoneAtt = 0;
      let our3Conv = 0, our3Att = 0, firstDowns = 0;

      try {
        const teams = summary?.boxscore?.teams;
        if (Array.isArray(teams) && teams.length === 2) {
          const idxMine = teams.findIndex(t => String(t.team?.id) === String(this.TEAM_ID));
          const idxOpp  = idxMine === 0 ? 1 : 0;
          const me      = teams[idxMine];
          const oppTeam = teams[idxOpp];

          // DIAGNOSTIC: dump all stat keys for first game so dev can see exact ESPN field names
          if (!this._statKeysDumped) {
            this._statKeysDumped = true;
            const dump = {};
            for (const t of teams) {
              dump[t.team?.displayName || 'team'] = (t.statistics || []).map(s => ({
                name: s.name, displayName: s.displayName, value: s.value, displayValue: s.displayValue
              }));
            }
            LOG.debug('ESPN BOXSCORE STAT KEYS (first game diagnostic)', dump);
          }

          // Enhanced grab — matches name OR displayName, strips all non-alphanum for comparison
          const grab = (obj, ...names) => {
            if (!obj?.statistics) return 0;
            for (const stat of obj.statistics) {
              const n = ((stat.name || '') + '|' + (stat.displayName || '')).toLowerCase().replace(/[^a-z0-9]/g, '');
              if (names.some(nm => n.includes(nm.toLowerCase().replace(/[^a-z0-9]/g, '')))) {
                const val = parseFloat(stat.value !== undefined ? stat.value : stat.displayValue);
                if (!Number.isNaN(val)) return val;
              }
            }
            return 0;
          };

          // Enhanced grabEff — handles "3-5", "3/5", "3 of 5", "3 Of 5" display values
          const grabEff = (obj, ...names) => {
            if (!obj?.statistics) return { conv: 0, att: 0 };
            for (const stat of obj.statistics) {
              const n = ((stat.name || '') + '|' + (stat.displayName || '')).toLowerCase().replace(/[^a-z0-9]/g, '');
              if (names.some(nm => n.includes(nm.toLowerCase().replace(/[^a-z0-9]/g, '')))) {
                const raw = String(stat.displayValue ?? stat.value ?? '');
                // Handle all formats: "3-5", "3/5", "3 of 5", "3 Of 5"
                const m = raw.match(/(\d+)\s*(?:[-\/]|\bof\b)\s*(\d+)/i);
                if (m) return { conv: parseInt(m[1]) || 0, att: parseInt(m[2]) || 0 };
              }
            }
            return { conv: 0, att: 0 };
          };

          totalYds = grab(me, 'totalyards', 'totaloffensiveyards');
          passYds  = grab(me, 'netpassingyards', 'passingyards');
          rushYds  = grab(me, 'rushingyards');

          const oppThird  = grabEff(oppTeam, 'thirddowneff', '3rddowneff');
          oppThirdConv = oppThird.conv;
          oppThirdAtt  = oppThird.att;

          const oppFourth = grabEff(oppTeam, 'fourthdowneff', '4thdowneff');
          oppFourthConv = oppFourth.conv;
          oppFourthAtt  = oppFourth.att;

          // Turnovers: ESPN boxscore has 'turnovers' but it's unreliable.
          // More reliable: sum interceptions thrown + fumbles lost (always present).
          // myTurnovers = what WE gave away; oppTurnovers = what THEY gave away (we forced)
          const myInt  = grab(me,      'interceptions', 'interceptionsthrown');
          const myFum  = grab(me,      'fumbleslost');
          const oppInt = grab(oppTeam, 'interceptions', 'interceptionsthrown');
          const oppFum = grab(oppTeam, 'fumbleslost');
          myTurnovers  = myInt  + myFum;
          oppTurnovers = oppInt + oppFum;

          // Opponent yardage — for defensive stats card
          oppPassYds  = grab(oppTeam, 'netpassingyards', 'passingyards');
          oppRushYds  = grab(oppTeam, 'rushingyards');
          oppTotalYds = grab(oppTeam, 'totalyards', 'totaloffensiveyards');
          if (!oppTotalYds && (oppPassYds || oppRushYds)) oppTotalYds = oppPassYds + oppRushYds;

          // Our 3rd down efficiency (IU offense) — ESPN always provides this
          const our3 = grabEff(me, 'thirddowneff', '3rddowneff');
          our3Conv = our3.conv;
          our3Att  = our3.att;

          // Red zone — ESPN's college football team boxscore rarely includes this reliably
          // Keeping the fetch attempt; shown in game detail popup if available
          const rzMe = grabEff(me, 'redzoneattempts', 'redzoneconversions', 'redzone');
          redZoneConv = rzMe.conv;
          redZoneAtt  = rzMe.att;

          // First downs — reliable in ESPN boxscore
          firstDowns = grab(me, 'firstdowns');
        }
      } catch (e) {
        LOG.warn('Error extracting boxscore stats', e.message);
      }

      if (!totalYds && (passYds || rushYds)) totalYds = passYds + rushYds;

      return {
        pts: myPts, oppPts: theirPts,
        totalYds, passYds, rushYds,
        oppTotalYds, oppPassYds, oppRushYds,
        oppThirdConv, oppThirdAtt, oppFourthConv, oppFourthAtt,
        myTurnovers, oppTurnovers,
        redZoneConv, redZoneAtt,
        our3Conv, our3Att,
        firstDowns,
      };
    }

    /* ============================================================
       LIVE PROGRAM OVERVIEW — fetches team, coach, venue from ESPN
    ============================================================ */
    async fetchProgramOverview() {
      LOG.api('Fetching live program overview from ESPN');
      const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}?enable=record,rankings,logos,coaches,venue,conference`;
      const resp = await this.fetchJson(url);
      LOG.api('Api debug response — program overview', { ok: resp != null });
      const team = resp?.team;
      if (!team) return null;

      // Head coach
      let coachName = null;
      const coaches = team.coaches || [];
      const head = coaches.find(c => (c.type || '').toLowerCase().includes('head') || c.isHead) || coaches[0];
      if (head) {
        coachName = SEC.esc(head.firstName
          ? `${head.firstName} ${head.lastName}`
          : (head.displayName || head.name || ''));
      }

      // Venue
      let stadium = null, capacity = null, venueCity = null;
      const venue = team.venue;
      if (venue) {
        stadium  = venue.fullName || venue.name ? SEC.esc(venue.fullName || venue.name) : null;
        capacity = venue.capacity ? Number(venue.capacity).toLocaleString() : null;
        const city = venue.address?.city, state = venue.address?.state;
        if (city && state) venueCity = SEC.esc(`${city}, ${state}`);
      }

      // Conference
      const confName = SEC.esc(team.groups?.name || team.conference?.name || 'Big Ten');

      // Current ranking
      let ranking = 'Unranked';
      if (Array.isArray(team.rankings) && team.rankings.length) {
        const ap = team.rankings.find(r => (r.type || '').toLowerCase().includes('ap'));
        const top = this.top25((ap || team.rankings[0])?.rank);
        if (top) ranking = `#${top}`;
      }

      // Current record
      let record = 'TBD';
      const items = team.record?.items;
      if (Array.isArray(items) && items.length) {
        const total = items.find(i => i.type === 'total') || items[0];
        if (total?.summary) record = SEC.esc(total.summary);
      }

      return { coachName, stadium, capacity, venueCity, confName, ranking, record };
    }

    /* ============================================================
       LIVE BOWL GAME DETECTION — ESPN postseason schedule (type 3)
    ============================================================ */
    async fetchBowlHistory() {
      LOG.load('Scanning ESPN postseason schedules (parallel fetch)');
      // Fetch all years simultaneously — much faster than sequential
      const results = await Promise.all(
        this.availableYears.map(async year => {
          const events = await this._getPostseasonSchedule(year);
          return events.map(e => {
            const comp  = e.competitions?.[0];
            const comps = comp?.competitors || [];
            const mine  = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
            const opp   = comps.find(x => x !== mine);
            const myScore  = this.getScore(mine?.score);
            const oppScore = this.getScore(opp?.score);
            return {
              year,
              gameName: SEC.esc(e.name || e.shortName || comp?.notes?.[0]?.headline || 'Bowl Game'),
              oppName:  SEC.esc(opp?.team?.displayName || 'Unknown'),
              myScore, oppScore,
              result: myScore !== null && oppScore !== null
                ? (myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T') : null,
            };
          });
        })
      );
      const bowls = results.flat().sort((a, b) => b.year - a.year);
      LOG.load(`Bowl scan complete — ${bowls.length} postseason games found`);
      return bowls;
    }

    /* ============================================================
       CARD BUILDER HELPERS
    ============================================================ */
    buildHistoryCard(title, icon, rows) {
      const card = document.createElement('div');
      card.className = 'history-card';
      const rowsHtml = rows.map(r => {
        if (r.type === 'achievement') {
          return `
            <div class="achievement-item">
              <i class="fas fa-${SEC.esc(r.icon || 'star')} achievement-icon" aria-hidden="true"></i>
              <div>
                <div class="achievement-title">${SEC.esc(r.label)}</div>
                <div class="achievement-years">${SEC.esc(r.value)}</div>
              </div>
            </div>`;
        }
        return `
          <div class="history-stat">
            <span class="history-label">${SEC.esc(r.label)}</span>
            <span class="history-value">${SEC.esc(r.value)}</span>
          </div>`;
      }).join('');
      card.innerHTML = `
        <h3><i class="fas fa-${SEC.esc(icon)}" aria-hidden="true"></i> ${SEC.esc(title)}</h3>
        <div class="history-content">${rowsHtml}</div>`;
      return card;
    }

    buildBowlCard(bowls) {
      const card = document.createElement('div');
      card.className = 'history-card full-width';
      const wins   = bowls.filter(b => b.result === 'W').length;
      const losses = bowls.filter(b => b.result === 'L').length;
      const total  = bowls.length;
      const sorted = bowls.slice().sort((a, b) => b.year - a.year);

      const gamesHtml = sorted.length
        ? sorted.map(b => {
            const wlClass = b.result ? `bowl-result-${b.result.toLowerCase()}` : 'bowl-result-unknown';
            const wlText  = b.result && b.myScore !== null ? `${b.result} ${b.myScore}–${b.oppScore}` : 'TBD';
            return `<div class="bowl-game-row">
              <div class="bowl-game-info">
                <span class="bowl-year">${SEC.esc(String(b.year))}</span>
                <span class="bowl-name">${b.gameName}</span>
                <span class="bowl-opp">vs ${b.oppName}</span>
              </div>
              <span class="bowl-result ${wlClass}">${wlText}</span>
            </div>`;
          }).join('')
        : `<p style="color:#666;font-size:0.9rem;">No postseason data found (2001–present). All-time: 17 appearances.</p>`;

      card.innerHTML = `
        <h3><i class="fas fa-football-ball" aria-hidden="true"></i> Bowl Game History
          <span style="font-size:0.75rem;font-weight:400;color:#666;margin-left:8px;">1995–present via ESPN</span>
        </h3>
        <div class="bowl-summary-bar">
          <div class="bowl-big-stat"><div class="bowl-big-num">${total}</div><div class="bowl-big-label">Appearances</div></div>
          <div class="bowl-big-stat"><div class="bowl-big-num" style="color:#28a745">${wins}</div><div class="bowl-big-label">Wins</div></div>
          <div class="bowl-big-stat"><div class="bowl-big-num" style="color:#dc3545">${losses}</div><div class="bowl-big-label">Losses</div></div>
          <div class="bowl-big-stat"><div class="bowl-big-num">${wins}-${losses}</div><div class="bowl-big-label">Record (ESPN era)</div></div>
        </div>
        <div class="bowl-games-grid">${gamesHtml}</div>`;
      return card;
    }

    /* ============================================================
       HISTORY — main loader — all cards built dynamically
    ============================================================ */
    async loadHistory() {
      LOG.load('Load response — loading history tab');
      const grid        = document.getElementById('history-grid-live');
      const recordsGrid = document.getElementById('history-grid-records');
      if (!grid) return;

      grid.innerHTML = `<div class="history-card full-width" style="text-align:center;padding:2rem;">
        <div class="spinner" style="margin:0 auto 1rem;border-top-color:#990000;border-color:rgba(153,0,0,0.2);"></div>
        <p style="color:#666;">Fetching live program data from ESPN&hellip;</p></div>`;

      const [overview, bowls] = await Promise.all([this.fetchProgramOverview(), this.fetchBowlHistory()]);
      grid.innerHTML = '';

      // Card 0: 2025 championship retrospective — headline facts verified
      // previously (CLAUDE.md / Program History card); game-by-game results
      // rendered live from ESPN schedule data
      try {
        const [reg25, post25] = await Promise.all([
          this.getSeasonSchedule(2025),
          this._getPostseasonSchedule(2025),
        ]);
        const games25 = [...(reg25 || []), ...(post25 || [])]
          .map(ev => {
            const comp  = ev.competitions?.[0];
            const comps = comp?.competitors || [];
            const mine  = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
            const opp   = comps.find(x => x !== mine);
            const my    = this.getScore(mine?.score);
            const th    = this.getScore(opp?.score);
            if (my === null || th === null || my + th === 0) return null;
            return {
              date: new Date(ev.date).getTime(),
              opp:  SEC.esc(opp?.team?.shortDisplayName || opp?.team?.displayName || '?'),
              home: mine?.homeAway === 'home',
              my, th,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.date - b.date);

        if (games25.length) {
          const champCard = document.createElement('div');
          champCard.className = 'history-card full-width champ-card';
          champCard.innerHTML = `
            <h3><i class="fas fa-crown" aria-hidden="true"></i> 2025: The Perfect Season</h3>
            <div class="champ-banner">
              <div class="champ-stat"><span class="champ-num">16-0</span><span>First national title in program history</span></div>
              <div class="champ-stat"><span class="champ-num">${games25[games25.length - 1].my}-${games25[games25.length - 1].th}</span><span>CFP Final vs ${games25[games25.length - 1].opp}</span></div>
              <div class="champ-stat"><span class="champ-num">13-10</span><span>Big Ten Championship vs Ohio State</span></div>
              <div class="champ-stat"><span class="champ-num">QB</span><span>Fernando Mendoza &middot; Heisman Trophy</span></div>
            </div>
            <div class="champ-games">
              ${games25.map(g => `<div class="champ-game"><span>${g.home ? 'vs' : '@'} ${g.opp}</span><span class="champ-w">W ${g.my}-${g.th}</span></div>`).join('')}
            </div>`;
          grid.appendChild(champCard);
        }
      } catch (e) { LOG.warn('champ card failed', e.message); }

      // Card 1: Program Overview (padded with known facts to fill nicely)
      const ovRows = [];
      ovRows.push(['Founded', '1887']);
      ovRows.push(['Nickname', 'Hoosiers']);
      ovRows.push(['Colors', 'Cream &amp; Crimson']);
      if (overview?.stadium)   ovRows.push(['Stadium',      overview.stadium]);
      else                     ovRows.push(['Stadium',      'Memorial Stadium']);
      if (overview?.capacity)  ovRows.push(['Capacity',     overview.capacity]);
      else                     ovRows.push(['Capacity',     '52,626']);
      if (overview?.venueCity) ovRows.push(['Location',     overview.venueCity]);
      else                     ovRows.push(['Location',     'Bloomington, IN']);
      if (overview?.coachName) ovRows.push(['Head Coach',   overview.coachName]);
      else                     ovRows.push(['Head Coach',   'Curt Cignetti']);
      if (overview?.confName)  ovRows.push(['Conference',   overview.confName]);
      else                     ovRows.push(['Conference',   'Big Ten']);
      if (overview?.record)    ovRows.push(['Season Record',overview.record]);
      if (overview?.ranking && overview.ranking !== 'Unranked') ovRows.push(['AP Ranking', overview.ranking]);
      ovRows.push(['Division I Member', 'Since 1896']);
      ovRows.push(['Athletic Director', 'Scott Dolson']);

      const ovCard = document.createElement('div');
      ovCard.className = 'history-card';
      ovCard.innerHTML = `<h3><i class="fas fa-info-circle" aria-hidden="true"></i> Program Overview</h3>
        <div class="history-content">
          ${ovRows.map(([l,v]) => `<div class="history-stat"><span class="history-label">${l}</span><span class="history-value">${v}</span></div>`).join('')}
        </div>`;
      grid.appendChild(ovCard);

      // Card 2: Program History achievements (fills same height with 6 items)
      const achCard = document.createElement('div');
      achCard.className = 'history-card';
      achCard.innerHTML = `<h3><i class="fas fa-trophy" aria-hidden="true"></i> Program History</h3>
        <div class="history-content">
          <div class="achievement-item"><i class="fas fa-star achievement-icon" aria-hidden="true"></i><div>
            <div class="achievement-title">2025 CFP National Champions</div>
            <div class="achievement-years">16-0 &bull; First title in program history &bull; Beat Miami 27-21 (Jan. 19, 2026)</div></div></div>
          <div class="achievement-item"><i class="fas fa-medal achievement-icon" aria-hidden="true"></i><div>
            <div class="achievement-title">Big Ten Championships</div>
            <div class="achievement-years">1945 outright &bull; 1967 co-champion (w/ Purdue &amp; Minnesota) &bull; 2025 outright (beat Ohio State 13-10)</div></div></div>
          <div class="achievement-item"><i class="fas fa-award achievement-icon" aria-hidden="true"></i><div>
            <div class="achievement-title">Heisman Trophy</div>
            <div class="achievement-years">Fernando Mendoza, QB &mdash; 2025 &bull; First Heisman winner in program history</div></div></div>
          <div class="achievement-item"><i class="fas fa-running achievement-icon" aria-hidden="true"></i><div>
            <div class="achievement-title">Heisman Runner-Up</div>
            <div class="achievement-years">Anthony Thompson, RB &mdash; 1989 &bull; Finished 2nd behind Andre Ware (Houston)</div></div></div>
          <div class="achievement-item"><i class="fas fa-users achievement-icon" aria-hidden="true"></i><div>
            <div class="achievement-title">NFL Alumni</div>
            <div class="achievement-years">Antwaan Randle El &bull; Tracy Porter &bull; Tevin Coleman &bull; Tiawan Mullen</div></div></div>
          <div class="achievement-item"><i class="fas fa-football-ball achievement-icon" aria-hidden="true"></i><div>
            <div class="achievement-title">Bowl Record</div>
            <div class="achievement-years">12 appearances, 7 wins through 2025 &bull; First bowl win: 1979 Holiday Bowl</div></div></div>
          <div class="achievement-item"><i class="fas fa-map-marker-alt achievement-icon" aria-hidden="true"></i><div>
            <div class="achievement-title">Memorial Stadium</div>
            <div class="achievement-years">Opened 1925 &bull; Capacity 52,626 &bull; Bloomington, IN</div></div></div>
        </div>`;
      grid.appendChild(achCard);

      // Card 3: Bowl History — full width with big summary numbers
      const bowlCard = this.buildBowlCard(bowls);
      grid.appendChild(bowlCard);

      // Card 4: Head Coaches history
      const coachCard = document.createElement('div');
      coachCard.className = 'history-card';
      coachCard.innerHTML = `<h3><i class="fas fa-user-tie" aria-hidden="true"></i> Head Coaches (1995&ndash;Present)</h3>
        <div class="coaches-list">
          <div class="coach-row coach-row-header"><span>Coach</span><span>Years</span><span>Record</span></div>
          <div class="coach-row coach-cignetti"><span>Curt Cignetti</span><span>2024&ndash;pres.</span><span>27-2</span></div>
          <div class="coach-row"><span>Tom Allen</span><span>2017&ndash;2023</span><span>33-48</span></div>
          <div class="coach-row"><span>Kevin Wilson</span><span>2011&ndash;2016</span><span>26-47</span></div>
          <div class="coach-row"><span>Bill Lynch</span><span>2007&ndash;2010</span><span>19-30</span></div>
          <div class="coach-row"><span>Terry Hoeppner</span><span>2005&ndash;2006</span><span>9-14</span></div>
          <div class="coach-row"><span>Gerry DiNardo</span><span>2002&ndash;2004</span><span>8-27</span></div>
          <div class="coach-row"><span>Cam Cameron</span><span>1997&ndash;2001</span><span>18-37</span></div>
          <div class="coach-row"><span>Bill Mallory</span><span>1984&ndash;1996</span><span>69-77-3</span></div>
        </div>`;
      grid.appendChild(coachCard);

      // Current staff — verified from CBS Sports, Yahoo Sports, red94, and
      // iuhoosiers.com (both coordinators signed 3-year extensions for 2026)
      const staffCard = document.createElement('div');
      staffCard.className = 'history-card';
      staffCard.innerHTML = `<h3><i class="fas fa-clipboard" aria-hidden="true"></i> Current Coaching Staff</h3>
        <div class="coaches-list">
          <div class="coach-row coach-row-header"><span>Coach</span><span>Role</span><span></span></div>
          <div class="coach-row coach-cignetti"><span>Curt Cignetti</span><span>Head Coach</span><span></span></div>
          <div class="coach-row"><span>Mike Shanahan</span><span>Off. Coordinator &middot; WR</span><span></span></div>
          <div class="coach-row"><span>Bryant Haines</span><span>Def. Coordinator &middot; LB</span><span></span></div>
          <div class="coach-row"><span>Tino Sunseri</span><span>Co-Off. Coordinator &middot; QB</span><span></span></div>
          <div class="coach-row"><span>Grant Cain</span><span>Special Teams Coordinator</span><span></span></div>
        </div>
        <p class="staff-note">Both coordinators re-signed on 3-year deals after the 2025 national championship.</p>`;
      grid.appendChild(staffCard);

      // Card 5: Season summary (computed async, updates in place)
      const teaserCard = document.createElement('div');
      teaserCard.className = 'history-card full-width';
      teaserCard.id = 'records-teaser';
      teaserCard.innerHTML = `<h3><i class="fas fa-chart-bar" aria-hidden="true"></i> Season Summary (1995–present)</h3>
        <div class="history-content">
          <div class="history-stat"><span class="history-label">Seasons tracked</span><span class="history-value">${new Date().getFullYear() - 1995 + 1}</span></div>
          <div class="history-stat"><span class="history-label">Total wins</span><span class="history-value" id="computed-wins-total" style="color:#999;font-style:italic;">loading…</span></div>
          <div class="history-stat"><span class="history-label">Total losses</span><span class="history-value" id="computed-losses-total" style="color:#999;font-style:italic;">loading…</span></div>
          <div class="history-stat"><span class="history-label">Best season</span><span class="history-value" id="computed-best" style="color:#999;font-style:italic;">loading…</span></div>
          <div class="history-stat"><span class="history-label">Winning seasons</span><span class="history-value" id="computed-winning" style="color:#999;font-style:italic;">loading…</span></div>
        </div>`;
      grid.appendChild(teaserCard);

      // Compute season records async — updates teaser + feeds chart
      if (recordsGrid) recordsGrid.style.display = '';
      const container = this.dom.seasonRecords;
      if (container) container.innerHTML = '';

      // Static fallback for years where ESPN API has no data
      const STATIC_RECORDS = {
        1995: { w: 2, l: 9,  t: 0, cw: 0, cl: 8, ct: 0 },
        1996: { w: 3, l: 8,  t: 0, cw: 1, cl: 7, ct: 0 },
        1997: { w: 2, l: 9,  t: 0, cw: 1, cl: 7, ct: 0 },
        1998: { w: 4, l: 7,  t: 0, cw: 2, cl: 6, ct: 0 },
      };

      const years = this.availableYears.slice().reverse();
      const chartData = { years: [], wins: [], losses: [], confWins: [] };
      let totalW = 0, totalL = 0, bestW = 0, bestYear = null, winningSeas = 0;

      // Fetch all schedules in parallel, then compute records (no summary fetches needed)
      const allSchedules = await Promise.all(years.map(y => this.getSeasonSchedule(y)));
      const allPost      = await Promise.all(years.map(y => this._getPostseasonSchedule(y)));
      const allRecords   = await Promise.all(
        years.map(async (y, i) => {
          const rec = allSchedules[i]?.length
            ? await this.computeSeasonRecordFromEvents(y, allSchedules[i])
            : (STATIC_RECORDS[y] || null);
          if (!rec) return null;
          // Postseason counts toward overall only — conference records are
          // regular-season by convention (title game and CFP excluded)
          if (allPost[i]?.length) {
            const ps = await this.computeSeasonRecordFromEvents(y, allPost[i]);
            rec.w += ps.w; rec.l += ps.l; rec.t += ps.t;
          }
          return rec;
        })
      );

      // Collect ranking data from schedule events (AP curatedRank on IU competitor)
      const rankingData = { labels: [], values: [] };

      for (let i = 0; i < years.length; i++) {
        const y   = years[i];
        const rec = allRecords[i];
        const hasData = rec && (rec.w + rec.l + rec.t) > 0;
        const overall = hasData ? `Overall: ${rec.w}-${rec.l}${rec.t ? `-${rec.t}` : ''}` : 'Overall: —';
        const hasConf = rec && (rec.cw + rec.cl + rec.ct) > 0;
        const conf    = hasConf ? `Conf: ${rec.cw}-${rec.cl}` : 'Conf: N/A';

        if (hasData) {
          chartData.years.push(y);
          chartData.wins.push(rec.w);
          chartData.losses.push(rec.l);
          chartData.confWins.push(rec.cw);
          totalW += rec.w; totalL += rec.l;
          if (rec.w > bestW) { bestW = rec.w; bestYear = y; }
          if (rec.w > rec.l) winningSeas++;
        }

        // Extract week-by-week rankings from events
        const sched = allSchedules[i] || [];
        for (const ev of sched.slice().sort((a, b) => new Date(a.date) - new Date(b.date))) {
          const comp  = ev.competitions?.[0];
          const comps = comp?.competitors || [];
          const mine  = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
          const rank  = this.top25(mine?.curatedRank?.current);
          if (rank) {
            const opp  = comps.find(x => x !== mine);
            const oppN = SEC.esc(opp?.team?.abbreviation || opp?.team?.shortDisplayName || '?');
            rankingData.labels.push(`${y} vs ${oppN}`);
            rankingData.values.push(rank);
          }
        }

        if (container) {
          const div = document.createElement('div');
          div.className = 'season-record';
          div.innerHTML = `<span><strong>${SEC.esc(String(y))}</strong></span><span>${SEC.esc(overall)}</span><span>${SEC.esc(conf)}</span>`;
          container.appendChild(div);
        }
      }

      // Update teaser card all at once
      const wEl  = document.getElementById('computed-wins-total');
      const lEl  = document.getElementById('computed-losses-total');
      const bEl  = document.getElementById('computed-best');
      const wSEl = document.getElementById('computed-winning');
      if (wEl)  wEl.textContent  = String(totalW);
      if (lEl)  lEl.textContent  = String(totalL);
      if (bEl)  bEl.textContent  = bestYear ? `${bestW} wins (${bestYear})` : '—';
      if (wSEl) wSEl.textContent = `${winningSeas} of ${chartData.years.length}`;

      // Head-to-head records vs every opponent since 1995 (incl. postseason)
      const h2h = new Map();
      years.forEach((y, i) => {
        for (const ev of [...(allSchedules[i] || []), ...(allPost[i] || [])]) {
          const comp  = ev.competitions?.[0];
          const comps = comp?.competitors || [];
          const mine  = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
          const opp   = comps.find(x => x !== mine);
          const my    = this.getScore(mine?.score);
          const th    = this.getScore(opp?.score);
          const done  = comp?.status?.type?.completed === true
                     || comp?.status?.type?.name === 'STATUS_FINAL'
                     || (my !== null && th !== null && my + th > 0);
          const name  = opp?.team?.displayName;
          if (!name || my === null || th === null || !done) continue;
          const r = h2h.get(name) || { w: 0, l: 0, t: 0 };
          if (my > th) r.w++; else if (my < th) r.l++; else r.t++;
          h2h.set(name, r);
        }
      });

      const h2hRows = [...h2h.entries()]
        .sort((a, b) => (b[1].w + b[1].l + b[1].t) - (a[1].w + a[1].l + a[1].t) || a[0].localeCompare(b[0]))
        .map(([name, r]) => {
          const cls = r.w > r.l ? 'h2h-lead' : r.w < r.l ? 'h2h-trail' : '';
          return `<div class="h2h-row"><span>${SEC.esc(name)}</span><span>${r.w + r.l + r.t}</span><span class="${cls}">${r.w}-${r.l}${r.t ? `-${r.t}` : ''}</span></div>`;
        }).join('');
      if (h2hRows) {
        const h2hCard = document.createElement('div');
        h2hCard.className = 'history-card full-width';
        h2hCard.innerHTML = `<h3><i class="fas fa-handshake" aria-hidden="true"></i> All-Time vs Opponents (1995&ndash;present)</h3>
          <div class="h2h-list">
            <div class="h2h-row h2h-header"><span>Opponent</span><span>Games</span><span>IU Record</span></div>
            ${h2hRows}
          </div>`;
        grid.appendChild(h2hCard);
      }

      // Rivalry trophies — holder, streak, and record computed from results.
      // Static facts verified: Old Oaken Bucket first awarded 1925 (Wikipedia,
      // iuhoosiers.com, purduesports.com); Old Brass Spittoon since 1950
      // (iuhoosiers.com, The Only Colors, SI)
      const trophyGames = (rivalId) => {
        const list = [];
        years.forEach((y, i) => {
          for (const ev of [...(allSchedules[i] || []), ...(allPost[i] || [])]) {
            const comp  = ev.competitions?.[0];
            const comps = comp?.competitors || [];
            const mine  = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
            const opp   = comps.find(x => x !== mine);
            if (String(opp?.team?.id) !== String(rivalId)) continue;
            const my = this.getScore(mine?.score);
            const th = this.getScore(opp?.score);
            const done = comp?.status?.type?.completed === true
                      || comp?.status?.type?.name === 'STATUS_FINAL'
                      || (my !== null && th !== null && my + th > 0);
            if (!done || my === null || th === null) continue;
            list.push({ date: new Date(ev.date).getTime(), win: my > th, tie: my === th, my, th, year: y });
          }
        });
        return list.sort((a, b) => a.date - b.date);
      };
      const trophyRow = (name, rival, since, games) => {
        if (!games.length) return '';
        const w    = games.filter(g => g.win).length;
        const l    = games.filter(g => !g.win && !g.tie).length;
        const last = games[games.length - 1];
        const holder = last.tie ? 'Retained' : (last.win ? 'Indiana' : rival);
        let streak = 0;
        for (let i = games.length - 1; i >= 0 && !games[i].tie && games[i].win === last.win; i--) streak++;
        return `
          <div class="trophy-row">
            <div class="trophy-name"><i class="fas fa-trophy" aria-hidden="true"></i> ${name}</div>
            <div class="trophy-meta">vs ${rival} &middot; since ${since}</div>
            <div class="trophy-stats">
              <span>Holder: <strong class="${last.win ? 'h2h-lead' : 'h2h-trail'}">${holder}</strong></span>
              <span>Last: ${last.win ? 'W' : 'L'} ${last.my}-${last.th} (${last.year})</span>
              <span>Streak: ${streak} ${last.win ? 'IU' : rival}</span>
              <span>Since 1995: ${w}-${l}</span>
            </div>
          </div>`;
      };
      const trophyRowsHtml = trophyRow('Old Oaken Bucket', 'Purdue', 1925, trophyGames(2509))
                           + trophyRow('Old Brass Spittoon', 'Michigan State', 1950, trophyGames(127));
      if (trophyRowsHtml) {
        const tCard = document.createElement('div');
        tCard.className = 'history-card full-width';
        tCard.innerHTML = `<h3><i class="fas fa-trophy" aria-hidden="true"></i> Rivalry Trophies</h3>
          <div class="trophy-list">${trophyRowsHtml}</div>`;
        grid.appendChild(tCard);
      }

      this.createWinsChart(chartData);
      this.createRankingChart(rankingData);
      LOG.load('History loaded');
    }

    createWinsChart(data) {
      const canvas = document.getElementById('wins-chart');
      if (!canvas || data.years.length === 0) {
        LOG.warn('Debug wins — chart canvas not found or no data');
        return;
      }

      // Chart is not useful on small screens — replace with a text note
      if (this.isMobile || window.innerWidth < 600) {
        const container = canvas.closest('.chart-container') || canvas.parentElement;
        if (container) {
          container.innerHTML = `<div class="chart-mobile-note">
            <i class="fas fa-chart-bar" aria-hidden="true"></i>
            <span>Season-by-season win/loss chart available on desktop</span>
          </div>`;
        }
        return;
      }

      if (this.winsChart) this.winsChart.destroy();

      const ctx = canvas.getContext('2d');
      this.winsChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.years,
          datasets: [
            { label: 'Total Wins',        data: data.wins,     backgroundColor: '#990000', borderColor: '#660000', borderWidth: 1 },
            { label: 'Total Losses',      data: data.losses,   backgroundColor: '#cccccc', borderColor: '#999999', borderWidth: 1 },
            { label: 'Conference Wins',   data: data.confWins, backgroundColor: '#FFC42E', borderColor: '#D9A42B', borderWidth: 1 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { font: { size: 12, family: 'Inter' }, padding: 15 } },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              titleFont: { size: 14, family: 'Inter' },
              bodyFont:  { size: 13, family: 'Inter' },
              padding: 12,
              cornerRadius: 8,
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11, family: 'Inter' }, maxRotation: 45, minRotation: 45 } },
            y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11, family: 'Inter' } }, grid: { color: 'rgba(0,0,0,0.05)' } },
          },
        },
      });
      LOG.debug('Debug wins — chart rendered', { years: data.years.length });
    }

    createRankingChart(data) {
      const card   = document.getElementById('ranking-chart-card');
      const canvas = document.getElementById('ranking-chart');
      if (!canvas || !card || !data.values.length) {
        LOG.info('Ranking chart — no ranked weeks found');
        return;
      }

      // Not useful on small screens
      if (this.isMobile || window.innerWidth < 600) {
        const container = canvas.closest('.chart-container') || canvas.parentElement;
        if (container) {
          container.innerHTML = `<div class="chart-mobile-note">
            <i class="fas fa-chart-line" aria-hidden="true"></i>
            <span>AP ranking chart available on desktop</span>
          </div>`;
        }
        card.style.display = '';
        return;
      }

      card.style.display = '';

      if (this.rankingChart) this.rankingChart.destroy();

      this.rankingChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'AP Ranking',
            data: data.values,
            borderColor: '#990000',
            backgroundColor: 'rgba(153,0,0,0.08)',
            borderWidth: 2.5,
            pointRadius: 5,
            pointBackgroundColor: '#990000',
            fill: true,
            tension: 0.2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (item) => `AP Ranking: #${item.raw}`,
              },
              backgroundColor: 'rgba(0,0,0,0.8)',
              bodyFont: { size: 12, family: 'Inter' },
              padding: 8,
              cornerRadius: 6,
            },
          },
          scales: {
            x: {
              ticks: {
                font: { size: 10, family: 'Inter' },
                maxRotation: 45,
                minRotation: 45,
              },
              grid: { display: false },
            },
            y: {
              reverse: true,  // #1 at top
              min: 1,
              max: 25,
              ticks: {
                callback: (v) => `#${v}`,
                stepSize: 5,
                font: { size: 10, family: 'Inter' },
                color: '#999',
              },
              grid: { color: 'rgba(0,0,0,0.05)' },
            },
          },
        },
      });
      LOG.debug('Ranking chart rendered', { dataPoints: data.values.length });
    }

    /* ============================================================
       ROSTER — live from ESPN + static depth charts
    ============================================================ */
    /* ============================================================
       ROSTER / DEPTH CHART
       Full Roster: hardcoded per season (2024, 2025, 2026).
       2026 also attempts live fetch from Google Sheets (gviz/tq, free,
       no API key) — falls back silently to hardcoded if sheet is
       not publicly shared or unreachable.
       Depth Chart: manually curated from official IU depth chart releases.
    ============================================================ */
    async loadRoster() {
      LOG.load('Load response — loading roster/depth chart');
      const host = this.dom.rosterTab;
      if (!host) return;
      const existing = document.getElementById('depth-chart-section');
      if (existing) existing.remove();

      const section = document.createElement('div');
      section.id = 'depth-chart-section';
      section.innerHTML = `
        <div class="depth-chart-header">
          <h2 style="color:white;margin:0;">Roster &amp; Depth Chart</h2>
          <div class="depth-chart-controls">
            <select id="roster-year-select" class="year-select" aria-label="Select season year">
              ${[2026, 2025, 2024].map(y => `<option value="${y}" ${y === this.currentRosterYear ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
            <button class="depth-btn active" data-unit="roster">Full Roster</button>
            <button class="depth-btn" data-unit="offense" id="dc-btn-offense">Offense</button>
            <button class="depth-btn" data-unit="defense" id="dc-btn-defense">Defense</button>
            <button class="depth-btn" data-unit="specialists" id="dc-btn-specialists">Specialists</button>
          </div>
        </div>
        <div id="depth-chart-content" class="depth-chart-content"></div>`;
      host.appendChild(section);

      const syncDepthBtns = () => {
        const hasDc = !!this.depthCharts[this.currentRosterYear];
        ['dc-btn-offense','dc-btn-defense','dc-btn-specialists'].forEach(id => {
          const btn = document.getElementById(id);
          if (btn) btn.style.display = hasDc ? '' : 'none';
        });
      };

      section.querySelector('#roster-year-select').addEventListener('change', (e) => {
        this.currentRosterYear = parseInt(e.target.value, 10);
        section.querySelectorAll('.depth-btn').forEach(b => b.classList.toggle('active', b.dataset.unit === 'roster'));
        syncDepthBtns();
        this._showUnit('roster');
      });
      syncDepthBtns();

      section.querySelectorAll('.depth-btn').forEach(b => {
        b.addEventListener('click', () => {
          section.querySelectorAll('.depth-btn').forEach(bb => bb.classList.remove('active'));
          b.classList.add('active');
          this._showUnit(b.dataset.unit);
        });
      });

      await this._showUnit('roster');
    }

    async _showUnit(unit) {
      const container = document.getElementById('depth-chart-content');
      if (!container) return;

      if (unit !== 'roster') {
        // Depth chart view
        const dc = this.depthCharts[this.currentRosterYear];
        if (!dc || !dc[unit]) {
          container.innerHTML = '<div class="no-data"><p>No depth chart available for this season.</p></div>';
          return;
        }
        if (unit === 'offense')      this.renderOffense(container, dc[unit]);
        else if (unit === 'defense') this.renderDefense(container, dc[unit]);
        else                          this.renderSpecial(container, dc[unit]);
        return;
      }

      // Full roster view
      container.innerHTML = `<div style="text-align:center;padding:2rem;color:#666;">
        <div class="spinner" style="margin:0 auto 1rem;border-top-color:#990000;border-color:rgba(153,0,0,0.2);"></div>
        Loading roster…</div>`;

      let players = null;
      let source  = '';

      if (this.currentRosterYear === 2026) {
        // Try Google Sheets live first for current season
        players = await this._fetchGSheetRoster();
        source  = players ? '2026 — Live from Google Sheets (iuhoosiers.com roster)' : '';
      }

      // Curated hardcoded data (2024–2026)
      if (!players) {
        players = this._hardcodedRoster(this.currentRosterYear);
        if (players?.length) source = `${this.currentRosterYear} — Curated roster`;
      }

      this._renderRosterTable(container, players, source);
    }

    /* ---- Google Sheets gviz/tq (free, no API key needed) ---- */
    async _fetchGSheetRoster() {
      const SHEET_ID = '1aS2lwUFnWkTfTcn-pDrEd2njbeptVlf0Pl7x9WYIP-c';
      const GID      = '0';
      const key      = `gsheet:${SHEET_ID}:${GID}`;
      if (this.mem.has(key)) return this.mem.get(key);

      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;
      LOG.net('Fetching Google Sheets roster', url);
      try {
        const res  = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        // Strip JSONP wrapper: google.visualization.Query.setResponse({...})
        const raw  = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/);
        if (!raw?.[1]) throw new Error('No JSON payload in gviz response');
        const json = JSON.parse(raw[1]);
        const cols = json?.table?.cols || [];
        const rows = json?.table?.rows || [];
        if (!rows.length) throw new Error('Empty sheet');

        // Map header names to indices (case-insensitive, partial match)
        const hdr = cols.map(c => (c.label || '').toLowerCase().trim());
        const col = (...names) => {
          for (const nm of names) {
            const i = hdr.findIndex(h => h.includes(nm.toLowerCase()));
            if (i >= 0) return i;
          }
          return -1;
        };
        const val = (row, idx) => idx >= 0 ? String(row.c?.[idx]?.v ?? row.c?.[idx]?.f ?? '').trim() : '';

        const idxNum  = col('#', 'num', 'jersey', 'no');
        const idxName = col('name', 'player', 'full');
        const idxPos  = col('pos', 'position');
        const idxGrp  = col('group', 'unit', 'category');
        const idxHt   = col('ht', 'height');
        const idxWt   = col('wt', 'weight');
        const idxYr   = col('yr', 'year', 'class');
        const idxCity = col('hometown', 'city', 'from', 'home');

        const players = [];
        for (const row of rows) {
          if (!row.c?.some(c => c?.v)) continue; // skip blank rows
          const name = val(row, idxName);
          if (!name) continue;
          players.push({
            number:   SEC.esc(val(row, idxNum)  || '—'),
            name:     SEC.esc(name),
            pos:      SEC.esc(val(row, idxPos)  || '—'),
            posGroup: SEC.esc(val(row, idxGrp)  || val(row, idxPos) || 'Roster'),
            height:   SEC.esc(val(row, idxHt)   || '—'),
            weight:   SEC.esc(val(row, idxWt)   || '—'),
            classYr:  SEC.esc(val(row, idxYr)   || '—'),
            hometown: SEC.esc(val(row, idxCity) || '—'),
          });
        }
        if (!players.length) throw new Error('No player rows parsed');
        LOG.load(`Google Sheets: ${players.length} players loaded`);
        this.mem.set(key, players);
        return players;
      } catch (e) {
        LOG.warn('Google Sheets fetch failed — using hardcoded roster', e.message);
        return null;
      }
    }

    /* ---- Render grouped roster table ---- */
    _renderRosterTable(container, players, sourceLabel) {
      if (!players?.length) {
        container.innerHTML = '<div class="no-data"><p>No roster data available.</p></div>';
        return;
      }

      // Group by posGroup, preserving insertion order
      const groups = new Map();
      for (const p of players) {
        const g = p.posGroup || 'Roster';
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(p);
      }

      container.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'roster-wrap';

      if (sourceLabel) {
        const lbl = document.createElement('div');
        lbl.className = 'roster-source-label';
        lbl.textContent = sourceLabel;
        wrap.appendChild(lbl);
      }

      const search = document.createElement('input');
      search.type = 'search';
      search.className = 'roster-search';
      search.placeholder = 'Search name, position, hometown…';
      search.setAttribute('aria-label', 'Search roster');
      wrap.appendChild(search);
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        wrap.querySelectorAll('.roster-table tbody tr').forEach(tr => {
          tr.style.display = !q || tr.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
        wrap.querySelectorAll('.roster-group-section').forEach(sec => {
          const any = [...sec.querySelectorAll('tbody tr')].some(tr => tr.style.display !== 'none');
          sec.style.display = any ? '' : 'none';
        });
      });

      for (const [groupName, group] of groups) {
        const sec = document.createElement('div');
        sec.className = 'roster-group-section';
        sec.innerHTML = `
          <div class="roster-group-header">
            ${SEC.esc(groupName)}&ensp;<span class="roster-count">${group.length}</span>
          </div>
          <table class="roster-table">
            <thead><tr>
              <th>#</th><th>Player</th><th>Pos</th><th>Ht</th><th>Wt</th><th>Yr</th>
              <th class="roster-hometown-hdr">Hometown</th>
            </tr></thead>
            <tbody>
              ${group.map(p => `<tr>
                <td class="roster-num">${p.number}</td>
                <td class="roster-name-cell">${p.name}</td>
                <td><span class="roster-pos-badge">${p.pos}</span></td>
                <td>${p.height}</td>
                <td>${p.weight}</td>
                <td><span class="roster-yr">${p.classYr}</span></td>
                <td class="roster-hometown-hdr">${p.hometown}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
        wrap.appendChild(sec);
      }
      container.appendChild(wrap);

      // Row click → player profile modal (DOM row order matches group order;
      // handlers stay bound to their rows when column sorting reorders them)
      const flat = [...groups.values()].flat();
      wrap.querySelectorAll('.roster-table tbody tr').forEach((tr, i) => {
        tr.classList.add('roster-row-click');
        tr.addEventListener('click', () => this.openPlayerModal(flat[i]));
      });

      // Column sort — numeric where cells parse as numbers, heights as inches
      const toNum = (s) => {
        const ht = s.match(/^(\d+)'(\d+)/);
        if (ht) return parseInt(ht[1], 10) * 12 + parseInt(ht[2], 10);
        const n = parseFloat(s.replace(/[^\d.\-]/g, ''));
        return Number.isFinite(n) ? n : null;
      };
      wrap.querySelectorAll('.roster-table th').forEach((th) => {
        th.addEventListener('click', () => {
          const table = th.closest('table');
          const idx   = [...th.parentElement.children].indexOf(th);
          const tbody = table.querySelector('tbody');
          const asc   = th.dataset.sort !== 'asc';
          table.querySelectorAll('th').forEach(h => { delete h.dataset.sort; });
          th.dataset.sort = asc ? 'asc' : 'desc';
          const rows = [...tbody.children].sort((a, b) => {
            const av = a.children[idx]?.textContent.trim() || '';
            const bv = b.children[idx]?.textContent.trim() || '';
            const an = toNum(av), bn = toNum(bv);
            const cmp = (an !== null && bn !== null) ? an - bn : av.localeCompare(bv);
            return asc ? cmp : -cmp;
          });
          rows.forEach(r => tbody.appendChild(r));
        });
      });
    }

    /* ============================================================
       PLAYER PROFILE MODAL
    ============================================================ */
    _normName(s) {
      return String(s || '').toLowerCase()
        .replace(/\b(jr|sr|ii|iii|iv|v)\.?\s*$/g, '')
        .replace(/[^a-z\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    /** Map normalized player name -> ESPN athlete {id, headshot, link}.
        Only the current roster exists on ESPN — past-season roster queries
        return empty, so departed players simply will not resolve. */
    async _fetchAthleteIndex() {
      const key = 'athidx';
      if (this.mem.has(key)) return this.mem.get(key);
      const url  = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}/roster`;
      const data = await this.fetchJson(url);
      const idx  = new Map();
      for (const g of (Array.isArray(data?.athletes) ? data.athletes : [])) {
        for (const a of (g.items || [])) {
          if (!a?.id || !a?.displayName) continue;
          idx.set(this._normName(a.displayName), {
            id:       String(parseInt(a.id, 10)),
            headshot: a.headshot?.href || '',
            link:     a.links?.find(l => (l.rel || []).includes('playercard'))?.href || a.links?.[0]?.href || '',
          });
        }
      }
      if (!idx.size) LOG.warn('no athletes from "roster"');
      this.mem.set(key, idx);
      return idx;
    }

    /** Career stats by category from the ESPN player-page API.
        Each category: labels[] + one row per season + career totals[]. */
    async _fetchAthleteStats(athleteId) {
      const safeId = SEC.safeKey(athleteId);
      const key = `athstat:${safeId}`;
      if (this.mem.has(key)) return this.mem.get(key);
      const url  = `https://site.web.api.espn.com/apis/common/v3/sports/football/college-football/athletes/${safeId}/stats`;
      const data = await this.fetchJson(url);
      const cats = Array.isArray(data?.categories) ? data.categories : [];
      const out  = cats.map(c => ({
        label:   c.displayName || c.name || '',
        cols:    (c.labels || []).slice(0, 6),
        seasons: (c.statistics || []).map(s => ({
          year: s.season?.year,
          team: s.teamSlug || '',
          vals: (s.stats || []).slice(0, 6),
        })).filter(s => s.year),
        totals: (c.totals || []).slice(0, 6),
      })).filter(c => c.cols.length && c.seasons.length);
      const result = out.length ? out : null;
      this.mem.set(key, result);
      return result;
    }

    _ensurePlayerModal() {
      let m = document.getElementById('player-modal');
      if (m) return m;
      m = document.createElement('div');
      m.id = 'player-modal';
      m.style.display = 'none';
      m.innerHTML = `<div class="pm-backdrop"></div>
        <div class="pm-dialog" role="dialog" aria-modal="true" aria-label="Player profile">
          <button class="pm-close" aria-label="Close">&times;</button>
          <div class="pm-body"></div>
        </div>`;
      document.body.appendChild(m);
      const close = () => { m.style.display = 'none'; };
      m.querySelector('.pm-backdrop').addEventListener('click', close);
      m.querySelector('.pm-close').addEventListener('click', close);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      return m;
    }

    async openPlayerModal(p) {
      if (!p) return;
      const m    = this._ensurePlayerModal();
      const body = m.querySelector('.pm-body');
      m.style.display = 'flex';

      // p fields are injected the same way _renderRosterTable does (curated
      // strings or pre-escaped Google Sheets values)
      body.innerHTML = `
        <div class="pm-header">
          <img class="pm-headshot" id="pm-headshot" src="https://a.espncdn.com/i/teamlogos/ncaa/500/84.png" alt="" loading="lazy">
          <div>
            <div class="pm-name"><span class="pm-num">#${p.number}</span>${p.name}</div>
            <div class="pm-sub">${p.pos} &middot; ${p.height} &middot; ${p.weight} &middot; ${p.classYr}</div>
            <div class="pm-sub">${p.hometown}</div>
            <span id="pm-link-slot"></span>
          </div>
        </div>
        <div id="pm-stats" class="pm-note">Looking up ESPN stats&hellip;</div>`;

      try {
        const idx = await this._fetchAthleteIndex();
        const hit = idx?.get(this._normName(p.name));
        const statsEl = document.getElementById('pm-stats');
        if (!hit) {
          if (statsEl) statsEl.textContent = 'No ESPN profile found (only current-roster players are on ESPN).';
          return;
        }

        const shot = SEC.safeImgSrc(hit.headshot || `https://a.espncdn.com/i/headshots/college-football/players/full/${hit.id}.png`, '');
        const img  = document.getElementById('pm-headshot');
        if (img && shot) img.src = shot;

        const link = SEC.safePlayerUrl(hit.link);
        const slot = document.getElementById('pm-link-slot');
        if (slot && link) slot.innerHTML = `<a class="pm-link" href="${SEC.esc(link)}" target="_blank" rel="noopener noreferrer">ESPN Profile</a>`;

        // Career stats by category — one season per row plus career totals
        const cats = await this._fetchAthleteStats(hit.id);
        const teamName = (slug) => slug && slug !== 'indiana-hoosiers'
          ? ` <span class="pm-team-note">(${SEC.esc(slug.replace(/-/g, ' '))})</span>` : '';

        const blocks = (cats || []).map(c => `
          <div class="pm-season"><h4>${SEC.esc(c.label)}</h4>
            <table class="pm-stat-table">
              <thead><tr><th>Season</th>${c.cols.map(l => `<th>${SEC.esc(l)}</th>`).join('')}</tr></thead>
              <tbody>
                ${c.seasons.map(s => `<tr><td>${SEC.esc(String(s.year))}${teamName(s.team)}</td>${s.vals.map(v => `<td>${SEC.esc(String(v))}</td>`).join('')}</tr>`).join('')}
                ${c.totals.length ? `<tr class="pm-career-row"><td>Career</td>${c.totals.map(v => `<td>${SEC.esc(String(v))}</td>`).join('')}</tr>` : ''}
              </tbody>
            </table>
          </div>`).join('');

        if (statsEl) {
          if (blocks) { statsEl.classList.remove('pm-note'); statsEl.innerHTML = blocks; }
          else statsEl.textContent = 'No season stats available for this player.';
        }
      } catch (e) {
        LOG.warn('player modal stats failed', e.message);
        const statsEl = document.getElementById('pm-stats');
        if (statsEl) statsEl.textContent = 'Stats unavailable.';
      }
    }

    /* ---- Hardcoded rosters ---- */
    _hardcodedRoster(year) {
      const R = (num, name, pos, grp, ht, wt, yr, city) =>
        ({ number: num, name, pos, posGroup: grp, height: ht, weight: wt, classYr: yr, hometown: city });
      const QB = 'Quarterbacks', RB = 'Running Backs', WR = 'Wide Receivers',
            TE = 'Tight Ends',  OL = 'Offensive Line', DL = 'Defensive Line',
            ED = 'Defensive Line', LB = 'Linebackers', DB = 'Defensive Backs',
            SP = 'Specialists';

      const r2026 = [
        // ── Quarterbacks ──
        R('10','Josh Hoover',          'QB',QB,`6'2"`, '200 lbs','R-Sr.','Heath, TX'),
        R( '2','Grant Wilson',         'QB',QB,`6'3"`, '218 lbs','Gr.+', 'Arlington, VA'),
        R('15','Tyler Cherry',         'QB',QB,`6'5"`, '220 lbs','R-Fr.','Greenwood, IN'),
        R('12','Jacob Bell',           'QB',QB,`6'2"`, '208 lbs','R-Fr.','Naperville, IL'),
        R('14','Maverick Geske',       'QB',QB,`6'0"`, '187 lbs','R-Fr.','Indianapolis, IN'),
        // ── Running Backs ──
        R('29','Lee Beebe Jr.',        'RB',RB,`5'10"`,'218 lbs','R-Sr.','Montgomery, AL'),
        R( '1','Turbo Richard',        'RB',RB,`5'9"`, '204 lbs','Jr.',  'Charlotte, NC'),
        R('28','Khobie Martin',        'RB',RB,`6'0"`, '204 lbs','R-So.','Fishers, IN'),
        R('20','Sean Cuono',           'RB',RB,`5'10"`,'193 lbs','R-Fr.','Clearwater, FL'),
        R('22','Jayreon Campbell',     'RB',RB,`5'8"`, '205 lbs','Fr.',  'Powder Springs, GA'),
        // ── Wide Receivers ──
        R( '8','Tyler Morris',         'WR',WR,`5'11"`,'186 lbs','R-Sr.','Bolingbrook, IL'),
        R( '7','Shazz Preston',        'WR',WR,`6'0"`, '205 lbs','R-Sr.','Saint James, LA'),
        R('11','Nick Marsh',           'WR',WR,`6'3"`, '213 lbs','Jr.',  'Detroit, MI'),
        R( '4','Davion Chandler',      'WR',WR,`5'11"`,'181 lbs','So.',  'Indianapolis, IN'),
        R( '6','Lebron Bond',          'WR',WR,`5'9"`, '175 lbs','So.',  'Norfolk, VA'),
        R( '3','Kortez Rupert',        'WR',WR,`5'11"`,'163 lbs','Fr.',  'East Saint Louis, IL'),
        R('80','Charlie Becker',       'WR',WR,`6'4"`, '207 lbs','Jr.',  'Nashville, TN'),
        R('82','Myles Kendrick',       'WR',WR,`6'0"`, '190 lbs','R-Fr.','Jacksonville, FL'),
        R('83','Hunter Stroud',        'WR',WR,`6'0"`, '183 lbs','R-Fr.','Martinsville, IN'),
        R('17','Jackson Wasserstrom',  'WR',WR,`5'11"`,'177 lbs','R-Sr.','Westfield, IN'),
        R('26','Cade Kaiser',          'WR',WR,`6'5"`, '214 lbs','R-Fr.','Batesville, IN'),
        R('86','Bruno Massel IV',      'WR',WR,`5'11"`,'196 lbs','R-Fr.','Elmhurst, IL'),
        // ── Tight Ends ──
        R('88','Brock Schott',         'TE',TE,`6'3"`, '241 lbs','R-Fr.','Fort Wayne, IN'),
        R('85','Andrew Barker',        'TE',TE,`6'4"`, '250 lbs','R-Fr.','Kokomo, IN'),
        R('84','Blake Thiry',          'TE',TE,`6'4"`, '236 lbs','R-Fr.','Prairie Du Chien, WI'),
        R('18','Parker Elmore',        'TE',TE,`6'4"`, '239 lbs','Fr.',  'Columbus, IN'),
        R('39','Trevor Gibbs',         'TE',TE,`6'2"`, '241 lbs','Fr.',  'Crown Point, IN'),
        // ── Offensive Line ──
        R('65','Carter Smith',         'OL',OL,`6'5"`, '313 lbs','R-Sr.','Powell, OH'),
        R('62','Drew Evans',           'OL',OL,`6'4"`, '307 lbs','R-Sr.','Fort Atkinson, WI'),
        R('74','Bray Lynch',           'OL',OL,`6'5"`, '298 lbs','R-Sr.','Austin, TX'),
        R('56','Joe Brunner',          'OL',OL,`6'7"`, '313 lbs','R-Sr.','Whitefish Bay, WI'),
        R('72','Adedamola Ajani',      'OL',OL,`6'4"`, '308 lbs','R-So.','Indianapolis, IN'),
        R('71','Ben Novak',            'OL',OL,`6'6"`, '317 lbs','Fr.',  'Crown Point, IN'),
        R('70','Austin Leibfried',     'OL',OL,`6'6"`, '300 lbs','R-So.','Mount Horeb, WI'),
        R('77','Matt Marek',           'OL',OL,`6'3"`, '300 lbs','R-Fr.','Orland Park, IL'),
        R('66','Evan Parker',          'OL',OL,`6'4"`, '299 lbs','R-Fr.','Carmel, IN'),
        R('61','Baylor Wilkin',        'OL',OL,`6'5"`, '289 lbs','R-Fr.','Van Buren, OH'),
        R('75','Sam Simpson',          'OL',OL,`6'3"`, '304 lbs','Fr.',  'River Falls, WI'),
        R('60','CJ Scifres',           'OL',OL,`6'5"`, '312 lbs','Fr.',  'Bargersville, IN'),
        R('64','Chance Johnson',       'OL',OL,`6'5"`, '307 lbs','R-Fr.','Jeffersonville, IN'),
        // ── Defensive Line ──
        R('12','Tobi Osunsanmi',       'DL',DL,`6'2"`, '251 lbs','R-Sr.','Wichita, KS'),
        R( '7','Chiddi Obiazor',       'DL',DL,`6'5"`, '279 lbs','R-Jr.','Eden Prairie, MN'),
        R( '8','Josh Burnham',         'DL',DL,`6'4"`, '255 lbs','R-Sr.','Traverse City, MI'),
        R('17','Daniel Ndukwe',        'DL',DL,`6'3"`, '238 lbs','Jr.',  'Lithonia, GA'),
        R('40','Quentin Clark',        'DL',DL,`6'1"`, '221 lbs','R-So.','Dexter, GA'),
        R('41','Keishaun Calhoun',     'DL',DL,`6'2"`, '265 lbs','R-Fr.','Groveport, OH'),
        R('42','Kevontay Hugan',       'DL',DL,`6'1"`, '227 lbs','Fr.',  'Sarasota, FL'),
        R('50','Jhrevious Hall',       'DL',DL,`6'2"`, '305 lbs','R-Fr.','Columbia, TN'),
        R('55','Rodney White',         'DL',DL,`6'1"`, '296 lbs','Fr.',  'Baltimore, MD'),
        R('90','Joe Hjelle',           'DL',DL,`6'3"`, '318 lbs','R-Sr.','Decorah, IA'),
        R('91','Blake Smythe',         'DL',DL,`6'2"`, '283 lbs','Fr.',  'Trafalgar, IN'),
        R('92','Gabe Hill',            'DL',DL,`6'1"`, '289 lbs','Fr.',  'Naperville, IL'),
        R('94','Kyler Garcia',         'DL',DL,`6'4"`, '291 lbs','R-Fr.','Nashville, TN'),
        R('95','Tyrique Tucker',       'DL',DL,`6'0"`, '307 lbs','R-Sr.','Norfolk, VA'),
        R('96','Triston Abram',        'DL',DL,`6'3"`, '236 lbs','R-Fr.','St. Louis, MO'),
        R('97','Mario Landino',        'DL',DL,`6'4"`, '288 lbs','Jr.',  'Macungie, PA'),
        R('98','Cam McHaney',          'DL',DL,`6'1"`, '286 lbs','Fr.',  'Indianapolis, IN'),
        R('99','Tyrone Burrus Jr.',    'DL',DL,`6'4"`, '245 lbs','R-Fr.','Indianapolis, IN'),
        R('93','Ronelle Johnson',      'DL',DL,`6'3"`, '266 lbs','Fr.',  'Blue Springs, MO'),
        // ── Linebackers ──
        R('46','Isaiah Jones',         'LB',LB,`6'2"`, '225 lbs','R-Sr.','London, OH'),
        R( '5','Rolijah Hardy',        'LB',LB,`5'11"`,'227 lbs','Jr.',  'Lakeland, FL'),
        R('14','Kaiden Turner',        'LB',LB,`6'0"`, '228 lbs','R-Sr.','Fayetteville, AR'),
        R('30','PJ Nelson',            'LB',LB,`6'1"`, '219 lbs','R-Fr.','Cincinnati, OH'),
        R('23','Henry Ohlinger',       'LB',LB,`6'1"`, '224 lbs','Fr.',  'Columbus, OH'),
        R('21','Jacob Savage',         'LB',LB,`6'0"`, '222 lbs','Fr.',  'Union, KY'),
        R('24',"Ja'Dyn Williams",      'LB',LB,`6'1"`, '211 lbs','Fr.',  'Massillon, OH'),
        R('44','Amari Kamara',         'LB',LB,`5'11"`,'202 lbs','R-Fr.','Ashburn, VA'),
        R('34','Jeff Utzinger',        'LB',LB,`6'3"`, '232 lbs','R-Sr.','Carmel, IN'),
        R('38','Kaden McConnell',      'LB',LB,`6'2"`, '228 lbs','R-So.','Greenwood, IN'),
        R('52','Clayton Allen',        'LB',LB,`6'2"`, '209 lbs','R-Jr.','Fishers, IN'),
        // ── Defensive Backs ──
        R( '0','Carson Williams',      'DB',DB,`5'11"`,'181 lbs','R-So.','Houston, TX'),
        R( '1','Amare Ferrell',        'DB',DB,`6'2"`, '205 lbs','Sr.',  'Lake City, FL'),
        R( '2','Byron Baldwin Jr.',    'DB',DB,`6'2"`, '185 lbs','So.',  'Baltimore, MD'),
        R( '3','Jaylen Bell',          'DB',DB,`5'10"`,'169 lbs','So.',  'Union, NJ'),
        R( '4','AJ Harris',            'DB',DB,`6'1"`, '189 lbs','Sr.',  'Phenix City, AL'),
        R( '6','Preston Zachman',      'DB',DB,`6'2"`, '209 lbs','R-Sr.','Elysburg, PA'),
        R( '9','Seaonta Stewart Jr.',  'DB',DB,`6'1"`, '205 lbs','R-Fr.','Cincinnati, OH'),
        R('10','Ryland Gandy',         'DB',DB,`6'0"`, '189 lbs','R-Sr.','Buford, GA'),
        R('13','Quan Sanks',           'DB',DB,`5'10"`,'190 lbs','Jr.',  'Columbus, GA'),
        R('16','Jamar Owens',          'DB',DB,`6'0"`, '172 lbs','Fr.',  'Jonesboro, GA'),
        R('19','Zacharey Smith',       'DB',DB,`5'11"`,'175 lbs','R-Fr.','Union City, GA'),
        R('22','Jamari Sharpe',        'DB',DB,`6'1"`, '188 lbs','R-Sr.','Miami, FL'),
        R('25',"D'Montae Tims",        'DB',DB,`6'0"`, '202 lbs','Fr.',  'Tampa, FL'),
        R('27','Kasmir Hicks',         'DB',DB,`5'11"`,'177 lbs','Fr.',  'Indianapolis, IN'),
        R('31','Anthony Chung',        'DB',DB,`6'1"`, '199 lbs','R-Jr.','Mequon, WI'),
        R('33','Garrett Reese',        'DB',DB,`6'2"`, '205 lbs','So.',  'Chicago, IL'),
        R('36','Clay Conner',          'DB',DB,`6'4"`, '206 lbs','R-Jr.','Boonville, IN'),
        R('37','Heath Kizer',          'DB',DB,`6'1"`, '203 lbs','R-So.','Indianapolis, IN'),
        R('45','Lincoln Murff',        'DB',DB,`5'10"`,'186 lbs','R-Jr.','Indianapolis, IN'),
        // ── Specialists ──
        R('15','Nico Radicic',         'K', SP,`5'11"`,'188 lbs','R-Jr.','Coppell, TX'),
        R('35','Paddy McAteer',        'K', SP,`6'2"`, '205 lbs','R-Sr.','Mullaghbawn, Ireland'),
        R('43','Bryce Taylor',         'K', SP,`5'10"`,'189 lbs','R-Fr.','Bloomington, IN'),
        R('90','Josh Placzek',         'K', SP,`5'11"`,'193 lbs','R-So.','Carmel, IN'),
        R('93','Quinn Warren',         'K', SP,`6'6"`, '214 lbs','Jr.',  'Indianapolis, IN'),
        R('19','Billy Gowers',         'P', SP,`6'2"`, '207 lbs','So.',  'Melbourne, Australia'),
        R('49','Drew Clausen',         'LS',SP,`6'6"`, '250 lbs','Gr.',  'Grimes, IA'),
        R('45','Sam Lindsey',          'LS',SP,`6'0"`, '188 lbs','R-Jr.','Lilburn, GA'),
        R('47','Jackson Tolle',        'LS',SP,`6'0"`, '220 lbs','Fr.',  'Fishers, IN'),
      ];

      const r2025 = [
        // ── Quarterbacks ──
        R('15','Fernando Mendoza',    'QB',QB,`6'5"`, '225 lbs','R-Jr.','Miami, FL'),
        R( '2','Grant Wilson',        'QB',QB,`6'3"`, '220 lbs','R-Sr.+','Arlington, VA'),
        R('16','Alberto Mendoza',     'QB',QB,`6'2"`, '207 lbs','R-Fr.','Miami, FL'),
        R('12','Jacob Bell',          'QB',QB,`6'2"`, '213 lbs','Fr.',  'Naperville, IL'),
        R('14','Maverick Geske',      'QB',QB,`6'0"`, '192 lbs','Fr.',  'Indianapolis, IN'),
        // ── Running Backs ──
        R( '8','Kaelon Black',        'RB',RB,`5'10"`,'211 lbs','R-Sr.','Virginia Beach, VA'),
        R( '1','Roman Hemby',         'RB',RB,`6'0"`, '210 lbs','R-Sr.','Edgewood, MD'),
        R('18','Solomon Vanhorse',    'RB',RB,`5'8"`, '185 lbs','Gr.+', 'Alpharetta, GA'),
        R('29','Lee Beebe Jr.',       'RB',RB,`5'10"`,'218 lbs','R-Jr.','Montgomery, AL'),
        R('28','Khobie Martin',       'RB',RB,`6'0"`, '208 lbs','R-Fr.','Fishers, IN'),
        R('20','Sean Cuono',          'RB',RB,`5'10"`,'198 lbs','Fr.',  'Clearwater, FL'),
        R('30','Kyler Kropp',         'RB',RB,`6'2"`, '209 lbs','R-Fr.','New Palestine, IN'),
        // ── Wide Receivers ──
        R( '0','Jonathan Brady',      'WR',WR,`5'10"`,'183 lbs','Sr.',  'Los Angeles, CA'),
        R( '2','Makai Jackson',       'WR',WR,`6'0"`, '197 lbs','Sr.',  'Levittown, PA'),
        R( '3','Omar Cooper Jr.',     'WR',WR,`6'0"`, '204 lbs','R-Jr.','Indianapolis, IN'),
        R( '7','E.J. Williams Jr.',   'WR',WR,`6'3"`, '205 lbs','R-Sr.+','Phenix City, AL'),
        R( '9','Tyler Morris',        'WR',WR,`5'11"`,'183 lbs','Sr.',  'Bolingbrook, IL'),
        R('13','Elijah Sarratt',      'WR',WR,`6'2"`, '213 lbs','Sr.',  'Stafford, VA'),
        R('17','Jackson Wasserstrom', 'WR',WR,`5'11"`,'175 lbs','R-Jr.','Westfield, IN'),
        R('22','Ace Ciongoli',        'WR',WR,`5'11"`,'169 lbs','Fr.',  'Needham, MA'),
        R('26','Cade Kaiser',         'WR',WR,`6'5"`, '207 lbs','Fr.',  'Batesville, IN'),
        R( '4','Davion Chandler',     'WR',WR,`5'11"`,'180 lbs','Fr.',  'Indianapolis, IN'),
        R( '6','Lebron Bond',         'WR',WR,`5'9"`, '173 lbs','Fr.',  'Norfolk, VA'),
        R('80','Charlie Becker',      'WR',WR,`6'4"`, '209 lbs','So.',  'Nashville, TN'),
        R('82','Myles Kendrick',      'WR',WR,`6'0"`, '190 lbs','Fr.',  'Jacksonville, FL'),
        R('83','Hunter Stroud',       'WR',WR,`6'0"`, '178 lbs','Fr.',  'Martinsville, IN'),
        R('86','Bruno Massel IV',     'WR',WR,`5'11"`,'193 lbs','Fr.',  'Elmhurst, IL'),
        R('89','Camden Jordan',       'WR',WR,`6'0"`, '180 lbs','R-Sr.','Carmel, IN'),
        // ── Tight Ends ──
        R('19','Holden Staes',        'TE',TE,`6'4"`, '250 lbs','Sr.',  'Atlanta, GA'),
        R('37','Riley Nowakowski',    'TE',TE,`6'1"`, '249 lbs','R-Sr.+','Milwaukee, WI'),
        R('48','James Bomba',         'TE',TE,`6'6"`, '252 lbs','R-Sr.','Bloomington, IN'),
        R('84','Blake Thiry',         'TE',TE,`6'4"`, '224 lbs','Fr.',  'Prairie Du Chien, WI'),
        R('85','Andrew Barker',       'TE',TE,`6'4"`, '246 lbs','Fr.',  'Kokomo, IN'),
        // ── Offensive Line ──
        R('54','Jack Greer',          'OL',OL,`6'3"`, '313 lbs','R-Jr.','Fishers, IN'),
        R('56','Chance Johnson',      'OL',OL,`6'5"`, '300 lbs','Fr.',  'Jeffersonville, IN'),
        R('61','Baylor Wilkin',       'OL',OL,`6'5"`, '290 lbs','Fr.',  'Van Buren, OH'),
        R('62','Drew Evans',          'OL',OL,`6'4"`, '309 lbs','R-Jr.','Fort Atkinson, WI'),
        R('63','Mitch Verstegen',     'OL',OL,`6'4"`, '308 lbs','R-Fr.','Kaukauna, WI'),
        R('65','Carter Smith',        'OL',OL,`6'5"`, '313 lbs','R-Jr.','Powell, OH'),
        R('66','Evan Parker',         'OL',OL,`6'4"`, '308 lbs','Fr.',  'Carmel, IN'),
        R('67','Kahlil Benson',       'OL',OL,`6'6"`, '319 lbs','R-Sr.+','Southaven, MS'),
        R('70','Austin Leibfried',    'OL',OL,`6'6"`, '306 lbs','R-Fr.','Mount Horeb, WI'),
        R('71','Evan Lawrence',       'OL',OL,`6'6"`, '306 lbs','R-Fr.','Danville, IN'),
        R('72','Adedamola Ajani',     'OL',OL,`6'4"`, '308 lbs','R-Fr.','Indianapolis, IN'),
        R('74','Bray Lynch',          'OL',OL,`6'5"`, '312 lbs','R-Jr.','Austin, TX'),
        R('75','Zen Michalski',       'OL',OL,`6'6"`, '310 lbs','R-Sr.','Floyds Knobb, IN'),
        R('77','Matt Marek',          'OL',OL,`6'3"`, '308 lbs','Fr.',  'Orland Park, IL'),
        R('78','Pat Coogan',          'OL',OL,`6'5"`, '311 lbs','R-Sr.','Palos Heights, IL'),
        // ── Defensive Line ──
        R( '0','Hosea Wheeler',       'DL',DL,`6'3"`, '298 lbs','R-Sr.','Sacramento, CA'),
        R( '6','Mikail Kamara',       'DL',DL,`6'1"`, '262 lbs','R-Sr.','Ashburn, VA'),
        R( '8','Stephen Daley',       'DL',DL,`6'1"`, '273 lbs','Sr.',  'Winchester, VA'),
        R('13','Kellan Wyatt',        'DL',DL,`6'2"`, '257 lbs','Sr.',  'Glen Burnie, MD'),
        R('17','Daniel Ndukwe',       'DL',DL,`6'3"`, '244 lbs','So.',  'Lithonia, GA'),
        R('18','Andrew Turvy',        'DL',DL,`6'2"`, '253 lbs','R-Sr.','Carmel, IN'),
        R('40','Quentin Clark',       'DL',DL,`6'1"`, '227 lbs','R-Fr.','Dexter, GA'),
        R('41','Keishaun Calhoun',    'DL',DL,`6'2"`, '267 lbs','Fr.',  'Groveport, OH'),
        R('42','Andrew DePaepe',      'DL',DL,`6'5"`, '261 lbs','R-So.','Bettendorf, IA'),
        R('47','Finn Walters',        'DL',DL,`6'4"`, '250 lbs','R-So.','Indianapolis, IN'),
        R('50','Jhrevious Hall',      'DL',DL,`6'2"`, '306 lbs','Fr.',  'Columbia, TN'),
        R('58','Aden Cannon',         'DL',DL,`6'6"`, '268 lbs','R-Jr.','Carmel, IN'),
        R('90','J\'mari Monette',     'DL',DL,`6'3"`, '286 lbs','R-Jr.','Alexandria, LA'),
        R('91','Dominique Ratcliff',  'DL',DL,`6'3"`, '296 lbs','R-Sr.+','Conroe, TX'),
        R('94','Kyler Garcia',        'DL',DL,`6'4"`, '291 lbs','Fr.',  'Nashville, TN'),
        R('95','Tyrique Tucker',      'DL',DL,`6'0"`, '302 lbs','R-Jr.','Norfolk, VA'),
        R('96','Triston Abram',       'DL',DL,`6'3"`, '228 lbs','Fr.',  'St. Louis, MO'),
        R('97','Mario Landino',       'DL',DL,`6'4"`, '284 lbs','So.',  'Macungie, PA'),
        R('98','William DePaepe',     'DL',DL,`6'6"`, '260 lbs','R-Fr.','Moline, IL'),
        // ── Linebackers ──
        R( '4','Aiden Fisher',        'LB',LB,`6'1"`, '231 lbs','Sr.',  'Fredericksburg, VA'),
        R('14','Kaiden Turner',       'LB',LB,`6'0"`, '229 lbs','R-Jr.','Fayetteville, AR'),
        R('21','Rolijah Hardy',       'LB',LB,`5'11"`,'229 lbs','So.',  'Lakeland, FL'),
        R('30','PJ Nelson',           'LB',LB,`6'1"`, '219 lbs','Fr.',  'Cincinnati, OH'),
        R('34','Jeff Utzinger',       'LB',LB,`6'3"`, '232 lbs','R-Jr.','Carmel, IN'),
        R('38','Kaden McConnell',     'LB',LB,`6'2"`, '229 lbs','R-Fr.','Greenwood, IN'),
        R('44','Amari Kamara',        'LB',LB,`5'11"`,'202 lbs','Fr.',  'Ashburn, VA'),
        R('46','Isaiah Jones',        'LB',LB,`6'2"`, '230 lbs','R-Jr.','London, OH'),
        R('52','Clayton Allen',       'LB',LB,`6'2"`, '219 lbs','R-So.','Fishers, IN'),
        // ── Defensive Backs ──
        R( '1','Amare Ferrell',       'DB',DB,`6'2"`, '202 lbs','Jr.',  'Lake City, FL'),
        R( '2','Byron Baldwin Jr.',   'DB',DB,`6'2"`, '194 lbs','Fr.',  'Baltimore, MD'),
        R( '3','Jaylen Bell',         'DB',DB,`5'10"`,'176 lbs','Fr.',  'Union, NJ'),
        R( '5','D\'Angelo Ponds',     'DB',DB,`5'9"`, '173 lbs','Jr.',  'Miami, FL'),
        R( '7','Louis Moore',         'DB',DB,`5'11"`,'200 lbs','R-Sr.+','Mesquite, TX'),
        R( '9','Seaonta Stewart Jr.', 'DB',DB,`6'1"`, '203 lbs','Fr.',  'Cincinnati, OH'),
        R('10','Ryland Gandy',        'DB',DB,`6'0"`, '186 lbs','R-Jr.','Buford, GA'),
        R('12','Devan Boykin',        'DB',DB,`5'10"`,'195 lbs','R-Sr.+','Greensboro, NC'),
        R('16','Jah Jah Boyd',        'DB',DB,`5'11"`,'188 lbs','R-Fr.','Philadelphia, PA'),
        R('19','Zacharey Smith',      'DB',DB,`5'11"`,'170 lbs','Fr.',  'Union City, GA'),
        R('20','Dontrae Henderson',   'DB',DB,`5'11"`,'183 lbs','R-Fr.','Charlotte, NC'),
        R('22','Jamari Sharpe',       'DB',DB,`6'1"`, '187 lbs','R-Jr.','Miami, FL'),
        R('23','Amariyun Knighten',   'DB',DB,`6'0"`, '178 lbs','R-Jr.','Hollywood, FL'),
        R('24','Bryson Bonds',        'DB',DB,`6'0"`, '202 lbs','R-Sr.','Fort Worth, TX'),
        R('27','Reece Bellin',        'DB',DB,`6'1"`, '206 lbs','R-So.','Carmel, IN'),
        R('31','Anthony Chung',       'DB',DB,`6'1"`, '197 lbs','R-So.','Mequon, WI'),
        R('33','Garrett Reese',       'DB',DB,`6'2"`, '203 lbs','Fr.',  'Chicago, IL'),
        R('36','Clay Conner',         'DB',DB,`6'4"`, '207 lbs','R-So.','Boonville, IN'),
        R('37','Heath Kizer',         'DB',DB,`6'1"`, '203 lbs','R-Fr.','Indianapolis, IN'),
        R('45','Lincoln Murff',       'DB',DB,`5'10"`,'184 lbs','R-So.','Indianapolis, IN'),
        // ── Specialists ──
        R('15','Nico Radicic',        'K', SP,`5'11"`,'187 lbs','R-So.','Coppell, TX'),
        R('35','Brendan Franke',      'K', SP,`6'3"`, '233 lbs','R-Sr.+','Gretna, NE'),
        R('43','Bryce Taylor',        'K', SP,`5'10"`,'184 lbs','Fr.',  'Bloomington, IN'),
        R('44','Mitch McCarthy',      'P', SP,`6'5"`, '233 lbs','Sr.',  'Melbourne, Australia'),
        R('45','Sam Lindsey',         'LS',SP,`6'0"`, '190 lbs','R-So.','Lilburn, GA'),
        R('47','Mark Langston',       'LS',SP,`6'0"`, '222 lbs','R-Sr.+','Savannah, GA'),
        R('49','Olubade Baker',       'K', SP,`6'1"`, '207 lbs','R-Sr.','Lawrenceville, GA'),
        R('90','Josh Placzek',        'K', SP,`5'11"`,'199 lbs','R-Fr.','Carmel, IN'),
        R('93','Quinn Warren',        'K', SP,`6'6"`, '223 lbs','So.',  'Indianapolis, IN'),
      ];
      const r2024 = [
        // ── Quarterbacks ──
        R( '9','Kurtis Rourke',         'QB',QB,`6'5"`, '223 lbs','R-Sr.+','Oakville, ON'),
        R( '2','Tayven Jackson',         'QB',QB,`6'4"`, '212 lbs','R-So.', 'Greenwood, IN'),
        R('12','Roman Purcell',          'QB',QB,`6'1"`, '214 lbs','R-Jr.', 'Bedminster, NJ'),
        R('15','Tyler Cherry',           'QB',QB,`6'5"`, '219 lbs','Fr.',   'Greenwood, IN'),
        R('16','Alberto Mendoza',        'QB',QB,`6'2"`, '203 lbs','Fr.',   'Miami, FL'),
        // ── Running Backs ──
        R( '8','Kaelon Black',           'RB',RB,`5'10"`,'210 lbs','R-Jr.', 'Virginia Beach, VA'),
        R( '6','Justice Ellison',        'RB',RB,`5'9"`, '210 lbs','Sr.+',  'Ashburn, VA'),
        R('17','Ty Son Lawton',          'RB',RB,`5'9"`, '208 lbs','R-Sr.+','Staten Island, NY'),
        R('18','Solomon Vanhorse',       'RB',RB,`5'8"`, '185 lbs','Gr.+',  'Alpharetta, GA'),
        R('21','Elijah Green',           'RB',RB,`6'0"`, '207 lbs','R-Jr.', 'Roswell, GA'),
        R('25','Daniel Weems',           'RB',RB,`5'9"`, '197 lbs','R-So.', 'Greenwood, IN'),
        R('28','Khobie Martin',          'RB',RB,`6'0"`, '207 lbs','Fr.',   'Fishers, IN'),
        R('30','Kyler Kropp',            'RB',RB,`6'2"`, '194 lbs','Fr.',   'New Palestine, IN'),
        // ── Wide Receivers ──
        R( '0','Coby Andison',           'WR',WR,`6'1"`, '178 lbs','Sr.+',  'Fort Lauderdale, FL'),
        R( '1','Donaven McCulley',       'WR',WR,`6'5"`, '203 lbs','Sr.',   'Indianapolis, IN'),
        R( '3','Omar Cooper Jr.',        'WR',WR,`6'0"`, '201 lbs','R-So.', 'Indianapolis, IN'),
        R( '4','Myles Price',            'WR',WR,`5'9"`, '183 lbs','Sr.+',  'Dallas, TX'),
        R( '5',"Ke'Shawn Williams",      'WR',WR,`5'9"`, '189 lbs','Sr.+',  'Philadelphia, PA'),
        R( '7','E.J. Williams Jr.',      'WR',WR,`6'4"`, '203 lbs','Sr.+',  'Phenix City, AL'),
        R('13','Elijah Sarratt',         'WR',WR,`6'2"`, '209 lbs','Jr.',   'Stafford, VA'),
        R('14','Derin McCulley',         'WR',WR,`6'1"`, '176 lbs','R-Sr.', 'Indianapolis, IN'),
        R('19','Miles Cross',            'WR',WR,`5'11"`,'210 lbs','Sr.',   'Bowie, MD'),
        R('24','Jackson Wasserstrom',    'WR',WR,`5'11"`,'175 lbs','R-So.', 'Westfield, IN'),
        R('80','Charlie Becker',         'WR',WR,`6'4"`, '204 lbs','Fr.',   'Nashville, TN'),
        R('81','Brady Simmons',          'WR',WR,`6'1"`, '173 lbs','R-So.', 'Indianapolis, IN'),
        R('83','Eli Jochem',             'WR',WR,`6'1"`, '190 lbs','R-Jr.', 'Gibsonia, PA'),
        R('89','Camden Jordan',          'WR',WR,`6'0"`, '180 lbs','R-Jr.', 'Carmel, IN'),
        // ── Tight Ends ──
        R('44','Zach Horton',            'TE',TE,`6'4"`, '252 lbs','Sr.',   'Roanoke, VA'),
        R('45','Trey Walker',            'TE',TE,`6'6"`, '253 lbs','R-Sr.+','Winnetka, IL'),
        R('48','James Bomba',            'TE',TE,`6'6"`, '253 lbs','R-Jr.', 'Bloomington, IN'),
        R('82','Brody Kosin',            'TE',TE,`6'6"`, '234 lbs','Fr.',   'Davisburg, MI'),
        R('86','Brody Foley',            'TE',TE,`6'6"`, '255 lbs','R-So.', 'Cincinnati, OH'),
        R('88','Sam West',               'TE',TE,`6'4"`, '246 lbs','R-Fr.', 'Greensburg, IN'),
        // ── Offensive Line ──
        R('53','Vince Fiacable',         'OL',OL,`6'4"`, '315 lbs','R-Jr.', 'Fort Wayne, IN'),
        R('54','Jack Greer',             'OL',OL,`6'3"`, '311 lbs','R-So.', 'Fishers, IN'),
        R('55','Nick Kidwell',           'OL',OL,`6'5"`, '316 lbs','R-Sr.+','Knoxville, MD'),
        R('56','Mike Katic',             'OL',OL,`6'4"`, '318 lbs','R-Sr.+','Pittsburgh, PA'),
        R('62','Drew Evans',             'OL',OL,`6'4"`, '306 lbs','R-So.', 'Fort Atkinson, WI'),
        R('63','Mitch Verstegen',        'OL',OL,`6'4"`, '290 lbs','Fr.',   'Kaukauna, WI'),
        R('65','Carter Smith',           'OL',OL,`6'5"`, '308 lbs','R-So.', 'Powell, OH'),
        R('70','Austin Leibfried',       'OL',OL,`6'6"`, '288 lbs','Fr.',   'Mount Horeb, WI'),
        R('71','Evan Lawrence',          'OL',OL,`6'6"`, '281 lbs','Fr.',   'Danville, IN'),
        R('72','Adedamola Ajani',        'OL',OL,`6'4"`, '301 lbs','Fr.',   'Indianapolis, IN'),
        R('73','Austin Barrett',         'OL',OL,`6'6"`, '308 lbs','R-Fr.', 'Bloomingdale, IL'),
        R('74','Bray Lynch',             'OL',OL,`6'5"`, '307 lbs','R-So.', 'Austin, TX'),
        R('75','Trey Wedig',             'OL',OL,`6'7"`, '319 lbs','R-Sr.', 'Oconomowoc, WI'),
        R('77','Tyler Stephens',         'OL',OL,`6'5"`, '311 lbs','Sr.+',  'Virginia Beach, VA'),
        R('78','Cooper Jones',           'OL',OL,`6'5"`, '314 lbs','R-Jr.', 'Valparaiso, IN'),
        R('79','Max Williams',           'OL',OL,`6'6"`, '314 lbs','R-So.', 'Lebanon, IN'),
        // ── Defensive Line ──
        R( '6','Mikail Kamara',          'DL',DL,`6'1"`, '265 lbs','R-Jr.', 'Ashburn, VA'),
        R( '7','Jacob Mangum-Farrar',    'DL',DL,`6'5"`, '256 lbs','Gr.+',  'Sugar Land, TX'),
        R( '8','CJ West',                'DL',DL,`6'2"`, '317 lbs','R-Sr.', 'Chicago, IL'),
        R('18','Andrew Turvy',           'DL',DL,`6'2"`, '252 lbs','R-Jr.', 'Carmel, IN'),
        R('41','Lanell Carr Jr.',        'DL',DL,`6'2"`, '246 lbs','Sr.+',  'St. Louis, MO'),
        R('42','Andrew DePaepe',         'DL',DL,`6'5"`, '260 lbs','R-Fr.', 'Bettendorf, IA'),
        R('47','Finn Walters',           'DL',DL,`6'4"`, '247 lbs','R-Fr.', 'Indianapolis, IN'),
        R('49',"Ta'Derius Collins",      'DL',DL,`6'4"`, '250 lbs','R-Fr.', 'Shreveport, LA'),
        R('54','Caleb King',             'DL',DL,`6'5"`, '277 lbs','Fr.',   'Georgetown, IN'),
        R('55','Venson Sneed Jr.',       'DL',DL,`6'4"`, '266 lbs','R-So.', 'Wabasso, FL'),
        R('58','Aden Cannon',            'DL',DL,`6'6"`, '268 lbs','R-So.', 'Carmel, IN'),
        R('64','Race Stewart',           'DL',DL,`6'3"`, '302 lbs','R-Jr.', 'Bloomington, IN'),
        R('90',"J'mari Monette",         'DL',DL,`6'3"`, '285 lbs','R-So.', 'Alexandria, LA'),
        R('91','Daniel Ndukwe',          'DL',DL,`6'3"`, '239 lbs','Fr.',   'Lithonia, GA'),
        R('92','Marcus Burris Jr.',      'DL',DL,`6'5"`, '286 lbs','R-Jr.', 'Texarkana, TX'),
        R('93','Robby Harrison',         'DL',DL,`6'4"`, '298 lbs','R-So.', 'Greenwood, SC'),
        // ── Linebackers ──
        R( '2','Jailin Walker',          'LB',LB,`6'1"`, '218 lbs','Sr.',   'Richmond, VA'),
        R( '4','Aiden Fisher',           'LB',LB,`6'1"`, '233 lbs','Jr.',   'Fredericksburg, VA'),
        R('14','Kaiden Turner',          'LB',LB,`6'0"`, '228 lbs','R-So.', 'Fayetteville, AR'),
        R('21','Rolijah Hardy',          'LB',LB,`5'11"`,'225 lbs','Fr.',   'Lakeland, FL'),
        R('33','Nahji Logan',            'LB',LB,`6'3"`, '226 lbs','R-Sr.', 'Yeadon, PA'),
        R('34','Jeff Utzinger',          'LB',LB,`6'3"`, '230 lbs','R-So.', 'Carmel, IN'),
        R('38','Kaden McConnell',        'LB',LB,`6'2"`, '222 lbs','Fr.',   'Greenwood, IN'),
        R('39','Carter Imes',            'LB',LB,`6'0"`, '196 lbs','Fr.',   'Fishers, IN'),
        R('40','Quentin Clark',          'LB',LB,`6'1"`, '212 lbs','Fr.',   'Dexter, GA'),
        R('46','Isaiah Jones',           'LB',LB,`6'2"`, '230 lbs','R-So.', 'London, OH'),
        R('52','Clayton Allen',          'LB',LB,`6'2"`, '215 lbs','R-Fr.', 'Fishers, IN'),
        // ── Defensive Backs ──
        R( '0','Josh Philostin',         'DB',DB,`5'10"`,'180 lbs','Fr.',   'Palm Beach, FL'),
        R( '1','Shawn Asbury II',        'DB',DB,`5'10"`,'199 lbs','Sr.',   'Stafford, VA'),
        R( '3','JoJo Johnson',           'DB',DB,`6'0"`, '184 lbs','R-Jr.', 'Merrillville, IN'),
        R( '5',"D'Angelo Ponds",         'DB',DB,`5'9"`, '170 lbs','So.',   'Miami, FL'),
        R( '9','Jamier Johnson',         'DB',DB,`5'11"`,'181 lbs','R-Jr.', 'Pasadena, CA'),
        R('10','DJ Warnell Jr.',         'DB',DB,`6'3"`, '200 lbs','Sr.+',  'La Marque, TX'),
        R('12','Terry Jones Jr.',        'DB',DB,`6'1"`, '200 lbs','R-Sr.', 'Baltimore, MD'),
        R('13','Cedarius Doss',          'DB',DB,`5'8"`, '179 lbs','R-Sr.+','Birmingham, AL'),
        R('15','Nic Toomer',             'DB',DB,`6'2"`, '199 lbs','R-Sr.', 'Tyrone, GA'),
        R('16','Jah Jah Boyd',           'DB',DB,`5'11"`,'173 lbs','Fr.',   'Philadelphia, PA'),
        R('17','Tyrik McDaniel',         'DB',DB,`6'0"`, '195 lbs','R-Sr.', 'Columbia, SC'),
        R('19','Josh Sanguinetti',       'DB',DB,`6'1"`, '194 lbs','R-Sr.+','Lauderdale Lakes, FL'),
        R('20','Dontrae Henderson',      'DB',DB,`5'11"`,'180 lbs','Fr.',   'Charlotte, NC'),
        R('22','Jamari Sharpe',          'DB',DB,`6'1"`, '187 lbs','R-So.', 'Miami, FL'),
        R('24','Bryson Bonds',           'DB',DB,`6'0"`, '199 lbs','R-Jr.', 'Fort Worth, TX'),
        R('25','Amare Ferrell',          'DB',DB,`6'2"`, '200 lbs','So.',   'Lake City, FL'),
        R('27','Reece Bellin',           'DB',DB,`6'1"`, '200 lbs','R-Fr.', 'Carmel, IN'),
        R('28','Jaz Boykin',             'DB',DB,`6'0"`, '178 lbs','R-Fr.', 'Fishers, IN'),
        R('29','Luke Haupert',           'DB',DB,`6'0"`, '178 lbs','R-Fr.', 'Fort Wayne, IN'),
        R('31','Anthony Chung',          'DB',DB,`6'1"`, '193 lbs','R-Fr.', 'Mequon, WI'),
        R('36','Clay Conner',            'DB',DB,`6'4"`, '209 lbs','R-Fr.', 'Boonville, IN'),
        R('37','Heath Kizer',            'DB',DB,`6'1"`, '202 lbs','Fr.',   'Indianapolis, IN'),
        R('45','Lincoln Murff',          'DB',DB,`5'10"`,'180 lbs','R-Fr.', 'Indianapolis, IN'),
        // ── Specialists ──
        R('39','Nico Radicic',           'K', SP,`5'11"`,'193 lbs','R-Fr.', 'Coppell, TX'),
        R('43','Derek McCormick',        'K', SP,`6'3"`, '210 lbs','R-Sr.', 'Port Charlotte, FL'),
        R('47','Mark Langston',          'LS',SP,`6'0"`, '225 lbs','R-Sr.+','Savannah, GA'),
        R('90','Josh Placzek',           'K', SP,`5'11"`,'201 lbs','Fr.',   'Carmel, IN'),
        R('93','Quinn Warren',           'K', SP,`6'6"`, '222 lbs','Fr.',   'Indianapolis, IN'),
        R('94','James Evans',            'P', SP,`6'1"`, '217 lbs','Sr.',   'Auckland, NZ'),
      ];

      if (year === 2026) return r2026;
      if (year === 2025) return r2025;
      return r2024;
    }

    renderOffense(container, data) {
      container.innerHTML = `
        <div class="formation">
          <div class="formation-line skill-positions">
            ${['X-WR','SL-WR','Z-WR'].map(p => `<div class="position-group"><h4>${p}</h4>${this.playersHtml(data[p])}</div>`).join('')}
          </div>
          <div class="formation-line backfield">
            ${['QB','HB','TE'].map(p => `<div class="position-group"><h4>${p}</h4>${this.playersHtml(data[p])}</div>`).join('')}
          </div>
          <div class="formation-line offensive-line">
            ${['LT','LG','C','RG','RT'].map(p => `<div class="position-group"><h4>${p}</h4>${this.playersHtml(data[p])}</div>`).join('')}
          </div>
        </div>`;
    }

    renderDefense(container, data) {
      const keys = Object.keys(data);
      const line  = keys.filter(k => k.includes('DT') || k.includes('DE') || k === 'STUD');
      const lbs   = keys.filter(k => k.includes('LB') || k === 'Rover');
      const sec   = keys.filter(k => k.includes('CB') || k.includes('SS') || k.includes('FS') || k === 'NB');
      container.innerHTML = `
        <div class="formation">
          <div class="formation-line defensive-line">${line.map(p => `<div class="position-group"><h4>${p}</h4>${this.playersHtml(data[p])}</div>`).join('')}</div>
          <div class="formation-line linebackers">${lbs.map(p => `<div class="position-group"><h4>${p}</h4>${this.playersHtml(data[p])}</div>`).join('')}</div>
          <div class="formation-line secondary">${sec.map(p => `<div class="position-group"><h4>${p}</h4>${this.playersHtml(data[p])}</div>`).join('')}</div>
        </div>`;
    }

    renderSpecial(container, data) {
      container.innerHTML = `
        <div class="formation special-teams">
          <div class="formation-line">
            ${Object.keys(data).map(p => `<div class="position-group"><h4>${p}</h4>${this.playersHtml(data[p])}</div>`).join('')}
          </div>
        </div>`;
    }

    playersHtml(arr) {
      if (!arr || !arr.length) return `<div class="depth-player backup"><span class="depth-name">No players listed</span></div>`;
      return arr.map((n, i) => {
        const safeName = SEC.esc(String(n));
        return `<div class="depth-player ${i === 0 ? 'starter' : 'backup'}"><span class="depth-name">${safeName}</span></div>`;
      }).join('');
    }

    /* ============================================================
       EVENT LISTENERS + INIT
    ============================================================ */
    async switchTab(tab) {
      const btn = document.querySelector(`.nav-btn[data-tab="${SEC.safeKey(tab)}"]`);
      if (!btn) return;

      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      document.getElementById(`${tab}-tab`)?.classList.add('active');

      LOG.load(`Tab switched to: ${tab}`);
      if (tab === 'current') {
        await Promise.all([this.loadTeamInfo(), this.loadRecordSplit(), this.loadNextGame(), this.loadRecentGames(), this.loadTeamStats(), this.loadStandings(), this.loadRankings(), this.loadNews()]);
      } else if (tab === 'schedule') {
        await this.loadSchedule(this.currentYear);
      } else if (tab === 'roster') {
        await this.loadRoster();
      } else if (tab === 'scores') {
        await this.loadScoresTab();
      } else if (tab === 'history') {
        await this.loadHistory();
      }
    }

    setupListeners() {
      // Clicks route through the URL hash so tabs are linkable and
      // back/forward works; re-clicking the active tab reloads it directly
      document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const tab = btn.dataset.tab;
          if (location.hash !== `#${tab}`) location.hash = tab;
          else await this.switchTab(tab);
        });
      });
      window.addEventListener('hashchange', () => {
        const tab = location.hash.slice(1);
        if (['current', 'schedule', 'roster', 'scores', 'history'].includes(tab)) this.switchTab(tab);
      });

      // Theme toggle — stored preference wins, otherwise follow the OS
      const themeBtn = document.getElementById('theme-toggle');
      let dark;
      try {
        const saved = localStorage.getItem('iufb:theme');
        dark = saved ? saved === 'dark'
             : (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      } catch { dark = false; }
      const applyTheme = () => {
        document.body.classList.toggle('dark', dark);
        if (themeBtn) {
          themeBtn.textContent = dark ? 'Light' : 'Dark';
          themeBtn.setAttribute('aria-pressed', String(dark));
        }
      };
      if (themeBtn) themeBtn.addEventListener('click', () => {
        dark = !dark;
        try { localStorage.setItem('iufb:theme', dark ? 'dark' : 'light'); } catch {}
        LOG.info(`theme ${dark ? 'dark' : 'light'}`);
        applyTheme();
      });
      applyTheme();

      document.querySelectorAll('.scores-chip').forEach((chip) => {
        chip.addEventListener('click', async () => {
          document.querySelectorAll('.scores-chip').forEach(x => x.classList.remove('active'));
          chip.classList.add('active');
          this._scoresFilter = chip.dataset.filter;
          await this.loadScoresTab();
        });
      });

      if (this.dom.seasonSelect) {
        this.dom.seasonSelect.innerHTML = this.availableYears
          .map(y => `<option value="${y}" ${y === this.currentYear ? 'selected' : ''}>${y}</option>`)
          .join('');
        this.dom.seasonSelect.addEventListener('change', async (e) => {
          this.currentYear = parseInt(e.target.value, 10);
          await this.loadSchedule(this.currentYear);
        });
      }
    }

    async init() {
      this.setupListeners();
      this.initTicker();

      // Deep link: #roster etc. opens that tab; current-season data still
      // loads below so the header and cards are populated when they return
      const hash = location.hash.slice(1);
      if (['schedule', 'roster', 'scores', 'history'].includes(hash)) this.switchTab(hash);

      this.showLoading();
      LOG.info('Initializing — loading current season data');
      try {
        await Promise.all([
          this.loadTeamInfo(),
          this.loadRecordSplit(),
          this.loadNextGame(),
          this.loadRecentGames(),
          this.loadTeamStats(),
          this.loadStandings(),
          this.loadRankings(),
          this.loadNews(),
        ]);
        LOG.info('Initialization complete');
      } catch (e) {
        LOG.error('Initialization failed', e.message);
      } finally {
        this.hideLoading();
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // PWA: shell caching + installability (secure contexts only)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(() => LOG.info('service worker registered'))
        .catch(e => LOG.warn('service worker failed', e.message));
    }

    // Footer last-updated timestamp (avoids inline script in HTML)
    const footerEl = document.getElementById('footer-updated');
    if (footerEl) {
      const d = new Date(document.lastModified);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      footerEl.textContent = 'Last updated: ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    } new IndianaFootball(); });

})();
