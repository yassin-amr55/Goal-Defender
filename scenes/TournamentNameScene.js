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

        // Tournament mode display at (640, 150)
        const modeColor = this.tournamentMode === 'qualifiers' ? '#c0c0c0' : '#ffd700'; // Silver or gold
        const modeText = this.tournamentMode === 'qualifiers' ? 'QUALIFIERS CUP' : 'CHAMPIONS CUP';

        this.add.text(642, 152, modeText, {
            fontSize: '32px',
            fill: '#000000',
            fontStyle: 'bold',
            alpha: 0.5
        }).setOrigin(0.5);

        this.add.text(640, 150, modeText, {
            fontSize: '32px',
            fill: modeColor,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Title at (640, 200)
        this.add.text(642, 202, 'ENTER YOUR TEAM NAME', {
            fontSize: '48px',
            fill: '#000000',
            fontStyle: 'bold',
            alpha: 0.5
        }).setOrigin(0.5);

        this.add.text(640, 200, 'ENTER YOUR TEAM NAME', {
            fontSize: '48px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5);

        // Input box background at (640, 360)
        // Rounded backing panel behind the HTML input
        UI.panel(this, {
            x: 640, y: 360, w: 540, h: 92, radius: 20,
            fillTop: 0x0d1723, fillBottom: 0x080f18,
            border: 0xf0b429, borderWidth: 2, depth: 8
        });

        // Create HTML input element overlay
        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.placeholder = 'Your Team Name...';
        inputElement.maxLength = '20';
        inputElement.id = 'tournament-name-input';

        // Match the in-game UI: dark field, gold border, Nunito
        inputElement.style.position = 'absolute';
        inputElement.style.left = '50%';
        inputElement.style.top = '50%';
        inputElement.style.transform = 'translate(-50%, -50%)';
        inputElement.style.width = '500px';
        inputElement.style.height = '72px';
        inputElement.style.fontSize = '30px';
        inputElement.style.padding = '10px 18px';
        inputElement.style.border = '3px solid #f0b429';
        inputElement.style.borderRadius = '14px';
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

        document.body.appendChild(inputElement);
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
                inputElement.remove();

                // Start tournament bracket scene
                this.scene.start('TournamentBracketScene', { mode: this.tournamentMode });
            }
        });

        // BACK button
        UI.button(this, {
            x: 640, y: 578, w: 220, h: 64,
            label: 'BACK',
            textSize: 24,
            fillTop: 0x5a6b7d, fillBottom: 0x3d4b59,
            radius: 16,
            onClick: () => {
                inputElement.remove();
                this.scene.start('TournamentMenuScene');
            }
        });

        // Mute button
        UI.topRight(this, {});
    }

    // Phaser does not call methods named shutdown()/stop() automatically.
    // These are the real lifecycle hooks, so the <input> is always cleaned up.
    shutdown() {
        this.removeInputElement();
    }

    stop() {
        this.removeInputElement();
    }

    removeInputElement() {
        if (this.inputElement && this.inputElement.parentNode) {
            this.inputElement.remove();
        }
        this.inputElement = null;
    }
}
