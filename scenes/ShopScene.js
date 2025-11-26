class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });
    }

    create() {
        // PHASE 9: Shop System
        
        const groundHeight = 100;
        const groundY = 720;
        const groundTopY = groundY - groundHeight;
        
        // Background image (sky) - positioned so bottom aligns with top of ground
        if (this.textures.exists('background')) {
            const bg = this.add.image(640, 0, 'background');
            bg.setOrigin(0.5, 0);
            bg.setDisplaySize(1280, groundTopY);
            bg.setAlpha(0.7);
        } else {
            this.cameras.main.setBackgroundColor('#87CEEB'); // Fallback
        }

        // Title shadow
        this.add.text(642, 42, 'SHOP', {
            fontSize: '64px',
            fill: '#000000',
            fontStyle: 'bold',
            alpha: 0.5
        }).setOrigin(0.5);

        // Title
        this.add.text(640, 40, 'SHOP', {
            fontSize: '64px',
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

        // Get player money
        this.playerMoney = parseInt(localStorage.getItem('goalDefenderMoney') || 0);
        
        // Money container background
        const moneyBg = this.add.rectangle(640, 110, 350, 60, 0x000000, 0.7);
        moneyBg.setStrokeStyle(3, 0xffff00);
        
        // Show player money at top
        this.moneyText = this.add.text(640, 110, 'MONEY: $' + this.playerMoney, {
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

        // Mute/Unmute button
        this.createMuteButton();

        // Get owned and equipped balls from localStorage
        this.ownedBalls = JSON.parse(localStorage.getItem('goalDefenderOwnedBalls') || '["default"]');
        this.equippedBall = localStorage.getItem('goalDefenderEquippedBall') || 'default';

        // PHASE 10: Define ball data
        this.ballData = [
            { id: 'default', name: 'Default Ball', price: 0, ability: 'None', texture: 'ball_default' },
            { id: 'golden', name: 'Golden Ball', price: 50, ability: 'Hitbox shrinks 15% slower', texture: 'ball_golden' },
            { id: 'fire', name: 'Fireball', price: 100, ability: 'Ball moves 10% slower', texture: 'ball_fire' },
            { id: 'steel', name: 'Steel Ball', price: 200, ability: '+2 score per deflect', texture: 'ball_steel' },
            { id: 'ghost', name: 'Ghost Ball', price: 350, ability: 'Min hitbox 120% of ball', texture: 'ball_ghost' },
            { id: 'spark', name: 'Spark Ball', price: 500, ability: '+5% extra score', texture: 'ball_spark' }
        ];

        // Create ball grid (placeholder for Phase 10)
        this.createBallGrid();

        // Back button background
        const backBg = this.add.rectangle(100, 650, 180, 60, 0x666666, 1);
        backBg.setStrokeStyle(3, 0xaaaaaa);
        backBg.setInteractive();

        // Back button text
        const backButton = this.add.text(100, 650, '← BACK', {
            fontSize: '36px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#000000',
                blur: 3,
                fill: true
            }
        }).setOrigin(0.5);

        backBg.on('pointerover', () => {
            backBg.setScale(1.05);
            backButton.setScale(1.05);
            backBg.setFillStyle(0x888888);
        });

        backBg.on('pointerout', () => {
            backBg.setScale(1);
            backButton.setScale(1);
            backBg.setFillStyle(0x666666);
        });

        backBg.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });

        console.log('ShopScene loaded - Phase 9');
    }

    createBallGrid() {
        // PHASE 10: Create grid of balls (3 per row)
        const startX = 280;
        const startY = 220;
        const spacingX = 320;
        const spacingY = 220;

        this.ballData.forEach((ball, index) => {
            const x = startX + (index % 3) * spacingX;
            const y = startY + Math.floor(index / 3) * spacingY;

            this.createBallCard(ball, x, y);
        });
    }

    createMuteButton() {
        this.muteText = this.add.text(1230, 30, isMuted ? '🔇' : '🔊', {
            fontSize: '48px'
        }).setOrigin(0.5);
        this.muteText.setInteractive();

        this.muteText.on('pointerover', () => {
            this.muteText.setScale(1.2);
        });

        this.muteText.on('pointerout', () => {
            this.muteText.setScale(1);
        });

        this.muteText.on('pointerdown', () => {
            isMuted = !isMuted;
            localStorage.setItem('goalDefenderMuted', isMuted);
            this.muteText.setText(isMuted ? '🔇' : '🔊');
        });
    }

    createBallCard(ball, x, y) {
        // Card background with gradient effect
        const card = this.add.rectangle(x, y, 280, 200, 0x222222, 0.9);
        card.setStrokeStyle(4, 0x666666);

        // Ball icon - use specific texture for each ball
        if (this.textures.exists(ball.texture)) {
            const icon = this.add.image(x, y - 50, ball.texture);
            icon.setScale(0.2); // Adjusted for 512x512 image
        }

        // Ball name
        this.add.text(x, y + 10, ball.name, {
            fontSize: '20px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Ability description
        this.add.text(x, y + 35, ball.ability, {
            fontSize: '14px',
            fill: '#aaaaaa',
            fontStyle: 'italic',
            wordWrap: { width: 260 }
        }).setOrigin(0.5);

        // Price
        this.add.text(x, y + 60, '$' + ball.price, {
            fontSize: '22px',
            fill: '#ffff00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Check if owned
        const isOwned = this.ownedBalls.includes(ball.id);
        const isEquipped = this.equippedBall === ball.id;

        // Button
        let buttonText = 'BUY';
        let buttonColor = '#00ff00';
        
        if (isEquipped) {
            buttonText = 'EQUIPPED';
            buttonColor = '#888888';
        } else if (isOwned) {
            buttonText = 'EQUIP';
            buttonColor = '#00aaff';
        }

        const buttonBg = this.add.rectangle(x, y + 88, 160, 40, buttonColor === '#888888' ? 0x444444 : (buttonColor === '#00aaff' ? 0x0088cc : 0x00aa00), 1);
        buttonBg.setStrokeStyle(2, buttonColor === '#888888' ? 0x666666 : 0xffffff);
        if (!isEquipped) buttonBg.setInteractive();

        const button = this.add.text(x, y + 88, buttonText, {
            fontSize: '18px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        if (!isEquipped) {
            buttonBg.on('pointerover', () => {
                buttonBg.setScale(1.05);
                button.setScale(1.05);
            });

            buttonBg.on('pointerout', () => {
                buttonBg.setScale(1);
                button.setScale(1);
            });

            buttonBg.on('pointerdown', () => {
                this.handleBallPurchase(ball);
            });
        }
    }

    handleBallPurchase(ball) {
        const isOwned = this.ownedBalls.includes(ball.id);

        if (isOwned) {
            // Equip the ball
            this.equippedBall = ball.id;
            localStorage.setItem('goalDefenderEquippedBall', ball.id);
            console.log('Equipped:', ball.name);
            this.scene.restart(); // Refresh shop
        } else {
            // Try to buy the ball
            if (this.playerMoney >= ball.price) {
                this.playerMoney -= ball.price;
                localStorage.setItem('goalDefenderMoney', this.playerMoney);
                
                this.ownedBalls.push(ball.id);
                localStorage.setItem('goalDefenderOwnedBalls', JSON.stringify(this.ownedBalls));
                
                console.log('Purchased:', ball.name);
                this.scene.restart(); // Refresh shop
            } else {
                console.log('Not enough money!');
                // TODO: Show "Not enough money" message
            }
        }
    }
}
