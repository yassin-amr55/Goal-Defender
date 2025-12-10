class TournamentVictoryScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TournamentVictoryScene' });
    }

    init(data) {
        this.mode = data.mode || localStorage.getItem('tournamentMode') || 'qualifiers';
        this.round = data.round || localStorage.getItem('tournamentRound') || 'finals';
        this.stats = data.stats || JSON.parse(localStorage.getItem('tournamentProgress') || '{}');
        this.result = data.result || 'victory'; // 'victory' or 'defeat'
    }

    create() {
        this.cameras.main.setBackgroundColor('#0a0a0a');

        const teamName = localStorage.getItem('tournamentTeamName') || 'Your Team';
        
        if (this.result === 'victory') {
            // Victory display
            // Trophy image
            const trophyKey = this.mode === 'qualifiers' ? 'qualifiers-trophy' : 'champions-trophy';
            if (this.textures.exists(trophyKey)) {
                const trophy = this.add.image(640, 240, trophyKey).setScale(0.35);
                trophy.setDepth(2);
            }

            const tournamentName = this.mode === 'qualifiers' ? 'QUALIFIERS CUP' : 'CHAMPIONS CUP';
            this.add.text(640, 80, `${tournamentName} WON!`, { fontSize: '44px', fill: '#ffd700' }).setOrigin(0.5);
            this.add.text(640, 140, teamName, { fontSize: '26px', fill: '#ffffff' }).setOrigin(0.5);

            this.add.text(640, 360, `Matches Won: ${this.stats.matchesWon || 0}`, { fontSize: '22px', fill: '#fff' }).setOrigin(0.5);
            this.add.text(640, 400, `Total Deflects: ${this.stats.totalDeflects || 0}`, { fontSize: '22px', fill: '#fff' }).setOrigin(0.5);
            this.add.text(640, 440, `Money Earned: ${this.stats.moneyEarned || 0}`, { fontSize: '22px', fill: '#fff' }).setOrigin(0.5);

            // Award trophy count and save
            this.time.delayedCall(1200, () => this.awardTrophy(), [], this);

            // Confetti / fireworks particles
            if (this.textures.exists('ball_default')) {
                const particles = this.add.particles(0, 0, 'ball_default', {
                    x: { min: 100, max: 1180 },
                    y: 0,
                    lifespan: 2000,
                    speedY: { min: 200, max: 400 },
                    speedX: { min: -200, max: 200 },
                    scale: { start: 0.1, end: 0.05 },
                    quantity: 6,
                    tint: [0xffd700, 0xffa500, 0xffff66],
                    gravityY: 300
                });
            }
        } else {
            // Defeat display
            this.add.text(640, 200, 'TOURNAMENT LOST', { fontSize: '44px', fill: '#ff4444' }).setOrigin(0.5);
            this.add.text(640, 260, teamName, { fontSize: '26px', fill: '#ffffff' }).setOrigin(0.5);
            
            // Show which round they lost in
            const currentRound = localStorage.getItem('tournamentRound') || 'roundOf16';
            let roundName = currentRound;
            if (roundName === 'roundOf16') roundName = 'Round of 16';
            else if (roundName === 'roundOf32') roundName = 'Round of 32';
            else if (roundName === 'quarterFinals') roundName = 'Quarter Finals';
            else if (roundName === 'semiFinals') roundName = 'Semi Finals';
            else if (roundName === 'finals') roundName = 'Finals';
            
            this.add.text(640, 320, `Eliminated in: ${roundName}`, { fontSize: '24px', fill: '#ffaa00' }).setOrigin(0.5);
            this.add.text(640, 380, `Total Deflects: ${this.stats.totalDeflects || 0}`, { fontSize: '22px', fill: '#fff' }).setOrigin(0.5);
        }

        // Continue button
        const cont = this.add.rectangle(640, 560, 320, 64, 0x228B22).setInteractive();
        this.add.text(640, 560, 'BACK TO MENU', { fontSize: '24px', fill: '#fff' }).setOrigin(0.5);
        cont.on('pointerdown', () => {
            this.scene.start('TournamentMenuScene');
        });
    }

    awardTrophy() {
        // Only award trophy if victory
        if (this.result === 'victory') {
            if (this.mode === 'qualifiers') {
                const count = parseInt(localStorage.getItem('tournamentQualifiersWinCount') || '0');
                localStorage.setItem('tournamentQualifiersWinCount', (count + 1).toString());
                localStorage.setItem('tournamentQualifiersWon', 'true');
            } else {
                const count = parseInt(localStorage.getItem('tournamentChampionsWinCount') || '0');
                localStorage.setItem('tournamentChampionsWinCount', (count + 1).toString());
                localStorage.setItem('tournamentChampionsWon', 'true');
            }

            // save last win stats
            const key = (this.mode === 'qualifiers') ? 'tournamentQualifiersStats' : 'tournamentChampionsStats';
            const stats = {
                date: new Date().toISOString(),
                matchesWon: this.stats.matchesWon || 0,
                totalDeflects: this.stats.totalDeflects || 0,
                moneyEarned: this.stats.moneyEarned || 0
            };
            localStorage.setItem(key, JSON.stringify(stats));
        }

        // mark tournament inactive
        localStorage.setItem('tournamentActive', 'false');
    }
}
