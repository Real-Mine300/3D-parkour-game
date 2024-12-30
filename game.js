class ParkourGame {
    constructor() {
        // Initialize core components
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        // Game state
        this.isPlaying = false;
        this.currentLevel = 1;
        this.deaths = 0;
        this.timer = 0;
        this.levelCompleted = false;
        this.bestTimes = new Array(50).fill(Infinity);
        
        // Movement and physics
        this.moveDirection = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.baseSpeed = 0.15;
        this.moveSpeed = this.baseSpeed;
        this.sprintSpeed = this.baseSpeed * 1.8;
        this.gravity = -0.015;
        this.jumpForce = 0.3;
        this.isGrounded = false;
        this.isShifting = false;
        this.lastWPress = 0;
        this.platformFriction = 0.98;
        
        // Game objects
        this.obstacles = [];
        this.finishBlock = null;
        this.player = null;
        this.aiPlayer = null;
        
        // Camera settings
        this.cameraAngle = 0;
        this.cameraHeight = 2;
        this.cameraDistance = 10;
        this.rotationSpeed = 0.03;
        
        // Initialize the game
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

        // Setup controls
        this.setupControls();
        
        // Start animation loop
        this.animate();
    }

    startGame() {
        this.isPlaying = true;
        this.timer = 0;
        this.deaths = 0;
        this.currentLevel = 1;
        this.loadLevel(1);
        document.getElementById('menu').style.display = 'none';
        
        // Reset player position
        this.player.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        
        // Update HUD
        document.getElementById('deaths').textContent = `Deaths: ${this.deaths}`;
        document.getElementById('level').textContent = `Level: ${this.currentLevel}`;
        document.getElementById('timer').textContent = 'Time: 0:00';
    }

    // ... rest of the existing code ...
} 
