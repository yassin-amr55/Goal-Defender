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

        // Title
        this.add.text(640, 66, 'SHOP', {
            fontSize: '58px',
            color: '#000000',
            fontStyle: '900',
            alpha: 0.45
        }).setOrigin(0.5);

        this.add.text(640, 62, 'SHOP', {
            fontSize: '58px',
            color: '#ffffff',
            fontStyle: '900',
            stroke: '#f0a500',
            strokeThickness: 7
        }).setOrigin(0.5);

        // Get player money
        this.playerMoney = parseInt(localStorage.getItem('goalDefenderMoney') || 0);

        // Money chip
        UI.panel(this, {
            x: 170, y: 62, w: 240, h: 58, radius: 29,
            fillTop: 0x1b2b3f, fillBottom: 0x0d1723,
            border: 0xf0b429, borderWidth: 2
        });

        this.moneyText = this.add.text(170, 62, '$' + this.playerMoney, {
            fontSize: '27px',
            color: '#ffd45e',
            fontStyle: '900'
        }).setOrigin(0.5);

        // Mute/Unmute button
        UI.topRight(this, {});

        // Get owned and equipped balls from localStorage
        this.ownedBalls = JSON.parse(localStorage.getItem('goalDefenderOwnedBalls') || '["default"]');
        this.equippedBall = localStorage.getItem('goalDefenderEquippedBall') || 'default';

        // PHASE 10: Define ball data - kept sorted by price, cheapest first
        this.ballData = [
            { id: 'default', name: 'Default Ball', price: 0, ability: 'None', texture: 'ball_default' },
            { id: 'golden', name: 'Golden Ball', price: 150, ability: 'Hitbox shrinks 15% slower', texture: 'ball_golden' },
            { id: 'steel', name: 'Steel Ball', price: 300, ability: 'Ball moves 10% slower', texture: 'ball_steel' },
            { id: 'rubber', name: 'Rubber Ball', price: 1200, ability: 'Bounces 25% higher', texture: 'ball_rubber' },
            { id: 'ice', name: 'Ice Ball', price: 1500, ability: 'Hitbox shrinks 50% slower', texture: 'ball_ice' },
            { id: 'anchor', name: 'Anchor Ball', price: 2000, ability: 'Ball moves 50% slower', texture: 'ball_anchor' },
            { id: 'fire', name: 'Fire Ball', price: 3000, ability: '+2 score per deflect', texture: 'ball_fire' },
            { id: 'neon', name: 'Neon Ball', price: 5000, ability: 'Speed boost +8% per hit', texture: 'ball_neon' },
            { id: 'ghost', name: 'Ghost Ball', price: 5250, ability: 'Min hitbox 130% of ball', texture: 'ball_ghost' },
            { id: 'spark', name: 'Spark Ball', price: 7500, ability: 'Max speed 210%', texture: 'ball_spark' },
            { id: 'candy', name: 'Candy Ball', price: 8000, ability: '+3 score per deflect', texture: 'ball_candy' },
            { id: 'void', name: 'Void Ball', price: 20000, ability: 'Hitbox starts min, max speed 170%', texture: 'ball_void' },
            { id: 'gauntlet', name: 'Gauntlet Ball', price: 500000, ability: 'Hitbox 170%, max speed 100%, +5 score', texture: 'ball_gauntlet' }
        ];

        // Back + page navigation. Created before the grid, because renderPage()
        // sets the enabled/disabled state of PREV and NEXT.
        UI.button(this, {
            x: 140, y: 662, w: 180, h: 58,
            label: 'BACK',
            textSize: 24,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59,
            radius: 16,
            onClick: () => this.scene.start('MenuScene')
        });

        this.prevBtn = UI.button(this, {
            x: 470, y: 662, w: 130, h: 58,
            label: 'PREV',
            textSize: 20,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59,
            radius: 16,
            onClick: () => this.changePage(-1)
        });

        this.pageLabel = this.add.text(640, 662, '', {
            fontSize: '18px', color: '#9fb3c8', fontStyle: '800'
        }).setOrigin(0.5);

        this.nextBtn = UI.button(this, {
            x: 810, y: 662, w: 130, h: 58,
            label: 'NEXT',
            textSize: 20,
            fillTop: 0x4a90c4, fillBottom: 0x2f6b9c,
            radius: 16,
            onClick: () => this.changePage(1)
        });

        // Create ball grid
        this.createBallGrid();

        console.log('ShopScene loaded - Phase 9');
    }

    createBallGrid() {
        // 13 balls, so the grid is 4 columns x 2 rows with page navigation.
        // Card is 250 tall, so rows need >= 256 spacing to avoid overlapping.
        this.perPage = 8;
        this.page = 0;
        this.pageCount = Math.max(1, Math.ceil(this.ballData.length / this.perPage));

        this.gridLayer = this.add.container(0, 0);
        this.renderPage();
    }

    renderPage() {
        this.gridLayer.removeAll(true);

        const startX = 190;
        const startY = 240;
        const spacingX = 300;
        const spacingY = 256;

        const start = this.page * this.perPage;
        this.ballData.slice(start, start + this.perPage).forEach((ball, i) => {
            const x = startX + (i % 4) * spacingX;
            const y = startY + Math.floor(i / 4) * spacingY;
            this.gridLayer.add(this.createBallCard(ball, x, y));
        });

        const multi = this.pageCount > 1;
        this.prevBtn.setVisible(multi);
        this.nextBtn.setVisible(multi);
        this.pageLabel.setText('PAGE ' + (this.page + 1) + ' / ' + this.pageCount);
        if (multi) {
            const canPrev = this.page > 0;
            const canNext = this.page < this.pageCount - 1;
            this.prevBtn.gdSetFill(canPrev ? 0x5a6b7d : 0x3a4652, canPrev ? 0x3d4b59 : 0x2a3440, 0x6b7d90);
            this.nextBtn.gdSetFill(canNext ? 0x4a90c4 : 0x3a4652, canNext ? 0x2f6b9c : 0x2a3440, 0x5aa9e6);
        }
    }

    changePage(delta) {
        const next = this.page + delta;
        if (next < 0 || next >= this.pageCount) return;
        this.page = next;
        this.renderPage();
    }

    createBallCard(ball, x, y) {
        // Everything goes into a container so a page change can clear them.
        const box = this.add.container(0, 0);

        // Rounded card. Card half-height is 125, so every child below is
        // positioned to stay inside - the button used to overflow the bottom.
        box.add(UI.panel(this, {
            x: x, y: y, w: 280, h: 250, radius: 20,
            fillTop: 0x22334a, fillBottom: 0x141f2c,
            border: 0x3d5a73, borderWidth: 2
        }));

        // Ball icon
        if (this.textures.exists(ball.texture)) {
            const icon = this.add.image(x, y - 74, ball.texture);
            icon.setScale(0.19);
            box.add(icon);
        }

        box.add(this.add.text(x, y - 26, ball.name, {
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: '800'
        }).setOrigin(0.5));

        box.add(this.add.text(x, y + 2, ball.ability, {
            fontSize: '12px',
            color: '#9fb3c8',
            fontStyle: '600',
            wordWrap: { width: 236 },
            align: 'center'
        }).setOrigin(0.5));

        box.add(this.add.text(x, y + 44, '$' + ball.price, {
            fontSize: '22px',
            color: '#ffd45e',
            fontStyle: '900'
        }).setOrigin(0.5));

        const isOwned = this.ownedBalls.includes(ball.id);
        const isEquipped = this.equippedBall === ball.id;

        let buttonText = 'BUY  $' + ball.price;
        let fillTop = 0x3ddc6b, fillBottom = 0x17a34a;

        if (isEquipped) {
            buttonText = 'EQUIPPED';
            fillTop = 0x3c4a5a; fillBottom = 0x2a3644;
        } else if (isOwned) {
            buttonText = 'EQUIP';
            fillTop = 0x4aa3e8; fillBottom = 0x2170b0;
        }

        box.add(UI.button(this, {
            x: x, y: y + 86, w: 172, h: 46,
            label: buttonText,
            textSize: 16,
            fillTop: fillTop, fillBottom: fillBottom,
            radius: 12,
            onClick: isEquipped ? null : () => this.handleBallPurchase(ball)
        }));

        return box;
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

                // Owning a new ball can complete a collection achievement
                if (window.Achievements) window.Achievements.check(this);

                console.log('Purchased:', ball.name);
                this.scene.restart(); // Refresh shop
            } else {
                console.log('Not enough money!');
                // TODO: Show "Not enough money" message
            }
        }
    }
}
