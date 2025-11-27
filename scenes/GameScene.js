class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
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
            grass.setDepth(11); // Above goal (depth 10) and wall
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
        this.input.on('pointerdown', (pointer) => {
            console.log('Click detected at:', pointer.x, pointer.y);
            if (this.ball) {
                const distance = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.ball.x, this.ball.y);
                
                // PHASE 5: Only clickable when ball is left of middle line
                const ballLeftOfMiddle = this.ball.x < 640;
                
                // Only clickable when ball is moving toward goal (left)
                const movingLeft = this.ball.body.velocity.x < 0;
                
                console.log('Distance:', distance, 'Hitbox:', this.hitboxRadius, 'Left of middle:', ballLeftOfMiddle, 'Moving left:', movingLeft);
                
                if (distance <= this.hitboxRadius && movingLeft && ballLeftOfMiddle) {
                    console.log('Click within hitbox, ball moving left and left of middle!');
                    this.onBallClick();
                }
            }
        });

        // Place the goal sprite on the left (directly on top of ground)
        if (this.textures.exists('goal')) {
            this.goal = this.physics.add.sprite(80, groundY - groundHeight, 'goal');
            this.goal.setOrigin(0.5, 1); // Anchor to bottom
            this.goal.setScale(0.65); // Make goal slightly bigger (65% of original size)
            this.goal.setImmovable(true);
            this.goal.body.setAllowGravity(false);
            this.goal.setDepth(10); // Goal appears in front of ball
            
            // Set max ball height to top of goal
            this.maxBallHeight = this.goal.y - this.goal.displayHeight;
            
            console.log('Goal added at y:', this.goal.y, 'Max ball height:', this.maxBallHeight);
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
            this.ballTrail = this.add.particles(0, 0, finalTexture, {
                speed: 50,
                scale: { start: 0.15, end: 0 },
                alpha: { start: 0.5, end: 0 },
                lifespan: 300,
                frequency: 50
            });
            this.ballTrail.startFollow(this.ball);
            this.ballTrail.setDepth(0);
            
            console.log('Ball created with texture:', finalTexture);
            console.log('Equipped ball:', this.equippedBall);
            
            // Set minimum hitbox size to ball size (affected by ball ability)
            this.minHitboxRadius = (this.ball.displayWidth / 2) * this.minHitboxMultiplier;
            
            console.log('Ball added at position:', this.ball.x, this.ball.y);
            console.log('Ball display size:', this.ball.displayWidth, this.ball.displayHeight);
            console.log('Min hitbox radius set to ball radius:', this.minHitboxRadius);
        } else {
            console.error('Ball texture not found! Tried:', finalTexture);
        }

        // Create invisible ground collider for ball to bounce on
        this.groundCollider = this.add.rectangle(640, this.groundLevel, 1280, 10, 0x00ff00, 0);
        this.physics.add.existing(this.groundCollider, true); // true = static body
        this.physics.add.collider(this.ball, this.groundCollider, this.onGroundHit, null, this);
        
        // Place the wall sprite on the right (directly on top of ground)
        if (this.textures.exists('wall')) {
            this.wall = this.physics.add.sprite(1200, groundY - groundHeight, 'wall');
            this.wall.setOrigin(0.5, 1); // Anchor to bottom
            this.wall.setImmovable(true);
            this.wall.body.setAllowGravity(false);
            console.log('Wall added');
            
            // PHASE 3: Add collision with wall → bounce
            this.physics.add.collider(this.ball, this.wall, this.onWallHit, null, this);
        } else {
            console.error('Wall texture not found!');
        }

        // Add physics boundaries
        this.physics.world.setBounds(0, 0, 1280, 720);

        // Add score text UI (temporary)
        this.score = 0;
        this.scoreText = this.add.text(20, 20, 'Score: 0', {
            fontSize: '32px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        });

        // Add countdown text for hitbox shrinking
        this.countdownText = this.add.text(20, 60, 'Hitbox shrinks in: 10s', {
            fontSize: '24px',
            fill: '#ffff00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });

        // Add speed boost text
        this.speedBoost = 0; // Track total speed boost percentage
        this.speedText = this.add.text(20, 95, 'Speed Boost: 0%', {
            fontSize: '24px',
            fill: '#00ff00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });

        // Initialize game over flag
        this.gameOver = false;

        // Create sound effects using Web Audio API
        this.createSounds();

        // Mute/Unmute button
        this.createMuteButton();

        console.log('GameScene loaded - Phase 3 complete');
    }

    loadBallAbilities() {
        // PHASE 10: Set ability modifiers based on equipped ball
        this.speedMultiplier = 1.0;
        this.hitboxShrinkMultiplier = 1.0;
        this.scoreMultiplier = 1;
        this.minHitboxMultiplier = 1.0;
        
        switch(this.equippedBall) {
            case 'golden':
                this.hitboxShrinkMultiplier = 0.85; // Shrinks 15% slower
                break;
            case 'fire':
                this.scoreMultiplier = 2; // +2 score per deflect
                break;
            case 'steel':
                this.speedMultiplier = 0.9; // 10% slower
                break;
            case 'ghost':
                this.minHitboxMultiplier = 1.2; // Min hitbox 120% of ball size
                break;
            case 'spark':
                this.scoreMultiplier = 1.05; // +5% extra score
                break;
        }
        
        console.log('Ball abilities loaded:', this.equippedBall);
    }

    getBallTexture() {
        const textureMap = {
            'default': 'ball_default',
            'golden': 'ball_golden',
            'fire': 'ball_fire',
            'steel': 'ball_steel',
            'ghost': 'ball_ghost',
            'spark': 'ball_spark'
        };
        return textureMap[this.equippedBall] || 'ball_default';
    }

    createSounds() {
        // Create audio context for sound generation
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    createMuteButton() {
        const x = 1230;
        const y = 30;
        
        // Create the mute button sprite
        this.muteButton = this.add.image(x, y, isMuted ? 'volume-mute' : 'volume-unmute');
        this.muteButton.setScale(0.08);
        this.muteButton.setDepth(100);
        this.muteButton.setInteractive();

        this.muteButton.on('pointerover', () => {
            this.muteButton.setScale(0.1);
        });

        this.muteButton.on('pointerout', () => {
            this.muteButton.setScale(0.08);
        });

        this.muteButton.on('pointerdown', () => {
            isMuted = !isMuted;
            localStorage.setItem('goalDefenderMuted', isMuted);
            this.muteButton.setTexture(isMuted ? 'volume-mute' : 'volume-unmute');
        });
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
        const particles = this.add.particles(this.ball.x, this.ball.y, 'ball_default', {
            speed: { min: 100, max: 300 },
            scale: { start: 0.3, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 800,
            quantity: 20,
            blendMode: 'ADD'
        });
        
        // Stop ball movement
        this.ball.setVelocity(0, 0);
        this.ball.setVisible(false);
        
        // Fade screen to black
        this.cameras.main.fadeOut(1000, 0, 0, 0);
        
        // Move to GameOverScene after fade
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('GameOverScene', { score: this.score });
        });
    }

    onBallClick() {
        // PHASE 4: Click-to-deflect mechanic with upward curve
        console.log('onBallClick called');
        if (this.ball) {
            console.log('Current velocity:', this.ball.body.velocity.x);
            
            // PHASE 6: Increase ball speed with dynamic rate
            // After 150% boost, increase by 2% instead of 4%
            // Max boost is 300%
            let increaseRate = 1.04; // 4% by default
            
            if (this.speedBoost >= 300) {
                // Max boost reached, no more increase
                increaseRate = 1.0;
            } else if (this.speedBoost >= 150) {
                // After 150%, increase by 2%
                increaseRate = 1.02;
            }
            
            if (this.speedBoost < 300) {
                this.ballSpeed = this.ballSpeed * increaseRate;
                const boostAmount = (increaseRate - 1) * 100;
                this.speedBoost += boostAmount; // Track cumulative boost
                
                // Round to avoid floating point precision issues
                this.speedBoost = Math.round(this.speedBoost * 100) / 100;
                
                // Cap at 300%
                if (this.speedBoost > 300) {
                    this.speedBoost = 300;
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
            this.scoreText.setText('Score: ' + this.score);
            this.speedText.setText('Speed Boost: ' + this.speedBoost + '%');
            
            // PHASE 12: Screen shake on click
            this.cameras.main.shake(100, 0.005);
            
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
            
            // PHASE 12: Particles on wall bounce
            const particles = this.add.particles(this.ball.x, this.ball.y, this.getBallTexture(), {
                speed: { min: 100, max: 200 },
                scale: { start: 0.15, end: 0 },
                alpha: { start: 0.8, end: 0 },
                lifespan: 400,
                quantity: 10
            });
            
            // Destroy particle emitter after particles are done
            this.time.delayedCall(500, () => {
                particles.destroy();
            });
            
            // PHASE 13: Bounce sound
            this.playBounceSound();
            
            console.log('Ball bounced off wall with vertical velocity:', newVerticalVelocity);
        }
    }

    onGroundHit() {
        // When ball hits ground, make it jump
        if (this.ball && this.ball.body.touching.down) {
            // Only bounce if ball is touching ground from above
            
            // Fixed jump velocity to reach approximately goal height
            const jumpVelocity = -400;
            
            // Keep horizontal velocity constant
            const horizontalVelocity = this.ball.body.velocity.x > 0 ? this.ballSpeed : -this.ballSpeed;
            this.ball.setVelocity(horizontalVelocity, jumpVelocity);
            
            // PHASE 13: Bounce sound
            this.playBounceSound();
            
            console.log('Ball bounced off ground! Jump velocity:', jumpVelocity, 'Horizontal:', horizontalVelocity);
        }
    }

    update() {
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
            if (this.ball.body.velocity.x < 0 && ballLeftOfMiddle) {
                this.hitboxCircle.setAlpha(0.3);
            } else {
                this.hitboxCircle.setAlpha(0.1); // Dim when not clickable
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
                this.gameOver = true;
                this.triggerGameOver();
            }
        }
    }
}
