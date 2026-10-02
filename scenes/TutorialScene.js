/* TutorialScene.js - the "Learn to Play" guided demo.
 *
 * This EXTENDS GameScene rather than re-implementing it, so the tutorial is
 * the real game: same Arcade physics body, same gravity, same ground jump,
 * same wall bounce, same hitbox radius, same deflect code (onBallClick), same
 * score / speed-boost / sound / shake. Only the *pacing* is scripted.
 *
 * The lesson scripts WHEN things happen, never HOW the ball moves. The ball is
 * always driven by GameScene's physics.
 */
class TutorialScene extends GameScene {
    constructor() {
        super('TutorialScene');
    }

    init() {
        this.phase = 'approach';
        this.awaitingHit = false;
        this.shots = 0;          // deflections made in the tutorial
        this.spotRestore = null;
        this.hintParts = null;
        this.frozen = false;
        // Scenes are singletons, so clear anything a previous run left behind
        this.homeBtn = null;
        this.homeLocked = true;
        this.moneyArrow = null;
        this.hintTitle = null;
        this.dim = null;
    }

    create() {
        // The entire real game: physics, goal, wall, ground, hitbox, HUD, audio.
        super.create();

        this.score = 0;
        this.runDeflections = 0;
        this.lessonSpeed = 0;
        this.scoreMultiplier = 1;   // a lesson always scores 1 per hit
        this.scoreText.setText('Score: 0');
        this.speedText.setText('Speed Boost: 0%');

        // Dim layer for the spotlight. Objects lifted above it stay bright.
        this.dim = this.add.rectangle(640, 360, 1280, 720, 0x050a12, 0.78);
        this.dim.setDepth(60);
        this.dim.setVisible(false);

        this.tweens.add({
            targets: this.dim, alpha: { from: 0, to: 0.78 },
            duration: 260, ease: 'Quad.easeOut'
        });

        this.startLesson();
    }

    /* ================= pacing ================= */

    startLesson() {
        // Start wide on the right so the approach is long enough to read as
        // "the ball is coming at your goal" before it stops.
        this.ball.x = 1150;
        this.ball.y = 300;
        this.thawBall();

        // Launch the ball on a real approach so the player sees it come at them
        this.phase = 'approach';
        this.hintTitle = this.add.text(640, 96, 'Watch the ball', {
            fontSize: '30px', color: '#ffd45e', fontStyle: '900',
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5).setDepth(30);

        this.approach();
    }

    /** Let the ball run until it is heading for the goal, then stop it dead. */
    approach() {
        this.phase = 'approach';
        this.thawBall();
        this.ball.setVelocity(-this.ballSpeed, -220);
    }

    /** Called from update() while the ball is inbound (first approach or the
     *  return after a hit). Stops it on the goal side of the centre line,
     *  which is the only place the real game allows a hit. */
    checkApproach() {
        if (this.phase !== 'approach' && this.phase !== 'return') return;
        if (!this.ball || !this.ball.body) return;

        const v = this.ball.body.velocity;
        const inbound = v.x < 0;
        const inRange = this.ball.x < 620 && this.ball.x > 260;

        if (inbound && inRange) {
            this.promptDeflect();
        }
    }

    promptDeflect() {
        this.phase = 'prompt';
        this.freezeBall();

        // Darken everything except the ball and its hitbox
        this.spotOn([this.ball, this.hitboxCircle]);
        this.hintTitle.setText('Hit the ball to deflect it');

        this.awaitingHit = true;
        this.pulseBall();

        // Pointer on the ball itself
        this.ball.setInteractive({ useHandCursor: true });
        this.ball.on('pointerdown', () => {
            if (this.phase === 'prompt') this.hitBall();
        });

        // Or anywhere inside the hitbox
        this.input.on('pointerdown', this.onTapAnywhere, this);

        // Safety: never let the lesson dead-end
        this.time.delayedCall(14000, () => {
            if (this.phase === 'prompt') this.hitBall();
        });
    }

    pulseBall() {
        this.tweens.killTweensOf(this.ball);
        this.ball.setScale(this.ballScale || 0.2);
        this.tweens.add({
            targets: this.ball,
            scale: (this.ballScale || 0.2) * 1.18,
            duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
    }

    onTapAnywhere(pointer) {
        if (this.phase !== 'prompt' || !this.ball) return;
        const d = Phaser.Math.Distance.Between(
            pointer.x, pointer.y, this.ball.x, this.ball.y);
        if (d <= this.hitboxRadius) this.hitBall();
    }

    /* ================= the two hits ================= */

    hitBall() {
        if (this.phase !== 'prompt') return;

        this.phase = 'hit';
        this.awaitingHit = false;
        this.shots++;

        this.tweens.killTweensOf(this.ball);
        this.ball.setScale(this.ballScale || 0.2);
        this.ball.disableInteractive();
        this.input.off('pointerdown', this.onTapAnywhere, this);

        this.clearHint();
        this.spotOff();

        // Hand the ball back to the physics engine, then use the genuine
        // deflect: speed boost, score, sound and screen shake.
        this.thawBall();
        this.onBallClick();

        if (this.shots === 1) {
            // Send it back out; checkApproach will catch the return
            this.hintTitle.setText('It comes back - hit it again!');
            this.phase = 'return';
        } else {
            this.hintTitle.setText('Nice!');
            this.phase = 'flying';
            this.time.delayedCall(800, () => this.startHudLessons());
        }
    }

    /* ================= the two HUD lessons ================= */

    startHudLessons() {
        this.phase = 'hud';
        this.freezeBall();
        this.hintTitle.setVisible(false);

        // Lesson 1 - speed boost
        this.spotOn([this.speedText]);
        this.showHint("Watch the speed boost - the ball gets faster every hit");

        this.time.delayedCall(2800, () => {
            // Lesson 2 - hitbox
            this.spotOn([this.countdownText]);
            this.showHint('The hitbox shrinks as time passes - hit it early');

            this.time.delayedCall(2900, () => {
                this.clearHint();
                this.spotOff();
                this.phase = 'done';
                this.time.delayedCall(350, () => this.showResults());
            });
        });
    }

    /* ================= spotlight ================= */

    spotOn(objects) {
        (this.spotRestore || []).forEach(r => r.o.setDepth(r.d));
        this.spotRestore = objects
            .filter(Boolean)
            .map(o => ({ o: o, d: o.depth }));
        this.spotRestore.forEach(r => r.o.setDepth(62));
        this.dim.setVisible(true);
    }

    spotOff() {
        (this.spotRestore || []).forEach(r => r.o.setDepth(r.d));
        this.spotRestore = null;
        this.dim.setVisible(false);
    }

    showHint(text) {
        this.clearHint();

        const t = this.add.text(640, 470, text, {
            fontSize: '27px',
            color: '#ffffff',
            fontStyle: '800',
            align: 'center',
            wordWrap: { width: 900 },
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(63);

        this.hintParts = [t];
        this.tweens.add({
            targets: t, alpha: { from: 0, to: 1 },
            duration: 240, ease: 'Quad.easeOut'
        });
    }

    clearHint() {
        (this.hintParts || []).forEach(o => o.destroy());
        this.hintParts = null;
    }

    /* ================= results ================= */

    showResults() {
        const deflections = this.shots;
        const money = deflections * 3;

        // Bank the reward exactly like a real run
        const currentMoney = parseInt(localStorage.getItem('goalDefenderMoney') || '0', 10);
        localStorage.setItem('goalDefenderMoney', currentMoney + money);

        this.clearHint();
        this.spotOff();
        if (this.hintTitle) this.hintTitle.destroy();

        // Finishing the lesson counts as an achievement.
        // Speed is recorded by the shared onBallClick hook, not faked here.
        if (window.Achievements) {
            window.Achievements.markTutorialDone();
            window.Achievements.evaluate();   // no toast: this screen has its own
        }

        // Fade the live game out behind the summary
        // Hide (do not destroy) the live objects: GameScene.update() still runs
        // and would call setText()/setRadius() on destroyed objects.
        [this.ball, this.hitboxCircle, this.ballTrail, this.scoreText,
         this.countdownText, this.speedText, this.middleLine].forEach(o => {
            if (o && o.setVisible) o.setVisible(false);
        });
        this.dim.destroy();

        /* ---- title ---- */
        this.add.text(640, 116, 'NICE WORK', {
            fontSize: '64px', color: '#000000', fontStyle: '900', alpha: 0.45
        }).setOrigin(0.5);
        this.add.text(640, 112, 'NICE WORK', {
            fontSize: '64px', color: '#ffffff', fontStyle: '900',
            stroke: '#f0a500', strokeThickness: 8
        }).setOrigin(0.5);

        /* ---- stats panel ---- */
        UI.panel(this, {
            x: 640, y: 318, w: 560, h: 250, radius: 22,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: 0x4a6a8a, borderWidth: 2
        });

        this.add.text(640, 232, 'SCORE', {
            fontSize: '16px', color: '#8fa6bd', fontStyle: '800'
        }).setOrigin(0.5);

        this.add.text(640, 276, '' + deflections, {
            fontSize: '58px', color: '#ffffff', fontStyle: '900'
        }).setOrigin(0.5);

        this.add.text(640, 330, 'DEFLECTIONS', {
            fontSize: '15px', color: '#8fa6bd', fontStyle: '800'
        }).setOrigin(0.5);

        this.add.text(640, 364, '' + deflections, {
            fontSize: '30px', color: '#ffffff', fontStyle: '900'
        }).setOrigin(0.5);

        const moneyY = 404;
        this.add.text(640, moneyY, '+ $' + Achievements.fmt(money), {
            fontSize: '30px', color: '#ffd45e', fontStyle: '900'
        }).setOrigin(0.5);

        /* ---- arrow at the money ---- */
        this.moneyArrow = this.add.container(468, moneyY);
        this.moneyArrow.setDepth(70);
        this.buildArrow(this.moneyArrow);
        this.tweens.add({
            targets: this.moneyArrow, x: 448, duration: 620,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        this.add.text(640, 470, 'Make money and buy better balls at the shop', {
            fontSize: '22px', color: '#ffd45e', fontStyle: '800',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(70);

        this.add.text(640, 512, 'Added to your stats', {
            fontSize: '18px', color: '#8fa6bd', fontStyle: '700'
        }).setOrigin(0.5).setDepth(70);

        /* ---- home, blocked until the arrow has been seen ---- */
        this.homeLocked = true;
        this.homeBtn = UI.button(this, {
            x: 640, y: 596, w: 260, h: 70,
            label: 'HOME',
            textSize: 26,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59,
            // Must sit above the grass layer, which renders at depth 11
            depth: 70,
            onClick: () => {
                if (this.homeLocked) {
                    this.tweens.add({
                        targets: this.homeBtn, x: 660, duration: 90,
                        yoyo: true, repeat: 3, ease: 'Sine.easeInOut'
                    });
                    return;
                }
                this.scene.start('MenuScene');
            }
        });

        /* Unlock the button after 1s, not 4s.
         *
         * The button is greyed out and ignores clicks for this whole window,
         * and the results screen appears before it, so a player who finishes
         * quickly was left staring at a dead HOME button for three extra
         * seconds with no indication that it would ever wake up. Long enough
         * to avoid a mis-click straight out of the result animation, short
         * enough that nobody thinks it is broken. */
        this.time.delayedCall(1000, () => {
            this.homeLocked = false;
            this.homeBtn.gdSetFill(0xffb340, 0xf08a1d, 0xffc766);
            this.tweens.add({ targets: this.homeBtn, scale: 1.06, duration: 200,
                yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
        });
    }

    /** Gold arrow pointing right, built from graphics (no emoji). */
    buildArrow(container) {
        const shaft = this.add.graphics();
        shaft.fillStyle(0xffd45e, 1);
        shaft.fillRect(-52, -7, 46, 14);
        container.add(shaft);

        const head = this.add.graphics();
        head.fillStyle(0xffd45e, 1);
        head.fillTriangle(0, -22, 42, 0, 0, 22);
        container.add(head);
    }

    /* ================= helpers ================= */

    // No pause button here. The lesson is a scripted sequence driven by scene
    // timers, and pausing the physics would not stop those - the spotlight
    // steps would advance underneath the pause card.
    createMuteButton() {
        UI.topRight(this, {});
    }

    /** Stop the ball dead without pausing the rest of the world. */
    freezeBall() {
        this.frozen = true;
        if (!this.ball) return;
        this.tweens.killTweensOf(this.ball);
        this.ball.setScale(this.ballScale || 0.2);
        this.ball.setVelocity(0, 0);
        this.ball.body.setAllowGravity(false);
        this.ball.setAngularVelocity(0);
    }

    thawBall() {
        this.frozen = false;
        if (!this.ball) return;
        this.ball.body.setAllowGravity(true);
    }

    /* ================= per-frame ================= */

    update(time, delta) {
        super.update(time, delta);

        if (this.frozen) return;

        if (this.phase === 'approach' || this.phase === 'return') {
            this.checkApproach();
        }
    }

    shutdown() {
        this.tweens.killAll();
        this.clearHint();
    }
}
