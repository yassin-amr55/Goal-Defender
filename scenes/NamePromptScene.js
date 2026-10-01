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

        this.add.text(cx, 150, 'WELCOME', {
            fontSize: '56px', color: '#000000', fontStyle: '900', alpha: 0.45
        }).setOrigin(0.5);

        this.add.text(cx, 146, 'WELCOME', {
            fontSize: '56px', color: '#ffffff', fontStyle: '900',
            stroke: '#f0a500', strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(cx, 206, 'What should we call you?', {
            fontSize: '24px', color: '#dfe8f0', fontStyle: '700'
        }).setOrigin(0.5);

        UI.panel(this, {
            x: cx, y: 340, w: 560, h: 190, radius: 22,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: 0x4a6a8a, borderWidth: 2
        });

        this.field = this.add.text(cx, 322, this.initial, {
            fontSize: '40px',
            color: '#ffffff',
            fontFamily: UI.FAMILY,
            fontStyle: '900',
            backgroundColor: '#0d1620',
            padding: { x: 24, y: 14 },
            fixedWidth: 460,
            align: 'center'
        }).setOrigin(0.5);

        // The real DOM input is invisible and non-interactive, so on a phone a
        // tap never lands on it and no keyboard appears. Tapping this Phaser
        // text instead focuses the hidden input, which is a user gesture -
        // the thing mobile browsers require before they will open the keyboard.
        this.field.setInteractive({ useHandCursor: true });
        this.field.on('pointerdown', () => this.focusField());

        this.hint = this.add.text(cx, 396, '', {
            fontSize: '16px', color: '#8fa6bd', fontStyle: '700'
        }).setOrigin(0.5);

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

        this.focusField();

        this.domInput.addEventListener('input', () => {
            this.setTyping(this.domInput.value);
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
            textSize: 26,
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
    }

    focusField() {
        if (!this.domInput) return;
        try {
            this.domInput.focus({ preventScroll: true });
        } catch (e) {
            this.domInput.focus();
        }
        if (this.domInput.setSelectionRange) {
            const n = this.domInput.value.length;
            try { this.domInput.setSelectionRange(n, n); } catch (e) { /* ignore */ }
        }
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

        // Caret rides the end of the text.
        this.hint.setText(shown ? shown.length + ' / ' + max
            : 'Default: ' + (window.GDPlayer ? window.GDPlayer.DEFAULT_NAME : 'PLAYER'));
        this.hint.setColor(shown ? '#ffd45e' : '#8fa6bd');
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