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

        /* The player name row only exists when signed OUT, so the content is a
         * different length depending on the sign-in state.
         *
         * The panel is now a FIXED viewport with the rows inside it clipped and
         * scrollable, instead of being sized to its contents. Sizing the panel
         * to the content meant every new setting made the page taller: with the
         * Ball Trail toggle added, the BACK button sat at y=700 with height 56
         * and ran to 728 - eight pixels past the bottom of the 720px canvas, so
         * it was genuinely unreachable on any device. Height now costs nothing
         * because the content scrolls. */
        const account = window.GDAccount;
        const signedIn = !!(account && account.isSignedIn());
        const showNameRow = !signedIn;

        /* Fixed panel and a fixed content viewport inside it.
         *
         * 128..692 on a 720px canvas: 128px of headroom under the title, 28px
         * of footroom at the bottom.
         *
         * The top 72px of the panel is a header band reserved for the close
         * button, which now lives INSIDE the box rather than out in the corner
         * beside the mute icon. Reserving the band as fixed panel space - rather
         * than letting the rows start wherever they happen to fit - is what
         * guarantees the X can never collide with the first toggle. */
        const PANEL_TOP = 128;
        const PANEL_BOTTOM = 692;
        const PANEL_X = 240, PANEL_W = 800;

        // The scrollable region: below the header band, above the bottom pad.
        const VIEW_TOP = 200;
        const VIEW_BOTTOM = 672;
        const viewH = VIEW_BOTTOM - VIEW_TOP;
        const viewY = (VIEW_TOP + VIEW_BOTTOM) / 2;

        UI.panel(this, {
            x: 640, y: (PANEL_TOP + PANEL_BOTTOM) / 2, w: PANEL_W,
            h: PANEL_BOTTOM - PANEL_TOP, radius: 24,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: 0x4a6a8a, borderWidth: 2
        });

        /* Everything scrollable lives in one container so it can be moved as a
         * unit and clipped by the panel. */
        this.content = this.add.container(0, 0);
        this.rows = [];

        this.addToggleRow(236, 'Screen Shake', 'gdShake', 'Shake the screen when you hit the ball');
        this.addToggleRow(308, 'Particles', 'gdParticles', 'Explosion effect when you hit the ball');
        this.addToggleRow(380, 'Ball Trail', 'gdBallTrail', 'Streak that follows the ball');
        this.addToggleRow(452, 'Always Show Hitbox', 'gdHitboxAlways', 'Show the clickable area even when not clickable');
        this.addToggleRow(524, 'Sound', 'gdMuted', 'Mute or unmute all game sounds', true);

        /* ---------------- player name ----------------
         * Hidden while signed in: the account owns the name then, and it is
         * changed from the account page (throttled to once a week). */
        if (showNameRow) {
            const currentName = window.GDPlayer ? window.GDPlayer.getName() : 'PLAYER';
            this.content.add(this.add.text(640, 582, 'PLAYER NAME', {
                fontSize: '15px', color: '#8fa6bd', fontStyle: '800'
            }).setOrigin(0.5));

            this.content.add(UI.button(this, {
                x: 640, y: 620, w: 320, h: 46,
                label: currentName, textSize: 19,
                fillTop: 0x4a90c4, fillBottom: 0x2f6b9c, radius: 14,
                onClick: () => this.scene.start('NamePromptScene', {
                    next: 'SettingsScene', current: currentName
                })
            }));
        }

        /* Clip the content to the panel.
         *
         * Without this the rows are drawn straight over the border and over the
         * background, so scrolling them would reveal them outside the box. */
        const maskG = this.make.graphics({ x: 0, y: 0 }, false);
        maskG.fillStyle(0xffffff);
        maskG.fillRoundedRect(PANEL_X, VIEW_TOP, PANEL_W, viewH, 18);
        this.content.setMask(maskG.createGeometryMask());
        this.viewMask = maskG;

        this.viewTop = VIEW_TOP;
        this.viewH = viewH;
        this.viewLeft = PANEL_X;
        this.viewWidth = PANEL_W;

        this.scroll = 0;
        this.maxScroll = 0;
        this.dragMoved = false;
        this.measureContent(showNameRow);
        this.installScroll();

        this.createMuteButton();
        this.createCloseButton();
    }

    /** Is this point inside the scrollable region? */
    inView(p) {
        return p.x >= this.viewLeft && p.x <= this.viewLeft + this.viewWidth &&
            p.y >= this.viewTop && p.y <= this.viewTop + this.viewH;
    }

    /** How tall the content is, so scrolling can be clamped to it. */
    measureContent(showNameRow) {
        let bottom = 0;
        this.rows.forEach(r => { if (r.y + 33 > bottom) bottom = r.y + 33; });
        if (showNameRow) bottom = Math.max(bottom, 620 + 23);
        const top = this.rows.length ? this.rows[0].y - 33 : 0;
        this.contentHeight = bottom - top;
        this.contentTop = top;
        this.maxScroll = Math.max(0, this.contentHeight - this.viewH);

        /* Centre the list when it fits.
         *
         * The viewport is a fixed size so that adding a setting can never push
         * a control off the page. But a fixed viewport also means the signed-in
         * build - which has no player-name row - leaves an empty band at the
         * bottom that reads as a mistake rather than as breathing room. Centring
         * when there is spare height turns that band into deliberate padding,
         * and costs nothing once the list outgrows the viewport and scrolls.
         *
         * `contentTop` is subtracted because the rows are authored in ABSOLUTE
         * coordinates (row 1 at y=236, not y=36). Container children keep their
         * own coords and the container's transform is added on top, so the
         * container must only ever be offset by the amount the list needs to
         * move - never by viewTop as well.
         *
         * Doing both pushed every row down by contentTop: 203px. The list fell
         * out of the panel, the top half of the box was empty, and the bottom
         * rows were clipped away. */
        this.baseOffset = this.maxScroll > 0 ? 0
            : (this.viewTop + (this.viewH - this.contentHeight) / 2) - this.contentTop;
        this.applyScroll();
    }

    applyScroll() {
        this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll));
        this.content.y = this.baseOffset - this.scroll;
        if (this.scrollBar) {
            const pad = 12;
            const trackTop = this.viewTop + pad;
            const trackH = this.viewH - pad * 2;
            const frac = this.contentHeight > this.viewH
                ? this.viewH / this.contentHeight : 1;
            const barH = Math.max(40, trackH * frac);
            const travel = trackH - barH;
            const t = this.maxScroll > 0 ? this.scroll / this.maxScroll : 0;
            this.scrollBar.clear();
            if (this.maxScroll > 0) {
                this.scrollBar.fillStyle(0x8fa6bd, 0.55);
                this.scrollBar.fillRoundedRect(
                    this.viewLeft + this.viewWidth - 16, trackTop + travel * t, 6, barH, 3);
            }
        }
    }

    /**
     * Drag and wheel scrolling.
     *
     * These are listeners on the InputPlugin itself, not on a catch-all Zone
     * covering the panel.
     *
     * A full-panel Zone would have to share hit priority with the switch zones
     * inside it, and which object wins is decided by depth alone - a zone the
     * same depth as a switch could shadow it and swallow taps on it. Listening
     * on the plugin sidesteps the question entirely: those events fire once per
     * physical pointer event regardless of what is underneath, so bounds
     * checking against the viewport gives the drag surface without ever
     * competing with the switches.
     */
    installScroll() {
        let startY = 0, startScroll = 0, lastY = 0, velocity = 0, tracking = false;

        this.input.on('pointerdown', (p) => {
            if (!this.inView(p)) return;
            tracking = true;
            startY = p.y; lastY = p.y; startScroll = this.scroll;
            this.dragMoved = false; velocity = 0;
        });

        this.input.on('pointermove', (p) => {
            if (!tracking || !p.isDown) return;
            const dy = p.y - startY;
            if (Math.abs(dy) > 6) this.dragMoved = true;
            velocity = p.y - lastY;
            lastY = p.y;
            this.scroll = startScroll - dy;
            this.applyScroll();
        });

        const release = () => {
            if (!tracking) return;
            tracking = false;
            // A short flick keeps going, then eases to a stop.
            if (Math.abs(velocity) > 6 && this.maxScroll > 0) {
                this.tweens.killTweensOf(this);
                /* Sign matters: velocity is negative while the pointer travels UP,
                 * and travelling up must INCREASE scroll so the list follows the
                 * finger. Adding velocity*8 instead threw the content the
                 * opposite way - a 160px upward flick ended with the list snapped
                 * all the way back to the top. */
                const glide = -velocity * 8;
                this.tweens.add({
                    targets: this,
                    scroll: this.scroll + glide,
                    duration: 260,
                    ease: 'Quad.easeOut',
                    onUpdate: () => this.applyScroll()
                });
            }
        };
        this.input.on('pointerup', release);
        this.input.on('pointerupoutside', release);

        // Desktop wheel, for anyone on a keyboard.
        this.input.on('wheel', (pointer, objs, dx, dy) => {
            if (!this.inView(pointer)) return;
            this.scroll += dy * 0.6;
            this.applyScroll();
        });

        // Scroll indicator, only when there is something to scroll.
        this.scrollBar = this.add.graphics();
        this.scrollBar.setDepth(40);
        this.applyScroll();
    }

    /** Red X inside the panel's top-right corner.
     *
     * It lives in the reserved header band, 36px in from the panel's right edge
     * and centred in the band, so it is inside the box and cannot touch the
     * first toggle. Red because it is the only control on the page that throws
     * away what you did, and it is the one people hunt for.
     *
     * Drawn with Graphics rather than a text glyph: the game uses no emoji, and
     * there is no close icon asset to load. */
    createCloseButton() {
        const cx = this.viewLeft + this.viewWidth - 36;
        const cy = this.viewTop - 36;
        const r = 24;
        const g = this.add.graphics();
        g.setDepth(60);

        const paint = (hover) => {
            g.clear();
            g.fillStyle(hover ? 0xd6332c : 0xb3261e, 1);
            g.fillCircle(cx, cy, r);
            g.lineStyle(2, hover ? 0xff8a80 : 0xff5545, 1);
            g.strokeCircle(cx, cy, r);
            const arm = r * 0.44;
            g.lineStyle(3.5, 0xffffff, 1);
            g.beginPath();
            g.moveTo(cx - arm, cy - arm); g.lineTo(cx + arm, cy + arm);
            g.moveTo(cx + arm, cy - arm); g.lineTo(cx - arm, cy + arm);
            g.strokePath();
        };
        paint(false);

        const hit = this.add.zone(cx, cy, r * 2 + 8, r * 2 + 8).setOrigin(0.5);
        hit.setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => paint(true));
        hit.on('pointerout', () => paint(false));
        hit.on('pointerdown', () => this.scene.start('MenuScene'));
    }

    // inverted: for sound, "on" in the UI means unmuted
    addToggleRow(y, label, key, description, inverted) {
        // Row background
        this.content.add(UI.panel(this, {
            x: 640, y: y, w: 720, h: 66, radius: 14,
            fillTop: 0x2a3b52, fillBottom: 0x1b2836,
            border: 0x3d5a73, borderWidth: 1
        }));

        this.content.add(this.add.text(320, y - 11, label, {
            fontSize: '23px',
            color: '#ffffff',
            fontStyle: '800'
        }).setOrigin(0, 0.5));

        this.content.add(this.add.text(320, y + 13, description, {
            fontSize: '14px',
            color: '#93a8bd',
            fontStyle: '600'
        }).setOrigin(0, 0.5));

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
        this.content.add(g);

        const knobX = state ? trackX + trackW / 2 - trackH / 2 + 2 : trackX - trackW / 2 + trackH / 2 - 2;
        const knob = this.add.circle(knobX, y, trackH / 2 - 6, 0xffffff, 1);
        knob.setStrokeStyle(2, 0x000000, 0.15);
        this.content.add(knob);

        const zone = this.add.zone(trackX, y, trackW + 24, trackH + 20).setOrigin(0.5);
        zone.setInteractive({ useHandCursor: true });
        this.content.add(zone);

        /* Act on pointerUP, and only when the pointer did not travel.
         *
         * This used to fire on pointerdown, which is fine when nothing else
         * shares the panel. Now that the panel is a drag-to-scroll surface, a
         * player dragging the list would flip every switch they swiped past. */
        zone.on('pointerup', () => {
            if (this.dragMoved) return;
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

        this.rows.push({ key: key, track: g, knob: knob, inverted: !!inverted, y: y });
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
