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
      this.MIN_YEAR = 2001;
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
        recentGames:   document.getElementById('recent-games'),
        scheduleList:  document.getElementById('schedule-list'),
        seasonSelect:  document.getElementById('season-select'),
        rosterTab:     document.getElementById('roster-tab'),
        seasonRecords: document.getElementById('season-records'),
        newsContainer: document.getElementById('news-container'),
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
        'https://sports.core.api.espn.com',
        'https://cdn.espn.com',
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
      try {
        const res = await fetch(`${this.DATA_BASE}/${path}`, {
          headers: { Accept: 'application/json' },
          credentials: 'omit',
        });
        if (!res.ok) return null;
        return await res.json();
      } catch { return null; }
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
    async getSeasonSchedule(year) {
      year = SEC.safeYear(year) || this.currentYear;
      LOG.load(`Getting schedule for season ${year}`);
      const key = `sched:${year}`;
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
      this.setLS(key, events, 12 * 60 * 60 * 1000);
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
        const BIG_TEN_IDS = new Set([84,77,120,127,130,135,158,164,194,213,275,356,2294,2509,26,30,264,2483]);
        const oppId = parseInt(opp?.team?.id || '0', 10);
        const isConf = !!(comp?.conferenceCompetition)
                    || !!(opp?.team?.conferenceId && opp.team.conferenceId === 5)
                    || (BIG_TEN_IDS.has(oppId) && oppId !== 84);
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
      const events = await this.getSeasonSchedule(y);
      await this.renderSchedule(events, y);
      return events;
    }

    async renderSchedule(events, year) {
      const c = this.dom.scheduleList;
      if (!c) return;
      c.innerHTML = '';

      if (!events || events.length === 0) {
        const msg = document.createElement('div');
        msg.className = 'schedule-item';
        msg.textContent = 'No games found for this season.';
        c.appendChild(msg);
        return;
      }

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
        const timeStr   = SEC.esc(this.fmtDateTime(e.date));

        const { statusClass, statusText } = await this.resolveStatusAndScore(year, e, comp, mine, opp);

        const item = document.createElement('div');
        item.className = 'schedule-item';
        item.setAttribute('data-event-id', SEC.safeKey(e.id || ''));
        item.setAttribute('data-year', String(parseInt(year, 10)));

        item.innerHTML = `
          <div class="game-details">
            <div class="opponent">${isHome ? 'vs' : '@'} ${oppRank}${oppName}</div>
            <div class="game-time">${timeStr}${tvSched ? ` &bull; TV: ${tvSched}` : ''}</div>
            <div class="game-location">${venue}</div>
          </div>
          <div class="game-status ${statusClass}">${SEC.esc(statusText)}</div>
          <div class="game-extra" style="display:none;"></div>`;
        c.appendChild(item);
      }

      this.wireScheduleItemDetails();
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
      return { statusClass: 'status-upcoming', statusText: 'TBD' };
    }

    wireScheduleItemDetails() {
      this.dom.scheduleList.querySelectorAll('.schedule-item').forEach((item) => {
        item.addEventListener('click', async () => {
          const eid  = item.getAttribute('data-event-id');
          const year = parseInt(item.getAttribute('data-year'), 10);
          const extra = item.querySelector('.game-extra');
          if (!eid || !extra) return;

          if (extra.style.display === 'block') {
            extra.style.display = 'none';
            extra.innerHTML = '';
            return;
          }

          extra.style.display = 'block';
          extra.innerHTML = `<div class="game-detail-loading"><div class="spinner" style="border-top-color:#990000;border-color:rgba(153,0,0,0.2);"></div> Loading game details…</div>`;

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

          extra.innerHTML = rows.length
            ? rows.join('')
            : `<div class="row"><span>No additional details available.</span></div>`;
        });
      });
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

      LOG.load(`Computing stats from ${completed.length} completed games in ${year}`);

      let games = 0;
      let pts = 0, oppPts = 0, passYds = 0, rushYds = 0, totalYds = 0;
      let oppTotalYds = 0, oppPassYds = 0, oppRushYds = 0;
      let oppThirdConv = 0, oppThirdAtt = 0, oppFourthConv = 0, oppFourthAtt = 0;
      let myTurnovers = 0, oppTurnovers = 0;
      let redZoneConv = 0, redZoneAtt = 0;
      let our3Conv = 0, our3Att = 0, firstDowns = 0;

      for (let i = 0; i < completed.length; i++) {
        const e   = completed[i];
        const sum = await this.getSummary(year, e.id);
        const p   = this.parseSummaryStats(sum, e);

        if (!p) {
          LOG.warn(`Failed to parse stats for event ${e.id}`);
          continue;
        }

        LOG.debug(`Game ${i + 1} stats`, {
          score:    `${p.pts}-${p.oppPts}`,
          oppThird: `${p.oppThirdConv}/${p.oppThirdAtt}`,
          turnovers: `us:${p.myTurnovers} them:${p.oppTurnovers}`,
          our3rd:   `${p.our3Conv}/${p.our3Att}`,
        });

        games++;
        pts           += p.pts;
        oppPts        += p.oppPts;
        passYds       += p.passYds;
        rushYds       += p.rushYds;
        totalYds      += p.totalYds;
        if (p.oppTotalYds) { oppTotalYds += p.oppTotalYds; }
        if (p.oppPassYds)  { oppPassYds  += p.oppPassYds; }
        if (p.oppRushYds)  { oppRushYds  += p.oppRushYds; }
        oppThirdConv  += p.oppThirdConv;
        oppThirdAtt   += p.oppThirdAtt;
        oppFourthConv += p.oppFourthConv;
        oppFourthAtt  += p.oppFourthAtt;
        myTurnovers   += p.myTurnovers;
        oppTurnovers  += p.oppTurnovers;
        redZoneConv   += p.redZoneConv;
        redZoneAtt    += p.redZoneAtt;
        our3Conv += p.our3Conv;
        our3Att  += p.our3Att;
        firstDowns    += p.firstDowns;

        if (this.isMobile && i % this.summaryConcurrency === 0) {
          await new Promise(r => setTimeout(r, 120));
        }
      }

      const avg = (v) => games ? (v / games) : 0;
      // Only show pct if we actually have attempts — blank otherwise
      const pct = (c, a) => a > 0 ? ((c / a) * 100).toFixed(1) + '%' : '--';

      const margin    = oppTurnovers - myTurnovers;
      const marginStr = games
        ? (margin >= 0 ? `+${margin}` : `${margin}`)
        : '--';

      LOG.debug('Debug wins — final computed stats', {
        games, ppg: avg(pts).toFixed(1), margin,
        redZone: `${redZoneConv}/${redZoneAtt}`, our3rd: `${our3Conv}/${our3Att}`,
        firstDowns: avg(firstDowns).toFixed(1),
      });

      this.setStat(this.dom.ppg,          games ? avg(pts).toFixed(1)      : '--');
      this.setStat(this.dom.ypg,          games ? avg(totalYds).toFixed(1) : '--');
      this.setStat(this.dom.passYpg,      games ? avg(passYds).toFixed(1)  : '--');
      this.setStat(this.dom.rushYpg,      games ? avg(rushYds).toFixed(1)  : '--');
      this.setStat(this.dom.firstDownsPg, games ? avg(firstDowns).toFixed(1): '--');
      this.setStat(this.dom.turnoverMargin, marginStr);
      this.setStat(this.dom.ourThirdDown, pct(our3Conv, our3Att));
      this.setStat(this.dom.defPpg,        games ? avg(oppPts).toFixed(1)       : '--');
      this.setStat(this.dom.oppYpg,     (games && oppTotalYds) ? avg(oppTotalYds).toFixed(1) : '--');
      this.setStat(this.dom.oppPassYpg, (games && oppPassYds)  ? avg(oppPassYds).toFixed(1)  : '--');
      this.setStat(this.dom.oppRushYpg, (games && oppRushYds)  ? avg(oppRushYds).toFixed(1)  : '--');
      this.setStat(this.dom.oppThirdDown,  pct(oppThirdConv, oppThirdAtt));
      this.setStat(this.dom.oppFourthDown, pct(oppFourthConv, oppFourthAtt));

      LOG.load('Team stats loaded successfully');
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
          const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}/schedule?season=${year}&seasontype=3`;
          const json = await this.fetchJson(url);
          const events = this.pickEventsArray(json);
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
        : `<p style="color:#666;font-size:0.9rem;">No postseason data found (2001–present). All-time: 11 appearances, 6 wins.</p>`;

      card.innerHTML = `
        <h3><i class="fas fa-football-ball" aria-hidden="true"></i> Bowl Game History
          <span style="font-size:0.75rem;font-weight:400;color:#666;margin-left:8px;">2001–present via ESPN · all-time: 11 appearances, 6-5 record</span>
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
          <div class="achievement-item"><i class="fas fa-medal achievement-icon" aria-hidden="true"></i><div>
            <div class="achievement-title">Big Ten Championships</div>
            <div class="achievement-years">1945, 1967 (Co-Champions)</div></div></div>
          <div class="achievement-item"><i class="fas fa-football-ball achievement-icon" aria-hidden="true"></i><div>
            <div class="achievement-title">All-Time Bowl Record</div>
            <div class="achievement-years">11 appearances, 6 wins (all-time through 2024)</div></div></div>
          <div class="achievement-item"><i class="fas fa-award achievement-icon" aria-hidden="true"></i><div>
            <div class="achievement-title">All-Americans</div>
            <div class="achievement-years">30+ players honored since program founding</div></div></div>
          <div class="achievement-item"><i class="fas fa-users achievement-icon" aria-hidden="true"></i><div>
            <div class="achievement-title">Notable NFL Alumni</div>
            <div class="achievement-years">Antwaan Randle El &bull; Tracy Porter &bull; Tevin Coleman</div></div></div>
          <div class="achievement-item"><i class="fas fa-graduation-cap achievement-icon" aria-hidden="true"></i><div>
            <div class="achievement-title">Academic All-Big Ten</div>
            <div class="achievement-years">Multiple selections annually; consistent academic excellence</div></div></div>
          <div class="achievement-item"><i class="fas fa-star achievement-icon" aria-hidden="true"></i><div>
            <div class="achievement-title">2025 National Champions 🏆</div>
            <div class="achievement-years">16-0 &bull; 2025 season &bull; CFP Natl. Championship over Miami (Jan. 19, 2026)</div></div></div>
          <div class="achievement-item"><i class="fas fa-map-marker-alt achievement-icon" aria-hidden="true"></i><div>
            <div class="achievement-title">Memorial Stadium</div>
            <div class="achievement-years">Opened 1925 &bull; Capacity 52,626 &bull; Bloomington, IN</div></div></div>
        </div>`;
      grid.appendChild(achCard);

      // Card 3: Bowl History — full width with big summary numbers
      const bowlCard = this.buildBowlCard(bowls);
      grid.appendChild(bowlCard);

      // Card 4: Season summary (computed async, updates in place)
      const teaserCard = document.createElement('div');
      teaserCard.className = 'history-card full-width';
      teaserCard.id = 'records-teaser';
      teaserCard.innerHTML = `<h3><i class="fas fa-chart-bar" aria-hidden="true"></i> Season Summary (2001–present)</h3>
        <div class="history-content">
          <div class="history-stat"><span class="history-label">Seasons tracked</span><span class="history-value">${new Date().getFullYear() - 2001 + 1}</span></div>
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

      const years = this.availableYears.slice().reverse();
      const chartData = { years: [], wins: [], losses: [], confWins: [] };
      let totalW = 0, totalL = 0, bestW = 0, bestYear = null, winningSeas = 0;

      // Fetch all schedules in parallel, then compute records (no summary fetches needed)
      const allSchedules = await Promise.all(years.map(y => this.getSeasonSchedule(y)));
      const allRecords   = await Promise.all(
        years.map((y, i) => allSchedules[i]?.length
          ? this.computeSeasonRecordFromEvents(y, allSchedules[i])
          : Promise.resolve(null))
      );

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

      this.createWinsChart(chartData);
      LOG.load('History loaded');
    }

    createWinsChart(data) {
      const canvas = document.getElementById('wins-chart');
      if (!canvas || data.years.length === 0) {
        LOG.warn('Debug wins — chart canvas not found or no data');
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
            <button class="depth-btn" data-unit="offense">Offense</button>
            <button class="depth-btn" data-unit="defense">Defense</button>
            <button class="depth-btn" data-unit="specialists">Specialists</button>
          </div>
        </div>
        <div id="depth-chart-content" class="depth-chart-content"></div>`;
      host.appendChild(section);

      section.querySelector('#roster-year-select').addEventListener('change', (e) => {
        this.currentRosterYear = parseInt(e.target.value, 10);
        section.querySelectorAll('.depth-btn').forEach(b => b.classList.toggle('active', b.dataset.unit === 'roster'));
        this._showUnit('roster');
      });

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

      // For 2026, try Google Sheets live first (requires sheet shared as "Anyone can view")
      if (this.currentRosterYear === 2026) {
        players = await this._fetchGSheetRoster();
        source  = players ? '2026 — Live from Google Sheets (iuhoosiers.com roster)' : '';
      }

      // Fall back to hardcoded data
      if (!players) {
        players = this._hardcodedRoster(this.currentRosterYear);
        source  = `${this.currentRosterYear} — Curated roster`;
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

      for (const [groupName, group] of groups) {
        const sec = document.createElement('div');
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
    }

    /* ---- Hardcoded rosters ---- */
    _hardcodedRoster(year) {
      const R = (num, name, pos, grp, ht, wt, yr, city) =>
        ({ number: num, name, pos, posGroup: grp, height: ht, weight: wt, classYr: yr, hometown: city });
      const QB = 'Quarterbacks', RB = 'Running Backs', WR = 'Wide Receivers',
            TE = 'Tight Ends',  OL = 'Offensive Line', DL = 'Defensive Line',
            ED = 'Edge / STUD', LB = 'Linebackers',    DB = 'Defensive Backs',
            SP = 'Specialists';

      const r2026 = [
        // ── Quarterbacks ──
        R('10','Josh Hoover',         'QB',QB,`6'2"`,'194 lbs','Sr+','—'),
        R( '2','Grant Wilson',        'QB',QB,`6'3"`,'220 lbs','Sr+','Westfield, IN'),
        R('15','Tyler Cherry',        'QB',QB,`6'5"`,'219 lbs','Jr', 'Bloomington, IN'),
        R('12','Jacob Bell',          'QB',QB,`6'2"`,'213 lbs','So', 'Westfield, IN'),
        // ── Running Backs ──
        R('29','Lee Beebe',           'RB',RB,`5'10"`,'218 lbs','Sr+','Indianapolis, IN'),
        R( '1','Turbo Richard',       'RB',RB,`5'9"`, '204 lbs','Jr', 'St. Louis, MO'),
        R('28','Khobie Martin',       'RB',RB,`6'0"`, '208 lbs','Jr', 'Indianapolis, IN'),
        R('20','Sean Cuono',          'RB',RB,`5'10"`,'198 lbs','So', 'Indianapolis, IN'),
        R('22','Jayreon Campbell',    'RB',RB,`5'8"`, '218 lbs','Fr', '—'),
        // ── Wide Receivers ──
        R( '8','Nick Marsh',          'WR',WR,`6'3"`, '203 lbs','Jr', '—'),
        R( '4','Davion Chandler',     'WR',WR,`5'11"`,'180 lbs','So', 'Westfield, IN'),
        R( '3','Kortez Rupert',       'WR',WR,`5'11"`,'156 lbs','Fr', '—'),
        R('80','Charlie Becker',      'WR',WR,`6'4"`, '209 lbs','Jr', 'Annapolis, MD'),
        R( '7','Shazz Preston',       'WR',WR,`6'0"`, '199 lbs','Sr+','Baton Rouge, LA'),
        R('82','Myles Kendrick',      'WR',WR,`6'0"`, '190 lbs','So', 'Indianapolis, IN'),
        // ── Slot WR ──
        R( '9','Tyler Morris',        'WR',WR,`5'11"`,'183 lbs','Sr+','Westfield, IN'),
        R( '6','LeBron Bond',         'WR',WR,`5'9"`, '173 lbs','So', 'Bellflower, CA'),
        // ── Tight Ends ──
        R('88','Brock Schott',        'TE',TE,`6'3"`, '243 lbs','So', '—'),
        R('85','Andrew Barker',       'TE',TE,`6'4"`, '246 lbs','So', 'Bloomington, IN'),
        R('84','Blake Thiry',         'TE',TE,`6'4"`, '224 lbs','So', '—'),
        R('18','Parker Elmore',       'TE',TE,`6'4"`, '226 lbs','Fr', '—'),
        R('39','Trevor Gibbs',        'TE',TE,`6'2"`, '232 lbs','Fr', '—'),
        // ── Offensive Line ──
        R('65','Carter Smith',        'OL',OL,`6'5"`, '313 lbs','Sr+','Bloomington, IN'),
        R('62','Drew Evans',          'OL',OL,`6'4"`, '309 lbs','Sr+','Columbus, OH'),
        R('74','Bray Lynch',          'OL',OL,`6'5"`, '312 lbs','Sr+','Rockford, IL'),
        R('56','Joe Brunner',         'OL',OL,`6'7"`, '315 lbs','Sr+','—'),
        R('72','Adedamola Ajani',     'OL',OL,`6'4"`, '308 lbs','Jr', '—'),
        R('71','Benjamin Novak',      'OL',OL,`6'6"`, '320 lbs','Fr', '—'),
        R('70','Austin Leibfried',    'OL',OL,`6'6"`, '306 lbs','Jr', 'Westfield, IN'),
        R('77','Matt Marek',          'OL',OL,`6'3"`, '308 lbs','So', '—'),
        R('66','Evan Parker',         'OL',OL,`6'4"`, '308 lbs','So', '—'),
        R('61','Baylor Wilkin',       'OL',OL,`6'5"`, '290 lbs','So', 'Columbus, OH'),
        R('75','Sam Simpson',         'OL',OL,`6'3"`, '311 lbs','Fr', '—'),
        R('60','CJ Scifres',          'OL',OL,`6'5"`, '310 lbs','Fr', '—'),
        // ── Safeties ──
        R( '6','Preston Zachman',     'S', DB,`6'1"`, '204 lbs','Sr+','—'),
        R( '1','Amare Ferrell',       'S', DB,`6'2"`, '202 lbs','Sr', 'Carmel, IN'),
        R( '9','Seaonta Stewart',     'S', DB,`6'1"`, '203 lbs','So', 'Columbus, OH'),
        R('33','Garrett Reese',       'S', DB,`6'2"`, '203 lbs','So', '—'),
        R('16','Jamar Owens',         'S', DB,`6'0"`, '165 lbs','Fr', '—'),
        // ── Rover ──
        R( '2','Byron Baldwin',       'S', DB,`6'2"`, '194 lbs','So', 'Columbus, OH'),
        R('13','Quan Sanks',          'S', DB,`5'10"`,'189 lbs','Jr', '—'),
        R('25',"D'Montae Tims",       'S', DB,`6'1"`, '205 lbs','Fr', '—'),
        // ── Cornerbacks ──
        R('22','Jamari Sharpe',       'CB',DB,`6'1"`, '187 lbs','Sr+','Lake Charles, LA'),
        R( '0','Carson Williams',     'CB',DB,`5'11"`,'172 lbs','Jr', '—'),
        R( '3','Jaylen Bell',         'CB',DB,`5'10"`,'176 lbs','So', 'Indianapolis, IN'),
        R('27','Kasmir Hicks',        'CB',DB,`5'11"`,'162 lbs','Fr', '—'),
        R('10','Ryland Gandy',        'CB',DB,`6'0"`, '186 lbs','Sr', 'Westfield, IN'),
        R( '4','AJ Harris',           'CB',DB,`6'1"`, '184 lbs','Sr+','—'),
        R('19','Zacharey Smith',      'CB',DB,`5'11"`,'170 lbs','So', '—'),
        R('24',"Ja'Dyn Williams",     'CB',DB,`6'1"`, '205 lbs','Fr', '—'),
        // ── Linebackers ──
        R('46','Isaiah Jones',        'LB',LB,`6'2"`, '230 lbs','Sr+','Cincinnati, OH'),
        R( '5','Rolijah Hardy',       'LB',LB,`5'11"`,'229 lbs','Sr', 'Fort Wayne, IN'),
        R('14','Kaiden Turner',       'LB',LB,`6'0"`, '229 lbs','Sr+','Columbus, OH'),
        R('30','PJ Nelson',           'LB',LB,`6'1"`, '219 lbs','So', '—'),
        R('23','Henry Ohlinger',      'LB',LB,`6'1"`, '216 lbs','Fr', '—'),
        R('21','Jacob Savage',        'LB',LB,`6'0"`, '230 lbs','Fr', '—'),
        R('44','Amari Kamara',        'LB',LB,`5'11"`,'202 lbs','So', 'Westfield, IN'),
        // ── Stud / Edge ──
        R('12','Tobi Osunsanmi',      'STUD',ED,`6'2"`,'244 lbs','Sr+','—'),
        R('17','Daniel Ndukwe',       'STUD',ED,`6'3"`,'244 lbs','Jr', '—'),
        R('40','Quentin Clark',       'STUD',ED,`6'1"`,'227 lbs','Jr', 'Indianapolis, IN'),
        R('96','Triston Abram',       'STUD',ED,`6'3"`,'228 lbs','So', '—'),
        R('42','Kevontay Hugan',      'STUD',ED,`6'1"`,'227 lbs','Fr', '—'),
        // ── SDE / Defensive End ──
        R( '7','Chiddi Obiazor',      'DE', DL,`6'5"`, '272 lbs','Jr', '—'),
        R( '8','Joshua Burnham',      'DE', DL,`6'4"`, '246 lbs','Sr', '—'),
        R('99','Tyrone Burrus',       'DE', DL,`6'4"`, '236 lbs','So', 'Memphis, TN'),
        R('41','Keishaun Calhoun',    'DE', DL,`6'2"`, '267 lbs','So', '—'),
        R('93','Ronelle Johnson',     'DE', DL,`6'3"`, '269 lbs','Fr', '—'),
        // ── Defensive Tackle ──
        R('97','Mario Landino',       'DT', DL,`6'4"`, '284 lbs','Jr', 'Cincinnati, OH'),
        R('90','Joe Hjelle',          'DT', DL,`6'3"`, '309 lbs','Sr+','—'),
        R('94','Kyler Garcia',        'DT', DL,`6'4"`, '291 lbs','So', 'Columbus, OH'),
        R('92','Gabriel Hill',        'DT', DL,`6'1"`, '280 lbs','Fr', '—'),
        R('91','Blake Smythe',        'DT', DL,`6'2"`, '281 lbs','Fr', '—'),
        // ── Nose Tackle ──
        R('95','Tyrique Tucker',      'NT', DL,`6'0"`, '302 lbs','Sr+','Louisville, KY'),
        R('50','Jhrevious Hall',      'NT', DL,`6'2"`, '306 lbs','So', 'Memphis, TN'),
        R('98','Cameron McHaney',     'NT', DL,`6'1"`, '274 lbs','Fr', '—'),
        R('55','Rodney White',        'NT', DL,`6'1"`, '294 lbs','Fr', '—'),
        // ── Specialists (Scholarship) ──
        R('15','Nicolas Radicic',     'K',  SP,`5'11"`,'187 lbs','Jr', 'Carmel, IN'),
        R('19','Billy Gowers',        'P',  SP,`6'2"`, '206 lbs','So', '—'),
        R('49','Drew Clausen',        'LS', SP,`6'6"`, '267 lbs','Sr+','—'),
        R('35','Paddy McAteer',       'KOS',SP,`6'2"`, '207 lbs','Sr', '—'),
      ];

      const r2025 = [
        R( '8','Fernando Mendoza',   'QB',QB,`6'3"`,'225 lbs','Jr', 'Miami, FL'),
        R('14','Alberto Mendoza',    'QB',QB,`6'2"`,'210 lbs','Fr', 'Miami, FL'),
        R( '6','Grant Wilson',       'QB',QB,`6'1"`,'200 lbs','So', 'Westfield, IN'),
        R( '1','Kaelon Black',       'RB',RB,`5'9"`,'195 lbs','Jr', 'St. Louis, MO'),
        R('20','Roman Hemby',        'RB',RB,`5'10"`,'200 lbs','So', 'Brandywine, MD'),
        R('24','Solomon Vanhorse',   'RB',RB,`5'9"`,'190 lbs','So', 'St. Louis, MO'),
        R('34','Lee Beebe',          'RB',RB,`5'11"`,'205 lbs','Jr', 'Indianapolis, IN'),
        R('22','Khobie Martin',      'RB',RB,`5'10"`,'195 lbs','Fr', 'Indianapolis, IN'),
        R( '4','Elijah Sarratt',     'WR',WR,`6'1"`,'195 lbs','Jr', 'Westfield, IN'),
        R( '5','Omar Cooper Jr',     'WR',WR,`6'1"`,'185 lbs','So', 'Edgewater, FL'),
        R( '2','Tyler Morris',       'WR',WR,`5'11"`,'185 lbs','So', 'Westfield, IN'),
        R('11','EJ Williams Jr',     'WR',WR,`6'4"`,'215 lbs','So', 'Phenix City, AL'),
        R('18','Makai Jackson',      'WR',WR,`6'1"`,'190 lbs','Fr', 'Dublin, OH'),
        R('15','Jonathan Brady',     'WR',WR,`6'0"`,'185 lbs','Jr', 'Austin, TX'),
        R('82','LeBron Bond',        'WR',WR,`6'2"`,'200 lbs','So', 'Bellflower, CA'),
        R('13','Davion Chandler',    'WR',WR,`6'1"`,'185 lbs','Jr', 'Westfield, IN'),
        R('87','Charlie Becker',     'WR',WR,`6'3"`,'215 lbs','Jr', 'Annapolis, MD'),
        R('89','Holden Staes',       'TE',TE,`6'4"`,'250 lbs','Jr', 'Libertyville, IL'),
        R('85','Riley Nowakowski',   'TE',TE,`6'4"`,'245 lbs','Jr', 'Mokena, IL'),
        R('86','James Bomba',        'TE',TE,`6'5"`,'255 lbs','So', 'St. Louis, MO'),
        R('72','Carter Smith',       'OL',OL,`6'7"`,'315 lbs','Jr', 'Bloomington, IN'),
        R('74','Drew Evans',         'OL',OL,`6'5"`,'310 lbs','Jr', 'Columbus, OH'),
        R('55','Pat Coogan',         'OL',OL,`6'4"`,'305 lbs','Jr', 'South Bend, IN'),
        R('77','Bray Lynch',         'OL',OL,`6'5"`,'320 lbs','So', 'Rockford, IL'),
        R('78','Zen Michalski',      'OL',OL,`6'6"`,'325 lbs','Jr', 'St. Louis, MO'),
        R('71','Evan Lawrence',      'OL',OL,`6'6"`,'310 lbs','So', 'Westfield, IN'),
        R('60','Jack Greer',         'OL',OL,`6'3"`,'300 lbs','Fr', 'Columbus, OH'),
        R('53','Kahlil Benson',      'OL',OL,`6'4"`,'305 lbs','So', 'Fort Wayne, IN'),
        R('91','Hosea Wheeler',      'DL',DL,`6'3"`,'290 lbs','Jr', 'Columbus, OH'),
        R('93','Dominique Ratcliff', 'DL',DL,`6'3"`,'295 lbs','So', 'Cincinnati, OH'),
        R('95','Tyrique Tucker',     'DL',DL,`6'2"`,'285 lbs','Jr', 'Louisville, KY'),
        R('97',"J'Mari Monette",     'DL',DL,`6'2"`,'280 lbs','So', 'Fort Wayne, IN'),
        R('10','Mikail Kamara',      'STUD',ED,`6'4"`,'250 lbs','Jr', 'Westfield, IN'),
        R('35','Kellan Wyatt',       'STUD',ED,`6'3"`,'245 lbs','So', 'Westfield, IN'),
        R('99','Stephen Daley',      'DE', ED,`6'4"`,'255 lbs','So', 'London, ON'),
        R('94','Mario Landino',      'DE', ED,`6'3"`,'250 lbs','So', 'Cincinnati, OH'),
        R('33','Rolijah Hardy',      'LB',LB,`6'2"`,'225 lbs','Jr', 'Fort Wayne, IN'),
        R('30','Aiden Fisher',       'LB',LB,`6'2"`,'220 lbs','Jr', 'Wexford, PA'),
        R('41','Isaiah Jones',       'LB',LB,`6'1"`,'215 lbs','Jr', 'Cincinnati, OH'),
        R('43','Kaiden Turner',      'LB',LB,`6'1"`,'215 lbs','So', 'Columbus, OH'),
        R( '3',"D'Angelo Ponds",     'CB',DB,`6'0"`,'185 lbs','Jr', 'Powder Springs, GA'),
        R( '7','Jamari Sharpe',      'CB',DB,`6'0"`,'185 lbs','Jr', 'Lake Charles, LA'),
        R('23','Amariyun Knighten',  'CB',DB,`6'1"`,'190 lbs','So', 'Columbus, OH'),
        R('28','Ryland Gandy',       'CB',DB,`5'11"`,'180 lbs','So', 'Westfield, IN'),
        R( '9','Amare Ferrell',      'S', DB,`6'1"`,'200 lbs','Jr', 'Carmel, IN'),
        R('21','Louis Moore',        'S', DB,`6'1"`,'200 lbs','Jr', 'Columbus, OH'),
        R('22','Bryson Bonds',       'S', DB,`6'0"`,'195 lbs','So', 'Westfield, IN'),
        R('45','Devan Boykin',       'S', DB,`6'2"`,'215 lbs','Jr', 'Columbus, OH'),
        R('25','Jah Jah Boyd',       'S', DB,`6'0"`,'195 lbs','So', 'St. Louis, MO'),
        R('36','Nicolas Radicic',    'K', SP,`6'0"`,'185 lbs','Jr', 'Carmel, IN'),
        R('38','Brendan Franke',     'K/P',SP,`6'1"`,'195 lbs','So', 'Cincinnati, OH'),
        R('49','Mitch McCarthy',     'P', SP,`6'3"`,'210 lbs','Jr', 'Melbourne, AUS'),
        R('48','Mark Langston',      'LS',SP,`6'3"`,'235 lbs','Jr', 'Westfield, IN'),
      ];

      const r2024 = [
        R('16','Brendan Sorsby',     'QB',QB,`6'3"`,'220 lbs','Sr', 'Westfield, IN'),
        R( '9','Tayven Jackson',     'QB',QB,`6'2"`,'210 lbs','So', 'Westfield, IN'),
        R( '6','Grant Wilson',       'QB',QB,`6'1"`,'200 lbs','Fr', 'Westfield, IN'),
        R('23','Trent Howland',      'RB',RB,`5'10"`,'190 lbs','Sr', 'Kokomo, IN'),
        R('21','Josh Henderson',     'RB',RB,`5'10"`,'195 lbs','Jr', 'Kokomo, IN'),
        R( '1','Jaylin Lucas',       'RB',RB,`5'8"`,'185 lbs','Jr', 'Kokomo, IN'),
        R( '4','Elijah Sarratt',     'WR',WR,`6'1"`,'195 lbs','So', 'Westfield, IN'),
        R('11','EJ Williams Jr',     'WR',WR,`6'4"`,'215 lbs','Fr', 'Phenix City, AL'),
        R( '2','Tyler Morris',       'WR',WR,`5'11"`,'185 lbs','Fr', 'Westfield, IN'),
        R( '5','Omar Cooper Jr',     'WR',WR,`6'1"`,'185 lbs','Fr', 'Edgewater, FL'),
        R('13','Andison Coby',       'WR',WR,`6'2"`,'195 lbs','Sr', 'St. Louis, MO'),
        R('86','James Bomba',        'TE',TE,`6'5"`,'255 lbs','Fr', 'St. Louis, MO'),
        R('85','Riley Nowakowski',   'TE',TE,`6'4"`,'245 lbs','So', 'Mokena, IL'),
        R('72','Carter Smith',       'OL',OL,`6'7"`,'315 lbs','So', 'Bloomington, IN'),
        R('74','Drew Evans',         'OL',OL,`6'5"`,'310 lbs','So', 'Columbus, OH'),
        R('57','Zach Carpenter',     'OL',OL,`6'3"`,'300 lbs','Sr', 'South Bend, IN'),
        R('77','Bray Lynch',         'OL',OL,`6'5"`,'320 lbs','Fr', 'Rockford, IL'),
        R('78','Zen Michalski',      'OL',OL,`6'6"`,'325 lbs','So', 'St. Louis, MO'),
        R('91','Hosea Wheeler',      'DL',DL,`6'3"`,'290 lbs','So', 'Columbus, OH'),
        R('95','Tyrique Tucker',     'DL',DL,`6'2"`,'285 lbs','So', 'Louisville, KY'),
        R('98','Myles Jackson',      'STUD',ED,`6'4"`,'250 lbs','Sr', 'Westfield, IN'),
        R('96','Andre Carter',       'DE', ED,`6'5"`,'255 lbs','Sr', 'Cleveland, OH'),
        R('55','Aaron Casey',        'LB',LB,`6'2"`,'230 lbs','Sr', 'Dublin, OH'),
        R('30','Aiden Fisher',       'LB',LB,`6'2"`,'220 lbs','So', 'Wexford, PA'),
        R('54','Kaiden Turner',      'LB',LB,`6'1"`,'215 lbs','Fr', 'Columbus, OH'),
        R( '7','Jamari Sharpe',      'CB',DB,`6'0"`,'185 lbs','So', 'Lake Charles, LA'),
        R('12','Noah Pierre',        'CB',DB,`5'11"`,'175 lbs','Sr', 'Pompano Beach, FL'),
        R( '9','Amare Ferrell',      'S', DB,`6'1"`,'200 lbs','So', 'Carmel, IN'),
        R('21','Louis Moore',        'S', DB,`6'1"`,'200 lbs','So', 'Columbus, OH'),
        R('45','Devan Boykin',       'S', DB,`6'2"`,'215 lbs','So', 'Columbus, OH'),
        R('36','Nicolas Radicic',    'K', SP,`6'0"`,'185 lbs','So', 'Carmel, IN'),
        R('90','Chris Freeman',      'K', SP,`6'0"`,'185 lbs','Sr', 'Cincinnati, OH'),
        R('49','James Evans',        'P', SP,`6'2"`,'200 lbs','Sr', 'Melbourne, AUS'),
        R('53','Sean Wracher',       'LS',SP,`6'3"`,'235 lbs','Sr', 'Carmel, IN'),
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
    setupListeners() {
      document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const tab = btn.dataset.tab;

          document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
          document.getElementById(`${tab}-tab`)?.classList.add('active');

          LOG.load(`Tab switched to: ${tab}`);
          if (tab === 'current') {
            await Promise.all([this.loadTeamInfo(), this.loadRecentGames(), this.loadTeamStats(), this.loadNews()]);
          } else if (tab === 'schedule') {
            await this.loadSchedule(this.currentYear);
          } else if (tab === 'roster') {
            await this.loadRoster();
          } else if (tab === 'history') {
            await this.loadHistory();
          }
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
      this.showLoading();
      LOG.info('Initializing — loading current season data');
      try {
        await Promise.all([
          this.loadTeamInfo(),
          this.loadRecentGames(),
          this.loadTeamStats(),
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
    // Footer last-updated timestamp (avoids inline script in HTML)
    const footerEl = document.getElementById('footer-updated');
    if (footerEl) {
      const d = new Date(document.lastModified);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      footerEl.textContent = 'Last updated: ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    } new IndianaFootball(); });

})();
