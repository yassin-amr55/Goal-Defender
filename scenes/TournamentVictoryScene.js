/* Paid every time a cup is won, on top of the per-match earnings.
 * Keyed by tournament mode so a single table drives both cups.
 * DO NOT reduce these without rebalancing ball prices against them - the
 * whole point of the prize is that Champions is worth chasing. */
const GD_TROPHY_PRIZE = { qualifiers: 500, champions: 10000 };

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
            this.add.text(640, 440, `Match Earnings: $${this.stats.moneyEarned || 0}`, { fontSize: '22px', fill: '#fff' }).setOrigin(0.5);

            // Trophy prize is separate from match earnings, so it gets its own
            // line. Label it as "+" because awardTrophy() pays it out shortly
            // after this screen appears.
            const prize = GD_TROPHY_PRIZE[this.mode] || 0;
            if (prize > 0) {
                this.add.text(640, 484, `Trophy Prize: +$${prize.toLocaleString('en-US')}`, {
                    fontSize: '26px', fill: '#ffd700', fontStyle: '900'
                }).setOrigin(0.5);
            }

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
        UI.button(this, {
            x: 640, y: 580, w: 300, h: 70,
            label: 'BACK TO MENU',
            textSize: 24,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a,
            onClick: () => this.scene.start('TournamentMenuScene')
        });
    }

    awardTrophy() {
        // Only award trophy if victory
        if (this.result === 'victory') {
            // Trophy prize: paid on every win, unlike the achievements which
            // are first-win-only. Guarded by result === 'victory' above so a
            // defeat can never pay out.
            const prize = GD_TROPHY_PRIZE[this.mode] || 0;
            if (prize > 0) {
                const balance = parseInt(localStorage.getItem('goalDefenderMoney') || '0');
                localStorage.setItem('goalDefenderMoney', String(balance + prize));
            }

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

            // Count the win for the achievement system
            if (window.Achievements) {
                window.Achievements.addTournamentWin(this.mode);
                window.Achievements.check(this);
            }
        }

        // mark tournament inactive
        localStorage.setItem('tournamentActive', 'false');
    }
}
