class TrophyRoomScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TrophyRoomScene' });
    }

    create() {

        UI.stadium(this, { alpha: 0.4, groundAlpha: 0.3, grassAlpha: 0.2, dim: 0.4 });

        // Get trophy data from localStorage
        const qualifiersWinCount = parseInt(localStorage.getItem('tournamentQualifiersWinCount') || '0', 10);
        const championsWinCount = parseInt(localStorage.getItem('tournamentChampionsWinCount') || '0', 10);
        const totalTrophies = qualifiersWinCount + championsWinCount;

        const title = UI.title(this, {
            text: 'TROPHIES: ' + totalTrophies, x: 640, y: 66,
            size: UI.TYPE.hero - 6, fill: '#ffcc00',
            stroke: '#000000', thickness: 5, offset: 2
        });

        // Glow/pulse effect
        this.tweens.add({
            targets: title,
            scale: { from: 1, to: 1.05 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Display trophies
        // Qualifiers Trophy (Left Shelf)
        this.createTrophyDisplay(
            400,
            'Qualifiers Cup',
            'qualifiers-trophy',
            qualifiersWinCount,
            localStorage.getItem('tournamentQualifiersDate')
        );

        // Champions Trophy (Right Shelf)
        this.createTrophyDisplay(
            880,
            'Champions Cup',
            'champions-trophy',
            championsWinCount,
            localStorage.getItem('tournamentChampionsDate'),
            true
        );

        /* M2: shared red X instead of a bottom-centre BACK. */
        UI.closeButton(this, {
            x: 1240, y: 40, r: 22,
            onClick: () => this.scene.start('TournamentMenuScene')
        });

        UI.button(this, {
            x: 640, y: 656, w: 220, h: 64,
            label: 'BACK',
            textSize: UI.TYPE.lead,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59,
            radius: 16,
            onClick: () => this.scene.start('TournamentMenuScene')
        });

        // Mute button
        UI.topRight(this, {});
    }

    createTrophyDisplay(x, label, trophyImageKey, winCount, dateWon, isChampions = false) {
        // isWon must be resolved before it is used below
        const isWon = winCount > 0;

        /* The card is now 380 tall and spans 170..550, and every element
         * below is positioned inside it.
         *
         * It used to be 300 tall spanning 190..490, while the trophy art was
         * centred at 280 scaled 0.4 - about 205px tall, so it reached 177..382
         * and poked 13px out through the top. The "Won: N" line sat at 512, which
         * is 22px BELOW the card's bottom edge, so it looked like the text had
         * fallen out of the box. Nothing was clipped, it was simply laid out
         * without reference to the panel it belonged to. */
        const CARD_TOP = 170;
        const CARD_BOTTOM = 550;

        UI.panel(this, {
            x: x, y: (CARD_TOP + CARD_BOTTOM) / 2, w: 380, h: CARD_BOTTOM - CARD_TOP,
            radius: 20,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: isWon ? 0xf0b429 : 0x3d5a73,
            borderWidth: 2
        });

        /* M5: the shelf was a flat tan rectangle with a hard border, which read
         * as an unresolved loading placeholder rather than a plinth. Shaded top
         * face, darker front edge, and narrower than the card so it sits inside
         * the panel instead of bleeding past its sides. */
        const shelfY = 392;
        const shelf = this.add.graphics();
        shelf.fillStyle(0x000000, 0.25);
        shelf.fillRoundedRect(x - 130, shelfY - 6, 260, 26, 6);
        shelf.fillStyle(0x8b7355, 1);
        shelf.fillRoundedRect(x - 130, shelfY - 10, 260, 18, 5);
        shelf.fillStyle(0xb59a76, 1);
        shelf.fillRoundedRect(x - 128, shelfY - 9, 256, 7, 4);
        shelf.fillStyle(0x5c4a33, 1);
        shelf.fillRect(x - 130, shelfY + 8, 260, 5);

        // Trophy image at y=320 (above shelf)
        let trophyImage = null;
        if (this.textures.exists(trophyImageKey)) {
            trophyImage = this.add.image(x, 286, trophyImageKey);
            trophyImage.setScale(0.3);

            if (!isWon) {
                // Grayscale filter for unwon trophies
                trophyImage.setTint(0x888888);
                trophyImage.setAlpha(0.3);
            } else {
                // Glow effect for won trophies
                trophyImage.setAlpha(1);
                if (isChampions) {
                    // Sparkle particles for Champions trophy
                    this.createSparkles(x, 286);
                }
            }
        } else if (this.textures.exists('trophy-icon')) {
            // Fallback: vector trophy icon
            const trophyIcon = this.add.image(x, 286, 'trophy-icon');
            trophyIcon.setScale(isWon ? 0.55 : 0.45);
            trophyIcon.setAlpha(isWon ? 1 : 0.3);

            if (!isWon) {
                trophyIcon.setTint(0x888888);
            }
        }

        // Label below shelf: "QUALIFIERS CUP" or "CHAMPIONS CUP"
        const labelText = this.add.text(x, 432, label, {
            fontSize: UI.TYPE.lead + 'px',
            color: '#ffffff',
            fontStyle: '800'
        }).setOrigin(0.5);

        // Win count
        const countText = this.add.text(x, 468, `Won: ${winCount}`, {
            fontSize: UI.TYPE.body + 'px',
            color: isWon ? '#ffd45e' : '#7f8c99',
            fontStyle: '800'
        }).setOrigin(0.5);

        // Date won (if won)
        if (isWon && dateWon) {
            const dateText = this.add.text(x, 500, `Last: ${dateWon}`, {
                fontSize: UI.TYPE.micro + 'px',
                color: '#93a8bd'
            }).setOrigin(0.5);

            // Stats below
            const statsData = JSON.parse(localStorage.getItem(
                isChampions ? 'tournamentChampionsStats' : 'tournamentQualifiersStats'
            ) || '{}');

            // awardTrophy() writes { date, matchesWon, totalDeflects, moneyEarned }
            if (statsData.totalDeflects !== undefined) {
                const statsText = this.add.text(x, 528, `Deflections: ${statsData.totalDeflects}\nMoney: $${statsData.moneyEarned || 0}`, {
                    fontSize: UI.TYPE.micro + 'px',
                    color: '#93a8bd',
                    fontStyle: '600',
                    align: 'center'
                }).setOrigin(0.5);
            }
        }
    }

    createSparkles(x, y) {
        // Create sparkle particles for Champions trophy.
        // Phaser 3.60+ takes the emitter config directly; the old
        // add.particles(x).createEmitter() API no longer exists.
        const emitter = this.add.particles(x, y, 'ball_default', {
            speed: { min: -100, max: 100 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.2, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 1000,
            gravityY: -300,
            tint: 0xffff00,
            quantity: 1,
            frequency: 250
        });

        // Repeat every 5 seconds
        this.time.addEvent({
            delay: 5000,
            callback: () => {
                if (emitter && emitter.emitParticleAt) emitter.emitParticleAt(x, y);
            },
            loop: true
        });
    }

    createMuteButton() {
        UI.topRight(this, {});
    }
}
