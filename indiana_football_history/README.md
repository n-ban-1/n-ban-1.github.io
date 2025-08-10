
# Indiana Football Data Key

This dataset contains Indiana Hoosiers football data collected from ESPN's (unofficial) API.

## Data Structure per Game
Each season folder contains one subfolder per game, named `game_{eventId}`, with JSON files:

1. **schedule.json** - The team's full schedule for that season.
2. **summary.json** - High-level game details (score by quarter, leaders, recap link).
3. **boxscore.json** - Full statistical breakdown for both teams (passing, rushing, defense).
4. **play_by_play.json** - Sequential list of every play in the game.
5. **plays.json** - Core API play data, includes timestamps, yardage, scoring events.
6. **drives.json** - Summary of each offensive drive in the game.
7. **odds.json** - Betting odds from multiple sportsbooks (when available).
8. **probabilities.json** - ESPN win probability model output (when available).
9. **ats.json** - Against-the-spread performance for the season.

Note:
- Odds & win probability are only available for certain seasons and games.
- Older seasons may have incomplete stats or missing play-by-play.
