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
                case 'w':
                    if (this.isGrounded) this.jump();
                    break;
                case 'a':
                    this.moveDirection.x = -1;
                    break;
                case 'd':
                    this.moveDirection.x = 1;
                    break;
                case 's':
                    this.moveDirection.z = 1;
                    break;
                case 'w':
                    this.moveDirection.z = -1;
                    break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch(e.key.toLowerCase()) {
                case 'a':
                case 'd':
                    this.moveDirection.x = 0;
                    break;
                case 'w':
                case 's':
                    this.moveDirection.z = 0;
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

        // Add arrow key camera rotation
        document.addEventListener('keydown', (e) => {
            if (!this.isPlaying) return;
            
            switch(e.key) {
                case 'ArrowUp':
                    this.cameraRotation.x += this.keyRotationSpeed;
                    break;
                case 'ArrowDown':
                    this.cameraRotation.x -= this.keyRotationSpeed;
                    break;
                case 'ArrowLeft':
                    this.cameraRotation.y += this.keyRotationSpeed;
                    break;
                case 'ArrowRight':
                    this.cameraRotation.y -= this.keyRotationSpeed;
                    break;
            }
            
            // Limit vertical rotation
            this.cameraRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.cameraRotation.x));
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
            this.createAIPlayer();
        } else if (this.aiPlayer) {
            this.scene.remove(this.aiPlayer);
            this.aiPlayer = null;
        }
    }

    createAIPlayer() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        this.aiPlayer = new THREE.Mesh(geometry, material);
        this.aiPlayer.position.x = 2;
        this.scene.add(this.aiPlayer);
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
        
        // Update position
        this.player.position.add(this.velocity);
        
        // Ground check
        if (this.player.position.y <= 0) {
            this.player.position.y = 0;
            this.velocity.y = 0;
            this.isGrounded = true;
        }

        // Check collisions
        this.checkCollisions();
        
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

        // Create new level
        this.createLevel(levelNumber);
        
        document.getElementById('level').textContent = `Level: ${levelNumber}`;
    }

    createLevel(levelNumber) {
        // Create floor
        const floor = new THREE.Mesh(
            new THREE.BoxGeometry(100, 1, 100),
            new THREE.MeshPhongMaterial({ color: 0x808080 })
        );
        floor.position.y = -0.5;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Add obstacles based on level
        const obstacleCount = Math.min(levelNumber * 2, 20);
        
        for (let i = 0; i < obstacleCount; i++) {
            this.addRandomObstacle(levelNumber);
        }
    }

    addRandomObstacle(levelNumber) {
        const types = ['platform'];
        if (levelNumber > 10) types.push('glass');
        if (levelNumber > 20) types.push('spike');
        if (levelNumber > 30) types.push('ice');
        
        const type = types[Math.floor(Math.random() * types.length)];
        const position = new THREE.Vector3(
            Math.random() * 20 - 10,
            Math.random() * 5 + 1,
            Math.random() * 20 - 10
        );
        
        let obstacle;
        switch(type) {
            case 'glass':
                obstacle = this.createGlassBlock(position);
                break;
            case 'spike':
                obstacle = this.createSpike(position);
                break;
            case 'ice':
                obstacle = this.createIceBlock(position);
                break;
            default:
                obstacle = this.createPlatform(position);
                break;
        }
        
        obstacle.userData.type = type;
        this.obstacles.push(obstacle);
        this.scene.add(obstacle);
    }

    createPlatform(position) {
        const platform = new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.5, 2),
            new THREE.MeshPhongMaterial({ color: 0x8b4513 })
        );
        platform.position.copy(position);
        platform.castShadow = true;
        platform.receiveShadow = true;
        return platform;
    }

    createGlassBlock(position) {
        const glass = new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.5, 2),
            new THREE.MeshPhongMaterial({
                color: 0x88ccff,
                transparent: true,
                opacity: 0.3
            })
        );
        glass.position.copy(position);
        return glass;
    }

    createSpike(position) {
        const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.5, 1, 4),
            new THREE.MeshPhongMaterial({ color: 0xff0000 })
        );
        spike.position.copy(position);
        spike.rotation.x = Math.PI;
        return spike;
    }

    createIceBlock(position) {
        const ice = new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.5, 2),
            new THREE.MeshPhongMaterial({
                color: 0xadd8e6,
                transparent: true,
                opacity: 0.8
            })
        );
        ice.position.copy(position);
        return ice;
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
        // Smooth camera rotation
        this.cameraRotation.x += (this.targetCameraRotation.x - this.cameraRotation.x) * this.cameraSmoothness;
        this.cameraRotation.y += (this.targetCameraRotation.y - this.cameraRotation.y) * this.cameraSmoothness;
        
        // Smooth camera zoom
        this.cameraDistance += (this.targetCameraDistance - this.cameraDistance) * this.zoomSmoothness;
        
        // Calculate camera position with smooth interpolation
        const horizontalDistance = this.cameraDistance * Math.cos(this.cameraRotation.x);
        const verticalDistance = this.cameraDistance * Math.sin(this.cameraRotation.x);
        
        // Target position (where we want the camera to look at)
        const targetPos = new THREE.Vector3(
            this.player.position.x,
            this.player.position.y + 2,
            this.player.position.z
        );
        
        // Calculate desired camera position
        const desiredPos = new THREE.Vector3(
            targetPos.x + horizontalDistance * Math.sin(this.cameraRotation.y),
            targetPos.y + verticalDistance,
            targetPos.z + horizontalDistance * Math.cos(this.cameraRotation.y)
        );
        
        // Smoothly move camera to desired position
        this.camera.position.lerp(desiredPos, this.cameraSmoothness);
        
        // Smoothly look at target
        const currentLookAt = new THREE.Vector3();
        this.camera.getWorldDirection(currentLookAt);
        const targetLookAt = targetPos.clone().sub(this.camera.position).normalize();
        
        const newLookAt = currentLookAt.lerp(targetLookAt, this.cameraSmoothness);
        this.camera.lookAt(this.camera.position.clone().add(newLookAt));

        // Update player movement direction based on camera rotation
        this.updatePlayerMovement();
    }

    updatePlayerMovement() {
        if (this.moveDirection.length() > 0) {
            // Calculate movement direction relative to camera rotation
            const angle = this.cameraRotation.y;
            const moveX = this.moveDirection.x * Math.cos(angle) - this.moveDirection.z * Math.sin(angle);
            const moveZ = this.moveDirection.x * Math.sin(angle) + this.moveDirection.z * Math.cos(angle);
            
            this.velocity.x = moveX * this.moveSpeed;
            this.velocity.z = moveZ * this.moveSpeed;
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
}

// Initialize game
const game = new ParkourGame(); 