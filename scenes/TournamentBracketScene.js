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

const TEAM_W = 148, TEAM_H = 30, TEAM_R = 15;
const SLOT_W = 88, SLOT_H = 26, SLOT_R = 13;
const CHAMP_W = 140, CHAMP_H = 44;

const GOLD = 0xf0b429;
const PALE = 0xffe9a8;
const SLOT_STROKE = 0xd8a63a;
const PILL_FILL = 0x1b2836;
const SLOT_FILL = 0x1f2c3d;
const EMPTY_FILL = 0x141f2c;

const CY = 350;           // centre line
const FIELD_BOTTOM = 600;

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

        // The bracket field. 100..612 vertical, so every pill above stays inside.
        UI.panel(this, {
            x: 640, y: 356, w: 1240, h: 512, radius: 20,
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
            x: 640, y: 664, w: 300, h: 58,
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

    /* Row i of n, symmetric about CY. */
    _row(i, n, pitch) { return CY + (i - (n - 1) / 2) * pitch; }

    r16Y(i) { return this._row(i, 8, 58); }
    qfY(i) { return this._row(i, 4, 116); }
    sfY(i) { return this._row(i, 2, 232); }

    /* Column centres.
     *
     * These are SPACED, not eyeballed. The left half has three slot columns and
     * the champion pill to fit between the right edge of the team pills (226) and
     * the champion's left edge (570) - 344px for four boxes. At 88px per slot that
     * leaves 16px of gutter per column.
     *
     * The first attempt used 96px slots at x=322/430/524, which put the finals
     * slot 2px under the semi slot and the champion 7px over both finals slots.
     * Anything that overlaps here hides a team name. */
    get X_LT() { return 152; }   // left team pills   -> 78..226
    get X_RT() { return 1128; }  // right team pills  -> 1054..1202
    get X_LQ() { return 290; }   // -> 246..334
    get X_RQ() { return 990; }   // -> 946..1034
    get X_LS() { return 394; }   // -> 350..438
    get X_RS() { return 886; }   // -> 842..930
    get X_LF() { return 498; }   // -> 454..542
    get X_RF() { return 782; }   // -> 738..826
    // champion -> 570..710, clearing both finals columns by 28px

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

    _teamPill(cx, cy, name, isPlayer, isWinner) {
        this._pill(cx, cy, TEAM_W, TEAM_H,
            isPlayer ? GOLD : PILL_FILL,
            isPlayer ? PALE : GOLD, 2, TEAM_R);

        this.add.circle(cx + TEAM_W / 2 - 15, cy, 8,
            isPlayer ? 0xfff0b8 : GOLD, 1);

        this.add.text(cx + 8, cy, this.trunc(name, 13), {
            fontSize: '13px',
            color: isPlayer ? '#1a1a1a' : (isWinner ? '#7fe08a' : '#ffffff'),
            fontFamily: UI.FAMILY, fontStyle: '900'
        }).setOrigin(1, 0.5);
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

    _label(x, y, text) {
        this.add.text(x, y, text, {
            fontSize: '13px', color: '#f0b429', fontFamily: UI.FAMILY,
            fontStyle: '900', stroke: '#0b1220', strokeThickness: 3
        }).setOrigin(0.5);
    }

    /* ---------------- the bracket ---------------- */

    drawMirrorBracket() {
        const you = localStorage.getItem('tournamentTeamName') || 'Your Team';
        const r16 = this.bracket.roundOf16 || [];
        const qf = this.bracket.quarterFinals || [];
        const sf = this.bracket.semiFinals || [];
        const fin = this.bracket.finals || { team1: 'TBD', team2: 'TBD', winner: null };

        const LT = this.X_LT, RT = this.X_RT;
        const LQ = this.X_LQ, RQ = this.X_RQ;
        const LS = this.X_LS, RS = this.X_RS;
        const LF = this.X_LF, RF = this.X_RF;

        this._label(LT, 118, 'ROUND OF 16');
        this._label(LQ, 118, 'QUARTER FINALS');
        this._label(LS, 118, 'SEMI FINALS');
        this._label(LF - 26, 118, 'FINALS');
        this._label(RF + 26, 118, 'FINALS');
        this._label(RS, 118, 'SEMI FINALS');
        this._label(RQ, 118, 'QUARTER FINALS');
        this._label(RT, 118, 'ROUND OF 16');

        /* ---- ROUND OF 16: 8 rows per side, full height, mirrored ----
         *
         * One PILL per row, not two in a close pair. Left carries matches 0-3
         * (teams 0-7), right carries matches 4-7 (teams 8-15), and each side is
         * eight evenly spaced rows down the whole field - which is what makes the
         * two halves mirror each other.
         *
         * The previous version drew four tight pairs on the left and four on the
         * right, so each side only occupied half the height and the bracket read
         * as two unrelated blocks with a connector running off the bottom. */
        const r16Team = (i) => {
            const m = r16[Math.floor(i / 2)] || { team1: 'TBD', team2: 'TBD', winner: null };
            return i % 2 === 0 ? m.team1 : m.team2;
        };
        const r16Win = (i) => {
            const m = r16[Math.floor(i / 2)] || { team1: 'TBD', team2: 'TBD', winner: null };
            return m.winner === (i % 2 === 0 ? m.team1 : m.team2);
        };

        for (let side = 0; side < 2; side++) {
            const left = side === 0;
            const cx = left ? LT : RT;
            const inner = left ? (cx + TEAM_W / 2) : (cx - TEAM_W / 2);
            const bend = left ? inner + 30 : inner - 30;

            for (let row = 0; row < 8; row++) {
                const idx = side * 8 + row;
                const y = this.r16Y(row);
                this._teamPill(cx, y, r16Team(idx), r16Team(idx) === you, r16Win(idx));
            }

            // Each PAIR of rows is one first-round match, and its winner feeds
            // quarter-final match `match`, on the near or far slot depending on
            // which side of the bracket this is.
            for (let match = 0; match < 4; match++) {
                const yA = this.r16Y(match * 2);
                const yB = this.r16Y(match * 2 + 1);
                const mid = (yA + yB) / 2;
                const qY = this.qfY(match) + (left ? -16 : 16);
                const slotX = left ? (LQ - SLOT_W / 2) : (RQ + SLOT_W / 2);

                this._merge(inner, yA, inner, yB, bend, mid);
                this._feed(bend, mid, slotX, qY,
                    left ? bend + (slotX - bend) / 2 : bend - (slotX - bend) / 2);
            }
        }

        /* ---- QUARTER FINALS ----
         *
         * The two halves are SEPARATE halves of one draw, not a mirror image of
         * each other: the left half owns quarter-finals 0 and 1, the right half
         * owns 2 and 3. Drawing qf[0..3] on both sides showed all four matches
         * twice and put eight quarter-final slots on screen for a bracket that
         * only has four. */
        for (let i = 0; i < 4; i++) {
            const m = qf[i] || { team1: 'TBD', team2: 'TBD', winner: null };
            const left = i < 2;
            const cx = left ? LQ : RQ;
            const y = this.qfY(i);

            this._slotPill(cx, y - 16, m.team1, m.winner === m.team1);
            this._slotPill(cx, y + 16, m.team2, m.winner === m.team2);
        }

        /* ---- SEMI FINALS: each half's two quarter-finals converge ---- */
        for (let half = 0; half < 2; half++) {
            const left = half === 0;
            const cx = left ? LS : RS;
            const m = sf[half] || { team1: 'TBD', team2: 'TBD', winner: null };
            const y = this.sfY(half);
            const inner = left ? (cx + SLOT_W / 2) : (cx - SLOT_W / 2);

            this._slotPill(cx, y - 16, m.team1, m.winner === m.team1);
            this._slotPill(cx, y + 16, m.team2, m.winner === m.team2);

            // The two quarter-finals inside this half.
            const qA = this.qfY(half * 2);
            const qB = this.qfY(half * 2 + 1);
            const qMid = (qA + qB) / 2;
            const qx = left ? (LQ + SLOT_W / 2) : (RQ - SLOT_W / 2);
            const qb = left ? qx + 20 : qx - 20;

            this._merge(qx, qA, qx, qB, qb, qMid);
            this._feed(qb, qMid, inner, y, left ? qb + (inner - qb) / 2 : qb - (inner - qb) / 2);
        }

        /* ---- FINALS, then the champion between them ---- */
        this._slotPill(LF, CY - 16, fin.team1, fin.winner === fin.team1);
        this._slotPill(RF, CY + 16, fin.team2, fin.winner === fin.team2);

        const cw = CHAMP_W / 2;
        this._pill(640, CY, CHAMP_W, CHAMP_H,
            fin.winner ? GOLD : 0x101a26, fin.winner ? PALE : SLOT_STROKE, 3, 22);
        this.add.text(640, CY - 7, fin.winner ? this.trunc(fin.winner, 16) : 'CHAMPION', {
            fontSize: '16px', color: fin.winner ? '#1a1a1a' : '#9fb3c8',
            fontFamily: UI.FAMILY, fontStyle: '900'
        }).setOrigin(0.5);
        this.add.text(640, CY + 13, fin.winner ? 'TOURNAMENT WINNER' : 'AWAITING FINAL', {
            fontSize: UI.TYPE.micro + 'px', color: fin.winner ? '#7a5a10' : '#8fa6bd',
            fontFamily: UI.FAMILY, fontStyle: '900'
        }).setOrigin(0.5);

        // Each finalist runs into the side of the champion pill.
        this._feed(LF + SLOT_W / 2, CY - 16, 640 - cw, CY, LF + SLOT_W / 2 + 22);
        this._feed(LF + SLOT_W / 2, CY + 16, 640 - cw, CY, LF + SLOT_W / 2 + 22);
        this._feed(RF - SLOT_W / 2, CY - 16, 640 + cw, CY, RF - SLOT_W / 2 - 22);
        this._feed(RF - SLOT_W / 2, CY + 16, 640 + cw, CY, RF - SLOT_W / 2 - 22);

        this.add.text(640, 590, 'Next: ' + this.roundName(), {
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
        const startY = 200, rowH = 42;

        for (let c = 0; c < 4; c++) {
            this._label(colX[c], 188, 'GROUP ' + String.fromCharCode(65 + c));
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
                this.add.circle(colX[c] - W / 2 + 15, y, 8,
                    isPlayer ? 0xfff0b8 : GOLD, 1);
                this.add.text(colX[c] + 8, y, this.trunc(team, 15), {
                    fontSize: '13px',
                    color: isPlayer ? '#1a1a1a' : (m.winner === team ? '#7fe08a' : '#ffffff'),
                    fontFamily: UI.FAMILY, fontStyle: '800'
                }).setOrigin(1, 0.5);
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
