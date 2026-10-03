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
        /* This screen was a flat black void while every other screen in the game
         * was a stadium. It is the screen a player sees after the most
         * emotionally loaded moment in the tournament - winning or losing a cup -
         * and it looked like a debug screen. */
        UI.stadium(this, {
            alpha: 0.5, groundAlpha: 0.3, grassAlpha: 0.2,
            dim: this.result === 'victory' ? 0.4 : 0.55
        });

        const teamName = localStorage.getItem('tournamentTeamName') || 'Your Team';

        /* Panel behind the result, so the copy sits on a surface instead of
         * straight on the stadium art. */
        UI.panel(this, {
            x: 640, y: 372, w: 720, h: 300, radius: 24,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: this.result === 'victory' ? 0xf0b429 : 0x7a3b3b,
            borderWidth: 2
        });

        if (this.result === 'victory') {
            const trophyKey = this.mode === 'qualifiers' ? 'qualifiers-trophy' : 'champions-trophy';
            if (this.textures.exists(trophyKey)) {
                this.add.image(640, 262, trophyKey).setScale(0.28).setDepth(2);
            }

            const tournamentName = this.mode === 'qualifiers' ? 'QUALIFIERS CUP' : 'CHAMPIONS CUP';

            /* Was plain gold with no stroke and no shadow, so it did not read as
             * a title at all - it read as a label. Now it uses the same
             * two-layer treatment as every other screen. */
            UI.title(this, {
                text: tournamentName + ' WON!', x: 640, y: 92,
                size: UI.TYPE.title + 6, fill: '#ffd700'
            });

            this.teamNamePlate(640, 150, teamName);

            this.add.text(640, 306, 'Matches Won: ' + (this.stats.matchesWon || 0), { fontSize: UI.TYPE.body + 'px', fill: '#fff' }).setOrigin(0.5);
            this.add.text(640, 342, 'Total Deflections: ' + (this.stats.totalDeflects || 0), { fontSize: UI.TYPE.body + 'px', fill: '#fff' }).setOrigin(0.5);
            this.add.text(640, 378, 'Match Earnings: $' + Achievements.fmt(this.stats.moneyEarned || 0), { fontSize: UI.TYPE.body + 'px', fill: '#fff' }).setOrigin(0.5);

            /* Trophy prize is separate from match earnings, so it gets its own
             * line. Label it as "+" because awardTrophy() pays it out shortly
             * after this screen appears. */
            const prize = GD_TROPHY_PRIZE[this.mode] || 0;
            if (prize > 0) {
                this.add.text(640, 428, 'Trophy Prize: +$' + prize.toLocaleString('en-US'), {
                    fontSize: UI.TYPE.lead + 'px', fill: '#ffd700', fontStyle: '900'
                }).setOrigin(0.5);
            }

            this.time.delayedCall(1200, () => this.awardTrophy(), [], this);

            if (this.textures.exists('ball_default')) {
                this.add.particles(0, 0, 'ball_default', {
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
            /* Was plain red with neither stroke nor shadow - the only title in
             * the game that did not use the shared treatment, which made the
             * result screen look like it belonged to a different product. */
            UI.title(this, {
                text: 'TOURNAMENT LOST', x: 640, y: 92,
                size: UI.TYPE.title + 6, fill: '#ff8080', stroke: '#5c1414'
            });

            this.teamNamePlate(640, 150, teamName);

            const currentRound = localStorage.getItem('tournamentRound') || 'roundOf16';
            let roundName = currentRound;
            if (roundName === 'roundOf16') roundName = 'Round of 16';
            else if (roundName === 'roundOf32') roundName = 'Round of 32';
            else if (roundName === 'quarterFinals') roundName = 'Quarter Finals';
            else if (roundName === 'semiFinals') roundName = 'Semi Finals';
            else if (roundName === 'finals') roundName = 'Finals';

            this.add.text(640, 286, 'Eliminated in: ' + roundName, { fontSize: UI.TYPE.body + 'px', fill: '#ffaa00' }).setOrigin(0.5);
            this.add.text(640, 330, 'Matches Won: ' + (this.stats.matchesWon || 0), { fontSize: UI.TYPE.body + 'px', fill: '#fff' }).setOrigin(0.5);
            this.add.text(640, 366, 'Total Deflections: ' + (this.stats.totalDeflects || 0), { fontSize: UI.TYPE.body + 'px', fill: '#fff' }).setOrigin(0.5);
            this.add.text(640, 410, 'Money Earned: $' + Achievements.fmt(this.stats.moneyEarned || 0), { fontSize: UI.TYPE.lead + 'px', fill: '#ffd700', fontStyle: '900' }).setOrigin(0.5);

            /* Losing pays no trophy prize - say so, so an empty gap under
             * "Money Earned" does not read as a bug. */
            this.add.text(640, 456, 'No trophy prize this time', {
                fontSize: UI.TYPE.small + 'px', fill: '#8fa6bd', fontStyle: '700'
            }).setOrigin(0.5);
        }

        UI.button(this, {
            x: 640, y: 596, w: 300, h: 70,
            label: 'BACK TO MENU',
            textSize: UI.TYPE.lead,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a,
            onClick: () => this.scene.start('TournamentMenuScene')
        });

        UI.topRight(this, {});
    }

    /* The team name was a bare string in a large font with nothing around it, so
     * a short name read as a stray character floating under the title. A label
     * above it makes it obviously the player's team, and a single-character name
     * looks deliberate rather than broken. */
    teamNamePlate(cx, topY, name) {
        this.add.text(cx, topY, 'YOUR TEAM', {
            fontSize: '13px', color: '#8fa6bd', fontStyle: '800'
        }).setOrigin(0.5);
        this.add.text(cx, topY + 30, name, {
            fontSize: UI.TYPE.lead + 'px', color: '#ffffff', fontStyle: '800'
        }).setOrigin(0.5);
    }

    awardTrophy() {
        /* Win streak, for "The Real Hat Trick" (3 cups back to back).
         *
         * A win extends the streak; anything else clears it. Cleared here on a
         * defeat rather than at the start of a tournament, because the moment
         * that matters is the loss - if the player quits out of a tournament the
         * streak also has to go, or it survives across abandoned runs and the
         * achievement becomes three wins across three months.
         *
         * A plain lifetime counter cannot express this, which is why the
         * existing "Hat Trick" (3 wins ever) and this one are separate. */
        const streakKey = 'goalDefenderTournamentStreak';
        if (this.result === 'victory') {
            const streak = parseInt(localStorage.getItem(streakKey) || '0', 10);
            localStorage.setItem(streakKey, String((isFinite(streak) ? streak : 0) + 1));
        } else {
            localStorage.setItem(streakKey, '0');
        }

        // Only award trophy if victory
        if (this.result === 'victory') {
            // Trophy prize: paid on every win, unlike the achievements which
            // are first-win-only. Guarded by result === 'victory' above so a
            // defeat can never pay out.
            const prize = GD_TROPHY_PRIZE[this.mode] || 0;
            if (prize > 0) {
                const balance = parseInt(localStorage.getItem('goalDefenderMoney') || '0', 10);
                localStorage.setItem('goalDefenderMoney', String(balance + prize));
            }

            if (this.mode === 'qualifiers') {
                const count = parseInt(localStorage.getItem('tournamentQualifiersWinCount') || '0', 10);
                localStorage.setItem('tournamentQualifiersWinCount', (count + 1).toString());
                localStorage.setItem('tournamentQualifiersWon', 'true');
            } else {
                const count = parseInt(localStorage.getItem('tournamentChampionsWinCount') || '0', 10);
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
