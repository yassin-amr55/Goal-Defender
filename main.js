// Global mute state
let isMuted = localStorage.getItem('goalDefenderMuted') === 'true' || false;

// Game configuration
const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [BootScene, MenuScene, ShopScene, GameScene, GameOverScene, TournamentMenuScene, TrophyRoomScene, TournamentNameScene, TournamentBracketScene, TournamentGameScene, TournamentVictoryScene]
};

// Initialize the game
const game = new Phaser.Game(config);
