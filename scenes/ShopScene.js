class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });
    }

    /** sessionStorage key holding the page the player was last looking at. */
    static PAGE_KEY = 'gdShopPage';

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
        UI.title(this, {
            text: 'SHOP', x: 640, y: 62,
            size: UI.TYPE.hero + 4, fill: '#ffffff',
            stroke: '#f0a500', thickness: 7
        });

        // Get player money
        this.playerMoney = parseInt(localStorage.getItem('goalDefenderMoney') || 0, 10);

        // Money chip
        UI.panel(this, {
            x: 170, y: 62, w: 240, h: 58, radius: 29,
            fillTop: 0x1b2b3f, fillBottom: 0x0d1723,
            border: 0xf0b429, borderWidth: 2
        });

        this.moneyText = this.add.text(170, 62, '$' + Achievements.fmt(this.playerMoney), {
            fontSize: UI.TYPE.lead + 'px',
            color: '#ffd45e',
            fontStyle: '900'
        }).setOrigin(0.5);

        // Mute/Unmute button
        UI.topRight(this, {});

        // Get owned and equipped balls from localStorage
        this.ownedBalls = JSON.parse(localStorage.getItem('goalDefenderOwnedBalls') || '["default"]');
        this.equippedBall = localStorage.getItem('goalDefenderEquippedBall') || 'default';

        /* PHASE 10: Define ball data - kept sorted by price, cheapest first.
         *
         * The order matters: the shop renders this array in sequence, so a
         * price ladder out of order would show a cheap ball after an expensive
         * one and read as a pricing mistake. 20 balls, cheapest to dearest.
         *
         * `balls_all` in achievements.js counts owned balls and its goal has to
         * equal this length - it was left at 13 when the shop grew, which made
         * the achievement impossible to claim. */
        this.ballData = [
            { id: 'default', name: 'Default Ball', price: 0, ability: 'Standard ball', texture: 'ball_default' },
            { id: 'golden', name: 'Golden Ball', price: 150, ability: 'Hitbox shrinks 15% slower', texture: 'ball_golden' },
            { id: 'steel', name: 'Steel Ball', price: 900, ability: 'Speed boost +3.6% per hit, base speed 90%', texture: 'ball_steel' },
            { id: 'rubber', name: 'Rubber Ball', price: 3600, ability: 'Bounces 25% higher', texture: 'ball_rubber' },
            { id: 'ice', name: 'Ice Ball', price: 4500, ability: 'Hitbox shrinks 50% slower', texture: 'ball_ice' },
            { id: 'revive', name: 'Revive Ball', price: 10000, ability: 'Saves you once - bounce off the goal', texture: 'ball_revive' },
            { id: 'fire', name: 'Fire Ball', price: 14500, ability: '+2 score per deflect', texture: 'ball_fire' },
            { id: 'neon', name: 'Neon Ball', price: 15000, ability: 'Speed boost +8% per hit', texture: 'ball_neon' },
            { id: 'sprung', name: 'Sprung Ball', price: 15250, ability: 'Bounces 60% higher', texture: 'ball_sprung' },
            { id: 'ghost', name: 'Ghost Ball', price: 15750, ability: 'Min hitbox 130% of ball', texture: 'ball_ghost' },
            /* Anchor moved from $6,000 to $20,000, so it also moves DOWN this
             * ladder - between Ghost ($15,750) and Money ($24,500). The array is
             * rendered in order and the runtime guard below refuses to boot on an
             * unsorted ladder, so a price change here is a reorder too.
             *
             * Its ability text now states the boost per hit instead of
             * "Speed increases 50% slower". That phrasing was a double negative
             * that never mentioned the boost, and its "50%" collided visually with
             * Ice Ball's "Hitbox shrinks 50% slower" three rows above. The boost
             * was always +2% per hit (boostStepMain 1.02); the copy just never
             * said so. */
            { id: 'anchor', name: 'Anchor Ball', price: 20000, ability: 'Speed boost +2% per hit, half base speed', texture: 'ball_anchor' },
            { id: 'money', name: 'Money Ball', price: 24500, ability: 'Earns $5 per deflect instead of $3', texture: 'ball_money' },
            { id: 'spark', name: 'Spark Ball', price: 30000, ability: 'Max speed boost 210%', texture: 'ball_spark' },
            { id: 'candy', name: 'Candy Ball', price: 50000, ability: '+3 score per deflect', texture: 'ball_candy' },
            { id: 'life', name: 'Life Ball', price: 60000, ability: 'Saves you three times', texture: 'ball_life' },
            { id: 'rally', name: 'Rally Ball', price: 65000, ability: 'Each deflect earns $1 more than the last', texture: 'ball_rally' },
            { id: 'focus', name: 'Focus Ball', price: 90000, ability: 'Dead-centre taps are Perfect: +5 score', texture: 'ball_focus' },
            { id: 'void', name: 'Void Ball', price: 100000, ability: 'Hitbox starts min, max speed 170%', texture: 'ball_void' },
            { id: 'inverted', name: 'Inverted Ball', price: 500000, ability: 'Hitbox stays 150%, max speed stays 150%', texture: 'ball_inverted' },
            { id: 'gauntlet', name: 'Gauntlet Ball', price: 1500000, ability: 'Hitbox 170%, max speed 130%, +5 score', texture: 'ball_gauntlet' }
        ];

        /* Guard the two things that have silently broken before.
         *
         * 1. Full Rack in achievements.js counts owned balls against a constant
         *    that was left at 13 while the shop sold 14, making the achievement
         *    impossible to claim. If a ball is added here without bumping
         *    BALL_COUNT, Full Rack quietly becomes unreachable again - so say
         *    so loudly at startup instead of at the end of a release.
         *
         * 2. The shop renders this array in order, so an unsorted price ladder
         *    reads as a pricing mistake to the player. */
        if (window.Achievements && typeof window.Achievements.ballCount === 'function') {
            var expected = window.Achievements.ballCount();
            if (expected !== this.ballData.length) {
                console.error('Ball count mismatch: shop has ' + this.ballData.length +
                    ' but achievements.js BALL_COUNT is ' + expected +
                    ' - Full Rack will be unreachable. Update BALL_COUNT.');
            }
        }
        for (let i = 1; i < this.ballData.length; i++) {
            if (this.ballData[i].price < this.ballData[i - 1].price) {
                console.error('ballData is not sorted by price at index ' + i +
                    ' (' + this.ballData[i].id + ').');
                break;
            }
        }

        /* Close + page navigation. Created before the grid, because renderPage()
         * sets the enabled/disabled state of PREV and NEXT.
         *
         * M2: the shared red X replaces a bottom-left BACK, so closing sits in the
         * same place on every sub-screen. That also frees the bottom bar, which
         * is now just PREV / PAGE / NEXT centred - one alignment instead of a
         * BACK floating on the left next to a centred pager. */
        UI.closeButton(this, {
            x: UI.CLOSE_X, y: UI.CLOSE_Y, r: 22,
            onClick: () => this.scene.start('MenuScene')
        });

        this.prevBtn = UI.button(this, {
            x: 470, y: 662, w: 130, h: 58,
            label: 'PREV',
            textSize: UI.TYPE.body,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59,
            radius: 16,
            onClick: () => this.changePage(-1)
        });

        this.pageLabel = this.add.text(640, 662, '', {
            fontSize: UI.TYPE.small + 'px', color: '#9fb3c8', fontStyle: '800'
        }).setOrigin(0.5);

        this.nextBtn = UI.button(this, {
            x: 810, y: 662, w: 130, h: 58,
            label: 'NEXT',
            textSize: UI.TYPE.body,
            fillTop: 0x4a90c4, fillBottom: 0x2f6b9c,
            radius: 16,
            onClick: () => this.changePage(1)
        });

        // Create ball grid
        this.createBallGrid();

    }

    createBallGrid() {
        // 13 balls, so the grid is 4 columns x 2 rows with page navigation.
        // Card is 250 tall, so rows need >= 256 spacing to avoid overlapping.
        this.perPage = 8;

        // Survive a restart while the player is on page 2. Buying or equipping
        // calls scene.restart(), which rebuilds everything and used to reset
        // this to 0 - so you would jump back to page 1 after every purchase
        // without touching the prev/next buttons.
        const savedPage = parseInt(sessionStorage.getItem(ShopScene.PAGE_KEY) || '0', 10);
        this.page = (Number.isFinite(savedPage) && savedPage >= 0) ? savedPage : 0;
        this.pageCount = Math.max(1, Math.ceil(this.ballData.length / this.perPage));
        this.page = Math.min(this.page, this.pageCount - 1);

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
        this.savePage();
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
        this.savePage();
        this.renderPage();
    }

    /** Remember the page across scene.restart() so buying or equipping a ball
     *  leaves you on the page you were looking at. */
    savePage() {
        try {
            sessionStorage.setItem(ShopScene.PAGE_KEY, String(this.page));
        } catch (e) { /* private mode: fall back to always starting at page 1 */ }
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

        /* Card is y-125..y+125. The ball art was centred at y-74 at 0.19 scale
         * - 97px tall, so it reached y-122 and its bottom edge landed exactly on
         * the name text with zero gap. Every card looked cramped at the top.
         * Now 0.15 at y-78, leaving ~15px of air above the name. */
        if (this.textures.exists(ball.texture)) {
            const icon = this.add.image(x, y - 78, ball.texture);
            icon.setScale(0.15);
            box.add(icon);
        }

        box.add(this.add.text(x, y - 24, ball.name, {
            fontSize: UI.TYPE.lead + 'px',
            color: '#ffffff',
            fontStyle: '800'
        }).setOrigin(0.5));

        /* 12px -> 14px. This line is the reason to buy one ball over another - it
         * is the single most decision-relevant string in the shop and it was the
         * smallest text on the card. At 10px it would be ~5px on a small phone. */
        box.add(this.add.text(x, y + 2, ball.ability, {
            fontSize: UI.TYPE.small + 'px',
            color: '#9fb3c8',
            fontStyle: '600',
            wordWrap: { width: 236 },
            align: 'center'
        }).setOrigin(0.5));

        box.add(this.add.text(x, y + 42, '$' + Achievements.fmt(ball.price), {
            fontSize: UI.TYPE.lead + 'px',
            color: '#ffd45e',
            fontStyle: '900'
        }).setOrigin(0.5));

        const isOwned = this.ownedBalls.includes(ball.id);
        const isEquipped = this.equippedBall === ball.id;

        /* M8: the price was printed twice on every card - once in gold above the
         * button and again inside the button label ("$150" then "BUY $150"). The
         * price line stays, because that is where the eye lands; the button now
         * says only what it does.
         *
         * S12: EQUIPPED was grey with a lighter grey fill, which reads as
         * disabled or as a loading state. Being equipped is a SUCCESS state, so
         * it is gold with dark text - distinct from BUY green and EQUIP blue,
         * and matching the gold the game already uses for "this is the one". */
        let buttonText = 'BUY';
        let fillTop = 0x3ddc6b, fillBottom = 0x17a34a;
        let textColor = 0xffffff;

        if (isEquipped) {
            buttonText = 'EQUIPPED';
            fillTop = 0xf0b429; fillBottom = 0xc98a08;
            textColor = 0x1a1a1a;
        } else if (isOwned) {
            buttonText = 'EQUIP';
            fillTop = 0x4aa3e8; fillBottom = 0x2170b0;
        }

        box.add(UI.button(this, {
            x: x, y: y + 86, w: 172, h: 46,
            label: buttonText,
            textSize: UI.TYPE.body,
            textColor: textColor,
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

                this.scene.restart(); // Refresh shop
            } else {
                // TODO: Show "Not enough money" message
            }
        }
    }
}