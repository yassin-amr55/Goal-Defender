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

        // BACK button at (640, 650)
        const backBg = this.add.rectangle(640, 650, 200, 60, 0x666666, 1);
        backBg.setStrokeStyle(3, 0x999999);
        backBg.setInteractive();

        const backText = this.add.text(640, 650, 'BACK', {
            fontSize: '32px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        backBg.on('pointerover', () => {
            backBg.setScale(1.05);
            backBg.setFillStyle(0x888888);
        });

        backBg.on('pointerout', () => {
            backBg.setScale(1);
            backBg.setFillStyle(0x666666);
        });

        backBg.on('pointerdown', () => {
            this.scene.start('TournamentMenuScene');
        });

        // Mute button
        this.createMuteButton();
    }

    createTrophyDisplay(x, label, trophyImageKey, winCount, dateWon, isChampions = false) {
        // Shelf display (rectangle at y=400)
        const shelf = this.add.rectangle(x, 400, 300, 20, 0x8b7355, 1);
        shelf.setStrokeStyle(2, 0x5c4a33);

        // Trophy image at y=320 (above shelf)
        const isWon = winCount > 0;
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
        } else {
            // Fallback: use emoji
            const trophyEmoji = this.add.text(x, 280, '🏆', {
                fontSize: isWon ? '60px' : '40px',
                alpha: isWon ? 1 : 0.3
            }).setOrigin(0.5);
            
            if (!isWon) {
                trophyEmoji.setTint(0x888888);
            }
        }

        // Label below shelf: "QUALIFIERS CUP" or "CHAMPIONS CUP"
        const labelText = this.add.text(x, 440, label, {
            fontSize: '24px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Win count
        const countText = this.add.text(x, 465, `Won: ${winCount}`, {
            fontSize: '20px',
            fill: '#ffcc00',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Date won (if won)
        if (isWon && dateWon) {
            const dateText = this.add.text(x, 495, `Last: ${dateWon}`, {
                fontSize: '14px',
                fill: '#cccccc'
            }).setOrigin(0.5);

            // Stats below
            const statsData = JSON.parse(localStorage.getItem(
                isChampions ? 'tournamentChampionsStats' : 'tournamentQualifiersStats'
            ) || '{}');

            if (statsData.deflects !== undefined) {
                const statsText = this.add.text(x, 530, `Last Match:\nDeflects: ${statsData.deflects}\nMoney: $${statsData.money}`, {
                    fontSize: '12px',
                    fill: '#ffffff',
                    align: 'center'
                }).setOrigin(0.5);
            }
        }
    }

    createSparkles(x, y) {
        // Create sparkle particles for Champions trophy
        const particles = this.add.particles(0xffff00);
        const emitter = particles.createEmitter({
            x: x,
            y: y,
            speed: { min: -100, max: 100 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.5, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 1000,
            gravityY: -300,
            emitZone: { type: 'circle', source: new Phaser.Geom.Circle(0, 0, 10) }
        });

        emitter.explode(20);

        // Repeat every 5 seconds
        this.time.addEvent({
            delay: 5000,
            callback: () => {
                emitter.explode(10);
            },
            loop: true
        });
    }

    createMuteButton() {
        const x = 1230;
        const y = 30;
        
        const muteButton = this.add.image(x, y, isMuted ? 'volume-mute' : 'volume-unmute');
        muteButton.setScale(0.08);
        muteButton.setInteractive();

        muteButton.on('pointerover', () => {
            muteButton.setScale(0.1);
        });

        muteButton.on('pointerout', () => {
            muteButton.setScale(0.08);
        });

        muteButton.on('pointerdown', () => {
            isMuted = !isMuted;
            localStorage.setItem('goalDefenderMuted', isMuted);
            muteButton.setTexture(isMuted ? 'volume-mute' : 'volume-unmute');
        });
    }
}
