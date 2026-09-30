class TrophyRoomScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TrophyRoomScene' });
    }

    create() {
        console.log('TrophyRoomScene created');
        
        const groundHeight = 100;
        const groundY = 720;
        const groundTopY = groundY - groundHeight;
        
        // Dark background (stadium with dark overlay, alpha 0.9)
        if (this.textures.exists('background')) {
            const bg = this.add.image(640, 0, 'background');
            bg.setOrigin(0.5, 0);
            bg.setDisplaySize(1280, groundTopY);
            bg.setAlpha(0.4);
        } else {
            this.cameras.main.setBackgroundColor('#1a1a1a');
        }

        // Dark overlay
        const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.4);

        // Ground at bottom
        if (this.textures.exists('ground')) {
            const ground = this.add.image(640, groundY, 'ground');
            ground.setOrigin(0.5, 1);
            ground.setDisplaySize(1280, groundHeight);
            ground.setAlpha(0.3);
        }

        // Add decorative grass above ground
        if (this.textures.exists('grass')) {
            const grass = this.add.image(640, groundTopY + 3, 'grass');
            grass.setOrigin(0.5, 1);
            grass.setDisplaySize(1280, grass.height);
            grass.setAlpha(0.2);
        }

        // Get trophy data from localStorage
        const qualifiersWinCount = parseInt(localStorage.getItem('tournamentQualifiersWinCount') || '0');
        const championsWinCount = parseInt(localStorage.getItem('tournamentChampionsWinCount') || '0');
        const totalTrophies = qualifiersWinCount + championsWinCount;

        // Title: "TROPHIES: X" at (640, 60)
        this.add.text(642, 62, `TROPHIES: ${totalTrophies}`, {
            fontSize: '48px',
            fill: '#000000',
            fontStyle: 'bold',
            alpha: 0.5
        }).setOrigin(0.5);

        const title = this.add.text(640, 60, `TROPHIES: ${totalTrophies}`, {
            fontSize: '48px',
            fill: '#ffcc00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 5,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#000000',
                blur: 3,
                fill: true
            }
        }).setOrigin(0.5);

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

        // BACK button
        UI.button(this, {
            x: 640, y: 656, w: 220, h: 64,
            label: 'BACK',
            textSize: 24,
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

        // Display case + wooden shelf
        UI.panel(this, {
            x: x, y: 340, w: 360, h: 300, radius: 20,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: isWon ? 0xf0b429 : 0x3d5a73,
            borderWidth: 2
        });

        const shelf = this.add.rectangle(x, 452, 300, 18, 0x8b7355, 1);
        shelf.setStrokeStyle(2, 0x5c4a33);

        // Trophy image at y=320 (above shelf)
        let trophyImage = null;
        if (this.textures.exists(trophyImageKey)) {
            trophyImage = this.add.image(x, 280, trophyImageKey);
            trophyImage.setScale(0.4);
            
            if (!isWon) {
                // Grayscale filter for unwon trophies
                trophyImage.setTint(0x888888);
                trophyImage.setAlpha(0.3);
            } else {
                // Glow effect for won trophies
                trophyImage.setAlpha(1);
                if (isChampions) {
                    // Sparkle particles for Champions trophy
                    this.createSparkles(x, 280);
                }
            }
        } else if (this.textures.exists('trophy-icon')) {
            // Fallback: vector trophy icon
            const trophyIcon = this.add.image(x, 280, 'trophy-icon');
            trophyIcon.setScale(isWon ? 0.55 : 0.45);
            trophyIcon.setAlpha(isWon ? 1 : 0.3);

            if (!isWon) {
                trophyIcon.setTint(0x888888);
            }
        }

        // Label below shelf: "QUALIFIERS CUP" or "CHAMPIONS CUP"
        const labelText = this.add.text(x, 484, label, {
            fontSize: '22px',
            color: '#ffffff',
            fontStyle: '800'
        }).setOrigin(0.5);

        // Win count
        const countText = this.add.text(x, 512, `Won: ${winCount}`, {
            fontSize: '18px',
            color: isWon ? '#ffd45e' : '#7f8c99',
            fontStyle: '800'
        }).setOrigin(0.5);

        // Date won (if won)
        if (isWon && dateWon) {
            const dateText = this.add.text(x, 540, `Last: ${dateWon}`, {
                fontSize: '13px',
                color: '#93a8bd'
            }).setOrigin(0.5);

            // Stats below
            const statsData = JSON.parse(localStorage.getItem(
                isChampions ? 'tournamentChampionsStats' : 'tournamentQualifiersStats'
            ) || '{}');

            // awardTrophy() writes { date, matchesWon, totalDeflects, moneyEarned }
            if (statsData.totalDeflects !== undefined) {
                const statsText = this.add.text(x, 568, `Deflects: ${statsData.totalDeflects}\nMoney: $${statsData.moneyEarned || 0}`, {
                    fontSize: '12px',
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
