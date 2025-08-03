class IndianaFootball {
  constructor() {
    this.espnApiUrl = 'https://site.api.espn.com';
    this.teamId = 84; // Indiana
    this.currentYear = 2025;
    this.currentRosterYear = 2025;

    // Only 2025 and 2024 depth charts available
    this.availableRosterYears = [2025, 2024];
    this.availableScheduleYears = [2025, 2024];

    this.depthCharts = this.getAllDepthCharts();
    this.historicalRecords = this.getCompleteHistory();
    this.notableAchievements = this.getNotableAchievements();
    this.scheduleData = this.getAllSchedules();

    this.init();
  }

  // SCHEDULE DATA
  getAllSchedules() {
    return {
      2025: this.get2025Schedule(),
      2024: this.get2024Schedule()
    };
  }

  // CORRECTED 2025 SCHEDULE (from your provided data)
  get2025Schedule() {
    return [
      { opponent: 'Old Dominion', date: '2025-08-30', time: '2:30 PM', home: true, result: 'TBD', completed: false, note: 'Season Opener' },
      { opponent: 'Kennesaw State', date: '2025-09-06', time: '12:00 PM', home: true, result: 'TBD', completed: false },
      { opponent: 'Indiana State', date: '2025-09-12', time: '6:30 PM', home: true, result: 'TBD', completed: false },
      { opponent: 'Illinois', date: '2025-09-20', time: 'TBD', home: true, result: 'TBD', completed: false },
      { opponent: 'Iowa', date: '2025-09-27', time: 'TBD', home: false, result: 'TBD', completed: false },
      { opponent: 'Oregon', date: '2025-10-11', time: 'TBD', home: false, result: 'TBD', completed: false },
      { opponent: 'Michigan State', date: '2025-10-18', time: 'TBD', home: true, result: 'TBD', completed: false },
      { opponent: 'UCLA', date: '2025-10-25', time: 'TBD', home: true, result: 'TBD', completed: false },
      { opponent: 'Maryland', date: '2025-11-01', time: 'TBD', home: false, result: 'TBD', completed: false },
      { opponent: 'Penn State', date: '2025-11-08', time: 'TBD', home: false, result: 'TBD', completed: false },
      { opponent: 'Wisconsin', date: '2025-11-15', time: 'TBD', home: true, result: 'TBD', completed: false },
      { opponent: 'Purdue', date: '2025-11-28', time: '7:30 PM', home: false, result: 'TBD', completed: false, note: 'Old Oaken Bucket' }
    ];
  }

  // 2024 SCHEDULE
  get2024Schedule() {
    return [
      { opponent: 'Florida International', date: '2024-08-31', time: '3:30 PM', home: true, result: 'W 31-7', completed: true },
      { opponent: 'Western Illinois', date: '2024-09-06', time: '7:00 PM', home: true, result: 'W 77-3', completed: true },
      { opponent: 'UCLA', date: '2024-09-14', time: '12:00 PM', home: false, result: 'W 42-13', completed: true },
      { opponent: 'Charlotte', date: '2024-09-21', time: '7:30 PM', home: true, result: 'W 52-14', completed: true },
      { opponent: 'Maryland', date: '2024-09-28', time: '3:30 PM', home: true, result: 'W 42-28', completed: true },
      { opponent: 'Northwestern', date: '2024-10-05', time: '12:00 PM', home: false, result: 'W 41-24', completed: true },
      { opponent: 'Nebraska', date: '2024-10-19', time: '12:00 PM', home: true, result: 'W 56-7', completed: true },
      { opponent: 'Washington', date: '2024-10-26', time: '12:00 PM', home: true, result: 'W 31-17', completed: true },
      { opponent: 'Michigan State', date: '2024-11-02', time: '12:00 PM', home: false, result: 'W 47-10', completed: true },
      { opponent: 'Michigan', date: '2024-11-09', time: '3:30 PM', home: true, result: 'W 20-15', completed: true },
      { opponent: 'Ohio State', date: '2024-11-23', time: '12:00 PM', home: false, result: 'L 15-38', completed: true },
      { opponent: 'Purdue', date: '2024-11-30', time: '3:30 PM', home: true, result: 'W 66-0', completed: true, note: 'Old Oaken Bucket' },
      { opponent: 'Notre Dame', date: '2024-12-20', home: false, result: 'L 17-27', completed: true, note: 'CFP First Round' }
    ];
  }

  // DEPTH CHARTS - Only 2025 and 2024
  getAllDepthCharts() {
    return {
      2025: this.get2025DepthChart(),
      2024: this.get2024DepthChart()
    };
  }

  // 2025 DEPTH CHART (from CSV data)
  get2025DepthChart() {
    return {
      offense: {
        'X-WR': ['Elijah Sarratt', 'EJ Williams Jr', 'Davion Chandler'],
        'SL-WR': ['Tyler Morris', 'Jonathan Brady', 'LeBron Bond', 'Myles Kendrick'],
        'Z-WR': ['Omar Cooper Jr', 'Makai Jackson', 'Charlie Becker'],
        'LT': ['Carter Smith', 'Evan Lawrence', 'Matt Marek'],
        'LG': ['Drew Evans', 'Kahlil Benson', 'Baylor Wilkin'],
        'C': ['Pat Coogan', 'Jack Greer', 'Mitch Verstegen'],
        'RG': ['Bray Lynch', 'Adedamola Ajani', 'Austin Leibfried', 'Evan Parker'],
        'RT': ['Zen Michalski', 'Austin Barrett', 'Max Williams'],
        'TE': ['Holden Staes', 'Riley Nowakowski', 'James Bomba', 'Andrew Barker'],
        'QB': ['Fernando Mendoza', 'Alberto Mendoza', 'Grant Wilson', 'Jacob Bell', 'Tyler Cherry'],
        'HB': ['Kaelon Black', 'Roman Hemby', 'Lee Beebe', 'Khobie Martin', 'Sean Cuono', 'Solomon Vanhorse']
      },
      defense: {
        'LCB': ['D\'Angelo Ponds', 'Amariyun Knighten', 'Dontrae Henderson'],
        'RCB': ['Jamari Sharpe', 'Ryland Gandy', 'Jaylen Bell'],
        'STUD': ['Mikail Kamara', 'Kellan Wyatt', 'Daniel Ndukwe', 'Triston Abram', 'Andrew Turvy'],
        'DT1': ['Hosea Wheeler', 'Dominique Ratcliff', 'Kyler Garcia'],
        'DT2': ['Tyrique Tucker', 'J\'Mari Monette', 'Jhrevious Hall'],
        'DE': ['Stephen Daley', 'Mario Landino', 'Andrew Depaepe', 'Tyrone Burrus Jr'],
        'LB1': ['Rolijah Hardy', 'Isaiah Jones', 'Jeff Utzinger', 'Paul Nelson', 'Amari Kamara'],
        'LB2': ['Aiden Fisher', 'Kaiden Turner', 'Quentin Clark', 'Jamari Farmer'],
        'FS': ['Louis Moore', 'Bryson Bonds', 'Seaonta Stewart'],
        'SS': ['Amare Ferrell', 'Byron Baldwin'],
        'Rover': ['Devan Boykin', 'Jah Jah Boyd', 'Zacharey Smith', 'Garrett Reese']
      },
      specialists: {
        'PK': ['Nicolas Radicic', 'Brendan Franke'],
        'KO': ['Brendan Franke', 'Alejandro Quintero'],
        'LS': ['Mark Langston', 'Sam Lindsey'],
        'PT': ['Mitch McCarthy', 'Alejandro Quintero'],
        'KR': ['Solomon Vanhorse', 'EJ Williams Jr'],
        'PR': ['Tyler Morris', 'Solomon Vanhorse']
      }
    };
  }

  // CORRECTED 2024 DEPTH CHART (from your provided data)
  get2024DepthChart() {
    return {
      offense: {
        'X-WR': ['Elijah Sarratt', 'EJ Williams Jr', 'Andison Coby', 'Charlie Becker'],
        'SL-WR': ['Myles Price', 'Ke\'Shawn Williams'],
        'Z-WR': ['Donaven McCulley', 'Miles Cross', 'Omar Cooper Jr'],
        'LT': ['Carter Smith', 'Cooper Jones', 'Evan Lawrence'],
        'LG': ['Drew Evans', 'Tyler Stephens', 'Adedamola Ajani'],
        'C': ['Mike Katic', 'Jack Greer', 'Mitch Verstegen'],
        'RG': ['Nick Kidwell', 'Bray Lynch', 'Austin Leibfried'],
        'RT': ['Trey Wedig', 'Austin Barrett', 'Max Williams'],
        'TE': ['Zach Horton', 'James Bomba', 'Sam West', 'Trey Walker'],
        'QB': ['Kurtis Rourke', 'Tayven Jackson', 'Roman Purcell', 'Tyler Cherry'],
        'HB': ['Justice Ellison', 'Ty Lawton', 'Kaelon Black', 'Elijah Green']
      },
      defense: {
        'LCB': ['D\'Angelo Ponds', 'Jamari Sharpe', 'Josh Philostin'],
        'RCB': ['Jamier Johnson', 'JoJo Johnson', 'Dontrae Henderson'],
        'STUD': ['Lanell Carr Jr', 'Andrew Turvy', 'Daniel Ndukwe', 'Andrew Depaepe'],
        'DT': ['James Carpenter', 'Marcus Burris Jr', 'Mario Landino', 'J\'mari Monette'],
        'NT': ['CJ West', 'Tyrique Tucker', 'Robby Harrison'],
        'DE': ['Mikail Kamara', 'Jacob Mangum-Farrar', 'Venson Sneed Jr', 'William Depaepe'],
        'LB1': ['Jailin Walker', 'Rolijah Hardy', 'Jeff Utzinger', 'Quentin Clark'],
        'LB2': ['Aiden Fisher', 'Isaiah Jones', 'Nahji Logan', 'Joshua Rudolph'],
        'FS': ['Amare Ferrell', 'Josh Sanguinetti', 'Nic Toomer'],
        'SS': ['Shawn Asbury II', 'Bryson Bonds', 'Tyrik McDaniel'],
        'Rover': ['Terry Jones Jr', 'Cedarius Doss', 'Jah Jah Boyd']
      },
      specialists: {
        'PK': ['Nicolas Radicic', 'Alejandro Quintero'],
        'KO': ['Derek McCormick', 'Alejandro Quintero'],
        'LS': ['Mark Langston', 'Jaxon Miller'],
        'PT': ['James Evans', 'Alejandro Quintero'],
        'KR': ['Solomon Vanhorse', 'Ke\'Shawn Williams'],
        'PR': ['Myles Price', 'EJ Williams Jr']
      }
    };
  }

  // HISTORICAL RECORDS
  getCompleteHistory() {
    return [
      { year: '2025', overall: 'TBD', conference: 'TBD', bowl: 'Season in Progress' },
      { year: '2024', overall: '11-2', conference: '8-1', bowl: 'CFP: Lost to Notre Dame 17-27' },
      { year: '2023', overall: '3-9', conference: '1-8', bowl: 'None' },
      { year: '2022', overall: '4-8', conference: '2-7', bowl: 'None' },
      { year: '2021', overall: '2-10', conference: '0-9', bowl: 'None' },
      { year: '2020', overall: '6-2', conference: '6-1', bowl: 'Outback Bowl Loss' },
      { year: '2019', overall: '8-5', conference: '5-4', bowl: 'Gator Bowl Win' },
      { year: '2018', overall: '5-7', conference: '2-7', bowl: 'None' },
      { year: '2017', overall: '5-7', conference: '3-6', bowl: 'None' },
      { year: '2016', overall: '6-7', conference: '4-5', bowl: 'Foster Farms Bowl Loss' }
    ];
  }

  getNotableAchievements() {
    return [
      "Indiana first began playing football in 1887, fielding its debut season with one game.",
      "The program officially joined the Big Ten (Western Conference) in 1900.",
      "Indiana has competed in 138 seasons as of 2025.",
      "As of 2025, Indiana's all-time record stands at approximately 525-731-46.",
      "The Hoosiers have won two Big Ten Conference championships (1945, 1967).",
      "Indiana has appeared in 12 bowl games in program history.",
      "The 2019 season featured Indiana's first 8-win regular season since 1993.",
      "Memorial Stadium, opened in 1960, seats 52,929 fans.",
      "The Old Oaken Bucket rivalry with Purdue dates back to 1925.",
      "Indiana's 2020 season was their most successful Big Ten campaign since 1967.",
      "The 2024 College Football Playoff appearance was Indiana's first in program history.",
      "Indiana's best finish in the Big Ten was 2nd place in 1967 and 2020.",
      "The Hoosiers have had 5 bowl victories in their history.",
      "Indiana's longest winning streak is 8 games (1945).",
      "The team has produced numerous NFL players including Antwaan Randle El and Tracy Porter."
    ];
  }

  // IMPROVED API FUNCTIONS
  async makeESPNRequest(endpoint, retries = 1) {
    for (let i = 0; i <= retries; i++) {
      try {
        console.log(`Attempting ESPN API request: ${this.espnApiUrl}${endpoint}`);
        
        const res = await fetch(`${this.espnApiUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!res.ok) {
          console.warn(`ESPN API HTTP ${res.status} for ${endpoint}`);
          if (i === retries) throw new Error(`HTTP ${res.status}`);
          await this.delay(1000);
          continue;
        }
        
        const data = await res.json();
        console.log(`ESPN API success for ${endpoint}`);
        return data;
      } catch (e) {
        console.warn(`ESPN API attempt ${i + 1} failed for ${endpoint}:`, e.message);
        if (i === retries) {
          console.error(`All ESPN API attempts failed for ${endpoint}, using fallback data`);
          return null;
        }
        await this.delay(1000);
      }
    }
    return null;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // TEAM INFO LOADING
  async loadTeamInfo() {
    try {
      const resp = await this.makeESPNRequest(`/apis/site/v2/sports/football/college-football/teams/${this.teamId}`);
      if (resp && resp.team) {
        document.getElementById('team-logo').src = resp.team.logos?.[0]?.href || 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png';
        document.getElementById('team-name').textContent = resp.team.displayName || 'Indiana Hoosiers';
        document.getElementById('conference-name').textContent = resp.team.conference?.name || 'Big Ten';

        if (resp.team.record && resp.team.record.items && resp.team.record.items.length > 0) {
          document.getElementById('team-record').textContent = resp.team.record.items[0].summary;
          const confRecord = resp.team.record.items.find(r => r.type === 'vsconf');
          if (confRecord) {
            document.getElementById('conference-record').textContent = `Conference: ${confRecord.summary}`;
          }
        } else {
          document.getElementById('team-record').textContent = 'TBD (2025)';
          document.getElementById('conference-record').textContent = 'Conference: TBD';
        }

        if (resp.team.rank) {
          document.getElementById('team-ranking').textContent = '#' + resp.team.rank;
        } else {
          document.getElementById('team-ranking').textContent = 'Unranked';
        }
        return;
      }
    } catch (e) {
      console.error('Error loading team info:', e);
    }
    this.setFallbackTeamInfo();
  }

  setFallbackTeamInfo() {
    document.getElementById('team-logo').src = 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png';
    document.getElementById('team-name').textContent = 'Indiana Hoosiers';
    document.getElementById('team-record').textContent = 'TBD (2025)';
    document.getElementById('conference-record').textContent = 'Conference: TBD';
    document.getElementById('conference-name').textContent = 'Big Ten';
    document.getElementById('team-ranking').textContent = 'Unranked';
  }

  // TEAM STATS
  async loadTeamStats() {
    this.set2025Stats();
  }

  set2025Stats() {
    document.getElementById('ppg').textContent = '--';
    document.getElementById('ypg').textContent = '--';
    document.getElementById('pass-ypg').textContent = '--';
    document.getElementById('rush-ypg').textContent = '--';
    document.getElementById('def-ppg').textContent = '--';
    document.getElementById('def-ypg').textContent = '--';
    document.getElementById('turnovers').textContent = '--';
    document.getElementById('sacks').textContent = '--';
  }

  // RECENT GAMES
  async loadRecentGames() {
    try {
      const response = await this.makeESPNRequest(`/apis/site/v2/sports/football/college-football/teams/${this.teamId}/schedule?season=2024`);
      if (response && response.events) {
        const recentGames = response.events.slice(-5); // Last 5 games
        this.displayESPNRecentGames(recentGames);
        return;
      }
    } catch (e) {
      console.error('Error loading recent games:', e);
    }
    this.display2025RecentGames();
  }

  display2025RecentGames() {
    const container = document.getElementById('recent-games');
    container.innerHTML = '';
    const games = [
      { opponent: 'Old Dominion', result: 'TBD', score: '--', date: '2025-08-30', note: 'Season Opener' },
      { opponent: 'Kennesaw State', result: 'TBD', score: '--', date: '2025-09-06' },
      { opponent: 'Indiana State', result: 'TBD', score: '--', date: '2025-09-12' },
      { opponent: 'Illinois', result: 'TBD', score: '--', date: '2025-09-20' },
      { opponent: 'Iowa', result: 'TBD', score: '--', date: '2025-09-27' }
    ];
    
    games.forEach(game => {
      const div = document.createElement('div');
      div.className = 'game-item';
      div.innerHTML = `
        <div class="game-info">
          <div class="opponent">${game.note ? `vs ${game.opponent} (${game.note})` : `vs ${game.opponent}`}</div>
          <div class="game-date">${new Date(game.date).toLocaleDateString()}</div>
        </div>
        <div class="game-result upcoming">${game.result} ${game.score}</div>
      `;
      container.appendChild(div);
    });
  }

  displayESPNRecentGames(games) {
    const container = document.getElementById('recent-games');
    container.innerHTML = '';
    
    for (const game of games) {
      if (!game.competitions || !game.competitions[0] || !game.competitions[0].competitors) continue;
      
      const competition = game.competitions[0];
      const indiana = competition.competitors.find(c => c.team && c.team.id == '84');
      const opponent = competition.competitors.find(c => c !== indiana);
      
      if (!indiana || !opponent) continue;
      
      let result = 'TBD', score = '--', statusClass = 'upcoming';
      if (game.status && game.status.type && game.status.type.completed) {
        const indianaScore = parseInt(indiana.score || '0');
        const opponentScore = parseInt(opponent.score || '0');
        result = indianaScore > opponentScore ? 'W' : 'L';
        score = `${indianaScore}-${opponentScore}`;
        statusClass = result.toLowerCase();
      }
      
      const isHome = indiana.homeAway === 'home';
      const div = document.createElement('div');
      div.className = 'game-item';
      div.innerHTML = `
        <div class="game-info">
          <div class="opponent">${isHome ? 'vs' : '@'} ${opponent.team.displayName}</div>
          <div class="game-date">${new Date(game.date).toLocaleDateString()}</div>
        </div>
        <div class="game-result ${statusClass}">${result} ${score}</div>
      `;
      container.appendChild(div);
    }
  }

  // SCHEDULE LOADING
  async loadSchedule() {
    if (this.scheduleData[this.currentYear]) {
      this.renderSchedule(document.getElementById('schedule-list'), this.scheduleData[this.currentYear]);
    } else {
      try {
        const response = await this.makeESPNRequest(
          `/apis/site/v2/sports/football/college-football/teams/${this.teamId}/schedule?season=${this.currentYear}`
        );
        if (response && response.events) {
          const schedule = response.events.map(event => ({
            opponent: event.competitions[0].competitors.find(c => c.team.id != this.teamId)?.team.displayName || 'TBD',
            date: event.date,
            time: event.competitions[0].startDate ? new Date(event.competitions[0].startDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'TBD',
            home: event.competitions[0].competitors.find(c => c.team.id == this.teamId)?.homeAway === 'home',
            result: event.competitions[0].completed ? 
              (event.competitions[0].competitors.find(c => c.team.id == this.teamId)?.winner ? 'W' : 'L') + ' ' +
              event.competitions[0].competitors.map(c => c.score).join('-') : 'TBD',
            completed: event.competitions[0].completed
          }));
          this.renderSchedule(document.getElementById('schedule-list'), schedule);
        } else {
          document.getElementById('schedule-list').innerHTML = '<p>Schedule not available for this year.</p>';
        }
      } catch (e) {
        console.error('Error loading schedule:', e);
        document.getElementById('schedule-list').innerHTML = '<p>Schedule not available for this year.</p>';
      }
    }
  }

  renderSchedule(container, schedule) {
    container.innerHTML = '';
    schedule.forEach(game => {
      const div = document.createElement('div');
      div.className = 'schedule-item';
      
      const gameDate = new Date(game.date);
      const dateStr = gameDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      
      div.innerHTML = `
        <div class="game-details">
          <div class="opponent">${game.home ? 'vs' : '@'} ${game.opponent}</div>
          <div class="game-time">${dateStr}${game.time && game.time !== 'TBD' ? ` at ${game.time}` : ''}</div>
          <div class="game-location">${game.home ? 'Memorial Stadium' : 'Away'}</div>
        </div>
        <div class="game-result ${game.completed ? 'status-final' : 'status-upcoming'}">
          ${game.completed ? game.result : dateStr}
          ${game.note ? ` (${game.note})` : ''}
        </div>
      `;
      container.appendChild(div);
    });
  }

  // ROSTER & DEPTH CHART
  async loadRoster() {
    document.getElementById('roster-list').innerHTML = '';
    this.addDepthChart();
  }

  addDepthChart() {
    const tab = document.getElementById('roster-tab');
    const existing = document.getElementById('depth-chart-section');
    if (existing) existing.remove();

    const section = document.createElement('div');
    section.id = 'depth-chart-section';
    section.innerHTML = `
      <div class="depth-chart-header">
        <h2>Indiana Football Depth Chart</h2>
        <div class="depth-chart-controls">
          <select id="roster-year-select" class="year-select">
            ${this.availableRosterYears.map(y => `<option value="${y}" ${y === this.currentRosterYear ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
          <button class="depth-btn active" data-unit="offense">Offense</button>
          <button class="depth-btn" data-unit="defense">Defense</button>
          <button class="depth-btn" data-unit="specialists">Specialists</button>
        </div>
      </div>
      <div id="depth-chart-content" class="depth-chart-content"></div>
    `;
    tab.appendChild(section);

    document.getElementById('roster-year-select').addEventListener('change', (e) => {
      this.currentRosterYear = parseInt(e.target.value);
      this.displayDepthChart('offense');
      document.querySelectorAll('.depth-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-unit="offense"]').classList.add('active');
    });

    document.querySelectorAll('.depth-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.depth-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.displayDepthChart(btn.dataset.unit);
      };
    });

    this.displayDepthChart('offense');
  }

  displayDepthChart(unit) {
    const container = document.getElementById('depth-chart-content');
    const data = this.depthCharts[this.currentRosterYear] && this.depthCharts[this.currentRosterYear][unit];
    
    if (!data) {
      container.innerHTML = '<div class="no-data"><p>No depth chart data available for this year.</p></div>';
      return;
    }

    if (unit === 'offense') this.renderOffenseDepthChart(container, data);
    else if (unit === 'defense') this.renderDefenseDepthChart(container, data);
    else this.renderSpecialistsDepthChart(container, data);
  }

  renderOffenseDepthChart(container, data) {
    container.innerHTML = `
      <div class="formation">
        <div class="formation-line skill-positions">
          <div class="position-group">
            <h4>X-WR</h4>
            ${this.renderPositionPlayers(data['X-WR'])}
          </div>
          <div class="position-group">
            <h4>SL-WR</h4>
            ${this.renderPositionPlayers(data['SL-WR'])}
          </div>
          <div class="position-group">
            <h4>Z-WR</h4>
            ${this.renderPositionPlayers(data['Z-WR'])}
          </div>
        </div>
        <div class="formation-line backfield">
          <div class="position-group">
            <h4>QB</h4>
            ${this.renderPositionPlayers(data['QB'])}
          </div>
          <div class="position-group">
            <h4>HB</h4>
            ${this.renderPositionPlayers(data['HB'])}
          </div>
          <div class="position-group">
            <h4>TE</h4>
            ${this.renderPositionPlayers(data['TE'])}
          </div>
        </div>
        <div class="formation-line offensive-line">
          <div class="position-group"><h4>LT</h4>${this.renderPositionPlayers(data['LT'])}</div>
          <div class="position-group"><h4>LG</h4>${this.renderPositionPlayers(data['LG'])}</div>
          <div class="position-group"><h4>C</h4>${this.renderPositionPlayers(data['C'])}</div>
          <div class="position-group"><h4>RG</h4>${this.renderPositionPlayers(data['RG'])}</div>
          <div class="position-group"><h4>RT</h4>${this.renderPositionPlayers(data['RT'])}</div>
        </div>
      </div>
    `;
  }

  renderDefenseDepthChart(container, data) {
    const positions = Object.keys(data);
    const linePositions = positions.filter(p => p.includes('DT') || p.includes('DE') || p === 'STUD' || p === 'NT');
    const backerPositions = positions.filter(p => p.includes('LB') || p === 'Rover');
    const secondaryPositions = positions.filter(p => p.includes('CB') || p.includes('SS') || p.includes('FS') || p === 'LCB' || p === 'RCB');
    
    container.innerHTML = `
      <div class="formation">
        <div class="formation-line defensive-line">
          ${linePositions.map(p => `<div class="position-group"><h4>${p}</h4>${this.renderPositionPlayers(data[p])}</div>`).join('')}
        </div>
        <div class="formation-line linebackers">
          ${backerPositions.map(p => `<div class="position-group"><h4>${p}</h4>${this.renderPositionPlayers(data[p])}</div>`).join('')}
        </div>
        <div class="formation-line secondary">
          ${secondaryPositions.map(p => `<div class="position-group"><h4>${p}</h4>${this.renderPositionPlayers(data[p])}</div>`).join('')}
        </div>
      </div>
    `;
  }

  renderSpecialistsDepthChart(container, data) {
    container.innerHTML = '<div class="formation special-teams"><div class="formation-line">' +
      Object.keys(data).map(p => `<div class="position-group"><h4>${p}</h4>${this.renderPositionPlayers(data[p])}</div>`).join('') +
      '</div></div>';
  }

  renderPositionPlayers(players) {
    if (!players || players.length == 0) return '<div class="depth-player backup"><span class="depth-name">No players listed</span></div>';
    return players.map((p, i) => `<div class="depth-player ${i === 0 ? 'starter' : 'backup'}"><span class="depth-name">${p}</span></div>`).join('');
  }

  // HISTORY
  async loadHistory() {
    this.displayHistory();
  }

  displayHistory() {
    const container = document.getElementById('season-records');
    container.innerHTML = '';
    
    const recent = this.historicalRecords.slice(0, 10);
    recent.forEach(record => {
      const div = document.createElement('div');
      div.className = 'season-record';
      div.innerHTML = `<span><strong>${record.year}</strong></span> <span>Overall: ${record.overall}</span> <span>Conference: ${record.conference}</span>`;
      container.appendChild(div);
    });

    const btn = document.createElement('button');
    btn.innerText = 'Show Complete History (1887–2025)';
    btn.className = 'show-all-history-btn';
    btn.onclick = () => this.showAllHistory();
    container.appendChild(btn);

    this.addAchievements();
  }

  showAllHistory() {
    const container = document.getElementById('season-records');
    container.innerHTML = '';
    
    this.historicalRecords.forEach(record => {
      const div = document.createElement('div');
      div.className = 'season-record';
      div.innerHTML = `<span><strong>${record.year}</strong></span> <span>Overall: ${record.overall}</span> <span>Conference: ${record.conference}</span>`;
      container.appendChild(div);
    });
    
    this.addAchievements();
  }

  addAchievements() {
    const container = document.getElementById('season-records');
    const header = document.createElement('h3');
    header.innerText = 'Notable Achievements & History (click to toggle)';
    header.style = 'margin:2rem 0 1rem; color:#990000; cursor:pointer;';
    container.appendChild(header);
    
    const div = document.createElement('div');
    div.id = 'achievements-list';
    div.style = 'display:none; max-height:400px; overflow-y:auto; border:1px solid #ddd; padding:1rem; border-radius:6px; background:#f9f9f9;';
    div.innerHTML = this.notableAchievements.map((a, i) => `<div style="margin-bottom:0.75rem; padding:0.5rem; background:white; border-radius:4px; border-left:4px solid #990000;"><strong>${i + 1}.</strong> ${a}</div>`).join('');
    container.appendChild(div);
    
    header.onclick = () => {
      if (div.style.display === 'none') {
        div.style.display = 'block';
        header.innerText = 'Hide Achievements';
      } else {
        div.style.display = 'none';
        header.innerText = 'Notable Achievements & History (click to toggle)';
      }
    };
  }

  // INITIALIZATION
  async init() {
    this.setupListeners();
    this.showLoading();
    await this.loadData();
    this.hideLoading();
  }

  setupListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.onclick = () => { this.switchTab(btn.dataset.tab); };
    });

    const seasonSelect = document.getElementById('season-select');
    if (seasonSelect) {
      seasonSelect.innerHTML = this.availableScheduleYears.map(y => `<option value="${y}" ${y === this.currentYear ? 'selected' : ''}>${y}</option>`).join('');
      seasonSelect.onchange = () => {
        this.currentYear = parseInt(seasonSelect.value);
        this.loadSchedule();
      };
    }
  }

  switchTab(tab) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    document.getElementById(`${tab}-tab`).classList.add('active');

    if (tab === 'schedule') this.loadSchedule();
    else if (tab === 'roster') this.loadRoster();
    else if (tab === 'history') this.loadHistory();
  }

  async loadData() {
    await this.loadTeamInfo();
    await this.loadTeamStats();
    await this.loadRecentGames();
    this.displayHistory();
  }

  showLoading() {
    document.getElementById('loading').style.display = 'block';
  }

  hideLoading() {
    document.getElementById('loading').style.display = 'none';
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new IndianaFootball();
});