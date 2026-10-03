class GameScene extends Phaser.Scene {
    // Accepts a key so TutorialScene can inherit the exact same physics
    // instead of re-implementing (and drifting from) it.
    constructor(key) {
        super({ key: key || 'GameScene' });
    }

    create() {

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
        }

        // Store ground level for physics
        this.groundLevel = groundY - groundHeight;


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

        /* PHASE 5: Timer to shrink hitbox every 20 seconds.
         *
         * Skipped entirely for the Inverted Ball, whose hitbox is pinned. Not
         * starting the timer is enough - shrinkHitbox() is left untouched, so
         * every other ball keeps the single code path.
         *
         * There is deliberately no `else` clause setting a pinned radius here.
         * This block runs before the ball sprite exists, so there is no ball
         * size to scale against - which is exactly why it used to hardcode
         * `fixedHitbox = 150` as PIXELS. On a 51.2px-radius ball that is a 293%
         * hitbox wearing a "150%" label. The pinned radius is applied further
         * down, right after minHitboxRadius, where the real size is known. */
        if (!this.fixedHitboxPct) {
            this.time.addEvent({
                delay: 20000, // 20 seconds
                callback: this.shrinkHitbox,
                callbackScope: this,
                loop: true
            });
        }

        /* PHASE 5: Countdown timer (updates every second).
         *
         * Also skipped for a fixed hitbox. The countdown exists to warn that
         * the target is about to shrink, so for the Inverted Ball it warns
         * about something that never happens: it counted down past zero, then
         * reset to 20, and the HUD displayed a nonsense countdown for the whole
         * run while the hitbox sat unchanged. */
        if (!this.fixedHitboxPct) {
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
        }


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

            /* Closest the tap came to the ball's centre, in either place we are
             * willing to accept the hit. The Focus Ball judges "perfect" on
             * this distance, so it has to be measured across BOTH candidates -
             * judging only the current position would miss a perfect that the
             * history window legitimately allowed. */
            let bestDist = Phaser.Math.Distance.Between(
                pointer.x, pointer.y, this.ball.x, this.ball.y);

            // 1) Where the ball is now
            let hit = bestDist <= r;

            // 2) Where it has just been
            if (!hit) {
                for (let i = this.ballHistory.length - 1; i >= 0; i--) {
                    const h = this.ballHistory[i];
                    const d = Phaser.Math.Distance.Between(pointer.x, pointer.y, h.x, h.y);
                    if (d < bestDist) bestDist = d;
                    if (d <= r) {
                        hit = true;
                        break;
                    }
                }
            }

            if (!hit) return;

            // Lock before deflecting so a second tap arriving in the same
            // frame is dropped. Released once the ball heads back right.
            this.deflectLock = true;
            this.onBallClick(bestDist);
        });

        // Place the goal sprite on the left (directly on top of ground)
        if (this.textures.exists('goal')) {
            this.goal = this.physics.add.sprite(80, groundY - groundHeight, 'goal');
            this.goal.setOrigin(0.5, 1); // Anchor to bottom
            this.goal.setScale(0.65); // Make goal slightly bigger (65% of original size)
            this.goal.setImmovable(true);
            this.goal.body.setAllowGravity(false);
            this.goal.setDepth(10); // Goal appears in front of ball

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
            /* The trail has its own setting. It emits a particle every few frames
             * for the whole run, which makes it the expensive effect on a slow
             * phone - the deflect explosion is one burst. Sharing a toggle with
             * the explosion meant turning the trail off also cost you that. */
            if (!window.Settings || window.Settings.isOn('gdBallTrail')) {
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


            // Set minimum hitbox size to ball size (affected by ball ability)
            this.minHitboxRadius = (this.ball.displayWidth / 2) * this.minHitboxMultiplier;

            /* The Inverted Ball's hitbox never shrinks, so it is pinned to a fixed
             * FRACTION of the ball rather than to a pixel count.
             *
             * It used to be pinned to 150 pixels, at a point where the ball did
             * not exist yet so there was nothing to scale against. The ball is a
             * 512px texture at scale 0.2, so its radius is 51.2px and a 150px
             * hitbox is 293% of the ball - while the shop card said "Hitbox stays
             * 150%". The player got a target three times the size they were told
             * they would get.
             *
             * This is the first point in create() where the ball's real display
             * size exists, which is why the pinned radius is applied here rather
             * than with the timers above. */
            if (this.fixedHitboxPct) {
                this.hitboxRadius = (this.ball.displayWidth / 2) * this.fixedHitboxPct;
                this.hitboxCircle.setRadius(this.hitboxRadius);
                this.shrinkCountdown = -1;   // no countdown: the size never changes
            }

            // Void Ball starts with the hitbox already fully shrunk
            if (this.startHitboxMin) {
                this.hitboxRadius = this.minHitboxRadius;
                this.hitboxShrinkAmount = 0;   // nowhere left to shrink to
            }

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
        this.lifetimeDeflections = parseInt(localStorage.getItem('goalDefenderDeflections') || '0', 10);

        /* Perfect hits (Focus Ball) and the best single run.
         *
         * The lifetime and best-run values are separate on purpose: "10 perfect
         * hits in one run" is a different achievement from "10 perfect hits
         * ever", and the same is true of deflections. Read from storage rather
         * than assumed 0 so a returning player keeps their record. */
        this.runPerfects = 0;
        this.lifetimePerfects = parseInt(localStorage.getItem('goalDefenderPerfectHits') || '0', 10);
        this.bestRunDeflections = parseInt(localStorage.getItem('goalDefenderBestRunDeflections') || '0', 10);
        this.bestRunPerfects = parseInt(localStorage.getItem('goalDefenderBestRunPerfects') || '0', 10);

        /* HUD: three readouts, no backing panel.
         *
         * A soft dark scrim sat behind these for a while so the text would read
         * over the stadium art, and it was removed again on request - it showed
         * as a visible grey slab in the corner of every frame of every run, which
         * looked like a rendering artefact rather than a design choice.
         *
         * Legibility is carried entirely by the outline, which is now heavier
         * than it was: at 5-6px of black the text holds up against both the bright
         * sky and the dark stands without any plate behind it. The speed readout
         * is also no longer green - green is this game's "active" colour for every
         * toggle, so "Speed Boost: 0%" in green read as an enabled switch rather
         * than a value. */
        this.scoreText = this.add.text(24, 28, 'Score: 0', {
            fontSize: UI.TYPE.lead + 'px',
            color: '#ffffff',
            fontStyle: '900',
            stroke: '#000000',
            strokeThickness: 6
        });

        // Add countdown text for hitbox shrinking
        this.countdownText = this.add.text(24, 68, 'Hitbox shrinks in: 10s', {
            fontSize: UI.TYPE.body + 'px',
            color: '#ffd45e',
            fontStyle: '800',
            stroke: '#000000',
            strokeThickness: 5
        });

        // Add speed boost text
        this.speedBoost = 0; // Track total speed boost percentage
        this.speedText = this.add.text(24, 104, 'Speed Boost: 0%', {
            fontSize: UI.TYPE.body + 'px',
            color: '#e6eef7',
            fontStyle: '800',
            stroke: '#000000',
            strokeThickness: 5
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
        // How many missed balls the ball can save.
        this.revivesLeft = 0;

        /* New abilities.
         *
         * Each defaults to OFF so every ball that does not set it behaves
         * exactly as before. Getting this wrong is how a "cosmetic" ball ends
         * up secretly changing the payout. */
        // Hitbox pinned to a fixed size instead of shrinking (Inverted).
        this.fixedHitboxPct = 0;
        // Dead-centre taps award bonus score (Focus).
        this.perfectRadius = 0;
        this.perfectScore = 0;
        // Money grows with each deflect instead of paying a flat rate (Rally).
        // The Nth deflect pays N dollars.
        this.rallyMoney = false;
        this.rallyEarned = 0;
        // Perfect hits in the CURRENT run, for achievements.
        this.runPerfects = 0;

        switch(this.equippedBall) {
            case 'golden':
                this.hitboxShrinkMultiplier = 0.85; // Shrinks 15% slower
                break;
            case 'steel':
                /* 10% slower, on both levers - the same shape as Anchor at a
                 * tenth of the strength.
                 *
                 * "10% slower" is a statement about the base speed, and the shop
                 * used to print exactly that: "Speed increases 10% slower", which
                 * never told you the boost was reduced too. It is now
                 * "Speed boost +3.6% per hit, base speed 90%".
                 *
                 * The conversion from one to the other: the default step is +4%
                 * per hit, and 10% off that is 4 x 0.9 = 3.6%. So
                 * boostStepMain 1.04 -> 1.036, which is what this has always set
                 * - the mechanic was already right and only the copy was
                 * misleading.
                 *
                 * At 0.036 the step is rounded, so the percentage no longer
                 * lands on tidy multiples of 4 - that is why the HUD shows
                 * numbers like 36% and 72%. It is still monotonic and still
                 * reaches the 300% ceiling, just with 10% more taps. */
                this.speedMultiplier = 0.9;
                this.boostStepMain = 1.036;
                this.boostStepLate = 1.018;
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
                /* Normal speed, but the boost builds at half rate.
                 *
                 * ONLY the boost is halved. speedMultiplier stays at its default
                 * 1.0, and that is the whole point of the ball: the ball moves at
                 * exactly the speed it always did, and what changes is how fast
                 * that speed builds.
                 *
                 * This had speedMultiplier = 0.5 as well, halving the ball's
                 * ACTUAL speed for the entire run - 150 instead of 300 at the
                 * start, and half the peak too, because the boost multiplies the
                 * base rather than adding to it. So the ball crawled, which is not
                 * a trade-off so much as a worse game: it made early taps easy and
                 * late ones impossible, and the shop copy "Speed increases 50%
                 * slower" gave no hint that the ball itself was crawling.
                 *
                 * boostStep halved means the boost climbs per TAP, so halving the
                 * step means twice as many taps to reach any given percentage:
                 * 40% at 10 taps becomes 20%, and 110% at 30 taps becomes roughly
                 * 55%. The 300% ceiling is unchanged - the ball can still reach
                 * top speed, it just takes about twice the taps, which is what
                 * the card now says. */
                this.boostStepMain = 1.02;   // +2% per hit instead of +4%
                this.boostStepLate = 1.01;   // +1% past 100% instead of +2%
                break;
            case 'neon':
                this.boostStepMain = 1.08; // +8% per hit
                this.boostStepLate = 1.04; // +4% past 100%
                break;
            case 'candy':
                this.scoreMultiplier = 3; // +3 score per deflect
                break;
            case 'void':
                /* Starts at the minimum hitbox with no room to shrink.
                 *
                 * The 170% ceiling is what makes it survivable at all. It was
                 * raised from 150% to 170% because at 150% the ball spent so long
                 * at its slowest that the run had no shape - you were tapping a
                 * crawling ball into a shrinking target. 170% still ends far
                 * below the default 300%, so the trade is intact.
                 *
                 * It ALSO used to set boostStepMain to 1.02 and boostStepLate to
                 * 1.01, halving the per-hit speed climb. Nothing in the shop copy
                 * said so - the description reads only "Hitbox starts min, max
                 * speed 170%" - so a player buying it at $100,000 got a third
                 * undisclosed advantage on top of starting at the minimum
                 * hitbox. That is not a trade, it is simply overpowered.
                 *
                 * It now uses the default 1.04 / 1.02. The two things the player
                 * was actually told about - minimum hitbox from the first hit, and
                 * a 170% ceiling - are the entire trade. */
                this.startHitboxMin = true;
                this.maxSpeedBoost = 170;
                break;
            case 'gauntlet':
                // Easy to hit and scores hugely, but can never go fast.
                this.minHitboxMultiplier = 1.7; // Hitbox 170% of ball size
                this.maxSpeedBoost = 130;
                this.scoreMultiplier = 5; // +5 score per deflect
                break;
            case 'money':
                /* Pays $5 per deflect instead of $3.
                 *
                 * There used to be a scoreRate field set here for this, and a
                 * comment claiming GameOverScene read it. Nothing ever did -
                 * GameOverScene works out the rate from the equipped ball id
                 * directly. The field was assigned in two scenes, read in none,
                 * and looked enough like the real wiring that editing it would
                 * have compiled, passed review, and done nothing. Deleted; the
                 * Money Ball is wired entirely by the one line in
                 * GameOverScene that switches on equippedBall. */
                break;
            case 'revive':
                // One free mistake. Set directly rather than via a
                // startRevives field, because a property left over from a
                // previous run would leak the free revive into other balls.
                this.revivesLeft = 1;
                break;

            /* ---- added balls ---- */

            case 'life':
                /* Revive Ball with a bigger budget: three saves, not one.
                 *
                 * Costs three times as much, and a save is worth roughly a
                 * third of a run, so it is deliberately not simply "three times
                 * better" - it is a run-ender rather than a small rescue. */
                this.revivesLeft = 3;
                break;

            case 'sprung':
                /* 60% higher off the ground.
                 *
                 * The roof clamp at maxBallHeight throws away any bounce above
                 * it, so the realised height is less than 60% more. Measured
                 * headroom for the 25% Rubber Ball was 35px, which is why this
                 * stops at 1.6 rather than going higher. */
                this.jumpMultiplier = 1.6;
                break;

            case 'spark':
                /* Caps the speed boost at 210% instead of 300%.
                 *
                 * This ball existed as code, a texture and an asset for the
                 * whole of v2.1 and was never in the shop, so nobody could buy
                 * it and the achievement that needs a 210% cap was unreachable.
                 * Adding the shop line is the whole fix. */
                this.maxSpeedBoost = 210;
                break;

            case 'inverted':
                /* Two things pinned to the same number.
                 *
                 * The hitbox never shrinks, so it stays at a fixed 150% of the
                 * ball for the whole run - the target never gets harder. The
                 * speed is also capped at 150%, which means it never gets fast
                 * either. Neither is a buff on its own: an unshrinkable hitbox
                 * alone would be strictly easier than the default, but pairing
                 * it with a hard speed ceiling removes the skill ceiling too,
                 * so the run is long and safe rather than escalating.
                 *
                 * fixedHitboxPct is a FRACTION, matching how minHitboxMultiplier
                 * expresses every other ball. It used to be `fixedHitbox = 150`,
                 * read as a pixel radius and applied before the ball sprite
                 * existed - which gave a 150px hitbox on a 51.2px ball, or 293%
                 * of it, while the card claimed 150%. */
                this.fixedHitboxPct = 1.5;
                this.minHitboxMultiplier = 1.5;
                this.maxSpeedBoost = 150;
                break;

            case 'focus':
                /* A tap within 20px of the ball's centre is a Perfect and pays
                 * 5 bonus score on top of the normal deflect score.
                 *
                 * Judged on the closest the tap came to the centre, across both
                 * the ball's current position and its recent history - using the
                 * history matters because on a phone a tap routinely lands after
                 * the ball has moved, and a "perfect" that requires frame-exact
                 * timing would be near-impossible on a touchscreen. */
                this.perfectRadius = 20;
                this.perfectScore = 5;
                break;

            case 'rally':
                /* Money climbs with the deflect count: the 1st tap pays $1, the
                 * 2nd $2, and the 50th pays $50. So a run is worth the
                 * TRIANGULAR number of its deflections, not a flat rate.
                 *
                 * Deliberately based on DEFLECTIONS, not score - the Money Ball
                 * already pays per deflect, and a score-based version would
                 * compound with Fire and Candy and become the only ball worth
                 * buying. This one is flat in score, so it is a pure money pick.
                 *
                 * 50 deflects is a good run and pays $1,275, versus $150 on the
                 * default ball. That gap is why it costs $65,000. */
                this.rallyMoney = true;
                this.rallyEarned = 0;
                break;
        }

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
            'revive': 'ball_revive',
'inverted': 'ball_inverted',
'focus': 'ball_focus',
'rally': 'ball_rally',
'life': 'ball_life',
'sprung': 'ball_sprung',
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

        // PHASE 8: Save high score
        const currentHighScore = localStorage.getItem('goalDefenderHighScore') || 0;
        if (this.score > currentHighScore) {
            localStorage.setItem('goalDefenderHighScore', this.score);
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
                deflections: this.runDeflections,
                /* Handed to the results screen so it can pay the Rally Ball's
                 * escalating total. Not re-read from localStorage there: this
                 * value belongs to THIS run, and reading the key would pick up
                 * whatever the last run happened to save. */
                rallyEarned: this.rallyEarned,
                perfects: this.runPerfects
            });
        });
    }

    onBallClick(tapDistance) {
        // PHASE 4: Click-to-deflect mechanic with upward curve
        if (this.ball) {

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
            let scoreGain = Math.round(this.scoreMultiplier);

            /* Focus Ball: a dead-centre tap pays bonus score.
             *
             * Judged on the distance handed in by the hit test, which is the
             * closest the tap came to the ball across its current position AND
             * its recent history. A tap with no recorded distance (a scripted
             * call with no argument) cannot be perfect, so it just deflects. */
            let perfect = false;
            if (this.perfectRadius > 0 &&
                typeof tapDistance === 'number' &&
                tapDistance <= this.perfectRadius) {
                perfect = true;
                scoreGain += this.perfectScore;
                this.runPerfects++;
                this.lifetimePerfects++;
                localStorage.setItem('goalDefenderPerfectHits', this.lifetimePerfects);
            }

            this.score += scoreGain;

            // Deflections are 1 per successful click, tracked separately so
            // achievements can use them even if ball score multipliers change.
            this.runDeflections++;
            this.lifetimeDeflections++;
            localStorage.setItem('goalDefenderDeflections', this.lifetimeDeflections);

            /* Rally Ball: the Nth deflect of the run pays N dollars.
             *
             * Incremented AFTER counting the deflect, so the first tap pays $1
             * as promised rather than $0. Accumulated here and handed to the
             * results screen, because the payout happens there. */
            if (this.rallyMoney) {
                this.rallyEarned += this.runDeflections;
            }

            /* Say so when a Focus Ball tap lands dead centre.
             *
             * Without feedback a Perfect is invisible: the score jumps by 5
             * instead of 1 and a player who was not aiming for the centre has
             * no idea the ball is doing anything. */
            if (perfect) {
                const t = this.add.text(this.ball.x, this.ball.y - 40, 'PERFECT +' + this.perfectScore, {
                    fontSize: '30px', color: '#3ddc6b', fontStyle: '900',
                    stroke: '#000000', strokeThickness: 5
                }).setOrigin(0.5).setDepth(50);
                this.tweens.add({
                    targets: t, y: t.y - 50, alpha: 0,
                    duration: 700, ease: 'Quad.easeOut',
                    onComplete: () => t.destroy()
                });
            }

            /* Best single run, for the deflect-in-one-run achievements.
             *
             * Only ever moves up. A new key rather than reusing the lifetime
             * total, because "deflect 100 in a single run" and "deflect 100 in
             * total" are different achievements. */
            if (this.runDeflections > this.bestRunDeflections) {
                this.bestRunDeflections = this.runDeflections;
                localStorage.setItem('goalDefenderBestRunDeflections', String(this.bestRunDeflections));
            }
            if (this.runPerfects > this.bestRunPerfects) {
                this.bestRunPerfects = this.runPerfects;
                localStorage.setItem('goalDefenderBestRunPerfects', String(this.bestRunPerfects));
            }

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

        } else {
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

        /* B8: a full-height vertical line was visible straight through the pause
         * card, including across the panel itself.
         *
         * It is middleLine - the red guide at x=640 marking the half of the field
         * you can hit on. At depth 5 it is correctly behind the 78%-alpha overlay,
         * but 22% transparency is enough to show a red line clearly, and it read
         * as a compositing seam rather than as a game element.
         *
         * Fixed by hiding the guide outright while paused rather than by making
         * the overlay opaque - the frozen ball and goal stay visible, which is
         * what a player actually wants to check when they pause. */
        if (this.middleLine) this.middleLine.setVisible(false);

        // Dim the whole screen
        const overlay = this.add.rectangle(640, 360, 1280, 720, 0x050a12, 0.84);
        overlay.setDepth(200);
        this.pauseMenuElements.push(overlay);

        /* M9: the card was 380 tall spanning 170..550, while its content only ran
         * from the title at 236 to the bottom of MAIN MENU at 471. The lower 79px
         * of the panel was empty, so it read as a wall rather than a dialog.
         *
         * Content is now title 214..266, CONTINUE 285..355, MAIN MENU 365..435, so
         * the card is 284 tall spanning 182..466 - roughly 32px of padding top and
         * bottom, which is what makes it look like a dialog. */
        const card = UI.panel(this, {
            x: 640, y: 324, w: 480, h: 284, radius: 24,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: 0x4a6a8a, borderWidth: 2, depth: 201
        });
        this.pauseMenuElements.push(card);

        const title = this.add.text(640, 240, 'PAUSED', {
            fontSize: '52px',
            color: '#ffffff',
            fontStyle: '900',
            stroke: '#f0a500',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(202);
        this.pauseMenuElements.push(title);

        const cont = UI.button(this, {
            x: 640, y: 320, w: 300, h: 70,
            label: 'CONTINUE',
            textSize: UI.TYPE.lead,
            fillTop: 0x3ddc6b, fillBottom: 0x17a34a,
            depth: 202,
            onClick: () => this.resumeGame()
        });
        this.pauseMenuElements.push(cont);

        const menu = UI.button(this, {
            x: 640, y: 400, w: 300, h: 70,
            label: 'MAIN MENU',
            textSize: UI.TYPE.lead,
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

        // Restore the hit-zone guide hidden by pauseGame().
        if (this.middleLine) this.middleLine.setVisible(true);

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
            if (this.fixedHitboxPct) {
                /* The Inverted Ball's hitbox never changes, so there is nothing
                 * to count down. Say that plainly instead of showing a
                 * countdown to a shrink that will never happen. */
                this.countdownText.setText('Hitbox: FIXED 150%');
            } else if (this.hitboxRadius <= this.minHitboxRadius) {
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
