/* Indiana Hoosiers Football - COMPLETE VERSION WITH 3RD/4TH DOWN STATS
   Date: October 18, 2025
   Updated defensive stats to show opponent down conversion percentages
*/

(function () {
  'use strict';

  class IndianaFootball {
    constructor() {
      this.TEAM_ID = 84;
      this.DATA_BASE = './indiana_football_history';
      this.MIN_YEAR = 2001;
      this.ESPN = { site: 'https://site.api.espn.com' };

      const nowY = new Date().getFullYear();
      this.currentYear = nowY;
      this.availableYears = this.rangeYears(nowY, this.MIN_YEAR);

      this.isMobile = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 768px)').matches : false;
      this.summaryConcurrency = this.isMobile ? 2 : 4;

      this.mem = new Map();
      this.depthCharts = { 2025: this.dc2025(), 2024: this.dc2024() };
      this.currentRosterYear = 2025;

      this.dom = {
        loading: document.getElementById('loading'),
        teamLogo: document.getElementById('team-logo'),
        teamName: document.getElementById('team-name'),
        teamRecord: document.getElementById('team-record'),
        confName: document.getElementById('conference-name'),
        teamRank: document.getElementById('team-ranking'),
        ppg: document.getElementById('ppg'),
        ypg: document.getElementById('ypg'),
        passYpg: document.getElementById('pass-ypg'),
        rushYpg: document.getElementById('rush-ypg'),
        defPpg: document.getElementById('def-ppg'),
        oppThirdDown: document.getElementById('opp-third-down'),
        oppFourthDown: document.getElementById('opp-fourth-down'),
        recentGames: document.getElementById('recent-games'),
        scheduleList: document.getElementById('schedule-list'),
        seasonSelect: document.getElementById('season-select'),
        rosterTab: document.getElementById('roster-tab'),
        rosterList: document.getElementById('roster-list'),
        seasonRecords: document.getElementById('season-records'),
      };

      console.log('🏈 Indiana Football App Initialized - Version 3.0 (Down Conversion Stats)');
      this.init();
    }

    // ============ UTILITIES ============
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
    showLoading() { if (this.dom.loading) this.dom.loading.style.display = 'block'; }
    hideLoading() { if (this.dom.loading) this.dom.loading.style.display = 'none'; }
    
    fmtDateTime(s) { 
      const d = new Date(s); 
      if (Number.isNaN(d.getTime())) return ''; 
      return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); 
    }
    
    top25(n) { const x = Number(n); return Number.isFinite(x) && x >= 1 && x <= 25 ? x : null; }

    // CRITICAL: Score extraction from ESPN's format
    getScore(scoreObj) {
      if (!scoreObj) return null;
      if (typeof scoreObj === 'object' && scoreObj.value !== undefined) {
        const val = Number(scoreObj.value);
        return Number.isFinite(val) ? val : null;
      }
      const val = Number(scoreObj);
      return Number.isFinite(val) ? val : null;
    }

    // FIXED: Simple year-based logic - NO local files for 2025
    useLocalData(year) {
      return year < 2025;
    }

    // ============ NETWORK ============
    async fetchJson(url, { retries = 1, timeout = 12000 } = {}) {
      console.log(`🌐 Fetching: ${url}`);
      for (let a = 0; a <= retries; a++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeout);
        try {
          const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
          clearTimeout(timer);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          console.log(`✅ Fetch success: ${url}`);
          return await res.json();
        } catch (e) {
          clearTimeout(timer);
          console.warn(`❌ Fetch failed (attempt ${a + 1}): ${url}`, e.message);
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

    // ============ DEPTH CHARTS ============
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
          'CB1':['D\'Angelo Ponds','Amariyun Knighten','Dontrae Henderson'],
          'CB2':['Jamari Sharpe','Ryland Gandy','Jaylen Bell'],
          'STUD':['Mikail Kamara','Kellan Wyatt','Daniel Ndukwe','Triston Abram','Andrew Turvy'],
          'DT1':['Hosea Wheeler','Dominique Ratcliff','Kyler Garcia'],
          'DT2':['Tyrique Tucker','J\'Mari Monette','Jhrevious Hall'],
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
          'DT2':['Tyrique Tucker','J\'Mari Monette'],
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

    // ============ DATA RETRIEVAL - FIXED ============
    async getSeasonSchedule(year) {
      console.log(`📅 Getting schedule for ${year}`);
      const key = `sched:${year}`;
      const cached = this.mem.get(key) || this.getLS(key);
      if (cached) {
        console.log(`✅ Using cached schedule for ${year}`);
        return cached;
      }

      let events = [];
      
      // FIXED: Use API for 2025, local for older years
      if (this.useLocalData(year)) {
        console.log(`📂 Trying local data for ${year}`);
        const local = await this.fetchLocal(`${year}/schedule.json`);
        events = this.pickEventsArray(local);
        if (!events || events.length === 0) {
          console.log(`⚠️ Local data failed, using API for ${year}`);
          const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}/schedule?season=${year}`;
          const json = await this.fetchJson(url);
          events = this.pickEventsArray(json);
        }
      } else {
        console.log(`🌐 Using API for ${year}`);
        const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}/schedule?season=${year}`;
        const json = await this.fetchJson(url);
        events = this.pickEventsArray(json);
      }

      events = Array.isArray(events) ? events : [];
      console.log(`✅ Got ${events.length} events for ${year}`);
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
      console.log(`📄 Getting summary for event ${eventId} (${year})`);
      const key = `sum:${year}:${eventId}`;
      const cached = this.mem.get(key) || this.getLS(key);
      if (cached) {
        console.log(`✅ Using cached summary for ${eventId}`);
        return cached;
      }

      let data = null;
      
      // FIXED: Use API for 2025, local for older years
      if (this.useLocalData(year)) {
        data = await this.fetchLocal(`${year}/game_${eventId}/summary.json`);
        if (!data) {
          const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/summary?event=${eventId}`;
          data = await this.fetchJson(url);
        }
      } else {
        const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/summary?event=${eventId}`;
        data = await this.fetchJson(url);
      }

      if (data) {
        this.mem.set(key, data);
        this.setLS(key, data, 6 * 60 * 60 * 1000);
      }
      return data;
    }

    // ============ GAME LEADERS - FIXED ============
    extractGameLeaders(summary, teamId) {
      try {
        const cats = summary?.leaders?.leaders;
        if (!Array.isArray(cats)) return null;
        
        const find = (needle) => cats.find(c => (c.name || c.displayName || '').toLowerCase().includes(needle));
        const pack = (cat) => {
          if (!cat || !Array.isArray(cat.leaders)) return null;
          const mine = cat.leaders.find(l => String(l.team?.id) === String(teamId)) || cat.leaders[0];
          if (!mine?.athlete) return null;
          const name = mine.athlete.displayName || mine.athlete.shortName || '—';
          const stat = mine.displayValue || mine.value || '';
          return { name, stat };
        };
        
        return {
          passing: pack(find('pass')),
          rushing: pack(find('rush')),
          receiving: pack(find('receiv'))
        };
      } catch (e) {
        console.warn('⚠️ Failed to extract game leaders:', e);
        return null;
      }
    }

    // ============ TEAM INFO ============
    async loadTeamInfo() {
      console.log('🏈 Loading team info...');
      this.setText(this.dom.confName, 'Big Ten');
      
      try {
        const url = `${this.ESPN.site}/apis/site/v2/sports/football/college-football/teams/${this.TEAM_ID}?enable=record,rankings,logos,conference`;
        const resp = await this.fetchJson(url);
        const team = resp?.team;
        
        if (team) {
          const logo = team.logos?.[0]?.href || 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png';
          this.dom.teamLogo.src = logo;
          this.setText(this.dom.teamName, team.displayName || 'Indiana Hoosiers');

          let overall = 'TBD';
          const items = team.record?.items;
          
          if (Array.isArray(items) && items.length) {
            const total = items.find(i => i.type === 'total') || items[0];
            if (total?.summary) overall = total.summary;
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
          console.log('✅ Team info loaded');
          return;
        }
      } catch (e) {
        console.warn('⚠️ Team API failed, computing from games:', e);
      }

      // Fallback
      const events = await this.getSeasonSchedule(this.currentYear);
      const rec = await this.computeSeasonRecordFromEvents(this.currentYear, events);
      const overall = (rec.w + rec.l + rec.t) > 0 ? `${rec.w}-${rec.l}${rec.t ? `-${rec.t}` : ''}` : 'TBD';
      
      this.dom.teamLogo.src = 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png';
      this.setText(this.dom.teamName, 'Indiana Hoosiers');
      this.setText(this.dom.teamRecord, overall);
      this.setText(this.dom.teamRank, 'Unranked');
    }

    // ============ RECORDS - FIXED TO ALWAYS FETCH SUMMARIES ============
    async computeSeasonRecordFromEvents(year, events) {
      console.log(`📊 Computing record for ${year} from ${events?.length || 0} events`);
      let w = 0, l = 0, t = 0, cw = 0, cl = 0, ct = 0;
      
      for (const e of (events || [])) {
        // CRITICAL: Always fetch summary to get accurate data
        const sum = await this.getSummary(year, e.id);
        if (!sum) continue;

        const hcomp = sum?.header?.competitions?.[0];
        const hcomps = hcomp?.competitors || [];
        const hmine = hcomps.find(x => String(x.team?.id) === String(this.TEAM_ID));
        const hopp = hcomps.find(x => x !== hmine);
        
        const my = this.getScore(hmine?.score);
        const th = this.getScore(hopp?.score);
        const isConf = hcomp?.conferenceCompetition === true;
        
        if (my === null || th === null) continue;

        if (my > th) { w++; if (isConf) cw++; }
        else if (my < th) { l++; if (isConf) cl++; }
        else { t++; if (isConf) ct++; }
      }
      
      console.log(`✅ Record: ${w}-${l}-${t}, Conf: ${cw}-${cl}-${ct}`);
      return { w, l, t, cw, cl, ct };
    }

    // ============ SCHEDULE ============
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
        c.innerHTML = `<div class="schedule-item"><div class="game-details"><div class="opponent">No games found</div></div></div>`;
        return;
      }

      const sorted = events.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
      
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
      const sum = await this.getSummary(year, e.id);
      const hcomp = sum?.header?.competitions?.[0];
      const hcomps = hcomp?.competitors || [];
      const hmine = hcomps?.find(x => String(x.team?.id) === String(this.TEAM_ID));
      const hopp = hcomps?.find(x => x !== hmine);
      
      let my = this.getScore(hmine?.score);
      let th = this.getScore(hopp?.score);
      
      if (my !== null && th !== null && my >= 0 && th >= 0) {
        const wl = my > th ? 'W' : (my < th ? 'L' : 'T');
        return { statusClass: 'status-final', statusText: `${wl} ${my}-${th}` };
      }
      
      return { statusClass: 'status-upcoming', statusText: 'TBD' };
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
          extra.innerHTML = `<div class="row"><span class="badge">Loading...</span></div>`;

          const sum = await this.getSummary(year, eid);
          const rows = [];

          const hcomp = sum?.header?.competitions?.[0];
          const hcomps = hcomp?.competitors || [];
          const hmine = hcomps?.find(x => String(x.team?.id) === String(this.TEAM_ID));
          const hopp = hcomps?.find(x => x !== hmine);
          
          const myScore = this.getScore(hmine?.score);
          const oppScore = this.getScore(hopp?.score);
          
          if (myScore !== null && oppScore !== null) {
            rows.push(`<div class="row"><span class="badge">Score</span><span style="font-weight:700; font-size:1.1em;">Indiana ${myScore}, ${hopp?.team?.displayName || 'Opponent'} ${oppScore}</span></div>`);
          }

          // GAME LEADERS - PROMINENTLY DISPLAYED
          const leaders = this.extractGameLeaders(sum, this.TEAM_ID);
          if (leaders && (leaders.passing || leaders.rushing || leaders.receiving)) {
            rows.push(`<div class="row" style="font-weight:700; margin-top:16px; font-size:1.1em; color:#990000; border-bottom:2px solid #990000; padding-bottom:8px;"><span>🏆 GAME LEADERS</span></div>`);
            
            if (leaders.passing) {
              rows.push(`<div class="row" style="margin-top:8px;"><span class="badge" style="background:#990000; color:white; font-weight:600;">Passing</span><span style="font-weight:600;">${leaders.passing.name} - ${leaders.passing.stat}</span></div>`);
            }
            if (leaders.rushing) {
              rows.push(`<div class="row"><span class="badge" style="background:#990000; color:white; font-weight:600;">Rushing</span><span style="font-weight:600;">${leaders.rushing.name} - ${leaders.rushing.stat}</span></div>`);
            }
            if (leaders.receiving) {
              rows.push(`<div class="row"><span class="badge" style="background:#990000; color:white; font-weight:600;">Receiving</span><span style="font-weight:600;">${leaders.receiving.name} - ${leaders.receiving.stat}</span></div>`);
            }
          }

          // COMPREHENSIVE STATS
          try {
            const teams = sum?.boxscore?.teams;
            if (Array.isArray(teams) && teams.length === 2) {
              const idxMine = teams.findIndex(t => String(t.team?.id) === String(this.TEAM_ID));
              const idxOpp = idxMine === 0 ? 1 : 0;
              const me = teams[idxMine];
              const oppTeam = teams[idxOpp];

              const getStat = (obj, name) => {
                if (!obj?.statistics) return null;
                const stat = obj.statistics.find(s => (s.name || '').toLowerCase() === name.toLowerCase());
                return stat?.displayValue || stat?.value || null;
              };

              const myStats = {
                '1st Downs': getStat(me, 'firstDowns'),
                'Total Yards': getStat(me, 'totalYards'),
                'Passing': getStat(me, 'netPassingYards'),
                'Comp/Att': getStat(me, 'completionAttempts'),
                'Yards/Pass': getStat(me, 'yardsPerPass'),
                'Rushing': getStat(me, 'rushingYards'),
                'Rushing Attempts': getStat(me, 'rushingAttempts'),
                'Yards/Rush': getStat(me, 'yardsPerRushAttempt'),
                'Penalties': getStat(me, 'totalPenaltiesYards'),
                'Turnovers': getStat(me, 'turnovers'),
                '3rd Down Conv': getStat(me, 'thirdDownEff'),
                '4th Down Conv': getStat(me, 'fourthDownEff'),
                'Red Zone': getStat(me, 'redZoneAttempts'),
                'Sacks': getStat(me, 'sacks'),
                'Tackles For Loss': getStat(me, 'tacklesForLoss'),
                'Possession': getStat(me, 'possessionTime')
              };

              const oppStats = {
                '1st Downs': getStat(oppTeam, 'firstDowns'),
                'Total Yards': getStat(oppTeam, 'totalYards'),
                'Passing': getStat(oppTeam, 'netPassingYards'),
                'Comp/Att': getStat(oppTeam, 'completionAttempts'),
                'Rushing': getStat(oppTeam, 'rushingYards'),
                'Rushing Attempts': getStat(oppTeam, 'rushingAttempts'),
                'Penalties': getStat(oppTeam, 'totalPenaltiesYards'),
                'Turnovers': getStat(oppTeam, 'turnovers'),
                '3rd Down Conv': getStat(oppTeam, 'thirdDownEff'),
                '4th Down Conv': getStat(oppTeam, 'fourthDownEff')
              };

              rows.push(`<div class="row" style="font-weight:600; margin-top:16px; font-size:1.05em; color:#990000; border-bottom:2px solid #990000; padding-bottom:6px;"><span>INDIANA STATS</span></div>`);
              Object.entries(myStats).forEach(([label, val]) => {
                if (val) rows.push(`<div class="row"><span class="badge">${label}</span><span style="font-weight:600;">${val}</span></div>`);
              });

              rows.push(`<div class="row" style="font-weight:600; margin-top:16px; font-size:1.05em; color:#990000; border-bottom:2px solid #990000; padding-bottom:6px;"><span>OPPONENT STATS</span></div>`);
              Object.entries(oppStats).forEach(([label, val]) => {
                if (val) rows.push(`<div class="row"><span class="badge">${label}</span><span style="font-weight:600;">${val}</span></div>`);
              });
            }
          } catch (e) {
            console.warn('⚠️ Failed to extract boxscore stats:', e);
          }

          // Additional info
          try {
            const bs = sum?.header?.competitions?.[0]?.broadcasts || [];
            if (Array.isArray(bs) && bs.length) {
              const net = bs[0]?.names?.[0] || '';
              if (net) rows.push(`<div class="row" style="margin-top:12px;"><span class="badge">TV</span><span>${net}</span></div>`);
            }
          } catch {}

          try {
            const v = sum?.gameInfo?.venue?.fullName || sum?.header?.competitions?.[0]?.venue?.fullName;
            const a = sum?.gameInfo?.attendance;
            if (v) rows.push(`<div class="row"><span class="badge">Venue</span><span>${v}${a ? ` (${a})` : ''}</span></div>`);
          } catch {}

          extra.innerHTML = rows.length ? rows.join('') : `<div class="row"><span>No details</span></div>`;
        });
      });
    }

    // ============ RECENT GAMES - WITH LEADERS ============
    async loadRecentGames() {
      console.log('🎮 Loading recent games...');
      const c = this.dom.recentGames;
      if (!c) return;
      c.innerHTML = '';

      const events = await this.getSeasonSchedule(this.currentYear);
      if (!events || events.length === 0) {
        c.innerHTML = '<div class="game-item"><div>No recent games.</div></div>';
        return;
      }

      const completedGames = [];
      for (const e of events) {
        const sum = await this.getSummary(this.currentYear, e.id);
        const hcomp = sum?.header?.competitions?.[0];
        const hcomps = hcomp?.competitors || [];
        const hmine = hcomps?.find(x => String(x.team?.id) === String(this.TEAM_ID));
        const hopp = hcomps?.find(x => x !== hmine);
        
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
        c.innerHTML = '<div class="game-item"><div>No completed games yet.</div></div>';
        return;
      }

      for (const { event: e, summary, myScore, oppScore } of recent) {
        const comp = e.competitions?.[0];
        const comps = comp?.competitors || [];
        const mine = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
        const opp = comps.find(x => x !== mine);
        const isHome = (mine?.homeAway) === 'home';
        const oppName = opp?.team?.displayName || 'TBD';

        const wl = myScore > oppScore ? 'W' : (myScore < oppScore ? 'L' : 'T');
        const cls = wl.toLowerCase();
        const resText = `${wl} ${myScore}-${oppScore}`;

        let leadersHtml = '';
        const leaders = this.extractGameLeaders(summary, this.TEAM_ID);
        if (leaders) {
          const p = leaders.passing ? `${leaders.passing.name} ${leaders.passing.stat}` : '—';
          const r = leaders.rushing ? `${leaders.rushing.name} ${leaders.rushing.stat}` : '—';
          const rc = leaders.receiving ? `${leaders.receiving.name} ${leaders.receiving.stat}` : '—';
          leadersHtml = `
            <div class="game-leaders" style="margin-top:6px; font-size:0.85rem; color:#666;">
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
            <div class="game-date">${this.fmtDateTime(e.date)}</div>
            ${leadersHtml}
          </div>
          <div class="game-result ${cls}">${resText}</div>`;
        c.appendChild(d);
      }
      console.log(`✅ Loaded ${recent.length} recent games`);
    }

    // ============ TEAM STATS - UPDATED FOR 3RD/4TH DOWN % ============
    async loadTeamStats() {
      console.log('📊 Loading team stats...');
      let year = this.currentYear;
      let events = await this.getSeasonSchedule(year);
      let completed = await this.filterCompleted(events, year);
      let backSteps = 0;
      
      while ((!completed || completed.length === 0) && year > this.MIN_YEAR && backSteps < 5) {
        year -= 1;
        backSteps += 1;
        events = await this.getSeasonSchedule(year);
        completed = await this.filterCompleted(events, year);
      }

      if (!completed || completed.length === 0) {
        console.warn('⚠️ No completed games found');
        this.setStat(this.dom.ppg, '--');
        this.setStat(this.dom.ypg, '--');
        this.setStat(this.dom.passYpg, '--');
        this.setStat(this.dom.rushYpg, '--');
        this.setStat(this.dom.defPpg, '--');
        this.setStat(this.dom.oppThirdDown, '--');
        this.setStat(this.dom.oppFourthDown, '--');
        return;
      }

      console.log(`📊 Computing stats from ${completed.length} games in ${year}`);

      let games = 0;
      let pts = 0, oppPts = 0, passYds = 0, rushYds = 0, totalYds = 0;
      let oppThirdConv = 0, oppThirdAtt = 0, oppFourthConv = 0, oppFourthAtt = 0;

      for (let i = 0; i < completed.length; i++) {
        const e = completed[i];
        const sum = await this.getSummary(year, e.id);
        const parsed = this.parseSummaryStats(sum, e);
        
        if (!parsed) {
          console.warn(`⚠️ Failed to parse stats for event ${e.id}`);
          continue;
        }
        
        console.log(`✅ Game ${i + 1}: ${parsed.pts}-${parsed.oppPts}, Opp 3rd: ${parsed.oppThirdConv}/${parsed.oppThirdAtt}, Opp 4th: ${parsed.oppFourthConv}/${parsed.oppFourthAtt}`);
        
        games++;
        pts += parsed.pts;
        oppPts += parsed.oppPts;
        passYds += parsed.passYds;
        rushYds += parsed.rushYds;
        totalYds += parsed.totalYds;
        oppThirdConv += parsed.oppThirdConv;
        oppThirdAtt += parsed.oppThirdAtt;
        oppFourthConv += parsed.oppFourthConv;
        oppFourthAtt += parsed.oppFourthAtt;
        
        if (this.isMobile && (i % this.summaryConcurrency === 0)) {
          await new Promise(r => setTimeout(r, 120));
        }
      }

      const avg = (v) => (games ? (v / games) : 0);
      const pct = (conv, att) => (att > 0 ? ((conv / att) * 100).toFixed(1) + '%' : '0.0%');
      
      console.log(`📊 Final Stats - Games: ${games}, Opp 3rd: ${oppThirdConv}/${oppThirdAtt}, Opp 4th: ${oppFourthConv}/${oppFourthAtt}`);
      
      this.setStat(this.dom.ppg, games ? avg(pts).toFixed(1) : '--');
      this.setStat(this.dom.ypg, games ? avg(totalYds).toFixed(1) : '--');
      this.setStat(this.dom.passYpg, games ? avg(passYds).toFixed(1) : '--');
      this.setStat(this.dom.rushYpg, games ? avg(rushYds).toFixed(1) : '--');
      this.setStat(this.dom.defPpg, games ? avg(oppPts).toFixed(1) : '--');
      this.setStat(this.dom.oppThirdDown, games ? pct(oppThirdConv, oppThirdAtt) : '--');
      this.setStat(this.dom.oppFourthDown, games ? pct(oppFourthConv, oppFourthAtt) : '--');
      
      console.log('✅ Team stats loaded');
    }

    async filterCompleted(events, year) {
      const completed = [];
      
      for (const e of (events || [])) {
        const sum = await this.getSummary(year, e.id);
        
        if (!sum) continue;
        
        const hcomp = sum?.header?.competitions?.[0];
        const hcomps = hcomp?.competitors || [];
        const hmine = hcomps.find(x => String(x.team?.id) === String(this.TEAM_ID));
        const hopp = hcomps.find(x => x !== hmine);
        
        const my = this.getScore(hmine?.score);
        const th = this.getScore(hopp?.score);
        
        if (my !== null && th !== null && my >= 0 && th >= 0) {
          completed.push(e);
        }
      }
      
      return completed;
    }

    parseSummaryStats(summary, eFromSchedule) {
      const comp = eFromSchedule?.competitions?.[0];
      const comps = comp?.competitors || [];
      const mine = comps.find(x => String(x.team?.id) === String(this.TEAM_ID));
      const opp = comps.find(x => x !== mine);
      
      let myPts = this.getScore(mine?.score) || 0;
      let theirPts = this.getScore(opp?.score) || 0;
      
      if (myPts === 0 || theirPts === 0) {
        const hcomp = summary?.header?.competitions?.[0];
        const hcomps = hcomp?.competitors || [];
        const hmine = hcomps?.find(x => String(x.team?.id) === String(this.TEAM_ID));
        const hopp = hcomps?.find(x => x !== hmine);
        myPts = this.getScore(hmine?.score) || 0;
        theirPts = this.getScore(hopp?.score) || 0;
      }

      let totalYds = 0, passYds = 0, rushYds = 0;
      let oppThirdConv = 0, oppThirdAtt = 0, oppFourthConv = 0, oppFourthAtt = 0;
      
      try {
        const teams = summary?.boxscore?.teams;
        if (Array.isArray(teams) && teams.length === 2) {
          const idxMine = teams.findIndex(t => String(t.team?.id) === String(this.TEAM_ID));
          const idxOpp = idxMine === 0 ? 1 : 0;
          const me = teams[idxMine];
          const oppTeam = teams[idxOpp];

          const grab = (obj, names) => {
            if (!obj || !Array.isArray(obj.statistics)) return 0;
            
            for (const stat of obj.statistics) {
              const name = (stat.name || stat.displayName || '').toLowerCase().replace(/\s+/g, '');
              if (names.some(n => name.includes(n.toLowerCase().replace(/\s+/g, '')))) {
                const val = parseFloat(stat.value !== undefined ? stat.value : stat.displayValue);
                if (!Number.isNaN(val)) {
                  console.log(`  📊 Found ${stat.name}: ${val}`);
                  return val;
                }
              }
            }
            return 0;
          };

          const grabEff = (obj, names) => {
            if (!obj || !Array.isArray(obj.statistics)) return { conv: 0, att: 0 };
            
            for (const stat of obj.statistics) {
              const name = (stat.name || stat.displayName || '').toLowerCase().replace(/\s+/g, '');
              if (names.some(n => name.includes(n.toLowerCase().replace(/\s+/g, '')))) {
                const val = stat.displayValue || stat.value || '';
                const parts = String(val).split(/[-/]/);
                if (parts.length === 2) {
                  const conv = parseInt(parts[0]) || 0;
                  const att = parseInt(parts[1]) || 0;
                  console.log(`  📊 Found ${stat.name}: ${conv}/${att}`);
                  return { conv, att };
                }
              }
            }
            return { conv: 0, att: 0 };
          };

          // Offensive stats
          totalYds = grab(me, ['totalyards', 'totaloffensiveyards']);
          passYds = grab(me, ['netpassingyards', 'passingyards']);
          rushYds = grab(me, ['rushingyards']);
          
          // OPPONENT down conversions (defensive stats)
          const oppThird = grabEff(oppTeam, ['thirddowneff', '3rddowneff']);
          oppThirdConv = oppThird.conv;
          oppThirdAtt = oppThird.att;
          
          const oppFourth = grabEff(oppTeam, ['fourthdowneff', '4thdowneff']);
          oppFourthConv = oppFourth.conv;
          oppFourthAtt = oppFourth.att;
        }
      } catch (e) {
        console.warn('⚠️ Error extracting stats:', e);
      }

      if (!totalYds && (passYds || rushYds)) totalYds = passYds + rushYds;
      
      return { 
        pts: myPts, 
        oppPts: theirPts, 
        totalYds, 
        passYds, 
        rushYds,
        oppThirdConv,
        oppThirdAtt,
        oppFourthConv,
        oppFourthAtt
      };
    }

    // ============ HISTORY ============
    async loadHistory() {
      console.log('📜 Loading history...');
      const container = this.dom.seasonRecords;
      if (!container) return;
      container.innerHTML = '';

      const years = this.availableYears.slice().reverse();
      
      for (const y of years) {
        const events = await this.getSeasonSchedule(y);
        let rec;
        
        if (events && events.length) rec = await this.computeSeasonRecordFromEvents(y, events);
        
        const overall = rec && (rec.w + rec.l + rec.t) > 0 ? `Overall: ${rec.w}-${rec.l}${rec.t ? `-${rec.t}` : ''}` : 'Overall: —';
        const conf = rec && (rec.cw + rec.cl + rec.ct) > 0 ? `Conference: ${rec.cw}-${rec.cl}${rec.ct ? `-${rec.ct}` : ''}` : 'Conference: 0-0';

        const div = document.createElement('div');
        div.className = 'season-record';
        div.innerHTML = `
          <span><strong>${y}</strong></span>
          <span>${overall}</span>
          <span>${conf}</span>`;
        container.appendChild(div);
        
        if (this.isMobile) await new Promise(r => setTimeout(r, 50));
      }
      console.log('✅ History loaded');
    }

    // ============ ROSTER ============
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
              ${[2025, 2024].map(y => `<option value="${y}" ${y === this.currentRosterYear ? 'selected' : ''}>${y}</option>`).join('')}
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
        container.innerHTML = '<div class="no-data"><p>No depth chart data available.</p></div>';
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
      const line = keys.filter(k => k.includes('DT') || k.includes('DE') || k === 'STUD');
      const lbs = keys.filter(k => k.includes('LB') || k === 'Rover');
      const sec = keys.filter(k => k.includes('CB') || k.includes('SS') || k.includes('FS') || k === 'NB');
      
      container.innerHTML = `
        <div class="formation">
          <div class="formation-line defensive-line">
            ${line.map(p => `<div class="position-group"><h4>${p}</h4>${this.playersHtml(data[p])}</div>`).join('')}
          </div>
          <div class="formation-line linebackers">
            ${lbs.map(p => `<div class="position-group"><h4>${p}</h4>${this.playersHtml(data[p])}</div>`).join('')}
          </div>
          <div class="formation-line secondary">
            ${sec.map(p => `<div class="position-group"><h4>${p}</h4>${this.playersHtml(data[p])}</div>`).join('')}
          </div>
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
      return arr.map((n, i) => `<div class="depth-player ${i === 0 ? 'starter' : 'backup'}"><span class="depth-name">${n}</span></div>`).join('');
    }

    // ============ SETUP ============
    setupListeners() {
      document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const tab = btn.dataset.tab;
          
          document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          
          document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
          document.getElementById(`${tab}-tab`).classList.add('active');

          if (tab === 'current') {
            await Promise.all([this.loadTeamInfo(), this.loadRecentGames(), this.loadTeamStats()]);
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
      
      try {
        await Promise.all([this.loadTeamInfo(), this.loadRecentGames(), this.loadTeamStats()]);
      } finally {
        this.hideLoading();
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => { new IndianaFootball(); });
})();