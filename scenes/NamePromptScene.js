/* NamePromptScene — shown once, on a player's very first launch.
 *
 * Kept deliberately small: a name field, a PLAY button, and a skip. Blocking
 * the first launch behind typing would lose people before they see the game,
 * so the default is always one tap away.
 */
class NamePromptScene extends Phaser.Scene {
    constructor() {
        super({ key: 'NamePromptScene' });
    }

    init(data) {
        this.nextScene = (data && data.next) || 'MenuScene';
        // Prefill with the stored name when changing it from Settings, or the
        // default on first launch.
        this.initial = (data && typeof data.current === 'string')
            ? data.current
            : (window.GDPlayer ? window.GDPlayer.getName() : 'PLAYER');
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

        this.add.rectangle(cx, 360, 1280, 720, 0x000000, 0.6);

        UI.title(this, {
            text: 'WELCOME', x: cx, y: 146,
            size: UI.TYPE.hero + 2, fill: '#ffffff', stroke: '#f0a500'
        });

        this.add.text(cx, 206, 'What should we call you?', {
            fontSize: UI.TYPE.lead + 'px', color: '#dfe8f0', fontStyle: '700'
        }).setOrigin(0.5);

        UI.panel(this, {
            x: cx, y: 340, w: 560, h: 190, radius: 22,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: 0x4a6a8a, borderWidth: 2
        });

        /* M7: the two text inputs in the game did not match.
         *
         * TournamentNameScene drew a bordered field with a gold ring and a lighter
         * inner panel. This one was a bare dark rectangle with no border at all,
         * so it looked disabled - and it is the FIRST interactive control a new
         * player sees. Now it uses the same treatment: a visible rounded border,
         * the same field colour, and a gold ring that appears on focus.
         *
         * The lighter inner rect the tournament field had was the artefact: it did
         * not match any panel in the game and read as a rendering error. */
        this.fieldFrame = this.add.graphics();
        this.fieldFrame.fillStyle(0x0d1620, 1);
        this.fieldFrame.fillRoundedRect(cx - 240, 288, 480, 68, 14);
        this.fieldFrame.lineStyle(2, 0x4a6a8a, 1);
        this.fieldFrame.strokeRoundedRect(cx - 240, 288, 480, 68, 14);

        this.field = this.add.text(cx, 322, this.initial, {
            fontSize: UI.TYPE.hero - 14,
            color: '#ffffff',
            fontFamily: UI.FAMILY,
            fontStyle: '900',
            fixedWidth: 440,
            align: 'center'
        }).setOrigin(0.5);

        /* Gold focus ring, matching TournamentNameScene. */
        this.focusRing = this.add.graphics();
        this.focusRing.lineStyle(3, 0xf0b429, 1);
        this.focusRing.strokeRoundedRect(cx - 240, 288, 480, 68, 14);
        this.focusRing.setVisible(false);

        // The real DOM input is invisible and non-interactive, so on a phone a
        // tap never lands on it and no keyboard appears. Tapping this Phaser
        // text instead focuses the hidden input, which is a user gesture -
        // the thing mobile browsers require before they will open the keyboard.
        this.field.setInteractive({ useHandCursor: true });
        this.field.on('pointerdown', () => this.focusField());

        this.hint = this.add.text(cx, 396, '', {
            fontSize: UI.TYPE.small + 'px', color: '#8fa6bd', fontStyle: '700'
        }).setOrigin(0.5);

        // Scratch text used only to measure how wide the typed name really is.
        // The caret has to ride the end of the glyphs, and the field is a
        // CENTRED fixedWidth text - so a guessed per-character width is wrong
        // by a growing amount as the name gets longer. Measuring is the only
        // correct way. Never visible.
        this.measure = this.add.text(0, 0, '', {
            fontSize: '40px',
            fontFamily: UI.FAMILY,
            fontStyle: '900'
        }).setVisible(false);

        this.typing = '';

        // Phaser needs the DOM input attached to a canvas; a hidden field is
        // the only reliable way to raise the mobile keyboard.
        this.domInput = document.createElement('input');
        this.domInput.type = 'text';
        this.domInput.maxLength = window.GDPlayer ? window.GDPlayer.MAX_NAME : 14;
        this.domInput.autocomplete = 'off';
        this.domInput.autocapitalize = 'characters';
        this.domInput.spellcheck = false;
        this.domInput.style.cssText =
            'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);' +
            'width:460px;height:64px;font-size:40px;text-align:center;' +
            'opacity:0;pointer-events:none;background:transparent;color:transparent;';
        document.body.appendChild(this.domInput);

        this.domInput.addEventListener('input', () => {
            this.setTyping(this.domInput.value);
        });

        /* Focus and blur drive the caret. Phaser only repaints on input, so
         * without these the bar would never appear on tap, or would linger after
         * the field lost focus. Both are deferred a tick because the blur/focus
         * ordering when moving between elements varies by browser. */
        this.domInput.addEventListener('focus', () => {
            setTimeout(() => this.refresh(), 0);
        });
        this.domInput.addEventListener('blur', () => {
            setTimeout(() => this.refresh(), 0);
        });

        // Enter confirms, Escape skips.
        this.input.keyboard.on('keydown-ENTER', () => this.commit());
        this.input.keyboard.on('keydown-ESC', () => this.skip());
        this.domInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.commit(); }
            if (e.key === 'Escape') { e.preventDefault(); this.skip(); }
        });

        // On-screen keyboard shows/hide changes the viewport on mobile.
        this.events.on('shutdown', () => this.cleanup());

        UI.button(this, {
            x: cx, y: 500, w: 280, h: 68,
            label: 'PLAY',
            textSize: UI.TYPE.lead,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a,
            radius: 18,
            onClick: () => this.commit()
        });

        UI.button(this, {
            x: cx, y: 596, w: 220, h: 56,
            label: 'SKIP',
            textSize: 20,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59,
            radius: 16,
            onClick: () => this.skip()
        });

        this.refresh();

        // Do NOT steal focus on open. Autofocusing left a caret blinking in a
        // box nobody had tapped. The player taps the field - or starts typing,
        // handled just below - and only then does it light up.
        this.input.keyboard.on('keydown', () => this.focusField());
    }

    /* Focusing the hidden input is what raises the mobile keyboard - browsers
     * only open it for a real user gesture, so the tap on the Phaser text has to
     * trigger this. Keyboard focus and caret visibility are separate concerns:
     * refresh() re-checks whether focus actually took, so a browser that refuses
     * the programmatic focus leaves no caret behind. */
    focusField() {
        if (!this.domInput) return;
        // M7: show the gold ring on focus, matching the tournament name field.
        if (this.focusRing) this.focusRing.setVisible(true);
        try {
            this.domInput.focus({ preventScroll: true });
        } catch (e) {
            this.domInput.focus();
        }
        if (this.domInput.setSelectionRange) {
            const n = this.domInput.value.length;
            try { this.domInput.setSelectionRange(n, n); } catch (e) { /* ignore */ }
        }
        this.refresh();
    }

    setTyping(raw) {
        const max = window.GDPlayer ? window.GDPlayer.MAX_NAME : 14;
        // Filter as they type so the caret position stays predictable.
        const clean = window.GDPlayer
            ? window.GDPlayer.sanitize(raw).slice(0, max)
            : String(raw).slice(0, max);

        if (this.domInput && this.domInput.value !== clean) {
            this.domInput.value = clean;
        }
        this.typing = clean;
        this.refresh();
    }

    refresh() {
        const max = window.GDPlayer ? window.GDPlayer.MAX_NAME : 14;
        const shown = this.typing;
        this.field.setText(shown || ' ');
        this.field.setColor(shown ? '#ffffff' : '#5a6b7d');

        // Drawn caret. The real DOM caret lives inside a transparent input and
        // cannot be seen, so without this the field looked dead while typing.
        if (!this.caretBar) {
            this.caretBar = this.add.text(640, 322, '|', {
                fontSize: '40px', color: '#ffd45e',
                fontFamily: UI.FAMILY, fontStyle: '900'
            }).setOrigin(0, 0.5).setVisible(false);
            // The scene's own tween manager is destroyed on shutdown, so this
            // repeat:-1 tween needs no manual cleanup here.
            this.caretTween = this.tweens.add({
                targets: this.caretBar,
                alpha: { from: 1, to: 0.15 },
                duration: 560, yoyo: true, repeat: -1
            });
            this.caretTween.pause();
        }

        // Ride the real glyph run: measure the string, then offset from the
        // centre of the fixedWidth box by half that run.
        this.measure.setText(shown);
        const runHalf = this.measure.width / 2;
        this.caretBar.setPosition(this.field.x + runHalf + 6, this.field.y);

        /* The caret belongs to the focused field only. It used to be visible
         * from the moment the scene opened, so it kept blinking in a box nobody
         * had tapped - which read as a glitch rather than a cursor. */
        const focused = !!(this.domInput && document.activeElement === this.domInput);
        this.caretBar.setVisible(focused && shown.length < max);
        if (focused) {
            if (this.caretTween.isPaused()) this.caretTween.resume();
        } else {
            this.caretTween.pause();
            this.caretBar.setAlpha(1);
        }

        this.hint.setText(shown ? shown.length + ' / ' + max
            : 'Default: ' + (window.GDPlayer ? window.GDPlayer.DEFAULT_NAME : 'PLAYER'));
        this.hint.setColor(shown ? '#ffd45e' : '#8fa6bd');
    }

    /* The caret follows real DOM focus, polled every frame rather than driven
     * only by focus/blur events.
     *
     * Events alone were not enough: blur does not reliably fire when the field
     * loses focus by other routes - the mobile keyboard closing, the window
     * losing focus, a browser reclaiming focus - and the caret was then left
     * blinking in a box nobody was in. Reading document.activeElement is the
     * truth, and it costs one comparison. */
    update() {
        if (!this.caretBar || !this.domInput) return;
        const focused = document.activeElement === this.domInput;
        const wantVisible = focused && this.typing.length < (window.GDPlayer ? window.GDPlayer.MAX_NAME : 14);
        if (wantVisible === this.caretBar.visible
            && (focused === !this.caretTween.isPaused())) return;
        this.refresh();
    }

    commit() {
        const name = (this.typing || '').trim();
        if (window.GDPlayer) {
            if (name) window.GDPlayer.setName(name);
            else window.GDPlayer.setName(window.GDPlayer.DEFAULT_NAME);
        }
        this.cleanup();
        this.scene.start(this.nextScene);
    }

    skip() {
        if (window.GDPlayer) window.GDPlayer.setName(window.GDPlayer.DEFAULT_NAME);
        this.cleanup();
        this.scene.start(this.nextScene);
    }

    cleanup() {
        if (this.domInput && this.domInput.parentNode) {
            this.domInput.parentNode.removeChild(this.domInput);
            this.domInput = null;
        }
    }
}