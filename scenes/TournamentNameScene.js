class TournamentNameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TournamentNameScene' });
    }

    init(data) {
        this.tournamentMode = data.mode || 'qualifiers';
        console.log('TournamentNameScene initialized with mode:', this.tournamentMode);
    }

    create() {
        console.log('TournamentNameScene created');
        
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
        const inputBg = this.add.rectangle(640, 360, 500, 80, 0xffffff, 1);
        inputBg.setStrokeStyle(4, 0x000000);

        // Create HTML input element overlay
        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.placeholder = 'Your Team Name...';
        inputElement.maxLength = '20';
        inputElement.id = 'tournament-name-input';
        
        // Style the input
        inputElement.style.position = 'absolute';
        inputElement.style.left = '50%';
        inputElement.style.top = '50%';
        inputElement.style.transform = 'translate(-50%, -50%)';
        inputElement.style.width = '500px';
        inputElement.style.height = '80px';
        inputElement.style.fontSize = '32px';
        inputElement.style.padding = '10px';
        inputElement.style.border = '4px solid #000000';
        inputElement.style.backgroundColor = '#ffffff';
        inputElement.style.color = '#000000';
        inputElement.style.fontWeight = 'bold';
        inputElement.style.textAlign = 'center';
        inputElement.style.fontFamily = 'Arial, sans-serif';
        inputElement.style.boxSizing = 'border-box';
        inputElement.style.zIndex = '9998';
        
        document.body.appendChild(inputElement);
        inputElement.focus();

        // Store reference for cleanup
        this.inputElement = inputElement;

        // START TOURNAMENT button at (640, 480) - wider and slightly smaller text
        const startBg = this.add.rectangle(640, 480, 360, 70, 0x00aa00, 1);
        startBg.setStrokeStyle(4, 0x00ff00);
        startBg.setInteractive();

        const startText = this.add.text(640, 480, 'START TOURNAMENT', {
            fontSize: '28px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        startBg.on('pointerover', () => {
            if (inputElement.value.length > 0) {
                startBg.setScale(1.05);
                startBg.setFillStyle(0x00ff00);
            }
        });

        startBg.on('pointerout', () => {
            startBg.setScale(1);
            startBg.setFillStyle(0x00aa00);
        });

        startBg.on('pointerdown', () => {
            if (inputElement.value.length > 0) {
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
                
                console.log('Starting new tournament:', { teamName, mode: this.tournamentMode, round: initialRound });

                // Remove input element
                inputElement.remove();

                // Start tournament bracket scene
                this.scene.start('TournamentBracketScene', { mode: this.tournamentMode });
            }
        });

        // BACK button at (640, 570)
        const backBg = this.add.rectangle(640, 570, 200, 60, 0x666666, 1);
        backBg.setStrokeStyle(3, 0x999999);
        backBg.setInteractive();

        const backText = this.add.text(640, 570, 'BACK', {
            fontSize: '28px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        backBg.on('pointerover', () => {
            backBg.setScale(1.05);
            backBg.setFillStyle(0x888888);
        });

        backBg.on('pointerout', () => {
            backBg.setScale(1);
            backBg.setFillStyle(0x666666);
        });

        backBg.on('pointerdown', () => {
            // Remove input element
            inputElement.remove();
            this.scene.start('TournamentMenuScene');
        });

        // Mute button
        this.createMuteButton();
    }

    createMuteButton() {
        const x = 1230;
        const y = 30;
        
        const muteButton = this.add.image(x, y, isMuted ? 'volume-mute' : 'volume-unmute');
        muteButton.setScale(0.08);
        muteButton.setInteractive();

        muteButton.on('pointerover', () => {
            muteButton.setScale(0.1);
        });

        muteButton.on('pointerout', () => {
            muteButton.setScale(0.08);
        });

        muteButton.on('pointerdown', () => {
            isMuted = !isMuted;
            localStorage.setItem('goalDefenderMuted', isMuted);
            muteButton.setTexture(isMuted ? 'volume-mute' : 'volume-unmute');
        });
    }

    shutdown() {
        // Clean up input element if it exists
        if (this.inputElement && this.inputElement.parentNode) {
            this.inputElement.remove();
        }
    }

    stop() {
        this.shutdown();
    }
}
