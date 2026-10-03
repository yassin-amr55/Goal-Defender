/* AchievementsScene.js - the achievement list.
 *
 * Paginated rather than scrolled: a fixed grid is easier to hit on a phone and
 * avoids drag/scroll fighting with the game's own pointer input.
 */
class AchievementsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AchievementsScene' });
    }

    init() {
        this.page = 0;
    }

    create() {
        this.perPage = 10;

        if (this.textures.exists('background')) {
            this.add.image(640, 0, 'background')
                .setOrigin(0.5, 0)
                .setDisplaySize(1280, 620)
                .setAlpha(0.6);
        } else {
            this.cameras.main.setBackgroundColor('#101c2a');
        }

        /* ---------------- header ---------------- */

        UI.title(this, {
            text: 'ACHIEVEMENTS', x: 640, y: 40,
            size: UI.TYPE.title + 8, fill: '#ffffff'
        });

        const total = Achievements.LIST.length;
        const done = Achievements.unlockedCount();

        /* S6: this is the single most useful number on the page and it was 18px
         * muted grey - the same weight as the balance line below it. It is now
         * lead size, with the fraction in white and the total behind it, and it
         * carries a slim progress rail so the collection reads as a collection. */
        this.unlockedLabel = this.add.text(640, 84, '', {
            fontSize: UI.TYPE.lead + 'px', color: '#ffffff', fontStyle: '900'
        }).setOrigin(0.5);

        this.add.rectangle(640, 110, 320, 5, 0x1b2836, 1).setOrigin(0.5);
        this.unlockedBar = this.add.rectangle(480, 110, 0, 5, 0x3ddc6b, 1).setOrigin(0, 0.5);

        /* ---------------- lifetime deflections, shown on top ---------------- */

        /* S5: this panel had a GREEN border, but green means "on" for every toggle
         * in the game. A lifetime statistic is not a toggle, so the green was
         * borrowing a meaning it does not have. The border is now neutral and the
         * value keeps the green. */
        /* Header stack, top to bottom: title 40, count 84, rail 110, stat panel
         * 117..179, money line 189..203, first card row starts at 210.
         *
         * The money line was at 214, which is INSIDE the first card row (cards are
         * centred at 246 with a height of 72, so they span 210..282). It was being
         * drawn underneath the grid and was only visible in the 7px gap between
         * the two columns - it read as a stray fragment. */
        UI.panel(this, {
            x: 640, y: 148, w: 520, h: 62, radius: 16,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: 0x4a6a8a, borderWidth: 2
        });

        this.add.text(500, 148, 'LIFETIME DEFLECTIONS', {
            fontSize: UI.TYPE.small + 'px', color: '#8fa6bd', fontStyle: '800'
        }).setOrigin(0.5, 0.5);

        this.add.text(800, 148, Achievements.fmt(Achievements.current('deflections')), {
            fontSize: UI.TYPE.lead + 'px', color: '#3ddc6b', fontStyle: '900'
        }).setOrigin(0.5, 0.5);

        this.totalMoneyLabel = this.add.text(640, 196, '', {
            fontSize: UI.TYPE.small + 'px', color: '#ffd45e', fontStyle: '800'
        }).setOrigin(0.5);

        this.refreshHeader();

        /* ---------------- navigation ----------------
         * Created before the first renderPage() because the page buttons
         * enable/disable themselves depending on the current page. */

        /* M2: shared red X instead of a bottom-left BACK, so the bottom row is
         * just PREV / PAGE / NEXT / CLAIM ALL on one line. */
        UI.closeButton(this, {
            x: UI.CLOSE_X, y: UI.CLOSE_Y, r: 22,
            onClick: () => this.scene.start('MenuScene')
        });

        this.prevBtn = UI.button(this, {
            x: 470, y: 660, w: 130, h: 56,
            label: 'PREV',
            textSize: UI.TYPE.body,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59,
            radius: 14,
            onClick: () => this.changePage(-1)
        });

        this.nextBtn = UI.button(this, {
            x: 810, y: 660, w: 130, h: 56,
            label: 'NEXT',
            textSize: UI.TYPE.body,
            fillTop: 0x4a90c4, fillBottom: 0x2f6b9c,
            radius: 14,
            onClick: () => this.changePage(1)
        });

        this.pageLabel = this.add.text(640, 660, '', {
            fontSize: UI.TYPE.small + 'px', color: '#9fb3c8', fontStyle: '800'
        }).setOrigin(0.5);

        // Only visible while there is something to collect.
        // Sits in the bottom nav row, clear of the card grid above it.
        this.claimAllBtn = UI.button(this, {
            x: 1080, y: 660, w: 260, h: 56,
            label: 'CLAIM ALL',
            textSize: UI.TYPE.body,
            fillTop: 0xffd45e, fillBottom: 0xc98a08,
            textColor: 0x1a1a1a,
            radius: 14,
            onClick: () => {
                const total = Achievements.claimAll();
                if (total) {
                    this.refreshHeader();
                    this.renderPage();
                }
            }
        });
        this.claimAllBtn.setVisible(false);

        /* ---------------- grid ---------------- */

        this.gridLayer = this.add.container(0, 0);
        this.renderPage();

        UI.topRight(this, {});
    }

    refreshHeader() {
        const money = Achievements.current('money');
        const pending = Achievements.unclaimedTotal();
        let msg = 'Balance $' + Achievements.fmt(money) +
            '   -   Claimed $' + Achievements.fmt(Achievements.claimedTotal());
        if (pending > 0) {
            msg += '   -   UNCLAIMED $' + Achievements.fmt(pending);
        }
        this.totalMoneyLabel.setText(msg);

        /* S6: the "N of M unlocked" line and its rail.
         *
         * These are created in create() but were never refreshed, so claiming an
         * achievement left the count stale for the rest of the session - the one
         * number on the page that is supposed to move when you act. */
        const total = Achievements.LIST.length;
        const done = Achievements.unlockedCount();
        if (this.unlockedLabel) {
            this.unlockedLabel.setText(done + ' of ' + total + ' unlocked');
        }
        if (this.unlockedBar) {
            const railW = 320;
            this.unlockedBar.width = total > 0 ? Math.max(2, railW * (done / total)) : 0;
        }
    }

    get pageCount() {
        return Math.max(1, Math.ceil(Achievements.LIST.length / this.perPage));
    }

    changePage(delta) {
        const next = this.page + delta;
        if (next < 0 || next >= this.pageCount) return;
        this.page = next;
        this.renderPage();
    }

    renderPage() {
        // Clear the previous grid
        this.gridLayer.removeAll(true);

        const start = this.page * this.perPage;
        const items = Achievements.LIST.slice(start, start + this.perPage);

        const colX = [348, 932];
        const rowY = [246, 328, 410, 492, 574];
        const cardW = 556;
        const cardH = 72;

        items.forEach((ach, i) => {
            const x = colX[i % 2];
            const y = rowY[Math.floor(i / 2)];
            this.gridLayer.add(this.buildCard(ach, x, y, cardW, cardH));
        });

        // Page indicator between PREV and NEXT (dots used to sit here and
        // collided with the last row of cards)
        this.pageLabel.setText('PAGE ' + (this.page + 1) + ' / ' + this.pageCount);

        // Collect-all button, with the pending total on its face
        const pending = Achievements.unclaimedTotal();
        this.claimAllBtn.setVisible(pending > 0);
        if (pending > 0) {
            this.claimAllBtn.gdSetLabel('CLAIM ALL $' + Achievements.fmt(pending));
        }

        const multi = this.pageCount > 1;
        this.prevBtn.setVisible(multi);
        this.nextBtn.setVisible(multi);
        if (multi) {
            const canPrev = this.page > 0;
            const canNext = this.page < this.pageCount - 1;
            this.prevBtn.gdSetFill(canPrev ? 0x5a6b7d : 0x3a4652, canPrev ? 0x3d4b59 : 0x2a3440, 0x6b7d90);
            this.nextBtn.gdSetFill(canNext ? 0x4a90c4 : 0x3a4652, canNext ? 0x2f6b9c : 0x2a3440, 0x5aa9e6);
        }
    }

    buildCard(ach, x, y, w, h) {
        const box = this.add.container(0, 0);
        const unlocked = Achievements.isUnlocked(ach.id);
        const claimable = Achievements.isClaimable(ach.id);
        const prog = Achievements.progress(ach);

        // Card
        box.add(UI.panel(this, {
            x: x, y: y, w: w, h: h, radius: 14,
            fillTop: claimable ? 0x1f4030 : (unlocked ? 0x1e3a2c : 0x1c2b3a),
            fillBottom: claimable ? 0x13261c : (unlocked ? 0x12211a : 0x111c27),
            border: claimable ? 0xffd45e : (unlocked ? 0x3ddc6b : 0x3d5a73),
            borderWidth: 2
        }));

        // Medal / lock marker
        if (this.textures.exists('medal-icon')) {
            const icon = this.add.image(x - w / 2 + 38, y, 'medal-icon');
            icon.setScale(0.26);
            if (!unlocked) icon.setTint(0x5a6b7d).setAlpha(0.5);
            box.add(icon);
        }

        /* Name */
        box.add(this.add.text(x - w / 2 + 74, y - 22, ach.name, {
            fontSize: UI.TYPE.body + 'px',
            color: unlocked ? '#ffffff' : '#c3d3e2',
            fontStyle: '900'
        }).setOrigin(0, 0.5));

        /* S4: the description is the reason a player looks up what they still need,
         * and it was 13px while everything around it was 19px. Raised to 14px.
         *
         * This card previously used FOUR sizes - 19 / 13 / 11 / 10 - which is the
         * clearest example of the missing type scale in the game: three of them
         * were below the 13px floor, and 10px renders at roughly 5px on a small
         * Android (F-13). Now two sizes: body for the name, small for everything
         * else. */
        box.add(this.add.text(x - w / 2 + 74, y + 1, ach.desc, {
            fontSize: UI.TYPE.small + 'px',
            color: unlocked ? '#a9d8bb' : '#93a8bd',
            fontStyle: '600'
        }).setOrigin(0, 0.5));

        /* Progress bar, kept clear of the right-hand claim column. */
        const barW = w - 234;
        const barX = x - w / 2 + 74;
        const barY = y + 13;
        box.add(this.add.rectangle(barX, barY, barW, 6, 0x0d1723, 1).setOrigin(0, 0.5));
        if (unlocked) {
            /* M10: a completed achievement used to draw a FULL GREEN BAR, which
             * to anyone not reading the caption looks exactly like "in progress".
             * It is now solid gold, so "done" reads as done.
             *
             * There is deliberately no word inside the bar: it is 6px tall and
             * any readable label is 12px or more, so the text overflowed its own
             * track. Completion is already stated twice - by the gold colour and
             * by the CLAIMED tag in the right-hand column. */
            box.add(this.add.rectangle(barX, barY, barW, 6, 0xf0b429, 1).setOrigin(0, 0.5));
        } else if (prog.pct > 0) {
            box.add(this.add.rectangle(barX, barY, barW * prog.pct, 6, 0x4a90c4, 1).setOrigin(0, 0.5));
        }

        /* M10: the footer under the bar is ALWAYS the progress numbers.
         *
         * It used to switch meaning with state - "READY TO CLAIM", then
         * "CLAIMED", then "381 / 500" - while the right-hand column ALSO said
         * CLAIMED. So a claimed card printed the word CLAIMED twice and carried
         * no numbers at all. One line, one meaning. */
        /* y+27, not y+30: a 14px label is 17px tall, so y+30 ran to y+37 and
         * overhung the 72px card (which ends at y+36). */
        const progText = Achievements.fmt(prog.current) + ' / ' + Achievements.fmt(prog.goal);
        box.add(this.add.text(x - w / 2 + 74, y + 27, progText, {
            fontSize: UI.TYPE.small + 'px',
            color: unlocked ? '#c9a24a' : '#93a8bd',
            fontStyle: '800'
        }).setOrigin(0, 0.5));

        /* ---- right-hand column ---- */
        if (claimable) {
            box.add(UI.button(this, {
                x: x + w / 2 - 82, y: y, w: 140, h: 46,
                label: 'CLAIM $' + Achievements.fmt(ach.reward),
                textSize: UI.TYPE.small,
                fillTop: 0xffd45e, fillBottom: 0xc98a08,
                textColor: 0x1a1a1a,
                radius: 12,
                onClick: () => this.doClaim(ach)
            }));
        } else {
            box.add(this.add.text(x + w / 2 - 16, y - 8, '+$' + Achievements.fmt(ach.reward), {
                fontSize: UI.TYPE.body + 'px',
                color: unlocked ? '#ffd45e' : '#9fb3c8',
                fontStyle: '900'
            }).setOrigin(1, 0.5));

            /* The ONLY status word on the card. 13px, not 10px. */
            box.add(this.add.text(x + w / 2 - 16, y + 12,
                unlocked ? 'CLAIMED' : ach.cat.toUpperCase(), {
                fontSize: '13px',
                color: unlocked ? '#ffd45e' : '#8fa6bd',
                fontStyle: '800'
            }).setOrigin(1, 0.5));
        }

        return box;
    }

    doClaim(ach) {
        const paid = Achievements.claim(ach.id);
        if (!paid) return;
        this.refreshHeader();
        this.renderPage();
    }
}