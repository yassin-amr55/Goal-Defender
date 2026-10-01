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

        /* ---------------- achievements (top left) ---------------- */

        UI.iconButton(this, {
            x: 52, y: 52, radius: 34,
            icon: 'medal-icon', iconScale: 0.34,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a,
            depth: 50,
            onClick: () => this.scene.start('AchievementsScene')
        });

        /* ---------------- leaderboard (under the medal) ---------------- */

        UI.iconButton(this, {
            x: 52, y: 142, radius: 34,
            icon: 'podium-icon', iconScale: 0.36,
            fillTop: 0xf0a500, fillBottom: 0xc98a08,
            depth: 50,
            onClick: () => this.scene.start('LeaderboardScene')
        });

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

        this.add.text(1256, 692, 'V2.0', {
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
        if (window.GDPlayer) window.GDPlayer.submit();
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
