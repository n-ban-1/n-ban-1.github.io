class IndianaFootballApp {
    constructor() {
        this.cfbDataUrl = 'https://api.collegefootballdata.com';
        this.teamName = 'Indiana';
        this.currentYear = new Date().getFullYear();
        this.teamId = 84;
        this.depthChart2024 = this.get2024DepthChart();
        this.init();
    }

    get2024DepthChart() {
        // 2024 Indiana Football Depth Chart from provided data
        return {
            offense: {
                'X-WR': ['Elijah Sarratt', 'EJ Williams Jr', 'Davion Chandler'],
                'SL-WR': ['Tyler Morris', 'Jonathan Brady', 'LeBron Bond', 'Myles Kendrick', 'Tyler Morris'],
                'Z-WR': ['Omar Cooper Jr', 'Makai Jackson', 'Charlie Becker'],
                'LT': ['Carter Smith', 'Evan Lawrence', 'Matt Marek'],
                'LG': ['Drew Evans', 'Kahlil Benson', 'Baylor Wilkin'],
                'C': ['Pat Coogan', 'Jack Greer', 'Mitch Verstegen'],
                'RG': ['Bray Lynch', 'Adedamola Ajani', 'Austin Leibfried'],
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

    async init() {
        this.setupEventListeners();
        this.showLoading();
        await this.loadAllData();
        this.hideLoading();
    }

    setupEventListeners() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        const seasonSelect = document.getElementById('season-select');
        if (seasonSelect) {
            this.populateSeasonDropdown();
            seasonSelect.addEventListener('change', (e) => {
                this.loadSchedule(parseInt(e.target.value));
            });
        }

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterRoster(e.target.dataset.position);
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    }

    populateSeasonDropdown() {
        const select = document.getElementById('season-select');
        select.innerHTML = '';
        for (let year = this.currentYear; year >= this.currentYear - 10; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === this.currentYear) option.selected = true;
            select.appendChild(option);
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        switch(tabName) {
            case 'schedule':
                this.loadSchedule(this.currentYear);
                break;
            case 'roster':
                this.loadRoster();
                break;
            case 'history':
                this.loadHistory();
                break;
        }
    }

    async makeRequest(endpoint) {
        try {
            const response = await fetch(`${this.cfbDataUrl}${endpoint}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error fetching ${endpoint}:`, error);
            return null;
        }
    }

    async loadAllData() {
        try {
            await Promise.all([
                this.loadTeamInfo(),
                this.loadTeamStats(),
                this.loadRecentGames()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    async loadTeamInfo() {
        try {
            // Set basic info
            document.getElementById('team-logo').src = 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png';
            document.getElementById('team-name').textContent = 'Indiana Hoosiers';
            document.getElementById('conference-name').textContent = 'Big Ten';

            // Try to get current record from API
            const records = await this.makeRequest(`/records?year=${this.currentYear}&team=Indiana`);
            if (records && records.length > 0) {
                const record = records[0];
                document.getElementById('team-record').textContent = `${record.total.wins}-${record.total.losses}`;
                document.getElementById('conference-record').textContent = `Conference: ${record.conferenceGames.wins}-${record.conferenceGames.losses}`;
            } else {
                document.getElementById('team-record').textContent = 'Loading...';
                document.getElementById('conference-record').textContent = 'Loading...';
            }

            // Try to get ranking
            const rankings = await this.makeRequest(`/rankings?year=${this.currentYear}&week=15&seasonType=regular`);
            if (rankings && rankings.length > 0) {
                const polls = rankings[0].polls;
                for (const poll of polls) {
                    const ranked = poll.ranks.find(rank => rank.school === 'Indiana');
                    if (ranked) {
                        document.getElementById('team-ranking').textContent = `#${ranked.rank}`;
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('Error loading team info:', error);
        }
    }

    async loadTeamStats() {
        try {
            const stats = await this.makeRequest(`/stats/season?year=${this.currentYear}&team=Indiana`);
            
            if (stats && stats.length > 0) {
                const teamStats = stats[0];
                if (teamStats.stats) {
                    teamStats.stats.forEach(stat => {
                        this.processStatistic(stat);
                    });
                }
            } else {
                this.setLoadingStats();
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            this.setLoadingStats();
        }
    }

    processStatistic(stat) {
        const value = parseFloat(stat.value);
        switch(stat.category + '-' + stat.stat) {
            case 'offense-pointsPerGame':
                document.getElementById('ppg').textContent = value.toFixed(1);
                break;
            case 'offense-yardsPerGame':
                document.getElementById('ypg').textContent = value.toFixed(1);
                break;
            case 'offense-netPassingYards':
                document.getElementById('pass-ypg').textContent = (value / 12).toFixed(1); // Rough per game estimate
                break;
            case 'offense-rushingYards':
                document.getElementById('rush-ypg').textContent = (value / 12).toFixed(1); // Rough per game estimate
                break;
            case 'defense-pointsPerGame':
                document.getElementById('def-ppg').textContent = value.toFixed(1);
                break;
            case 'defense-yardsPerGame':
                document.getElementById('def-ypg').textContent = value.toFixed(1);
                break;
            case 'defense-turnovers':
                document.getElementById('turnovers').textContent = value;
                break;
            case 'defense-sacks':
                document.getElementById('sacks').textContent = value;
                break;
        }
    }

    setLoadingStats() {
        ['ppg', 'ypg', 'pass-ypg', 'rush-ypg', 'def-ppg', 'def-ypg', 'turnovers', 'sacks'].forEach(id => {
            document.getElementById(id).textContent = '--';
        });
    }

    async loadRecentGames() {
        try {
            const games = await this.makeRequest(`/games?year=${this.currentYear}&team=Indiana`);
            
            if (games && games.length > 0) {
                const completedGames = games
                    .filter(game => game.completed)
                    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
                    .slice(-5);
                
                this.displayRecentGames(completedGames);
            } else {
                this.displayNoRecentGames();
            }
        } catch (error) {
            console.error('Error loading recent games:', error);
            this.displayNoRecentGames();
        }
    }

    displayRecentGames(games) {
        const container = document.getElementById('recent-games');
        container.innerHTML = '';

        if (games.length === 0) {
            this.displayNoRecentGames();
            return;
        }

        games.forEach(game => {
            const gameItem = document.createElement('div');
            gameItem.className = 'game-item';
            
            const isHome = game.home_team === 'Indiana';
            const opponent = isHome ? game.away_team : game.home_team;
            const indianaScore = isHome ? game.home_points : game.away_points;
            const opponentScore = isHome ? game.away_points : game.home_points;
            const result = indianaScore > opponentScore ? 'W' : (indianaScore === opponentScore ? 'T' : 'L');
            
            gameItem.innerHTML = `
                <div class="game-info">
                    <div class="opponent">${isHome ? 'vs' : '@'} ${opponent}</div>
                    <div class="game-date">${new Date(game.start_date).toLocaleDateString()}</div>
                </div>
                <div class="game-result ${result.toLowerCase()}">${result} ${indianaScore}-${opponentScore}</div>
            `;
            
            container.appendChild(gameItem);
        });
    }

    displayNoRecentGames() {
        const container = document.getElementById('recent-games');
        container.innerHTML = '<p>Recent games will appear here after they are played.</p>';
    }

    async loadSchedule(year) {
        try {
            const games = await this.makeRequest(`/games?year=${year}&team=Indiana`);
            
            if (games && games.length > 0) {
                this.displaySchedule(games);
            } else {
                this.displayNoSchedule();
            }
        } catch (error) {
            console.error('Error loading schedule:', error);
            this.displayNoSchedule();
        }
    }

    displaySchedule(games) {
        const container = document.getElementById('schedule-list');
        container.innerHTML = '';

        games.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

        games.forEach(game => {
            const scheduleItem = document.createElement('div');
            scheduleItem.className = 'schedule-item';
            
            const isHome = game.home_team === 'Indiana';
            const opponent = isHome ? game.away_team : game.home_team;
            const gameDate = new Date(game.start_date);
            
            let statusClass = 'status-upcoming';
            let statusText = gameDate.toLocaleDateString();
            
            if (game.completed) {
                statusClass = 'status-final';
                const indianaScore = isHome ? game.home_points : game.away_points;
                const opponentScore = isHome ? game.away_points : game.home_points;
                const result = indianaScore > opponentScore ? 'W' : (indianaScore === opponentScore ? 'T' : 'L');
                statusText = `${result} ${indianaScore}-${opponentScore}`;
            }

            scheduleItem.innerHTML = `
                <div class="game-details">
                    <div class="opponent-name">${isHome ? 'vs' : '@'} ${opponent}</div>
                    <div class="game-time">${gameDate.toLocaleDateString()}</div>
                    <div class="game-location">${game.venue || (isHome ? 'Memorial Stadium' : 'Away')}</div>
                </div>
                <div class="game-status ${statusClass}">${statusText}</div>
            `;
            
            container.appendChild(scheduleItem);
        });
    }

    displayNoSchedule() {
        const container = document.getElementById('schedule-list');
        container.innerHTML = '<p>No schedule available for this season.</p>';
    }

    async loadRoster() {
        try {
            const roster = await this.makeRequest(`/roster?team=Indiana&year=${this.currentYear}`);
            
            if (roster && roster.length > 0) {
                this.displayRoster(roster);
            } else {
                this.displayNoRoster();
            }
            
            // Always add depth chart
            this.addDepthChartSection();
        } catch (error) {
            console.error('Error loading roster:', error);
            this.displayNoRoster();
            this.addDepthChartSection();
        }
    }

    displayRoster(players) {
        const container = document.getElementById('roster-list');
        container.innerHTML = '';

        players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.dataset.position = this.getPositionCategory(player.position);
            
            playerCard.innerHTML = `
                <div class="player-number">#${player.jersey || 'N/A'}</div>
                <div class="player-name">${player.first_name || ''} ${player.last_name || 'Unknown'}</div>
                <div class="player-position">${player.position || 'N/A'}</div>
            `;
            
            container.appendChild(playerCard);
        });
    }

    displayNoRoster() {
        const container = document.getElementById('roster-list');
        container.innerHTML = '<p>Roster information will be available soon.</p>';
    }

    addDepthChartSection() {
        const rosterTab = document.getElementById('roster-tab');
        
        // Remove existing depth chart if present
        const existing = document.getElementById('depth-chart-section');
        if (existing) existing.remove();
        
        const depthChartSection = document.createElement('div');
        depthChartSection.id = 'depth-chart-section';
        depthChartSection.innerHTML = `
            <div class="depth-chart-header">
                <h2>2024 Depth Chart</h2>
                <div class="depth-chart-controls">
                    <button class="depth-btn active" data-unit="offense">Offense</button>
                    <button class="depth-btn" data-unit="defense">Defense</button>
                    <button class="depth-btn" data-unit="specialists">Specialists</button>
                </div>
            </div>
            <div id="depth-chart-content" class="depth-chart-content">
                <!-- Depth chart will be populated here -->
            </div>
        `;
        
        rosterTab.appendChild(depthChartSection);
        
        // Add event listeners
        document.querySelectorAll('.depth-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.depth-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.displayDepthChart(e.target.dataset.unit);
            });
        });
        
        // Display default offense depth chart
        this.displayDepthChart('offense');
    }

    displayDepthChart(unit) {
        const container = document.getElementById('depth-chart-content');
        const unitData = this.depthChart2024[unit];
        
        container.innerHTML = '';
        
        if (unit === 'offense') {
            this.renderOffenseDepthChart(container, unitData);
        } else if (unit === 'defense') {
            this.renderDefenseDepthChart(container, unitData);
        } else if (unit === 'specialists') {
            this.renderSpecialistsDepthChart(container, unitData);
        }
    }

    renderOffenseDepthChart(container, offenseData) {
        container.innerHTML = `
            <div class="formation">
                <div class="formation-line skill-positions">
                    <div class="position-group">
                        <h4>X-WR</h4>
                        ${this.renderPositionDepth(offenseData['X-WR'])}
                    </div>
                    <div class="position-group">
                        <h4>SL-WR</h4>
                        ${this.renderPositionDepth(offenseData['SL-WR'])}
                    </div>
                    <div class="position-group">
                        <h4>Z-WR</h4>
                        ${this.renderPositionDepth(offenseData['Z-WR'])}
                    </div>
                </div>
                
                <div class="formation-line backfield">
                    <div class="position-group">
                        <h4>QB</h4>
                        ${this.renderPositionDepth(offenseData.QB)}
                    </div>
                    <div class="position-group">
                        <h4>HB</h4>
                        ${this.renderPositionDepth(offenseData.HB)}
                    </div>
                    <div class="position-group">
                        <h4>TE</h4>
                        ${this.renderPositionDepth(offenseData.TE)}
                    </div>
                </div>
                
                <div class="formation-line offensive-line">
                    <div class="position-group">
                        <h4>LT</h4>
                        ${this.renderPositionDepth(offenseData.LT)}
                    </div>
                    <div class="position-group">
                        <h4>LG</h4>
                        ${this.renderPositionDepth(offenseData.LG)}
                    </div>
                    <div class="position-group">
                        <h4>C</h4>
                        ${this.renderPositionDepth(offenseData.C)}
                    </div>
                    <div class="position-group">
                        <h4>RG</h4>
                        ${this.renderPositionDepth(offenseData.RG)}
                    </div>
                    <div class="position-group">
                        <h4>RT</h4>
                        ${this.renderPositionDepth(offenseData.RT)}
                    </div>
                </div>
            </div>
        `;
    }

    renderDefenseDepthChart(container, defenseData) {
        container.innerHTML = `
            <div class="formation">
                <div class="formation-line defensive-line">
                    <div class="position-group">
                        <h4>STUD</h4>
                        ${this.renderPositionDepth(defenseData.STUD)}
                    </div>
                    <div class="position-group">
                        <h4>DT</h4>
                        ${this.renderPositionDepth(defenseData.DT1)}
                    </div>
                    <div class="position-group">
                        <h4>DT</h4>
                        ${this.renderPositionDepth(defenseData.DT2)}
                    </div>
                    <div class="position-group">
                        <h4>DE</h4>
                        ${this.renderPositionDepth(defenseData.DE)}
                    </div>
                </div>
                
                <div class="formation-line linebackers">
                    <div class="position-group">
                        <h4>LB</h4>
                        ${this.renderPositionDepth(defenseData.LB1)}
                    </div>
                    <div class="position-group">
                        <h4>LB</h4>
                        ${this.renderPositionDepth(defenseData.LB2)}
                    </div>
                    <div class="position-group">
                        <h4>ROVER</h4>
                        ${this.renderPositionDepth(defenseData.Rover)}
                    </div>
                </div>
                
                <div class="formation-line secondary">
                    <div class="position-group">
                        <h4>CB</h4>
                        ${this.renderPositionDepth(defenseData.CB1)}
                    </div>
                    <div class="position-group">
                        <h4>FS</h4>
                        ${this.renderPositionDepth(defenseData.FS)}
                    </div>
                    <div class="position-group">
                        <h4>SS</h4>
                        ${this.renderPositionDepth(defenseData.SS)}
                    </div>
                    <div class="position-group">
                        <h4>CB</h4>
                        ${this.renderPositionDepth(defenseData.CB2)}
                    </div>
                </div>
            </div>
        `;
    }

    renderSpecialistsDepthChart(container, specialsData) {
        container.innerHTML = `
            <div class="formation special-teams">
                <div class="formation-line">
                    <div class="position-group">
                        <h4>PK</h4>
                        ${this.renderPositionDepth(specialsData.PK)}
                    </div>
                    <div class="position-group">
                        <h4>PT</h4>
                        ${this.renderPositionDepth(specialsData.PT)}
                    </div>
                    <div class="position-group">
                        <h4>LS</h4>
                        ${this.renderPositionDepth(specialsData.LS)}
                    </div>
                </div>
                <div class="formation-line">
                    <div class="position-group">
                        <h4>KR</h4>
                        ${this.renderPositionDepth(specialsData.KR)}
                    </div>
                    <div class="position-group">
                        <h4>PR</h4>
                        ${this.renderPositionDepth(specialsData.PR)}
                    </div>
                    <div class="position-group">
                        <h4>KO</h4>
                        ${this.renderPositionDepth(specialsData.KO)}
                    </div>
                </div>
            </div>
        `;
    }

    renderPositionDepth(players) {
        return players.map((player, index) => `
            <div class="depth-player ${index === 0 ? 'starter' : 'backup'}">
                <span class="depth-name">${player}</span>
                <span class="depth-order">${index + 1}</span>
            </div>
        `).join('');
    }

    getPositionCategory(position) {
        if (!position) return 'all';
        
        const pos = position.toUpperCase();
        const offensePositions = ['QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'OG', 'C', 'G', 'T'];
        const defensePositions = ['DE', 'DT', 'NT', 'LB', 'CB', 'S', 'FS', 'SS', 'DB'];
        const specialPositions = ['K', 'P', 'LS', 'KR', 'PR'];
        
        if (offensePositions.includes(pos)) return 'offense';
        if (defensePositions.includes(pos)) return 'defense';
        if (specialPositions.includes(pos)) return 'special';
        return 'all';
    }

    filterRoster(position) {
        document.querySelectorAll('.player-card').forEach(card => {
            if (position === 'all' || card.dataset.position === position) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    async loadHistory() {
        try {
            const years = [2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014];
            const historicalData = [];
            
            for (const year of years) {
                const records = await this.makeRequest(`/records?year=${year}&team=Indiana`);
                if (records && records.length > 0) {
                    const record = records[0];
                    historicalData.push({
                        year: year,
                        overall: `${record.total.wins}-${record.total.losses}`,
                        conference: `${record.conferenceGames.wins}-${record.conferenceGames.losses}`
                    });
                }
            }
            
            this.displayHistory(historicalData);
        } catch (error) {
            console.error('Error loading history:', error);
            this.displayNoHistory();
        }
    }

    displayHistory(historicalData) {
        const container = document.getElementById('season-records');
        container.innerHTML = '';
        
        if (historicalData.length === 0) {
            this.displayNoHistory();
            return;
        }
        
        historicalData.forEach(season => {
            const recordItem = document.createElement('div');
            recordItem.className = 'season-record';
            
            recordItem.innerHTML = `
                <span><strong>${season.year}</strong></span>
                <span>Overall: ${season.overall}</span>
                <span>Conference: ${season.conference}</span>
            `;
            
            container.appendChild(recordItem);
        });
    }

    displayNoHistory() {
        const container = document.getElementById('season-records');
        container.innerHTML = '<p>Historical records will be loaded when available.</p>';
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new IndianaFootballApp();
});