class ParkourGame {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.currentLevel = 1;
        this.deaths = 0;
        this.timer = 0;
        this.bestTimes = new Array(50).fill(Infinity);
        this.isPlaying = false;
        this.useAI = false;
        
        // Physics properties
        this.velocity = new THREE.Vector3();
        this.gravity = -0.015;
        this.jumpForce = 0.3;
        this.moveSpeed = 0.1;
        this.isGrounded = false;
        this.moveDirection = new THREE.Vector3();
        
        // Game objects
        this.obstacles = [];
        this.projectiles = [];
        this.aiPlayer = null;
        
        // Add camera control properties
        this.cameraRotation = new THREE.Vector2(0, 0);
        this.targetCameraRotation = new THREE.Vector2(0, 0);
        this.mouseSensitivity = 0.002;
        this.keyRotationSpeed = 0.02;
        this.isMouseLocked = false;
        
        // Camera distance (zoom) properties
        this.cameraDistance = 10;
        this.targetCameraDistance = 10;
        this.minZoom = 5;
        this.maxZoom = 20;
        this.zoomSpeed = 1;
        
        // Smoothing properties
        this.cameraSmoothness = 0.1;
        this.zoomSmoothness = 0.1;
        
        // Level system properties
        this.levels = new Map(); // Store fixed level designs
        this.currentLevel = 1;
        this.maxLevels = 50;
        this.useFixedLevels = true; // Toggle between fixed and procedural levels
        
        // Initialize fixed level designs
        this.initializeLevels();
        
        // Camera settings
        this.cameraAngle = 0; // Horizontal camera rotation
        this.cameraHeight = 2;
        this.cameraDistance = 10;
        this.rotationSpeed = 0.03;
        
        // Movement settings
        this.moveDirection = new THREE.Vector3();
        this.baseSpeed = 0.15;
        this.moveSpeed = this.baseSpeed;
        this.sprintSpeed = this.baseSpeed * 1.8;
        this.isShifting = false;
        this.lastWPress = 0;
        this.platformFriction = 0.98; // Slight slip effect
        
        // Finish block
        this.finishBlock = null;
        
        this.init();
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Setup lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // Create player
        this.createPlayer();
        
        // Setup camera
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(this.player.position);

        // Initialize controls and events
        this.setupControls();
        this.setupEventListeners();
        
        // Load first level
        this.loadLevel(1);
        
        // Start animation loop
        this.animate();
    }

    createPlayer() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        this.player = new THREE.Mesh(geometry, material);
        this.player.castShadow = true;
        this.player.receiveShadow = true;
        this.scene.add(this.player);
    }

    setupControls() {
        document.addEventListener('keydown', (e) => {
            if (!this.isPlaying) return;
            
            switch(e.key.toLowerCase()) {
                case ' ':
                    if (this.isGrounded) this.jump();
                    break;
                case 'w':
                    this.moveDirection.z = -1;
                    // Handle double tap sprint
                    const now = Date.now();
                    if (now - this.lastWPress < 300) { // 300ms window for double tap
                        this.moveSpeed = this.sprintSpeed;
                    }
                    this.lastWPress = now;
                    break;
                case 's':
                    this.moveDirection.z = 1;
                    break;
                case 'a':
                    this.moveDirection.x = -1;
                    break;
                case 'd':
                    this.moveDirection.x = 1;
                    break;
                case 'shift':
                    this.isShifting = true;
                    this.moveSpeed = this.baseSpeed * 0.5; // Slow down while shifting
                    break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch(e.key.toLowerCase()) {
                case 'w':
                case 's':
                    this.moveDirection.z = 0;
                    if (this.moveSpeed === this.sprintSpeed) {
                        this.moveSpeed = this.baseSpeed;
                    }
                    break;
                case 'a':
                case 'd':
                    this.moveDirection.x = 0;
                    break;
                case 'shift':
                    this.isShifting = false;
                    this.moveSpeed = this.baseSpeed;
                    break;
            }
        });

        // Camera rotation with arrow keys
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowLeft':
                    this.cameraAngle += this.rotationSpeed;
                    break;
                case 'ArrowRight':
                    this.cameraAngle -= this.rotationSpeed;
                    break;
            }
        });

        // Add mouse controls
        document.addEventListener('mousemove', (e) => {
            if (!this.isPlaying || !this.isMouseLocked) return;
            
            this.cameraRotation.x -= e.movementY * this.mouseSensitivity;
            this.cameraRotation.y -= e.movementX * this.mouseSensitivity;
            
            // Limit vertical rotation
            this.cameraRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.cameraRotation.x));
        });

        // Add pointer lock
        this.renderer.domElement.addEventListener('click', () => {
            if (!this.isMouseLocked) {
                this.renderer.domElement.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isMouseLocked = document.pointerLockElement === this.renderer.domElement;
        });

        // Add zoom control with mouse wheel
        document.addEventListener('wheel', (e) => {
            if (!this.isPlaying) return;
            
            const zoomAmount = e.deltaY * 0.001;
            this.targetCameraDistance = THREE.MathUtils.clamp(
                this.targetCameraDistance + zoomAmount * this.zoomSpeed,
                this.minZoom,
                this.maxZoom
            );
        });

        // Add zoom control with keys
        document.addEventListener('keydown', (e) => {
            if (!this.isPlaying) return;
            
            switch(e.key) {
                case 'q': // Zoom in
                    this.targetCameraDistance = THREE.MathUtils.clamp(
                        this.targetCameraDistance - this.zoomSpeed,
                        this.minZoom,
                        this.maxZoom
                    );
                    break;
                case 'e': // Zoom out
                    this.targetCameraDistance = THREE.MathUtils.clamp(
                        this.targetCameraDistance + this.zoomSpeed,
                        this.minZoom,
                        this.maxZoom
                    );
                    break;
            }
        });
    }

    setupEventListeners() {
        document.getElementById('start-game').addEventListener('click', () => {
            this.startGame();
        });

        document.getElementById('toggle-ai').addEventListener('click', () => {
            this.toggleAI();
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    startGame() {
        this.isPlaying = true;
        this.timer = 0;
        this.deaths = 0;
        this.loadLevel(1);
        document.getElementById('menu').style.display = 'none';
    }

    toggleAI() {
        this.useAI = !this.useAI;
        if (this.useAI) {
            if (!this.aiPlayer) {
                this.aiPlayer = new AIPlayer(this);
            }
            this.aiPlayer.reset();
        } else if (this.aiPlayer) {
            this.scene.remove(this.aiPlayer.model);
            this.aiPlayer = null;
        }
    }

    jump() {
        if (this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
        }
    }

    updatePhysics() {
        // Apply gravity if not grounded
        if (!this.isGrounded) {
            this.velocity.y += this.gravity;
        }
        
        // Platform physics and collision detection
        let onPlatform = false;
        let currentPlatform = null;
        
        for (const obstacle of this.obstacles) {
            if (this.checkCollision(this.player, obstacle)) {
                switch(obstacle.userData.type) {
                    case 'platform':
                        if (this.velocity.y <= 0) {
                            onPlatform = true;
                            currentPlatform = obstacle;
                            if (!this.isShifting) {
                                // Apply platform slipperiness
                                this.velocity.x *= this.platformFriction;
                                this.velocity.z *= this.platformFriction;
                            }
                        }
                        break;
                    case 'glass':
                        if (this.velocity.y < -0.2) {
                            this.scene.remove(obstacle);
                            this.obstacles = this.obstacles.filter(o => o !== obstacle);
                        } else if (!this.isShifting) {
                            onPlatform = true;
                        }
                        break;
                    case 'leaves':
                        // Always fall through leaves when standing still
                        if (this.velocity.length() < 0.1) {
                            setTimeout(() => {
                                onPlatform = false;
                                this.isGrounded = false;
                            }, 500);
                        }
                        break;
                    case 'finish':
                        this.handleLevelComplete();
                        break;
                }
            }
        }

        // Update grounded state
        this.isGrounded = onPlatform || this.player.position.y <= 0;

        // Apply movement
        this.player.position.add(this.velocity);

        // Ground check and void death
        if (this.player.position.y <= 0) {
            this.player.position.y = 0;
            this.velocity.y = 0;
            this.isGrounded = true;
        } else if (this.player.position.y < -10) {
            this.handleDeath();
        }

        // Update camera
        this.updateCamera();
    }

    checkCollisions() {
        // Check obstacle collisions
        for (const obstacle of this.obstacles) {
            if (this.checkCollision(this.player, obstacle)) {
                switch(obstacle.userData.type) {
                    case 'spike':
                        this.handleDeath();
                        break;
                    case 'glass':
                        if (this.velocity.y < -0.2) {
                            this.scene.remove(obstacle);
                            this.obstacles = this.obstacles.filter(o => o !== obstacle);
                        }
                        break;
                    case 'ice':
                        this.moveSpeed = 0.05; // Reduced control on ice
                        break;
                    default:
                        this.moveSpeed = 0.1; // Normal control
                        break;
                }
            }
        }

        // Check void death
        if (this.player.position.y < -10) {
            this.handleDeath();
        }
    }

    checkCollision(obj1, obj2) {
        const box1 = new THREE.Box3().setFromObject(obj1);
        const box2 = new THREE.Box3().setFromObject(obj2);
        return box1.intersectsBox(box2);
    }

    handleDeath() {
        this.deaths++;
        this.player.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        document.getElementById('deaths').textContent = `Deaths: ${this.deaths}`;
    }

    updateTimer() {
        if (this.isPlaying) {
            this.timer += 1/60; // Assuming 60 FPS
            const minutes = Math.floor(this.timer / 60);
            const seconds = Math.floor(this.timer % 60);
            document.getElementById('timer').textContent = 
                `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    loadLevel(levelNumber) {
        // Clear existing level
        while(this.obstacles.length > 0) {
            const obstacle = this.obstacles.pop();
            this.scene.remove(obstacle);
        }

        // Reset player
        this.player.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);

        if (this.useFixedLevels && this.levels.has(levelNumber)) {
            this.createFixedLevel(levelNumber);
        } else {
            this.createProceduralLevel(levelNumber);
        }

        document.getElementById('level').textContent = `Level: ${levelNumber}`;
    }

    createFixedLevel(levelNumber) {
        const levelData = this.levels.get(levelNumber);
        
        // Create base floor
        this.createFloor();

        // Create platforms
        levelData.platforms.forEach(([type, x, y, z, props = {}]) => {
            switch(type) {
                case 'platform':
                    this.addPlatform(new THREE.Vector3(x, y, z));
                    break;
                case 'glass':
                    this.addGlassBlock(new THREE.Vector3(x, y, z));
                    break;
                case 'ice':
                    this.addIceBlock(new THREE.Vector3(x, y, z));
                    break;
                case 'leaves':
                    this.addLeafBlock(new THREE.Vector3(x, y, z));
                    break;
            }
        });

        // Create obstacles
        levelData.obstacles.forEach(([type, x, y, z, props = {}]) => {
            switch(type) {
                case 'spike':
                    this.addSpike(new THREE.Vector3(x, y, z));
                    break;
                case 'cannon':
                    this.addCannon(new THREE.Vector3(x, y, z), props.direction);
                    break;
            }
        });
    }

    createProceduralLevel(levelNumber) {
        // Create base floor
        this.createFloor();

        // Calculate difficulty factors
        const difficulty = Math.min(levelNumber / 10, 1); // 0-1 scale
        const platformCount = Math.floor(5 + (levelNumber * 0.5));
        const obstacleCount = Math.floor(levelNumber * 0.3);

        // Add platforms with increasing complexity
        for (let i = 0; i < platformCount; i++) {
            const position = new THREE.Vector3(
                Math.random() * 20 - 10,
                (i + 1) * 2 * difficulty + Math.random() * 2,
                5 + i * 3 + Math.random() * 5
            );

            // Choose platform type based on level
            if (levelNumber > 30 && Math.random() < 0.3) {
                this.addLeafBlock(position);
            } else if (levelNumber > 20 && Math.random() < 0.3) {
                this.addIceBlock(position);
            } else if (levelNumber > 10 && Math.random() < 0.3) {
                this.addGlassBlock(position);
            } else {
                this.addPlatform(position);
            }
        }

        // Add obstacles
        for (let i = 0; i < obstacleCount; i++) {
            const position = new THREE.Vector3(
                Math.random() * 16 - 8,
                Math.random() * 5 + 1,
                5 + Math.random() * (platformCount * 3)
            );

            if (levelNumber > 25 && Math.random() < 0.3) {
                this.addCannon(position, ['left', 'right', 'up'][Math.floor(Math.random() * 3)]);
            } else {
                this.addSpike(position);
            }
        }
    }

    initializeLevels() {
        // Define some fixed level layouts
        // Format: [type, x, y, z, properties]
        this.levels.set(1, {
            platforms: [
                ['platform', 0, 1, 5],
                ['platform', 3, 2, 8],
                ['platform', -2, 3, 12]
            ],
            obstacles: []
        });

        this.levels.set(2, {
            platforms: [
                ['platform', 0, 1, 5],
                ['platform', 4, 2, 8],
                ['glass', -3, 2, 10]
            ],
            obstacles: [
                ['spike', 2, 1, 7]
            ]
        });

        // Level 10 - First challenging level
        this.levels.set(10, {
            platforms: [
                ['platform', 0, 1, 5],
                ['glass', 3, 2, 8],
                ['ice', -2, 3, 12],
                ['platform', 4, 4, 15]
            ],
            obstacles: [
                ['spike', 2, 1, 7],
                ['cannon', -3, 2, 10, { direction: 'right' }]
            ]
        });

        // Level 25 - Mid-game challenge
        this.levels.set(25, {
            platforms: [
                ['platform', 0, 1, 5],
                ['glass', 4, 3, 8],
                ['ice', -3, 4, 12],
                ['leaves', 2, 5, 15],
                ['platform', 5, 6, 18]
            ],
            obstacles: [
                ['spike', 2, 1, 7],
                ['cannon', -3, 2, 10, { direction: 'right' }],
                ['cannon', 3, 4, 14, { direction: 'left' }]
            ]
        });

        // Level 50 - Final challenge
        this.levels.set(50, {
            platforms: [
                ['platform', 0, 1, 5],
                ['glass', 4, 3, 8],
                ['ice', -3, 5, 12],
                ['leaves', 2, 7, 15],
                ['glass', 5, 8, 18],
                ['platform', 0, 10, 22]
            ],
            obstacles: [
                ['spike', 2, 1, 7],
                ['cannon', -3, 2, 10, { direction: 'right' }],
                ['cannon', 3, 4, 14, { direction: 'left' }],
                ['spike', -2, 6, 16],
                ['cannon', 4, 7, 19, { direction: 'up' }]
            ]
        });
    }

    updateAI() {
        if (!this.aiPlayer) return;
        
        // Simple AI logic - tries to follow the optimal path
        const target = this.findNextPlatform();
        if (target) {
            const direction = target.position.clone().sub(this.aiPlayer.position).normalize();
            this.aiPlayer.position.add(direction.multiplyScalar(0.08));
        }
    }

    findNextPlatform() {
        // Find the nearest platform that's higher than the AI
        return this.obstacles.find(obstacle => 
            obstacle.position.y > this.aiPlayer.position.y &&
            obstacle.position.distanceTo(this.aiPlayer.position) < 5
        );
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.isPlaying) {
            this.updatePhysics();
            this.updateTimer();
            if (this.useAI) {
                this.updateAI();
            }
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    updateCamera() {
        // Calculate camera position based on player position and camera angle
        const cameraOffset = new THREE.Vector3(
            Math.sin(this.cameraAngle) * this.cameraDistance,
            this.cameraHeight,
            Math.cos(this.cameraAngle) * this.cameraDistance
        );
        
        // Set camera position relative to player
        this.camera.position.copy(this.player.position).add(cameraOffset);
        this.camera.lookAt(this.player.position);
    }

    updatePlayerMovement() {
        if (this.moveDirection.length() > 0) {
            // Calculate movement direction relative to camera angle
            const moveVector = new THREE.Vector3();
            
            // Forward/backward movement
            if (this.moveDirection.z !== 0) {
                moveVector.x += Math.sin(this.cameraAngle) * -this.moveDirection.z;
                moveVector.z += Math.cos(this.cameraAngle) * -this.moveDirection.z;
            }
            
            // Left/right movement
            if (this.moveDirection.x !== 0) {
                moveVector.x += Math.cos(this.cameraAngle) * this.moveDirection.x;
                moveVector.z += -Math.sin(this.cameraAngle) * this.moveDirection.x;
            }
            
            moveVector.normalize().multiplyScalar(this.moveSpeed);
            
            this.velocity.x = moveVector.x;
            this.velocity.z = moveVector.z;
        } else {
            this.velocity.x = 0;
            this.velocity.z = 0;
        }
    }

    // Add this method to handle camera shake
    addCameraShake(intensity = 0.5, duration = 0.5) {
        const startTime = performance.now();
        const shakeInterval = requestAnimationFrame(function shake(currentTime) {
            const elapsed = (currentTime - startTime) / 1000; // Convert to seconds
            
            if (elapsed < duration) {
                const remaining = intensity * (1 - (elapsed / duration));
                this.camera.position.x += (Math.random() - 0.5) * remaining;
                this.camera.position.y += (Math.random() - 0.5) * remaining;
                requestAnimationFrame(shake.bind(this));
            }
        }.bind(this));
    }

    createFinishBlock(position) {
        const geometry = new THREE.BoxGeometry(2, 0.5, 2);
        const material = new THREE.MeshPhongMaterial({
            color: 0xffd700,
            emissive: 0xffd700,
            emissiveIntensity: 0.5
        });
        
        this.finishBlock = new THREE.Mesh(geometry, material);
        this.finishBlock.position.copy(position);
        this.finishBlock.userData.type = 'finish';
        
        // Add particle effect
        const particles = new THREE.Points(
            new THREE.BufferGeometry(),
            new THREE.PointsMaterial({
                color: 0xffd700,
                size: 0.1,
                transparent: true,
                opacity: 0.6
            })
        );
        
        // Create floating particles
        const particlePositions = [];
        for (let i = 0; i < 50; i++) {
            particlePositions.push(
                Math.random() * 2 - 1,
                Math.random() * 1,
                Math.random() * 2 - 1
            );
        }
        particles.geometry.setAttribute('position', 
            new THREE.Float32BufferAttribute(particlePositions, 3)
        );
        
        this.finishBlock.add(particles);
        this.scene.add(this.finishBlock);
    }

    handleLevelComplete() {
        if (!this.levelCompleted) {
            this.levelCompleted = true;
            
            // Save best time
            const currentTime = this.timer;
            if (currentTime < this.bestTimes[this.currentLevel - 1]) {
                this.bestTimes[this.currentLevel - 1] = currentTime;
                document.getElementById('best-time').textContent = 
                    `Best Time: ${Math.floor(currentTime / 60)}:${(currentTime % 60).toFixed(2)}`;
            }

            // Show level complete message
            const message = document.createElement('div');
            message.className = 'level-complete';
            message.textContent = `Level ${this.currentLevel} Complete!`;
            document.body.appendChild(message);

            // Progress to next level after delay
            setTimeout(() => {
                document.body.removeChild(message);
                this.currentLevel++;
                if (this.currentLevel <= this.maxLevels) {
                    this.loadLevel(this.currentLevel);
                } else {
                    this.showGameComplete();
                }
                this.levelCompleted = false;
            }, 2000);
        }
    }

    createLevel(levelNumber) {
        // ... existing level creation code ...

        // Add finish block at the end of the level
        const finishPosition = new THREE.Vector3(
            0,
            Math.random() * 2 + 1,
            20 + (levelNumber * 2) // Increases distance with level
        );
        this.createFinishBlock(finishPosition);
    }
}

// AI Implementation
class AIPlayer {
    constructor(game) {
        this.game = game;
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.target = null;
        this.moveSpeed = 0.12; // Slightly slower than player
        this.jumpForce = 0.3;
        this.isGrounded = false;
        
        this.createAIModel();
    }

    createAIModel() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        this.model = new THREE.Mesh(geometry, material);
        this.model.castShadow = true;
        this.game.scene.add(this.model);
    }

    update() {
        // Find next platform or target
        if (!this.target || this.reachedTarget()) {
            this.findNewTarget();
        }

        if (this.target) {
            // Calculate direction to target
            const direction = this.target.clone().sub(this.position).normalize();
            
            // Move towards target
            this.velocity.x = direction.x * this.moveSpeed;
            this.velocity.z = direction.z * this.moveSpeed;

            // Jump if needed
            if (this.isGrounded && this.target.y > this.position.y + 0.5) {
                this.velocity.y = this.jumpForce;
                this.isGrounded = false;
            }

            // Apply gravity
            if (!this.isGrounded) {
                this.velocity.y += this.game.gravity;
            }

            // Update position
            this.position.add(this.velocity);
            this.model.position.copy(this.position);

            // Ground check
            if (this.position.y <= 0) {
                this.position.y = 0;
                this.velocity.y = 0;
                this.isGrounded = true;
            }
        }
    }

    findNewTarget() {
        // Find nearest platform that's higher or further in the level
        let nearestPlatform = null;
        let minDistance = Infinity;

        for (const obstacle of this.game.obstacles) {
            if (obstacle.userData.type === 'platform' || obstacle.userData.type === 'glass') {
                const distance = this.position.distanceTo(obstacle.position);
                if (distance < minDistance && 
                    (obstacle.position.z > this.position.z || 
                     obstacle.position.y > this.position.y)) {
                    nearestPlatform = obstacle;
                    minDistance = distance;
                }
            }
        }

        if (nearestPlatform) {
            this.target = nearestPlatform.position.clone();
        }
    }

    reachedTarget() {
        return this.target && this.position.distanceTo(this.target) < 1;
    }

    reset() {
        this.position.set(2, 0, 0); // Start slightly to the right of player
        this.velocity.set(0, 0, 0);
        this.target = null;
        this.model.position.copy(this.position);
    }
}

// Initialize game
const game = new ParkourGame(); 
