class TournamentMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TournamentMenuScene' });
    }

    create() {

        const groundHeight = 100;
        const groundY = 720;
        const groundTopY = groundY - groundHeight;

        // Background image (sky)
        if (this.textures.exists('background')) {
            const bg = this.add.image(640, 0, 'background');
            bg.setOrigin(0.5, 0);
            bg.setDisplaySize(1280, groundTopY);
            bg.setAlpha(0.7);
        } else {
            this.cameras.main.setBackgroundColor('#87CEEB');
        }

        // Ground at bottom
        if (this.textures.exists('ground')) {
            const ground = this.add.image(640, groundY, 'ground');
            ground.setOrigin(0.5, 1);
            ground.setDisplaySize(1280, groundHeight);
            ground.setAlpha(0.5);
        }

        // Add decorative grass above ground
        if (this.textures.exists('grass')) {
            const grass = this.add.image(640, groundTopY + 3, 'grass');
            grass.setOrigin(0.5, 1);
            grass.setDisplaySize(1280, grass.height);
            grass.setAlpha(0.4);
        }

        // Title: "TOURNAMENT MODE" at (640, 100)
        const title = UI.title(this, {
            text: 'TOURNAMENT MODE', x: 640, y: 96,
            size: UI.TYPE.hero + 8, fill: '#ffcc00',
            stroke: '#000000', thickness: 6, offset: 3
        });

        // Glow/pulse effect on title
        this.tweens.add({
            targets: title,
            scale: { from: 1, to: 1.05 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        /* Whether the player has ever won the Qualifiers Cup.
         *
         * This single flag is the whole Champions Cup unlock. `championsWon` is
         * deliberately NOT read here - winning Champions does not gate anything
         * on this screen, and reading it made it look as though the two flags
         * were interchangeable. Champions wins are tracked separately for the
         * trophy room. */
        const qualifiersWon = localStorage.getItem('tournamentQualifiersWon') === 'true';

        // QUALIFIERS CUP CARD at (400, 350)
        this.createTournamentCard(400, 350, 'Qualifiers Cup', 'QUALIFIERS CUP', 'Round of 16', '', true, 'qualifiers', this);

        /* CHAMPIONS CUP CARD at (880, 350)
         *
         * Unlocked purely by having won the Qualifiers Cup at least once -
         * not by a trophy count. `tournamentQualifiersWon` is set on the first
         * win and is one of the keys synced with the account, so the unlock
         * follows the player to a new device. */
        this.createTournamentCard(880, 350, 'Champions Cup', 'CHAMPIONS CUP', 'Round of 32', '', qualifiersWon, 'champions', this);

        // TROPHIES button
        UI.button(this, {
            /* Was x=1160 with w=150, so its right edge sat at 1235. The mute
             * icon from UI.topRight() is centred at 1236 and is about 32px wide,
             * spanning 1220 to 1252 - a 15px overlap. The two controls were
             * literally touching in the corner. */ 
            x: 1102, y: 56, w: 150, h: 56,
            label: 'TROPHIES',
            textSize: 18,
            fillTop: 0xf0b429, fillBottom: 0xc98a08,
            textColor: 0x1a1a1a,
            radius: 16,
            onClick: () => this.scene.start('TrophyRoomScene')
        });

        // Check if there's an active tournament
        const tournamentActive = localStorage.getItem('tournamentActive') === 'true';
        const currentTournamentMode = localStorage.getItem('tournamentMode');
        const currentRound = localStorage.getItem('tournamentRound');

        // CONTINUE TOURNAMENT button (bottom left) - only show if tournament active
        if (tournamentActive && currentTournamentMode && currentRound) {
            UI.button(this, {
                x: 215, y: 662, w: 300, h: 64,
                label: 'CONTINUE',
                textSize: 22,
                fillTop: 0xff8a3d, fillBottom: 0xd9641b,
                radius: 16,
                onClick: () => {
                    this.scene.start('TournamentBracketScene', {
                        mode: currentTournamentMode,
                        round: currentRound
                    });
                }
            });
        }

        /* Bottom-centre escape hatch back to the main menu.
         *
         * Kept as a navigation control, not a second way into endless mode. A
         * player who came here from the menu and tapped this expecting a run
         * ended up back where they started, which read as a broken button. The
         * label now says what it actually does. */
        UI.button(this, {
            x: 640, y: 662, w: 280, h: 64,
            label: 'MAIN MENU',
            textSize: 22,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59,
            radius: 16,
            onClick: () => this.scene.start('MenuScene')
        });

        // Mute button
        UI.topRight(this, {});
    }

    createTournamentCard(x, y, title, displayTitle, description, difficulty, isUnlocked, mode, scene) {
        // Rounded card, 380x420
        UI.panel(this, {
            x: x, y: y, w: 380, h: 370, radius: 22,
            fillTop: isUnlocked ? 0x22334a : 0x1b2430,
            fillBottom: isUnlocked ? 0x141f2c : 0x111820,
            border: isUnlocked ? 0x4a90c4 : 0x3d4b59,
            borderWidth: 2
        });

        // Trophy image at top - use the real cup art, fall back to icon
        const trophyKey = mode === 'qualifiers' ? 'qualifiers-trophy' : 'champions-trophy';
        let trophyImage = null;

        if (this.textures.exists(trophyKey)) {
            trophyImage = this.add.image(x, y - 102, trophyKey);
            trophyImage.setScale(0.24);
        } else if (this.textures.exists('trophy-icon')) {
            trophyImage = this.add.image(x, y - 102, 'trophy-icon');
            trophyImage.setScale(0.42);
        }
        if (trophyImage && !isUnlocked) trophyImage.setAlpha(0.35).setTint(0x8899aa);

        // Title
        this.add.text(x, y - 8, displayTitle, {
            fontSize: UI.TYPE.lead + 'px',
            color: '#ffffff',
            fontStyle: '900'
        }).setOrigin(0.5);

        // Description
        this.add.text(x, y + 26, description, {
            fontSize: UI.TYPE.small + 'px',
            color: '#9fb3c8',
            fontStyle: '700'
        }).setOrigin(0.5);

        /* Small status line under the Champions Cup title.
         *
         * The wording used to be a fixed string and only the COLOUR changed with
         * the state, so a player who had already won the Qualifiers Cup - the
         * cup was playable, the PLAY button lit - was still told "Win the
         * Qualifiers Cup to unlock". It read as a bug and made players doubt a
         * unlock they had earned. The line now states the actual state. */
        /* Only drawn when the cup is UNLOCKED.
         *
         * This line used to be drawn either way, with the wording changing to
         * 'Win the Qualifiers Cup to unlock' when locked. But the locked block
         * below already draws its own requirement at y + 36 - four pixels away,
         * at a similar size. The two messages rendered on top of each other and
         * read as a single line with a strikethrough through it, which is the
         * one piece of text explaining why the cup is locked. */
        if (mode === 'champions' && isUnlocked) {
            this.add.text(x, y + 52, 'Unlocked', {
                fontSize: UI.TYPE.small + 'px',
                color: '#7f8c99',
                fontStyle: '700'
            }).setOrigin(0.5);
        }

        // PLAY button
        UI.button(this, {
            x: x, y: y + 132, w: 210, h: 62,
            label: 'PLAY',
            textSize: UI.TYPE.lead,
            fillTop: isUnlocked ? 0x3ddc6b : 0x3c4a5a,
            fillBottom: isUnlocked ? 0x17a34a : 0x2a3644,
            radius: 16,
            onClick: isUnlocked ? () => {
                // Check if there's an active tournament of this mode
                const tournamentActive = localStorage.getItem('tournamentActive') === 'true';
                const currentTournamentMode = localStorage.getItem('tournamentMode');

                if (tournamentActive && currentTournamentMode === mode) {
                    // Show continue/new tournament options
                    this.showTournamentOptions(mode);
                } else {
                    // Start new tournament
                    localStorage.setItem('tournamentMode', mode);
                    this.scene.start('TournamentNameScene', { mode: mode });
                }
            } : null
        });

        // Lock overlay if not unlocked
        if (!isUnlocked) {
            // Dim the card
            const lockOverlay = this.add.rectangle(x, y, 380, 370, 0x050a12, 0.55);

            /* Lock badge on a dark disc, centred exactly where the trophy art
             * sits.
             *
             * The lock used to float at y - 60, which landed inside the trophy's
             * own bounds (the art spans roughly y - 193 to y - 39). Half the lock
             * was over the cup and half over the card, so it read as a smudge
             * rather than as "this trophy is locked". A disc behind it makes the
             * intent unambiguous and the card looks designed rather than
             * accidentally dimmed. */
            const badgeY = y - 102;
            const badge = this.add.circle(x, badgeY, 40, 0x050a12, 0.72);
            badge.setStrokeStyle(2, 0x5c6b7d, 0.9);
            if (this.textures.exists('lock-icon')) {
                const lockIcon = this.add.image(x, badgeY, 'lock-icon');
                lockIcon.setScale(0.4);
                lockIcon.setAlpha(0.95);
            }

            // Unlock text
            this.add.text(x, y + 52, 'LOCKED', {
                fontSize: UI.TYPE.lead + 'px',
                color: '#ff8a8a',
                fontStyle: '900'
            }).setOrigin(0.5);

            this.add.text(x, y + 84, 'Win the Qualifiers Cup first', {
                fontSize: UI.TYPE.small + 'px',
                color: '#c9a0a0',
                fontStyle: '700'
            }).setOrigin(0.5);
        }
    }

    showTournamentOptions(mode) {
        // Create overlay
        const overlay = this.add.rectangle(640, 360, 1280, 720, 0x050a12, 0.78);
        overlay.setDepth(100);

        // Rounded dialog box
        const dialogBg = UI.panel(this, {
            x: 640, y: 360, w: 560, h: 400, radius: 24,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: 0x4a6a8a, borderWidth: 2, depth: 101
        });

        // Title
        const tournamentName = mode === 'qualifiers' ? 'QUALIFIERS CUP' : 'CHAMPIONS CUP';
        const title = this.add.text(640, 224, tournamentName, {
            fontSize: '28px',
            color: '#ffd45e',
            fontStyle: '900'
        }).setOrigin(0.5).setDepth(102);

        // Subtitle
        const subtitle = this.add.text(640, 266, 'Tournament in Progress', {
            fontSize: '18px',
            color: '#9fb3c8',
            fontStyle: '700'
        }).setOrigin(0.5).setDepth(102);

        const dialogParts = [overlay, dialogBg, title, subtitle];

        // Continue Tournament button
        const contBtn = UI.button(this, {
            x: 640, y: 340, w: 400, h: 66,
            label: 'CONTINUE TOURNAMENT',
            textSize: 21,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a,
            depth: 102,
            onClick: () => {
                const currentRound = localStorage.getItem('tournamentRound');
                this.scene.start('TournamentBracketScene', {
                    mode: mode,
                    round: currentRound
                });
            }
        });
        dialogParts.push(contBtn);

        // Start New Tournament button
        const newBtn = UI.button(this, {
            x: 640, y: 420, w: 400, h: 66,
            label: 'START NEW TOURNAMENT',
            textSize: 21,
            fillTop: 0xff8a3d, fillBottom: 0xd9641b,
            depth: 102,
            onClick: () => {
                // Clear existing tournament data
                localStorage.setItem('tournamentActive', 'false');
                localStorage.removeItem('tournamentRound');
                localStorage.removeItem('tournamentBracket');

                // Start new tournament
                localStorage.setItem('tournamentMode', mode);
                this.scene.start('TournamentNameScene', { mode: mode });
            }
        });
        dialogParts.push(newBtn);

        // Cancel button
        const cancelBtn = UI.button(this, {
            x: 640, y: 496, w: 220, h: 56,
            label: 'CANCEL',
            textSize: 20,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59,
            depth: 102,
            onClick: () => {
                dialogParts.forEach(function (part) { part.destroy(); });
            }
        });
        dialogParts.push(cancelBtn);
    }

    createMuteButton() {
        UI.topRight(this, {});
    }
}
