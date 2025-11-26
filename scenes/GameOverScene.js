class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    init(data) {
        // Receive score from GameScene
        this.finalScore = data.score || 0;
    }

    create() {
        const groundHeight = 100;
        const groundY = 720;
        const groundTopY = groundY - groundHeight;
        
        // Background image (sky) - positioned so bottom aligns with top of ground
        if (this.textures.exists('background')) {
            const bg = this.add.image(640, 0, 'background');
            bg.setOrigin(0.5, 0);
            bg.setDisplaySize(1280, groundTopY);
            bg.setAlpha(0.6);
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

        // PHASE 9: Add money earned (equal to score)
        const moneyEarned = this.finalScore;
        const currentMoney = parseInt(localStorage.getItem('goalDefenderMoney') || 0);
        const newTotal = currentMoney + moneyEarned;
        localStorage.setItem('goalDefenderMoney', newTotal);

        // Game Over title shadow
        this.add.text(642, 132, 'GAME OVER', {
            fontSize: '72px',
            fill: '#000000',
            fontStyle: 'bold',
            alpha: 0.5
        }).setOrigin(0.5);

        // Game Over title
        this.add.text(640, 130, 'GAME OVER', {
            fontSize: '72px',
            fill: '#ff0000',
            fontStyle: 'bold',
            stroke: '#660000',
            strokeThickness: 8,
            shadow: {
                offsetX: 3,
                offsetY: 3,
                color: '#000000',
                blur: 5,
                fill: true
            }
        }).setOrigin(0.5);

        // Stats container
        const statsBg = this.add.rectangle(640, 290, 500, 180, 0x000000, 0.7);
        statsBg.setStrokeStyle(4, 0xffffff);

        // Show final score
        this.add.text(640, 230, 'SCORE: ' + this.finalScore, {
            fontSize: '52px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#000000',
                blur: 3,
                fill: true
            }
        }).setOrigin(0.5);

        // PHASE 9: Show money earned
        this.add.text(640, 300, 'Money Earned: $' + moneyEarned, {
            fontSize: '38px',
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

        // Show total money
        this.add.text(640, 350, 'Total Money: $' + newTotal, {
            fontSize: '34px',
            fill: '#00ff00',
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

        // Play Again button background
        const playAgainBg = this.add.rectangle(640, 450, 280, 70, 0x00aa00, 1);
        playAgainBg.setStrokeStyle(4, 0x00ff00);
        playAgainBg.setInteractive();

        // Play Again button text
        const playAgainButton = this.add.text(640, 450, 'PLAY AGAIN', {
            fontSize: '42px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#003300',
            strokeThickness: 5,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#000000',
                blur: 4,
                fill: true
            }
        }).setOrigin(0.5);

        playAgainBg.on('pointerover', () => {
            playAgainBg.setScale(1.05);
            playAgainButton.setScale(1.05);
            playAgainBg.setFillStyle(0x00ff00);
        });

        playAgainBg.on('pointerout', () => {
            playAgainBg.setScale(1);
            playAgainButton.setScale(1);
            playAgainBg.setFillStyle(0x00aa00);
        });

        playAgainBg.on('pointerdown', () => {
            this.scene.start('GameScene');
        });

        // Home button background
        const homeBg = this.add.rectangle(640, 540, 280, 70, 0xcc6600, 1);
        homeBg.setStrokeStyle(4, 0xffaa00);
        homeBg.setInteractive();

        // Home button text
        const homeButton = this.add.text(640, 540, 'HOME', {
            fontSize: '42px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#663300',
            strokeThickness: 5,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#000000',
                blur: 4,
                fill: true
            }
        }).setOrigin(0.5);

        homeBg.on('pointerover', () => {
            homeBg.setScale(1.05);
            homeButton.setScale(1.05);
            homeBg.setFillStyle(0xffaa00);
        });

        homeBg.on('pointerout', () => {
            homeBg.setScale(1);
            homeButton.setScale(1);
            homeBg.setFillStyle(0xcc6600);
        });

        homeBg.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });

        // Mute/Unmute button
        this.createMuteButton();

        console.log('GameOverScene loaded with score:', this.finalScore);
    }

    createMuteButton() {
        const x = 1230;
        const y = 30;
        
        // Create container for the icon
        this.muteButton = this.add.container(x, y);
        
        // Draw the speaker icon
        this.drawMuteIcon();
        
        // Make it interactive
        const hitArea = new Phaser.Geom.Circle(0, 0, 25);
        this.muteButton.setInteractive(hitArea, Phaser.Geom.Circle.Contains);

        this.muteButton.on('pointerover', () => {
            this.muteButton.setScale(1.2);
        });

        this.muteButton.on('pointerout', () => {
            this.muteButton.setScale(1);
        });

        this.muteButton.on('pointerdown', () => {
            isMuted = !isMuted;
            localStorage.setItem('goalDefenderMuted', isMuted);
            this.drawMuteIcon();
        });
    }
    
    drawMuteIcon() {
        // Clear previous graphics
        this.muteButton.removeAll(true);
        
        const graphics = this.add.graphics();
        graphics.fillStyle(0xffffff, 1);
        
        // Speaker body
        graphics.fillRect(-15, -8, 10, 16);
        graphics.fillTriangle(-5, -8, -5, 8, 5, 15, 5, -15);
        
        if (!isMuted) {
            // Sound waves
            graphics.lineStyle(3, 0xffffff, 1);
            graphics.arc(5, 0, 10, -Math.PI/4, Math.PI/4, false);
            graphics.strokePath();
            graphics.arc(5, 0, 16, -Math.PI/4, Math.PI/4, false);
            graphics.strokePath();
        } else {
            // Mute X
            graphics.lineStyle(3, 0xff0000, 1);
            graphics.lineBetween(8, -10, 18, 0);
            graphics.lineBetween(18, 0, 8, 10);
            graphics.strokePath();
        }
        
        this.muteButton.add(graphics);
    }
}
