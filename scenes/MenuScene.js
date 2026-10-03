class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const groundHeight = 100;
        const groundY = 720;
        const groundTopY = groundY - groundHeight;

        // Background
        if (this.textures.exists('background')) {
            const bg = this.add.image(640, 0, 'background');
            bg.setOrigin(0.5, 0);
            bg.setDisplaySize(1280, groundTopY);
            bg.setAlpha(0.75);
        } else {
            this.cameras.main.setBackgroundColor('#87CEEB');
        }

        if (this.textures.exists('ground')) {
            const ground = this.add.image(640, groundY, 'ground');
            ground.setOrigin(0.5, 1);
            ground.setDisplaySize(1280, groundHeight);
            ground.setAlpha(0.5);
        }

        if (this.textures.exists('grass')) {
            const grass = this.add.image(640, groundTopY + 3, 'grass');
            grass.setOrigin(0.5, 1);
            grass.setDisplaySize(1280, grass.height);
            grass.setAlpha(0.4);
        }

        const highScore = localStorage.getItem('goalDefenderHighScore') || 0;

        /* ---------------- title ---------------- */

        const title = UI.title(this, {
            text: 'GOAL DEFENDER', x: 640, y: 126,
            size: 82, fill: '#ffffff', stroke: '#f0a500', thickness: 9
        });

        this.tweens.add({
            targets: title,
            scale: { from: 1, to: 1.035 },
            duration: 1600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        /* ---------------- high score chip ---------------- */

        const chipW = 380, chipH = 62, chipY = 216;
        const chip = UI.button(this, {
            x: 640, y: chipY, w: chipW, h: chipH,
            label: 'BEST  ' + highScore,
            textSize: 30,
            fillTop: 0x1b2b3f, fillBottom: 0x0d1723,
            border: 0xf0b429, radius: chipH / 2
        });
        if (chip.gdLabel) {
            chip.gdLabel.setColor('#ffd45e');
            chip.gdSetLabelColor = function () {};
        }

        /* ---------------- primary actions ----------------
         * A centred stack that ends well above the ground line, with the two
         * secondary actions sharing the last row side by side. */

        const playBtn = UI.button(this, {
            x: 640, y: 322, w: 320, h: 88,
            label: 'PLAY',
            textSize: 40,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a,
            onClick: () => this.scene.start('GameScene')
        });

        const shopBtn = UI.button(this, {
            x: 640, y: 420, w: 320, h: 80,
            label: 'SHOP',
            textSize: 34,
            fillTop: 0xffb340, fillBottom: 0xf08a1d,
            onClick: () => this.scene.start('ShopScene')
        });

        /* TOURNAMENT is a full mode - brackets, cups, a streak counter and a
         * trophy room - and it was rendered at 15px in a 176px button, the same
         * size as a version stamp. Widened to 210 and raised to 20px so it reads
         * as a destination. LEARN TO PLAY stays quieter: it is genuinely
         * optional, so it sits one step below the modes. */
        const rowY = 528;
        const smallW = 210;
        const smallH = 52;
        const gap = 20;

        const tournamentBtn = UI.button(this, {
            x: 640 - (smallW + gap) / 2, y: rowY, w: smallW, h: smallH,
            label: 'TOURNAMENT',
            textSize: 20,
            fillTop: 0xf0b429, fillBottom: 0xc98a08,
            onClick: () => this.scene.start('TournamentMenuScene')
        });

        const tutorialBtn = UI.button(this, {
            x: 640 + (smallW + gap) / 2, y: rowY, w: smallW, h: smallH,
            label: 'LEARN TO PLAY',
            textSize: 15,
            fillTop: 0x4a90c4, fillBottom: 0x2f6b9c,
            onClick: () => this.scene.start('TutorialScene')
        });

        /* ---------------- achievements (top left) ----------------
         *
         * Labelled. The two side icons were the only way into achievements and
         * the leaderboard, and a bare medal and podium gave a new player no
         * reason to tap either - the menu otherwise offers every other screen as
         * a big named button, so these two read as decoration. The caption sits
         * under each icon and is part of the same hit area, so the whole block
         * is one target rather than a 34px circle. */

        /* These two gates lead to a 39-item collection worth over a billion
         * dollars and to the leaderboard - the deepest content in the game - and
         * they were the smallest labels on the menu, crowded so tightly that the
         * AWARDS caption overlapped the RANKS icon above it.
         *
         * Icon centres are 112px apart now (48 and 160) with a 40px radius and an
         * 18px caption, so each caption clears the icon below it by ~21px. */
        UI.iconButton(this, {
            x: 58, y: 48, radius: 40,
            icon: 'medal-icon', iconScale: 0.38,
            label: 'AWARDS', labelSize: UI.TYPE.body,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a,
            depth: 50,
            onClick: () => this.scene.start('AchievementsScene')
        });

        /* ---------------- leaderboard (under the medal) ---------------- */

        UI.iconButton(this, {
            x: 58, y: 160, radius: 40,
            icon: 'podium-icon', iconScale: 0.40,
            label: 'RANKS', labelSize: UI.TYPE.body,
            fillTop: 0xf0a500, fillBottom: 0xc98a08,
            depth: 50,
            onClick: () => this.scene.start('LeaderboardScene')
        });

        /* ---------------- account (top right, under settings + mute) --------
         * A pill sized to its own text, anchored so its RIGHT edge is at 1244 and
         * it grows leftwards - it can never run off the canvas edge, which a
         * previous fixed-width button at x=1236 with w=170 did. */
        this.makeAccountSlot();

        /* ---------------- floating ball ---------------- */

        const equippedBall = localStorage.getItem('goalDefenderEquippedBall') || 'default';
        const ballTexture = this.getBallTexture(equippedBall);

        /* S2: the ball floated at y=380..480 with nothing beneath it, which is
         * inside the crowd - it read as a sticker that had slipped rather than an
         * object in the scene. It now sits just above the pitch (which starts at
         * y=620) and carries a soft contact shadow that tracks it, so it reads as
         * bouncing on the ground. */
        const pitchTop = groundTopY;

        if (this.textures.exists(ballTexture)) {
            const ballShadow = this.add.graphics().setAlpha(0.28);
            const ball = this.add.image(250, 430, ballTexture);
            ball.setScale(0.3);
            this.tweens.add({
                targets: ball,
                y: { from: 470, to: pitchTop - 96 },
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            /* Shadow grows and darkens as the ball approaches the pitch, which is
             * what sells the height. */
            this.tweens.add({
                targets: ballShadow,
                alpha: { from: 0.1, to: 0.34 },
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                onUpdate: () => {
                    const t = 1 - (ball.y - 470) / (pitchTop - 96 - 470);
                    ballShadow.clear();
                    ballShadow.fillStyle(0x000000, 1);
                    ballShadow.fillEllipse(250, pitchTop + 6, 90 + t * 70, 16 + t * 12);
                }
            });
            this.tweens.add({
                targets: ball,
                x: { from: 205, to: 295 },
                duration: 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            this.tweens.add({
                targets: ball,
                angle: 360,
                duration: 3000,
                repeat: -1,
                ease: 'Linear'
            });
        }

        /* ---------------- version ---------------- */

        /* Was 19px - larger than TOURNAMENT (15px), LEARN TO PLAY (15px), AWARDS
         * and RANKS. A grey corner stamp competing with real navigation is a
         * hierarchy inversion: the eye reads size as importance. Now micro, and
         * quieter still. */
        this.add.text(1262, 700, UI.VERSION, {
            fontSize: UI.TYPE.micro + 'px',
            fontFamily: UI.FAMILY,
            fontStyle: '700',
            color: '#cfe0f0',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(1, 1).setAlpha(0.4);

        // Top-right cluster: settings gear (small) + mute
        UI.topRight(this, {
            settingsIcon: 'settings-icon',
            radius: 25,
            onSettings: () => this.scene.start('SettingsScene')
        });

        // Safety net: pay out anything earned elsewhere (shop, tournament, run)
        if (window.Achievements) window.Achievements.check(this);

        // Publish to the leaderboard. Fire-and-forget: submit() swallows its
        // own failures and returns a promise nobody awaits, so the menu never
        // waits on the network.
        MenuScene.publish();

        // Push any local progress to the signed-in account. Debounced, so
        // bouncing through the menu does not hammer Firestore.
        if (window.GDAccount && window.GDAccount.isSignedIn()) {
            window.GDAccount.scheduleSync();
        }

        // Keep the top-right slot correct when signing in or out.
        // Registered ONCE ever. Previously this ran inside create(), so every
        // rebuild added another listener and refreshAccountSlot fired N times,
        // which left stray labels stacked on the menu.
        if (window.GDAccount && !MenuScene._accountHooked) {
            MenuScene._accountHooked = true;
            window.GDAccount.onChange(() => {
                const s = window.game && window.game.scene.getScene('MenuScene');
                if (s && s.scene.isActive()) s.refreshAccountSlot();
                /* Signing in or restoring changes WHICH identity we publish
                 * under, and possibly the name too, so the board has to be
                 * rewritten. Without this a player who signed in kept the row
                 * written under their old anonymous id, and their account
                 * progress never appeared on the board at all. */
                MenuScene.publish();
            });
        }
    }

    /* Single place that writes to the leaderboard, so the "?noleaderboard"
     * escape hatch cannot be bypassed by a second call site. */
    static publish() {
        if (!window.GDPlayer) return;
        if (/[?&]noleaderboard\b/.test(location.search)) return;
        window.GDPlayer.submit({ force: true });
    }

    /* ---------------- account slot ----------------
     *
     * This was bare outlined text with a coloured "glow" copy behind it, and it
     * was the ugliest thing on the menu.
     *
     * The glow used the SAME colour as the fill with a 7px stroke at 12% alpha.
     * That is not a glow - it is a thick ring of the text's own colour sitting
     * behind a dark-outlined copy of the text, and at 18px the two fought each
     * other into an amber blob (signed in) or a white cloud (signed out). Around
     * round letters it extended well past the glyphs, which is what made it look
     * like a smudge rather than a label.
     *
     * It is now a proper pill, built from the same parts as every other chip in
     * the game (the shop's money pill and the menu's BEST pill): a dark rounded
     * panel, a coloured border, a crisp label with NO outline, and a drawn
     * person glyph so the control is identifiable at a glance.
     *
     * There is no account icon asset, and the game uses no emoji, so the glyph is
     * a head circle plus a shoulder arc drawn with Graphics.
     *
     * Colour carries the state: gold border and gold text when signed in (the
     * game's "this is the one" colour), neutral blue when signed out. */
    makeAccountSlot() {
        /* Right edge derived from the top-right cluster so the two line up.
         *
         * TOP_RIGHT_X is the centre of the gear circle, and MenuScene gives that
         * cluster a radius of 25 with a 3px border, so its outer painted edge is
         * centre + radius + 1. Measured on the rendered canvas, the gear's fill
         * ends at x=1261 and the sky resumes at 1262.
         *
         * The pill was previously right-anchored at 1244, which put its edge 17px
         * short of the gear's. In the same corner that reads as a mistake rather
         * than as a deliberate inset. */
        const right = UI.TOP_RIGHT_X + 26;
        const cy = 96;
        const h = 46;
        const padX = 18;
        const glyphW = 30;
        const gap = 12;

        this.accountPill = this.add.graphics().setDepth(48);
        this.accountGlyph = this.add.graphics().setDepth(49);
        this.accountLabel = this.add.text(0, 0, '', {
            fontSize: UI.TYPE.body + 'px',
            color: '#ffffff',
            fontFamily: UI.FAMILY,
            fontStyle: '900'
        }).setOrigin(0, 0.5).setDepth(50);

        const self = this;
        function paint(text, signedIn, hover) {
            const label = self.accountLabel;
            label.setText(text);

            const w = padX * 2 + glyphW + gap + label.width;
            const x = right - w / 2;
            const left = x - w / 2;

            label.x = left + padX + glyphW + gap;
            label.y = cy;
            label.setColor(signedIn ? (hover ? '#ffe9a8' : '#ffd45e') : (hover ? '#e8f0f8' : '#ffffff'));
            self.accountSignedIn = signedIn;

            const g = self.accountPill;
            g.clear();
            // Shadow, inset and tucked like every other chip.
            g.fillStyle(0x000000, 0.30);
            g.fillRoundedRect(left + 2, cy - h / 2 + 4, w - 4, h, h / 2 - 1);
            // Body.
            g.fillGradientStyle(0x22334a, 0x22334a, 0x101a26, 0x101a26, 1);
            g.fillRoundedRect(left, cy - h / 2, w, h, h / 2);
            // Border: gold when signed in, neutral when not.
            g.lineStyle(2, signedIn ? (hover ? 0xffd45e : 0xf0b429) : (hover ? 0x8ea6bd : 0x54687d), 1);
            g.strokeRoundedRect(left, cy - h / 2, w, h, h / 2);

            // Person glyph: head + shoulders, centred in its own column.
            const gx = left + padX + glyphW / 2;
            const gc = signedIn ? (hover ? 0xffe9a8 : 0xffd45e) : (hover ? 0xd6e2ee : 0xb9c9da);
            const gl = self.accountGlyph;
            gl.clear();
            gl.fillStyle(gc, 1);
            gl.fillCircle(gx, cy - 8, 7);
            gl.fillRoundedRect(gx - 11, cy + 2, 22, 12, 6);

            // Hit area covers the whole pill, not just the text.
            if (self.accountZone) self.accountZone.setPosition(cx_(left, w), cy);
            self.accountW = w;
            self.accountLeft = left;
        }
        function cx_(left, w) { return left + w / 2; }

        this.paintAccount = paint;

        this.accountZone = this.add.zone(right, cy, 200, h + 10).setOrigin(0.5);
        this.accountZone.setInteractive({ useHandCursor: true });
        this.accountZone.setDepth(51);
        this.accountZone.on('pointerdown', () => this.scene.start('AccountScene'));
        /* No hover animation here.
         *
         * Every other control in the game grows 4-8% on hover, which is what
         * makes them feel clickable. This one did too, and it was the one place
         * it looked wrong: the pill is in the corner, it sits directly on top of
         * the stadium art, and a scaling pill visibly jumps away from the edge
 * it is aligned with.
         *
         * It still has a hover state - the border and label brighten - it just
         * does not move. Alignment is worth more than the motion. */
        var self2 = this;
        this.accountZone.on('pointerover', function () {
            self2.paintAccount(self2.accountLabel.text, self2.accountSignedIn, true);
        });
        this.accountZone.on('pointerout', function () {
            self2.paintAccount(self2.accountLabel.text, self2.accountSignedIn, false);
        });

        const signedIn = !!(window.GDAccount && window.GDAccount.isSignedIn());
        paint(signedIn ? (window.GDAccount.username() || 'player') : 'SIGN IN', signedIn, false);
        return this.accountLabel;
    }

    /* Swap the account text between SIGN IN and the username.
     *
     * Repaints the EXISTING pill rather than destroying and rebuilding it.
     * Rebuilding left an orphaned label behind whenever create() ran more than
     * once, which is what produced two overlapping texts on the menu and a
     * SIGN IN that refused to disappear. The pill is also re-measured, because
     * "SIGN IN" and a username are very different widths. */
    refreshAccountSlot() {
        const A = window.GDAccount;
        if (!A || !this.paintAccount) return;
        const signedIn = A.isSignedIn();
        const text = signedIn ? (A.username() || 'player') : 'SIGN IN';
        this.paintAccount(text, signedIn, false);
        if (this.accountZone) {
            this.accountZone.width = (this.accountW || 200) + 12;
        }
    }

    getBallTexture(ballId) {
        const textureMap = {
            'default': 'ball_default',
            'golden': 'ball_golden',
            'fire': 'ball_fire',
            'steel': 'ball_steel',
            'ghost': 'ball_ghost',
            'spark': 'ball_spark',
            'rubber': 'ball_rubber',
            'ice': 'ball_ice',
            'anchor': 'ball_anchor',
            'neon': 'ball_neon',
            'candy': 'ball_candy',
            'void': 'ball_void',
            'gauntlet': 'ball_gauntlet',
            'money': 'ball_money',
            'revive': 'ball_revive',
'inverted': 'ball_inverted',
'focus': 'ball_focus',
'rally': 'ball_rally',
'life': 'ball_life',
'sprung': 'ball_sprung',
        };
        return textureMap[ballId] || 'ball_default';
    }

    createMuteButton() {
        const muteButton = this.add.image(1230, 30, window.Settings.isOn('gdMuted') ? 'volume-mute' : 'volume-unmute');
        muteButton.setScale(0.08);
        muteButton.setInteractive({ useHandCursor: true });

        muteButton.on('pointerover', () => { muteButton.setScale(0.1); });
        muteButton.on('pointerout', () => { muteButton.setScale(0.08); });
        muteButton.on('pointerdown', () => {
            window.Settings.toggle('gdMuted');
            isMuted = window.Settings.isOn('gdMuted');
            muteButton.setTexture(isMuted ? 'volume-mute' : 'volume-unmute');
        });
    }
}
