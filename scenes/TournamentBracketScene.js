class TournamentBracketScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TournamentBracketScene' });
    }

    init(data) {
        this.mode = data.mode || localStorage.getItem('tournamentMode') || 'qualifiers';
        this.currentRound = data.round || localStorage.getItem('tournamentRound') || (this.mode === 'qualifiers' ? 'roundOf16' : 'roundOf32');

        // Only mark the tournament active if it is genuinely in progress.
        // Previously this ran unconditionally, so simply viewing a bracket
        // resurrected a finished tournament and brought back the
        // "CONTINUE TOURNAMENT" button on the menu.
        if (localStorage.getItem('tournamentRound')) {
            localStorage.setItem('tournamentActive', 'true');
        }
        localStorage.setItem('tournamentMode', this.mode);
        if (!localStorage.getItem('tournamentRound')) {
            localStorage.setItem('tournamentRound', this.currentRound);
        }

    }

    create() {
        /* The bracket used to be a flat black void while every other screen was
         * a stadium. It is the one content-heavy screen in the tournament - 16
         * team names and five round headers - so the emptiness read as a debug
         * view rather than a design choice. */
        UI.stadium(this, { alpha: 0.55, groundAlpha: 0.35, grassAlpha: 0.25, dim: 0.45 });

        // Load existing bracket or generate new one
        this.loadOrGenerateBracket();

        // Title
        const tournamentName = this.mode === 'qualifiers' ? 'QUALIFIERS CUP' : 'CHAMPIONS CUP';
        UI.title(this, {
            text: tournamentName, x: 640, y: 52,
            size: UI.TYPE.title, fill: '#ffcc00',
            stroke: '#000000', thickness: 4, offset: 2
        });

        // Current round indicator
        let roundName = this.currentRound;
        if (roundName === 'roundOf16') roundName = 'ROUND OF 16';
        else if (roundName === 'roundOf32') roundName = 'ROUND OF 32';
        else if (roundName === 'quarterFinals') roundName = 'QUARTER FINALS';
        else if (roundName === 'semiFinals') roundName = 'SEMI FINALS';
        else if (roundName === 'finals') roundName = 'FINALS';

        this.add.text(640, 98, `Next: ${roundName}`, {
            fontSize: UI.TYPE.body + 'px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        // Draw bracket
        this.drawBracket();

        // Play match button
        UI.button(this, {
            x: 640, y: 662, w: 280, h: 64,
            label: 'PLAY MATCH',
            textSize: UI.TYPE.lead,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a,
            radius: 16,
            onClick: () => {
                this.scene.start('TournamentGameScene', {
                    mode: this.mode,
                    round: this.currentRound,
                    opponent: this.getNextOpponent()
                });
            }
        });

        /* M2: the red X from Settings, so closing is in the same place on every
         * sub-screen instead of BACK at bottom-left here and bottom-centre there.
         * Placed in the top-right corner because the bracket columns run from
         * x=120 to x=1080 and a panel-relative position would land on the
         * WINNER column. */
        UI.closeButton(this, {
            x: 1240, y: 40, r: 22,
            onClick: () => this.scene.start('TournamentMenuScene')
        });
    }

    loadOrGenerateBracket() {
        // Try to load existing bracket
        const savedBracket = localStorage.getItem('tournamentBracket');

        if (savedBracket) {
            // Load existing bracket
            this.bracket = JSON.parse(savedBracket);
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
        /* startY 138 with spacing 58 puts the 16th team box at 574, ending at
         * 587 - which clears the top of the PLAY MATCH button (630) by 43px. It
         * was 590 / spacing 60, ending at 602 with only 28px of clearance, and on
         * a 32-team bracket the grid ran straight through the bottom bar.
         *
         * boxWidth 140 -> 160 because the team name went from 12px to 14px and
         * 140px could no longer hold a long name without clipping. */
        const startY = 152;
        const spacing = 58;
        const boxWidth = 160;
        const boxHeight = 26;
        const playerTeam = localStorage.getItem('tournamentTeamName') || 'Your Team';

        // Round of 16 (left side)
        this.add.text(200, 126, 'ROUND OF 16', { fontSize: UI.TYPE.body + 'px', fill: '#ffcc00', fontStyle: 'bold' }).setOrigin(0.5);

        const r16Matches = this.bracket.roundOf16 || [];
        for (let i = 0; i < 8; i++) {
            const match = r16Matches[i] || { team1: 'TBD', team2: 'TBD', winner: null };
            const y = startY + i * spacing;

            // Team 1
            const isPlayer1 = match.team1 === playerTeam;
            const team1Color = isPlayer1 ? 0xffff00 : (match.winner === match.team1 ? 0x00aa00 : 0x4488cc);
            this.add.rectangle(200, y, boxWidth, boxHeight, team1Color, 1).setStrokeStyle(isPlayer1 ? 3 : 1, isPlayer1 ? 0xffffff : 0xffffff);
            this.add.text(200, y, this.truncateTeamName(match.team1), { fontSize: UI.TYPE.small + 'px', fill: '#000000', fontStyle: 'bold' }).setOrigin(0.5);
            if (isPlayer1) this.drawPlayerMarker(200, y, boxHeight);

            // Team 2
            const isPlayer2 = match.team2 === playerTeam;
            const team2Color = isPlayer2 ? 0xffff00 : (match.winner === match.team2 ? 0x00aa00 : 0x4488cc);
            this.add.rectangle(200, y + 30, boxWidth, boxHeight, team2Color, 1).setStrokeStyle(isPlayer2 ? 3 : 1, 0xffffff);
            this.add.text(200, y + 30, this.truncateTeamName(match.team2), { fontSize: UI.TYPE.small + 'px', fill: '#000000', fontStyle: 'bold' }).setOrigin(0.5);
            if (isPlayer2) this.drawPlayerMarker(200, y + 30, boxHeight);
        }

        // Quarter Finals - should show 8 teams (4 matches)
        this.add.text(400, 126, 'QUARTER FINALS', { fontSize: UI.TYPE.body + 'px', fill: '#ffcc00', fontStyle: 'bold' }).setOrigin(0.5);
        const qfMatches = this.bracket.quarterFinals || [];
        for (let i = 0; i < 4; i++) {
            const match = qfMatches[i] || { team1: 'TBD', team2: 'TBD', winner: null };
            const y = startY + 30 + i * (spacing * 2);

            // Team 1
            const team1Color = match.team1 === playerTeam ? 0xffff00 : (match.winner === match.team1 ? 0x00aa00 : (match.team1 !== 'TBD' ? 0x4488cc : 0x666666));
            this.add.rectangle(400, y, boxWidth, boxHeight, team1Color, 1).setStrokeStyle(1, 0xffffff);
            this.add.text(400, y, this.truncateTeamName(match.team1 || 'TBD'), { fontSize: UI.TYPE.small + 'px', fill: team1Color === 0x666666 ? '#ffffff' : '#000000', fontStyle: 'bold' }).setOrigin(0.5);

            // Team 2
            const team2Color = match.team2 === playerTeam ? 0xffff00 : (match.winner === match.team2 ? 0x00aa00 : (match.team2 !== 'TBD' ? 0x4488cc : 0x666666));
            this.add.rectangle(400, y + 30, boxWidth, boxHeight, team2Color, 1).setStrokeStyle(1, 0xffffff);
            this.add.text(400, y + 30, this.truncateTeamName(match.team2 || 'TBD'), { fontSize: UI.TYPE.small + 'px', fill: team2Color === 0x666666 ? '#ffffff' : '#000000', fontStyle: 'bold' }).setOrigin(0.5);
        }

        // Semi Finals - should show 4 teams (2 matches)
        this.add.text(600, 126, 'SEMI FINALS', { fontSize: UI.TYPE.body + 'px', fill: '#ffcc00', fontStyle: 'bold' }).setOrigin(0.5);
        const sfMatches = this.bracket.semiFinals || [];
        for (let i = 0; i < 2; i++) {
            const match = sfMatches[i] || { team1: 'TBD', team2: 'TBD', winner: null };
            const y = startY + 90 + i * (spacing * 4);

            // Team 1
            const team1Color = match.team1 === playerTeam ? 0xffff00 : (match.winner === match.team1 ? 0x00aa00 : (match.team1 !== 'TBD' ? 0x4488cc : 0x666666));
            this.add.rectangle(600, y, boxWidth, boxHeight, team1Color, 1).setStrokeStyle(1, 0xffffff);
            this.add.text(600, y, this.truncateTeamName(match.team1 || 'TBD'), { fontSize: UI.TYPE.small + 'px', fill: team1Color === 0x666666 ? '#ffffff' : '#000000', fontStyle: 'bold' }).setOrigin(0.5);

            // Team 2
            const team2Color = match.team2 === playerTeam ? 0xffff00 : (match.winner === match.team2 ? 0x00aa00 : (match.team2 !== 'TBD' ? 0x4488cc : 0x666666));
            this.add.rectangle(600, y + 30, boxWidth, boxHeight, team2Color, 1).setStrokeStyle(1, 0xffffff);
            this.add.text(600, y + 30, this.truncateTeamName(match.team2 || 'TBD'), { fontSize: UI.TYPE.small + 'px', fill: team2Color === 0x666666 ? '#ffffff' : '#000000', fontStyle: 'bold' }).setOrigin(0.5);
        }

        // Finals - should show 2 teams (1 match)
        this.add.text(800, 126, 'FINALS', { fontSize: UI.TYPE.body + 'px', fill: '#ffcc00', fontStyle: 'bold' }).setOrigin(0.5);
        const finalMatch = this.bracket.finals || { team1: 'TBD', team2: 'TBD', winner: null };

        // Team 1
        const final1Color = finalMatch.team1 === playerTeam ? 0xffff00 : (finalMatch.winner === finalMatch.team1 ? 0x00aa00 : (finalMatch.team1 !== 'TBD' ? 0x4488cc : 0x666666));
        this.add.rectangle(800, startY + 210, boxWidth, boxHeight, final1Color, 1).setStrokeStyle(1, 0xffffff);
        this.add.text(800, startY + 210, this.truncateTeamName(finalMatch.team1 || 'TBD'), { fontSize: UI.TYPE.small + 'px', fill: final1Color === 0x666666 ? '#ffffff' : '#000000', fontStyle: 'bold' }).setOrigin(0.5);

        // Team 2
        const final2Color = finalMatch.team2 === playerTeam ? 0xffff00 : (finalMatch.winner === finalMatch.team2 ? 0x00aa00 : (finalMatch.team2 !== 'TBD' ? 0x4488cc : 0x666666));
        this.add.rectangle(800, startY + 240, boxWidth, boxHeight, final2Color, 1).setStrokeStyle(1, 0xffffff);
        this.add.text(800, startY + 240, this.truncateTeamName(finalMatch.team2 || 'TBD'), { fontSize: UI.TYPE.small + 'px', fill: final2Color === 0x666666 ? '#ffffff' : '#000000', fontStyle: 'bold' }).setOrigin(0.5);

        // Winner
        this.add.text(1000, 126, 'WINNER', { fontSize: UI.TYPE.body + 'px', fill: '#ffcc00', fontStyle: 'bold' }).setOrigin(0.5);
        const noWinnerYet = !finalMatch.winner;
        const winnerColor = finalMatch.winner === playerTeam ? 0xffff00 : (noWinnerYet ? 0xffcc00 : 0x00aa00);
        this.add.rectangle(1000, startY + 210, boxWidth, boxHeight, winnerColor, 1).setStrokeStyle(2, 0xffffff);

        if (noWinnerYet) {
            // No champion decided yet - show the trophy icon, or "TBD" as a fallback
            if (this.textures.exists('trophy-icon')) {
                // 0.18 keeps the 128px icon at 23px, inside the 26px box.
                this.add.image(1000, startY + 210, 'trophy-icon').setScale(0.18);
            } else {
                this.add.text(1000, startY + 210, 'TBD', { fontSize: '20px', fill: '#000000', fontStyle: 'bold' }).setOrigin(0.5);
            }
        } else {
            this.add.text(1000, startY + 210, this.truncateTeamName(finalMatch.winner), { fontSize: UI.TYPE.small + 'px', fill: '#000000', fontStyle: 'bold' }).setOrigin(0.5);
        }
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
                                fontSize: UI.TYPE.micro + 'px',
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

    /** Width of a bracket box, so the player's accent bar can be aligned to it. */
    boxW() { return 160; }

    /* Marks which box is the player's own.
     *
     * The player's row was the only gold box in a column of identical blue ones,
     * and it carried no label - so with a short team name it read as a rendering
     * fault rather than as "this is you". Now it gets a white left accent bar and
     * a YOUR TEAM caption above the column. */
    drawPlayerMarker(x, y, boxH) {
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 0.92);
        g.fillRoundedRect(x - this.boxW() / 2 - 8, y - boxH / 2 + 2, 4, boxH - 4, 2);
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