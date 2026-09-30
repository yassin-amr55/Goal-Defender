// Global mute state (kept in sync with Settings via window.gdSyncSound)
let isMuted = window.Settings.isOn('gdMuted');
window.gdSyncSound = function () { isMuted = window.Settings.isOn('gdMuted'); };

// Game configuration
const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.NO_CENTER
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [BootScene, MenuScene, ShopScene, GameScene, GameOverScene, SettingsScene, TutorialScene, AchievementsScene, TournamentMenuScene, TrophyRoomScene, TournamentNameScene, TournamentBracketScene, TournamentGameScene, TournamentVictoryScene]
};

// Give every Text object a real font instead of Phaser's "Courier" fallback
UI.installFont();

function startGame() {
    const game = new Phaser.Game(config);
    window.game = game;
    // Responsive canvas scaling + 90 degree rotation on upright phones
    setupResponsiveLayout(game);
}

// Web fonts load lazily on first use, so fonts.ready can resolve before any
// face has actually been fetched. Request the weights the UI uses, then start.
// Capped so a slow or blocked font CDN can never stop the game from starting.
var fontReady = (document.fonts && document.fonts.load)
    ? Promise.race([
        Promise.all(['400', '600', '700', '800', '900'].map(function (w) {
            return document.fonts.load(w + ' 40px "Nunito"');
        })),
        new Promise(function (resolve) { setTimeout(resolve, 1500); })
    ])
    : Promise.resolve();

fontReady.then(startGame, startGame);
