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

        this.add.text(640, 46, 'ACHIEVEMENTS', {
            fontSize: '44px', color: '#ffffff', fontStyle: '900',
            stroke: '#f0a500', strokeThickness: 6
        }).setOrigin(0.5);

        const total = Achievements.LIST.length;
        const done = Achievements.unlockedCount();

        this.add.text(640, 92, done + ' of ' + total + ' unlocked', {
            fontSize: '18px', color: '#9fb3c8', fontStyle: '700'
        }).setOrigin(0.5);

        /* ---------------- lifetime deflections, shown on top ---------------- */

        UI.panel(this, {
            x: 640, y: 148, w: 520, h: 62, radius: 16,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: 0x3ddc6b, borderWidth: 2
        });

        this.add.text(500, 148, 'LIFETIME DEFLECTIONS', {
            fontSize: '15px', color: '#8fa6bd', fontStyle: '800'
        }).setOrigin(0.5, 0.5);

        this.add.text(800, 148, Achievements.fmt(Achievements.current('deflections')), {
            fontSize: '30px', color: '#3ddc6b', fontStyle: '900'
        }).setOrigin(0.5, 0.5);

        this.totalMoneyLabel = this.add.text(640, 196, '', {
            fontSize: '17px', color: '#ffd45e', fontStyle: '800'
        }).setOrigin(0.5);

        this.refreshHeader();

        /* ---------------- navigation ----------------
         * Created before the first renderPage() because the page buttons
         * enable/disable themselves depending on the current page. */

        UI.button(this, {
            x: 96, y: 660, w: 150, h: 56,
            label: 'BACK',
            textSize: 22,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59,
            radius: 14,
            onClick: () => this.scene.start('MenuScene')
        });

        this.prevBtn = UI.button(this, {
            x: 470, y: 660, w: 130, h: 56,
            label: 'PREV',
            textSize: 20,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59,
            radius: 14,
            onClick: () => this.changePage(-1)
        });

        this.nextBtn = UI.button(this, {
            x: 810, y: 660, w: 130, h: 56,
            label: 'NEXT',
            textSize: 20,
            fillTop: 0x4a90c4, fillBottom: 0x2f6b9c,
            radius: 14,
            onClick: () => this.changePage(1)
        });

        this.pageLabel = this.add.text(640, 660, '', {
            fontSize: '18px', color: '#9fb3c8', fontStyle: '800'
        }).setOrigin(0.5);

        // Only visible while there is something to collect.
        // Sits in the bottom nav row, clear of the card grid above it.
        this.claimAllBtn = UI.button(this, {
            x: 1080, y: 660, w: 260, h: 56,
            label: 'CLAIM ALL',
            textSize: 20,
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

        // Name
        box.add(this.add.text(x - w / 2 + 74, y - 19, ach.name, {
            fontSize: '19px',
            color: unlocked ? '#ffffff' : '#8fa6bd',
            fontStyle: '900'
        }).setOrigin(0, 0.5));

        // Description
        box.add(this.add.text(x - w / 2 + 74, y + 1, ach.desc, {
            fontSize: '13px',
            color: unlocked ? '#a9d8bb' : '#6f8296',
            fontStyle: '600'
        }).setOrigin(0, 0.5));

        // Progress bar, kept clear of the right-hand claim column
        const barW = w - 234;
        const barX = x - w / 2 + 74;
        const barY = y + 16;
        box.add(this.add.rectangle(barX, barY, barW, 6, 0x0d1723, 1).setOrigin(0, 0.5));
        if (prog.pct > 0) {
            box.add(this.add.rectangle(barX, barY, barW * prog.pct, 6,
                unlocked ? 0x3ddc6b : 0x4a90c4, 1).setOrigin(0, 0.5));
        }

        // Progress numbers
        let pText;
        if (claimable) pText = 'READY TO CLAIM';
        else if (unlocked) pText = 'CLAIMED';
        else pText = Achievements.fmt(prog.current) + ' / ' + Achievements.fmt(prog.goal);

        box.add(this.add.text(x - w / 2 + 74, y + 28, pText, {
            fontSize: '11px',
            color: claimable ? '#ffd45e' : (unlocked ? '#3ddc6b' : '#8fa6bd'),
            fontStyle: '800'
        }).setOrigin(0, 0.5));

        /* ---- right-hand column ---- */
        if (claimable) {
            box.add(UI.button(this, {
                x: x + w / 2 - 82, y: y, w: 140, h: 46,
                label: 'CLAIM $' + Achievements.fmt(ach.reward),
                textSize: 15,
                fillTop: 0xffd45e, fillBottom: 0xc98a08,
                textColor: 0x1a1a1a,
                radius: 12,
                onClick: () => this.doClaim(ach)
            }));
        } else {
            box.add(this.add.text(x + w / 2 - 16, y - 8, '+$' + Achievements.fmt(ach.reward), {
                fontSize: '18px',
                color: unlocked ? '#ffd45e' : '#7d8ea0',
                fontStyle: '900'
            }).setOrigin(1, 0.5));

            box.add(this.add.text(x + w / 2 - 16, y + 13,
                unlocked ? 'CLAIMED' : ach.cat.toUpperCase(), {
                fontSize: '10px',
                color: unlocked ? '#8fa6bd' : '#5f7386',
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
