class IndianaFootballApp {
    constructor() {
        this.teamId = 84; // Indiana University team ID in ESPN
        this.currentYear = new Date().getFullYear();
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadCurrentSeasonData();
        this.hideLoading();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Season selector
        const seasonSelect = document.getElementById('season-select');
        if (seasonSelect) {
            seasonSelect.addEventListener('change', (e) => {
                this.loadSchedule(e.target.value);
            });
        }

        // Roster filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterRoster(e.target.dataset.position);
            });
        });
    }

    switchTab(tabName) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Load tab-specific data
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

    async loadCurrentSeasonData() {
        try {
            // Load team info and current season stats
            await Promise.all([
                this.loadTeamInfo(),
                this.loadTeamStats(),
                this.loadRecentGames()
            ]);
        } catch (error) {
            console.error('Error loading current season data:', error);
            this.showError('Failed to load current season data');
        }
    }

    async loadTeamInfo() {
        try {
            const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${this.teamId}`);
            const data = await response.json();
            
            const team = data.team;
            
            // Update team logo and name
            document.getElementById('team-logo').src = team.logos[0].href;
            document.getElementById('team-name').textContent = team.displayName;
            
            // Update record if available
            if (team.record && team.record.items) {
                const overallRecord = team.record.items.find(item => item.type === 'total');
                if (overallRecord) {
                    document.getElementById('team-record').textContent = overallRecord.summary;
                }
                
                const confRecord = team.record.items.find(item => item.type === 'vsconf');
                if (confRecord) {
                    document.getElementById('conference-record').textContent = `Conference: ${confRecord.summary}`;
                }
            }

            // Update conference
            if (team.groups && team.groups.parent) {
                document.getElementById('conference-name').textContent = team.groups.parent.name;
            }

        } catch (error) {
            console.error('Error loading team info:', error);
        }
    }

    async loadTeamStats() {
        try {
            const response = await fetch(`https://sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons/${this.currentYear}/types/2/teams/${this.teamId}/statistics`);
            const data = await response.json();
            
            if (data.items) {
                // Process stats
                data.items.forEach(statGroup => {
                    this.processStatGroup(statGroup);
                });
            }
        } catch (error) {
            console.error('Error loading team stats:', error);
            // Fallback to mock data
            this.loadMockStats();
        }
    }

    loadMockStats() {
        // Mock data for demonstration
        document.getElementById('ppg').textContent = '28.5';
        document.getElementById('ypg').textContent = '425.2';
        document.getElementById('pass-ypg').textContent = '265.8';
        document.getElementById('rush-ypg').textContent = '159.4';
        document.getElementById('def-ppg').textContent = '24.1';
        document.getElementById('def-ypg').textContent = '380.7';
        document.getElementById('turnovers').textContent = '18';
        document.getElementById('sacks').textContent = '32';
    }

    async loadRecentGames() {
        try {
            const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${this.teamId}/schedule`);
            const data = await response.json();
            
            const recentGames = data.events
                .filter(game => new Date(game.date) < new Date())
                .slice(-5)
                .reverse();

            this.displayRecentGames(recentGames);
        } catch (error) {
            console.error('Error loading recent games:', error);
            this.displayMockRecentGames();
        }
    }

    displayRecentGames(games) {
        const container = document.getElementById('recent-games');
        container.innerHTML = '';

        games.forEach(game => {
            const gameItem = document.createElement('div');
            gameItem.className = 'game-item';
            
            const competition = game.competitions[0];
            const homeTeam = competition.competitors.find(team => team.homeAway === 'home');
            const awayTeam = competition.competitors.find(team => team.homeAway === 'away');
            
            const isHomeGame = homeTeam.team.id == this.teamId;
            const opponent = isHomeGame ? awayTeam : homeTeam;
            const indianaTeam = isHomeGame ? homeTeam : awayTeam;
            
            const result = competition.status.type.completed ? 
                (parseInt(indianaTeam.score) > parseInt(opponent.score) ? 'W' : 'L') : 'TBD';
            
            const score = competition.status.type.completed ? 
                `${indianaTeam.score}-${opponent.score}` : 'TBD';

            gameItem.innerHTML = `
                <div class="game-info">
                    <div class="opponent">${isHomeGame ? 'vs' : '@'} ${opponent.team.shortDisplayName}</div>
                    <div class="game-date">${new Date(game.date).toLocaleDateString()}</div>
                </div>
                <div class="game-result ${result.toLowerCase()}">${result} ${score}</div>
            `;
            
            container.appendChild(gameItem);
        });
    }

    displayMockRecentGames() {
        const container = document.getElementById('recent-games');
        const mockGames = [
            { opponent: 'Ohio State', result: 'L', score: '21-38', date: '2024-11-09' },
            { opponent: 'Michigan State', result: 'W', score: '31-17', date: '2024-11-02' },
            { opponent: 'Michigan', result: 'L', score: '14-31', date: '2024-10-26' },
            { opponent: 'Northwestern', result: 'W', score: '28-21', date: '2024-10-19' },
            { opponent: 'Nebraska', result: 'W', score: '35-21', date: '2024-10-12' }
        ];

        container.innerHTML = '';
        
        mockGames.forEach(game => {
            const gameItem = document.createElement('div');
            gameItem.className = 'game-item';
            
            gameItem.innerHTML = `
                <div class="game-info">
                    <div class="opponent">vs ${game.opponent}</div>
                    <div class="game-date">${new Date(game.date).toLocaleDateString()}</div>
                </div>
                <div class="game-result ${game.result.toLowerCase()}">${game.result} ${game.score}</div>
            `;
            
            container.appendChild(gameItem);
        });
    }

    async loadSchedule(year) {
        try {
            const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${this.teamId}/schedule?season=${year}`);
            const data = await response.json();
            
            this.displaySchedule(data.events);
        } catch (error) {
            console.error('Error loading schedule:', error);
            this.displayMockSchedule();
        }
    }

    displaySchedule(games) {
        const container = document.getElementById('schedule-list');
        container.innerHTML = '';

        games.forEach(game => {
            const scheduleItem = document.createElement('div');
            scheduleItem.className = 'schedule-item';
            
            const competition = game.competitions[0];
            const homeTeam = competition.competitors.find(team => team.homeAway === 'home');
            const awayTeam = competition.competitors.find(team => team.homeAway === 'away');
            
            const isHomeGame = homeTeam.team.id == this.teamId;
            const opponent = isHomeGame ? awayTeam : homeTeam;
            
            const gameDate = new Date(game.date);
            const status = competition.status.type.name;
            const isCompleted = competition.status.type.completed;
            
            let statusClass = 'status-upcoming';
            let statusText = gameDate.toLocaleDateString();
            
            if (status === 'STATUS_IN_PROGRESS') {
                statusClass = 'status-live';
                statusText = 'LIVE';
            } else if (isCompleted) {
                statusClass = 'status-final';
                const indianaTeam = isHomeGame ? homeTeam : awayTeam;
                const result = parseInt(indianaTeam.score) > parseInt(opponent.score) ? 'W' : 'L';
                statusText = `${result} ${indianaTeam.score}-${opponent.score}`;
            }

            scheduleItem.innerHTML = `
                <div class="game-details">
                    <div class="opponent-name">${isHomeGame ? 'vs' : '@'} ${opponent.team.displayName}</div>
                    <div class="game-time">${gameDate.toLocaleDateString()} - ${gameDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    <div class="game-location">${competition.venue ? competition.venue.fullName : 'TBD'}</div>
                </div>
                <div class="game-status ${statusClass}">${statusText}</div>
            `;
            
            container.appendChild(scheduleItem);
        });
    }

    displayMockSchedule() {
        const container = document.getElementById('schedule-list');
        const mockSchedule = [
            { opponent: 'Florida International', date: '2024-08-29', result: 'W 31-7', completed: true },
            { opponent: 'Western Illinois', date: '2024-09-07', result: 'W 77-3', completed: true },
            { opponent: 'UCLA', date: '2024-09-14', result: 'L 17-42', completed: true },
            { opponent: 'Charlotte', date: '2024-09-21', result: 'W 52-14', completed: true },
            { opponent: 'Maryland', date: '2024-09-28', result: 'L 28-31', completed: true },
            { opponent: 'Northwestern', date: '2024-10-05', result: 'W 41-24', completed: true },
            { opponent: 'Nebraska', date: '2024-10-19', result: 'W 56-7', completed: true },
            { opponent: 'Washington', date: '2024-10-26', result: 'L 21-31', completed: true },
            { opponent: 'Michigan State', date: '2024-11-02', result: 'W 47-10', completed: true },
            { opponent: 'Michigan', date: '2024-11-09', result: 'L 20-20', completed: true },
            { opponent: 'Ohio State', date: '2024-11-23', result: '', completed: false },
            { opponent: 'Purdue', date: '2024-11-30', result: '', completed: false }
        ];

        container.innerHTML = '';
        
        mockSchedule.forEach(game => {
            const scheduleItem = document.createElement('div');
            scheduleItem.className = 'schedule-item';
            
            let statusClass = game.completed ? 'status-final' : 'status-upcoming';
            let statusText = game.completed ? game.result : new Date(game.date).toLocaleDateString();
            
            scheduleItem.innerHTML = `
                <div class="game-details">
                    <div class="opponent-name">vs ${game.opponent}</div>
                    <div class="game-time">${new Date(game.date).toLocaleDateString()}</div>
                    <div class="game-location">Memorial Stadium</div>
                </div>
                <div class="game-status ${statusClass}">${statusText}</div>
            `;
            
            container.appendChild(scheduleItem);
        });
    }

    async loadRoster() {
        try {
            const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${this.teamId}/roster`);
            const data = await response.json();
            
            this.displayRoster(data.athletes);
        } catch (error) {
            console.error('Error loading roster:', error);
            this.displayMockRoster();
        }
    }

    displayRoster(athletes) {
        const container = document.getElementById('roster-list');
        container.innerHTML = '';

        athletes.forEach(athlete => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.dataset.position = this.getPositionCategory(athlete.position.abbreviation);
            
            playerCard.innerHTML = `
                <div class="player-number">#${athlete.jersey || 'N/A'}</div>
                <div class="player-name">${athlete.fullName}</div>
                <div class="player-position">${athlete.position.abbreviation}</div>
            `;
            
            container.appendChild(playerCard);
        });
    }

    displayMockRoster() {
        const container = document.getElementById('roster-list');
        const mockRoster = [
            { number: 13, name: 'Kurtis Rourke', position: 'QB', category: 'offense' },
            { number: 6, name: 'Tayven Jackson', position: 'QB', category: 'offense' },
            { number: 25, name: 'Justice Ellison', position: 'RB', category: 'offense' },
            { number: 28, name: 'Ty Son Lawton', position: 'RB', category: 'offense' },
            { number: 1, name: 'Elijah Sarratt', position: 'WR', category: 'offense' },
            { number: 3, name: 'Myles Price', position: 'WR', category: 'offense' },
            { number: 88, name: 'Zach Horton', position: 'TE', category: 'offense' },
            { number: 73, name: 'Carter Smith', position: 'OL', category: 'offense' },
            { number: 54, name: 'Trevor Lauck', position: 'OL', category: 'offense' },
            { number: 44, name: 'Aiden Fisher', position: 'LB', category: 'defense' },
            { number: 2, name: 'Jailin Walker', position: 'CB', category: 'defense' },
            { number: 21, name: 'Jamier Johnson', position: 'S', category: 'defense' },
            { number: 90, name: 'Mikail Kamara', position: 'DE', category: 'defense' },
            { number: 99, name: 'CJ West', position: 'DT', category: 'defense' },
            { number: 47, name: 'Nicolas Toomer', position: 'K', category: 'special' },
            { number: 39, name: 'James Evans', position: 'P', category: 'special' }
        ];

        container.innerHTML = '';
        
        mockRoster.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.dataset.position = player.category;
            
            playerCard.innerHTML = `
                <div class="player-number">#${player.number}</div>
                <div class="player-name">${player.name}</div>
                <div class="player-position">${player.position}</div>
            `;
            
            container.appendChild(playerCard);
        });
    }

    getPositionCategory(position) {
        const offensePositions = ['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'C', 'G', 'T'];
        const defensePositions = ['DE', 'DT', 'NT', 'LB', 'CB', 'S', 'FS', 'SS'];
        const specialPositions = ['K', 'P', 'LS'];
        
        if (offensePositions.includes(position)) return 'offense';
        if (defensePositions.includes(position)) return 'defense';
        if (specialPositions.includes(position)) return 'special';
        return 'all';
    }

    filterRoster(position) {
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-position="${position}"]`).classList.add('active');

        // Filter player cards
        document.querySelectorAll('.player-card').forEach(card => {
            if (position === 'all' || card.dataset.position === position) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    loadHistory() {
        const seasonRecords = [
            { year: '2023', record: '3-9', conference: '1-8' },
            { year: '2022', record: '4-8', conference: '2-7' },
            { year: '2021', record: '2-10', conference: '0-9' },
            { year: '2020', record: '6-2', conference: '6-1' },
            { year: '2019', record: '8-5', conference: '5-4' },
            { year: '2018', record: '5-7', conference: '2-7' },
            { year: '2017', record: '5-7', conference: '2-7' },
            { year: '2016', record: '6-7', conference: '3-6' },
            { year: '2015', record: '6-7', conference: '2-6' },
            { year: '2014', record: '4-8', conference: '1-7' }
        ];

        const container = document.getElementById('season-records');
        container.innerHTML = '';
        
        seasonRecords.forEach(season => {
            const recordItem = document.createElement('div');
            recordItem.className = 'season-record';
            
            recordItem.innerHTML = `
                <span><strong>${season.year}</strong></span>
                <span>Overall: ${season.record}</span>
                <span>Conference: ${season.conference}</span>
            `;
            
            container.appendChild(recordItem);
        });
    }

    processStatGroup(statGroup) {
        // This would process actual stat groups from the API
        // For now, we'll use mock data
        console.log('Processing stat group:', statGroup);
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    showError(message) {
        const loading = document.getElementById('loading');
        loading.innerHTML = `<p style="color: #ff6b6b;">${message}</p>`;
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new IndianaFootballApp();
});

// Add some utility functions for enhanced functionality
function formatDate(dateString) {
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

function calculateWinPercentage(wins, losses) {
    const total = wins + losses;
    return total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';
}

// Add keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= '4') {
        const tabs = ['current', 'schedule', 'roster', 'history'];
        const tabIndex = parseInt(e.key) - 1;
        if (tabs[tabIndex]) {
            document.querySelector(`[data-tab="${tabs[tabIndex]}"]`).click();
        }
    }
});