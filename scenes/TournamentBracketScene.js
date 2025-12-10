class TournamentBracketScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TournamentBracketScene' });
    }

    init(data) {
        this.mode = data.mode || localStorage.getItem('tournamentMode') || 'qualifiers';
        this.currentRound = data.round || localStorage.getItem('tournamentRound') || (this.mode === 'qualifiers' ? 'roundOf16' : 'roundOf32');
        
        // Ensure tournament remains active when viewing bracket
        localStorage.setItem('tournamentActive', 'true');
        localStorage.setItem('tournamentMode', this.mode);
        localStorage.setItem('tournamentRound', this.currentRound);
        
        console.log('TournamentBracketScene init:', { mode: this.mode, currentRound: this.currentRound });
    }

    create() {
        // Background
        this.cameras.main.setBackgroundColor('#1a1a1a');
        
        // Load existing bracket or generate new one
        this.loadOrGenerateBracket();
        
        // Title
        const tournamentName = this.mode === 'qualifiers' ? 'QUALIFIERS CUP' : 'CHAMPIONS CUP';
        this.add.text(640, 50, tournamentName, {
            fontSize: '36px',
            fill: '#ffcc00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        
        // Current round indicator
        let roundName = this.currentRound;
        if (roundName === 'roundOf16') roundName = 'ROUND OF 16';
        else if (roundName === 'roundOf32') roundName = 'ROUND OF 32';
        else if (roundName === 'quarterFinals') roundName = 'QUARTER FINALS';
        else if (roundName === 'semiFinals') roundName = 'SEMI FINALS';
        else if (roundName === 'finals') roundName = 'FINALS';
        
        this.add.text(640, 90, `Next: ${roundName}`, {
            fontSize: '24px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        
        // Draw bracket
        this.drawBracket();
        
        // Continue button
        const continueBtn = this.add.rectangle(640, 650, 250, 60, 0x00aa00, 1);
        continueBtn.setStrokeStyle(3, 0x00ff00);
        continueBtn.setInteractive();
        
        const continueText = this.add.text(640, 650, 'PLAY MATCH', {
            fontSize: '28px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#003300',
            strokeThickness: 3
        }).setOrigin(0.5);
        
        continueBtn.on('pointerover', () => {
            continueBtn.setScale(1.05);
            continueText.setScale(1.05);
            continueBtn.setFillStyle(0x00ff00);
        });
        
        continueBtn.on('pointerout', () => {
            continueBtn.setScale(1);
            continueText.setScale(1);
            continueBtn.setFillStyle(0x00aa00);
        });
        
        continueBtn.on('pointerdown', () => {
            this.scene.start('TournamentGameScene', {
                mode: this.mode,
                round: this.currentRound,
                opponent: this.getNextOpponent()
            });
        });
        
        // Back to menu button
        const backBtn = this.add.rectangle(100, 650, 150, 50, 0x666666, 1);
        backBtn.setStrokeStyle(2, 0x999999);
        backBtn.setInteractive();
        
        const backText = this.add.text(100, 650, 'BACK', {
            fontSize: '20px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        backBtn.on('pointerdown', () => {
            // Tournament remains active when going back to menu
            console.log('Going back to tournament menu, tournament remains active');
            this.scene.start('TournamentMenuScene');
        });
    }
    
    loadOrGenerateBracket() {
        // Try to load existing bracket
        const savedBracket = localStorage.getItem('tournamentBracket');
        
        if (savedBracket) {
            // Load existing bracket
            this.bracket = JSON.parse(savedBracket);
            console.log('Loaded existing bracket:', this.bracket);
        } else {
            // Generate new bracket
            this.generateBracket();
            // Save the new bracket
            localStorage.setItem('tournamentBracket', JSON.stringify(this.bracket));
        }
    }

    generateBracket() {
        // Generate random team names
        const teamNames = [
            "Thunder Strikers", "Golden Eagles", "Fire Dragons", "Ice Wolves",
            "Storm Chasers", "Lightning Bolts", "Shadow Hunters", "Crimson Tide",
            "Blue Sharks", "Green Hornets", "Silver Bullets", "Black Panthers",
            "Red Devils", "White Knights", "Purple Reign", "Orange Crush",
            "Mighty Ducks", "Wild Cats", "Brave Lions", "Swift Falcons",
            "Iron Giants", "Steel Warriors", "Bronze Titans", "Copper Kings",
            "Diamond Aces", "Platinum Stars", "Gold Rush", "Silver Lining",
            "Neon Ninjas", "Cyber Samurai", "Pixel Pirates", "Digital Demons"
        ];
        
        const playerTeam = localStorage.getItem('tournamentTeamName') || 'Your Team';
        const numTeams = this.mode === 'champions' ? 32 : 16;
        
        // Shuffle and select teams
        const shuffled = [...teamNames].sort(() => Math.random() - 0.5);
        const selectedTeams = shuffled.slice(0, numTeams - 1);
        selectedTeams.unshift(playerTeam); // Player team first
        
        this.teams = selectedTeams;
        this.bracket = this.createBracketStructure();
    }
    
    createBracketStructure() {
        const bracket = {};
        const playerTeam = this.teams[0];
        
        // Create initial round matches
        if (this.mode === 'champions') {
            // Round of 32 (16 matches)
            bracket.roundOf32 = [];
            for (let i = 0; i < 16; i++) {
                bracket.roundOf32.push({
                    team1: this.teams[i * 2] || 'TBD',
                    team2: this.teams[i * 2 + 1] || 'TBD',
                    winner: null
                });
            }
            
            // Initialize empty subsequent rounds
            bracket.roundOf16 = Array(8).fill(null).map(() => ({ team1: 'TBD', team2: 'TBD', winner: null }));
            bracket.quarterFinals = Array(4).fill(null).map(() => ({ team1: 'TBD', team2: 'TBD', winner: null }));
            bracket.semiFinals = Array(2).fill(null).map(() => ({ team1: 'TBD', team2: 'TBD', winner: null }));
            bracket.finals = { team1: 'TBD', team2: 'TBD', winner: null };
        } else {
            // Round of 16 (8 matches)
            bracket.roundOf16 = [];
            for (let i = 0; i < 8; i++) {
                bracket.roundOf16.push({
                    team1: this.teams[i * 2] || 'TBD',
                    team2: this.teams[i * 2 + 1] || 'TBD',
                    winner: null
                });
            }
            
            // Initialize empty subsequent rounds
            bracket.quarterFinals = Array(4).fill(null).map(() => ({ team1: 'TBD', team2: 'TBD', winner: null }));
            bracket.semiFinals = Array(2).fill(null).map(() => ({ team1: 'TBD', team2: 'TBD', winner: null }));
            bracket.finals = { team1: 'TBD', team2: 'TBD', winner: null };
        }
        
        return bracket;
    }
    
    drawBracket() {
        if (this.mode === 'champions') {
            this.drawBracket32();
        } else {
            this.drawBracket16();
        }
    }
    
    drawBracket16() {
        const startY = 140;
        const spacing = 60;
        const boxWidth = 140;
        const boxHeight = 25;
        const playerTeam = localStorage.getItem('tournamentTeamName') || 'Your Team';
        
        // Round of 16 (left side)
        this.add.text(200, 120, 'ROUND OF 16', { fontSize: '16px', fill: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5);
        
        const r16Matches = this.bracket.roundOf16 || [];
        for (let i = 0; i < 8; i++) {
            const match = r16Matches[i] || { team1: 'TBD', team2: 'TBD', winner: null };
            const y = startY + i * spacing;
            
            // Team 1
            const team1Color = match.team1 === playerTeam ? 0xffff00 : (match.winner === match.team1 ? 0x00aa00 : 0x4488cc);
            this.add.rectangle(200, y, boxWidth, boxHeight, team1Color, 1).setStrokeStyle(1, 0xffffff);
            this.add.text(200, y, this.truncateTeamName(match.team1), { fontSize: '12px', fill: '#000000', fontStyle: 'bold' }).setOrigin(0.5);
            
            // Team 2
            const team2Color = match.team2 === playerTeam ? 0xffff00 : (match.winner === match.team2 ? 0x00aa00 : 0x4488cc);
            this.add.rectangle(200, y + 30, boxWidth, boxHeight, team2Color, 1).setStrokeStyle(1, 0xffffff);
            this.add.text(200, y + 30, this.truncateTeamName(match.team2), { fontSize: '12px', fill: '#000000', fontStyle: 'bold' }).setOrigin(0.5);
        }
        
        // Quarter Finals - should show 8 teams (4 matches)
        this.add.text(400, 120, 'QUARTER FINALS', { fontSize: '16px', fill: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5);
        const qfMatches = this.bracket.quarterFinals || [];
        for (let i = 0; i < 4; i++) {
            const match = qfMatches[i] || { team1: 'TBD', team2: 'TBD', winner: null };
            const y = startY + 30 + i * (spacing * 2);
            
            // Team 1
            const team1Color = match.team1 === playerTeam ? 0xffff00 : (match.winner === match.team1 ? 0x00aa00 : (match.team1 !== 'TBD' ? 0x4488cc : 0x666666));
            this.add.rectangle(400, y, boxWidth, boxHeight, team1Color, 1).setStrokeStyle(1, 0xffffff);
            this.add.text(400, y, this.truncateTeamName(match.team1 || 'TBD'), { fontSize: '12px', fill: team1Color === 0x666666 ? '#ffffff' : '#000000', fontStyle: 'bold' }).setOrigin(0.5);
            
            // Team 2
            const team2Color = match.team2 === playerTeam ? 0xffff00 : (match.winner === match.team2 ? 0x00aa00 : (match.team2 !== 'TBD' ? 0x4488cc : 0x666666));
            this.add.rectangle(400, y + 30, boxWidth, boxHeight, team2Color, 1).setStrokeStyle(1, 0xffffff);
            this.add.text(400, y + 30, this.truncateTeamName(match.team2 || 'TBD'), { fontSize: '12px', fill: team2Color === 0x666666 ? '#ffffff' : '#000000', fontStyle: 'bold' }).setOrigin(0.5);
        }
        
        // Semi Finals - should show 4 teams (2 matches)
        this.add.text(600, 120, 'SEMI FINALS', { fontSize: '16px', fill: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5);
        const sfMatches = this.bracket.semiFinals || [];
        for (let i = 0; i < 2; i++) {
            const match = sfMatches[i] || { team1: 'TBD', team2: 'TBD', winner: null };
            const y = startY + 90 + i * (spacing * 4);
            
            // Team 1
            const team1Color = match.team1 === playerTeam ? 0xffff00 : (match.winner === match.team1 ? 0x00aa00 : (match.team1 !== 'TBD' ? 0x4488cc : 0x666666));
            this.add.rectangle(600, y, boxWidth, boxHeight, team1Color, 1).setStrokeStyle(1, 0xffffff);
            this.add.text(600, y, this.truncateTeamName(match.team1 || 'TBD'), { fontSize: '12px', fill: team1Color === 0x666666 ? '#ffffff' : '#000000', fontStyle: 'bold' }).setOrigin(0.5);
            
            // Team 2
            const team2Color = match.team2 === playerTeam ? 0xffff00 : (match.winner === match.team2 ? 0x00aa00 : (match.team2 !== 'TBD' ? 0x4488cc : 0x666666));
            this.add.rectangle(600, y + 30, boxWidth, boxHeight, team2Color, 1).setStrokeStyle(1, 0xffffff);
            this.add.text(600, y + 30, this.truncateTeamName(match.team2 || 'TBD'), { fontSize: '12px', fill: team2Color === 0x666666 ? '#ffffff' : '#000000', fontStyle: 'bold' }).setOrigin(0.5);
        }
        
        // Finals - should show 2 teams (1 match)
        this.add.text(800, 120, 'FINALS', { fontSize: '16px', fill: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5);
        const finalMatch = this.bracket.finals || { team1: 'TBD', team2: 'TBD', winner: null };
        
        // Team 1
        const final1Color = finalMatch.team1 === playerTeam ? 0xffff00 : (finalMatch.winner === finalMatch.team1 ? 0x00aa00 : (finalMatch.team1 !== 'TBD' ? 0x4488cc : 0x666666));
        this.add.rectangle(800, startY + 210, boxWidth, boxHeight, final1Color, 1).setStrokeStyle(1, 0xffffff);
        this.add.text(800, startY + 210, this.truncateTeamName(finalMatch.team1 || 'TBD'), { fontSize: '12px', fill: final1Color === 0x666666 ? '#ffffff' : '#000000', fontStyle: 'bold' }).setOrigin(0.5);
        
        // Team 2
        const final2Color = finalMatch.team2 === playerTeam ? 0xffff00 : (finalMatch.winner === finalMatch.team2 ? 0x00aa00 : (finalMatch.team2 !== 'TBD' ? 0x4488cc : 0x666666));
        this.add.rectangle(800, startY + 240, boxWidth, boxHeight, final2Color, 1).setStrokeStyle(1, 0xffffff);
        this.add.text(800, startY + 240, this.truncateTeamName(finalMatch.team2 || 'TBD'), { fontSize: '12px', fill: final2Color === 0x666666 ? '#ffffff' : '#000000', fontStyle: 'bold' }).setOrigin(0.5);
        
        // Winner
        this.add.text(1000, 120, 'WINNER', { fontSize: '16px', fill: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5);
        const winner = finalMatch.winner || '🏆';
        const winnerColor = winner === playerTeam ? 0xffff00 : (winner !== '🏆' ? 0x00aa00 : 0xffcc00);
        this.add.rectangle(1000, startY + 210, boxWidth, boxHeight, winnerColor, 1).setStrokeStyle(2, 0xffffff);
        this.add.text(1000, startY + 210, winner === '🏆' ? winner : this.truncateTeamName(winner), { fontSize: winner === '🏆' ? '20px' : '12px', fill: '#000000', fontStyle: 'bold' }).setOrigin(0.5);
    }
    
    drawBracket32() {
        const playerTeam = localStorage.getItem('tournamentTeamName') || 'Your Team';
        
        if (this.currentRound === 'roundOf32') {
            // Round of 32: Show all 32 teams in grid format (not bracket)
            this.add.text(640, 130, 'CHAMPIONS CUP - ROUND OF 32', { fontSize: '28px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
            this.add.text(640, 160, 'All 32 Competing Teams', { fontSize: '22px', fill: '#ffff00' }).setOrigin(0.5);
            
            // Display teams in a compact grid format
            const startY = 200;
            const teamBoxWidth = 140;
            const teamBoxHeight = 22;
            const spacing = 28;
            const teamsPerColumn = 8;
            
            if (this.bracket.roundOf32) {
                const r32Matches = this.bracket.roundOf32 || [];
                let teamIndex = 0;
                
                for (let col = 0; col < 4; col++) {
                    const x = 180 + col * 230; // Spread columns across screen
                    
                    for (let row = 0; row < teamsPerColumn && teamIndex < r32Matches.length * 2; row++) {
                        const matchIndex = Math.floor(teamIndex / 2);
                        const isTeam1 = teamIndex % 2 === 0;
                        const match = r32Matches[matchIndex];
                        
                        if (match) {
                            const team = isTeam1 ? match.team1 : match.team2;
                            const y = startY + row * spacing;
                            
                            // Color coding
                            let teamColor = 0x4488cc; // Default blue
                            if (team === playerTeam) {
                                teamColor = 0xffff00; // Player team yellow
                            } else if (match.winner === team) {
                                teamColor = 0x00aa00; // Winner green
                            }
                            
                            // Team box
                            this.add.rectangle(x, y, teamBoxWidth, teamBoxHeight, teamColor, 1).setStrokeStyle(1, 0xffffff);
                            this.add.text(x, y, this.truncateTeamName(team, 14), { 
                                fontSize: '11px', 
                                fill: '#000000', 
                                fontStyle: 'bold' 
                            }).setOrigin(0.5);
                        }
                        
                        teamIndex++;
                    }
                }
            }
            
            // Show next opponent if available
            const nextOpponent = this.getNextOpponent();
            if (nextOpponent && nextOpponent !== 'TBD') {
                this.add.text(640, 450, `Next Match: ${playerTeam} vs ${nextOpponent}`, { fontSize: '20px', fill: '#ffffff' }).setOrigin(0.5);
            }
        } else {
            // Round of 16 and beyond: Show bracket like Qualifiers Cup
            this.drawBracket16();
        }
    }
    
    truncateTeamName(name, maxLength = 15) {
        if (!name || name === 'TBD') return name;
        return name.length > maxLength ? name.substring(0, maxLength - 3) + '...' : name;
    }
    
    getNextOpponent() {
        const playerTeam = localStorage.getItem('tournamentTeamName') || 'Your Team';
        const currentRound = this.currentRound;
        
        // Find player's match in current round
        if (this.bracket[currentRound]) {
            const matches = Array.isArray(this.bracket[currentRound]) ? this.bracket[currentRound] : [this.bracket[currentRound]];
            
            for (let match of matches) {
                if (match.team1 === playerTeam) {
                    return match.team2;
                } else if (match.team2 === playerTeam) {
                    return match.team1;
                }
            }
        }
        
        // Fallback to random opponent
        const opponents = ['Thunder Strikers', 'Golden Eagles', 'Fire Dragons', 'Ice Wolves'];
        return opponents[Math.floor(Math.random() * opponents.length)];
    }
}