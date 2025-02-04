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
        
        // AI timing properties
        this.aiTimer = 0;
        this.aiFinishTime = null;
        this.displayComparison = false;
        
        // Add combo system
        this.combo = 0;
        this.maxCombo = 0;
        this.lastPlatformTime = 0;
        
        // Keep dynamic lighting
        this.platformAnimations = [];
        
        this.init();
    }

    init() {
        try {
            // Setup renderer
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.shadowMap.enabled = true;
            const container = document.getElementById('game-container');
            if (!container) throw new Error('Game container not found');
            container.appendChild(this.renderer.domElement);

            // Setup basic lighting first
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            this.scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(10, 20, 10);
            directionalLight.castShadow = true;
            this.scene.add(directionalLight);

            // Create player first
            this.createPlayer();
            
            // Setup camera
            this.camera.position.set(0, 5, 10);
            this.camera.lookAt(this.player.position);

            // Now add dynamic lighting that follows the player
            this.addDynamicLighting();

            // Initialize controls and events
            this.setupControls();
            this.setupEventListeners();
            
            // Load first level
            this.loadLevel(1);
            
            // Start animation loop
            this.animate();
            
            console.log('Game initialized successfully');
        } catch (error) {
            console.error('Error initializing game:', error);
            throw error;
        }
    }

    createPlayer() {
        try {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
            this.player = new THREE.Mesh(geometry, material);
            this.player.castShadow = true;
            this.player.receiveShadow = true;
            this.scene.add(this.player);
            
            // Set initial position
            this.player.position.set(0, 0, 0);
        } catch (error) {
            console.error('Error creating player:', error);
            throw error;
        }
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
        // Only keep the window resize and sensitivity events
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Add sensitivity slider listener
        const sensitivitySlider = document.getElementById('mouse-sensitivity');
        const sensitivityValue = document.getElementById('sensitivity-value');
        
        if (sensitivitySlider && sensitivityValue) {
            sensitivitySlider.addEventListener('input', (e) => {
                const value = e.target.value;
                sensitivityValue.textContent = value;
                this.updateMouseSensitivity(value);
            });
        }

        // Bind the event handlers to this instance
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseWheel = this.handleMouseWheel.bind(this);

        // Add keyboard controls
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        
        // Add mouse controls
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('wheel', this.handleMouseWheel);
    }

    startGame() {
        this.isPlaying = true;
        this.timer = 0;
        this.deaths = 0;
        this.currentLevel = 1;
        this.loadLevel(1);
        
        // Reset player position and velocity
        this.player.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        
        // Hide menu and show game UI
        document.getElementById('menu').style.display = 'none';
        document.getElementById('hud').style.display = 'block';
        
        // Lock pointer for camera control
        this.renderer.domElement.requestPointerLock();
    }

    toggleAI() {
        this.useAI = !this.useAI;
        const difficultySelect = document.getElementById('ai-difficulty');
        const difficulty = difficultySelect ? difficultySelect.value : 'medium';
        const aiSection = document.querySelector('.ai-section');

        if (this.useAI) {
            if (!this.aiPlayer) {
                this.aiPlayer = new AIPlayer(this, difficulty);
            }
            this.aiPlayer.reset();
            aiSection.classList.add('active');
        } else {
            if (this.aiPlayer) {
                this.scene.remove(this.aiPlayer.model);
                this.aiPlayer = null;
            }
            aiSection.classList.remove('active');
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
        const playerBox = new THREE.Box3().setFromObject(this.player);
        const playerBottom = this.player.position.y - 0.5;
    
        for (const obstacle of this.obstacles) {
            const obstacleBox = new THREE.Box3().setFromObject(obstacle);
            
            if (playerBox.intersectsBox(obstacleBox)) {
                // Calculate overlap correctly
                const overlap = new THREE.Vector3(
                    Math.abs(playerBox.max.x - obstacleBox.min.x - (obstacleBox.max.x - playerBox.min.x)),
                    Math.abs(playerBox.max.y - obstacleBox.min.y - (obstacleBox.max.y - playerBox.min.y)),
                    Math.abs(playerBox.max.z - obstacleBox.min.z - (obstacleBox.max.z - playerBox.min.z))
                );
    
                // Determine the axis with the smallest overlap (main collision axis)
                const minOverlap = Math.min(overlap.x, overlap.y, overlap.z);
    
                if (this.velocity.y <= 0 && playerBottom >= obstacle.position.y + 0.25 && minOverlap === overlap.y) {
                    // Top collision (landing on a platform)
                    this.player.position.y = obstacle.position.y + 0.75;
                    this.velocity.y = 0;
                    this.isGrounded = true;
    
                    // Handle finish block first
                    if (obstacle.userData.type === 'finish') {
                        this.handleLevelComplete();
                        return;
                    }
    
                    // Handle special platform effects
                    switch (obstacle.userData.type) {
                        case 'glass':
                            if (Math.abs(this.velocity.y) > 0.2) {
                                this.scene.remove(obstacle);
                                this.obstacles = this.obstacles.filter(o => o !== obstacle);
                                return;
                            }
                            break;
                        case 'ice':
                            this.velocity.multiplyScalar(1.1);
                            this.moveSpeed *= 1.2;
                            break;
                        case 'bounce':
                            this.velocity.y = this.jumpForce * 1.5;
                            this.isGrounded = false;
                            break;
                        case 'speed':
                            this.moveSpeed = this.baseSpeed * 2;
                            break;
                    }
                } else {
                    // Side collision - resolve using the smallest overlap
                    if (minOverlap === overlap.x) {
                        const pushDirection = this.player.position.x > obstacle.position.x ? 1 : -1;
                        this.player.position.x += minOverlap * pushDirection;
                        this.velocity.x = 0;
                    } else if (minOverlap === overlap.z) {
                        const pushDirection = this.player.position.z > obstacle.position.z ? 1 : -1;
                        this.player.position.z += minOverlap * pushDirection;
                        this.velocity.z = 0;
                    }
                }
            }
        }
    
        // Reset movement speed if not on special platforms
        if (this.isGrounded && this.moveSpeed !== this.baseSpeed) {
            this.moveSpeed = this.baseSpeed;
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
            document.getElementById('timer').textContent = this.formatTime(this.timer);
            
            if (this.useAI && this.aiPlayer) {
                const aiTimeElement = document.getElementById('ai-timer');
                if (this.aiFinishTime) {
                    aiTimeElement.textContent = `AI: ${this.formatTime(this.aiFinishTime)}`;
                } else {
                    aiTimeElement.textContent = 'AI: Running...';
                }
            }
        }
    }

    formatTime(time) {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const milliseconds = Math.floor((time % 1) * 100);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }

    loadLevel(levelNumber) {
        // Clear existing level
        this.clearLevel();
        
        // Create new level
        this.createLevel(levelNumber);
        
        // Update HUD safely
        const levelElement = document.getElementById('level');
        const deathsElement = document.getElementById('deaths');
        
        if (levelElement) levelElement.textContent = `Level: ${this.currentLevel}`;
        if (deathsElement) deathsElement.textContent = `Deaths: ${this.deaths}`;
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
        const difficulty = Math.min(levelNumber / 20, 1);
        const platformCount = Math.floor(5 + (levelNumber * 0.5));

        // Initialize bullet system for levels 30+
        if (levelNumber >= 30) {
            this.initializeBulletSystem();
        }

        // Add platforms with faster progressive introduction
        for (let i = 0; i < platformCount; i++) {
            let platformType = 'normal';
            const rand = Math.random();
            
            // Progressive platform type introduction (all by level 20)
            if (levelNumber >= 3 && rand < 0.3) platformType = 'glass';
            if (levelNumber >= 6 && rand < 0.25) platformType = 'ice';
            if (levelNumber >= 9 && rand < 0.2) platformType = 'leaves';
            if (levelNumber >= 12 && rand < 0.2) platformType = 'bounce';
            if (levelNumber >= 15 && rand < 0.15) platformType = 'speed';
            if (levelNumber >= 17 && rand < 0.15) platformType = 'sticky';
            if (levelNumber >= 20 && rand < 0.15) platformType = 'phase';

            const platform = this.createPlatform(
                new THREE.Vector3(
                    Math.random() * 16 - 8,
                    i * 2 + 1,
                    5 + i * 3 + Math.random() * 2
                ),
                platformType
            );
            
            this.obstacles.push(platform);

            // Initialize phasing for phase platforms
            if (platformType === 'phase') {
                this.initializePhasePlatform(platform);
            }
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
        let properties = {};
        
        switch(type) {
            case 'glass':
                material = new THREE.MeshPhongMaterial({
                    color: 0x88ccff,
                    transparent: true,
                    opacity: 0.3,
                    shininess: 90
                });
                properties.breakable = true;
                properties.breakForce = 0.2;
                break;
                
            case 'ice':
                material = new THREE.MeshPhongMaterial({
                    color: 0xaaddff,
                    shininess: 100,
                    specular: 0xffffff
                });
                properties.friction = 0.05;
                properties.acceleration = 1.5;
                break;
                
            case 'leaves':
                material = new THREE.MeshPhongMaterial({
                    color: 0x33aa33,
                    emissive: 0x003300,
                    roughness: 0.8
                });
                properties.crumbling = true;
                properties.supportTime = 1000;
                properties.regenerateTime = 3000;
                break;
                
            case 'bounce':
                material = new THREE.MeshPhongMaterial({
                    color: 0xff3333,
                    emissive: 0x330000,
                    emissiveIntensity: 0.5
                });
                properties.bounceForce = 0.5;
                break;

            case 'speed':
                material = new THREE.MeshPhongMaterial({
                    color: 0xffcc00,
                    emissive: 0x666600,
                    emissiveIntensity: 0.3
                });
                properties.speedBoost = 2.0;
                break;

            case 'sticky':
                material = new THREE.MeshPhongMaterial({
                    color: 0x8b4513,
                    shininess: 10
                });
                properties.friction = 2.0;
                properties.climbable = true;
                break;

            case 'phase':
                material = new THREE.MeshPhongMaterial({
                    color: 0x9370DB,
                    transparent: true,
                    opacity: 0.5,
                    emissive: 0x4B0082,
                    emissiveIntensity: 0.2
                });
                properties.phaseTime = 2000;
                properties.isVisible = true;
                break;
                
            default: // Normal platform
                material = new THREE.MeshPhongMaterial({
                    color: 0x808080,
                    roughness: 0.7
                });
                properties.friction = 0.8;
                break;
        }

        const platform = new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.5, 2),
            material
        );
        
        platform.position.copy(position);
        platform.castShadow = true;
        platform.receiveShadow = true;
        platform.userData.type = type;
        platform.userData.properties = properties;
        
        this.scene.add(platform);

        // Add platform animations
        const animate = (platform) => {
            switch(type) {
                case 'bounce':
                    platform.scale.y = 1 + Math.sin(Date.now() * 0.003) * 0.1;
                    break;
                case 'speed':
                    platform.rotation.y += 0.01;
                    break;
                case 'phase':
                    platform.material.opacity = 
                        platform.userData.properties.isVisible ? 
                        0.5 + Math.sin(Date.now() * 0.005) * 0.2 : 0.1;
                    break;
            }
        };
        
        // Add to animation loop
        this.platformAnimations.push(animate);

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
            this.updateBullets();
            
            // Update platform animations
            for (const animate of this.platformAnimations) {
                animate();
            }
            
            if (this.useAI) {
                this.updateAI();
            }
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    updateCamera() {
        console.log(`${this.player.postion.y},  ${this.player.postion.x}, ${this.player.postion.z}`)
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

    updateHUD() {
        document.getElementById('timer').textContent = `Time: ${this.formatTime(this.timer)}`;
        document.getElementById('deaths').textContent = `Deaths: ${this.deaths}`;
        document.getElementById('level').textContent = `Level: ${this.currentLevel}`;
        
        if (this.useAI && this.aiPlayer) {
            const aiTimeElement = document.getElementById('ai-timer');
            if (this.aiFinishTime) {
                aiTimeElement.textContent = `AI Time: ${this.formatTime(this.aiFinishTime)}`;
            } else {
                aiTimeElement.textContent = `AI Time: Running...`;
            }
        }
    }

    handleAIFinish() {
        if (this.aiPlayer && !this.aiFinishTime) {
            this.aiFinishTime = this.timer;
            
            // Update best time for this AI difficulty if better
            const difficultyBestTimes = this.bestTimes[this.aiPlayer.difficulty] || [];
            if (!difficultyBestTimes[this.currentLevel - 1] || 
                this.aiFinishTime < difficultyBestTimes[this.currentLevel - 1]) {
                difficultyBestTimes[this.currentLevel - 1] = this.aiFinishTime;
                this.bestTimes[this.aiPlayer.difficulty] = difficultyBestTimes;
            }

            // Show completion message with time
            this.showAICompletionMessage();
        }
    }

    showAICompletionMessage() {
        const minutes = Math.floor(this.aiFinishTime / 60);
        const seconds = (this.aiFinishTime % 60).toFixed(2);
        const timeStr = `${minutes}:${seconds.padStart(5, '0')}`;
        
        const message = document.createElement('div');
        message.className = 'ai-completion-message';
        message.innerHTML = `
            <h3>${this.aiPlayer.difficulty.toUpperCase()} AI Finished!</h3>
            <p>Time: ${timeStr}</p>
        `;
        document.body.appendChild(message);
        
        setTimeout(() => {
            document.body.removeChild(message);
        }, 3000);
    }

    // Add method to change AI difficulty
    changeAIDifficulty(difficulty) {
        if (this.aiPlayer) {
            const position = this.aiPlayer.position.clone();
            const velocity = this.aiPlayer.velocity.clone();
            this.scene.remove(this.aiPlayer.model);
            this.aiPlayer = new AIPlayer(this, difficulty);
            this.aiPlayer.position.copy(position);
            this.aiPlayer.velocity.copy(velocity);
        }
    }

    handleNormalPlatformCollision(platform) {
        // Check if player is above platform
        if (this.velocity.y <= 0 && this.player.position.y > platform.position.y) {
            this.player.position.y = platform.position.y + 1;
            this.velocity.y = 0;
            this.isGrounded = true;
        }
        // Side collisions
        else {
            const overlap = new THREE.Box3().setFromObject(this.player).intersect(new THREE.Box3().setFromObject(platform));
            const overlapSize = new THREE.Vector3(
                overlap.max.x - overlap.min.x,
                overlap.max.y - overlap.min.y,
                overlap.max.z - overlap.min.z
            );

            // Push player out of the smallest overlap direction
            if (overlapSize.x < overlapSize.y && overlapSize.x < overlapSize.z) {
                const pushDirection = this.player.position.x > platform.position.x ? 1 : -1;
                this.player.position.x += overlapSize.x * pushDirection;
            } else if (overlapSize.z < overlapSize.y) {
                const pushDirection = this.player.position.z > platform.position.z ? 1 : -1;
                this.player.position.z += overlapSize.z * pushDirection;
            }
        }
    }

    handleGlassPlatformCollision(platform) {
        if (this.velocity.y < -0.2) {
            // Break glass if falling fast enough
            this.scene.remove(platform);
            this.obstacles = this.obstacles.filter(o => o !== platform);
        } else if (!this.isShifting) {
            // Same collision as platform if not breaking
            if (this.velocity.y <= 0 && this.player.position.y > platform.position.y) {
                this.player.position.y = platform.position.y + 1;
                this.velocity.y = 0;
                this.isGrounded = true;
            }
        }
    }

    handleIcePlatformCollision(platform) {
        // Apply ice physics - more slippery movement
        if (this.isGrounded) {
            this.velocity.x *= platform.userData.properties.acceleration;
            this.velocity.z *= platform.userData.properties.acceleration;
            this.moveSpeed *= platform.userData.properties.acceleration;
        }
    }

    handleLeavesPlatformCollision(platform) {
        if (!platform.userData.crumbling) {
            platform.userData.crumbling = true;
            
            // Start crumbling animation
            setTimeout(() => {
                platform.position.y -= 10; // Make platform fall
                
                // Regenerate platform after delay
                setTimeout(() => {
                    platform.position.y += 10;
                    platform.userData.crumbling = false;
                }, platform.userData.properties.regenerateTime);
                
            }, platform.userData.properties.supportTime);
        }
    }

    handleBouncePlatformCollision(platform) {
        if (this.velocity.y <= 0) {
            this.velocity.y = this.jumpForce + platform.userData.properties.bounceForce;
            this.isGrounded = false;
            
            // Add bounce effect
            this.addCameraShake(0.3, 0.2);
        }
    }

    // Add new methods for bullet system
    initializeBulletSystem() {
        this.bullets = [];
        this.bulletSpawners = [];
        
        // Add bullet spawners based on level
        const spawnerCount = Math.min(Math.floor((this.currentLevel - 30) / 5) + 1, 4);
        
        for (let i = 0; i < spawnerCount; i++) {
            const spawner = {
                position: new THREE.Vector3(
                    Math.random() * 16 - 8,
                    5 + Math.random() * 10,
                    10 + Math.random() * 20
                ),
                direction: new THREE.Vector3(
                    Math.random() - 0.5,
                    0,
                    Math.random() - 0.5
                ).normalize(),
                fireRate: 2000 - (this.currentLevel - 30) * 50, // Faster bullets in higher levels
                lastFired: 0
            };
            this.bulletSpawners.push(spawner);
        }
    }

    createBullet(position, direction) {
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshPhongMaterial({
            color: 0xff0000,
            emissive: 0x330000
        });
        const bullet = new THREE.Mesh(geometry, material);
        bullet.position.copy(position);
        bullet.velocity = direction.multiplyScalar(0.2);
        this.scene.add(bullet);
        this.bullets.push(bullet);
    }

    updateBullets() {
        if (this.currentLevel < 30) return;

        // Update existing bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.position.add(bullet.velocity);

            // Check for bullet collision with player
            if (bullet.position.distanceTo(this.player.position) < 0.6) {
                this.handleDeath();
                this.scene.remove(bullet);
                this.bullets.splice(i, 1);
                continue;
            }

            // Remove bullets that are too far
            if (bullet.position.length() > 50) {
                this.scene.remove(bullet);
                this.bullets.splice(i, 1);
            }
        }

        // Spawn new bullets
        const now = Date.now();
        this.bulletSpawners.forEach(spawner => {
            if (now - spawner.lastFired >= spawner.fireRate) {
                this.createBullet(spawner.position.clone(), spawner.direction.clone());
                spawner.lastFired = now;
            }
        });
    }

    initializePhasePlatform(platform) {
        const toggleVisibility = () => {
            platform.userData.properties.isVisible = !platform.userData.properties.isVisible;
            platform.material.opacity = platform.userData.properties.isVisible ? 0.5 : 0.1;
            platform.userData.properties.solid = platform.userData.properties.isVisible;
        };

        setInterval(toggleVisibility, platform.userData.properties.phaseTime);
    }

    // Add new platform collision handlers
    handleSpeedPlatformCollision(platform) {
        if (this.isGrounded) {
            this.moveSpeed = this.baseSpeed * platform.userData.properties.speedBoost;
            setTimeout(() => {
                this.moveSpeed = this.baseSpeed;
            }, 500);
        }
    }

    handleStickyPlatformCollision(platform) {
        this.isGrounded = true;
        this.velocity.y = 0;
        if (platform.userData.properties.climbable) {
            this.velocity.multiplyScalar(0.5);
        }
    }

    handlePhasePlatformCollision(platform) {
        if (platform.userData.properties.isVisible) {
            this.handleNormalPlatformCollision(platform);
        }
    }

    // Add particle effects for platform interactions
    createParticleEffect(position, color, count = 10) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 4, 4),
                new THREE.MeshBasicMaterial({ color: color })
            );
            particle.position.copy(position);
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                Math.random() * 0.2,
                (Math.random() - 0.5) * 0.2
            );
            particles.push(particle);
            this.scene.add(particle);
        }
        return particles;
    }

    addDynamicLighting() {
        if (!this.player) {
            console.error('Player not initialized for dynamic lighting');
            return;
        }
        // Add point lights that follow the player
        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        this.player.add(pointLight);
        
        // Add ambient color shifts based on level
        const hue = (this.currentLevel % 10) / 10;
        const ambientLight = new THREE.AmbientLight();
        ambientLight.color.setHSL(hue, 0.5, 0.5);
        this.scene.add(ambientLight);
    }

    // Add method to update mouse sensitivity
    updateMouseSensitivity(value) {
        this.mouseSensitivity = value / 5000; // Convert slider value to usable sensitivity
    }

    handleMouseMove(e) {
        if (!this.isPlaying) return;
        
        if (document.pointerLockElement === this.renderer.domElement) {
            this.cameraAngle -= e.movementX * this.mouseSensitivity;
            
            // Update camera position
            const cameraOffset = new THREE.Vector3(
                Math.sin(this.cameraAngle) * this.cameraDistance,
                this.cameraHeight,
                Math.cos(this.cameraAngle) * this.cameraDistance
            );
            
            this.camera.position.copy(this.player.position).add(cameraOffset);
            this.camera.lookAt(this.player.position);
        }
    }

    handleMouseWheel(e) {
        if (!this.isPlaying) return;
        
        this.cameraDistance = Math.max(5, Math.min(15, 
            this.cameraDistance + e.deltaY * 0.01
        ));
    }

    handleKeyDown(e) {
        if (!this.isPlaying) return;
        
        switch(e.key.toLowerCase()) {
            case 'w':
                this.moveDirection.z = 1;
                const now = Date.now();
                if (now - this.lastWPress < 300) { // Double tap detection
                    this.moveSpeed = this.sprintSpeed;
                }
                this.lastWPress = now;
                break;
            case 's':
                this.moveDirection.z = -1;
                break;
            case 'a':
                this.moveDirection.x = -1;
                break;
            case 'd':
                this.moveDirection.x = 1;
                break;
            case ' ':
                this.jump();
                break;
            case 'shift':
                this.isShifting = true;
                break;
        }
    }

    handleKeyUp(e) {
        if (!this.isPlaying) return;
        
        switch(e.key.toLowerCase()) {
            case 'w':
                this.moveDirection.z = 0;
                if (this.moveSpeed === this.sprintSpeed) {
                    this.moveSpeed = this.baseSpeed;
                }
                break;
            case 's':
                this.moveDirection.z = 0;
                break;
            case 'a':
                this.moveDirection.x = 0;
                break;
            case 'd':
                this.moveDirection.x = 0;
                break;
            case 'shift':
                this.isShifting = false;
                break;
        }
    }

    clearLevel() {
        // Remove all obstacles
        while(this.obstacles.length > 0) {
            const obstacle = this.obstacles.pop();
            this.scene.remove(obstacle);
        }
        
        // Reset player position
        if (this.player) {
            this.player.position.set(0, 0, 0);
            this.velocity.set(0, 0, 0);
        }
        
        // Reset AI if active
        if (this.aiPlayer) {
            this.aiPlayer.reset();
        }
    }
}

// AI Implementation
class AIPlayer {
    constructor(game, difficulty = 'medium') {
        this.game = game;
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.difficulty = difficulty;
        
        // Adjust AI parameters based on difficulty
        switch(difficulty) {
            case 'easy':
                this.moveSpeed = 0.12;
                this.jumpForce = 0.3;
                this.reactionTime = 300; // ms
                this.errorRate = 0.3; // 30% chance of making mistakes
                break;
            case 'medium':
                this.moveSpeed = 0.15;
                this.jumpForce = 0.35;
                this.reactionTime = 200;
                this.errorRate = 0.15;
                break;
            case 'hard':
                this.moveSpeed = 0.18;
                this.jumpForce = 0.38;
                this.reactionTime = 100;
                this.errorRate = 0.05;
                break;
            case 'expert':
                this.moveSpeed = 0.22;
                this.jumpForce = 0.4;
                this.reactionTime = 50;
                this.errorRate = 0.02;
                break;
            case 'perfect':
                this.moveSpeed = 0.25;
                this.jumpForce = 0.42;
                this.reactionTime = 0;
                this.errorRate = 0;
                break;
        }

        this.isGrounded = false;
        this.target = null;
        this.pathPoints = [];
        this.currentPathIndex = 0;
        this.lastDecisionTime = 0;
        
        this.createAIModel();
    }

    createAIModel() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        
        // Define distinct AI colors
        let color, emissive, emissiveIntensity;
        switch(this.difficulty) {
            case 'easy':
                color = 0x00ff99;        // Bright cyan-green
                emissive = 0x00ff99;
                emissiveIntensity = 0.3;
                break;
            case 'medium':
                color = 0xff6600;        // Bright orange
                emissive = 0xff3300;
                emissiveIntensity = 0.4;
                break;
            case 'hard':
                color = 0xff0066;        // Hot pink
                emissive = 0xff0066;
                emissiveIntensity = 0.5;
                break;
            case 'expert':
                color = 0x6600ff;        // Bright purple
                emissive = 0x6600ff;
                emissiveIntensity = 0.6;
                break;
            case 'perfect':
                color = 0xffff33;        // Bright yellow
                emissive = 0xffff33;
                emissiveIntensity = 0.7;
                break;
        }
        
        const material = new THREE.MeshPhongMaterial({ 
            color: color,
            emissive: emissive,
            emissiveIntensity: emissiveIntensity,
            shininess: 30
        });
        
        this.model = new THREE.Mesh(geometry, material);
        this.model.castShadow = true;
        
        // Add glowing effect for higher difficulties
        if (this.difficulty === 'expert' || this.difficulty === 'perfect') {
            const glowGeometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
            const glowMaterial = new THREE.MeshPhongMaterial({
                color: color,
                transparent: true,
                opacity: 0.3
            });
            const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
            this.model.add(glowMesh);
        }
        
        this.game.scene.add(this.model);
    }

    update() {
        // Add random mistakes based on difficulty
        if (Math.random() < this.errorRate) {
            // Simulate AI mistakes like:
            // - Slight direction changes
            // - Delayed jumps
            // - Occasional misses
            this.velocity.x += (Math.random() - 0.5) * 0.1;
            this.velocity.z += (Math.random() - 0.5) * 0.1;
            return;
        }

        // Only make new decisions after reaction time has passed
        const now = Date.now();
        if (now - this.lastDecisionTime >= this.reactionTime) {
            this.makeDecision();
            this.lastDecisionTime = now;
        }

        // Apply gravity
        this.velocity.y += this.game.gravity;

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

    makeDecision() {
        // Add pathfinding to avoid obstacles
        if (!this.target || this.reachedTarget()) {
            // Look ahead for multiple platforms instead of just the next one
            const platforms = this.findBestPath();
            if (platforms.length > 0) {
                this.pathPoints = platforms;
                this.currentPathIndex = 0;
                this.target = this.pathPoints[0].position.clone().add(new THREE.Vector3(0, 1, 0));
            }
        }

        // Add bullet avoidance for levels 30+
        if (this.game.currentLevel >= 30) {
            this.avoidBullets();
        }
    }

    findBestPath() {
        const platforms = [];
        let currentHeight = this.position.y;
        let currentPos = this.position.clone();
        
        // First look for finish block
        const finish = this.game.obstacles.find(o => o.userData.type === 'finish');
        if (finish) {
            // If finish is reachable, target it directly
            if (finish.position.distanceTo(currentPos) < this.getJumpRange() * 2) {
                platforms.push(finish);
                return platforms;
            }
        }
        
        // Sort platforms by distance and height
        const sortedPlatforms = this.game.obstacles
            .filter(o => o.userData.type !== 'finish')
            .sort((a, b) => {
                const scoreA = a.position.z * 2 + a.position.y;
                const scoreB = b.position.z * 2 + b.position.y;
                return scoreB - scoreA;
            });

        // Find reachable platforms leading to finish
        for (const platform of sortedPlatforms) {
            if (platform.position.y >= currentHeight && 
                platform.position.distanceTo(currentPos) < this.getJumpRange()) {
                platforms.push(platform);
                currentHeight = platform.position.y;
                currentPos = platform.position.clone();
            }
        }
        
        return platforms;
    }

    avoidBullets() {
        for (const bullet of this.game.bullets) {
            const futurePos = bullet.position.clone().add(bullet.velocity.clone().multiplyScalar(5));
            if (futurePos.distanceTo(this.position) < 1.5) {
                // Calculate dodge direction perpendicular to bullet path
                const dodgeDir = new THREE.Vector3(-bullet.velocity.z, 0, bullet.velocity.x).normalize();
                this.velocity.add(dodgeDir.multiplyScalar(0.1));
            }
        }
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

    reachedTarget() {
        return this.target && this.position.distanceTo(this.target) < 1;
    }

    reset() {
        this.position.set(2, 0, 0);
        this.velocity.set(0, 0, 0);
        this.target = null;
        this.model.position.copy(this.position);
    }

    getJumpRange() {
        // Calculate max jump distance based on physics
        const t = Math.sqrt(2 * this.jumpForce / -this.game.gravity);
        return this.moveSpeed * t * 1.5; // Add 50% safety margin
    }
} 
