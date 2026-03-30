let canvas, ctx, hpEl, ammoEl, magsEl, grenadesEl, killsEl, invItemsEl, startScreen, gameOverScreen, startBtn, restartBtn, finalKillsEl, levelEl, xpEl, xpNextEl, upgradeScreen, upgradeOptionsEl;
let moveStick, moveBase, btnShoot, btnReload, btnGrenade;

// Initialize elements
function initElements() {
    canvas = document.getElementById('gameCanvas');
    if (canvas) ctx = canvas.getContext('2d');
    hpEl = document.getElementById('hp');
    ammoEl = document.getElementById('ammo');
    magsEl = document.getElementById('mags');
    grenadesEl = document.getElementById('grenades');
    killsEl = document.getElementById('kills');
    invItemsEl = document.getElementById('inv-items');
    startScreen = document.getElementById('start-screen');
    gameOverScreen = document.getElementById('game-over');
    startBtn = document.getElementById('start-btn');
    restartBtn = document.getElementById('restart-btn');
    finalKillsEl = document.getElementById('final-kills');
    levelEl = document.getElementById('level');
    xpEl = document.getElementById('xp');
    xpNextEl = document.getElementById('xp-next');
    upgradeScreen = document.getElementById('upgrade-screen');
    upgradeOptionsEl = document.getElementById('upgrade-options');

    moveStick = document.getElementById('move-joystick-stick');
    moveBase = document.getElementById('move-joystick-base');
    btnShoot = document.getElementById('btn-shoot');
    btnReload = document.getElementById('btn-reload');
    btnGrenade = document.getElementById('btn-grenade');
}

// Game state
let gameRunning = false;
let animationId;
let spawnInterval;
let score = 0;
let kills = 0;

// World and camera
const world = { width: 3000, height: 3000 };
const camera = { x: 0, y: 0, width: 0, height: 0 };

// Input handling
const keys = {};
let mousePos = { x: 0, y: 0 };
let moveJoystick = { active: false, x: 0, y: 0, startX: 0, startY: 0 };
let joystickTouchId = null;
let isManualAiming = false;
let aimTouchId = null;
let autoAimEnabled = true; // Auto-aim enabled by default
const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

function initListeners() {
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (e.code === 'KeyQ') {
            autoAimEnabled = !autoAimEnabled;
            console.log(`Auto-aim ${autoAimEnabled ? 'enabled' : 'disabled'}`);
        }
    });
    window.addEventListener('keyup', (e) => {
        keys[e.code] = false;
        if (e.code === 'KeyR' && gameRunning) player.reload();
        if (e.code === 'KeyE' && gameRunning) player.throwGrenade();
    });
    window.addEventListener('mousemove', (e) => {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;
    });
    window.addEventListener('mousedown', () => {
        if (gameRunning && player) player.shoot();
    });

    // Mobile input handling
    if (moveBase) {
        moveBase.addEventListener('touchstart', (e) => {
            const touch = e.changedTouches[0];
            joystickTouchId = touch.identifier;
            moveJoystick.active = true;
            const rect = moveBase.getBoundingClientRect();
            moveJoystick.startX = rect.left + rect.width / 2;
            moveJoystick.startY = rect.top + rect.height / 2;
            handleJoystickMove(touch);
        });

        moveBase.addEventListener('touchmove', (e) => {
            if (!moveJoystick.active) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === joystickTouchId) {
                    handleJoystickMove(touch);
                    e.preventDefault();
                }
            }
        }, { passive: false });

        window.addEventListener('touchend', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joystickTouchId) {
                    joystickTouchId = null;
                    moveJoystick.active = false;
                    moveJoystick.x = 0;
                    moveJoystick.y = 0;
                    if (moveStick) moveStick.style.transform = `translate(-50%, -50%)`;
                }
            }
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === aimTouchId) {
                    aimTouchId = null;
                    isManualAiming = false;
                }
            }
        });
    }

    if (btnShoot) btnShoot.addEventListener('touchstart', (e) => { if (gameRunning && player) player.shoot(); e.preventDefault(); });
    if (btnReload) btnReload.addEventListener('touchstart', (e) => { if (gameRunning && player) player.reload(); e.preventDefault(); });
    if (btnGrenade) btnGrenade.addEventListener('touchstart', (e) => { if (gameRunning && player) player.throwGrenade(); e.preventDefault(); });

    if (canvas) {
        canvas.addEventListener('touchstart', (e) => {
            if (!moveJoystick.active && aimTouchId === null) {
                const touch = e.changedTouches[0];
                aimTouchId = touch.identifier;
                isManualAiming = true;
                const rect = canvas.getBoundingClientRect();
                mousePos.x = touch.clientX - rect.left;
                mousePos.y = touch.clientY - rect.top;
            }
        });
        canvas.addEventListener('touchmove', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === aimTouchId) {
                    const rect = canvas.getBoundingClientRect();
                    mousePos.x = touch.clientX - rect.left;
                    mousePos.y = touch.clientY - rect.top;
                    e.preventDefault();
                }
            }
        }, { passive: false });
    }
}

function handleJoystickMove(touch) {
    const dx = touch.clientX - moveJoystick.startX;
    const dy = touch.clientY - moveJoystick.startY;
    const dist = Math.hypot(dx, dy);
    const maxDist = 60; // Half of joystick base width
    
    const angle = Math.atan2(dy, dx);
    const moveDist = Math.min(dist, maxDist);
    
    moveJoystick.x = Math.cos(angle) * (moveDist / maxDist);
    moveJoystick.y = Math.sin(angle) * (moveDist / maxDist);
    
    if (moveStick) {
        moveStick.style.transform = `translate(calc(-50% + ${Math.cos(angle) * moveDist}px), calc(-50% + ${Math.sin(angle) * moveDist}px))`;
    }
}


// Resize canvas
function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.width = canvas.width;
    camera.height = canvas.height;
    if (gameRunning && player) {
        // Optional: reposition player or other elements if needed
    }
}
window.addEventListener('resize', resizeCanvas);
// Call resize after a short delay to ensure DOM is fully ready
setTimeout(resizeCanvas, 0);

class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 20;
        this.speed = 5;
        this.hp = 100;
        this.maxAmmo = 30;
        this.ammo = 30;
        this.mags = 3;
        this.maxMags = 10;
        this.grenades = 0;
        this.maxGrenades = 10;
        this.bullets = [];
        this.grenadeList = [];
        this.inventory = [];
        this.color = '#00ff00';
        this.level = 1;
        this.xp = 0;
        this.xpToNextLevel = 100;

        // Upgrades
        this.scatterShot = false;
        this.fireShot = false;
        this.iceShot = false;
    }

    draw() {
        // Draw player
        ctx.save();
        ctx.translate(this.x, this.y);
        const angle = Math.atan2(mousePos.y - this.y, mousePos.x - this.x);
        ctx.rotate(angle);
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // Gun
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.radius - 5, -5, 15, 10);
        ctx.restore();
    }

    update() {
        if (keys['KeyW'] || keys['ArrowUp']) this.y -= this.speed;
        if (keys['KeyS'] || keys['ArrowDown']) this.y += this.speed;
        if (keys['KeyA'] || keys['ArrowLeft']) this.x -= this.speed;
        if (keys['KeyD'] || keys['ArrowRight']) this.x += this.speed;

        // Mobile movement
        if (moveJoystick.active) {
            this.x += moveJoystick.x * this.speed;
            this.y += moveJoystick.y * this.speed;
        }

        // Auto-aim: Straight to nearest NPC if enabled and not manual aiming
        if (autoAimEnabled && !isManualAiming && npcs.length > 0) {
            let nearestNpc = null;
            let minDist = Infinity;
            
            npcs.forEach(npc => {
                const dist = Math.hypot(npc.x - this.x, npc.y - this.y);
                if (dist < minDist) {
                    minDist = dist;
                    nearestNpc = npc;
                }
            });
            
            if (nearestNpc) {
                // Point straight to NPC center
                mousePos.x = nearestNpc.x;
                mousePos.y = nearestNpc.y;
            }
        } else if (isMobile && moveJoystick.active && !isManualAiming) {
            // If on mobile and no NPCs, aim in movement direction
            mousePos.x = this.x + moveJoystick.x * 100;
            mousePos.y = this.y + moveJoystick.y * 100;
        }

        // Keep in bounds
        this.x = Math.max(this.radius, Math.min(world.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(world.height - this.radius, this.y));

        // Wall collision
        walls.forEach(wall => {
            // Check x-axis collision
            if (this.x - this.radius < wall.x + wall.width &&
                this.x + this.radius > wall.x &&
                this.y - this.radius < wall.y + wall.height &&
                this.y + this.radius > wall.y) {
                if (this.x < wall.x) this.x = wall.x - this.radius;
                else this.x = wall.x + wall.width + this.radius;
            }
            // Check y-axis collision
            if (this.y - this.radius < wall.y + wall.height &&
                this.y + this.radius > wall.y &&
                this.x - this.radius < wall.x + wall.width &&
                this.x + this.radius > wall.x) {
                if (this.y < wall.y) this.y = wall.y - this.radius;
                else this.y = wall.y + wall.height + this.radius;
            }
        });

        // Update camera to follow player
        camera.x = this.x - camera.width / 2;
        camera.y = this.y - camera.height / 2;
        // Clamp camera to world bounds
        camera.x = Math.max(0, Math.min(world.width - camera.width, camera.x));
        camera.y = Math.max(0, Math.min(world.height - camera.height, camera.y));

        this.bullets.forEach((b, i) => {
            b.update();
            if (b.x < 0 || b.x > world.width || b.y < 0 || b.y > world.height) {
                this.bullets.splice(i, 1);
            }

            walls.forEach(wall => {
                if (b.x > wall.x && b.x < wall.x + wall.width && b.y > wall.y && b.y < wall.y + wall.height) {
                    this.bullets.splice(i, 1);
                }
            });
        });

        this.grenadeList.forEach((g, i) => {
            g.update();
            if (g.timer <= 0) {
                g.explode();
                this.grenadeList.splice(i, 1);
            }
        });
    }

    shoot() {
        if (this.ammo > 0) {
            const angle = Math.atan2(mousePos.y - this.y, mousePos.x - this.x);
            this.bullets.push(new Bullet(this.x, this.y, angle, this.fireShot, this.iceShot));
            this.ammo--;

            if (this.scatterShot) {
                this.bullets.push(new Bullet(this.x, this.y, angle - 0.2, this.fireShot, this.iceShot));
                this.bullets.push(new Bullet(this.x, this.y, angle + 0.2, this.fireShot, this.iceShot));
            }

            this.updateHUD();
        } else {
            // Out of ammo visual hint
            ctx.fillStyle = '#ff4757';
            ctx.font = '20px Courier New';
            ctx.fillText('OUT OF AMMO! PRESS R TO RELOAD', canvas.width/2 - 150, canvas.height/2 + 100);
        }
    }

    reload() {
        if (this.mags > 0 && this.ammo < this.maxAmmo) {
            this.mags--;
            this.ammo = this.maxAmmo;
            this.updateHUD();
            // Optional: Create reload visual effect or sound
            console.log("Reloaded!");
        } else if (this.mags === 0) {
            console.log("No magazines left!");
        }
    }

    throwGrenade() {
        if (this.grenades > 0) {
            this.grenades--;
            this.grenadeList.push(new Grenade(this.x, this.y, mousePos));
            this.updateHUD();
        }
    }

    takeDamage(amt) {
        this.hp -= amt;
        this.updateHUD();
        if (this.hp <= 0) gameOver();
    }

    addXP(amount) {
        this.xp += amount;
        if (this.xp >= this.xpToNextLevel) {
            this.level++;
            this.xp -= this.xpToNextLevel;
            this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);
            console.log(`Level up! Reached level ${this.level}`);
            showUpgradeScreen();
        }
        this.updateHUD();
    }

    updateHUD() {
        hpEl.textContent = Math.max(0, Math.floor(this.hp));
        ammoEl.textContent = `${this.ammo}/${this.maxAmmo}`;
        magsEl.textContent = `${this.mags}/${this.maxMags}`;
        grenadesEl.textContent = `${this.grenades}/${this.maxGrenades}`;
        killsEl.textContent = kills;
        levelEl.textContent = this.level;
        xpEl.textContent = this.xp;
        xpNextEl.textContent = this.xpToNextLevel;
        
        // Update inventory UI
        invItemsEl.innerHTML = '';
        this.inventory.forEach(item => {
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            slot.textContent = item.type === 'ammo' ? 'AM' : 'HP';
            invItemsEl.appendChild(slot);
        });
    }
}

class Bullet {
    constructor(x, y, angle, isFire, isIce) {
        this.x = x;
        this.y = y;
        this.radius = 4;
        this.speed = 10;
        this.velocity = {
            x: Math.cos(angle) * this.speed,
            y: Math.sin(angle) * this.speed
        };
        this.isFire = isFire;
        this.isIce = isIce;
        this.color = '#fff';
        if (isFire) this.color = '#ff9f43';
        if (isIce) this.color = '#74b9ff';
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

class Grenade {
    constructor(x, y, target) {
        this.x = x;
        this.y = y;
        this.radius = 8;
        this.color = '#ff9f43';
        this.timer = 120; // 2 seconds at 60fps
        const angle = Math.atan2(target.y - y, target.x - x);
        this.velocity = {
            x: Math.cos(angle) * 7,
            y: Math.sin(angle) * 7
        };
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    update() {
        this.timer--;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.velocity.x *= 0.98;
        this.velocity.y *= 0.98;
    }

    explode() {
        createExplosion(this.x, this.y, this.color, 50, 150);
        npcs.forEach((npc, nIndex) => {
            const dist = Math.hypot(this.x - npc.x, this.y - npc.y);
            if (dist < 150) { // Explosion radius
                npc.hp -= 100; // High damage
                if (npc.hp <= 0) {
                    player.addXP(25); // Grant XP for kill
                    npcs.splice(nIndex, 1);
                    kills++;
                    player.updateHUD();
                }
            }
        });
    }
}

class NPC {
    constructor(playerLevel) {
        this.radius = 15 + Math.random() * 10;
        this.color = '#ff47e0ff';
        this.speed = 1.5 + Math.random() * 2 + (playerLevel * 0.1);
        this.hp = 30 + (playerLevel * 10);
        this.onFire = false;
        this.fireTicks = 0;
        this.frozen = false;
        this.frozenTicks = 0;
        
        // Spawn at random edge
        if (Math.random() < 0.5) {
            this.x = Math.random() < 0.5 ? 0 - this.radius : canvas.width + this.radius;
            this.y = Math.random() * canvas.height;
        } else {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() < 0.5 ? 0 - this.radius : canvas.height + this.radius;
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    }

    update() {
        if (this.onFire) {
            this.hp -= 0.1; // Fire damage
            this.fireTicks--;
            if (this.fireTicks <= 0) this.onFire = false;
        }

        let currentSpeed = this.speed;
        if (this.frozen) {
            currentSpeed *= 0.5; // Slowed down
            this.frozenTicks--;
            if (this.frozenTicks <= 0) this.frozen = false;
        }

        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * currentSpeed;
        this.y += Math.sin(angle) * currentSpeed;
    }
}

class Wall {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = '#576574';
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class ExplodingNPC extends NPC {
    constructor(playerLevel) {
        super(playerLevel);
        this.color = '#8B0000'; // Deep red color
        this.speed *= 1.2; // A bit faster
    }

    explode() {
        createExplosion(this.x, this.y, this.color, 80, 100);
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist < 100) { // Explosion radius
            player.takeDamage(30);
        }
        // Also damage other NPCs
        npcs.forEach(npc => {
            if (npc !== this) {
                const npcDist = Math.hypot(npc.x - this.x, npc.y - this.y);
                if (npcDist < 100) {
                    npc.hp -= 50;
                }
            }
        });
    }
}

class LootItem {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.type = type; // 'ammo', 'health', or 'grenade'
        this.color = type === 'ammo' ? '#ffa502' : type === 'health' ? '#2ed573' : '#ff9f43';
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    }
}

class Particle {
    constructor(x, y, color, size = 3) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = Math.random() * size;
        this.velocity = {
            x: (Math.random() - 0.5) * (Math.random() * 10),
            y: (Math.random() - 0.5) * (Math.random() * 10)
        };
        this.alpha = 1;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.02;
    }
}

let player;
let npcs = [];
let loot = [];
let particles = [];
let walls = [];

function spawnNPC() {
    if (gameRunning) {
        if (Math.random() < 0.2) { // 20% chance to spawn an exploding NPC
            npcs.push(new ExplodingNPC(player.level));
        } else {
            npcs.push(new NPC(player.level));
        }
    }
}

function update() {
    if (!gameRunning) return;

    player.update();

    npcs.forEach((npc, nIndex) => {
        npc.update();

        // NPC hit player
        const dist = Math.hypot(player.x - npc.x, player.y - npc.y);
        if (dist < player.radius + npc.radius) {
            if (npc instanceof ExplodingNPC) {
                npc.explode();
                npcs.splice(nIndex, 1);
            } else {
                player.takeDamage(0.5);
            }
        }

        // Bullet hit NPC
        player.bullets.forEach((bullet, bIndex) => {
            const bDist = Math.hypot(bullet.x - npc.x, bullet.y - npc.y);
            if (bDist < bullet.radius + npc.radius) {
                npc.hp -= 10;

                if (bullet.isFire) {
                    npc.onFire = true;
                    npc.fireTicks = 180; // 3 seconds of burn
                }
                if (bullet.isIce) {
                    npc.frozen = true;
                    npc.frozenTicks = 120; // 2 seconds of slow
                }

                createExplosion(npc.x, npc.y, npc.color);
                player.bullets.splice(bIndex, 1);
                
                if (npc.hp <= 0) {
                    if (npc instanceof ExplodingNPC) {
                        npc.explode();
                    }
                    player.addXP(25);
                    npcs.splice(nIndex, 1);
                    kills++;
                    player.updateHUD();
                    
                    // Loot drop chance
                    if (Math.random() < 0.8) { // 80% drop rate
                        const dropType = Math.random();
                        let type;
                        if (dropType < 0.2) { // 20% chance for grenade
                            type = 'grenade';
                        } else { // 80% chance for ammo or health
                            type = Math.random() < 0.5 ? 'ammo' : 'health';
                        }
                        loot.push(new LootItem(npc.x, npc.y, type));
                    }
                }
            }
        });
    });

    loot.forEach((item, iIndex) => {
        const dist = Math.hypot(player.x - item.x, player.y - item.y);
        if (dist < player.radius + item.radius) {
            // Pick up loot
            if (item.type === 'ammo') {
                if (player.mags < player.maxMags) {
                    player.mags = Math.min(player.maxMags, player.mags + 1);
                    loot.splice(iIndex, 1);
                }
            } else if (item.type === 'health') {
                if (player.hp < 100) {
                    player.hp = Math.min(100, player.hp + 20);
                    loot.splice(iIndex, 1);
                }
            } else if (item.type === 'grenade') {
                if (player.grenades < player.maxGrenades) {
                    player.grenades = Math.min(player.maxGrenades, player.grenades + 1);
                    loot.splice(iIndex, 1);
                }
            }
            player.updateHUD();
        }
    });

    particles.forEach((p, i) => {
        p.update();
        if (p.alpha <= 0) particles.splice(i, 1);
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Grid for depth
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.05)';
    ctx.lineWidth = 1;
    const size = 50;
    for(let x=0; x<world.width; x+=size) {
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x, world.height); ctx.stroke();
    }
    for(let y=0; y<world.height; y+=size) {
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(world.width, y); ctx.stroke();
    }

    loot.forEach(item => item.draw());
    walls.forEach(wall => wall.draw());
    particles.forEach(p => p.draw());
    npcs.forEach(npc => npc.draw());
    player.draw();
    player.bullets.forEach(b => b.draw());
    player.grenadeList.forEach(g => g.draw());

    ctx.restore();
}

function createExplosion(x, y, color, particleCount = 10, size = 3) {
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(x, y, color, size));
    }
}

function gameLoop() {
    update();
    draw();
    animationId = requestAnimationFrame(gameLoop);
}

function startGame() {
    console.log("Starting game...");
    try {
        player = new Player();
        npcs = [];
        loot = [];
        particles = [];
        walls = [];
        score = 0;
        kills = 0;
        gameRunning = true;

        // Create some walls
        walls.push(new Wall(500, 500, 200, 50));
        walls.push(new Wall(800, 800, 50, 200));
        walls.push(new Wall(1200, 300, 50, 400));
        walls.push(new Wall(2000, 1500, 300, 50));
        walls.push(new Wall(1500, 2000, 50, 300));
        
        if (startScreen) startScreen.classList.add('hidden');
        if (gameOverScreen) gameOverScreen.classList.add('hidden');
        
        if (player) player.updateHUD();
        
        if (spawnInterval) clearInterval(spawnInterval);
        spawnInterval = setInterval(spawnNPC, 1500);
        
        if (animationId) cancelAnimationFrame(animationId);
        gameLoop();
        console.log("Game loop started");
    } catch (error) {
        console.error("Error starting game:", error);
    }
}

function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    clearInterval(spawnInterval);
    finalKillsEl.textContent = kills;
    gameOverScreen.classList.remove('hidden');
}

const allUpgrades = [
    { id: 'scatter', title: 'Scatter Shot', description: 'Fire three bullets at once in a cone.' },
    { id: 'fire', title: 'Incendiary Rounds', description: 'Bullets set enemies on fire, dealing damage over time.' },
    { id: 'ice', title: 'Cryo Rounds', description: 'Bullets slow down enemies.' },
    { id: 'hp', title: 'Health Boost', description: 'Increase max HP by 20.' },
    { id: 'speed', title: 'Speed Boost', description: 'Increase player movement speed.' },
];

function showUpgradeScreen() {
    gameRunning = false;
    upgradeOptionsEl.innerHTML = '';

    // Get 3 random, unique upgrades
    const available = [...allUpgrades];
    const choices = [];
    for (let i = 0; i < 3 && available.length > 0; i++) {
        const randIndex = Math.floor(Math.random() * available.length);
        choices.push(available.splice(randIndex, 1)[0]);
    }

    choices.forEach(upgrade => {
        const btn = document.createElement('button');
        btn.className = 'upgrade-btn';
        btn.innerHTML = `<h3>${upgrade.title}</h3><p>${upgrade.description}</p>`;
        btn.onclick = () => applyUpgrade(upgrade.id);
        upgradeOptionsEl.appendChild(btn);
    });

    upgradeScreen.classList.remove('hidden');
}

function applyUpgrade(upgradeId) {
    console.log("Applying upgrade:", upgradeId);
    switch (upgradeId) {
        case 'scatter':
            player.scatterShot = true;
            break;
        case 'fire':
            player.fireShot = true;
            break;
        case 'ice':
            player.iceShot = true;
            break;
        case 'hp':
            player.hp = Math.min(player.hp + 20, 100); // Assuming 100 is max for now
            break;
        case 'speed':
            player.speed += 1;
            break;
    }

    upgradeScreen.classList.add('hidden');
    gameRunning = true;
    gameLoop(); // Resume game loop
}


// Initialize everything when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    initElements();
    initListeners();
    
    // Initial resize
    resizeCanvas();
    
    // Bind start buttons
    if (startBtn) startBtn.addEventListener('click', startGame);
    if (restartBtn) restartBtn.addEventListener('click', startGame);
});
