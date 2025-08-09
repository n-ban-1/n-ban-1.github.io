/* Indiana Hoosiers Football — Live ESPN Data (Team 84)
   Exclusively uses ESPN endpoints:
   - site.api.espn.com (team, schedule, summary)
   - cdn.espn.com (boxscore, play-by-play)
   - sports.core.api.espn.com (plays, drives, odds, probabilities, ATS)
   Features:
   - Final scores, status, TV, venue, Top 25 ranks only, records, roster
   - Per-game IU leaders in Recent Games
   - Schedule items expand to show TV, odds (if available), and last win-probability snapshot
   - Roster-derived depth chart with automatic fallback to prior season if roster missing
   - History computed back to 2001 (overall and conference), ATS if available
   - Mobile-friendly, request dedupe, caching, and timeouts
*/

(function () {
  'use strict';

  class IndianaFootball {
    constructor() {
      // Config
      this.TEAM_ID = 84; // IU
      this.MIN_YEAR = 2001;
      this.SEASONTYPE = 2; // Regular season for ATS
      const now = new Date();
      this.currentYear = now.getFullYear();
      this.availableYears = this.buildYears(this.currentYear, this.MIN_YEAR);

      // Bases
      this.BASES = {
        site: 'https://site.api.espn.com',
        core: 'https://sports.core.api.espn.com',
        cdn: 'https://cdn.espn.com',
      };

      // Dedupe + mobile tuning
      this.pending = new Map(); // key -> Promise
      this.isMobile = typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 768px)').matches
        : false;
      this.summaryConcurrency = this.isMobile ? 2 : 4;

      // DOM refs
      this.dom = {
        loading: document.getElementById('loading'),
        // header/current
        teamLogo: document.getElementById('team-logo'),
        teamName: document.getElementById('team-name'),
        teamRecord: document.getElementById('team-record'),
        confRecord: document.getElementById('conference-record'),
        confName: document.getElementById('conference-name'),
        teamRank: document.getElementById('team-ranking'),
        // stats
        ppg: document.getElementById('ppg'),
        ypg: document.getElementById('ypg'),
        passYpg: document.getElementById('pass-ypg'),
        rushYpg: document.getElementById('rush-ypg'),
        defPpg: document.getElementById('def-ppg'),
        defYpg: document.getElementById('def-ypg'),
        turnovers: document.getElementById('turnovers'),
        sacks: document.getElementById('sacks'),
        // lists
        recentGames: document.getElementById('recent-games'),
        scheduleList: document.getElementById('schedule-list'),
        seasonSelect: document.getElementById('season-select'),
        rosterTab: document.getElementById('roster-tab'),
        rosterList: document.getElementById('roster-list'),
        seasonRecords: document.getElementById('season-records'),
      };

      this.init();
    }

    // Utils
    buildYears(max, min) { const a=[]; for (let y=max; y>=min; y--) a.push(y); return a; }
    sleep(ms) { return new Promise((r)=>setTimeout(r, ms)); }
    lsk(k) { return `iu:${k}`; }

    getCache(key) {
      try {
        const raw = localStorage.getItem(this.lsk(key));
        if (!raw) return null;
        const { t, ttl, data } = JSON.parse(raw);
        if (Date.now() - t > ttl) { localStorage.removeItem(this.lsk(key)); return null; }
        return data;
      } catch { return null; }
    }
    setCache(key, data, ttlMs) {
      try { localStorage.setItem(this.lsk(key), JSON.stringify({ t: Date.now(), ttl: ttlMs, data })); } catch {}
    }

    async fetchJson(url, { retries = 1, timeout = 12000 } = {}) {
      for (let attempt=0; attempt<=retries; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeout);
        try {
          const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
          clearTimeout(timer);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.json();
        } catch (e) {
          clearTimeout(timer);
          if (attempt === retries) return null;
          await this.sleep(300 * (attempt + 1));
        }
      }
      return null;
    }

    async once(key, fn) {
      if (this.pending.has(key)) return this.pending.get(key);
      const p = (async()=>{ try { return await fn(); } finally { this.pending.delete(key); } })();
      this.pending.set(key, p);
      return p;
    }

    setText(el, val) { if (el) el.textContent = val; }
    setStat(el, val) { if (el) el.textContent = val == null ? '--' : val; }
    showLoading() { if (this.dom.loading) this.dom.loading.style.display = 'block'; }
    hideLoading() { if (this.dom.loading) this.dom.loading.style.display = 'none'; }

    fmtDateTime(dtStr) {
      const d = new Date(dtStr);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    top25(n) { const x = Number(n); return Number.isFinite(x) && x >= 1 && x <= 25 ? x : null; }

    // TEAM INFO
    async loadTeamInfo() {
      const key = `team:${this.TEAM_ID}`;
      const cached = this.getCache(key);
      if (cached) return this.renderTeamInfo(cached);

      const url = `${this.BASES.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}?enable=record,rankings,logos,conference`;
      const data = await this.fetchJson(url, { timeout: 10000 });
      const team = data?.team || null;
      if (team) this.setCache(key, team, 5 * 60 * 1000);
      this.renderTeamInfo(team);
    }
    renderTeamInfo(team) {
      if (!team) {
        this.dom.teamLogo.src = 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png';
        this.setText(this.dom.teamName, 'Indiana Hoosiers');
        this.setText(this.dom.teamRecord, 'TBD');
        this.setText(this.dom.confRecord, 'Conference: Big Ten');
        this.setText(this.dom.confName, 'Big Ten');
        this.setText(this.dom.teamRank, 'Unranked');
        return;
      }
      const logo = team.logos?.[0]?.href || 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png';
      this.dom.teamLogo.src = logo;
      this.setText(this.dom.teamName, team.displayName || 'Indiana Hoosiers');
      this.setText(this.dom.confName, team.conference?.name || 'Big Ten');

      // Records
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

      // Rank (Top 25 only)
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
    }

    // SCHEDULE
    async getSchedule(year) {
      const y = year || this.currentYear;
      const key = `schedule:${this.TEAM_ID}:${y}`;
      const cached = this.getCache(key);
      if (cached) return cached;

      return await this.once(key, async () => {
        const url = `${this.BASES.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}/schedule?season=${y}`;
        const json = await this.fetchJson(url, { timeout: 12000 });
        let events = [];
        if (Array.isArray(json?.events)) events = json.events;
        else if (Array.isArray(json?.team?.events)) events = json.team.events;
        this.setCache(key, events, 10 * 60 * 1000);
        return events;
      });
    }
    async loadSchedule(year) {
      const events = await this.getSchedule(year);
      this.renderSchedule(events);
      // attach click expand handlers
      this.wireScheduleItemDetails();
      return events;
    }

    renderSchedule(events) {
      const c = this.dom.scheduleList;
      if (!c) return;
      c.innerHTML = '';

      if (!events || events.length === 0) {
        const div = document.createElement('div');
        div.className = 'schedule-item';
        div.innerHTML = `
          <div class="game-details">
            <div class="opponent-name">No games found</div>
            <div class="game-time">—</div>
            <div class="game-location">—</div>
          </div>
          <div class="game-status status-upcoming">TBD</div>
        `;
        c.appendChild(div);
        return;
      }

      events
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach((e) => {
          const comp = e.competitions?.[0];
          const comps = comp?.competitors || [];
          const mine = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
          const opp = comps.find(x => x !== mine);
          const isHome = (mine?.homeAway) === 'home';
          const oppName = opp?.team?.displayName || 'TBD';
          const oppTop = this.top25(opp?.curatedRank?.current);
          const oppRankText = oppTop ? `#${oppTop} ` : '';
          const venue = comp?.venue?.fullName || (isHome ? 'Memorial Stadium' : 'Away');

          // TV network
          const tv =
            comp?.broadcasts?.[0]?.names?.[0] ||
            comp?.geoBroadcasts?.[0]?.shortName || '';

          const timeStr = this.fmtDateTime(e.date);

          // Status chip
          let statusClass = 'status-upcoming';
          let statusText = 'TBD';
          const st = e.status?.type;
          if (st?.state === 'pre') {
            statusClass = 'status-upcoming';
            statusText = 'TBD';
          } else if (st?.state === 'in') {
            statusClass = 'status-live';
            const period = comp?.status?.period;
            const clock = comp?.status?.displayClock;
            statusText = (period && clock) ? `LIVE Q${period} ${clock}` : 'LIVE';
          } else if (st?.state === 'post' || e.completed) {
            statusClass = 'status-final';
            if (mine && opp) {
              const my = Number(mine.score || 0);
              const th = Number(opp.score || 0);
              const wl = my > th ? 'W' : (my < th ? 'L' : 'T');
              statusText = `${wl} ${my}-${th}`;
            } else {
              statusText = 'Final';
            }
          }

          const item = document.createElement('div');
          item.className = 'schedule-item';
          item.setAttribute('data-event-id', e.id || '');
          item.innerHTML = `
            <div class="game-details">
              <div class="opponent">${isHome ? 'vs' : '@'} ${oppRankText}${oppName}</div>
              <div class="game-time">${timeStr}${tv ? ` • TV: ${tv}` : ''}</div>
              <div class="game-location">${venue}</div>
              <div class="game-extra" style="display:none;"></div>
            </div>
            <div class="game-status ${statusClass}">${statusText}</div>
          `;
          c.appendChild(item);
        });
    }

    wireScheduleItemDetails() {
      if (!this.dom.scheduleList) return;
      this.dom.scheduleList.querySelectorAll('.schedule-item').forEach((item) => {
        item.addEventListener('click', async () => {
          const eid = item.getAttribute('data-event-id');
          const extra = item.querySelector('.game-extra');
          if (!eid || !extra) return;

          // Toggle open/close
          if (extra.style.display === 'block') {
            extra.style.display = 'none';
            extra.innerHTML = '';
            return;
          }

          extra.style.display = 'block';
          extra.innerHTML = '<div class="row"><span class="badge">Loading game details...</span></div>';

          const details = await this.getGameDetails(eid);
          this.renderGameExtras(extra, details);
        });
      });
    }

    async getGameDetails(eventId) {
      // Fetch summary (site), odds (core), probabilities (core), try plays/drives optionally
      const [summary, odds, probabilities] = await Promise.all([
        this.fetchGameSummary(eventId),
        this.fetchGameOdds(eventId),
        this.fetchGameProbabilities(eventId),
      ]);
      return { summary, odds, probabilities };
    }

    renderGameExtras(container, data) {
      const { summary, odds, probabilities } = data || {};
      const rows = [];

      // Leaders (both teams, concise)
      try {
        const leadersCats = summary?.leaders?.leaders;
        if (Array.isArray(leadersCats) && leadersCats.length) {
          const catShort = (n) => {
            n = (n || '').toLowerCase();
            if (n.includes('pass')) return 'Pass';
            if (n.includes('rush')) return 'Rush';
            if (n.includes('receiv')) return 'Rec';
            return n;
          };
          const oneCat = leadersCats.slice(0,3).map((cat) => {
            const nm = catShort(cat.name || cat.displayName);
            const leader = cat.leaders?.[0];
            const name = leader?.athlete?.displayName || '—';
            const stat = leader?.displayValue || leader?.value || '';
            return `${nm}: ${name} ${stat}`;
          }).join(' • ');
          if (oneCat) rows.push(`<div class="row"><span class="badge">Leaders</span><span>${oneCat}</span></div>`);
        }
      } catch {}

      // Odds: show one provider line if exists (e.g., spread and O/U)
      try {
        const items = odds?.items || odds?.odds || odds; // endpoint returns items[]
        let lineText = '';
        if (Array.isArray(items) && items.length) {
          const first = items[0];
          const providerName = first?.provider?.name || first?.details || 'Odds';
          // Try to extract spread and over/under
          // Different shapes exist; try displayString or overUnder/spread
          const ds = first?.displayString;
          let ou = first?.overUnder;
          let spr = first?.spread;
          if (!ou && first?.overUnder?.alt) ou = first.overUnder.alt;
          if (!spr && first?.spread?.alt) spr = first.spread.alt;
          if (ds) lineText = ds;
          else {
            const parts = [];
            if (spr != null) parts.push(`Spread: ${spr}`);
            if (ou != null) parts.push(`O/U: ${ou}`);
            lineText = parts.join(' • ');
          }
          if (lineText) rows.push(`<div class="row"><span class="badge">Odds</span><span>${providerName}: ${lineText}</span></div>`);
        }
      } catch {}

      // Probabilities: Show last snapshot if available
      try {
        const probs = probabilities?.items || probabilities?.probabilities || probabilities;
        if (Array.isArray(probs) && probs.length) {
          const last = probs[probs.length - 1];
          const homeWin = last?.homeWinPercentage ?? null;
          const awayWin = last?.awayWinPercentage ?? null;
          if (homeWin != null && awayWin != null) {
            const hPct = Math.round(homeWin * 100);
            const aPct = Math.round(awayWin * 100);
            rows.push(`<div class="row"><span class="badge">Win Prob</span><span>Home ${hPct}% • Away ${aPct}%</span></div>`);
          }
        }
      } catch {}

      if (!rows.length) {
        container.innerHTML = `<div class="row"><span>No extra details available.</span></div>`;
      } else {
        container.innerHTML = rows.join('');
      }
    }

    // RECENT GAMES with per-game IU leaders
    async loadRecentGames() {
      const c = this.dom.recentGames;
      if (!c) return;
      c.innerHTML = '';

      const events = await this.getSchedule(this.currentYear);
      if (!events || events.length === 0) {
        c.innerHTML = '<div class="game-item"><div>No recent games.</div></div>';
        return;
      }

      const now = Date.now();
      const recent = events
        .filter((e) => {
          const st = e.status?.type;
          if (!st) return new Date(e.date).getTime() <= now;
          return st.state === 'post' || e.completed || st.state === 'in' || new Date(e.date).getTime() <= now;
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

      if (recent.length === 0) {
        const upcoming = events
          .filter((e) => e.status?.type?.state === 'pre' || !e.status)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, 5);
        upcoming.forEach((e) => {
          const comp = e.competitions?.[0];
          const comps = comp?.competitors || [];
          const mine = comps.find((x) => String(x.team?.id) === String(this.TEAM_ID));
          const opp = comps.find((x) => x !== mine);
          const isHome = (mine?.homeAway) === 'home';
          const oppName = opp?.team?.displayName || 'TBD';

          const div = document.createElement('div');
          div.className = 'game-item';
          div.innerHTML = `
            <div class="game-info">
              <div class="opponent">${isHome ? 'vs' : '@'} ${oppName}</div>
              <div class="game-date">${this.fmtDateTime(e.date)}</div>
            </div>
            <div class="game-result upcoming">—</div>
          `;
          c.appendChild(div);
        });
        return;
      }

      // Batch summaries
      const batches = [];
      for (let i = 0; i < recent.length; i += this.summaryConcurrency) {
        batches.push(recent.slice(i, i + this.summaryConcurrency));
      }

      for (const batch of batches) {
        const summaries = await Promise.all(batch.map((e) => this.fetchGameSummary(e.id)));
        batch.forEach((e, idx) => {
          const comp = e.competitions?.[0];
          const comps = comp?.competitors || [];
          const mine = comps.find((x) => String(x.team?.id) === String(this.TEAM_ID));
          const opp = comps.find((x) => x !== mine);
          const isHome = (mine?.homeAway) === 'home';
          const oppName = opp?.team?.displayName || 'TBD';

          let cls = 'upcoming';
          let resText = '—';
          const st = e.status?.type;
          if (st?.state === 'in') {
            cls = 't';
            const period = comp?.status?.period;
            const clock = comp?.status?.displayClock;
            resText = (period && clock) ? `LIVE Q${period} ${clock}` : 'LIVE';
          } else if (st?.state === 'post' || e.completed) {
            const my = Number(mine?.score || 0);
            const th = Number(opp?.score || 0);
            const wl = my > th ? 'W' : (my < th ? 'L' : 'T');
            cls = wl.toLowerCase();
            resText = `${wl} ${my}-${th}`;
          }

          const leaders = this.extractTeamLeaders(summaries[idx], this.TEAM_ID);
          let leadersHtml = '';
          if (leaders) {
            const p = leaders.passing ? `${leaders.passing.name} ${leaders.passing.stat}` : '—';
            const r = leaders.rushing ? `${leaders.rushing.name} ${leaders.rushing.stat}` : '—';
            const rc = leaders.receiving ? `${leaders.receiving.name} ${leaders.receiving.stat}` : '—';
            leadersHtml = `
              <div class="game-leaders" style="margin-top:6px; font-size: 0.85rem;">
                <div>P: ${p}</div>
                <div>R: ${r}</div>
                <div>Rec: ${rc}</div>
              </div>
            `;
          }

          const d = document.createElement('div');
          d.className = 'game-item';
          d.innerHTML = `
            <div class="game-info">
              <div class="opponent">${isHome ? 'vs' : '@'} ${oppName}</div>
              <div class="game-date">${this.fmtDateTime(e.date)}</div>
              ${leadersHtml}
            </div>
            <div class="game-result ${cls}">${resText}</div>
          `;
          this.dom.recentGames.appendChild(d);
        });
        await this.sleep(this.isMobile ? 200 : 100);
      }
    }

    extractTeamLeaders(summary, teamId) {
      try {
        const cats = summary?.leaders?.leaders;
        if (!Array.isArray(cats)) return null;

        const findCat = (needle) =>
          cats.find(c => (c.name || c.displayName || '').toString().toLowerCase().includes(needle));

        const pack = (cat) => {
          if (!cat || !Array.isArray(cat.leaders)) return null;
          const mine = cat.leaders.find(l => String(l.team?.id) === String(teamId)) || cat.leaders[0];
          if (!mine?.athlete) return null;
          const name = mine.athlete.displayName || mine.athlete.shortName || '—';
          const stat = mine.displayValue || mine.value || '';
          return { name, stat };
        };

        return {
          passing: pack(findCat('pass')),
          rushing: pack(findCat('rush')),
          receiving: pack(findCat('receiv')),
        };
      } catch {
        return null;
      }
    }

    // STATS aggregated from summaries
    async loadTeamStats() {
      const events = await this.getSchedule(this.currentYear);
      const completed = (events || []).filter((e) => {
        const st = e.status?.type;
        return st && (st.state === 'post' || e.completed);
      });

      if (!completed.length) {
        this.setStat(this.dom.ppg, '--');
        this.setStat(this.dom.ypg, '--');
        this.setStat(this.dom.passYpg, '--');
        this.setStat(this.dom.rushYpg, '--');
        this.setStat(this.dom.defPpg, '--');
        this.setStat(this.dom.defYpg, '--');
        this.setStat(this.dom.turnovers, '--');
        this.setStat(this.dom.sacks, '--');
        return;
      }

      const batches = [];
      for (let i=0; i<completed.length; i+=this.summaryConcurrency) {
        batches.push(completed.slice(i, i+this.summaryConcurrency));
      }

      let games=0;
      let pts=0, oppPts=0;
      let passYds=0, rushYds=0, totalYds=0, oppTotalYds=0;
      let sacks=0, toForced=0;

      for (const batch of batches) {
        const results = await Promise.all(batch.map((e) => this.fetchGameSummary(e.id)));
        batch.forEach((ev, idx) => {
          const p = this.parseSummaryStats(results[idx], ev);
          if (!p) return;
          games++;
          pts += p.pts; oppPts += p.oppPts;
          passYds += p.passYds; rushYds += p.rushYds; totalYds += p.totalYds;
          oppTotalYds += p.oppTotalYds;
          sacks += p.sacks; toForced += p.turnoversForced;
        });
        await this.sleep(this.isMobile ? 200 : 100);
      }

      const avg = (v)=> (games ? (v/games) : 0);
      this.setStat(this.dom.ppg, games ? avg(pts).toFixed(1) : '--');
      this.setStat(this.dom.ypg, games ? avg(totalYds).toFixed(1) : '--');
      this.setStat(this.dom.passYpg, games ? avg(passYds).toFixed(1) : '--');
      this.setStat(this.dom.rushYpg, games ? avg(rushYds).toFixed(1) : '--');
      this.setStat(this.dom.defPpg, games ? avg(oppPts).toFixed(1) : '--');
      this.setStat(this.dom.defYpg, games ? avg(oppTotalYds).toFixed(1) : '--');
      this.setStat(this.dom.turnovers, games ? toForced : '--'); // totals
      this.setStat(this.dom.sacks, games ? sacks : '--'); // totals
    }

    parseSummaryStats(summary, eventFromSchedule) {
      let myPts=0, theirPts=0;
      try {
        const comp = eventFromSchedule?.competitions?.[0];
        const comps = comp?.competitors || [];
        const mine = comps.find((x) => String(x.team?.id) === String(this.TEAM_ID));
        const opp = comps.find((x) => x !== mine);
        myPts = Number(mine?.score || 0);
        theirPts = Number(opp?.score || 0);
      } catch {}

      let totalYds=0, passYds=0, rushYds=0, oppTotalYds=0, sacks=0, turnoversForced=0;
      try {
        const teams = summary?.boxscore?.teams;
        if (Array.isArray(teams) && teams.length === 2) {
          const idxMine = teams.findIndex((t) => String(t.team?.id) === String(this.TEAM_ID));
          const idxOpp = idxMine === 0 ? 1 : 0;
          const me = teams[idxMine];
          const opp = teams[idxOpp];
          const grab = (obj, names) => {
            if (!obj || !Array.isArray(obj.statistics)) return 0;
            const flat = [];
            obj.statistics.forEach((s) => {
              flat.push(s);
              if (Array.isArray(s.categories)) s.categories.forEach((cat) => {
                if (Array.isArray(cat.stats)) flat.push(...cat.stats);
              });
            });
            for (const entry of flat) {
              const name = (entry.name || entry.displayName || '').toString().toLowerCase();
              if (names.some(n => name.includes(n))) {
                const val = parseFloat(entry.value || entry.displayValue || '0');
                if (!Number.isNaN(val)) return val;
                const dv = (entry.displayValue || '').toString();
                const first = parseFloat(dv.split(/[-\/:]/)[0]);
                if (!Number.isNaN(first)) return first;
              }
            }
            return 0;
          };
          totalYds = grab(me, ['total yards']);
          passYds = grab(me, ['passing yards', 'pass yards']);
          rushYds = grab(me, ['rushing yards', 'rush yards']);
          sacks += grab(me, ['sacks']);
          oppTotalYds = grab(opp, ['total yards']);
          turnoversForced += grab(opp, ['turnovers']);
        }
      } catch {}

      if (!totalYds && (passYds || rushYds)) totalYds = passYds + rushYds;
      return { pts: myPts, oppPts: theirPts, totalYds, passYds, rushYds, oppTotalYds, sacks, turnoversForced };
    }

    // GAME ENDPOINTS
    async fetchGameSummary(eventId) {
      const key = `summary:${eventId}`;
      const cached = this.getCache(key);
      if (cached) return cached;
      const url = `${this.BASES.site}/apis/site/v2/sports/football/college-football/summary?event=${eventId}`;
      const data = await this.fetchJson(url, { timeout: 12000 });
      if (data) this.setCache(key, data, 15 * 60 * 1000);
      return data;
    }
    async fetchGameOdds(eventId) {
      const key = `odds:${eventId}`;
      const cached = this.getCache(key);
      if (cached !== null) return cached;
      const url = `${this.BASES.core}/v2/sports/football/leagues/college-football/events/${eventId}/competitions/${eventId}/odds`;
      const data = await this.fetchJson(url, { timeout: 10000 });
      // Cache even null to avoid repeated calls
      this.setCache(key, data, 15 * 60 * 1000);
      return data;
    }
    async fetchGameProbabilities(eventId) {
      const key = `prob:${eventId}`;
      const cached = this.getCache(key);
      if (cached !== null) return cached;
      const url = `${this.BASES.core}/v2/sports/football/leagues/college-football/events/${eventId}/competitions/${eventId}/probabilities`;
      const data = await this.fetchJson(url, { timeout: 10000 });
      this.setCache(key, data, 15 * 60 * 1000);
      return data;
    }

    // ROSTER + DEPTH (derived from roster positions) with fallback to prior season
    async loadRosterAndDepthChart(year) {
      const season = year || this.currentYear;
      const { roster, seasonUsed } = await this.fetchRosterWithFallback(season);
      this.renderDepthFromRoster(roster, season, seasonUsed);
    }
    async fetchRosterWithFallback(season) {
      const trySeason = async (yr) => ({ list: await this.fetchRoster(yr), yr });
      let { list, yr } = await trySeason(season);
      if (!list || list.length === 0) {
        for (let y = season - 1; y >= this.MIN_YEAR; y--) {
          const t = await trySeason(y);
          if (t.list && t.list.length) { list = t.list; yr = t.yr; break; }
        }
      }
      return { roster: list || [], seasonUsed: yr };
    }
    async fetchRoster(season) {
      const key = `roster:${this.TEAM_ID}:${season}`;
      const cached = this.getCache(key);
      if (cached) return cached;

      const url1 = `${this.BASES.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}/roster?season=${season}`;
      let payload = await this.fetchJson(url1, { timeout: 12000 });
      let roster = this.normalizeRoster(payload);

      if (!roster) {
        const url2 = `${this.BASES.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}?enable=roster`;
        payload = await this.fetchJson(url2, { timeout: 12000 });
        roster = this.normalizeRoster(payload);
      }

      if (!roster) roster = [];
      this.setCache(key, roster, 30 * 60 * 1000);
      return roster;
    }
    normalizeRoster(payload) {
      let list = null;
      if (Array.isArray(payload?.athletes)) list = payload.athletes;
      else if (payload?.team?.athletes) list = payload.team.athletes;
      else if (payload?.athletes?.athletes) list = payload.athletes.athletes;

      const athletes = [];
      if (Array.isArray(list)) {
        list.forEach((grp) => {
          if (Array.isArray(grp?.items)) grp.items.forEach((a) => athletes.push(a));
          else if (Array.isArray(grp)) grp.forEach((a) => athletes.push(a));
          else athletes.push(grp);
        });
      }

      return (athletes || [])
        .map((a) => {
          const id = a.id || a.athlete?.id;
          const displayName = a.displayName || a.athlete?.displayName;
          const position = (a.position?.abbreviation || a.position?.name)
            || a.athlete?.position?.abbreviation || a.athlete?.position?.name || '';
          const jersey = a.jersey || a.athlete?.jersey || '';
          return { id, displayName, position, jersey };
        })
        .filter(x => x.id && x.displayName);
    }

    renderDepthFromRoster(roster, requestedSeason, seasonUsed) {
      const host = this.dom.rosterTab;
      if (!host) return;

      // Clear section if exists
      const old = host.querySelector('#depth-chart-section');
      if (old) old.remove();

      const notice = (seasonUsed && seasonUsed !== requestedSeason)
        ? `<div style="margin:0.5rem 0 1rem; color:#555; font-size:0.9rem;">Roster for ${requestedSeason} not yet on ESPN. Showing ${seasonUsed} roster.</div>`
        : '';

      const section = document.createElement('div');
      section.id = 'depth-chart-section';
      section.innerHTML = `
        <div class="depth-chart-header">
          <h2>Indiana Football Depth Chart</h2>
          <div class="depth-chart-controls">
            <select id="roster-year-select" class="year-select">
              ${this.availableYears.map((y) => `<option value="${y}" ${y === requestedSeason ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
            <button class="depth-btn active" data-unit="offense">Offense</button>
            <button class="depth-btn" data-unit="defense">Defense</button>
            <button class="depth-btn" data-unit="specialists">Specialists</button>
          </div>
        </div>
        ${notice}
        <div id="depth-chart-content" class="depth-chart-content"></div>
      `;
      host.appendChild(section);

      section.querySelector('#roster-year-select').addEventListener('change', async (e) => {
        const y = parseInt(e.target.value, 10);
        await this.loadRosterAndDepthChart(y);
      });

      const groups = this.groupRoster(roster);
      const contentEl = section.querySelector('#depth-chart-content');
      const buttons = section.querySelectorAll('.depth-btn');
      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          buttons.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.renderDepthUnit(contentEl, groups, btn.dataset.unit);
        });
      });
      this.renderDepthUnit(contentEl, groups, 'offense');

      // Simple roster grid
      this.renderRosterGrid(roster);
    }

    groupRoster(roster) {
      const posMap = {};
      const byPos = new Map();
      (roster || []).forEach((p) => {
        const pos = (p.position || '').toUpperCase() || 'UNK';
        if (!byPos.has(pos)) byPos.set(pos, []);
        byPos.get(pos).push(p);
      });
      for (const [pos, list] of byPos.entries()) {
        list.sort((a, b) => {
          const ja = parseInt(a.jersey || '999', 10);
          const jb = parseInt(b.jersey || '999', 10);
          if (Number.isFinite(ja) && Number.isFinite(jb) && ja !== jb) return ja - jb;
          return a.displayName.localeCompare(b.displayName);
        });
        posMap[pos] = list.map((x) => x.displayName);
      }

      // Heuristic grouping
      const offenseSet = new Set(['QB','RB','TB','HB','FB','WR','XWR','ZWR','SLWR','TE','LT','LG','C','RG','RT','OL']);
      const defenseSet = new Set(['DE','DT','NT','DL','EDGE','LB','MLB','WLB','SLB','CB','DB','S','FS','SS','NB','ROVER','STUD']);
      const specSet = new Set(['K','PK','P','PT','LS','KR','PR','KO','H']);

      const groups = { offense: {}, defense: {}, specialists: {} };
      const normalize = (p) => p.replace(/[^A-Z]/gi, '').toUpperCase();

      Object.keys(posMap).forEach((pos) => {
        const key = normalize(pos);
        if (offenseSet.has(key)) groups.offense[pos] = posMap[pos];
        else if (defenseSet.has(key)) groups.defense[pos] = posMap[pos];
        else if (specSet.has(key)) groups.specialists[pos] = posMap[pos];
        else {
          if (key.includes('WR')||key.includes('QB')||key.includes('RB')||key.includes('TE')||key.includes('OL')) groups.offense[pos] = posMap[pos];
          else if (key.includes('CB')||key.includes('LB')||key.includes('S')||key.includes('DT')||key.includes('DE')) groups.defense[pos] = posMap[pos];
          else groups.specialists[pos] = posMap[pos];
        }
      });
      return groups;
    }

    renderDepthUnit(container, groups, unit) {
      const data = groups[unit] || {};
      const posKeys = Object.keys(data).sort();
      if (!posKeys.length) {
        container.innerHTML = '<div class="no-data"><p>No roster data available from ESPN for this season.</p></div>';
        return;
      }
      const chunk = 5;
      const lines = [];
      for (let i=0; i<posKeys.length; i+=chunk) {
        const slice = posKeys.slice(i, i+chunk);
        lines.push(`
          <div class="formation-line ${unit==='offense'?'offensive-line': unit==='defense'?'defensive-line':'special-teams'}">
            ${slice.map((pos)=>`
              <div class="position-group">
                <h4>${pos}</h4>
                ${this.renderPlayersList(data[pos])}
              </div>
            `).join('')}
          </div>
        `);
      }
      container.innerHTML = `<div class="formation">${lines.join('')}</div>`;
    }

    renderPlayersList(players) {
      if (!players || !players.length) return `<div class="depth-player backup"><span class="depth-name">No players listed</span></div>`;
      return players.map((name, i)=>`
        <div class="depth-player ${i===0?'starter':'backup'}"><span class="depth-name">${name}</span></div>
      `).join('');
    }

    renderRosterGrid(roster) {
      const host = this.dom.rosterList;
      if (!host) return;
      host.innerHTML = '';

      if (!Array.isArray(roster) || !roster.length) {
        host.innerHTML = '<div class="player-card">No roster data available from ESPN.</div>';
        return;
      }

      const sorted = roster.slice().sort((a, b) => {
        const pa = (a.position || '').toUpperCase();
        const pb = (b.position || '').toUpperCase();
        if (pa !== pb) return pa.localeCompare(pb);
        const ja = parseInt(a.jersey || '999', 10);
        const jb = parseInt(b.jersey || '999', 10);
        if (Number.isFinite(ja) && Number.isFinite(jb) && ja !== jb) return ja - jb;
        return a.displayName.localeCompare(b.displayName);
      });

      sorted.forEach((p) => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `
          <div class="player-number">#${p.jersey || '–'}</div>
          <div class="player-name">${p.displayName}</div>
          <div class="player-position">${p.position || ''}</div>
        `;
        host.appendChild(card);
      });
    }

    // HISTORY 2001–present: overall/conf from schedule; ATS (if available)
    async loadHistory() {
      const container = this.dom.seasonRecords;
      if (!container) return;
      container.innerHTML = '';

      const years = this.availableYears.slice().reverse(); // oldest to newest
      // Compute sequentially to avoid hammering the API on mobile
      for (const y of years) {
        const rec = await this.computeSeasonRecord(y);
        const ats = await this.fetchSeasonATS(y);
        const div = document.createElement('div');
        div.className = 'season-record';
        const overallValid = (rec.wins + rec.losses + (rec.ties || 0)) > 0;
        const overall = overallValid ? `Overall: ${rec.wins}-${rec.losses}${rec.ties ? `-${rec.ties}` : ''}` : 'Overall: —';
        const conf = (rec.confWins != null) ? `Conference: ${rec.confWins}-${rec.confLosses}${rec.confTies ? `-${rec.confTies}` : ''}` : 'Conference: —';
        const atsText = ats ? ` • ATS: ${ats}` : '';
        div.innerHTML = `
          <span><strong>${y}</strong></span>
          <span>${overall}</span>
          <span>${conf}${atsText}</span>
        `;
        container.appendChild(div);
        await this.sleep(this.isMobile ? 100 : 50);
      }
    }

    async computeSeasonRecord(year) {
      const events = await this.getSchedule(year);
      let wins=0, losses=0, ties=0, confWins=0, confLosses=0, confTies=0;

      (events || []).forEach((e) => {
        const st = e.status?.type;
        if (!(st && (st.state === 'post' || e.completed))) return;
        const comp = e.competitions?.[0];
        const comps = comp?.competitors || [];
        const mine = comps.find((x) => String(x.team?.id) === String(this.TEAM_ID));
        const opp = comps.find((x) => x !== mine);
        if (!mine || !opp) return;
        const my = Number(mine.score || 0);
        const th = Number(opp.score || 0);
        const isConf = (comp?.conferenceCompetition === true) ||
          ((e.groups?.[0]?.name) ? /big ten/i.test(e.groups[0].name) : false);

        if (my > th) { wins++; if (isConf) confWins++; }
        else if (my < th) { losses++; if (isConf) confLosses++; }
        else { ties++; if (isConf) confTies++; }
      });

      return { wins, losses, ties, confWins, confLosses, confTies };
    }

    async fetchSeasonATS(year) {
      // Best effort; not available for all years
      const key = `ats:${this.TEAM_ID}:${year}`;
      const cached = this.getCache(key);
      if (cached !== null) return cached;

      const url = `${this.BASES.core}/v2/sports/football/leagues/college-football/seasons/${year}/types/${this.SEASONTYPE}/teams/${this.TEAM_ID}/ats`;
      const data = await this.fetchJson(url, { timeout: 10000 });
      // Try to format e.g., "8-4-1"
      let out = null;
      try {
        const w = data?.record?.wins ?? data?.wins;
        const l = data?.record?.losses ?? data?.losses;
        const t = data?.record?.ties ?? data?.ties;
        if (w != null && l != null) out = `${w}-${l}${t ? `-${t}` : ''}`;
      } catch {}
      this.setCache(key, out, 60 * 60 * 1000);
      return out;
    }

    // UI
    setupListeners() {
      // Tabs
      document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const tab = btn.dataset.tab;
          document.querySelectorAll('.nav-btn').forEach((b)=>b.classList.remove('active'));
          btn.classList.add('active');
          document.querySelectorAll('.tab-content').forEach((tc)=>tc.classList.remove('active'));
          const t = document.getElementById(`${tab}-tab`);
          if (t) t.classList.add('active');

          if (tab === 'current') {
            await Promise.all([ this.loadTeamInfo(), this.loadRecentGames(), this.loadTeamStats() ]);
          } else if (tab === 'schedule') {
            await this.loadSchedule(this.currentYear);
          } else if (tab === 'roster') {
            await this.loadRosterAndDepthChart(this.currentYear);
          } else if (tab === 'history') {
            await this.loadHistory();
          }
        });
      });

      // Season selector (schedule)
      if (this.dom.seasonSelect) {
        this.dom.seasonSelect.innerHTML = this.availableYears
          .map((y)=>`<option value="${y}" ${y===this.currentYear?'selected':''}>${y}</option>`)
          .join('');
        this.dom.seasonSelect.addEventListener('change', async (e) => {
          this.currentYear = parseInt(e.target.value, 10);
          await this.loadSchedule(this.currentYear);
        });
      }
    }

    async init() {
      this.showLoading();
      this.setupListeners();
      try {
        await Promise.all([ this.loadTeamInfo(), this.loadRecentGames(), this.loadTeamStats() ]);
      } finally {
        this.hideLoading();
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => { new IndianaFootball(); });
})();