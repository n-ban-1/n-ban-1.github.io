class IndianaFootball {
  constructor() {
    this.espnApiUrl = 'https://site.api.espn.com';
    this.teamId = 84; // Indiana
    this.currentYear = 2025;
    this.currentRosterYear = 2025;

    // Only include years we have data for
    this.availableRosterYears = [2025, 2024];
    this.availableScheduleYears = this.generateScheduleYears();

    this.depthCharts = this.getAllDepthCharts();
    this.historicalRecords = this.getCompleteHistory();
    this.notableAchievements = this.getNotableAchievements();

    this.init();
  }

  // Generate comprehensive schedule years
  generateScheduleYears() {
    const years = [];
    for (let year = 2025; year >= 1887; year--) {
      years.push(year);
    }
    return years;
  }

  // ALL DEPTH CHARTS
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
        'CB1': ['D\'Angelo Ponds', 'Amariyun Knighten', 'Dontrae Henderson'],
        'CB2': ['Jamari Sharpe', 'Ryland Gandy', 'Jaylen Bell'],
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

  // FIXED 2024 DEPTH CHART (no more recursive call)
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
      "The 2024 College Football Playoff appearance was Indiana's first in program history."
    ];
  }

  // ENHANCED ESPN API REQUEST
  async makeESPNRequest(endpoint) {
    try {
      console.log(`Attempting ESPN API request: ${this.espnApiUrl}${endpoint}`);
      const res = await fetch(`${this.espnApiUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data = await res.json();
      console.log(`ESPN API success for ${endpoint}`);
      return data;
    } catch (e) {
      console.error(`ESPN API failed for ${endpoint}:`, e);
      return null;
    }
  }

  // ENHANCED TEAM INFO WITH LIVE DATA
  async loadTeamInfo() {
    try {
      const resp = await this.makeESPNRequest(`/apis/site/v2/sports/football/college-football/teams/${this.teamId}`);
      if (resp && resp.team) {
        console.log('Team data received:', resp.team);
        
        document.getElementById('team-logo').src = resp.team.logos?.[0]?.href || 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png';
        document.getElementById('team-name').textContent = resp.team.displayName || 'Indiana Hoosiers';
        document.getElementById('conference-name').textContent = resp.team.conference?.name || 'Big Ten';

        if (resp.team.record && resp.team.record.items && resp.team.record.items.length > 0) {
          document.getElementById('team-record').textContent = resp.team.record.items[0].summary;
          const confRecord = resp.team.record.items.find(r => r.type === 'vsconf');
          if (confRecord) {
            document.getElementById('conference-record').textContent = `Conference: ${confRecord.summary}`;
          } else {
            document.getElementById('conference-record').textContent = 'Conference: Big Ten';
          }
        } else {
          document.getElementById('team-record').textContent = 'TBD (2025)';
          document.getElementById('conference-record').textContent = 'Conference: Big Ten';
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
    document.getElementById('conference-record').textContent = 'Conference: Big Ten';
    document.getElementById('conference-name').textContent = 'Big Ten';
    document.getElementById('team-ranking').textContent = 'Unranked';
  }

  // ENHANCED TEAM STATS WITH LIVE DATA
  async loadTeamStats() {
    try {
      const resp = await this.makeESPNRequest(`/apis/site/v2/sports/football/college-football/teams/${this.teamId}/statistics?season=2024`);
      if (resp && resp.team && resp.team.statistics) {
        console.log('Statistics data received:', resp.team.statistics);
        this.displayLiveTeamStats(resp.team.statistics);
        return;
      }
    } catch (e) {
      console.error('Error loading team stats:', e);
    }
    
    // Use 2024 actual stats as fallback
    this.set2024FallbackStats();
  }

  displayLiveTeamStats(statistics) {
    try {
      const offensive = statistics.find(s => s.name === 'offense' || s.displayName?.toLowerCase().includes('offense'));
      const defensive = statistics.find(s => s.name === 'defense' || s.displayName?.toLowerCase().includes('defense'));

      if (offensive && offensive.statistics) {
        const offStats = offensive.statistics;
        document.getElementById('ppg').textContent = this.findStatValue(offStats, ['pointsPerGame', 'avgPointsPerGame', 'points']) || '43.5';
        document.getElementById('ypg').textContent = this.findStatValue(offStats, ['yardsPerGame', 'avgYardsPerGame', 'totalYards']) || '529.8';
        document.getElementById('pass-ypg').textContent = this.findStatValue(offStats, ['passingYardsPerGame', 'avgPassingYards', 'passingYards']) || '267.9';
        document.getElementById('rush-ypg').textContent = this.findStatValue(offStats, ['rushingYardsPerGame', 'avgRushingYards', 'rushingYards']) || '261.9';
      } else {
        this.setOffensiveStats();
      }

      if (defensive && defensive.statistics) {
        const defStats = defensive.statistics;
        document.getElementById('def-ppg').textContent = this.findStatValue(defStats, ['pointsAllowedPerGame', 'avgPointsAllowed', 'pointsAllowed']) || '20.5';
        document.getElementById('def-ypg').textContent = this.findStatValue(defStats, ['yardsAllowedPerGame', 'avgYardsAllowed', 'totalYardsAllowed']) || '364.2';
        document.getElementById('turnovers').textContent = this.findStatValue(defStats, ['turnoversForced', 'totalTurnovers', 'turnovers']) || '25';
        document.getElementById('sacks').textContent = this.findStatValue(defStats, ['sacks', 'totalSacks']) || '31';
      } else {
        this.setDefensiveStats();
      }

      console.log('Team stats loaded successfully from ESPN API');
    } catch (e) {
      console.error('Error parsing ESPN stats:', e);
      this.set2024FallbackStats();
    }
  }

  findStatValue(stats, keys) {
    for (const key of keys) {
      const stat = stats.find(s => s.name === key || s.displayName === key || s.abbreviation === key);
      if (stat && (stat.value !== undefined && stat.value !== null)) {
        return parseFloat(stat.value).toFixed(1);
      }
    }
    return null;
  }

  set2024FallbackStats() {
    this.setOffensiveStats();
    this.setDefensiveStats();
  }

  setOffensiveStats() {
    document.getElementById('ppg').textContent = '43.5';
    document.getElementById('ypg').textContent = '529.8';
    document.getElementById('pass-ypg').textContent = '267.9';
    document.getElementById('rush-ypg').textContent = '261.9';
  }

  setDefensiveStats() {
    document.getElementById('def-ppg').textContent = '20.5';
    document.getElementById('def-ypg').textContent = '364.2';
    document.getElementById('turnovers').textContent = '25';
    document.getElementById('sacks').textContent = '31';
  }

  // ENHANCED RECENT GAMES WITH LIVE DATA
  async loadRecentGames() {
    try {
      const response = await this.makeESPNRequest(`/apis/site/v2/sports/football/college-football/teams/${this.teamId}/schedule?season=2024`);
      if (response && response.events) {
        console.log('Schedule data received from ESPN:', response.events.length, 'games');
        const recentGames = response.events.slice(-5); // Last 5 games of 2024
        this.displayLiveRecentGames(recentGames);
        return;
      }
    } catch (e) {
      console.error('Error loading recent games:', e);
    }
    this.display2025RecentGames();
  }

  displayLiveRecentGames(games) {
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
    
    console.log('Recent games loaded successfully from ESPN API');
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

  // **COMPLETELY REWRITTEN SCHEDULE LOADING - NOW USES LIVE ESPN DATA**
  async loadSchedule() {
    console.log(`Loading schedule for year: ${this.currentYear}`);
    
    try {
      const response = await this.makeESPNRequest(
        `/apis/site/v2/sports/football/college-football/teams/${this.teamId}/schedule?season=${this.currentYear}`
      );
      
      if (response && response.events && response.events.length > 0) {
        console.log(`ESPN schedule data received for ${this.currentYear}:`, response.events.length, 'games');
        
        const schedule = response.events.map(event => {
          const competition = event.competitions[0];
          const indiana = competition.competitors.find(c => c.team.id == this.teamId);
          const opponent = competition.competitors.find(c => c !== indiana);
          
          // Parse game status and result
          let result = 'TBD';
          let completed = false;
          let status = 'Upcoming';
          
          if (event.status && event.status.type) {
            completed = event.status.type.completed;
            
            if (completed && indiana && opponent) {
              const indianaScore = parseInt(indiana.score || '0');
              const opponentScore = parseInt(opponent.score || '0');
              
              if (indianaScore > opponentScore) {
                result = `W ${indianaScore}-${opponentScore}`;
              } else if (indianaScore < opponentScore) {
                result = `L ${indianaScore}-${opponentScore}`;
              } else {
                result = `T ${indianaScore}-${opponentScore}`;
              }
              status = 'Final';
            } else if (event.status.type.name === 'STATUS_IN_PROGRESS') {
              status = 'Live';
              result = 'In Progress';
            }
          }
          
          // Parse date and time
          const gameDate = new Date(event.date);
          const dateStr = gameDate.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          });
          const timeStr = gameDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          
          // Determine home/away and venue
          const isHome = indiana?.homeAway === 'home';
          const venue = event.competitions[0].venue?.fullName || (isHome ? 'Memorial Stadium' : 'Away');
          
          return {
            opponent: opponent?.team.displayName || 'TBD',
            date: event.date,
            dateStr: dateStr,
            timeStr: timeStr,
            home: isHome,
            venue: venue,
            result: result,
            status: status,
            completed: completed,
            espnId: event.id,
            week: event.week?.number || null
          };
        });
        
        this.renderLiveSchedule(document.getElementById('schedule-list'), schedule);
        return;
      }
    } catch (e) {
      console.error('Error loading schedule from ESPN:', e);
    }
    
    // Fallback if ESPN API fails
    document.getElementById('schedule-list').innerHTML = `
      <div class="no-data">
        <p>Schedule not available for ${this.currentYear} from ESPN API.</p>
        <p><small>ESPN may not have data for this year, or the API request failed.</small></p>
      </div>`;
  }

  renderLiveSchedule(container, schedule) {
    container.innerHTML = '';
    
    schedule.forEach(game => {
      const div = document.createElement('div');
      div.className = 'schedule-item';
      
      // Determine status class for styling
      let statusClass = 'status-upcoming';
      if (game.status === 'Final') statusClass = 'status-final';
      else if (game.status === 'Live') statusClass = 'status-live';
      
      div.innerHTML = `
        <div class="game-details">
          <div class="opponent">${game.home ? 'vs' : '@'} ${game.opponent}</div>
          <div class="game-time">
            ${game.dateStr}${game.completed ? '' : ` at ${game.timeStr}`}
            ${game.week ? ` - Week ${game.week}` : ''}
          </div>
          <div class="game-location">${game.venue}</div>
        </div>
        <div class="game-result ${statusClass}">
          ${game.result}
        </div>
      `;
      container.appendChild(div);
    });
    
    console.log(`Schedule rendered for ${this.currentYear}: ${schedule.length} games`);
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