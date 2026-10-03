/* TournamentBracketScene - mirrored bracket, rewritten geometry.
 *
 * Structure follows the reference: teams as gold pills down the OUTER edges,
 * rounds converging inward, champion slot dead centre.
 *
 * Teams 1-8 run down the left edge and teams 9-16 down the right, so every team
 * appears exactly ONCE. An earlier attempt drew the same eight matches on both
 * sides, which put all sixteen names on screen twice and made the bracket look
 * like thirty-two entrants.
 *
 * Vertical layout is symmetric about y=350 and everything is derived from the
 * bounds, so nothing can overflow the field:
 *
 *   R16  8 rows, pitch 58, second pill +31   -> 147..584   (field ends 600)
 *   QF   4 rows, pitch 116, slots +/-16      -> 160..540
 *   SF   2 rows, pitch 232, slots +/-16      -> 218..482
 *   FIN  1 row,  slots +/-16                -> 334..366
 *   CHAMPION centred at (640, 350), 150 wide -> 565..715
 *
 * Finals slots sit at x=505 / 775 so the champion pill clears them by 14px each
 * side; overlapping it was the third bug in the first version.
 */

const TEAM_W = 140, TEAM_H = 30, TEAM_R = 15;
const SLOT_W = 84, SLOT_H = 24, SLOT_R = 12;
const CHAMP_W = 126, CHAMP_H = 42;

const GOLD = 0xf0b429;
const PALE = 0xffe9a8;
const SLOT_STROKE = 0xd8a63a;
const PILL_FILL = 0x1b2836;
const SLOT_FILL = 0x1f2c3d;
const EMPTY_FILL = 0x141f2c;

/* Horizontal layout, computed rather than eyeballed.
 *
 * The previous version used 88px slots at x=290/394/498 with 16px gutters, so
 * the two slots of a match sat 32px apart on a 26px pill - a 6px gap, which made
 * them read as one blob - and left the team pills stranded 48px from the first
 * slot column. That combination is what made the bracket look broken.
 *
 * Strict grid across the 20..1260 field:
 *
 *   20 +140 team |25| 84 qf |25| 84 sf |25| 84 fin |90| 126 champion
 *       |90| 84 fin |25| 84 sf |25| 84 qf |25| 140 team            -> 1260
 *
 * Every slot column is the same width and every gutter the same size, except the
 * wide ones either side of the champion where the two finalists converge. */
const X_LT = 90, X_LQ = 227, X_LS = 336, X_LF = 445;
const X_RF = 835, X_RS = 944, X_RQ = 1053, X_RT = 1190;

/* Vertical, symmetric about CY.
 *
 * Each half is self-contained: 8 teams -> 4 first-round matches -> 2
 * quarter-finals -> 1 semi-final -> 1 place in the final. The left half owns
 * quarter-finals 0 and 1; the right half owns 2 and 3.
 *
 * CY is 380, not the panel's centre line of 356, and it has to be that low.
 * Centred at 350 the first right-hand team pill sat at y=147, spanning 132..162,
 * and the close button at (1240,132) with a radius of 22 spans y 110..154 - so the
 * X was drawn straight through "Green Hornets". At 380 the top pill starts at
 * 161 and clears it. */
const CY = 380;
const R16_PITCH = 58;
const QF_Y = [CY - 116, CY + 116];   // two quarter-finals per half
const SLOT_DY = 17;                  // the two slots of a match: 34px apart on a 24px pill

class TournamentBracketScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TournamentBracketScene' });
    }

    init(data) {
        this.mode = data.mode || localStorage.getItem('tournamentMode') || 'qualifiers';
        this.currentRound = data.round || localStorage.getItem('tournamentRound')
            || (this.mode === 'qualifiers' ? 'roundOf16' : 'roundOf32');

        if (localStorage.getItem('tournamentRound')) {
            localStorage.setItem('tournamentActive', 'true');
        }
        localStorage.setItem('tournamentMode', this.mode);
        if (!localStorage.getItem('tournamentRound')) {
            localStorage.setItem('tournamentRound', this.currentRound);
        }
    }

    create() {
        UI.stadium(this, { alpha: 0.5, groundAlpha: 0.3, grassAlpha: 0.2, dim: 0.62 });

        /* The bracket field: 20..1260 x, 99..629 y. Its height is set so the
         * eighth team row at y=583 (bottom 598) and the "Next" line at 616 both
         * clear the panel floor. */
        UI.panel(this, {
            x: 640, y: 364, w: 1240, h: 530, radius: 20,
            fillTop: 0x162030, fillBottom: 0x0d1420,
            border: 0x4a6a8a, borderWidth: 2
        });

        this.loadOrGenerateBracket();

        const cup = this.mode === 'qualifiers' ? 'QUALIFIERS CUP' : 'CHAMPIONS CUP';
        UI.title(this, {
            text: cup, x: 640, y: 44,
            size: 28, fill: '#ffd45e', stroke: '#f0a500', thickness: 5
        });
        this.add.text(640, 78, 'TOURNAMENT BRACKET', {
            fontSize: '20px', color: '#ffffff', fontFamily: UI.FAMILY,
            fontStyle: '900', stroke: '#0b1220', strokeThickness: 4
        }).setOrigin(0.5);

        if (this.currentRound === 'roundOf32' && this.mode === 'champions') {
            this.drawRoundOf32Grid();
        } else {
            this.drawMirrorBracket();
        }

        UI.closeButton(this, {
            x: UI.CLOSE_X, y: UI.CLOSE_Y, r: 22,
            onClick: () => this.scene.start('TournamentMenuScene')
        });

        UI.button(this, {
            x: 640, y: 668, w: 300, h: 58,
            label: 'PLAY MATCH', textSize: UI.TYPE.lead,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a, radius: 16,
            onClick: () => this.scene.start('TournamentGameScene', {
                mode: this.mode,
                round: this.currentRound,
                opponent: this.getNextOpponent()
            })
        });
    }

    /* ---------------- geometry ---------------- */

    /** Row i of n, symmetric about CY. */
    _row(i, n, pitch) { return CY + (i - (n - 1) / 2) * pitch; }

    /** Round-of-16 row. One pill per row, eight rows per half, full height. */
    r16Y(row) { return this._row(row, 8, R16_PITCH); }

    /** Quarter-final row for half 0 (left) or 1 (right). */
    qfY(half, which) { return QF_Y[which] + (half ? 0 : 0); }

    /* ---------------- pill primitives ---------------- */

    _pill(cx, cy, w, h, fill, stroke, sw, r) {
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.32);
        g.fillRoundedRect(cx - w / 2 + 1, cy - h / 2 + 2, w, h, r);
        g.fillGradientStyle(fill, fill, darker(fill), darker(fill), 1);
        g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
        g.lineStyle(sw, stroke, 1);
        g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
    }

    /** Outer team pill. `left` mirrors it for the left-hand column. */
    _teamPill(cx, cy, name, isPlayer, isWinner, left) {
        this._pill(cx, cy, TEAM_W, TEAM_H,
            isPlayer ? GOLD : PILL_FILL,
            isPlayer ? PALE : GOLD, 2, TEAM_R);

        /* Marker dot on the OUTER edge, text growing INWARD from it.
         *
         * Two earlier versions got this wrong in opposite directions and both
         * clipped the names off the screen edge. Anchoring the text to the inner
         * edge and growing it outward overflowed the canvas by ~13px a side, and
         * the very first version right-aligned both halves, so the right column
         * ran into its own dot.
         *
         * Now the dot takes a fixed 14px at the outer edge, the text starts 27px
         * in from that edge and runs inward, leaving 99px of usable width - enough
         * for the 12-character truncation at 13px. Nothing can leave the pill. */
        const outer = cx + (left ? -TEAM_W / 2 : TEAM_W / 2);
        const dir = left ? 1 : -1;

        this.add.circle(outer + dir * 14, cy, 7,
            isPlayer ? 0xfff0b8 : GOLD, 1);

        this.add.text(outer + dir * 27, cy, this.trunc(name, 12), {
            fontSize: '13px',
            color: isPlayer ? '#1a1a1a' : (isWinner ? '#7fe08a' : '#ffffff'),
            fontFamily: UI.FAMILY, fontStyle: '900'
        }).setOrigin(left ? 0 : 1, 0.5);
    }

    _slotPill(cx, cy, name, isWinner) {
        const has = name && name !== 'TBD';
        this._pill(cx, cy, SLOT_W, SLOT_H,
            has ? SLOT_FILL : EMPTY_FILL,
            has ? (isWinner ? 0x3ddc6b : SLOT_STROKE) : 0x5a6b7d, 2, SLOT_R);
        this.add.text(cx, cy, has ? this.trunc(name, 11) : '', {
            fontSize: '13px', color: has ? '#ffffff' : '#5f7386',
            fontFamily: UI.FAMILY, fontStyle: '800'
        }).setOrigin(0.5);
    }

    /* A pill feeding one point, as a Z: out, across, in. */
    _feed(x1, y1, x2, y2, bendX) {
        const g = this.add.graphics();
        g.lineStyle(2, GOLD, 0.85);
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(bendX, y1);
        g.lineTo(bendX, y2);
        g.lineTo(x2, y2);
        g.strokePath();
    }

    /* Two pills converging into one point. */
    _merge(x1, y1, x2, y2, bendX, midY) {
        const g = this.add.graphics();
        g.lineStyle(2, GOLD, 0.85);
        g.beginPath();
        g.moveTo(x1, y1); g.lineTo(bendX, y1); g.lineTo(bendX, midY);
        g.moveTo(x2, y2); g.lineTo(bendX, y2); g.lineTo(bendX, midY);
        g.strokePath();
    }

    /** Round header. Pass an array to break it across two lines. */
    _label(x, y, text, lines) {
        const body = lines ? lines.join('\n') : text;
        this.add.text(x, y, body, {
            fontSize: '13px', color: '#f0b429', fontFamily: UI.FAMILY,
            fontStyle: '900', stroke: '#0b1220', strokeThickness: 3,
            align: 'center', lineSpacing: 0
        }).setOrigin(0.5);
    }

    /* ---------------- the bracket ---------------- */

    drawMirrorBracket() {
        const you = localStorage.getItem('tournamentTeamName') || 'Your Team';
        const r16 = this.bracket.roundOf16 || [];
        const qf = this.bracket.quarterFinals || [];
        const sf = this.bracket.semiFinals || [];
        const fin = this.bracket.finals || { team1: 'TBD', team2: 'TBD', winner: null };

        /* Round headers.
         *
         * The two outermost are broken over two lines. "ROUND OF 16" on one line
         * is 95px wide, and the next column's "QUARTER FINALS" is 110px on a
         * 109px column pitch - so on one line the two headers overlap by a few
         * pixels and read as "ROUND OF 1QUARTER FINALS". Split, the outer header
         * is 48px and clears both its neighbour and, on the right, the close
         * button whose hit zone starts at x=1218. */
        this._label(X_LT + 10, 134, 'ROUND OF 16', ['ROUND', 'OF 16']);
        this._label(X_LQ, 134, 'QUARTER FINALS');
        this._label(X_LS, 134, 'SEMI FINALS');
        this._label(X_LF, 134, 'FINAL');
        this._label(X_RF, 134, 'FINAL');
        this._label(X_RS, 134, 'SEMI FINALS');
        this._label(X_RQ, 134, 'QUARTER FINALS');
        this._label(X_RT - 10, 134, 'ROUND OF 16', ['ROUND', 'OF 16']);

        /* Flatten the eight first-round matches into sixteen teams, eight per
         * half. Team n lives on row n%8 of half floor(n/8). */
        const teamAt = (n) => {
            const m = r16[Math.floor(n / 2)] || { team1: 'TBD', team2: 'TBD', winner: null };
            return n % 2 === 0 ? m.team1 : m.team2;
        };
        const wonAt = (n) => {
            const m = r16[Math.floor(n / 2)] || { team1: 'TBD', team2: 'TBD', winner: null };
            return m.winner === (n % 2 === 0 ? m.team1 : m.team2);
        };

        /* ---- ROUND OF 16: eight pills per half, then pairs merge ---- */
        for (let half = 0; half < 2; half++) {
            const left = half === 0;
            const cx = left ? X_LT : X_RT;
            const inner = left ? (cx + TEAM_W / 2) : (cx - TEAM_W / 2);
            const bend = left ? inner + 14 : inner - 14;

            for (let row = 0; row < 8; row++) {
                const n = half * 8 + row;
                this._teamPill(cx, this.r16Y(row), teamAt(n), teamAt(n) === you, wonAt(n), left);
            }

            // Pairs of rows are one first-round match; its winner feeds the
            // quarter-final for this half. Matches 0,1 -> QF top; 2,3 -> QF bottom.
            for (let m = 0; m < 4; m++) {
                const yA = this.r16Y(m * 2);
                const yB = this.r16Y(m * 2 + 1);
                const mid = (yA + yB) / 2;
                const which = m < 2 ? 0 : 1;
                const slotX = left ? (X_LQ - SLOT_W / 2) : (X_RQ + SLOT_W / 2);
                const slotY = QF_Y[which] + (m % 2 === 0 ? -SLOT_DY : SLOT_DY);

                this._merge(inner, yA, inner, yB, bend, mid);
                this._feed(bend, mid, slotX, slotY,
                    left ? bend + (slotX - bend) / 2 : bend - (slotX - bend) / 2);
            }
        }

        /* ---- QUARTER FINALS: left half owns 0 and 1, right owns 2 and 3 ---- */
        for (let which = 0; which < 2; which++) {
            const y = QF_Y[which];

            this._slotPill(X_LQ, y - SLOT_DY, (qf[which] || {}).team1, (qf[which] || {}).winner === (qf[which] || {}).team1);
            this._slotPill(X_LQ, y + SLOT_DY, (qf[which] || {}).team2, (qf[which] || {}).winner === (qf[which] || {}).team2);

            const ri = which + 2;
            this._slotPill(X_RQ, y - SLOT_DY, (qf[ri] || {}).team1, (qf[ri] || {}).winner === (qf[ri] || {}).team1);
            this._slotPill(X_RQ, y + SLOT_DY, (qf[ri] || {}).team2, (qf[ri] || {}).winner === (qf[ri] || {}).team2);
        }

        /* ---- SEMI FINALS: one per half, both centred ---- */
        for (let half = 0; half < 2; half++) {
            const left = half === 0;
            const cx = left ? X_LS : X_RS;
            const m = sf[half] || { team1: 'TBD', team2: 'TBD', winner: null };
            const inner = left ? (cx + SLOT_W / 2) : (cx - SLOT_W / 2);
            const bend = left ? inner + 16 : inner - 16;

            this._slotPill(cx, CY - SLOT_DY, m.team1, m.winner === m.team1);
            this._slotPill(cx, CY + SLOT_DY, m.team2, m.winner === m.team2);

            // The two quarter-finals above it converge here.
            const qA = QF_Y[0], qB = QF_Y[1], qMid = (qA + qB) / 2;
            const qx = left ? (X_LQ + SLOT_W / 2) : (X_RQ - SLOT_W / 2);
            const qb = left ? qx + 14 : qx - 14;

            this._merge(qx, qA, qx, qB, qb, qMid);
            this._feed(qb, qMid, inner, CY, left ? qb + (inner - qb) / 2 : qb - (inner - qb) / 2);
        }

        /* ---- FINAL: one place per half, meeting at the champion ---- */
        this._slotPill(X_LF, CY, fin.team1, fin.winner === fin.team1);
        this._slotPill(X_RF, CY, fin.team2, fin.winner === fin.team2);

        const cw = CHAMP_W / 2;
        this._pill(640, CY, CHAMP_W, CHAMP_H,
            fin.winner ? GOLD : 0x101a26, fin.winner ? PALE : SLOT_STROKE, 3, 21);
        this.add.text(640, CY - 6, fin.winner ? this.trunc(fin.winner, 13) : 'CHAMPION', {
            fontSize: '15px', color: fin.winner ? '#1a1a1a' : '#9fb3c8',
            fontFamily: UI.FAMILY, fontStyle: '900'
        }).setOrigin(0.5);
        this.add.text(640, CY + 12, fin.winner ? 'WINNER' : 'AWAITING FINAL', {
            fontSize: UI.TYPE.micro + 'px', color: fin.winner ? '#7a5a10' : '#8fa6bd',
            fontFamily: UI.FAMILY, fontStyle: '900'
        }).setOrigin(0.5);

        // Semi -> final spot, then final spot -> champion.
        this._feed(X_LS + SLOT_W / 2, CY, X_LF - SLOT_W / 2, CY, X_LS + SLOT_W / 2 + 18);
        this._feed(X_RS - SLOT_W / 2, CY, X_RF + SLOT_W / 2, CY, X_RS - SLOT_W / 2 - 18);
        this._feed(X_LF + SLOT_W / 2, CY, 640 - cw, CY, X_LF + SLOT_W / 2 + 22);
        this._feed(X_RF - SLOT_W / 2, CY, 640 + cw, CY, X_RF - SLOT_W / 2 - 22);

        this.add.text(640, 616, 'Next: ' + this.roundName(), {
            fontSize: '15px', color: '#ffd45e', fontFamily: UI.FAMILY, fontStyle: '800',
            stroke: '#0b1220', strokeThickness: 4
        }).setOrigin(0.5);
    }

    /* Round of 32 stays its own page: 32 pills will not fit the mirrored layout
     * at a legible size. Rebuilt with the same pills and marker dots so it reads
     * as the same object rather than a list. */
    drawRoundOf32Grid() {
        const you = localStorage.getItem('tournamentTeamName') || 'Your Team';
        this.add.text(640, 122, 'ROUND OF 32', {
            fontSize: '26px', color: '#ffd45e', fontFamily: UI.FAMILY, fontStyle: '900',
            stroke: '#0b1220', strokeThickness: 5
        }).setOrigin(0.5);
        this.add.text(640, 152, 'All 32 competing teams', {
            fontSize: '14px', color: '#9fb3c8', fontFamily: UI.FAMILY, fontStyle: '700'
        }).setOrigin(0.5);

        const matches = this.bracket.roundOf32 || [];
        const W = 178, H = 28, R = 14;
        const colX = [190, 470, 750, 1030];
        const startY = 206, rowH = 46;

        for (let c = 0; c < 4; c++) {
            this._label(colX[c], 176, 'GROUP ' + String.fromCharCode(65 + c));
        }

        for (let c = 0; c < 4; c++) {
            for (let r = 0; r < 8; r++) {
                const idx = c * 8 + r;
                const m = matches[Math.floor(idx / 2)];
                if (!m) continue;
                const team = idx % 2 === 0 ? m.team1 : m.team2;
                const y = startY + r * rowH;
                const isPlayer = team === you;

                this._pill(colX[c], y, W, H,
                    isPlayer ? GOLD : PILL_FILL, isPlayer ? PALE : GOLD, 2, R);

                /* Same rule as the bracket's outer pills: the dot takes the outer
                 * 14px, the text starts 27px in and grows INWARD. This page
                 * right-aligned the text at colX+8 instead, so a long name ran
                 * 8px over its own marker dot on every single row. */
                this.add.circle(colX[c] - W / 2 + 14, y, 7,
                    isPlayer ? 0xfff0b8 : GOLD, 1);
                this.add.text(colX[c] - W / 2 + 27, y, this.trunc(team, 15), {
                    fontSize: '13px',
                    color: isPlayer ? '#1a1a1a' : (m.winner === team ? '#7fe08a' : '#ffffff'),
                    fontFamily: UI.FAMILY, fontStyle: '800'
                }).setOrigin(0, 0.5);
            }
        }

        const next = this.getNextOpponent();
        if (next && next !== 'TBD') {
            this.add.text(640, 578, 'Next:  ' + you + '   vs   ' + next, {
                fontSize: '16px', color: '#ffffff', fontFamily: UI.FAMILY, fontStyle: '800',
                stroke: '#0b1220', strokeThickness: 4
            }).setOrigin(0.5);
        }
    }

    /* ---------------- data ---------------- */

    roundName() {
        const r = this.currentRound;
        if (r === 'roundOf16') return 'ROUND OF 16';
        if (r === 'roundOf32') return 'ROUND OF 32';
        if (r === 'quarterFinals') return 'QUARTER FINALS';
        if (r === 'semiFinals') return 'SEMI FINALS';
        if (r === 'finals') return 'FINALS';
        return r;
    }

    trunc(name, n) {
        if (!name || name === 'TBD') return name;
        return name.length > n ? name.substring(0, n - 3) + '...' : name;
    }

    loadOrGenerateBracket() {
        const saved = localStorage.getItem('tournamentBracket');
        if (saved) {
            try { this.bracket = JSON.parse(saved); } catch (e) { this.generateBracket(); }
        } else {
            this.generateBracket();
            localStorage.setItem('tournamentBracket', JSON.stringify(this.bracket));
        }
    }

    generateBracket() {
        const pool = [
            "Thunder Strikers", "Golden Eagles", "Fire Dragons", "Ice Wolves",
            "Storm Chasers", "Lightning Bolts", "Shadow Hunters", "Crimson Tide",
            "Blue Sharks", "Green Hornets", "Silver Bullets", "Black Panthers",
            "Red Devils", "White Knights", "Purple Reign", "Orange Crush",
            "Mighty Ducks", "Wild Cats", "Brave Lions", "Swift Falcons",
            "Iron Giants", "Steel Warriors", "Bronze Titans", "Copper Kings",
            "Diamond Aces", "Platinum Stars", "Gold Rush", "Silver Lining",
            "Neon Ninjas", "Cyber Samurai", "Pixel Pirates", "Digital Demons"
        ];
        const you = localStorage.getItem('tournamentTeamName') || 'Your Team';
        const n = this.mode === 'champions' ? 32 : 16;
        const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, n - 1);
        picked.unshift(you);
        this.teams = picked;
        this.bracket = this.structure();
    }

    structure() {
        const b = {};
        if (this.mode === 'champions') {
            b.roundOf32 = [];
            for (let i = 0; i < 16; i++) {
                b.roundOf32.push({
                    team1: this.teams[i * 2] || 'TBD',
                    team2: this.teams[i * 2 + 1] || 'TBD', winner: null
                });
            }
            b.roundOf16 = Array(8).fill(null).map(() => ({ team1: 'TBD', team2: 'TBD', winner: null }));
        } else {
            b.roundOf16 = [];
            for (let i = 0; i < 8; i++) {
                b.roundOf16.push({
                    team1: this.teams[i * 2] || 'TBD',
                    team2: this.teams[i * 2 + 1] || 'TBD', winner: null
                });
            }
        }
        b.quarterFinals = Array(4).fill(null).map(() => ({ team1: 'TBD', team2: 'TBD', winner: null }));
        b.semiFinals = Array(2).fill(null).map(() => ({ team1: 'TBD', team2: 'TBD', winner: null }));
        b.finals = { team1: 'TBD', team2: 'TBD', winner: null };
        return b;
    }

    getNextOpponent() {
        const you = localStorage.getItem('tournamentTeamName') || 'Your Team';
        const cur = this.currentRound;
        if (this.bracket[cur]) {
            const ms = Array.isArray(this.bracket[cur]) ? this.bracket[cur] : [this.bracket[cur]];
            for (const m of ms) {
                if (m.team1 === you) return m.team2;
                if (m.team2 === you) return m.team1;
            }
        }
        return ['Thunder Strikers', 'Golden Eagles', 'Fire Dragons', 'Ice Wolves'][0];
    }
}

function darker(hex) {
    const r = Math.max(0, ((hex >> 16) & 0xff) - 24);
    const g = Math.max(0, ((hex >> 8) & 0xff) - 24);
    const b = Math.max(0, (hex & 0xff) - 20);
    return (r << 16) | (g << 8) | b;
}
