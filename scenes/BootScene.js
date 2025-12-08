class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Update loading progress
        this.load.on('progress', (value) => {
            const progressElement = document.getElementById('loading-progress');
            if (progressElement) {
                progressElement.textContent = Math.round(value * 100) + '%';
            }
        });

        // Add loading error handler
        this.load.on('loaderror', (file) => {
            console.error('Error loading file:', file.src);
        });

        // Load all game assets
        console.log('Loading assets...');
        
        // Main assets
        this.load.image('background', 'assets/background.png');
        this.load.image('ground', 'assets/ground.png');
        this.load.image('grass', 'assets/grass.png');
        this.load.image('ball_default', 'assets/ball.png');
        this.load.image('goal', 'assets/goal.png');
        this.load.image('wall', 'assets/wall.png');
        
        // PHASE 10: Ball skins
        this.load.image('ball_golden', 'assets/balls/ball-golden.png');
        this.load.image('ball_fire', 'assets/balls/ball-fire.png');
        this.load.image('ball_steel', 'assets/balls/ball-steel.png');
        this.load.image('ball_ghost', 'assets/balls/ball-ghost.png');
        this.load.image('ball_spark', 'assets/balls/ball-spark.png');
        
        // Volume icons
        this.load.image('volume-unmute', 'assets/volume-unmute.png');
        this.load.image('volume-mute', 'assets/volume-mute.png');
    }

    create() {
        // Once assets are loaded, hide loading screen and go to MenuScene
        console.log('Assets loaded successfully!');
        console.log('Textures:', this.textures.list);
        
        // Hide loading screen with fade out effect
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            // Remove from DOM after transition
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
        
        this.scene.start('MenuScene');
    }
}
