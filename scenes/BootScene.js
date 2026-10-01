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
        this.load.image('wall', 'assets/new-wall.png');
        
        // PHASE 10: Ball skins
        this.load.image('ball_golden', 'assets/balls/ball-golden.png');
        this.load.image('ball_fire', 'assets/balls/ball-fire.png');
        this.load.image('ball_steel', 'assets/balls/ball-steel.png');
        this.load.image('ball_ghost', 'assets/balls/ball-ghost.png');
        this.load.image('ball_spark', 'assets/balls/ball-spark.png');
        this.load.image('ball_rubber', 'assets/balls/ball-rubber.png');
        this.load.image('ball_ice', 'assets/balls/ball-ice.png');
        this.load.image('ball_anchor', 'assets/balls/ball-anchor.png');
        this.load.image('ball_neon', 'assets/balls/ball-neon.png');
        this.load.image('ball_candy', 'assets/balls/ball-candy.png');
        this.load.image('ball_void', 'assets/balls/ball-void.png');
        this.load.image('ball_gauntlet', 'assets/balls/ball-gauntlet.png');
        this.load.image('ball_money', 'assets/balls/ball-money.png');
        this.load.image('ball_revive', 'assets/balls/ball-revive.png');
        
        // Volume icons
        this.load.image('volume-unmute', 'assets/volume-unmute.png');
        this.load.image('volume-mute', 'assets/volume-mute.png');
        
        // Tournament trophies
        this.load.image('qualifiers-trophy', 'assets/qualifiers-trophie.png');
        this.load.image('champions-trophy', 'assets/champions-trophie.png');

        // Vector icons (replaces the old emoji)
        this.load.svg('trophy-icon', 'assets/icons/trophy.svg', { width: 128, height: 128 });
        this.load.svg('podium-icon', 'assets/icons/podium.svg', { width: 128, height: 128 });
        this.load.svg('lock-icon', 'assets/icons/lock.svg', { width: 128, height: 128 });
        this.load.svg('settings-icon', 'assets/icons/settings.svg', { width: 128, height: 128 });
        this.load.svg('medal-icon', 'assets/icons/medal.svg', { width: 128, height: 128 });
        this.load.svg('pause-icon', 'assets/icons/pause.svg', { width: 128, height: 128 });
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
        
        // First launch asks for a name; after that go straight to the menu so the
        // player is never asked twice. GDPlayer stores the default on SKIP, so
        // hasName() is true even for someone who skipped.
        const named = window.GDPlayer ? window.GDPlayer.hasName() : true;
        this.scene.start(named ? 'MenuScene' : 'NamePromptScene');
    }
}
