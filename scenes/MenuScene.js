class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        // PHASE 8: Main Menu
        
        const groundHeight = 100;
        const groundY = 720;
        const groundTopY = groundY - groundHeight;
        
        // Background image (sky) - positioned so bottom aligns with top of ground
        if (this.textures.exists('background')) {
            const bg = this.add.image(640, 0, 'background');
            bg.setOrigin(0.5, 0);
            bg.setDisplaySize(1280, groundTopY);
            bg.setAlpha(0.7);
            console.log('Background added');
        } else {
            this.cameras.main.setBackgroundColor('#87CEEB'); // Fallback
        }
        
        // Ground at bottom
        if (this.textures.exists('ground')) {
            const ground = this.add.image(640, groundY, 'ground');
            ground.setOrigin(0.5, 1);
            ground.setDisplaySize(1280, groundHeight);
            ground.setAlpha(0.5);
        }

        // Add decorative grass above ground
        if (this.textures.exists('grass')) {
            const grass = this.add.image(640, groundTopY + 3, 'grass');
            grass.setOrigin(0.5, 1);
            grass.setDisplaySize(1280, grass.height);
            grass.setAlpha(0.4); // Slightly darker than ground
        }
        
        // Title shadow
        this.add.text(642, 182, 'GOAL DEFENDER', {
            fontSize: '80px',
            fill: '#000000',
            fontStyle: 'bold',
            alpha: 0.5
        }).setOrigin(0.5);

        // Title: GOAL DEFENDER with animated glow/pulse
        const title = this.add.text(640, 180, 'GOAL DEFENDER', {
            fontSize: '80px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#ffaa00',
            strokeThickness: 6,
            shadow: {
                offsetX: 3,
                offsetY: 3,
                color: '#000000',
                blur: 5,
                fill: true
            }
        }).setOrigin(0.5);
        
        // Animated glow/pulse effect on title
        this.tweens.add({
            targets: title,
            scale: { from: 1, to: 1.05 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Get high score from localStorage
        const highScore = localStorage.getItem('goalDefenderHighScore') || 0;
        
        // High score container background
        const highScoreBg = this.add.rectangle(640, 300, 400, 70, 0x000000, 0.6);
        highScoreBg.setStrokeStyle(3, 0xffff00);
        
        // Display high score prominently
        this.add.text(640, 300, 'HIGH SCORE: ' + highScore, {
            fontSize: '40px',
            fill: '#ffff00',
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
        
        // PLAY button background (top in vertical stack)
        const playBg = this.add.rectangle(640, 420, 250, 80, 0x00aa00, 1);
        playBg.setStrokeStyle(4, 0x00ff00);
        playBg.setInteractive();
        
        // PLAY button text
        const playButton = this.add.text(640, 420, 'PLAY', {
            fontSize: '52px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#003300',
            strokeThickness: 6,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#000000',
                blur: 4,
                fill: true
            }
        }).setOrigin(0.5);
        
        playBg.on('pointerover', () => {
            playBg.setScale(1.05);
            playButton.setScale(1.05);
            playBg.setFillStyle(0x00ff00);
        });
        
        playBg.on('pointerout', () => {
            playBg.setScale(1);
            playButton.setScale(1);
            playBg.setFillStyle(0x00aa00);
        });
        
        playBg.on('pointerdown', () => {
            this.scene.start('GameScene');
        });
        
        // SHOP button background (bottom in vertical stack)
        const shopBg = this.add.rectangle(640, 520, 250, 80, 0xcc6600, 1);
        shopBg.setStrokeStyle(4, 0xffaa00);
        shopBg.setInteractive();
        
        // SHOP button text
        const shopButton = this.add.text(640, 520, 'SHOP', {
            fontSize: '52px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#663300',
            strokeThickness: 6,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#000000',
                blur: 4,
                fill: true
            }
        }).setOrigin(0.5);
        
        shopBg.on('pointerover', () => {
            shopBg.setScale(1.05);
            shopButton.setScale(1.05);
            shopBg.setFillStyle(0xffaa00);
        });
        
        shopBg.on('pointerout', () => {
            shopBg.setScale(1);
            shopButton.setScale(1);
            shopBg.setFillStyle(0xcc6600);
        });
        
        shopBg.on('pointerdown', () => {
            this.scene.start('ShopScene');
        });
        
        // TOURNAMENT button - Small circular button next to PLAY/SHOP (to the right at x=820)
        const tournamentBg = this.add.circle(820, 470, 40, 0xb8860b, 1); // Dark golden background
        tournamentBg.setStrokeStyle(4, 0xffd700); // Gold border
        tournamentBg.setInteractive();
        
        // Add champions trophy image on the button
        if (this.textures.exists('champions-trophy')) {
            const trophyIcon = this.add.image(820, 470, 'champions-trophy');
            trophyIcon.setScale(0.08); // Smaller size to fit in button
            trophyIcon.setDepth(5);
        } else {
            // Fallback to emoji if image not available
            const trophyEmoji = this.add.text(820, 470, '🏆', {
                fontSize: '40px'
            }).setOrigin(0.5).setDepth(5);
        }
        
        tournamentBg.on('pointerover', () => {
            tournamentBg.setScale(1.1);
            tournamentBg.setFillStyle(0xdaa520); // Brighter gold on hover
        });
        
        tournamentBg.on('pointerout', () => {
            tournamentBg.setScale(1);
            tournamentBg.setFillStyle(0xb8860b); // Dark golden
        });
        
        tournamentBg.on('pointerdown', () => {
            this.scene.start('TournamentMenuScene');
        });
        
        // Add bouncing floating ball animation using equipped ball
        const equippedBall = localStorage.getItem('goalDefenderEquippedBall') || 'default';
        const ballTexture = this.getBallTexture(equippedBall);
        
        if (this.textures.exists(ballTexture)) {
            this.floatingBall = this.add.image(200, 400, ballTexture);
            this.floatingBall.setScale(0.3); // Adjusted for 512x512 image
            
            // Bouncing animation
            this.tweens.add({
                targets: this.floatingBall,
                y: { from: 350, to: 450 },
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // Floating left-right animation
            this.tweens.add({
                targets: this.floatingBall,
                x: { from: 150, to: 250 },
                duration: 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // Rotation animation
            this.tweens.add({
                targets: this.floatingBall,
                angle: 360,
                duration: 3000,
                repeat: -1,
                ease: 'Linear'
            });
        }
        
        // Mute/Unmute button
        this.createMuteButton();

        console.log('MenuScene loaded - Phase 8 complete');
    }

    getBallTexture(ballId) {
        const textureMap = {
            'default': 'ball_default',
            'golden': 'ball_golden',
            'fire': 'ball_fire',
            'steel': 'ball_steel',
            'ghost': 'ball_ghost',
            'spark': 'ball_spark'
        };
        return textureMap[ballId] || 'ball_default';
    }

    createMuteButton() {
        const x = 1230;
        const y = 30;
        
        // Create the mute button sprite
        this.muteButton = this.add.image(x, y, isMuted ? 'volume-mute' : 'volume-unmute');
        this.muteButton.setScale(0.08);
        this.muteButton.setInteractive();

        this.muteButton.on('pointerover', () => {
            this.muteButton.setScale(0.1);
        });

        this.muteButton.on('pointerout', () => {
            this.muteButton.setScale(0.08);
        });

        this.muteButton.on('pointerdown', () => {
            isMuted = !isMuted;
            localStorage.setItem('goalDefenderMuted', isMuted);
            this.muteButton.setTexture(isMuted ? 'volume-mute' : 'volume-unmute');
        });
    }
}
