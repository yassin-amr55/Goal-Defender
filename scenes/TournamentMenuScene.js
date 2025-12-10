class TournamentMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TournamentMenuScene' });
    }

    create() {
        console.log('TournamentMenuScene created');
        
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
        this.add.text(642, 102, 'TOURNAMENT MODE', {
            fontSize: '64px',
            fill: '#000000',
            fontStyle: 'bold',
            alpha: 0.5
        }).setOrigin(0.5);

        const title = this.add.text(640, 100, 'TOURNAMENT MODE', {
            fontSize: '64px',
            fill: '#ffcc00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6,
            shadow: {
                offsetX: 3,
                offsetY: 3,
                color: '#000000',
                blur: 5,
                fill: true
            }
        }).setOrigin(0.5);

        // Glow/pulse effect on title
        this.tweens.add({
            targets: title,
            scale: { from: 1, to: 1.05 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Check if trophies are won
        const qualifiersWon = localStorage.getItem('tournamentQualifiersWon') === 'true';
        const championsWon = localStorage.getItem('tournamentChampionsWon') === 'true';

        // QUALIFIERS CUP CARD at (400, 350)
        this.createTournamentCard(400, 350, 'Qualifiers Cup', 'QUALIFIERS CUP', 'Round of 16', '', true, 'qualifiers', this);

        // CHAMPIONS CUP CARD at (880, 350)
        this.createTournamentCard(880, 350, 'Champions Cup', 'CHAMPIONS CUP', 'Round of 32', '', qualifiersWon, 'champions', this, qualifiersWon);

        // TROPHIES button (top right) at (1180, 50)
        const trophiesBg = this.add.rectangle(1180, 50, 120, 60, 0xffcc00, 1);
        trophiesBg.setStrokeStyle(3, 0xffa500);
        trophiesBg.setInteractive();

        const trophiesIcon = this.add.text(1180, 25, '🏆', {
            fontSize: '32px'
        }).setOrigin(0.5);

        const trophiesText = this.add.text(1180, 55, 'TROPHIES', {
            fontSize: '16px',
            fill: '#000000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        trophiesBg.on('pointerover', () => {
            trophiesBg.setScale(1.05);
        });

        trophiesBg.on('pointerout', () => {
            trophiesBg.setScale(1);
        });

        trophiesBg.on('pointerdown', () => {
            this.scene.start('TrophyRoomScene');
        });

        // Check if there's an active tournament
        const tournamentActive = localStorage.getItem('tournamentActive') === 'true';
        const currentTournamentMode = localStorage.getItem('tournamentMode');
        const currentRound = localStorage.getItem('tournamentRound');

        // CONTINUE TOURNAMENT button (bottom left) - only show if tournament active
        if (tournamentActive && currentTournamentMode && currentRound) {
            const continueBg = this.add.rectangle(200, 650, 300, 70, 0xff6600, 1);
            continueBg.setStrokeStyle(4, 0xff9900);
            continueBg.setInteractive();

            const continueText = this.add.text(200, 650, 'CONTINUE TOURNAMENT', {
                fontSize: '24px',
                fill: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 4,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#000000',
                    blur: 3,
                    fill: true
                }
            }).setOrigin(0.5);

            continueBg.on('pointerover', () => {
                continueBg.setScale(1.05);
                continueBg.setFillStyle(0xff9900); // Brighter orange on hover
            });

            continueBg.on('pointerout', () => {
                continueBg.setScale(1);
                continueBg.setFillStyle(0xff6600); // Original orange
            });

            continueBg.on('pointerdown', () => {
                // Continue the active tournament
                this.scene.start('TournamentBracketScene', {
                    mode: currentTournamentMode,
                    round: currentRound
                });
            });
        }

        // INFINITE MODE button (bottom center) at (640, 650)
        const infiniteBg = this.add.rectangle(640, 650, 280, 70, 0x00aa00, 1);
        infiniteBg.setStrokeStyle(4, 0x00ff00);
        infiniteBg.setInteractive();

        const infiniteText = this.add.text(640, 650, 'INFINITE MODE', {
            fontSize: '28px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 5,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#000000',
                blur: 3,
                fill: true
            }
        }).setOrigin(0.5);

        infiniteBg.on('pointerover', () => {
            infiniteBg.setScale(1.05);
            infiniteBg.setFillStyle(0x00ff00); // Brighter green on hover
        });

        infiniteBg.on('pointerout', () => {
            infiniteBg.setScale(1);
            infiniteBg.setFillStyle(0x00aa00); // Original green
        });

        infiniteBg.on('pointerdown', () => {
            // Go to MenuScene
            this.scene.start('MenuScene');
        });

        // Mute button
        this.createMuteButton();
    }

    createTournamentCard(x, y, title, displayTitle, description, difficulty, isUnlocked, mode, scene, isLockedChampions = false) {
        // Card background: 350×400px
        const cardBg = this.add.rectangle(x, y, 350, 400, isUnlocked ? 0x4488cc : 0x555555, 1);
        cardBg.setStrokeStyle(4, isUnlocked ? 0x66aaff : 0x888888);

        // Trophy image at top (y=250) - use actual trophy image if exists
        const trophyKey = mode === 'qualifiers' ? 'qualifiers-trophy' : 'champions-trophy';
        let trophyImage = null;

        if (this.textures.exists(trophyKey)) {
            trophyImage = this.add.image(x, y - 100, trophyKey);
            trophyImage.setScale(0.3);
        } else {
            // Fallback: use emoji
            const trophyEmoji = this.add.text(x, y - 100, '🏆', {
                fontSize: '60px'
            }).setOrigin(0.5);
        }

        // Title (y=340): "QUALIFIERS CUP" or "CHAMPIONS CUP" - 32px
        const titleText = this.add.text(x, y - 10, displayTitle, {
            fontSize: '32px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Description (y=370): "Round of 16" or "Round of 32" - 20px gray
        const descText = this.add.text(x, y + 20, description, {
            fontSize: '20px',
            fill: '#cccccc'
        }).setOrigin(0.5);

        // Add small unlock text for Champions Cup (always visible)
        if (mode === 'champions') {
            const unlockHintText = this.add.text(x, y + 50, 'Must win Qualifiers Cup to unlock', {
                fontSize: '14px',
                fill: isUnlocked ? '#888888' : '#ff6666',
                fontStyle: 'italic'
            }).setOrigin(0.5);
        }

        // PLAY button at (y=480) - 200×60px green if unlocked
        const buttonColor = isUnlocked ? 0x00aa00 : 0x555555;
        const buttonBorder = isUnlocked ? 0x00ff00 : 0x888888;
        const playBg = this.add.rectangle(x, y + 130, 200, 60, buttonColor, 1);
        playBg.setStrokeStyle(3, buttonBorder);

        if (isUnlocked) {
            playBg.setInteractive();
        }

        const playText = this.add.text(x, y + 130, 'PLAY', {
            fontSize: '32px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        if (isUnlocked) {
            playBg.on('pointerover', () => {
                playBg.setScale(1.05);
                playBg.setFillStyle(0x00ff00);
            });

            playBg.on('pointerout', () => {
                playBg.setScale(1);
                playBg.setFillStyle(0x00aa00);
            });

            playBg.on('pointerdown', () => {
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
            });
        }

        // Lock overlay if not unlocked
        if (!isUnlocked && isLockedChampions) {
            // Semi-transparent overlay
            const lockOverlay = this.add.rectangle(x, y, 350, 400, 0x000000, 0.6);

            // Lock icon
            const lockIcon = this.add.text(x, y - 30, '🔒', {
                fontSize: '60px'
            }).setOrigin(0.5);

            // Unlock text
            const unlockText = this.add.text(x, y + 80, 'Must win Qualifiers Cup to unlock', {
                fontSize: '16px',
                fill: '#ff0000',
                fontStyle: 'bold'
            }).setOrigin(0.5);
        }
    }

    showTournamentOptions(mode) {
        // Create overlay
        const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7);
        overlay.setDepth(100);
        
        // Create dialog box
        const dialogBg = this.add.rectangle(640, 360, 600, 400, 0x333333, 1);
        dialogBg.setStrokeStyle(4, 0xffffff);
        dialogBg.setDepth(101);
        
        // Title
        const tournamentName = mode === 'qualifiers' ? 'QUALIFIERS CUP' : 'CHAMPIONS CUP';
        const title = this.add.text(640, 220, tournamentName, {
            fontSize: '32px',
            fill: '#ffcc00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(102);
        
        // Subtitle
        const subtitle = this.add.text(640, 270, 'Tournament in Progress', {
            fontSize: '24px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(102);
        
        // Continue Tournament button
        const continueBg = this.add.rectangle(640, 340, 400, 60, 0x00aa00, 1);
        continueBg.setStrokeStyle(3, 0x00ff00);
        continueBg.setInteractive();
        continueBg.setDepth(102);
        
        const continueText = this.add.text(640, 340, 'CONTINUE TOURNAMENT', {
            fontSize: '24px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(102);
        
        continueBg.on('pointerover', () => {
            continueBg.setScale(1.05);
            continueText.setScale(1.05);
        });
        
        continueBg.on('pointerout', () => {
            continueBg.setScale(1);
            continueText.setScale(1);
        });
        
        continueBg.on('pointerdown', () => {
            const currentRound = localStorage.getItem('tournamentRound');
            this.scene.start('TournamentBracketScene', {
                mode: mode,
                round: currentRound
            });
        });
        
        // Start New Tournament button
        const newBg = this.add.rectangle(640, 420, 400, 60, 0xcc6600, 1);
        newBg.setStrokeStyle(3, 0xff9900);
        newBg.setInteractive();
        newBg.setDepth(102);
        
        const newText = this.add.text(640, 420, 'START NEW TOURNAMENT', {
            fontSize: '24px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(102);
        
        newBg.on('pointerover', () => {
            newBg.setScale(1.05);
            newText.setScale(1.05);
        });
        
        newBg.on('pointerout', () => {
            newBg.setScale(1);
            newText.setScale(1);
        });
        
        newBg.on('pointerdown', () => {
            // Clear existing tournament data
            localStorage.setItem('tournamentActive', 'false');
            localStorage.removeItem('tournamentRound');
            localStorage.removeItem('tournamentBracket');
            
            // Start new tournament
            localStorage.setItem('tournamentMode', mode);
            this.scene.start('TournamentNameScene', { mode: mode });
        });
        
        // Cancel button
        const cancelBg = this.add.rectangle(640, 500, 200, 50, 0x666666, 1);
        cancelBg.setStrokeStyle(2, 0x999999);
        cancelBg.setInteractive();
        cancelBg.setDepth(102);
        
        const cancelText = this.add.text(640, 500, 'CANCEL', {
            fontSize: '20px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(102);
        
        cancelBg.on('pointerover', () => {
            cancelBg.setScale(1.05);
            cancelText.setScale(1.05);
        });
        
        cancelBg.on('pointerout', () => {
            cancelBg.setScale(1);
            cancelText.setScale(1);
        });
        
        cancelBg.on('pointerdown', () => {
            // Remove dialog
            overlay.destroy();
            dialogBg.destroy();
            title.destroy();
            subtitle.destroy();
            continueBg.destroy();
            continueText.destroy();
            newBg.destroy();
            newText.destroy();
            cancelBg.destroy();
            cancelText.destroy();
        });
    }

    createMuteButton() {
        const x = 1230;
        const y = 30;
        
        // Create the mute button sprite
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
}
