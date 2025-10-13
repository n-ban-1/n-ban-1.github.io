/* Indiana Hoosiers Football — Hybrid Local + Live (Team 84)
   Local folder (preferred up to and including 2025-08-08):
     ./indiana_football_history/{year}/schedule.json
     ./indiana_football_history/{year}/game_{eventId}/summary.json
   Live ESPN (used for seasons newer than 2025-08-08, and as fallback if local missing):
     Team schedule: https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/84/schedule?season=YYYY
     Summary:       https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event={eventId}
   Depth charts hardcoded for 2024 and 2025
*/

(function () {
  'use strict';

  class IndianaFootball {
    constructor() {
      // Config
      this.TEAM_ID = 84;
      this.DATA_BASE = './indiana_football_history';
      this.MIN_YEAR = 2001;
      this.CUTOVER_TS = Date.parse('2025-08-08T00:00:00Z'); // anything newer than this => live
      this.ESPN = { site: 'https://site.api.espn.com' };

      // Years
      const nowY = new Date().getFullYear();
      this.currentYear = nowY;
      this.availableYears = this.rangeYears(nowY, this.MIN_YEAR);

      // Tuning
      this.isMobile = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 768px)').matches : false;
      this.summaryConcurrency = this.isMobile ? 2 : 4;

      // Caches
      this.mem = new Map(); // in-memory
      // Hardcoded depth charts
      this.depthCharts = { 2025: this.dc2025(), 2024: this.dc2024() };
      this.currentRosterYear = 2025;

      // DOM
      this.dom = {
        loading: document.getElementById('loading'),
        teamLogo: document.getElementById('team-logo'),
        teamName: document.getElementById('team-name'),
        teamRecord: document.getElementById('team-record'),
        confRecord: document.getElementById('conference-record'),
        confName: document.getElementById('conference-name'),
        teamRank: document.getElementById('team-ranking'),
        ppg: document.getElementById('ppg'),
        ypg: document.getElementById('ypg'),
        passYpg: document.getElementById('pass-ypg'),
        rushYpg: document.getElementById('rush-ypg'),
        defPpg: document.getElementById('def-ppg'),
        defYpg: document.getElementById('def-ypg'),
        turnovers: document.getElementById('turnovers'),
        sacks: document.getElementById('sacks'),
        recentGames: document.getElementById('recent-games'),
        scheduleList: document.getElementById('schedule-list'),
        seasonSelect: document.getElementById('season-select'),
        rosterTab: document.getElementById('roster-tab'),
        rosterList: document.getElementById('roster-list'),
        seasonRecords: document.getElementById('season-records'),
      };

      this.init();
    }

    // ---------------- Utils ----------------
    rangeYears(max, min) { const a = []; for (let y = max; y >= min; y--) a.push(y); return a; }
    lsk(k) { return `iu:${k}`; }
    getLS(key) {
      try {
        const raw = localStorage.getItem(this.lsk(key));
        if (!raw) return null;
        const { t, ttl, data } = JSON.parse(raw);
        if (Date.now() - t > ttl) { localStorage.removeItem(this.lsk(key)); return null; }
        return data;
      } catch { return null; }
    }
    setLS(key, data, ttl) {
      try { localStorage.setItem(this.lsk(key), JSON.stringify({ t: Date.now(), ttl, data })); } catch {}
    }
    setText(el, v) { if (el) el.textContent = v; }
    setStat(el, v) { if (el) el.textContent = v == null ? '--' : v; }
    showLoading(){ if (this.dom.loading) this.dom.loading.style.display = 'block'; }
    hideLoading(){ if (this.dom.loading) this.dom.loading.style.display = 'none'; }
    fmtDateTime(s) { const d = new Date(s); if (Number.isNaN(d.getTime())) return ''; return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    top25(n){ const x=Number(n); return Number.isFinite(x) && x>=1 && x<=25 ? x : null; }
    isAfterCutover() { return Date.now() > this.CUTOVER_TS; }
    // Use local if year < 2025, use live if year > 2025, if year == 2025 use local (cutover is for newer than 8/8/2025)
    preferLocal(year) { return (year < 2025) || (year === 2025 && !this.isAfterCutover()); }

    async fetchJson(url, { retries = 1, timeout = 12000 } = {}) {
      for (let a = 0; a <= retries; a++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeout);
        try {
          const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
          clearTimeout(timer);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.json();
        } catch (e) {
          clearTimeout(timer);
          if (a === retries) return null;
          await new Promise(r => setTimeout(r, 300 * (a + 1)));
        }
      }
      return null;
    }
    async fetchLocal(path) {
      try {
        const res = await fetch(`${this.DATA_BASE}/${path}`, { headers: { Accept: 'application/json' } });
        if (!res.ok) return null;
        return await res.json();
      } catch { return null; }
    }

    // -------------- Hardcoded Depth Charts --------------
    dc2025() {
      return {
        offense: {
          'X-WR':['Elijah Sarratt','EJ Williams Jr','Davion Chandler'],
          'SL-WR':['Tyler Morris','Jonathan Brady','LeBron Bond','Myles Kendrick'],
          'Z-WR':['Omar Cooper Jr','Makai Jackson','Charlie Becker'],
          'LT':['Carter Smith','Evan Lawrence','Matt Marek'],
          'LG':['Drew Evans','Kahlil Benson','Baylor Wilkin'],
          'C':['Pat Coogan','Jack Greer','Mitch Verstegen'],
          'RG':['Bray Lynch','Adedamola Ajani','Austin Leibfried'],
          'RT':['Zen Michalski','Austin Barrett','Max Williams'],
          'TE':['Holden Staes','Riley Nowakowski','James Bomba','Andrew Barker'],
          'QB':['Fernando Mendoza','Alberto Mendoza','Grant Wilson','Jacob Bell','Tyler Cherry'],
          'HB':['Kaelon Black','Roman Hemby','Lee Beebe','Khobie Martin','Sean Cuono','Solomon Vanhorse']
        },
        defense: {
          'CB1':['D’Angelo Ponds','Amariyun Knighten','Dontrae Henderson'],
          'CB2':['Jamari Sharpe','Ryland Gandy','Jaylen Bell'],
          'STUD':['Mikail Kamara','Kellan Wyatt','Daniel Ndukwe','Triston Abram','Andrew Turvy'],
          'DT1':['Hosea Wheeler','Dominique Ratcliff','Kyler Garcia'],
          'DT2':['Tyrique Tucker','J’Mari Monette','Jhrevious Hall'],
          'DE':['Stephen Daley','Mario Landino','Andrew Depaepe','Tyrone Burrus Jr'],
          'LB1':['Rolijah Hardy','Isaiah Jones','Jeff Utzinger','Paul Nelson','Amari Kamara'],
          'LB2':['Aiden Fisher','Kaiden Turner','Quentin Clark','Jamari Farmer'],
          'FS':['Louis Moore','Bryson Bonds','Seaonta Stewart'],
          'SS':['Amare Ferrell','Byron Baldwin'],
          'Rover':['Devan Boykin','Jah Jah Boyd','Zacharey Smith','Garrett Reese']
        },
        specialists: {
          'PK':['Nicolas Radicic','Brendan Franke'],
          'KO':['Brendan Franke','Alejandro Quintero'],
          'LS':['Mark Langston','Sam Lindsey'],
          'PT':['Mitch McCarthy','Alejandro Quintero'],
          'KR':['Solomon Vanhorse','EJ Williams Jr'],
          'PR':['Tyler Morris','Solomon Vanhorse']
        }
      };
    }
    dc2024() {
      return {
        offense: {
          'X-WR':['Elijah Sarratt','EJ Williams Jr','Davion Chandler'],
          'SL-WR':['Tyler Morris','Jonathan Brady','LeBron Bond','Myles Kendrick'],
          'Z-WR':['Omar Cooper Jr','Makai Jackson','Charlie Becker'],
          'LT':['Carter Smith','Evan Lawrence','Matt Marek'],
          'LG':['Drew Evans','Kahlil Benson','Baylor Wilkin'],
          'C':['Zach Carpenter','Jack Greer','Mitch Verstegen'],
          'RG':['Bray Lynch','Adedamola Ajani','Austin Leibfried'],
          'RT':['Zen Michalski','Austin Barrett','Max Williams'],
          'TE':['James Bomba','Riley Nowakowski','Andrew Barker'],
          'QB':['Brendan Sorsby','Tayven Jackson','Grant Wilson'],
          'HB':['Trent Howland','Josh Henderson','Jaylin Lucas']
        },
        defense: {
          'CB1':['Jamari Sharpe','Ryland Gandy','Jaylen Bell'],
          'CB2':['Noah Pierre','Amariyun Knighten'],
          'STUD':['Myles Jackson','Kellan Wyatt'],
          'DT1':['Hosea Wheeler','Dominique Ratcliff'],
          'DT2':['Tyrique Tucker','J’Mari Monette'],
          'DE':['Andre Carter','Anthony Jones'],
          'LB1':['Aaron Casey','Aiden Fisher'],
          'LB2':['Kaiden Turner','Isaiah Jones'],
          'FS':['Louis Moore','Bryson Bonds'],
          'SS':['Amare Ferrell','Josh Sanguinetti'],
          'Rover':['Devan Boykin','Noah Pierre']
        },
        specialists: {
          'PK':['Nicolas Radicic','Chris Freeman'],
          'KO':['Chris Freeman'],
          'LS':['Sean Wracher'],
          'PT':['James Evans'],
          'KR':['Jaylin Lucas'],
          'PR':['Jaylin Lucas']
        }
      };
    }

    // -------------- Data selection with fallback --------------
    async getSeasonSchedule(year) {
      const key = `sched:${year}`;
      const cached = this.mem.get(key) || this.getLS(key);
      if (cached) return cached;

      // 1) Preferred source
      let events = [];
      if (this.preferLocal(year)) {
        const local = await this.fetchLocal(`${year}/schedule.json`);
        events = this.pickEventsArray(local);
        // robust fallback: if local missing/empty, try live
        if (!events || events.length === 0) {
          const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}/schedule?season=${year}`;
          const json = await this.fetchJson(url, { timeout: 12000 });
          events = this.pickEventsArray(json);
        }
      } else {
        const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}/schedule?season=${year}`;
        const json = await this.fetchJson(url, { timeout: 12000 });
        events = this.pickEventsArray(json);
      }

      events = Array.isArray(events) ? events : [];
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
      const key = `sum:${year}:${eventId}`;
      const cached = this.mem.get(key) || this.getLS(key);
      if (cached) return cached;

      let data = null;
      if (this.preferLocal(year)) {
        data = await this.fetchLocal(`${year}/game_${eventId}/summary.json`);
        // fallback to live summary if local missing
        if (!data) {
          const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/summary?event=${eventId}`;
          data = await this.fetchJson(url, { timeout: 12000 });
        }
      } else {
        const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/summary?event=${eventId}`;
        data = await this.fetchJson(url, { timeout: 12000 });
      }

      if (data) {
        this.mem.set(key, data);
        this.setLS(key, data, 6 * 60 * 60 * 1000);
      }
      return data;
    }

    // -------------- Team header --------------
    async loadTeamInfo() {
      this.setText(this.dom.confName, 'Big Ten'); // Always Big Ten for the first TBD
      // Try live team info
      try {
        const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}?enable=record,rankings,logos,conference`;
        const resp = await this.fetchJson(url, { timeout: 10000 });
        const team = resp?.team;
        if (team) {
          const logo = team.logos?.[0]?.href || 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png';
          this.dom.teamLogo.src = logo;
          this.setText(this.dom.teamName, team.displayName || 'Indiana Hoosiers');

          let overall = 'TBD';
          let conf = 'Conference: TBD';
          const items = team.record?.items;
          if (Array.isArray(items) && items.length) {
            const total = items.find(i => i.type === 'total') || items[0];
            if (total?.summary) overall = total.summary;
            const vsConf = items.find(i => i.type === 'vsconf');
            if (vsConf?.summary) conf = `Conference: ${vsConf.summary}`;
          }
          this.setText(this.dom.teamRecord, overall);
          this.setText(this.dom.confRecord, conf);

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
          return;
        }
      } catch {}

      // Fallback derive from schedule
      const events = await this.getSeasonSchedule(this.currentYear);
      const rec = await this.computeSeasonRecordFromEvents(this.currentYear, events);
      const overall = (rec.w + rec.l + rec.t) > 0 ? `${rec.w}-${rec.l}${rec.t ? `-${rec.t}` : ''}` : 'TBD';
      const conf = `${rec.cw}-${rec.cl}${rec.ct ? `-${rec.ct}` : ''}`;
      this.dom.teamLogo.src = 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png';
      this.setText(this.dom.teamName, 'Indiana Hoosiers');
      this.setText(this.dom.teamRecord, overall);
      this.setText(this.dom.confRecord, `Conference: ${conf}`);
      this.setText(this.dom.teamRank, 'Unranked');
    }

    // -------------- Records (robust: use summary if schedule lacks data) --------------
    async computeSeasonRecordFromEvents(year, events) {
      let w=0,l=0,t=0,cw=0,cl=0,ct=0;
      for (const e of (events || [])) {
        const comp = e?.competitions?.[0];
        const comps = comp?.competitors || [];
        const mine = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
        const opp = comps.find(x => x !== mine);
        if (!mine || !opp) continue;

        // Pull status and scores from schedule first
        let st = e.status?.type || e.status || {};
        let completed = !!(st && (st.state === 'post' || st.completed === true));
        let my = toNumber(mine.score);
        let th = toNumber(opp.score);
        let isConf = comp?.conferenceCompetition === true;

        // If schedule doesn't mark completed or scores missing, consult summary
        if ((!completed || (!Number.isFinite(my) || !Number.isFinite(th))) || (isConf === undefined)) {
          const sum = await this.getSummary(year, e.id);
          const hcomp = sum?.header?.competitions?.[0];
          const hcomps = hcomp?.competitors || [];
          const hmine = hcomps.find(x => String(x.team?.id) === String(this.TEAM_ID));
          const hopp = hcomps.find(x => x !== hmine);
          const hst = hcomp?.status?.type || {};
          if (!completed) completed = (hst.state === 'post' || hst.completed === true);
          if (!Number.isFinite(my) || !Number.isFinite(th)) {
            my = toNumber(hmine?.score);
            th = toNumber(hopp?.score);
          }
          if (isConf === undefined) isConf = (hcomp?.conferenceCompetition === true);
        }

        if (!completed) continue;
        if (!Number.isFinite(my) || !Number.isFinite(th)) continue;

        if (my > th) { w++; if (isConf) cw++; }
        else if (my < th) { l++; if (isConf) cl++; }
        else { t++; if (isConf) ct++; }
      }
      return { w,l,t,cw,cl,ct };

      function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : NaN; }
    }

    // -------------- Schedule --------------
    async loadSchedule(year) {
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
        c.innerHTML = `
          <div class="schedule-item">
            <div class="game-details">
              <div class="opponent-name">No games found</div>
              <div class="game-time">—</div>
              <div class="game-location">—</div>
            </div>
            <div class="game-status status-upcoming">TBD</div>
          </div>`;
        return;
      }

      const sorted = events.slice().sort((a,b)=> new Date(a.date) - new Date(b.date));
      for (const e of sorted) {
        const comp = e.competitions?.[0];
        const comps = comp?.competitors || [];
        const mine = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
        const opp = comps.find(x => x !== mine);
        const isHome = (mine?.homeAway) === 'home';
        const oppName = opp?.team?.displayName || 'TBD';
        const oppTop = this.top25(opp?.curatedRank?.current);
        const oppRankText = oppTop ? `#${oppTop} ` : '';
        const venue = comp?.venue?.fullName || (isHome ? 'Memorial Stadium' : 'Away');
        const tvSched = comp?.broadcasts?.[0]?.names?.[0] || comp?.geoBroadcasts?.[0]?.shortName || '';
        const timeStr = this.fmtDateTime(e.date);

        // Resolve status and scores robustly (use summary if schedule lacks them)
        const { statusClass, statusText } = await this.resolveStatusAndScore(year, e, comp, mine, opp);

        const item = document.createElement('div');
        item.className = 'schedule-item';
        item.setAttribute('data-event-id', e.id || '');
        item.setAttribute('data-year', String(year));
        item.innerHTML = `
          <div class="game-details">
            <div class="opponent">${isHome ? 'vs' : '@'} ${oppRankText}${oppName}</div>
            <div class="game-time">${timeStr}${tvSched ? ` • TV: ${tvSched}` : ''}</div>
            <div class="game-location">${venue}</div>
            <div class="game-extra" style="display:none;"></div>
          </div>
          <div class="game-status ${statusClass}">${statusText}</div>`;
        c.appendChild(item);
      }

      this.wireScheduleItemDetails();
    }

    async resolveStatusAndScore(year, e, comp, mine, opp) {
      const st = e.status?.type || e.status || {};
      let statusClass = 'status-upcoming';
      let statusText = 'TBD';

      // Start with schedule values
      if (st.state === 'pre') {
        statusClass = 'status-upcoming';
        statusText = 'TBD';
      } else if (st.state === 'in') {
        statusClass = 'status-live';
        const period = comp?.status?.period;
        const clock = comp?.status?.displayClock;
        statusText = (period && clock) ? `LIVE Q${period} ${clock}` : 'LIVE';
      } else if (st.state === 'post' || st.completed === true) {
        statusClass = 'status-final';
        const my = Number(mine?.score);
        const th = Number(opp?.score);
        if (Number.isFinite(my) && Number.isFinite(th)) {
          const wl = my > th ? 'W' : (my < th ? 'L' : 'T');
          statusText = `${wl} ${my}-${th}`;
          return { statusClass, statusText };
        }
      }

      // If we reach here and it's live or final but scores missing, consult summary
      if (st.state === 'in' || st.state === 'post' || st.completed === true) {
        const sum = await this.getSummary(year, e.id);
        const hcomp = sum?.header?.competitions?.[0];
        const hcomps = hcomp?.competitors || [];
        const hmine = hcomps.find(x => String(x.team?.id) === String(this.TEAM_ID));
        const hopp = hcomps.find(x => x !== hmine);
        const my = Number(hmine?.score);
        const th = Number(hopp?.score);
        const hst = hcomp?.status?.type || {};
        const final = (hst.state === 'post' || hst.completed === true);

        if (final && Number.isFinite(my) && Number.isFinite(th)) {
          statusClass = 'status-final';
          const wl = my > th ? 'W' : (my < th ? 'L' : 'T');
          statusText = `${wl} ${my}-${th}`;
        } else if (hst.state === 'in') {
          statusClass = 'status-live';
          const period = hcomp?.status?.period;
          const clock = hcomp?.status?.displayClock;
          statusText = (period && clock) ? `LIVE Q${period} ${clock}` : 'LIVE';
        }
      }

      return { statusClass, statusText };
    }

    wireScheduleItemDetails() {
      this.dom.scheduleList.querySelectorAll('.schedule-item').forEach((item) => {
        item.addEventListener('click', async () => {
          const eid = item.getAttribute('data-event-id');
          const year = parseInt(item.getAttribute('data-year'), 10);
          const extra = item.querySelector('.game-extra');
          if (!eid || !extra) return;

          if (extra.style.display === 'block') {
            extra.style.display = 'none';
            extra.innerHTML = '';
            return;
          }

          extra.style.display = 'block';
          extra.innerHTML = `<div class="row"><span class="badge">Loading game details...</span></div>`;

          const sum = await this.getSummary(year, eid);
          const rows = [];

          // TV
          try {
            const bs = sum?.header?.competitions?.[0]?.broadcasts || sum?.broadcasts || [];
            if (Array.isArray(bs) && bs.length) {
              const net = bs[0]?.names?.[0] || bs[0]?.shortName || bs[0]?.media?.shortName || '';
              if (net) rows.push(`<div class="row"><span class="badge">TV</span><span>${net}</span></div>`);
            }
          } catch {}
          // Venue / Attendance
          try {
            const v = sum?.gameInfo?.venue?.fullName || sum?.header?.competitions?.[0]?.venue?.fullName;
            const a = sum?.gameInfo?.attendance;
            if (v) rows.push(`<div class="row"><span class="badge">Venue</span><span>${v}${a ? ` • Att: ${a}` : ''}</span></div>`);
          } catch {}
          // Leaders quick line
          try {
            const cats = sum?.leaders?.leaders;
            if (Array.isArray(cats) && cats.length) {
              const short = (n)=>{ n=(n||'').toLowerCase(); if(n.includes('pass'))return'Pass'; if(n.includes('rush'))return'Rush'; if(n.includes('receiv'))return'Rec'; return n; };
              const line = cats.slice(0,3).map(cat=>{
                const nm = short(cat.name || cat.displayName);
                const lead = cat.leaders?.[0];
                const name = lead?.athlete?.displayName || '—';
                const val = lead?.displayValue || lead?.value || '';
                return `${nm}: ${name} ${val}`;
              }).join(' • ');
              if (line) rows.push(`<div class="row"><span class="badge">Leaders</span><span>${line}</span></div>`);
            }
          } catch {}

          extra.innerHTML = rows.length ? rows.join('') : `<div class="row"><span>No extra details found.</span></div>`;
        });
      });
    }

    // -------------- Recent Games --------------
    async loadRecentGames() {
      const c = this.dom.recentGames;
      if (!c) return;
      c.innerHTML = '';

      const events = await this.getSeasonSchedule(this.currentYear);
      if (!events || events.length === 0) {
        c.innerHTML = '<div class="game-item"><div>No recent games.</div></div>';
        return;
      }

      const now = Date.now();
      const recent = events
        .filter((e) => {
          const st = e.status?.type || e.status;
          if (!st) return new Date(e.date).getTime() <= now;
          return st.state === 'post' || st.completed === true || st.state === 'in' || new Date(e.date).getTime() <= now;
        })
        .sort((a,b)=>new Date(b.date)-new Date(a.date))
        .slice(0, 5);

      if (recent.length === 0) {
        const up = events
          .filter((e) => { const st = e.status?.type || e.status; return !st || st.state === 'pre'; })
          .sort((a,b)=>new Date(a.date)-new Date(b.date))
          .slice(0, 5);

        up.forEach((e) => {
          const comp = e.competitions?.[0];
          const comps = comp?.competitors || [];
          const mine = comps.find((x)=> String(x.team?.id)===String(this.TEAM_ID));
          const opp = comps.find((x)=> x!==mine);
          const isHome = (mine?.homeAway) === 'home';
          const oppName = opp?.team?.displayName || 'TBD';
          const d = document.createElement('div');
          d.className = 'game-item';
          d.innerHTML = `
            <div class="game-info">
              <div class="opponent">${isHome ? 'vs' : '@'} ${oppName}</div>
              <div class="game-date">${this.fmtDateTime(e.date)}</div>
            </div>
            <div class="game-result upcoming">—</div>`;
          c.appendChild(d);
        });
        return;
      }

      // batch summaries
      const chunks = [];
      for (let i=0;i<recent.length;i+=this.summaryConcurrency) chunks.push(recent.slice(i,i+this.summaryConcurrency));

      for (const batch of chunks) {
        const sums = await Promise.all(batch.map((e)=> this.getSummary(this.currentYear, e.id)));
        batch.forEach((e, idx) => {
          const comp = e.competitions?.[0];
          const comps = comp?.competitors || [];
          const mine = comps.find((x)=> String(x.team?.id)===String(this.TEAM_ID));
          const opp = comps.find((x)=> x!==mine);
          const isHome = (mine?.homeAway) === 'home';
          const oppName = opp?.team?.displayName || 'TBD';

          // robust status
          let cls = 'upcoming';
          let resText = '—';
          const st = e.status?.type || e.status || {};
          if (st.state === 'in') {
            cls = 't';
            const period = comp?.status?.period;
            const clock = comp?.status?.displayClock;
            resText = (period && clock) ? `LIVE Q${period} ${clock}` : 'LIVE';
          } else if (st.state === 'post' || st.completed === true) {
            let my = Number(mine?.score), th = Number(opp?.score);
            if (!Number.isFinite(my) || !Number.isFinite(th)) {
              const hcomp = sums[idx]?.header?.competitions?.[0];
              const hcomps = hcomp?.competitors || [];
              const hmine = hcomps?.find(x => String(x.team?.id) === String(this.TEAM_ID));
              const hopp = hcomps?.find(x => x !== hmine);
              my = Number(hmine?.score); th = Number(hopp?.score);
            }
            if (Number.isFinite(my) && Number.isFinite(th)) {
              const wl = my > th ? 'W' : (my < th ? 'L' : 'T');
              cls = wl.toLowerCase();
              resText = `${wl} ${my}-${th}`;
            } else {
              cls = 't'; resText = 'Final';
            }
          }

          // IU leaders
          let leadersHtml = '';
          const leaders = this.extractTeamLeaders(sums[idx], this.TEAM_ID);
          if (leaders) {
            const p = leaders.passing ? `${leaders.passing.name} ${leaders.passing.stat}` : '—';
            const r = leaders.rushing ? `${leaders.rushing.name} ${leaders.rushing.stat}` : '—';
            const rc = leaders.receiving ? `${leaders.receiving.name} ${leaders.receiving.stat}` : '—';
            leadersHtml = `
              <div class="game-leaders" style="margin-top:6px; font-size:0.85rem;">
                <div>P: ${p}</div>
                <div>R: ${r}</div>
                <div>Rec: ${rc}</div>
              </div>`;
          }

          const d = document.createElement('div');
          d.className = 'game-item';
          d.innerHTML = `
            <div class="game-info">
              <div class="opponent">${isHome ? 'vs' : '@'} ${oppName}</div>
              <div class="game-date">${this.fmtDateTime(e.date)}</div>
              ${leadersHtml}
            </div>
            <div class="game-result ${cls}">${resText}</div>`;
          this.dom.recentGames.appendChild(d);
        });
        if (this.isMobile) await new Promise(r => setTimeout(r, 150));
      }
    }

    extractTeamLeaders(summary, teamId) {
      try {
        const cats = summary?.leaders?.leaders;
        if (!Array.isArray(cats)) return null;
        const find = (needle)=> cats.find(c => (c.name || c.displayName || '').toLowerCase().includes(needle));
        const pack = (cat) => {
          if (!cat || !Array.isArray(cat.leaders)) return null;
          const mine = cat.leaders.find(l => String(l.team?.id) === String(teamId)) || cat.leaders[0];
          if (!mine?.athlete) return null;
          const name = mine.athlete.displayName || mine.athlete.shortName || '—';
          const stat = mine.displayValue || mine.value || '';
          return { name, stat };
        };
        return { passing: pack(find('pass')), rushing: pack(find('rush')), receiving: pack(find('receiv')) };
      } catch { return null; }
    }

    // -------------- Stats (current season; fallback to last season with finals) --------------
    async loadTeamStats() {
      // Try current year; if no completed games, walk back to prior years (local) until we find completed
      let year = this.currentYear;
      let events = await this.getSeasonSchedule(year);
      let completed = this.filterCompleted(events);
      let backSteps = 0;
      while ((!completed || completed.length === 0) && year > this.MIN_YEAR && backSteps < 5) {
        year -= 1; backSteps += 1;
        events = await this.getSeasonSchedule(year);
        completed = this.filterCompleted(events);
      }

      if (!completed || completed.length === 0) {
        this.setStat(this.dom.ppg, '--'); this.setStat(this.dom.ypg, '--');
        this.setStat(this.dom.passYpg, '--'); this.setStat(this.dom.rushYpg, '--');
        this.setStat(this.dom.defPpg, '--'); this.setStat(this.dom.defYpg, '--');
        this.setStat(this.dom.turnovers, '--'); this.setStat(this.dom.sacks, '--');
        return;
      }

      let games = 0;
      let pts=0, oppPts=0, passYds=0, rushYds=0, totalYds=0, oppTotalYds=0, sacks=0, toForced=0;

      for (let i=0;i<completed.length;i++) {
        const e = completed[i];
        const sum = await this.getSummary(year, e.id);
        const parsed = this.parseSummaryStats(sum, e);
        if (!parsed) continue;
        games++;
        pts += parsed.pts; oppPts += parsed.oppPts;
        passYds += parsed.passYds; rushYds += parsed.rushYds; totalYds += parsed.totalYds;
        oppTotalYds += parsed.oppTotalYds;
        sacks += parsed.sacks; toForced += parsed.turnoversForced;
        if (this.isMobile && (i % this.summaryConcurrency === 0)) await new Promise(r => setTimeout(r, 120));
      }

      const avg = (v)=> (games ? (v/games) : 0);
      this.setStat(this.dom.ppg, games ? avg(pts).toFixed(1) : '--');
      this.setStat(this.dom.ypg, games ? avg(totalYds).toFixed(1) : '--');
      this.setStat(this.dom.passYpg, games ? avg(passYds).toFixed(1) : '--');
      this.setStat(this.dom.rushYpg, games ? avg(rushYds).toFixed(1) : '--');
      this.setStat(this.dom.defPpg, games ? avg(oppPts).toFixed(1) : '--');
      this.setStat(this.dom.defYpg, games ? avg(oppTotalYds).toFixed(1) : '--');
      this.setStat(this.dom.turnovers, games ? toForced : '--');
      this.setStat(this.dom.sacks, games ? sacks : '--');
    }

    filterCompleted(events) {
      return (events || []).filter((e) => {
        const st = e.status?.type || e.status || {};
        if (st.state === 'post' || st.completed === true) return true;
        // also consider as completed if both competitors have numeric scores
        const comp = e.competitions?.[0];
        const comps = comp?.competitors || [];
        const mine = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
        const opp = comps.find(x => x !== mine);
        const my = Number(mine?.score), th = Number(opp?.score);
        return Number.isFinite(my) && Number.isFinite(th);
      });
    }

    parseSummaryStats(summary, eFromSchedule) {
      let myPts=0, theirPts=0;
      try {
        const comp = eFromSchedule?.competitions?.[0];
        const comps = comp?.competitors || [];
        const mine = comps.find((x)=> String(x.team?.id)===String(this.TEAM_ID));
        const opp = comps.find((x)=> x!==mine);
        myPts = Number(mine?.score); theirPts = Number(opp?.score);
      } catch {}
      if (!Number.isFinite(myPts) || !Number.isFinite(theirPts)) {
        try {
          const hcomp = summary?.header?.competitions?.[0];
          const hcomps = hcomp?.competitors || [];
          const hmine = hcomps?.find(x => String(x.team?.id) === String(this.TEAM_ID));
          const hopp = hcomps?.find(x => x !== hmine);
          myPts = Number(hmine?.score); theirPts = Number(hopp?.score);
        } catch {}
      }

      let totalYds=0, passYds=0, rushYds=0, oppTotalYds=0, sacks=0, turnoversForced=0;
      try {
        const teams = summary?.boxscore?.teams;
        if (Array.isArray(teams) && teams.length === 2) {
          const idxMine = teams.findIndex((t)=> String(t.team?.id)===String(this.TEAM_ID));
          const idxOpp = idxMine === 0 ? 1 : 0;
          const me = teams[idxMine], opp = teams[idxOpp];

          const grab = (obj, names) => {
            if (!obj || !Array.isArray(obj.statistics)) return 0;
            const flat = [];
            obj.statistics.forEach((s)=> {
              flat.push(s);
              if (Array.isArray(s.categories)) s.categories.forEach((cat)=> { if (Array.isArray(cat.stats)) flat.push(...cat.stats); });
            });
            for (const entry of flat) {
              const name = (entry.name || entry.displayName || '').toLowerCase();
              if (names.some(n => name.includes(n))) {
                const val = parseFloat(entry.value || entry.displayValue || '0');
                if (!Number.isNaN(val)) return val;
                const dv = (entry.displayValue || '').toString();
                const first = parseFloat(dv.split(/[-/:]/)[0]);
                if (!Number.isNaN(first)) return first;
              }
            }
            return 0;
          };

          totalYds = grab(me, ['total yards']);
          passYds = grab(me, ['passing yards','pass yards']);
          rushYds = grab(me, ['rushing yards','rush yards']);
          sacks += grab(me, ['sacks']);
          oppTotalYds = grab(opp, ['total yards']);
          turnoversForced += grab(opp, ['turnovers']);
        }
      } catch {}

      if (!totalYds && (passYds || rushYds)) totalYds = passYds + rushYds;
      return { pts: myPts, oppPts: theirPts, totalYds, passYds, rushYds, oppTotalYds, sacks, turnoversForced };
    }

    // -------------- History --------------
    async loadHistory() {
      const container = this.dom.seasonRecords;
      if (!container) return;
      container.innerHTML = '';

      const years = this.availableYears.slice().reverse(); // oldest -> newest
      for (const y of years) {
        const events = await this.getSeasonSchedule(y);
        let rec;
        if (events && events.length) rec = await this.computeSeasonRecordFromEvents(y, events);
        const overall = rec && (rec.w + rec.l + rec.t) > 0 ? `Overall: ${rec.w}-${rec.l}${rec.t ? `-${rec.t}` : ''}` : 'Overall: —';
        const conf = rec ? `Conference: ${rec.cw}-${rec.cl}${rec.ct ? `-${rec.ct}` : ''}` : 'Conference: 0-0';

        const div = document.createElement('div');
        div.className = 'season-record';
        div.innerHTML = `
          <span><strong>${y}</strong></span>
          <span>${overall}</span>
          <span>${conf}</span>`;
        container.appendChild(div);
        if (this.isMobile) await new Promise(r => setTimeout(r, 50));
      }
    }

    // -------------- Roster/Depth (hardcoded) --------------
    async loadRoster() {
      this.renderDepthShell();
      this.displayDepthChart('offense');
    }
    renderDepthShell() {
      const host = this.dom.rosterTab;
      if (!host) return;
      const existing = document.getElementById('depth-chart-section');
      if (existing) existing.remove();

      const section = document.createElement('div');
      section.id = 'depth-chart-section';
      section.innerHTML = `
        <div class="depth-chart-header">
          <h2>Indiana Football Depth Chart</h2>
          <div class="depth-chart-controls">
            <select id="roster-year-select" class="year-select">
              ${[2025, 2024].map(y => `<option value="${y}" ${y===this.currentRosterYear?'selected':''}>${y}</option>`).join('')}
            </select>
            <button class="depth-btn active" data-unit="offense">Offense</button>
            <button class="depth-btn" data-unit="defense">Defense</button>
            <button class="depth-btn" data-unit="specialists">Specialists</button>
          </div>
        </div>
        <div id="depth-chart-content" class="depth-chart-content"></div>`;
      host.appendChild(section);

      section.querySelector('#roster-year-select').addEventListener('change', (e) => {
        this.currentRosterYear = parseInt(e.target.value, 10);
        section.querySelectorAll('.depth-btn').forEach(b => b.classList.remove('active'));
        section.querySelector('[data-unit="offense"]').classList.add('active');
        this.displayDepthChart('offense');
      });
      section.querySelectorAll('.depth-btn').forEach((b) => {
        b.addEventListener('click', () => {
          section.querySelectorAll('.depth-btn').forEach(bb => bb.classList.remove('active'));
          b.classList.add('active');
          this.displayDepthChart(b.dataset.unit);
        });
      });
    }
    displayDepthChart(unit) {
      const container = document.getElementById('depth-chart-content');
      const dc = this.depthCharts[this.currentRosterYear];
      if (!dc || !dc[unit]) {
        container.innerHTML = '<div class="no-data"><p>No depth chart data available for this year.</p></div>';
        return;
      }
      if (unit === 'offense') this.renderOffense(container, dc[unit]);
      else if (unit === 'defense') this.renderDefense(container, dc[unit]);
      else this.renderSpecial(container, dc[unit]);
    }
    renderOffense(container, data) {
      container.innerHTML = `
        <div class="formation">
          <div class="formation-line skill-positions">
            <div class="position-group"><h4>X-WR</h4>${this.playersHtml(data['X-WR'])}</div>
            <div class="position-group"><h4>SL-WR</h4>${this.playersHtml(data['SL-WR'])}</div>
            <div class="position-group"><h4>Z-WR</h4>${this.playersHtml(data['Z-WR'])}</div>
          </div>
          <div class="formation-line backfield">
            <div class="position-group"><h4>QB</h4>${this.playersHtml(data['QB'])}</div>
            <div class="position-group"><h4>HB</h4>${this.playersHtml(data['HB'])}</div>
            <div class="position-group"><h4>TE</h4>${this.playersHtml(data['TE'])}</div>
          </div>
          <div class="formation-line offensive-line">
            <div class="position-group"><h4>LT</h4>${this.playersHtml(data['LT'])}</div>
            <div class="position-group"><h4>LG</h4>${this.playersHtml(data['LG'])}</div>
            <div class="position-group"><h4>C</h4>${this.playersHtml(data['C'])}</div>
            <div class="position-group"><h4>RG</h4>${this.playersHtml(data['RG'])}</div>
            <div class="position-group"><h4>RT</h4>${this.playersHtml(data['RT'])}</div>
          </div>
        </div>`;
    }
    renderDefense(container, data) {
      const keys = Object.keys(data);
      const line = keys.filter(k=>k.includes('DT')||k.includes('DE')||k==='STUD');
      const lbs = keys.filter(k=>k.includes('LB')||k==='Rover');
      const sec = keys.filter(k=>k.includes('CB')||k.includes('SS')||k.includes('FS')||k==='NB');
      container.innerHTML = `
        <div class="formation">
          <div class="formation-line defensive-line">
            ${line.map(p=>`<div class="position-group"><h4>${p}</h4>${this.playersHtml(data[p])}</div>`).join('')}
          </div>
          <div class="formation-line linebackers">
            ${lbs.map(p=>`<div class="position-group"><h4>${p}</h4>${this.playersHtml(data[p])}</div>`).join('')}
          </div>
          <div class="formation-line secondary">
            ${sec.map(p=>`<div class="position-group"><h4>${p}</h4>${this.playersHtml(data[p])}</div>`).join('')}
          </div>
        </div>`;
    }
    renderSpecial(container, data) {
      container.innerHTML = `
        <div class="formation special-teams">
          <div class="formation-line">
            ${Object.keys(data).map(p=>`<div class="position-group"><h4>${p}</h4>${this.playersHtml(data[p])}</div>`).join('')}
          </div>
        </div>`;
    }
    playersHtml(arr){ if(!arr||!arr.length)return `<div class="depth-player backup"><span class="depth-name">No players listed</span></div>`; return arr.map((n,i)=>`<div class="depth-player ${i===0?'starter':'backup'}"><span class="depth-name">${n}</span></div>`).join(''); }

    // -------------- UI + init --------------
    setupListeners() {
      document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const tab = btn.dataset.tab;
          document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
          document.querySelectorAll('.tab-content').forEach(tc=>tc.classList.remove('active'));
          document.getElementById(`${tab}-tab`).classList.add('active');

          if (tab === 'current') {
            await Promise.all([ this.loadTeamInfo(), this.loadRecentGames(), this.loadTeamStats() ]);
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
          .map(y=>`<option value="${y}" ${y===this.currentYear?'selected':''}>${y}</option>`)
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
      try {
        await Promise.all([ this.loadTeamInfo(), this.loadRecentGames(), this.loadTeamStats() ]);
      } finally {
        this.hideLoading();
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => { new IndianaFootball(); });
})();