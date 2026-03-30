const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hpEl = document.getElementById('hp');
const ammoEl = document.getElementById('ammo');
const magsEl = document.getElementById('mags');
const grenadesEl = document.getElementById('grenades');
const killsEl = document.getElementById('kills');
const invItemsEl = document.getElementById('inv-items');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const finalKillsEl = document.getElementById('final-kills');

// Mobile UI elements
const moveStick = document.getElementById('move-joystick-stick');
const moveBase = document.getElementById('move-joystick-base');
const btnShoot = document.getElementById('btn-shoot');
const btnReload = document.getElementById('btn-reload');
const btnGrenade = document.getElementById('btn-grenade');

// Game state
let gameRunning = false;
let animationId;
let spawnInterval;
let score = 0;
let kills = 0;

// Input handling
const keys = {};
let mousePos = { x: 0, y: 0 };
let moveJoystick = { active: false, x: 0, y: 0, startX: 0, startY: 0 };
let joystickTouchId = null;
let isManualAiming = false;
let aimTouchId = null;
const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'KeyR' && gameRunning) player.reload();
    if (e.code === 'KeyE' && gameRunning) player.throwGrenade();
});
window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
});
window.addEventListener('mousedown', () => {
    if (gameRunning) player.shoot();
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
        // If the lifted touch was the joystick touch, reset joystick
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joystickTouchId) {
                joystickTouchId = null;
                moveJoystick.active = false;
                moveJoystick.x = 0;
                moveJoystick.y = 0;
                if (moveStick) moveStick.style.transform = `translate(-50%, -50%)`;
            }
        }

        // If the lifted touch was the aim touch, reset manual aiming
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === aimTouchId) {
                aimTouchId = null;
                isManualAiming = false;
            }
        }
    });
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

if (btnShoot) btnShoot.addEventListener('touchstart', (e) => { if (gameRunning) player.shoot(); e.preventDefault(); });
if (btnReload) btnReload.addEventListener('touchstart', (e) => { if (gameRunning) player.reload(); e.preventDefault(); });
if (btnGrenade) btnGrenade.addEventListener('touchstart', (e) => { if (gameRunning) player.throwGrenade(); e.preventDefault(); });

// Handle touch for aiming on mobile (touching anywhere else on canvas)
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
    // Check for our specific aim touch
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

// Resize canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

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

        // Auto-aim on mobile
        if (isMobile && !isManualAiming && npcs.length > 0) {
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
                // Smoothly interpolate or just snap?
                // For better feel, let's snap for now, but in a real game we might interpolate
                mousePos.x = nearestNpc.x;
                mousePos.y = nearestNpc.y;
            }
        } else if (moveJoystick.active && !isManualAiming) {
            // If no NPCs, aim in movement direction
            mousePos.x = this.x + moveJoystick.x * 100;
            mousePos.y = this.y + moveJoystick.y * 100;
        }

        // Keep in bounds
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        this.bullets.forEach((b, i) => {
            b.update();
            if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
                this.bullets.splice(i, 1);
            }
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
            this.bullets.push(new Bullet(this.x, this.y, angle));
            this.ammo--;
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

    updateHUD() {
        hpEl.textContent = Math.max(0, Math.floor(this.hp));
        ammoEl.textContent = `${this.ammo}/${this.maxAmmo}`;
        magsEl.textContent = `${this.mags}/${this.maxMags}`;
        grenadesEl.textContent = `${this.grenades}/${this.maxGrenades}`;
        killsEl.textContent = kills;
        
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
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.radius = 4;
        this.speed = 10;
        this.velocity = {
            x: Math.cos(angle) * this.speed,
            y: Math.sin(angle) * this.speed
        };
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
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
                    npcs.splice(nIndex, 1);
                    kills++;
                    player.updateHUD();
                }
            }
        });
    }
}

class NPC {
    constructor() {
        this.radius = 15 + Math.random() * 10;
        this.color = '#ff4757';
        this.speed = 1.5 + Math.random() * 2;
        this.hp = 30;
        
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
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
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

let player = new Player();
let npcs = [];
let loot = [];
let particles = [];

function spawnNPC() {
    if (gameRunning) npcs.push(new NPC());
}

function update() {
    if (!gameRunning) return;

    player.update();

    npcs.forEach((npc, nIndex) => {
        npc.update();

        // NPC hit player
        const dist = Math.hypot(player.x - npc.x, player.y - npc.y);
        if (dist < player.radius + npc.radius) {
            player.takeDamage(0.5);
        }

        // Bullet hit NPC
        player.bullets.forEach((bullet, bIndex) => {
            const bDist = Math.hypot(bullet.x - npc.x, bullet.y - npc.y);
            if (bDist < bullet.radius + npc.radius) {
                npc.hp -= 10;
                createExplosion(npc.x, npc.y, npc.color);
                player.bullets.splice(bIndex, 1);
                
                if (npc.hp <= 0) {
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

    // Grid for depth
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.05)';
    ctx.lineWidth = 1;
    const size = 50;
    for(let x=0; x<canvas.width; x+=size) {
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for(let y=0; y<canvas.height; y+=size) {
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    loot.forEach(item => item.draw());
    particles.forEach(p => p.draw());
    npcs.forEach(npc => npc.draw());
    player.draw();
    player.bullets.forEach(b => b.draw());
    player.grenadeList.forEach(g => g.draw());
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
    player = new Player();
    npcs = [];
    loot = [];
    particles = [];
    score = 0;
    kills = 0;
    gameRunning = true;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    player.updateHUD();
    
    if (spawnInterval) clearInterval(spawnInterval);
    spawnInterval = setInterval(spawnNPC, 1500);
    
    if (animationId) cancelAnimationFrame(animationId);
    gameLoop();
}

function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    clearInterval(spawnInterval);
    finalKillsEl.textContent = kills;
    gameOverScreen.classList.remove('hidden');
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

    gameOverScreen.classList.remove('hidden');
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
