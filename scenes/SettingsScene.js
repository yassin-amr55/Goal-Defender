class SettingsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SettingsScene' });
    }

    create() {
        const groundHeight = 100;
        const groundY = 720;
        const groundTopY = groundY - groundHeight;

        if (this.textures.exists('background')) {
            const bg = this.add.image(640, 0, 'background');
            bg.setOrigin(0.5, 0);
            bg.setDisplaySize(1280, groundTopY);
            bg.setAlpha(0.6);
        } else {
            this.cameras.main.setBackgroundColor('#1a1a1a');
        }

        if (this.textures.exists('ground')) {
            const ground = this.add.image(640, groundY, 'ground');
            ground.setOrigin(0.5, 1);
            ground.setDisplaySize(1280, groundHeight);
            ground.setAlpha(0.4);
        }

        if (this.textures.exists('grass')) {
            const grass = this.add.image(640, groundTopY + 3, 'grass');
            grass.setOrigin(0.5, 1);
            grass.setDisplaySize(1280, grass.height);
            grass.setAlpha(0.3);
        }

        // Darken so the panel reads clearly
        this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.55);

        // Title
        this.add.text(640, 86, 'SETTINGS', {
            fontSize: '54px',
            color: '#000000',
            fontStyle: '900',
            alpha: 0.45
        }).setOrigin(0.5);

        this.add.text(640, 82, 'SETTINGS', {
            fontSize: '54px',
            color: '#ffffff',
            fontStyle: '900',
            stroke: '#f0a500',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Panel grows to hold the name row: every control must live INSIDE it.
        UI.panel(this, {
            x: 640, y: 344, w: 800, h: 452, radius: 24,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: 0x4a6a8a, borderWidth: 2
        });

        this.rows = [];

        this.addToggleRow(184, 'Screen Shake', 'gdShake', 'Shake the screen when you hit the ball');
        this.addToggleRow(266, 'Particles', 'gdParticles', 'Ball trail and explosion effects');
        this.addToggleRow(348, 'Always Show Hitbox', 'gdHitboxAlways', 'Show the clickable area even when not clickable');
        this.addToggleRow(430, 'Sound', 'gdMuted', 'Mute or unmute all game sounds', true);

        /* ---------------- player name ---------------- */
        // Inside the panel, above the BACK button. Changing it re-opens the same
        // prompt used on first launch, so name validation lives in one place.
        const currentName = window.GDPlayer ? window.GDPlayer.getName() : 'PLAYER';
        this.add.text(640, 500, 'PLAYER NAME', {
            fontSize: '15px', color: '#8fa6bd', fontStyle: '800'
        }).setOrigin(0.5);

        UI.button(this, {
            x: 640, y: 532, w: 320, h: 46,
            label: currentName, textSize: 19,
            fillTop: 0x4a90c4, fillBottom: 0x2f6b9c, radius: 14,
            onClick: () => this.scene.start('NamePromptScene', {
                next: 'SettingsScene', current: currentName
            })
        });

        // Back button, clear of the panel edge (panel bottom is y=570)
        UI.button(this, {
            x: 640, y: 626, w: 220, h: 62,
            label: 'BACK',
            textSize: 24,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59,
            radius: 16,
            onClick: () => this.scene.start('MenuScene')
        });

        this.createMuteButton();
    }

    // inverted: for sound, "on" in the UI means unmuted
    addToggleRow(y, label, key, description, inverted) {
        // Row background
        const rowBg = UI.panel(this, {
            x: 640, y: y, w: 720, h: 76, radius: 14,
            fillTop: 0x2a3b52, fillBottom: 0x1b2836,
            border: 0x3d5a73, borderWidth: 1
        });

        this.add.text(320, y - 12, label, {
            fontSize: '23px',
            color: '#ffffff',
            fontStyle: '800'
        }).setOrigin(0, 0.5);

        this.add.text(320, y + 15, description, {
            fontSize: '14px',
            color: '#93a8bd',
            fontStyle: '600'
        }).setOrigin(0, 0.5);

        const state = this.getDisplayState(key, inverted);

        // Pill-shaped switch
        const trackW = 92, trackH = 42, trackX = 920;
        const g = this.add.graphics();
        function paintTrack(on) {
            g.clear();
            g.fillStyle(0x000000, 0.3);
            g.fillRoundedRect(trackX - trackW / 2, y - trackH / 2 + 3, trackW, trackH, trackH / 2);
            g.fillStyle(on ? 0x17a34a : 0x3a4653, 1);
            g.fillRoundedRect(trackX - trackW / 2, y - trackH / 2, trackW, trackH, trackH / 2);
            g.lineStyle(2, on ? 0x3ddc6b : 0x55636f, 1);
            g.strokeRoundedRect(trackX - trackW / 2, y - trackH / 2, trackW, trackH, trackH / 2);
        }
        paintTrack(state);

        const knobX = state ? trackX + trackW / 2 - trackH / 2 + 2 : trackX - trackW / 2 + trackH / 2 - 2;
        const knob = this.add.circle(knobX, y, trackH / 2 - 6, 0xffffff, 1);
        knob.setStrokeStyle(2, 0x000000, 0.15);

        const zone = this.add.zone(trackX, y, trackW + 24, trackH + 20).setOrigin(0.5);
        zone.setInteractive({ useHandCursor: true });

        zone.on('pointerdown', () => {
            const nowOn = this.toggleValue(key, inverted);
            paintTrack(nowOn);
            this.tweens.add({
                targets: knob,
                x: nowOn ? (trackX + trackW / 2 - trackH / 2 + 2) : (trackX - trackW / 2 + trackH / 2 - 2),
                duration: 140,
                ease: 'Back.easeOut'
            });
            if (key === 'gdMuted' && window.gdSyncSound) window.gdSyncSound();
        });

        this.rows.push({ key: key, track: g, knob: knob, inverted: !!inverted });
    }

    getDisplayState(key, inverted) {
        const raw = window.Settings.isOn(key);
        return inverted ? !raw : raw;
    }

    toggleValue(key, inverted) {
        window.Settings.toggle(key);
        return this.getDisplayState(key, inverted);
    }

    createMuteButton() {
        const isMuted = window.Settings.isOn('gdMuted');
        const muteButton = this.add.image(1230, 30, window.Settings.isOn('gdMuted') ? 'volume-mute' : 'volume-unmute');
        muteButton.setScale(0.08);
        muteButton.setInteractive();

        muteButton.on('pointerover', () => { muteButton.setScale(0.1); });
        muteButton.on('pointerout', () => { muteButton.setScale(0.08); });
        muteButton.on('pointerdown', () => {
            window.Settings.toggle('gdMuted');
            muteButton.setTexture(window.Settings.isOn('gdMuted') ? 'volume-mute' : 'volume-unmute');
            if (window.gdSyncSound) window.gdSyncSound();
        });
    }
}
