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

        UI.title(this, { text: 'LEADERBOARD', x: cx, y: 70, size: UI.TYPE.hero - 8 });

        /* ---- tabs ---- */
        /* A soft scrim behind the tab strip. The tabs sat directly on the
         * stadium floodlights, so the contrast changed across the width of a
         * single button and the text was unreadable over the lit panels. */
        this.add.rectangle(cx, 132, 760, 76, 0x0b1220, 0.35);

        this.tabLayer = this.add.container(0, 0);
        this.tabLayer.add(UI.button(this, {
            x: cx - 180, y: 132, w: 330, h: 58,
            label: 'HIGH SCORE', textSize: UI.TYPE.body,
            fillTop: 0x4a90c4, fillBottom: 0x2f6b9c, radius: 16,
            onClick: () => this.setTab('highScore')
        }));
        this.tabLayer.add(UI.button(this, {
            x: cx + 180, y: 132, w: 330, h: 58,
            label: 'TROPHIES', textSize: UI.TYPE.body,
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
            fontSize: UI.TYPE.body + 'px', color: '#8fa6bd', fontStyle: '700',
            align: 'center', wordWrap: { width: 700 }
        }).setOrigin(0.5);

        /* ---- scroll ---- */
        /* The panel is y=400 h=400, so it spans 200..600.
         *
         * Rows used to be 52 tall and positioned at listTop + 52*i + 26, which put
         * the seventh row's centre at 576. Its background rect is 46 tall, so it
         * ran 553..599 - one pixel from the panel border, and in the screenshot it
         * looked cut in half.
         *
         * listTop is now the centre of the FIRST row rather than the top of the
         * list, rows are 48 tall, and the +26 fudge is gone: row i sits at
         * listTop + 48*i. First row 215..257 (15px under the panel top), last row
         * 503..545 (55px above the panel bottom), and scrolling is driven purely
         * by maxScroll. */
        this.listTop = 236;
        this.listBottom = 560;
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

        /* ---- nav ----
         * M2: the shared red X, so closing is in the same place on every
         * sub-screen. Was a bottom-centre BACK, one of three different close
         * patterns in the game. */
        UI.closeButton(this, { x: UI.CLOSE_X, y: UI.CLOSE_Y, r: 22, onClick: () => this.scene.start('MenuScene') });

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

    rowHeight() { return 48; }

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
            const y = this.listTop + rowH * i - this.scroll;
            // Cull anything outside the panel so scrolling stays cheap.
            if (y < this.listTop - 30 || y > this.listBottom + 30) return;

            const container = this.add.container(0, 0);

            /* Gold / silver / bronze for the podium, then one flat muted tone for
             * every other rank. Previously ranks 4+ shared a colour with the
             * muted name grey, so the number column looked unfinished. */
            const rankColor = i === 0 ? '#ffd700'
                : i === 1 ? '#d7dee6'
                : i === 2 ? '#e0925a'
                : '#6d8298';
            container.add(this.add.text(268, y, String(i + 1), {
                fontSize: UI.TYPE.lead + 'px', color: rankColor,
                fontFamily: UI.FAMILY, fontStyle: '900'
            }).setOrigin(0.5));

            /* My row shows YOU instead of my name; everyone else shows theirs.
             *
             * Drawing the username AND a "YOU" tag meant the player's own row
             * read "YOU yassin" - two labels for one thing, with the tag
             * crowding the name because both sat in the same few pixels.
             * Replacing the name rather than adding to it also means the
             * longest username on the board cannot push into the score column. */
            const mine = this.isMine(row);
            container.add(this.add.text(308, y, mine ? 'YOU' : (row.name || 'PLAYER'), {
                fontSize: UI.TYPE.lead + 'px', color: mine ? '#3ddc6b' : '#ffffff',
                fontFamily: UI.FAMILY, fontStyle: '900'
            }).setOrigin(0, 0.5));

            const value = this.tab === 'highScore' ? row.highScore : row.trophies;
            const suffix = this.tab === 'highScore' ? '' : (row.trophies === 1 ? ' trophy' : ' trophies');
            // Right-aligned value. The panel's inner edge is x=1070, so the anchor sits
        // inside it - at 1076 the text overhung the border.
        container.add(this.add.text(1054, y, window.Achievements.fmt(value) + suffix, {
                fontSize: UI.TYPE.lead + 'px', color: '#ffd45e',
                fontFamily: UI.FAMILY, fontStyle: '900'
            }).setOrigin(1, 0.5));

            /* The player's own row gets a green tint behind it. The name itself already
             * says YOU (above), so there is no second label to collide with the
             * rank number. */
            /* The player's own row gets a green band and a left accent bar.
             *
             * The zebra striping is GONE. It was 4% white on alternate rows, and
             * because it alternated by index rather than by anything meaningful,
             * the green YOU band landed on a striped row roughly half the time and
             * the strongest signal on the screen was the weakest. At 48px rows
             * the separation is not needed anyway - the 24px names do that job. */
            if (mine) {
                container.addAt(this.add.rectangle(
                    640, y, 860 - this.rowInset * 2, rowH - 6, 0x3ddc6b, 0.16), 0);
                const accent = this.add.graphics();
                accent.fillStyle(0x3ddc6b, 1);
                accent.fillRoundedRect(232, y - (rowH - 10) / 2, 5, rowH - 10, 3);
                container.addAt(accent, 1);
            }

            this.listLayer.add(container);
        });

        // Content height plus the top/bottom padding the first and last rows need.
        const total = this.rows.length * rowH + 44;
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