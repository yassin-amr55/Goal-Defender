/* LeaderboardScene — Part 6.
 *
 * Two tabs: HIGH SCORE and TROPHIES, scrollable when the list overflows.
 *
 * Data comes from window.GDPlayer.fetchBoard(). That returns [] when Firebase
 * is not configured or the network fails, and this scene shows a clear
 * "not available" message in that case rather than an empty box that looks
 * like a bug. Nothing here blocks: the menu never waits on this scene.
 */
class LeaderboardScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LeaderboardScene' });
    }

    init() {
        this.tab = 'highScore';
        this.rows = [];
        this.scroll = 0;
        this.loading = false;
        this.status = 'loading';
    }

    create() {
        const cx = 640;

        if (this.textures.exists('background')) {
            const bg = this.add.image(cx, 0, 'background');
            bg.setOrigin(0.5, 0);
            bg.setDisplaySize(1280, 620);
            bg.setAlpha(0.6);
        } else {
            this.cameras.main.setBackgroundColor('#1a1a1a');
        }

        this.add.rectangle(cx, 360, 1280, 720, 0x000000, 0.62);

        this.add.text(cx, 74, 'LEADERBOARD', {
            fontSize: '46px', color: '#000000', fontStyle: '900', alpha: 0.45
        }).setOrigin(0.5);

        this.add.text(cx, 70, 'LEADERBOARD', {
            fontSize: '46px', color: '#ffffff', fontStyle: '900',
            stroke: '#f0a500', strokeThickness: 6
        }).setOrigin(0.5);

        /* ---- tabs ---- */
        this.tabLayer = this.add.container(0, 0);
        this.tabLayer.add(UI.button(this, {
            x: cx - 180, y: 132, w: 330, h: 58,
            label: 'HIGH SCORE', textSize: 22,
            fillTop: 0x4a90c4, fillBottom: 0x2f6b9c, radius: 16,
            onClick: () => this.setTab('highScore')
        }));
        this.tabLayer.add(UI.button(this, {
            x: cx + 180, y: 132, w: 330, h: 58,
            label: 'TROPHIES', textSize: 22,
            fillTop: 0x4a90c4, fillBottom: 0x2f6b9c, radius: 16,
            onClick: () => this.setTab('trophies')
        }));
        this.paintTabs();

        /* ---- panel ---- */
        this.panelLayer = this.add.container(0, 0);
        this.panelLayer.add(UI.panel(this, {
            x: cx, y: 400, w: 860, h: 400, radius: 24,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: 0x4a6a8a, borderWidth: 2
        }));

        this.listLayer = this.add.container(0, 0);

        this.statusText = this.add.text(cx, 400, 'Loading...', {
            fontSize: '22px', color: '#8fa6bd', fontStyle: '700',
            align: 'center', wordWrap: { width: 700 }
        }).setOrigin(0.5);

        /* ---- scroll ---- */
        // Panel is y=400 h=400, so it spans 200..600. Rows must stay inside that:
        // the old 232..570 range let the last row's text overrun the border.
        this.listTop = 238;
        this.listBottom = 566;
        this.rowInset = 64;   // keeps rank/text clear of the panel border
        this.pointerDown = false;
        this.dragStart = 0;
        this.scrollStart = 0;
        this.moved = false;

        this.input.on('pointerdown', (p) => {
            if (p.y < this.listTop || p.y > this.listBottom) return;
            this.pointerDown = true;
            this.dragStart = p.y;
            this.scrollStart = this.scroll;
            this.moved = false;
        });
        this.input.on('pointermove', (p) => {
            if (!this.pointerDown) return;
            const d = p.y - this.dragStart;
            if (Math.abs(d) > 6) this.moved = true;
            // Drag: finger down (d > 0) reveals earlier entries, so the offset falls.
            this.scroll = this.clampScroll(this.scrollStart - d);
        });
        this.input.on('pointerup', () => { this.pointerDown = false; });

        // Wheel support for desktop. dy > 0 means "scroll down", which should move
        // toward LATER entries, i.e. increase the offset. This was inverted,
        // so wheeling down scrolled up and vice versa.
        this.input.on('wheel', (p, objs, dx, dy) => {
            this.scroll = this.clampScroll(this.scroll + (dy > 0 ? 40 : -40));
        });

        this.maxScroll = 0;

        /* ---- nav ---- */
        UI.button(this, {
            x: cx, y: 648, w: 220, h: 60,
            label: 'BACK', textSize: 22,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59, radius: 16,
            onClick: () => this.scene.start('MenuScene')
        });

        this.events.on('shutdown', () => {
            this.input.keyboard.removeAllKeys(true);
        });

        this.loadBoard();
    }

    setTab(tab) {
        if (this.tab === tab) return;
        this.tab = tab;
        this.scroll = 0;
        this.paintTabs();
        this.loadBoard();
    }

    paintTabs() {
        this.tabLayer.list.forEach((btn) => {
            const on = btn.gdLabel && btn.gdLabel.text === (this.tab === 'highScore' ? 'HIGH SCORE' : 'TROPHIES');
            btn.gdSetFill(on ? 0xffb340 : 0x4a90c4,
                on ? 0xf08a1d : 0x2f6b9c,
                on ? 0xffc766 : 0x5aa9e6);
        });
    }

    // Named loadBoard, not load: `load` is Phaser's own asset loader on a Scene
    // and shadowing it broke scene creation with "this.load is not a function".
    loadBoard() {
        this.loading = true;
        this.status = 'loading';
        this.statusText.setText('Loading...').setVisible(true);
        this.listLayer.removeAll(true);

        const self = this;
        window.GDPlayer.fetchBoard(this.tab).then((rows) => {
            // The scene may have been closed while the read was in flight.
            if (!self.scene || !self.scene.isActive()) return;
            self.loading = false;
            self.rows = Array.isArray(rows) ? rows : [];
            self.render();
        });
    }

    rowHeight() { return 52; }

    /* Is this row the signed-in player?
     *
     * fetchBoard() does not return document ids, so identity is matched on the
     * name the board publishes. When an account is signed in that name is the
     * account username (player.js boardName()), which is unique per account, so
     * this cannot highlight somebody else's row. Signed out, there is no "me"
     * to mark - an anonymous row is shared by every player without an account. */
    isMine(row) {
        if (!window.GDAccount || !window.GDAccount.isSignedIn()) return false;
        var mine = window.GDAccount.username();
        if (!mine) return false;
        return row && row.name === mine;
    }

    render() {
        this.listLayer.removeAll(true);

        const cx = 640;

        if (!this.rows.length) {
            this.status = this.rows.length ? 'ok' : 'empty';
            this.statusText.setText(
                window.GDPlayer.isConfigured()
                    ? 'No scores yet.\nBe the first - go play a run!'
                    : 'Leaderboard is not available yet.'
            ).setVisible(true);
            this.maxScroll = 0;
            return;
        }

        this.statusText.setVisible(false);

        const rowH = this.rowHeight();

        this.rows.forEach((row, i) => {
            // Content moves UP as scroll increases, so the offset is subtracted.
            // Adding it here pushed every row below the panel when scrolled to
            // the end, leaving the last players invisible.
            const y = this.listTop + rowH * i - this.scroll + 26;
            // Cull anything outside the panel so scrolling stays cheap.
            if (y < this.listTop - 30 || y > this.listBottom + 30) return;

            const container = this.add.container(0, 0);

            const rankColor = i === 0 ? '#ffd700' : i === 1 ? '#c0c8d0' : i === 2 ? '#cd7f32' : '#8fa6bd';
            container.add(this.add.text(268, y, String(i + 1), {
                fontSize: '24px', color: rankColor,
                fontFamily: UI.FAMILY, fontStyle: '900'
            }).setOrigin(0.5));

            container.add(this.add.text(308, y, row.name || 'PLAYER', {
                fontSize: '24px', color: '#ffffff',
                fontFamily: UI.FAMILY, fontStyle: '800'
            }).setOrigin(0, 0.5));

            const value = this.tab === 'highScore' ? row.highScore : row.trophies;
            const suffix = this.tab === 'highScore' ? '' : (row.trophies === 1 ? ' trophy' : ' trophies');
            // Right-aligned value. The panel's inner edge is x=1070, so the anchor sits
        // inside it - at 1076 the text overhung the border.
        container.add(this.add.text(1054, y, window.Achievements.fmt(value) + suffix, {
                fontSize: '24px', color: '#ffd45e',
                fontFamily: UI.FAMILY, fontStyle: '900'
            }).setOrigin(1, 0.5));

            /* Mark the signed-in player's own row.
             *
             * With no highlight there was no way to find yourself on a board of
             * near-identical rows - and while old anonymous rows shared a name
             * with an account row, the duplicate was impossible to tell apart.
             * The tint sits under the text and a "YOU" tag sits in the gap
             * between the rank and the name, so nothing moves. */
            if (this.isMine(row, i)) {
                container.addAt(this.add.rectangle(
                    640, y, 860 - this.rowInset * 2, rowH - 6, 0x3ddc6b, 0.13), 0);
                container.add(this.add.text(300, y, 'YOU', {
                    fontSize: '13px', color: '#3ddc6b',
                    fontFamily: UI.FAMILY, fontStyle: '900'
                }).setOrigin(0.5));
            } else if (i % 2 === 0) {
                // Zebra stripe spans the inner panel only, never the border.
                container.addAt(this.add.rectangle(
                    640, y, 860 - this.rowInset * 2, rowH - 6, 0xffffff, 0.04), 0);
            }

            this.listLayer.add(container);
        });

        // Content height plus the top/bottom padding the first and last rows need.
        const total = this.rows.length * rowH + 52;
        const visible = this.listBottom - this.listTop;
        this.maxScroll = Math.max(0, total - visible);
        this.scroll = this.clampScroll(this.scroll);
    }

    clampScroll(v) {
        return Math.max(0, Math.min(this.maxScroll || 0, v));
    }

    update() {
        if (this.rows.length && this.listLayer.list.length) {
            this.render();
        }
    }
}