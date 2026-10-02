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

        // Layered drop shadow instead of a flat offset copy
        this.add.text(640, 128, 'GOAL DEFENDER', {
            fontSize: '82px',
            fontFamily: UI.FAMILY,
            fontStyle: '900',
            color: '#000000'
        }).setOrigin(0.5).setAlpha(0.45);

        const title = this.add.text(640, 126, 'GOAL DEFENDER', {
            fontSize: '82px',
            fontFamily: UI.FAMILY,
            fontStyle: '900',
            color: '#ffffff',
            stroke: '#f0a500',
            strokeThickness: 9
        }).setOrigin(0.5);

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

        const rowY = 522;
        const smallW = 176;   // half the width of the main buttons
        const smallH = 46;    // half the height
        const gap = 16;

        const tournamentBtn = UI.button(this, {
            x: 640 - (smallW + gap) / 2, y: rowY, w: smallW, h: smallH,
            label: 'TOURNAMENT',
            textSize: 15,
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

        UI.iconButton(this, {
            x: 52, y: 52, radius: 34,
            icon: 'medal-icon', iconScale: 0.34,
            label: 'AWARDS',
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a,
            depth: 50,
            onClick: () => this.scene.start('AchievementsScene')
        });

        /* ---------------- leaderboard (under the medal) ---------------- */

        UI.iconButton(this, {
            x: 52, y: 142, radius: 34,
            icon: 'podium-icon', iconScale: 0.36,
            label: 'RANKS',
            fillTop: 0xf0a500, fillBottom: 0xc98a08,
            depth: 50,
            onClick: () => this.scene.start('LeaderboardScene')
        });

        /* ---------------- account (top right, under settings + mute) --------
         * Text only with an outline, no filled background.
         *
         * Anchored at x=1244 with origin (1, 0.5) so it grows leftwards and can
         * never run off the right edge. The previous filled button at x=1236
         * with w=170 spanned out to 1321, past the 1280 canvas. */
        const signedIn = window.GDAccount && window.GDAccount.isSignedIn();
        this.accountLabel = this.makeAccountText(
            signedIn ? (window.GDAccount.username() || 'player') : 'SIGN IN',
            signedIn ? '#ffd45e' : '#ffffff'
        );
        this.accountLabel.on('pointerdown', () => this.scene.start('AccountScene'));

        /* ---------------- floating ball ---------------- */

        const equippedBall = localStorage.getItem('goalDefenderEquippedBall') || 'default';
        const ballTexture = this.getBallTexture(equippedBall);

        if (this.textures.exists(ballTexture)) {
            const ball = this.add.image(250, 430, ballTexture);
            ball.setScale(0.3);
            this.tweens.add({
                targets: ball,
                y: { from: 380, to: 480 },
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
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

        this.add.text(1256, 692, UI.VERSION, {
            fontSize: '19px',
            fontFamily: UI.FAMILY,
            fontStyle: '800',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(1, 1).setAlpha(0.55);

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

    /* Outlined text control for the account slot: no background, just a bright
     * fill with a dark outline so it reads clearly over the stadium art. */
    makeAccountText(text, color) {
        const t = this.add.text(1244, 96, text, {
            fontSize: '21px',
            color: color,
            fontFamily: UI.FAMILY,
            fontStyle: '900',
            stroke: '#0b1220',
            strokeThickness: 7
        }).setOrigin(1, 0.5).setDepth(50);

        // A soft second outline underneath, which reads as a glow and keeps
        // the label legible against both the sky and the dark stands.
        const glow = this.add.text(1244, 96, text, {
            fontSize: '21px',
            color: color,
            fontFamily: UI.FAMILY,
            fontStyle: '900',
            stroke: color,
            strokeThickness: 12,
            fillAlpha: 0.16
        }).setOrigin(1, 0.5).setDepth(49);

        t.setInteractive({ useHandCursor: true });
        t.on('pointerover', () => { t.setScale(1.08); });
        t.on('pointerout', () => { t.setScale(1); });

        t.gdGlow = glow;
        return t;
    }

    /* Swap the account text between SIGN IN and the username.
     *
     * Updates the EXISTING label rather than destroying and rebuilding it.
     * Rebuilding left an orphaned label behind whenever create() ran more than
     * once, which is what produced two overlapping texts on the menu and a
     * SIGN IN that refused to disappear. */
    refreshAccountSlot() {
        const A = window.GDAccount;
        if (!A || !this.accountLabel) return;
        const signedIn = A.isSignedIn();
        const text = signedIn ? (A.username() || 'player') : 'SIGN IN';
        const color = signedIn ? '#ffd45e' : '#ffffff';
        this.accountLabel.setText(text);
        this.accountLabel.setColor(color);
        if (this.accountLabel.gdGlow) {
            this.accountLabel.gdGlow.setText(text);
            this.accountLabel.gdGlow.setColor(color);
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
            'revive': 'ball_revive'
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
