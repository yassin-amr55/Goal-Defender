class TournamentNameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TournamentNameScene' });
    }

    init(data) {
        this.tournamentMode = data.mode || 'qualifiers';
    }

    create() {

        const groundHeight = 100;
        const groundY = 720;
        const groundTopY = groundY - groundHeight;

        // Background
        if (this.textures.exists('background')) {
            const bg = this.add.image(640, 0, 'background');
            bg.setOrigin(0.5, 0);
            bg.setDisplaySize(1280, groundTopY);
            bg.setAlpha(0.7);
        } else {
            this.cameras.main.setBackgroundColor('#87CEEB');
        }

        // Ground
        if (this.textures.exists('ground')) {
            const ground = this.add.image(640, groundY, 'ground');
            ground.setOrigin(0.5, 1);
            ground.setDisplaySize(1280, groundHeight);
            ground.setAlpha(0.5);
        }

        // Grass
        if (this.textures.exists('grass')) {
            const grass = this.add.image(640, groundTopY + 3, 'grass');
            grass.setOrigin(0.5, 1);
            grass.setDisplaySize(1280, grass.height);
            grass.setAlpha(0.4);
        }

        /* M6: "QUALIFIERS CUP" sat at y=150 and "ENTER YOUR TEAM NAME" at y=200 -
         * 50px apart, with a 48px instruction over a 32px context. Their glyphs
         * physically overlapped, and the INSTRUCTION was the larger of the two,
         * which inverts the hierarchy: the cup is the context, the instruction is
         * the action.
         *
         * Now the context is a small tertiary label at y=132 and the instruction
         * is the title at y=184, 52px below it with no overlap. */
        const modeColor = this.tournamentMode === 'qualifiers' ? '#c0c0c0' : '#ffd700';
        const modeText = this.tournamentMode === 'qualifiers' ? 'QUALIFIERS CUP' : 'CHAMPIONS CUP';

        this.add.text(640, 132, modeText, {
            fontSize: UI.TYPE.body + 'px',
            color: modeColor,
            fontFamily: UI.FAMILY,
            fontStyle: '900',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        UI.title(this, {
            text: 'ENTER YOUR TEAM NAME', x: 640, y: 186,
            size: UI.TYPE.title + 8, fill: '#ffffff',
            stroke: '#000000', thickness: 5
        });

        /* M7: the lighter inner rect behind the DOM input did not match any panel
         * in the game and read as a rendering artefact. The field colour now
         * matches NamePromptScene's exactly, so the two name inputs are
         * identical: same panel colour, same border, same radius, same focus
         * ring. */
        UI.panel(this, {
            x: 640, y: 360, w: 540, h: 92, radius: 20,
            fillTop: 0x0d1620, fillBottom: 0x0d1620,
            border: 0x4a6a8a, borderWidth: 2, depth: 8
        });

        // Create HTML input element overlay
        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.placeholder = 'Your Team Name...';
        inputElement.maxLength = '20';
        inputElement.id = 'tournament-name-input';

        /* Match the in-game UI: dark field, gold border, Nunito.
         *
         * Size and position are NOT set here. This used to be centred with
         * left:50%/top:50%, which centres on the VIEWPORT - so on an upright
         * phone, where layout.js turns the canvas 90 degrees and the player is
         * looking at the game sideways, the textbox stayed upright and sat
         * perpendicular to everything around it.
         *
         * GDLayout.registerOverlay() locks the field to the rectangle below in
         * GAME coordinates and applies the same scale AND the same rotation as
         * the canvas, and re-places it if the phone is turned mid-typing. */
        inputElement.style.position = 'absolute';
        inputElement.style.margin = '0';
        inputElement.style.background = 'rgba(8,15,24,0.95)';
        inputElement.style.color = '#ffffff';
        inputElement.style.fontWeight = '700';
        inputElement.style.textAlign = 'center';
        inputElement.style.fontFamily = UI.FAMILY;
        inputElement.style.boxSizing = 'border-box';
        inputElement.style.zIndex = '9998';
        inputElement.style.outline = 'none';
        inputElement.style.boxShadow = 'none';
        inputElement.style.caretColor = '#ffd45e';
        inputElement.style.transformOrigin = 'center center';

        document.body.appendChild(inputElement);
        this.registerCleanup();

        // Same rectangle the backing panel above is drawn at.
        this.unregisterOverlay = (window.GDLayout && window.GDLayout.registerOverlay)
            ? window.GDLayout.registerOverlay(inputElement, {
                x: 640 - 500 / 2, y: 360 - 72 / 2, w: 500, h: 72,
                fontPx: 30, padY: 10, radius: 14, borderW: 3, borderColor: '#f0b429'
            })
            : null;

        inputElement.focus();

        // Store reference for cleanup
        this.inputElement = inputElement;

        // START TOURNAMENT button
        const startBtn = UI.button(this, {
            x: 640, y: 486, w: 360, h: 76,
            label: 'START TOURNAMENT',
            textSize: 24,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a,
            onClick: () => {
                if (inputElement.value.trim().length === 0) return;
                // Save team name and initialize tournament
                const teamName = inputElement.value.trim();
                localStorage.setItem('tournamentTeamName', teamName);
                localStorage.setItem('tournamentMode', this.tournamentMode);
                localStorage.setItem('tournamentActive', 'true');

                // Set initial round
                const initialRound = this.tournamentMode === 'qualifiers' ? 'roundOf16' : 'roundOf32';
                localStorage.setItem('tournamentRound', initialRound);

                // Clear any existing bracket to force regeneration
                localStorage.removeItem('tournamentBracket');

                // Reset per-tournament stats, otherwise the victory screen
                // shows totals accumulated across every tournament ever played
                localStorage.setItem('tournamentProgress', JSON.stringify({
                    matchesWon: 0,
                    totalDeflects: 0,
                    moneyEarned: 0
                }));


                // Count the tournament for the achievement system
                if (window.Achievements) {
                    window.Achievements.addTournamentPlayed();
                    window.Achievements.check(this);
                }

                // Remove input element
                this.removeInputElement();

                // Start tournament bracket scene
                this.scene.start('TournamentBracketScene', { mode: this.tournamentMode });
            }
        });

        /* M2: shared red X instead of a bottom-centre BACK, so closing is in the
         * same place on every sub-screen. */
        UI.closeButton(this, {
            x: 1240, y: 40, r: 22,
            onClick: () => this.scene.start('TournamentMenuScene')
        });

        UI.button(this, {
            x: 640, y: 578, w: 220, h: 64,
            label: 'BACK',
            textSize: UI.TYPE.lead,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59,
            radius: 16,
            onClick: () => {
                this.removeInputElement();
                this.scene.start('TournamentMenuScene');
            }
        });

        // Mute button
        UI.topRight(this, {});
    }

    /* Phaser 3 does NOT call a method named shutdown() or stop(). Only the
     * 'shutdown' event fires, so a scene that cleaned up in those methods never
     * cleaned up at all - and the <input> stayed in the document forever.
     *
     * That is not just a leak. Each visit added another live textbox, and the
     * stale ones were positioned by the OLD fixed centering, which does not
     * rotate with the canvas. Leaving this screen twice meant a correctly
     * oriented field with a portrait one sitting on top of it, which is
     * exactly what it looked like on a phone.
     *
     * 'destroy' is registered as well so the node is released even if the
     * scene is torn down without a clean shutdown. removeInputElement() is
     * idempotent, so both paths are safe. */
    registerCleanup() {
        this.events.on('shutdown', () => this.removeInputElement());
        this.events.on('destroy', () => this.removeInputElement());
    }

    removeInputElement() {
        /* Drop the layout registration BEFORE removing the node.
         *
         * The overlay list is module-level and outlives this scene, so a
         * removed input left in it would keep being positioned on every resize
         * and rotation - a write to a detached element, once per input per
         * relayout, for the rest of the session. Every exit path (start,
         * back, shutdown, stop) funnels through here. */
        if (this.unregisterOverlay) {
            this.unregisterOverlay();
            this.unregisterOverlay = null;
        }
        if (this.inputElement && this.inputElement.parentNode) {
            this.inputElement.remove();
        }
        this.inputElement = null;
    }
}
