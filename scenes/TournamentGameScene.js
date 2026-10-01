class TournamentGameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TournamentGameScene' });
    }

    init(data) {
        this.mode = data.mode || localStorage.getItem('tournamentMode') || 'qualifiers';
        this.currentRound = data.round || localStorage.getItem('tournamentRound') || (this.mode === 'qualifiers' ? 'roundOf16' : 'roundOf32');
        this.opponent = data.opponent || data.opponentName || 'Opponent';

        // Remember whether the Champions Cup was ever won, so a later defeat
        // does not revoke it.
        this.everWonChampions = localStorage.getItem('tournamentChampionsWon') === 'true';
        
        // Save tournament state
        localStorage.setItem('tournamentActive', 'true');
        localStorage.setItem('tournamentMode', this.mode);
        localStorage.setItem('tournamentRound', this.currentRound);
    }

    create() {
        console.log('TournamentGameScene create() called');

        const groundHeight = 100;
        const groundY = 720;
        const groundTopY = groundY - groundHeight;

        // Background
        if (this.textures.exists('background')) {
            const bg = this.add.image(640, 0, 'background');
            bg.setOrigin(0.5, 0);
            bg.setDisplaySize(1280, groundTopY);
            bg.setDepth(-2);
        } else {
            this.cameras.main.setBackgroundColor('#87CEEB');
        }

        // Ground
        if (this.textures.exists('ground')) {
            const ground = this.add.image(640, groundY, 'ground');
            ground.setOrigin(0.5, 1);
            ground.setDisplaySize(1280, groundHeight);
            ground.setDepth(-1);
        }

        // Grass
        if (this.textures.exists('grass')) {
            const grass = this.add.image(640, groundTopY + 3, 'grass');
            grass.setOrigin(0.5, 1);
            grass.setDisplaySize(1280, grass.height);
            // Behind the goal and explosion particles, not over them.
            grass.setDepth(-2);
        }

        this.groundLevel = groundY - groundHeight;

        // Load ball abilities
        this.equippedBall = localStorage.getItem('goalDefenderEquippedBall') || 'default';
        this.loadBallAbilities();

        // Hitbox system
        this.hitboxRadius = 120;
        this.hitboxShrinkAmount = 15 * this.hitboxShrinkMultiplier;
        this.shrinkCountdown = 20;

        this.hitboxCircle = this.add.circle(640, 360, this.hitboxRadius, 0xffffff, 0.3);
        this.hitboxCircle.setDepth(5);

        this.time.addEvent({
            delay: 20000,
            callback: this.shrinkHitbox,
            callbackScope: this,
            loop: true
        });

        this.time.addEvent({
            delay: 1000,
            callback: () => {
                this.shrinkCountdown--;
                if (this.shrinkCountdown <= 0) this.shrinkCountdown = 20;
            },
            callbackScope: this,
            loop: true
        });

        // LEFT GOAL (player loses if ball enters)
        if (this.textures.exists('goal')) {
            this.leftGoal = this.physics.add.sprite(80, groundY - groundHeight, 'goal');
            this.leftGoal.setOrigin(0.5, 1);
            this.leftGoal.setScale(0.65);
            this.leftGoal.setImmovable(true);
            this.leftGoal.body.setAllowGravity(false);
            this.leftGoal.setDepth(10);
        }

        // Ball setup - tournaments use the equipped skin for looks only.
        // loadBallAbilities() above has already zeroed every ability, so this
        // is the normal ball in whatever outfit the player picked.
        const ballTexture = this.getBallTexture();
        const finalTexture = this.textures.exists(ballTexture) ? ballTexture : 'ball_default';

        const ballStartY = 400;
        this.ball = this.physics.add.sprite(640, ballStartY, finalTexture);
        this.ball.setScale(0.2);
        this.ball.setBounce(0, 0);
        this.ball.setCollideWorldBounds(false);
        this.ball.setDamping(false);
        this.ball.setDrag(0);
        this.ball.setDepth(1);
        this.ball.setGravityY(500);

        this.ballSpeed = 300 * this.speedMultiplier;
        const dirRandom = Math.random() < 0.5 ? -1 : 1;
        this.ball.setVelocity(this.ballSpeed * dirRandom, 0);

        // Ball trail
        if (!window.Settings || window.Settings.isOn('gdParticles')) {
            this.ballTrail = this.add.particles(0, 0, finalTexture, {
                speed: 50,
                scale: { start: 0.15, end: 0 },
                alpha: { start: 0.5, end: 0 },
                lifespan: 300,
                frequency: 50
            });
            this.ballTrail.startFollow(this.ball);
            this.ballTrail.setDepth(0);
        }

        this.minHitboxRadius = (this.ball.displayWidth / 2) * this.minHitboxMultiplier;

        // Ground collider
        this.groundCollider = this.add.rectangle(640, this.groundLevel, 1280, 10, 0x00ff00, 0);
        this.physics.add.existing(this.groundCollider, true);
        this.physics.add.collider(this.ball, this.groundCollider, this.onGroundHit, null, this);

        // RIGHT GOAL (flipped, target after barrier removed)
        if (this.textures.exists('goal')) {
            this.rightGoal = this.physics.add.sprite(1200, groundY - groundHeight, 'goal');
            this.rightGoal.setOrigin(0.5, 1);
            this.rightGoal.setScale(0.65);
            this.rightGoal.flipX = true;
            this.rightGoal.setImmovable(true);
            this.rightGoal.body.setAllowGravity(false);
            this.rightGoal.setDepth(10);
        }

        // Tournament-specific: Invisible barrier 20px left of right goal
        // Right goal is at x=1200, goal has displayWidth, so left edge is at x - width/2
        const goalLeftEdge = this.rightGoal.x - (this.rightGoal.displayWidth / 2);
        this.barrierX = goalLeftEdge - 20; // 20px left of goal's left edge
        this.allowGoal = false;

        // Anti-autoclicker: at most one deflect per inbound pass. Set when a
        // tap lands, cleared in update() once the ball is travelling right.
        this.deflectLock = false;
        
        // Create invisible barrier
        const barrierY = (groundY - groundHeight) / 2; // Middle of playable area
        const barrierHeight = groundY - groundHeight; // Height from ground to top
        this.barrier = this.add.rectangle(this.barrierX, barrierY, 10, barrierHeight, 0xff0000, 0); // Alpha 0 = invisible
        this.physics.add.existing(this.barrier, true); // true = static body (immovable by default)
        this.barrierCollider = this.physics.add.collider(this.ball, this.barrier, this.onBarrierHit, null, this);
        
        console.log('Right goal at:', this.rightGoal.x, 'Goal left edge:', goalLeftEdge, 'Barrier at:', this.barrierX);

        this.physics.world.setBounds(0, 0, 1280, 720);

        // Score setup
        this.score = 0;
        this.speedBoost = 0;
        this.totalDeflects = 0;
        this.requiredScore = this.getRequiredScore(this.mode, this.currentRound);
        this.gameOver = false;
        
        // Initialize pause flag
        this.isPaused = false;

        // UI Text elements (same style as infinite mode)
        let roundName = this.currentRound;
        // Convert camelCase to proper spacing
        if (roundName === 'roundOf16') roundName = 'ROUND OF 16';
        else if (roundName === 'roundOf32') roundName = 'ROUND OF 32';
        else if (roundName === 'quarterFinals') roundName = 'QUARTER FINALS';
        else if (roundName === 'semiFinals') roundName = 'SEMI FINALS';
        else if (roundName === 'finals') roundName = 'FINALS';
        
        // HUD: independent readouts, no backing panels
        this.add.text(640, 30, roundName, {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: '900',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        const teamName = localStorage.getItem('tournamentTeamName') || 'Your Team';
        const matchupText = `${teamName} vs ${this.opponent}`;
        this.add.text(640, 62, matchupText, {
            fontSize: '17px',
            color: '#ffd45e',
            fontStyle: '800',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Score sits right of centre, clear of the top-right control cluster
        this.scoreText = this.add.text(1050, 30, `Score: ${this.score} / ${this.requiredScore}`, {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: '900',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Speed boost text (same style as infinite mode)
        this.speedBoostText = this.add.text(22, 98, `Speed Boost: 0%`, {
            fontSize: '24px',
            color: '#3ddc6b',
            fontStyle: '800',
            stroke: '#000000',
            strokeThickness: 3
        });

        // Hitbox countdown text (same style as infinite mode)
        this.hitboxCountdownText = this.add.text(22, 64, `Hitbox shrinks in: ${this.shrinkCountdown}s`, {
            fontSize: '24px',
            color: '#ffd45e',
            fontStyle: '800',
            stroke: '#000000',
            strokeThickness: 3
        });

        // Create sounds
        this.createSounds();

        // Mute button
        this.createMuteButton();

        // Add middle line (same as infinite mode)
        this.middleLine = this.add.line(0, 0, 640, 0, 640, 720, 0xff0000, 0.3);
        this.middleLine.setOrigin(0, 0);
        this.middleLine.setDepth(5);

        // Click handler (same as infinite mode)
        this.input.on('pointerdown', (pointer) => {
            // Anti-autoclicker lock: cleared in update() once the ball travels
            // right, so only one deflect per inbound pass can land.
            if (this.ball && !this.deflectLock) {
                const distance = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.ball.x, this.ball.y);
                const ballLeftOfMiddle = this.ball.x < 640;
                const movingLeft = this.ball.body.velocity.x < 0;

                if (distance <= this.hitboxRadius && movingLeft && ballLeftOfMiddle) {
                    this.deflectLock = true;
                    this.onBallClick();
                }
            }
        });
        
        // Add ESC key listener for pause
        this.input.keyboard.on('keydown-ESC', () => {
            if (!this.gameOver) {
                this.togglePause();
            }
        });
    }

    loadBallAbilities() {
        // Tournament matches are played with the normal ball: the player keeps
        // the SKIN they equipped (cosmetic only) but no ball ability applies,
        // so every entrant is on identical footing.
        this.speedMultiplier = 1;
        this.hitboxShrinkMultiplier = 1;
        this.scoreMultiplier = 1;
        this.minHitboxMultiplier = 1;
        this.maxSpeedBoost = 300;
        this.jumpMultiplier = 1;
        this.boostStepMain = 1.04;
        this.boostStepLate = 1.02;
        this.startHitboxMin = false;
    }

    getBallTexture() {
        const textureMap = {
            'default': 'ball_default',
            'golden': 'ball_golden',
            'fire': 'ball_fire',
            'steel': 'ball_steel',
            'ghost': 'ball_ghost',
            'spark': 'ball_spark',
            'rubber': 'ball_rubber',
            'ice': 'ball_ice',
            'anchor': 'ball_anchor',
            'neon': 'ball_neon',
            'candy': 'ball_candy',
            'void': 'ball_void',
            'gauntlet': 'ball_gauntlet',
            'money': 'ball_money',
            'revive': 'ball_revive'
        };
        return textureMap[this.equippedBall] || 'ball_default';
    }

    getRequiredScore(mode, round) {
        const map = {
            qualifiers: {
                roundOf16: 20,
                quarterFinals: 30,
                semiFinals: 40,
                finals: 50
            },
            champions: {
                roundOf32: 60,
                roundOf16: 70,
                quarterFinals: 80,
                semiFinals: 90,
                finals: 100
            }
        };
        return (map[mode] && map[mode][round]) || 20;
    }

    /** Money paid per point of score, by cup.
     *  Champions pays double Qualifiers: it is a 5-round bracket with
     *  higher targets, so match earnings have to justify the effort.
     *  Stated once here so the rate is not duplicated. */
    getScoreRate() {
        return this.mode === 'champions' ? 10 : 5;
    }

    createSounds() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioContext = audioContext;
    }

    playClickSound() {
        if (isMuted) return;
        try {
            const ctx = this.audioContext;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800;
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) { console.error('Click sound error:', e); }
    }

    playBounceSound() {
        if (isMuted) return;
        try {
            const ctx = this.audioContext;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 300;
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
        } catch (e) { console.error('Bounce sound error:', e); }
    }

    playExplosionSound() {
        if (isMuted) return;
        try {
            const ctx = this.audioContext;
            const bufferSize = ctx.sampleRate * 0.5;
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            const bufferSource = ctx.createBufferSource();
            bufferSource.buffer = noiseBuffer;
            const gain = ctx.createGain();
            bufferSource.connect(gain);
            gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            bufferSource.start(ctx.currentTime);
            bufferSource.stop(ctx.currentTime + 0.5);
        } catch (e) { console.error('Explosion sound error:', e); }
    }

    shrinkHitbox() {
        this.hitboxRadius = Math.max(this.hitboxRadius - this.hitboxShrinkAmount, this.minHitboxRadius);
        this.hitboxCircle.setRadius(this.hitboxRadius);
        this.hitboxCircle.setAlpha(0.5);
    }

    onBallClick() {
        this.playClickSound();
        
        // PHASE 6: Increase ball speed with dynamic rate (same as infinite mode)
        const maxBoost = this.maxSpeedBoost || 300;
        let increaseRate = 1.04; // 4% by default
        
        if (this.speedBoost >= maxBoost) {
            increaseRate = 1.0; // Max boost reached
        } else if (this.speedBoost >= 100) {
            increaseRate = 1.02; // After 100%, increase by 2%
        }
        
        if (this.speedBoost < maxBoost) {
            this.ballSpeed = this.ballSpeed * increaseRate;
            const boostAmount = (increaseRate - 1) * 100;
            this.speedBoost += boostAmount;
            this.speedBoost = Math.round(this.speedBoost * 100) / 100;
            if (this.speedBoost > maxBoost) this.speedBoost = maxBoost;
        }
        
        // Angle variation (same as infinite mode)
        const angleVariation = Phaser.Math.Between(-20, 20);
        const upwardSpeed = -350 + angleVariation;
        
        // Reverse direction toward the right with increased speed
        this.ball.setVelocity(this.ballSpeed, upwardSpeed);
        
        // Add score (1 per deflect - tournament balls have no ability bonus)
        const scoreGain = Math.round(this.scoreMultiplier);
        this.score += scoreGain;
        this.runDeflections = (this.runDeflections || 0) + 1;
        this.scoreText.setText(`Score: ${this.score} / ${this.requiredScore}`);
        this.speedBoostText.setText(`Speed Boost: ${this.speedBoost}%`);
        
        // Screen shake (same as infinite mode)
        if (window.Settings && window.Settings.isOn('gdShake')) {
            this.cameras.main.shake(100, 0.005);
        }
        
        // Score flash (same as infinite mode)
        this.scoreText.setScale(1.3);
        this.tweens.add({
            targets: this.scoreText,
            scale: 1,
            duration: 200,
            ease: 'Back.easeOut'
        });

        // Check if score requirement met
        if (this.score >= this.requiredScore && !this.allowGoal) {
            this.allowGoal = true;
            // Remove barrier collision
            this.physics.world.removeCollider(this.barrierCollider);
            console.log('Barrier removed! Goal allowed.');
        }
    }

    onGroundHit() {
        // Same as infinite mode
        if (this.ball && this.ball.body.touching.down) {
            const jumpVelocity = -400;
            const horizontalVelocity = this.ball.body.velocity.x > 0 ? this.ballSpeed : -this.ballSpeed;
            this.ball.setVelocity(horizontalVelocity, jumpVelocity);
            this.playBounceSound();
        }
    }
    
    onBarrierHit() {
        console.log('Barrier hit! Ball velocity:', this.ball.body.velocity.x, this.ball.body.velocity.y);
        
        // Ball bounces off barrier (like wall in infinite mode)
        if (this.ball && !this.allowGoal) {
            const currentVerticalVelocity = this.ball.body.velocity.y;
            let newVerticalVelocity = currentVerticalVelocity;
            
            // Add random vertical velocity to make ball less predictable (same as infinite mode wall bounce)
            const randomBoost = Math.random();
            if (randomBoost > 0.5) {
                // Add upward velocity
                newVerticalVelocity = -200 - Math.random() * 100; // Random upward between -200 and -300
            } else if (Math.abs(currentVerticalVelocity) < 50) {
                // If moving slowly, add some random velocity (up or down)
                newVerticalVelocity = (Math.random() - 0.5) * 300; // Random between -150 and 150
            }
            
            // Reverse horizontal direction with current ball speed
            this.ball.setVelocity(-this.ballSpeed, newVerticalVelocity);
            this.playBounceSound();
            
            // Increment total deflects counter for stats
            this.totalDeflects++;
            
            console.log('Ball bounced back with velocity:', this.ball.body.velocity.x, this.ball.body.velocity.y);
        }
    }

    togglePause() {
        if (this.isPaused) {
            // Resume game
            this.resumeGame();
        } else {
            // Pause game
            this.pauseGame();
        }
    }

    pauseGame() {
        this.isPaused = true;
        this.physics.pause();

        this.pauseMenuElements = [];

        const overlay = this.add.rectangle(640, 360, 1280, 720, 0x050a12, 0.78);
        overlay.setDepth(200);
        this.pauseMenuElements.push(overlay);

        const card = UI.panel(this, {
            x: 640, y: 360, w: 480, h: 380, radius: 24,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: 0x4a6a8a, borderWidth: 2, depth: 201
        });
        this.pauseMenuElements.push(card);

        const title = this.add.text(640, 236, 'PAUSED', {
            fontSize: '52px',
            color: '#ffffff',
            fontStyle: '900',
            stroke: '#f0a500',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(202);
        this.pauseMenuElements.push(title);

        const cont = UI.button(this, {
            x: 640, y: 340, w: 300, h: 74,
            label: 'CONTINUE',
            textSize: 26,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a,
            depth: 202,
            onClick: () => this.resumeGame()
        });
        this.pauseMenuElements.push(cont);

        const menu = UI.button(this, {
            x: 640, y: 434, w: 300, h: 74,
            label: 'TOURNAMENT MENU',
            textSize: 22,
            fillTop: 0xffb340, fillBottom: 0xf08a1d,
            depth: 202,
            onClick: () => this.scene.start('TournamentMenuScene')
        });
        this.pauseMenuElements.push(menu);

        this.pauseOverlay = overlay;
        this.pauseTitle = title;
    }

    resumeGame() {
        this.isPaused = false;
        this.physics.resume();

        // Remove pause menu elements
        if (this.pauseMenuElements) {
            this.pauseMenuElements.forEach(element => element.destroy());
            this.pauseMenuElements = null;
        }
        this.pauseOverlay = null;
        this.pauseTitle = null;
    }

    update(time, delta) {
        if (!this.ball || this.gameOver) return;

        // Update hitbox circle position and visibility (same as infinite mode)
        this.hitboxCircle.x = this.ball.x;
        this.hitboxCircle.y = this.ball.y;
        this.hitboxCircle.setRadius(this.hitboxRadius);
        
        // Only show hitbox when ball is moving left and left of middle
        const ballLeftOfMiddle = this.ball.x < 640;
        const alwaysOn = window.Settings && window.Settings.isOn('gdHitboxAlways');
        if (this.ball.body.velocity.x < 0 && ballLeftOfMiddle) {
            this.hitboxCircle.setAlpha(0.3);
        } else {
            this.hitboxCircle.setAlpha(alwaysOn ? 0.25 : 0.1);
        }

        // Update countdown text
        if (this.hitboxCountdownText) {
            if (this.hitboxRadius <= this.minHitboxRadius) {
                this.hitboxCountdownText.setText('Hitbox: MIN SIZE');
            } else {
                this.hitboxCountdownText.setText('Hitbox shrinks in: ' + this.shrinkCountdown + 's');
            }
        }

        // Release the deflect lock once the ball is heading back to the right.
        //
        // Mirrors the anti-autoclicker lock in GameScene: one deflect per
        // inbound pass. The deflect sends the ball right, so this re-arms for
        // the next approach instead of needing a timer.
        if (this.deflectLock && this.ball && this.ball.body.velocity.x > 0) {
            this.deflectLock = false;
        }

        // Restrict ball height (same as infinite mode)
        //
        // The clamp tests the ball's CENTRE, so the line sits one ball-radius
        // lower than the goal's top edge. Otherwise the ball's top half stops
        // hanging above the goal in mid-air with nothing visible to hit.
        const maxBallHeight = this.leftGoal.y - this.leftGoal.displayHeight
            + (this.ball.displayWidth / 2);
        if (this.ball.y < maxBallHeight) {
            this.ball.y = maxBallHeight;
            this.ball.setVelocityY(Math.abs(this.ball.body.velocity.y) * 0.5);
        }

        // Check goal entry (corrected logic)
        // Victory: Left side of ball passes left side of right goal (ball enters from left)
        const rightGoalLeftEdge = this.rightGoal.x - (this.rightGoal.displayWidth / 2);
        const ballLeftEdge = this.ball.x - (this.ball.displayWidth / 2);
        
        // Defeat: Right side of ball passes right side of left goal (ball fully enters left goal)
        const leftGoalRightEdge = this.leftGoal.x + (this.leftGoal.displayWidth / 2);
        const ballRightEdge = this.ball.x + (this.ball.displayWidth / 2);
        
        // Victory condition: ball allowed to enter goal AND ball's left edge crosses goal's left edge
        if (this.allowGoal && ballLeftEdge >= rightGoalLeftEdge) {
            this.triggerVictory();
        } 
        // Defeat condition: ball's right edge crosses left goal's right edge (ball fully in left goal)
        else if (ballRightEdge <= leftGoalRightEdge) {
            this.triggerDefeat();
        }
    }

    triggerVictory() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.playExplosionSound();

        // Particle explosion (same as infinite mode)
        const ballTexture = this.getBallTexture();
        const finalTexture = this.textures.exists(ballTexture) ? ballTexture : 'ball_default';
        if (!window.Settings || window.Settings.isOn('gdParticles')) {
            this.add.particles(this.ball.x, this.ball.y, finalTexture, {
                speed: { min: 100, max: 300 },
                scale: { start: 0.3, end: 0 },
                alpha: { start: 1, end: 0 },
                lifespan: 800,
                quantity: 20,
                blendMode: 'ADD'
            });
        }

        // Stop ball movement
        this.ball.setVelocity(0, 0);
        this.ball.setVisible(false);
        
        // Fade screen to black (same as infinite mode)
        this.cameras.main.fadeOut(1000, 0, 0, 0);

        // Award money per score. The rate depends on the cup: Qualifiers pay
        // half what Champions does, so the harder bracket is worth the extra
        // effort. Endless mode and the tutorial keep their own separate rates.
        const money = this.score * this.getScoreRate();
        const currentMoney = parseInt(localStorage.getItem('goalDefenderMoney') || '0');
        localStorage.setItem('goalDefenderMoney', (currentMoney + money).toString());

        // Bank the deflections toward the lifetime total
        const lifetime = parseInt(localStorage.getItem('goalDefenderDeflections') || '0');
        localStorage.setItem('goalDefenderDeflections', lifetime + this.score);

        // Update tournamentProgress
        const progress = JSON.parse(localStorage.getItem('tournamentProgress') || '{}');
        progress.matchesWon = (progress.matchesWon || 0) + 1;
        progress.totalDeflects = (progress.totalDeflects || 0) + this.totalDeflects;
        progress.moneyEarned = (progress.moneyEarned || 0) + money;
        localStorage.setItem('tournamentProgress', JSON.stringify(progress));

        // Update tournament progress and bracket
        const currentRound = localStorage.getItem('tournamentRound');
        const nextRound = this.getNextRound(currentRound);
        
        // Update bracket with player's victory
        this.updateBracketWithVictory(currentRound);
        
        if (nextRound) {
            // Advance to next round
            localStorage.setItem('tournamentRound', nextRound);
            console.log('Advanced to:', nextRound);
        } else {
            // Won the tournament!
            const mode = localStorage.getItem('tournamentMode');
            if (mode === 'qualifiers') {
                localStorage.setItem('tournamentQualifiersWon', 'true');
                localStorage.setItem('tournamentQualifiersDate', new Date().toLocaleDateString());
                console.log('Qualifiers Cup won! Champions Cup unlocked.');
            } else if (mode === 'champions') {
                localStorage.setItem('tournamentChampionsWon', 'true');
                localStorage.setItem('tournamentChampionsDate', new Date().toLocaleDateString());
                console.log('Champions Cup won!');
            }
            
            // Clear active tournament
            localStorage.setItem('tournamentActive', 'false');
            localStorage.removeItem('tournamentRound');
        }

        // Wait for fade to complete, then transition
        this.cameras.main.once('camerafadeoutcomplete', () => {
            const currentRound = localStorage.getItem('tournamentRound');
            
            if (!currentRound) {
                // Won the tournament!
                this.scene.start('TournamentVictoryScene', { 
                    mode: this.mode, 
                    stats: progress,
                    result: 'victory'
                });
            } else {
                // Continue to next round
                this.scene.start('TournamentBracketScene', {
                    mode: this.mode,
                    round: currentRound
                });
            }
        });
    }

    triggerDefeat() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.playExplosionSound();

        // Particle explosion (same as infinite mode)
        const ballTexture = this.getBallTexture();
        const finalTexture = this.textures.exists(ballTexture) ? ballTexture : 'ball_default';
        if (!window.Settings || window.Settings.isOn('gdParticles')) {
            this.add.particles(this.ball.x, this.ball.y, finalTexture, {
                speed: { min: 100, max: 300 },
                scale: { start: 0.3, end: 0 },
                alpha: { start: 1, end: 0 },
                lifespan: 800,
                quantity: 20,
                blendMode: 'ADD'
            });
        }

        // Stop ball movement
        this.ball.setVelocity(0, 0);
        this.ball.setVisible(false);
        
        // Fade screen to black (same as infinite mode)
        this.cameras.main.fadeOut(1000, 0, 0, 0);

        // Clear active tournament
        localStorage.setItem('tournamentActive', 'false');
        
        // Losing a Champions run re-locks the cup, but only if the player has
        // not already earned it. Otherwise a single loss would take away a
        // trophy they legitimately won.
        if (this.mode === 'champions' && !this.everWonChampions) {
            localStorage.setItem('tournamentChampionsWon', 'false');
            console.log('Champions Cup locked again due to defeat');
        }

        // Wait for fade to complete, then transition
        this.cameras.main.once('camerafadeoutcomplete', () => {
            // Show defeat screen.
            //
            // The summary must carry the run so far rather than zeros. The
            // money was already banked match by match into the balance, so
            // reporting 0 would tell the player they earned nothing for the
            // rounds they had already won.
            const progress = JSON.parse(localStorage.getItem('tournamentProgress') || '{}');
            this.scene.start('TournamentVictoryScene', {
                mode: this.mode,
                stats: {
                    matchesWon: progress.matchesWon || 0,
                    totalDeflects: this.totalDeflects,
                    moneyEarned: progress.moneyEarned || 0
                },
                result: 'defeat'
            });
        });
    }

    updateBracketWithVictory(currentRound) {
        // Load current bracket
        const bracket = JSON.parse(localStorage.getItem('tournamentBracket') || '{}');
        const playerTeam = localStorage.getItem('tournamentTeamName') || 'Your Team';
        
        // Find player's match in current round and mark as won
        if (bracket[currentRound]) {
            const matches = Array.isArray(bracket[currentRound]) ? bracket[currentRound] : [bracket[currentRound]];
            
            for (let match of matches) {
                if (match.team1 === playerTeam || match.team2 === playerTeam) {
                    match.winner = playerTeam;
                    console.log(`Player won match: ${match.team1} vs ${match.team2}, winner: ${playerTeam}`);
                    break;
                }
            }
        }
        
        // Advance player to next round and simulate other matches
        const nextRound = this.getNextRound(currentRound);
        if (nextRound && bracket[nextRound]) {
            // Simulate other matches in current round (advance random teams)
            this.simulateOtherMatches(bracket, currentRound, playerTeam);
            
            // Find empty slot in next round and place player
            const nextMatches = Array.isArray(bracket[nextRound]) ? bracket[nextRound] : [bracket[nextRound]];
            
            for (let match of nextMatches) {
                if (match.team1 === 'TBD') {
                    match.team1 = playerTeam;
                    console.log(`Player advanced to ${nextRound} as team1`);
                    break;
                } else if (match.team2 === 'TBD') {
                    match.team2 = playerTeam;
                    console.log(`Player advanced to ${nextRound} as team2`);
                    break;
                }
            }
        } else if (!nextRound && bracket[nextRound] === undefined && bracket.finals) {
            // Winning the final: record the champion. Without this the bracket
            // kept showing an empty trophy slot after the tournament was won.
            bracket.finals.winner = playerTeam;
            console.log('Player won the tournament:', playerTeam);
        }
        
        // Save updated bracket
        localStorage.setItem('tournamentBracket', JSON.stringify(bracket));
    }

    simulateOtherMatches(bracket, currentRound, playerTeam) {
        // Simulate other matches in the current round by randomly selecting winners
        if (bracket[currentRound]) {
            const matches = Array.isArray(bracket[currentRound]) ? bracket[currentRound] : [bracket[currentRound]];
            const nextRound = this.getNextRound(currentRound);
            
            for (let match of matches) {
                // Skip player's match (already handled)
                if (match.team1 === playerTeam || match.team2 === playerTeam) continue;
                
                // Skip if already has winner
                if (match.winner) continue;
                
                // Randomly select winner from the two teams
                if (match.team1 !== 'TBD' && match.team2 !== 'TBD') {
                    match.winner = Math.random() < 0.5 ? match.team1 : match.team2;
                    console.log(`Simulated match: ${match.team1} vs ${match.team2}, winner: ${match.winner}`);
                    
                    // Advance winner to next round
                    if (nextRound && bracket[nextRound]) {
                        const nextMatches = Array.isArray(bracket[nextRound]) ? bracket[nextRound] : [bracket[nextRound]];
                        
                        for (let nextMatch of nextMatches) {
                            if (nextMatch.team1 === 'TBD') {
                                nextMatch.team1 = match.winner;
                                console.log(`${match.winner} advanced to ${nextRound} as team1`);
                                break;
                            } else if (nextMatch.team2 === 'TBD') {
                                nextMatch.team2 = match.winner;
                                console.log(`${match.winner} advanced to ${nextRound} as team2`);
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    getNextRound(round) {
        const qualifiersOrder = ['roundOf16', 'quarterFinals', 'semiFinals', 'finals'];
        const championsOrder = ['roundOf32', 'roundOf16', 'quarterFinals', 'semiFinals', 'finals'];
        
        const order = this.mode === 'champions' ? championsOrder : qualifiersOrder;
        const idx = order.indexOf(round);
        
        if (idx === -1 || idx === order.length - 1) return null;
        return order[idx + 1];
    }

    createMuteButton() {
        // Phones have no ESC key, so pause needs an on-screen button.
        UI.topRight(this, { onPause: () => this.togglePause() });
    }
}
