/* AccountScene — Part 8.
 *
 * A tabbed modal with three pages:
 *   SIGN UP   username / password / confirm password, each with a reveal eye
 *   LOG IN    username / password, with a reveal eye
 *   ACCOUNT   stats for the signed-in player, plus name change (once a week)
 *
 * Two things this file is careful about, both learned the hard way:
 *
 * 1. UI.button() adds its container to the SCENE, not to a container you pass
 *    it. Clearing `this.body` therefore never removed the previous tab's
 *    buttons, and they piled up on top of each other. Every object a tab
 *    creates is tracked in this.tabObjects and destroyed on switch.
 *
 * 2. Passwords live only in the hidden DOM inputs, never in a Phaser Text, so
 *    they cannot be screenshotted or logged.
 */
class AccountScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AccountScene' });
    }

    init() {
        /* LOG IN is the landing tab, not SIGN UP.
         *
         * Almost everyone opening the account page already has an account and
         * wants straight back in; making them hunt a small grey LOG IN link was
         * a pointless extra tap for the common case. Signup is one click away
         * behind a "DON'T HAVE AN ACCOUNT? SIGN UP" button. */
        this.tab = 'login';
        this.fields = {};
        this.tabObjects = [];
        this.tabTweens = [];
        this.carets = {};
        this.activeCaretKey = null;
        this.inputs = [];
        this.listeners = [];
        this.busy = false;
    }

    /* ---------------- caret focus ---------------- */

    /* Exactly ONE field shows a caret: the one holding keyboard focus.
     *
     * Blinking in every field at once gave no clue which one you were typing
     * in, which is worse than having no caret at all. Unfocused fields have
     * their blink tween paused rather than destroyed, so focusing one is
     * instant and costs nothing.
     */
    showCaret(key) {
        this.activeCaretKey = key;
        const all = this.carets || {};
        Object.keys(all).forEach((k) => {
            const c = all[k];
            const on = (k === key);
            if (on && !c.active) {
                c.active = true;
                c.caret.setVisible(true);
                if (c.tween) c.tween.resume();
            } else if (!on && c.active) {
                c.active = false;
                c.caret.setVisible(false);
                c.caret.setAlpha(1);
                if (c.tween) c.tween.pause();
            }
        });
    }

    /* ---------------- object bookkeeping ---------------- */

    /** Track anything a tab creates so clearTab() can remove all of it. */
    own(obj) {
        this.tabObjects.push(obj);
        return obj;
    }

    clearTab() {
        // Kill repeating tweens BEFORE their targets are destroyed, otherwise a
        // repeat:-1 tween outlives the object and keeps ticking on a dead one.
        (this.tabTweens || []).forEach((t) => { if (t && t.remove) t.remove(); });
        this.tabTweens = [];
        this.tabObjects.forEach((o) => { if (o && o.destroy) o.destroy(); });
        this.tabObjects = [];
        // Blur before detaching, so the browser does not leave focus on a node
        // that is about to disappear (and so no stale caret state survives).
        (this.inputs || []).forEach((el) => { if (el) el.blur(); });
        (this.inputs || []).forEach((el) => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        this.inputs = [];
        this.listeners = [];
        this.fields = {};
        this.carets = {};
        this.activeCaretKey = null;
    }

    create() {
        const cx = 640;

        if (this.textures.exists('background')) {
            const bg = this.add.image(cx, 0, 'background');
            bg.setOrigin(0.5, 0);
            bg.setDisplaySize(1280, 620);
            bg.setAlpha(0.55);
        } else {
            this.cameras.main.setBackgroundColor('#1a1a1a');
        }

        this.add.rectangle(cx, 360, 1280, 720, 0x000000, 0.68);

        this.add.text(cx, 52, 'ACCOUNT', {
            fontSize: '42px', color: '#ffffff', fontStyle: '900',
            stroke: '#f0a500', strokeThickness: 6
        }).setOrigin(0.5);

        // Subtitle sits clear of the tab strip below it.
        this.subtitle = this.add.text(cx, 118, '', {
            fontSize: '17px', color: '#8fa6bd', fontStyle: '700'
        }).setOrigin(0.5);

        // No tab strip here on purpose. Each page already carries its own
        // "ALREADY HAVE AN ACCOUNT? LOG IN" / "NEED AN ACCOUNT? SIGN UP" link
        // underneath the submit button, so a second set of tabs at the top was
        // pure duplication. setTab() still exists - the links call it.

        // Scene furniture, NOT tab content. Registering the panel with own()
        // made clearTab() destroy it on the first render, so the form floated
        // on the stadium art with no panel behind it.
        // Panel now starts higher, since the tab strip above it is gone.
        UI.panel(this, {
            x: cx, y: 372, w: 620, h: 396, radius: 22,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: 0x4a6a8a, borderWidth: 2
        });

        this.statusText = this.add.text(cx, 592, '', {
            fontSize: '16px', color: '#8fa6bd', fontStyle: '700',
            align: 'center', wordWrap: { width: 660 }
        }).setOrigin(0.5);

        /* M2: shared red X instead of a bottom-centre BACK. */
        UI.closeButton(this, {
            x: UI.CLOSE_X, y: UI.CLOSE_Y, r: 22,
            onClick: () => this.close()
        });

        UI.button(this, {
            x: cx, y: 666, w: 190, h: 52,
            label: 'BACK', textSize: UI.TYPE.body,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59, radius: 14,
            onClick: () => this.close()
        });

        this.events.on('shutdown', () => {
            this.clearTab();
            /* Drop the change listener with the scene. The account module keeps
             * listeners in a module-level array with no lifetime of its own, so
             * a listener registered per open and never removed would outlive
             * the scene and fire against a dead object on every future sync. */
            if (this._offAccountChange) {
                this._offAccountChange();
                this._offAccountChange = null;
            }
        });

        /* Re-render the account page when anything changes underneath it.
         *
         * The stats here are a snapshot taken when the page opened. Claiming an
         * achievement, finishing a tournament or a completed sync all announce
         * a change, and without this the numbers sat there stale until the
         * player closed and reopened the page - which reads as the account
         * being broken rather than out of date.
         *
         * Registered per scene instance, not once for the class: an earlier
         * version guarded the registration with a static flag, which meant the
         * FIRST account page ever opened got the listener and every page after
         * it silently did not.
         *
         * Guarded on the account tab: re-rendering while a form is open would
         * wipe the fields the player is typing into. */
        if (window.GDAccount) {
            this._offAccountChange = window.GDAccount.onChange(() => {
                if (this.tab !== 'account') return;
                if (!this.scene || !this.scene.isActive()) return;
                this.renderAccount();
            });
        }

        this.setTab((window.GDAccount && window.GDAccount.isSignedIn()) ? 'account' : this.tab);
    }

    /* ---------------- tabs ---------------- */

    /* Swap pages. Driven by the link at the bottom of each form, since the tab
     * strip at the top was removed as duplicate navigation. */
    setTab(tab) {
        this.clearTab();
        this.tab = tab;

        if (tab === 'account') this.renderAccount();
        else if (tab === 'signup') this.renderSignup();
        else this.renderLogin();
    }

    /* ---------------- field builder ---------------- */

    makeField(key, label, y, opts) {
        opts = opts || {};
        const cx = 640;
        const boxW = 420;

        // Label sits clear ABOVE the box. At y-28 the 13px label straddled the
        // box's top border, and the border cut the glyphs in half.
        this.own(this.add.text(cx - boxW / 2, y - 36, label, {
            fontSize: '13px', color: '#8fa6bd', fontStyle: '800'
        }).setOrigin(0, 0.5));

        this.own(this.add.rectangle(cx, y, boxW, 50, 0x0d1620, 1)
            .setStrokeStyle(2, 0x3d5a73));

        const input = document.createElement('input');
        input.type = opts.password ? 'password' : 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.maxLength = opts.maxLength || 20;

        /* pointer-events:none is essential here.
         *
         * Every field's input was position:fixed at the centre of the viewport,
         * all three stacked on top of each other and on top of the canvas. Any
         * tap in that shared 446x52 region therefore went to whichever input was
         * last in the DOM - always the confirm field. That is why clicking the
         * middle box selected the lower one, and why the reveal eye did nothing
         * at all: the input swallowed the click before Phaser ever saw it.
         *
         * The inputs stay in the DOM only so the mobile keyboard can be raised,
         * which requires a real user-initiated focus(). Which field was tapped
         * is decided by Phaser, using the per-field hit area below. */
        input.style.cssText =
            'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);' +
            'width:380px;height:48px;font-size:18px;' +
            'background:transparent;color:transparent;border:none;' +
            'opacity:0;pointer-events:none;';
        document.body.appendChild(input);
        this.inputs.push(input);

        if (opts.value) input.value = opts.value;

        const shown = this.own(this.add.text(cx + boxW / 2 - 52, y, '', {
            fontSize: '19px', color: '#ffffff',
            fontFamily: UI.FAMILY, fontStyle: '700'
        }).setOrigin(1, 0.5));

        // Drawn caret. The real DOM caret lives in a transparent input and
        // is invisible, which made every field look dead while typing.
        const caret = this.own(this.add.text(cx + boxW / 2 - 52, y, '|', {
            fontSize: '19px', color: '#ffd45e',
            fontFamily: UI.FAMILY, fontStyle: '900'
        }).setOrigin(0, 0.5));

        let revealed = false;
        const paint = () => {
            const text = (!opts.password || revealed)
                ? input.value
                : '•'.repeat(Math.min(input.value.length, 14));
            shown.setText(text);
            shown.setColor(text ? '#ffffff' : '#5a6b7d');
            caret.setPosition(shown.x + 5, y);
        };

        // Blink. The tween starts PAUSED and hidden; showCaret() resumes it for
        // whichever field actually has keyboard focus.
        //
        // Tracked in tabTweens because it repeats forever and clearTab()
        // destroys its target - an untracked repeat:-1 tween would keep ticking
        // against a dead GameObject, one more per tab switch.
        const caretTween = this.tweens.add({
            targets: caret,
            alpha: { from: 1, to: 0.15 },
            duration: 560,
            yoyo: true,
            repeat: -1
        });
        caretTween.pause();
        caret.setVisible(false);
        this.tabTweens.push(caretTween);
        this.carets[key] = { caret: caret, tween: caretTween, active: false };

        // Reveal eye - password fields only. A username has nothing to hide,
        // and the extra icon on every row made the form look cluttered.
        if (opts.password) {
            /* A plain Graphics, NOT a Container wrapping one.
             *
             * Containers default to origin (0.5, 0.5), and once setSize() is
             * called a custom hit area is tested in container-local space where
             * (0,0) sits half a size up and to the left of the container's
             * position. The eye was drawn centred at (824, 330) but only
             * responded to taps in a box centred on (798, 304) - so the top-left
             * of the icon worked and the bottom-right did not, and the player had
             * to click above it to register anything. A bare Graphics has no
             * such offset, so the hit area lines up with the drawing.
             *
             * Above the row hit area, so taps reach the eye and not the field. */
            const eye = this.add.graphics();
            eye.setPosition(cx + boxW / 2 - 26, y);
            eye.setDepth(5);
            const g = eye;
            const drawEye = () => {
                g.clear();
                // Dark backing first, then the lighter almond on top, which
                // gives a clean outline. A single mid-grey ellipse on the dark
                // field just read as a smudge.
                g.fillStyle(0x0a121b, 1);
                g.fillEllipse(0, 0, 32, 21);
                g.fillStyle(revealed ? 0xffd45e : 0xdbe8f4, 1);
                g.fillEllipse(0, 0, 27, 16);
                g.fillStyle(0x0a121b, 1);
                g.fillCircle(0, 0, 6);
                if (!revealed) {
                    g.lineStyle(3.5, 0x0a121b, 1);
                    g.lineBetween(-14, -8, 14, 8);
                }
            };
            drawEye();
            // Graphics has no setSize(), and needs none: the explicit hit area
            // below is what Phaser tests against.
            eye.setInteractive(
                new Phaser.Geom.Rectangle(-26, -26, 52, 52),
                Phaser.Geom.Rectangle.Contains
            );
            eye.on('pointerover', () => eye.setScale(1.12));
            eye.on('pointerout', () => eye.setScale(1));
            eye.on('pointerdown', () => {
                revealed = !revealed;
                input.type = revealed ? 'text' : 'password';
                drawEye();
                paint();
            });
            this.own(eye);
        }


        /* Row tap area. Deliberately stops short of the eye, and sits BELOW the
         * eye in the display list.
         *
         * Both details matter. A full-width hit area drawn on top of the eye
         * swallowed the eye's clicks - Phaser delivers a tap to the topmost
         * interactive object only, so the reveal button was unreachable. */
        const EYE_W = 44;
        const hit = this.add.rectangle(cx - EYE_W / 2, y, boxW - EYE_W, 50, 0xffffff, 0);
        hit.setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => {
            // Show the caret immediately rather than waiting on the focus
            // event, so the field never looks dead for a frame.
            this.showCaret(key);
            try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
        });
        this.own(hit);

        // Focus decides which field owns the caret. Both handlers are deferred
        // by a tick because focus and blur fire in an order that varies between
        // browsers; deferring lets the final DOM state settle first, so the
        // caret lands on the field that actually ended up focused.
        input.addEventListener('focus', () => {
            setTimeout(() => { if (this.fields[key]) this.showCaret(key); }, 0);
        });
        input.addEventListener('blur', () => {
            setTimeout(() => {
                const stillFocused = (this.inputs || []).some(
                    (el) => el === document.activeElement);
                if (!stillFocused) this.showCaret(null);
            }, 0);
        });

        const onInput = () => { paint(); this.showStatus(''); };
        input.addEventListener('input', onInput);
        input.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            this.submit();
        });
        this.listeners.push(onInput);

        this.fields[key] = {
            input: input,
            setValue: (v) => { input.value = v; paint(); }
        };

        paint();

        if (opts.focus) {
            setTimeout(() => {
                try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
            }, 120);
        }
        return this;
    }

    /* ---------------- SIGN UP ---------------- */

    renderSignup() {
        this.subtitle.setText('Save your progress and play on any device');
        this.makeField('username', 'USERNAME', 276, { focus: true, maxLength: 14 });
        this.makeField('password', 'PASSWORD', 354, { password: true });
        this.makeField('confirm', 'CONFIRM PASSWORD', 408, { password: true });

        this.own(UI.button(this, {
            x: 640, y: 480, w: 290, h: 58,
            label: 'SIGN UP', textSize: 21,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a, radius: 15,
            onClick: () => this.submit()
        }));

        this.own(UI.button(this, {
            x: 640, y: 542, w: 400, h: 46,
            label: 'ALREADY HAVE AN ACCOUNT? LOG IN', textSize: 15,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59, radius: 13,
            onClick: () => this.setTab('login')
        }));
    }

    /* ---------------- LOG IN ----------------
     *
     * This is the landing tab. It used to be SIGN UP, which is the wrong way
     * round: almost everyone arriving here already has an account and wants to
     * get back to playing. Being made to hunt for a "LOG IN" link in small grey
     * text was a pointless extra tap for the majority case.
     *
     * The two forms are also now laid out identically - same field positions,
     * same button rows - so switching between them does not move anything. */
    renderLogin() {
        this.subtitle.setText('Welcome back');
        this.makeField('username', 'USERNAME', 276, { focus: true, maxLength: 14 });
        this.makeField('password', 'PASSWORD', 354, { password: true });

        this.own(UI.button(this, {
            x: 640, y: 434, w: 290, h: 58,
            label: 'LOG IN', textSize: 21,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a, radius: 15,
            onClick: () => this.submit()
        }));

        /* Exactly the label that was asked for, and it is the only way into the
         * signup form. */
        this.own(UI.button(this, {
            x: 640, y: 500, w: 400, h: 46,
            label: "DON'T HAVE AN ACCOUNT? SIGN UP", textSize: 15,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59, radius: 13,
            onClick: () => this.setTab('signup')
        }));
    }

    /* ---------------- ACCOUNT ---------------- */

    renderAccount() {
        /* Tear down whatever this function built last time before building it
         * again.
         *
         * renderAccount() APPENDS to tabObjects - every row, divider and button
         * is created fresh and tracked for disposal. That is fine when it runs
         * once per page open, because setTab() clears first. It is not fine
         * when it runs as a live refresh: a re-render stacked a second complete
         * copy of the panel on top of the first, so the old figures stayed on
         * screen directly above the new ones and the page grew every time
         * anything synced. Clearing here makes this function a genuine
         * re-render rather than an append.
         *
         * The subtitle and the tab chrome are not owned by this function, so
         * they survive. There are no input fields on the account tab, so
         * clearing cannot discard anything the player was typing. */
        this.clearTab();

        const A = window.GDAccount;
        const st = A.localStats();
        const fmt = (n) => window.Achievements.fmt(n);

        this.subtitle.setText('Signed in as ' + (A.username() || 'player'));

        /* Totals are DERIVED, never written down.
         *
         * This said "1 of 14" balls and "14 of 30" achievements as string
         * literals, while the shop sold 20 balls and the achievements page
         * counted 39. The account page is where a player checks their progress,
         * so a wrong total there contradicts the Shop and the Achievements page
         * in the same session - it made the Shop look broken and understated the
         * whole collection by a third.
         *
         * Both figures now come from the modules that own them, so adding a ball
         * or an achievement updates this page for free. */
        const achTotal = window.Achievements ? window.Achievements.total() : 0;
        const ballTotal = window.Achievements ? window.Achievements.ballCount() : 0;

        const rows = [
            ['HIGH SCORE', fmt(st.highScore)],
            ['LIFETIME DEFLECTIONS', fmt(st.deflections)],
            ['TROPHIES', String(st.trophies)],
            ['TOURNAMENTS WON', String(st.tournamentsWon)],
            ['MONEY', '$' + fmt(st.money)],
            ['BALLS OWNED', st.ownedBalls.length + ' of ' + ballTotal],
            ['ACHIEVEMENTS', st.achievementsClaimed + ' of ' + achTotal + ' claimed']
        ];

        rows.forEach((r, i) => {
            const y = 232 + i * 36;
            this.own(this.add.text(360, y, r[0], {
                fontSize: UI.TYPE.small + 'px', color: '#8fa6bd', fontStyle: '700'
            }).setOrigin(0, 0.5));
            this.own(this.add.text(920, y, r[1], {
                fontSize: UI.TYPE.body + 'px', color: '#ffffff', fontStyle: '800'
            }).setOrigin(1, 0.5));
            this.own(this.add.rectangle(640, y, 560, 1, 0xffffff, 0.08));
        });

        const canChange = A.canChangeUsername();
        const name = this.own(this.add.text(640, 478, A.username() || 'player', {
            fontSize: '22px', color: '#ffffff', fontStyle: '800'
        }).setOrigin(0.5));

        if (canChange) {
            name.setInteractive({ useHandCursor: true });
            name.on('pointerdown', () => this.openNameChange());
            this.own(this.add.text(640, 506, 'Tap your name to change it (once a week)', {
                fontSize: '13px', color: '#8fa6bd', fontStyle: '700'
            }).setOrigin(0.5));
        } else {
            const hrs = Math.ceil(A.msUntilNameChange() / 3600000);
            const when = hrs > 48 ? Math.ceil(hrs / 24) + ' days' : hrs + ' hours';
            this.own(this.add.text(640, 506, 'Name change available in ' + when, {
                fontSize: '13px', color: '#6c7f92', fontStyle: '700'
            }).setOrigin(0.5));
        }

        // 540 + 24 = 564, inside the panel's 570 bottom edge.
        this.own(UI.button(this, {
            x: 640, y: 540, w: 220, h: 48,
            label: 'SIGN OUT', textSize: 18,
            fillTop: 0xff5a5a, fillBottom: 0xb03a3a, radius: 14,
            onClick: () => this.doSignOut()
        }));
    }

    openNameChange() {
        this.clearTab();
        this.tab = 'account';
        this.subtitle.setText('Change your name (once a week)');
        this.makeField('newname', 'NEW NAME', 340, { focus: true, maxLength: 14 });

        this.own(UI.button(this, {
            x: 540, y: 432, w: 190, h: 54,
            label: 'SAVE', textSize: 18,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a, radius: 14,
            onClick: () => this.doChangeName()
        }));
        this.own(UI.button(this, {
            x: 750, y: 432, w: 190, h: 54,
            label: 'CANCEL', textSize: 18,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59, radius: 14,
            onClick: () => this.setTab('account')
        }));
    }

    doChangeName() {
        const v = this.fields.newname ? this.fields.newname.input.value : '';
        window.GDAccount.changeUsername(v).then((r) => {
            if (!r.ok) { this.showStatus(r.error, '#ff8a8a'); return; }
            this.setTab('account');
            this.showStatus('Name updated.', '#7ee787');
        });
    }

    doSignOut() {
        window.GDAccount.signOut().then(() => {
            this.setTab('login');
            this.showStatus('Signed out. Progress stays on this device.', '#8fa6bd');
        });
    }

    /* ---------------- submit ---------------- */

    submit() {
        if (this.busy) return;
        const A = window.GDAccount;
        const u = this.fields.username ? this.fields.username.input.value : '';
        const p = this.fields.password ? this.fields.password.input.value : '';
        const c = this.fields.confirm ? this.fields.confirm.input.value : '';

        this.busy = true;
        this.showStatus('Working...', '#8fa6bd');

        const done = (r) => {
            this.busy = false;
            if (!r.ok) { this.showStatus(r.error, '#ff8a8a'); return; }
            this.setTab('account');
            this.showStatus(r.isNew
                ? 'Account created. Your progress is saved to it.'
                : ('Welcome back, ' + r.username + '.'), '#7ee787');
        };

        if (this.tab === 'signup') A.signUp(u, p, c).then(done);
        else A.signIn(u, p).then(done);
    }

    showStatus(msg, color) {
        this.statusText.setText(msg || '');
        this.statusText.setColor(color || '#8fa6bd');
    }

    close() {
        this.clearTab();
        this.scene.start('MenuScene');
    }
}