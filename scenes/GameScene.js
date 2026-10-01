class GameScene extends Phaser.Scene {
    // Accepts a key so TutorialScene can inherit the exact same physics
    // instead of re-implementing (and drifting from) it.
    constructor(key) {
        super({ key: key || 'GameScene' });
    }

    create() {
        console.log('GameScene create() called');
        console.log('Available textures:', Object.keys(this.textures.list));

        // Ground height (10-15% of screen)
        const groundHeight = 100; // pixels
        const groundY = 720; // Bottom of screen
        const groundTopY = groundY - groundHeight; // Top of ground

        // Background image (sky) - positioned so bottom aligns with top of ground
        if (this.textures.exists('background')) {
            const bg = this.add.image(640, 0, 'background');
            bg.setOrigin(0.5, 0); // Anchor to top center
            bg.setDisplaySize(1280, groundTopY); // Height from top to ground
            bg.setDepth(-2); // Behind everything
            console.log('Background added, height:', groundTopY);
        } else {
            console.error('Background texture not found!');
            this.cameras.main.setBackgroundColor('#87CEEB'); // Fallback
        }

        // Display ground at the bottom
        if (this.textures.exists('ground')) {
            const ground = this.add.image(640, groundY, 'ground');
            ground.setOrigin(0.5, 1); // Anchor to bottom center
            ground.setDisplaySize(1280, groundHeight); // Stretch to full width, fixed height
            ground.setDepth(-1); // Above background, below everything else
            console.log('Ground added');
        } else {
            console.error('Ground texture not found!');
        }

        // Add decorative grass above ground
        if (this.textures.exists('grass')) {
            const grass = this.add.image(640, groundTopY + 3, 'grass');
            grass.setOrigin(0.5, 1); // Anchor to bottom, overlaps ground by 3px
            grass.setDisplaySize(1280, grass.height); // Stretch to full width, keep aspect ratio
            // Behind everything. At depth 11 the grass drew over the goal and
            // over the goal-explosion particles, hiding the win feedback.
            grass.setDepth(-2);
            console.log('Grass added');
        }

        // Store ground level for physics
        this.groundLevel = groundY - groundHeight;
        
        console.log('Ground level:', this.groundLevel);

        // PHASE 10: Load equipped ball and apply abilities BEFORE creating ball
        this.equippedBall = localStorage.getItem('goalDefenderEquippedBall') || 'default';
        this.loadBallAbilities();

        // PHASE 5 & 10: Hitbox shrinking system (affected by ball abilities)
        this.hitboxRadius = 120; // Start with moderate hitbox (120px radius)
        this.hitboxShrinkAmount = 15 * this.hitboxShrinkMultiplier; // Shrink amount affected by ball ability
        this.shrinkCountdown = 20; // Countdown timer
        
        this.hitboxCircle = this.add.circle(640, 360, this.hitboxRadius, 0xffffff, 0.3);
        this.hitboxCircle.setDepth(5); // Make sure it's clickable but behind goal
        
        // PHASE 5: Add middle line - ball can only be clicked left of this line
        this.middleLine = this.add.line(0, 0, 640, 0, 640, 720, 0xff0000, 0.3);
        this.middleLine.setOrigin(0, 0);
        this.middleLine.setDepth(5);
        
        // PHASE 5: Timer to shrink hitbox every 20 seconds
        this.time.addEvent({
            delay: 20000, // 20 seconds
            callback: this.shrinkHitbox,
            callbackScope: this,
            loop: true
        });
        
        // PHASE 5: Countdown timer (updates every second)
        this.time.addEvent({
            delay: 1000, // 1 second
            callback: () => {
                this.shrinkCountdown--;
                if (this.shrinkCountdown <= 0) {
                    this.shrinkCountdown = 20; // Reset to 20
                }
            },
            callbackScope: this,
            loop: true
        });
        
        console.log('Hitbox added with radius:', this.hitboxRadius, 'Will shrink every 20 seconds');
        
        // PHASE 4 & 5: Add global click handler to check distance from ball
        //
        // The hit test accepts where the ball has been over the last few
        // frames, not only where it is right now. A tap on a phone always
        // lands a little after the player saw the ball, and by then the ball
        // has moved on - so a strict "where is it now" test makes a fast ball
        // feel like it is ignoring you. That history window is what removes the
        // perceived input lag.
        this.ballHistory = [];
        this.HISTORY_FRAMES = 10;

        // Anti-autoclicker: at most one deflect per inbound pass.
        //
        // The guards below already require the ball to be left of the middle
        // line and moving toward the goal, but nothing stopped several
        // pointerdown events landing in the same frame on a long hitbox - an
        // autoclicker could farm score and speed boost from one approach.
        // A deflect sends the ball back to the right, so the "moving left"
        // test rejects the extra clicks naturally. This flag makes that
        // explicit and also blocks the case where velocity has not yet been
        // applied when a second event arrives.
        this.deflectLock = false;

        this.input.on('pointerdown', (pointer) => {
            if (!this.ball || this.deflectLock) return;

            // PHASE 5: Only clickable when ball is left of middle line
            const ballLeftOfMiddle = this.ball.x < 640;

            // Only clickable when ball is moving toward goal (left)
            const movingLeft = this.ball.body.velocity.x < 0;
            if (!movingLeft || !ballLeftOfMiddle) return;

            const r = this.hitboxRadius;

            // 1) Where the ball is now
            let hit = Phaser.Math.Distance.Between(
                pointer.x, pointer.y, this.ball.x, this.ball.y) <= r;

            // 2) Where it has just been
            if (!hit) {
                for (let i = this.ballHistory.length - 1; i >= 0; i--) {
                    const h = this.ballHistory[i];
                    if (Phaser.Math.Distance.Between(pointer.x, pointer.y, h.x, h.y) <= r) {
                        hit = true;
                        break;
                    }
                }
            }

            if (!hit) return;

            // Lock before deflecting so a second tap arriving in the same
            // frame is dropped. Released once the ball heads back right.
            this.deflectLock = true;
            this.onBallClick();
        });

        // Place the goal sprite on the left (directly on top of ground)
        if (this.textures.exists('goal')) {
            this.goal = this.physics.add.sprite(80, groundY - groundHeight, 'goal');
            this.goal.setOrigin(0.5, 1); // Anchor to bottom
            this.goal.setScale(0.65); // Make goal slightly bigger (65% of original size)
            this.goal.setImmovable(true);
            this.goal.body.setAllowGravity(false);
            this.goal.setDepth(10); // Goal appears in front of ball

            console.log('Goal added at y:', this.goal.y, 'Goal top:', this.goal.y - this.goal.displayHeight);
        } else {
            console.error('Goal texture not found!');
        }

        // PHASE 3: Add the ball sprite in the middle (behind goal) - AFTER goal is created
        // Get the correct ball texture based on equipped ball
        const ballTexture = this.getBallTexture();
        
        // Fallback to default if texture doesn't exist
        const finalTexture = this.textures.exists(ballTexture) ? ballTexture : 'ball_default';
        
        if (this.textures.exists(finalTexture)) {
            // Start ball at a visible position in the middle of the screen
            const ballStartY = 400; // Middle-ish of screen (720/2 = 360, but a bit lower)
            this.ball = this.physics.add.sprite(640, ballStartY, finalTexture);
            this.ball.setScale(0.2); // Smaller ball size for 512x512 image
            this.ball.setBounce(0, 0); // No automatic bounce - we'll handle it manually
            this.ball.setCollideWorldBounds(false);
            this.ball.setDamping(false); // Disable velocity damping
            this.ball.setDrag(0); // No air resistance
            this.ball.setDepth(1); // Behind goal
            
            // Enable gravity (lower value)
            this.ball.setGravityY(500);
            
            // Set initial movement direction: moving toward goal (left)
            this.ballSpeed = 300 * this.speedMultiplier; // Affected by ball ability
            this.ball.setVelocity(-this.ballSpeed, 0);
            
            // PHASE 12: Add ball trail at higher speed (will be visible when speed increases)
            this.ballTrail = null; // clear any reference from a previous run
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
            
            console.log('Ball created with texture:', finalTexture);
            console.log('Equipped ball:', this.equippedBall);
            
            // Set minimum hitbox size to ball size (affected by ball ability)
            this.minHitboxRadius = (this.ball.displayWidth / 2) * this.minHitboxMultiplier;

            // Void Ball starts with the hitbox already fully shrunk
            if (this.startHitboxMin) {
                this.hitboxRadius = this.minHitboxRadius;
                this.hitboxShrinkAmount = 0;   // nowhere left to shrink to
            }

            console.log('Ball added at position:', this.ball.x, this.ball.y);
            console.log('Ball display size:', this.ball.displayWidth, this.ball.displayHeight);
            console.log('Min hitbox radius set to ball radius:', this.minHitboxRadius);
        } else {
            console.error('Ball texture not found! Tried:', finalTexture);
        }

        // Invisible roof above the playfield.
        //
        // It sits on the goal, but the clamp below tests the ball's CENTRE
        // (`if (this.ball.y < this.maxBallHeight)`), not its top edge. So the
        // line has to be one ball-radius lower than the goal's top edge, or
        // the ball's top half stops hanging above the goal in mid-air with
        // nothing visible to hit. This is placed after the ball is created
        // because it needs the ball's radius.
        if (this.goal && this.ball) {
            this.maxBallHeight =
                this.goal.y - this.goal.displayHeight + (this.ball.displayWidth / 2);
            console.log('Goal top:', this.goal.y - this.goal.displayHeight,
                'Max ball height (roof):', this.maxBallHeight);
        }

        // Create invisible ground collider for ball to bounce on
        this.groundCollider = this.add.rectangle(640, this.groundLevel, 1280, 10, 0x00ff00, 0);
        this.physics.add.existing(this.groundCollider, true); // true = static body
        this.physics.add.collider(this.ball, this.groundCollider, this.onGroundHit, null, this);
        
        // Place the wall sprite on the right (directly on top of ground)
        if (this.textures.exists('wall')) {
            this.wall = this.physics.add.sprite(1200, groundY - groundHeight, 'wall');
            this.wall.setOrigin(0.5, 1); // Anchor to bottom

            // The new wall art is 261x899. Scaled to the height the old
            // 100x500 wall occupied, so the playfield footprint is unchanged.
            this.wall.setScale(500 / this.wall.texture.getSourceImage().height);
            this.wall.refreshBody();

            // The art has transparent margins down BOTH sides: measuring its
            // alpha shows the solid face runs from source column ~19.6 to
            // ~241.1, not 0 to 261. A body spanning the full image made the
            // ball bounce ~11px short of the visible wall, so the body is
            // narrowed to the solid band and offset onto it.
            const wallSrc = this.wall.texture.getSourceImage();
            const solidLeft = wallSrc.width * 0.0751;   // 19.6 of 261
            const solidRight = wallSrc.width * 0.9238;  // 241.1 of 261
            this.wall.body.setSize(solidRight - solidLeft, wallSrc.height, false);
            this.wall.body.setOffset(solidLeft, 0);

            this.wall.setImmovable(true);
            this.wall.body.setAllowGravity(false);
            console.log('Wall art', wallSrc.width + 'x' + wallSrc.height,
                '| solid band', Math.round(solidRight - solidLeft) + 'px',
                '| body at', Math.round(this.wall.body.left) + '..' + Math.round(this.wall.body.right));

            // PHASE 3: Add collision with wall → bounce
            this.physics.add.collider(this.ball, this.wall, this.onWallHit, null, this);
        } else {
            console.error('Wall texture not found!');
        }

        // Add physics boundaries
        this.physics.world.setBounds(0, 0, 1280, 720);

        // Add score text UI (temporary)
        this.score = 0;

        // Lifetime total of deflections, used for future achievements.
        // This run's deflections are the same count as this.score.
        this.runDeflections = 0;
        this.lifetimeDeflections = parseInt(localStorage.getItem('goalDefenderDeflections') || '0');

        // HUD: three independent readouts, no backing panel. Each keeps a dark
        // stroke so it stays readable over the stadium art.
        this.scoreText = this.add.text(22, 22, 'Score: 0', {
            fontSize: '32px',
            color: '#ffffff',
            fontStyle: '900',
            stroke: '#000000',
            strokeThickness: 4
        });

        // Add countdown text for hitbox shrinking
        this.countdownText = this.add.text(22, 64, 'Hitbox shrinks in: 10s', {
            fontSize: '24px',
            color: '#ffd45e',
            fontStyle: '800',
            stroke: '#000000',
            strokeThickness: 3
        });

        // Add speed boost text
        this.speedBoost = 0; // Track total speed boost percentage
        this.speedText = this.add.text(22, 98, 'Speed Boost: 0%', {
            fontSize: '24px',
            color: '#3ddc6b',
            fontStyle: '800',
            stroke: '#000000',
            strokeThickness: 3
        });

        // Initialize game over flag
        this.gameOver = false;
        
        // Initialize pause flag
        this.isPaused = false;

        // Create sound effects using Web Audio API
        this.createSounds();

        // Mute/Unmute button
        this.createMuteButton();

        // Revive Ball: show the charge from the start so the player knows
        // they hold a save, not only after it has already been spent.
        if (this.revivesLeft > 0) {
            this.createReviveCounter();
            this.showReviveCounter();
        }
        
        // Add ESC key listener for pause
        this.input.keyboard.on('keydown-ESC', () => {
            if (!this.gameOver) {
                this.togglePause();
            }
        });

        console.log('GameScene loaded - Phase 3 complete');
    }

    loadBallAbilities() {
        // PHASE 10: Set ability modifiers based on equipped ball
        this.speedMultiplier = 1.0;
        this.hitboxShrinkMultiplier = 1.0;
        this.scoreMultiplier = 1;
        this.minHitboxMultiplier = 1.0;
        this.maxSpeedBoost = 300; // Speed boost ceiling (%)
        this.jumpMultiplier = 1.0; // Ground bounce height
        // How fast the speed boost percentage climbs. The second value is
        // used once the boost is already past 100%.
        this.boostStepMain = 1.04;
        this.boostStepLate = 1.02;
        this.startHitboxMin = false; // Start with the hitbox already minimum
        // Money paid per deflect, and how many missed balls the ball can save.
        this.scoreRate = 3;
        this.revivesLeft = 0;

        switch(this.equippedBall) {
            case 'golden':
                this.hitboxShrinkMultiplier = 0.85; // Shrinks 15% slower
                break;
            case 'steel':
                this.speedMultiplier = 0.9; // 10% slower
                break;
            case 'fire':
                this.scoreMultiplier = 2; // +2 score per deflect
                break;
            case 'ghost':
                this.minHitboxMultiplier = 1.3; // Min hitbox 130% of ball size
                break;
            case 'spark':
                this.maxSpeedBoost = 210; // Speed tops out at 210%
                break;
            case 'rubber':
                this.jumpMultiplier = 1.25; // Bounces 25% higher off the ground
                break;
            case 'ice':
                this.hitboxShrinkMultiplier = 0.5; // Shrinks 50% slower
                break;
            case 'anchor':
                // Base speed is half, so the same boost percentage takes much
                // longer to build in real time. The 300% ceiling is unchanged.
                this.speedMultiplier = 0.5;
                break;
            case 'neon':
                this.boostStepMain = 1.08; // +8% per hit
                this.boostStepLate = 1.04; // +4% past 100%
                break;
            case 'candy':
                this.scoreMultiplier = 3; // +3 score per deflect
                break;
            case 'void':
                // Brutal from the first hit, but the ball never gets quick.
                // Starts at the minimum hitbox with no room to shrink, so the
                // 150% ceiling is what makes it survivable at all.
                this.startHitboxMin = true;
                this.maxSpeedBoost = 150;
                this.boostStepMain = 1.02;
                this.boostStepLate = 1.01;
                break;
            case 'gauntlet':
                // Easy to hit and scores hugely, but can never go fast.
                this.minHitboxMultiplier = 1.7; // Hitbox 170% of ball size
                this.maxSpeedBoost = 130;
                this.scoreMultiplier = 5; // +5 score per deflect
                break;
            case 'money':
                // Pays more per deflect. scoreRate is read by GameOverScene.
                this.scoreRate = 5; // $5 per deflect instead of $3
                break;
            case 'revive':
                // One free mistake. Set directly rather than via a
                // startRevives field, because a property left over from a
                // previous run would leak the free revive into other balls.
                this.revivesLeft = 1;
                break;
        }

        console.log('Ball abilities loaded:', this.equippedBall, 'maxSpeedBoost:', this.maxSpeedBoost + '%');
    }

    /** "REVIVE: n" readout at top centre. Rebuilt on demand because a restart
     *  leaves the reference pointing at a destroyed Text whose canvas is null -
     *  setText() on it threw "Cannot read properties of null (reading 'cut')". */
    createReviveCounter() {
        if (this.reviveText && this.reviveText.scene && this.reviveText.canvas) return;
        this.reviveText = this.add.text(640, 96, '', {
            fontSize: '24px', color: '#7ee787', fontStyle: '900',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(40).setVisible(false);
    }

    showReviveCounter() {
        this.createReviveCounter();
        const left = this.revivesLeft;
        if (!this.reviveText) return;
        this.reviveText.setText('REVIVE: ' + left);
        this.reviveText.setVisible(true);
        if (left <= 0) {
            // Spent. Grey it out rather than hiding it, so the player
            // understands why the ball no longer saves them.
            this.reviveText.setColor('#8fa6bd');
        }
    }

    /** Short green flash across the screen when a revive fires. */
    reviveFlash() {
        const flash = this.add.rectangle(640, 360, 1280, 720, 0x2ecc71, 0.5)
            .setDepth(45);
        this.tweens.add({
            targets: flash,
            alpha: { from: 0.5, to: 0 },
            duration: 420,
            onComplete: () => flash.destroy()
        });
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

    createSounds() {
        // Create audio context for sound generation
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    createMuteButton() {
        // Pause button is essential on a phone, where there is no ESC key.
        // Mute sits to its left.
        UI.topRight(this, { onPause: () => this.togglePause() });
    }

    playClickSound() {
        if (isMuted) return;
        // Generate a "pop" sound for ball click
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = 800; // High pitch
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    playExplosionSound() {
        if (isMuted) return;
        // Generate an explosion sound
        const bufferSize = this.audioContext.sampleRate * 0.5; // 0.5 seconds
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate white noise
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;
        
        const gainNode = this.audioContext.createGain();
        noise.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Fade out the explosion
        gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        
        noise.start(this.audioContext.currentTime);
        noise.stop(this.audioContext.currentTime + 0.5);
    }

    playBounceSound() {
        if (isMuted) return;
        // PHASE 13: Generate a bounce sound
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = 300; // Lower pitch than click
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.15);
    }

    triggerGameOver() {
        // PHASE 7: Explosion effect and fade to game over
        console.log('Ball fully entered goal - Game Over!');
        
        // PHASE 8: Save high score
        const currentHighScore = localStorage.getItem('goalDefenderHighScore') || 0;
        if (this.score > currentHighScore) {
            localStorage.setItem('goalDefenderHighScore', this.score);
            console.log('New high score:', this.score);
        }
        
        // Play explosion sound
        this.playExplosionSound();
        
        // Create particle explosion at ball position
        if (!window.Settings || window.Settings.isOn('gdParticles')) {
            this.add.particles(this.ball.x, this.ball.y, 'ball_default', {
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
        
        // Fade screen to black
        this.cameras.main.fadeOut(1000, 0, 0, 0);
        
        // Move to GameOverScene after fade
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('GameOverScene', {
                score: this.score,
                deflections: this.runDeflections
            });
        });
    }

    onBallClick() {
        // PHASE 4: Click-to-deflect mechanic with upward curve
        console.log('onBallClick called');
        if (this.ball) {
            console.log('Current velocity:', this.ball.body.velocity.x);
            
            // PHASE 6: Increase ball speed with dynamic rate
            // Past 100% the step gets smaller. Both the step size and the
            // ceiling are per-ball (Neon steps faster, Spark tops out lower).
            const maxBoost = this.maxSpeedBoost;
            let increaseRate = this.boostStepMain;

            if (this.speedBoost >= maxBoost) {
                // Max boost reached, no more increase
                increaseRate = 1.0;
            } else if (this.speedBoost >= 100) {
                increaseRate = this.boostStepLate;
            }
            
            if (this.speedBoost < maxBoost) {
                this.ballSpeed = this.ballSpeed * increaseRate;
                const boostAmount = (increaseRate - 1) * 100;
                this.speedBoost += boostAmount; // Track cumulative boost
                
                // Round to avoid floating point precision issues
                this.speedBoost = Math.round(this.speedBoost * 100) / 100;
                
                // Cap at this ball's ceiling
                if (this.speedBoost > maxBoost) {
                    this.speedBoost = maxBoost;
                }
            }
            
            // PHASE 6 Optional: Slight variation of angle on each bounce
            const angleVariation = Phaser.Math.Between(-20, 20); // Random angle variation
            const upwardSpeed = -350 + angleVariation;
            
            // Reverse direction toward the wall (right) with increased speed
            const horizontalSpeed = this.ballSpeed;
            
            this.ball.setVelocity(horizontalSpeed, upwardSpeed);
            
            // Add score (affected by ball ability)
            const scoreGain = Math.round(this.scoreMultiplier);
            this.score += scoreGain;

            // Deflections are 1 per successful click, tracked separately so
            // achievements can use them even if ball score multipliers change.
            this.runDeflections++;
            this.lifetimeDeflections++;
            localStorage.setItem('goalDefenderDeflections', this.lifetimeDeflections);

            this.scoreText.setText('Score: ' + this.score);
            this.speedText.setText('Speed Boost: ' + this.speedBoost + '%');

            // Feed the achievement system, which may unlock and pay out here
            if (window.Achievements) {
                window.Achievements.setMaxSpeed(this.speedBoost);
                window.Achievements.check(this);
            }

            // PHASE 12: Screen shake on click
            if (window.Settings && window.Settings.isOn('gdShake')) {
                this.cameras.main.shake(100, 0.005);
            }
            
            // PHASE 12: Flash effect when score increments
            this.scoreText.setScale(1.3);
            this.tweens.add({
                targets: this.scoreText,
                scale: 1,
                duration: 200,
                ease: 'Back.easeOut'
            });
            
            // Play click sound
            this.playClickSound();
            
            console.log('Ball deflected! New speed:', this.ballSpeed, 'Speed boost:', this.speedBoost + '%', 'Score:', this.score);
        } else {
            console.error('Ball not found!');
        }
    }

    shrinkHitbox() {
        // PHASE 5: Shrink hitbox every 10 seconds
        if (this.hitboxRadius > this.minHitboxRadius) {
            this.hitboxRadius -= this.hitboxShrinkAmount;
            
            // Don't go below minimum (ball size)
            if (this.hitboxRadius < this.minHitboxRadius) {
                this.hitboxRadius = this.minHitboxRadius;
            }
            
            // PHASE 12: Shrinking hitbox pulse animation
            this.tweens.add({
                targets: this.hitboxCircle,
                alpha: { from: 0.5, to: 0.3 },
                duration: 500,
                yoyo: true,
                repeat: 1
            });
            
            console.log('Hitbox shrunk to:', this.hitboxRadius, 'Min:', this.minHitboxRadius);
        } else {
            console.log('Hitbox at minimum size (ball size)');
        }
    }

    onWallHit() {
        // Ball bounces off the wall (reverse horizontal direction)
        if (this.ball) {
            const currentVerticalVelocity = this.ball.body.velocity.y;
            
            // Add random vertical velocity to make ball less predictable
            // 50% chance to add upward velocity, 50% chance to keep current or add slight downward
            const randomBoost = Math.random();
            let newVerticalVelocity = currentVerticalVelocity;
            
            if (randomBoost > 0.5) {
                // Add upward velocity
                newVerticalVelocity = -200 - Math.random() * 100; // Random upward between -200 and -300
            } else if (Math.abs(currentVerticalVelocity) < 50) {
                // If moving slowly, add some random velocity (up or down)
                newVerticalVelocity = (Math.random() - 0.5) * 300; // Random between -150 and 150
            }
            
            this.ball.setVelocity(-this.ballSpeed, newVerticalVelocity);
            
            // PHASE 13: Bounce sound
            this.playBounceSound();
            
            console.log('Ball bounced off wall with vertical velocity:', newVerticalVelocity);
        }
    }

    onGroundHit() {
        // When ball hits ground, make it jump
        if (this.ball && this.ball.body.touching.down) {
            // Only bounce if ball is touching ground from above
            
            // Fixed jump velocity to reach approximately goal height.
            // Rubber Ball bounces 25% higher.
            const jumpVelocity = -400 * (this.jumpMultiplier || 1);
            
            // Keep horizontal velocity constant
            const horizontalVelocity = this.ball.body.velocity.x > 0 ? this.ballSpeed : -this.ballSpeed;
            this.ball.setVelocity(horizontalVelocity, jumpVelocity);
            
            // PHASE 13: Bounce sound
            this.playBounceSound();
            
            console.log('Ball bounced off ground! Jump velocity:', jumpVelocity, 'Horizontal:', horizontalVelocity);
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

        // Dim the whole screen
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
            label: 'MAIN MENU',
            textSize: 26,
            fillTop: 0xffb340, fillBottom: 0xf08a1d,
            depth: 202,
            onClick: () => this.scene.start('MenuScene')
        });
        this.pauseMenuElements.push(menu);

        this.pauseOverlay = overlay;
        this.pauseTitle = title;
    }

    resumeGame() {
        this.isPaused = false;
        this.physics.resume();

        // Remove pause menu elements (UI.button returns a Container, and
        // destroy() on a Container removes its children too)
        if (this.pauseMenuElements) {
            this.pauseMenuElements.forEach(element => element.destroy());
            this.pauseMenuElements = null;
        }
        this.pauseOverlay = null;
        this.pauseTitle = null;
    }

    update() {
        // Release the anti-autoclicker lock once the ball is heading back to
        // the right. A deflect always sends it right, so this re-arms for the
        // next approach without needing a timer.
        if (this.deflectLock && this.ball && this.ball.body && this.ball.body.velocity.x > 0) {
            this.deflectLock = false;
        }

        // Remember where the ball has just been, so a tap arriving a few
        // frames after the player saw it still counts as a hit.
        if (this.ball) {
            this.ballHistory.push({ x: this.ball.x, y: this.ball.y });
            while (this.ballHistory.length > (this.HISTORY_FRAMES || 10)) {
                this.ballHistory.shift();
            }
        }

        // Update countdown text
        if (this.countdownText) {
            if (this.hitboxRadius <= this.minHitboxRadius) {
                this.countdownText.setText('Hitbox: MIN SIZE');
            } else {
                this.countdownText.setText('Hitbox shrinks in: ' + this.shrinkCountdown + 's');
            }
        }

        // Update hitbox position and size to follow the ball
        if (this.ball && this.hitboxCircle) {
            this.hitboxCircle.x = this.ball.x;
            this.hitboxCircle.y = this.ball.y;
            
            // PHASE 5: Smooth animation - update hitbox circle radius
            this.hitboxCircle.setRadius(this.hitboxRadius);
            
            // Only show hitbox when ball is moving left (toward goal) and left of middle
            const ballLeftOfMiddle = this.ball.x < 640;
            const alwaysOn = window.Settings && window.Settings.isOn('gdHitboxAlways');
            if (this.ball.body.velocity.x < 0 && ballLeftOfMiddle) {
                this.hitboxCircle.setAlpha(0.3);
            } else {
                this.hitboxCircle.setAlpha(alwaysOn ? 0.25 : 0.1); // Dim when not clickable
            }
        }

        // Restrict ball height - can't go higher than goal height
        if (this.ball && this.ball.y < this.maxBallHeight) {
            this.ball.y = this.maxBallHeight;
            this.ball.setVelocityY(Math.abs(this.ball.body.velocity.y) * 0.5); // Bounce down
        }

        // PHASE 7: Check if the full ball is completely behind the goal opening (lose condition)
        if (this.ball && this.goal && !this.gameOver) {
            // Goal opening is at the right side of the goal sprite
            const goalOpeningX = this.goal.x + (this.goal.displayWidth / 2);
            const ballRightEdge = this.ball.x + (this.ball.displayWidth / 2);
            
            // Lose when the entire ball passes through the goal opening
            if (ballRightEdge < goalOpeningX) {
                    // Revive Ball: spend the charge instead of losing. The ball is
                    // pushed back out to the right and sent away from the goal, so
                    // play continues from the same score. Once per run.
                    if (this.revivesLeft > 0) {
                        this.revivesLeft--;
                        this.reviveFlash();
                        this.showReviveCounter();
                        this.ball.x = goalOpeningX + (this.ball.displayWidth / 2) + 12;
                        this.ball.setVelocity(this.ballSpeed, -260);
                        this.ball.setVisible(true);
                        this.hitboxCircle.setVisible(true);
                        return;
                    }
                    this.gameOver = true;
                    this.triggerGameOver();
                }
        }
    }
}
