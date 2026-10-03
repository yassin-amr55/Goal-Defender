class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    init(data) {
        // Receive score from GameScene
        this.finalScore = data.score || 0;
        this.finalDeflections = data.deflections || 0;
        // Which ball was equipped, so the Money Ball can pay $5 per deflect.
        this.equippedBall = data.equippedBall
            || localStorage.getItem('goalDefenderEquippedBall')
            || 'default';

        /* Rally Ball pays a growing amount per deflect, so the run has to hand
         * its total over rather than have it recomputed from a flat rate. */
        this.rallyEarned = Number(data.rallyEarned) || 0;
        this.perfects = Number(data.perfects) || 0;
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

        /* PHASE 9: Add money earned.
         *
         * deflections is captured in init() - `data` is not in scope here.
         *
         * Three pay shapes, and only one can apply per run:
         *   Rally  - the run's own escalating total: 1 + 2 + ... + n
         *   Money  - a flat $5 per deflect
         *   normal - a flat $3 per deflect
         *
         * Rally is checked FIRST and on its own. It used to be tempting to fold
         * it in as "rate per deflect", but the whole point is that the rate
         * changes every tap, so it cannot be expressed as one number. */
        const deflections = this.finalDeflections || this.finalScore;
        let moneyEarned;
        let rate;
        if (this.rallyEarned > 0) {
            moneyEarned = this.rallyEarned;
            rate = 0;   // not a per-deflect rate; shown as a total only
        } else {
            rate = (this.equippedBall === 'money') ? 5 : 3;
            moneyEarned = deflections * rate;
        }
        const currentMoney = parseInt(localStorage.getItem('goalDefenderMoney') || 0, 10);
        const newTotal = currentMoney + moneyEarned;
        localStorage.setItem('goalDefenderMoney', newTotal);

        /* "On the Go" - finish a run on a phone.
         *
         * Recorded once and never cleared: it is a "has ever done it"
         * achievement, so re-running must not toggle it back off. The coarse
         * pointer test matches a touchscreen, which is what "on a phone" means
         * to the player, and layout.js uses the same signal to decide whether
         * to rotate. */
        try {
            const coarse = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
                (navigator.maxTouchPoints || 0) > 0;
            if (coarse) localStorage.setItem('gdPlayedOnMobile', 'true');
        } catch (e) { /* matchMedia missing: leave the flag unset */ }

        // Title
        this.add.text(640, 132, 'GAME OVER', {
            fontSize: '70px',
            color: '#000000',
            fontStyle: '900',
            alpha: 0.45
        }).setOrigin(0.5);

        this.add.text(640, 128, 'GAME OVER', {
            fontSize: '70px',
            color: '#ff5a5a',
            fontStyle: '900',
            stroke: '#7a0f0f',
            strokeThickness: 8
        }).setOrigin(0.5);

        // Stats panel
        UI.panel(this, {
            x: 640, y: 320, w: 520, h: 220, radius: 22,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: 0x4a6a8a, borderWidth: 2
        });

        // Show final score
        this.add.text(640, 250, 'SCORE', {
            fontSize: '17px',
            color: '#8fa6bd',
            fontStyle: '800'
        }).setOrigin(0.5);

        this.add.text(640, 292, '' + this.finalScore, {
            fontSize: '62px',
            color: '#ffffff',
            fontStyle: '900'
        }).setOrigin(0.5);

        // PHASE 9: money earned and deflection count
        this.add.text(640, 344, 'DEFLECTIONS', {
            fontSize: '15px',
            color: '#8fa6bd',
            fontStyle: '800'
        }).setOrigin(0.5);

        this.add.text(640, 374, '' + deflections, {
            fontSize: '30px',
            color: '#ffffff',
            fontStyle: '900'
        }).setOrigin(0.5);

        this.add.text(640, 410, '+ $' + Achievements.fmt(moneyEarned), {
            fontSize: '26px',
            color: '#ffd45e',
            fontStyle: '900'
        }).setOrigin(0.5);

        // Buttons
        UI.button(this, {
            x: 520, y: 520, w: 250, h: 76,
            label: 'PLAY AGAIN',
            textSize: 25,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a,
            onClick: () => this.scene.start('GameScene')
        });

        UI.button(this, {
            x: 790, y: 520, w: 220, h: 76,
            label: 'HOME',
            textSize: 25,
            fillTop: 0xffb340, fillBottom: 0xf08a1d,
            onClick: () => this.scene.start('MenuScene')
        });

        // Mute/Unmute button
        this.createMuteButton();

    }

    createMuteButton() {
        const x = 1230;
        const y = 30;

        // Create the mute button sprite
        this.muteButton = this.add.image(x, y, window.Settings.isOn('gdMuted') ? 'volume-mute' : 'volume-unmute');
        this.muteButton.setScale(0.08);
        this.muteButton.setInteractive();

        this.muteButton.on('pointerover', () => {
            this.muteButton.setScale(0.1);
        });

        this.muteButton.on('pointerout', () => {
            this.muteButton.setScale(0.08);
        });

        this.muteButton.on('pointerdown', () => {
            window.Settings.toggle('gdMuted');
            isMuted = window.Settings.isOn('gdMuted');
            this.muteButton.setTexture(window.Settings.isOn('gdMuted') ? 'volume-mute' : 'volume-unmute');
        });
    }
}
