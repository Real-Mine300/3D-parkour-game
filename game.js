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
        
        // Update movement settings
        this.moveDirection = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.baseSpeed = 0.3; // Increased speed
        this.moveSpeed = this.baseSpeed;
        this.sprintSpeed = this.baseSpeed * 1.8;
        this.gravity = -0.015;
        this.jumpForce = 0.3;
        this.isGrounded = false;
        this.isShifting = false;
        this.lastWPress = 0;
        this.platformFriction = 0.98;
        
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
        const updateKeyPress = (key, isPressed) => {
            const keyElements = document.querySelectorAll(`.key[data-key="${key}"]`);
            keyElements.forEach(element => {
                if (isPressed) {
                    element.classList.add('pressed');
                } else {
                    element.classList.remove('pressed');
                }
            });
        };

        document.addEventListener('keydown', (e) => {
            if (!this.isPlaying) return;
            
            switch(e.key.toLowerCase()) {
                case 'w':
                    this.moveDirection.z = 1;
                    updateKeyPress('w', true);
                    const now = Date.now();
                    if (now - this.lastWPress < 300) {
                        this.moveSpeed = this.sprintSpeed;
                    }
                    this.lastWPress = now;
                    break;
                case 's':
                    this.moveDirection.z = -1;
                    updateKeyPress('s', true);
                    break;
                case 'a':
                    this.moveDirection.x = -1;
                    updateKeyPress('a', true);
                    break;
                case 'd':
                    this.moveDirection.x = 1;
                    updateKeyPress('d', true);
                    break;
                case ' ':
                    if (this.isGrounded) {
                        this.jump();
                        updateKeyPress('space', true);
                    }
                    break;
                case 'shift':
                    this.isShifting = true;
                    updateKeyPress('shift', true);
                    break;
                case 'arrowleft':
                    this.cameraAngle += this.rotationSpeed;
                    updateKeyPress('left', true);
                    break;
                case 'arrowright':
                    this.cameraAngle -= this.rotationSpeed;
                    updateKeyPress('right', true);
                    break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch(e.key.toLowerCase()) {
                case 'w':
                    this.moveDirection.z = 0;
                    updateKeyPress('w', false);
                    if (this.moveSpeed === this.sprintSpeed) {
                        this.moveSpeed = this.baseSpeed;
                    }
                    break;
                case 's':
                    this.moveDirection.z = 0;
                    updateKeyPress('s', false);
                    break;
                case 'a':
                    this.moveDirection.x = 0;
                    updateKeyPress('a', false);
                    break;
                case 'd':
                    this.moveDirection.x = 0;
                    updateKeyPress('d', false);
                    break;
                case ' ':
                    updateKeyPress('space', false);
                    break;
                case 'shift':
                    this.isShifting = false;
                    updateKeyPress('shift', false);
                    break;
                case 'arrowleft':
                    updateKeyPress('left', false);
                    break;
                case 'arrowright':
                    updateKeyPress('right', false);
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
        this.currentLevel = 1;
        this.loadLevel(1);
        
        // Hide menu
        document.getElementById('menu').style.display = 'none';
        
        // Reset player position
        this.player.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        
        // Create AI if enabled
        if (this.useAI && !this.aiPlayer) {
            this.aiPlayer = new AIPlayer(this);
        }
        
        // Update HUD
        document.getElementById('deaths').textContent = `Deaths: ${this.deaths}`;
        document.getElementById('level').textContent = `Level: ${this.currentLevel}`;
        document.getElementById('timer').textContent = 'Time: 0:00';
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
        // Apply gravity
        this.velocity.y += this.gravity;
        
        // Handle movement
        const moveSpeed = this.isShifting ? this.baseSpeed * 0.5 : this.moveSpeed;
        
        // Reset horizontal velocity
        this.velocity.x = 0;
        this.velocity.z = 0;
        
        // Calculate movement based on camera angle
        if (this.moveDirection.x !== 0 || this.moveDirection.z !== 0) {
            // Forward/Backward
            if (this.moveDirection.z !== 0) {
                this.velocity.x -= Math.sin(this.cameraAngle) * this.moveDirection.z * moveSpeed;
                this.velocity.z -= Math.cos(this.cameraAngle) * this.moveDirection.z * moveSpeed;
            }
            
            // Left/Right
            if (this.moveDirection.x !== 0) {
                this.velocity.x += Math.cos(this.cameraAngle) * this.moveDirection.x * moveSpeed;
                this.velocity.z -= Math.sin(this.cameraAngle) * this.moveDirection.x * moveSpeed;
            }
        }
        
        // Update position
        this.player.position.add(this.velocity);
        
        // Check collisions
        this.checkCollisions();
        
        // Update camera
        this.updateCamera();
        
        // Update AI if active
        if (this.useAI && this.aiPlayer) {
            this.aiPlayer.update();
        }
    }

    checkCollisions() {
        this.isGrounded = false;

        // Create player hitbox
        const playerBox = new THREE.Box3().setFromObject(this.player);
        const playerBottom = this.player.position.y - 0.5; // Bottom of player

        // Check each obstacle
        for (const obstacle of this.obstacles) {
            const obstacleBox = new THREE.Box3().setFromObject(obstacle);
            
            // Check if player is colliding with obstacle
            if (playerBox.intersectsBox(obstacleBox)) {
                switch(obstacle.userData.type) {
                    case 'platform':
                        // Check if player is above platform
                        if (this.velocity.y <= 0 && playerBottom >= obstacle.position.y) {
                            this.player.position.y = obstacle.position.y + 1;
                            this.velocity.y = 0;
                            this.isGrounded = true;
                        }
                        // Side collisions
                        else {
                            const overlap = playerBox.intersect(obstacleBox);
                            const overlapSize = new THREE.Vector3(
                                overlap.max.x - overlap.min.x,
                                overlap.max.y - overlap.min.y,
                                overlap.max.z - overlap.min.z
                            );

                            // Push player out of the smallest overlap direction
                            if (overlapSize.x < overlapSize.y && overlapSize.x < overlapSize.z) {
                                const pushDirection = this.player.position.x > obstacle.position.x ? 1 : -1;
                                this.player.position.x += overlapSize.x * pushDirection;
                            } else if (overlapSize.z < overlapSize.y) {
                                const pushDirection = this.player.position.z > obstacle.position.z ? 1 : -1;
                                this.player.position.z += overlapSize.z * pushDirection;
                            }
                        }
                        break;

                    case 'glass':
                        if (this.velocity.y < -0.2) {
                            // Break glass if falling fast enough
                            this.scene.remove(obstacle);
                            this.obstacles = this.obstacles.filter(o => o !== obstacle);
                        } else if (!this.isShifting) {
                            // Same collision as platform if not breaking
                            if (this.velocity.y <= 0 && playerBottom >= obstacle.position.y) {
                                this.player.position.y = obstacle.position.y + 1;
                                this.velocity.y = 0;
                                this.isGrounded = true;
                            }
                        }
                        break;

                    case 'finish':
                        this.handleLevelComplete();
                        break;
                }
            }
        }

        // Floor collision
        if (this.player.position.y <= 0) {
            this.player.position.y = 0;
            this.velocity.y = 0;
            this.isGrounded = true;
        }

        // Void death
        if (this.player.position.y < -10) {
            this.handleDeath();
        }
    }

    handleDeath() {
        this.deaths++;
        document.getElementById('deaths').textContent = `Deaths: ${this.deaths}`;
        this.player.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
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

        // Create new level
        this.createLevel(levelNumber);
        
        // Update level display
        document.getElementById('level').textContent = `Level: ${levelNumber}`;
    }

    createLevel(levelNumber) {
        // Clear existing level
        while(this.obstacles.length > 0) {
            const obstacle = this.obstacles.pop();
            this.scene.remove(obstacle);
        }

        // Create floor
        const floor = new THREE.Mesh(
            new THREE.BoxGeometry(100, 1, 100),
            new THREE.MeshPhongMaterial({ color: 0x808080 })
        );
        floor.position.y = -0.5;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Calculate difficulty factors
        const difficulty = Math.min(levelNumber / 20, 1); // Scaled to reach max at level 20
        const platformCount = Math.floor(5 + (levelNumber * 0.5));

        // Add platforms with increasing complexity
        for (let i = 0; i < platformCount; i++) {
            let platformType = 'normal';
            
            // Determine platform type based on level
            if (levelNumber >= 5) {
                const rand = Math.random();
                if (levelNumber >= 15 && rand < 0.2) {
                    platformType = 'leaves';
                } else if (levelNumber >= 10 && rand < 0.3) {
                    platformType = 'ice';
                } else if (levelNumber >= 5 && rand < 0.4) {
                    platformType = 'glass';
                }
            }

            const platform = this.createPlatform(
                new THREE.Vector3(
                    Math.random() * 16 - 8,
                    i * 2 + 1,
                    5 + i * 3 + Math.random() * 2
                ),
                platformType
            );
            
            this.obstacles.push(platform);
        }

        // Add finish block
        const finishPosition = new THREE.Vector3(
            0,
            platformCount * 2,
            15 + platformCount * 3
        );
        this.createFinishBlock(finishPosition);
    }

    createPlatform(position, type = 'normal') {
        let material;
        switch(type) {
            case 'glass':
                material = new THREE.MeshPhongMaterial({
                    color: 0x88ccff,
                    transparent: true,
                    opacity: 0.3
                });
                break;
            case 'ice':
                material = new THREE.MeshPhongMaterial({
                    color: 0xaaddff,
                    shininess: 100
                });
                break;
            case 'leaves':
                material = new THREE.MeshPhongMaterial({
                    color: 0x33aa33
                });
                break;
            default:
                material = new THREE.MeshPhongMaterial({
                    color: 0x8b4513
                });
        }

        const platform = new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.5, 2),
            material
        );
        
        platform.position.copy(position);
        platform.castShadow = true;
        platform.receiveShadow = true;
        platform.userData.type = type;
        
        this.scene.add(platform);
        return platform;
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
        this.obstacles.push(this.finishBlock);
        this.scene.add(this.finishBlock);
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
        
        // Rotate player model to face movement direction
        if (this.moveDirection.length() > 0) {
            const angle = Math.atan2(this.velocity.x, this.velocity.z);
            this.player.rotation.y = angle;
        }
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

    handleLevelComplete() {
        if (!this.levelCompleted) {
            this.levelCompleted = true;
            this.currentLevel++;
            
            // Show level complete message
            const message = document.createElement('div');
            message.className = 'level-complete';
            message.textContent = `Level ${this.currentLevel - 1} Complete!`;
            document.body.appendChild(message);

            setTimeout(() => {
                document.body.removeChild(message);
                this.loadLevel(this.currentLevel);
                this.levelCompleted = false;
            }, 1500);
        }
    }
}

// AI Implementation
class AIPlayer {
    constructor(game) {
        this.game = game;
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.moveSpeed = 0.15;
        this.jumpForce = 0.35;
        this.isGrounded = false;
        this.target = null;
        this.pathPoints = [];
        this.currentPathIndex = 0;
        
        this.createAIModel();
    }

    createAIModel() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xff0000,
            emissive: 0x330000
        });
        this.model = new THREE.Mesh(geometry, material);
        this.model.castShadow = true;
        this.game.scene.add(this.model);
    }

    update() {
        // Apply gravity
        this.velocity.y += this.game.gravity;

        if (!this.target || this.reachedTarget()) {
            this.findNewTarget();
        }

        if (this.target) {
            // Calculate direction to target
            const direction = new THREE.Vector3();
            direction.subVectors(this.target, this.position).normalize();

            // Horizontal movement
            this.velocity.x = direction.x * this.moveSpeed;
            this.velocity.z = direction.z * this.moveSpeed;

            // Jump if needed
            if (this.isGrounded && this.target.y > this.position.y + 0.5) {
                this.velocity.y = this.jumpForce;
                this.isGrounded = false;
            }
        }

        // Update position
        this.position.add(this.velocity);
        this.model.position.copy(this.position);

        // Check collisions
        this.checkCollisions();
    }

    checkCollisions() {
        this.isGrounded = false;
        const aiBox = new THREE.Box3().setFromObject(this.model);

        for (const obstacle of this.game.obstacles) {
            const obstacleBox = new THREE.Box3().setFromObject(obstacle);
            
            if (aiBox.intersectsBox(obstacleBox)) {
                if (this.velocity.y <= 0 && this.position.y > obstacle.position.y) {
                    this.position.y = obstacle.position.y + 1;
                    this.velocity.y = 0;
                    this.isGrounded = true;
                }
            }
        }

        // Floor collision
        if (this.position.y <= 0) {
            this.position.y = 0;
            this.velocity.y = 0;
            this.isGrounded = true;
        }

        // Void death
        if (this.position.y < -10) {
            this.reset();
        }
    }

    findNewTarget() {
        let bestTarget = null;
        let bestScore = -Infinity;

        for (const obstacle of this.game.obstacles) {
            if (obstacle.userData.type === 'finish') {
                bestTarget = obstacle.position.clone();
                break;
            }

            const score = this.evaluateTarget(obstacle.position);
            if (score > bestScore) {
                bestScore = score;
                bestTarget = obstacle.position.clone();
            }
        }

        if (bestTarget) {
            this.target = bestTarget.add(new THREE.Vector3(0, 1, 0));
        }
    }

    evaluateTarget(position) {
        // Score based on progress towards finish
        let score = position.z * 2;
        
        // Bonus for height gain (but not too much)
        score += Math.min(position.y - this.position.y, 5) * 1.5;
        
        // Penalty for distance from current position
        score -= this.position.distanceTo(position) * 0.5;
        
        return score;
    }

    reachedTarget() {
        return this.target && this.position.distanceTo(this.target) < 1;
    }

    reset() {
        this.position.set(2, 0, 0);
        this.velocity.set(0, 0, 0);
        this.target = null;
        this.model.position.copy(this.position);
    }
}

// Initialize game
const game = new ParkourGame(); 