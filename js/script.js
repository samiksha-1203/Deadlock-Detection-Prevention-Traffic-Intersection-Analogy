let cars = [];
let carIdCounter = 1;
let deadlockCount = 0;
let canvas, ctx;
let isDeadlockDetected = false;

const positions = {
    north: {
        start: { left: 46.43, top: -10.71 },
        laneBase: { left: 46.43, top: 21.43 },
        intersection: { left: 46.43, top: 46.43 },
        resource: 'R_North',
        nextResource: 'R_East',
        offsetAxis: 'top',
        offsetDirection: -1
    },
    south: {
        start: { left: 46.43, top: 110.71 },
        laneBase: { left: 46.43, top: 78.57 },
        intersection: { left: 46.43, top: 53.57 },
        resource: 'R_South',
        nextResource: 'R_West',
        offsetAxis: 'top',
        offsetDirection: 1
    },
    east: {
        start: { left: 110.71, top: 46.43 },
        laneBase: { left: 78.57, top: 46.43 },
        intersection: { left: 53.57, top: 46.43 },
        resource: 'R_East',
        nextResource: 'R_South',
        offsetAxis: 'left',
        offsetDirection: 1
    },
    west: {
        start: { left: -10.71, top: 46.43 },
        laneBase: { left: 21.43, top: 46.43 },
        intersection: { left: 46.43, top: 46.43 },
        resource: 'R_West',
        nextResource: 'R_North',
        offsetAxis: 'left',
        offsetDirection: -1
    }
};

function init() {
    canvas = document.getElementById('ragCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    
    setupEventListeners();
    
    log('System initialized - Deadlock Detection & Prevention Simulator', 'success');
    log('Model: Cars=Processes, Lanes=Resources, Intersection=Critical Section', 'info');
    updateStats();
    drawRAG();
}

function setupEventListeners() {
    document.querySelectorAll('.btn-add').forEach(btn => {
        btn.addEventListener('click', function() {
            addCar(this.dataset.direction);
        });
    });

    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
    document.getElementById('detectBtn').addEventListener('click', detectDeadlock);
    document.getElementById('bankerBtn').addEventListener('click', runBankersAlgorithm);
    document.getElementById('resetBtn').addEventListener('click', resetSimulation);

    window.addEventListener('resize', () => {
        if (canvas) {
            resizeCanvas();
            repositionAllCars();
            drawRAG();
        }
    });
}

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}

function repositionAllCars() {
    const intersection = document.getElementById('intersection');
    const containerWidth = intersection.offsetWidth;
    
    cars.forEach(carObj => {
        if (carObj.position === 'lane') {
            const lanePos = calculateLanePosition(carObj.direction, carObj.laneIndex);
            carObj.element.style.left = (lanePos.left / 100 * containerWidth) + 'px';
            carObj.element.style.top = (lanePos.top / 100 * containerWidth) + 'px';
        }
    });
}

function log(message, type = 'info') {
    const logPanel = document.getElementById('logPanel');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${message}`;
    logPanel.appendChild(entry);
    logPanel.scrollTop = logPanel.scrollHeight;
}

function updateStats() {
    document.getElementById('carCount').textContent = cars.length;
    document.getElementById('deadlockCount').textContent = deadlockCount;
}

function getCarsInDirection(direction) {
    return cars.filter(c => c.direction === direction && c.state === 'waiting').length;
}

function calculateLanePosition(direction, index) {
    const config = positions[direction];
    const lanePos = { ...config.laneBase };
    
    const spacing = 10;
    const offset = index * spacing * config.offsetDirection;
    
    lanePos[config.offsetAxis] += offset;
    
    return lanePos;
}

function addCar(direction) {
    const carId = `P${carIdCounter}`;
    carIdCounter++;
    
    const car = document.createElement('div');
    car.id = carId;
    car.className = `car ${direction}`;
    car.innerHTML = `🚗<div class="car-label">${carId}</div>`;
    
    const intersection = document.getElementById('intersection');
    const containerWidth = intersection.offsetWidth;
    
    car.style.left = (positions[direction].start.left / 100 * containerWidth) + 'px';
    car.style.top = (positions[direction].start.top / 100 * containerWidth) + 'px';

    intersection.appendChild(car);

    const laneIndex = getCarsInDirection(direction);

    const carObj = {
        id: carId,
        element: car,
        direction: direction,
        state: 'approaching',
        position: 'start',
        allocated: null,
        requesting: positions[direction].resource,
        laneIndex: laneIndex
    };

    cars.push(carObj);
    log(`${carId} created - Requesting ${positions[direction].resource}`, 'info');
    
    updateStats();

    setTimeout(() => moveCar(carObj, 'lane'), 500);
}

function moveCar(carObj, position) {
    const intersection = document.getElementById('intersection');
    const containerWidth = intersection.offsetWidth;
    
    let pos;
    if (position === 'lane') {
        pos = calculateLanePosition(carObj.direction, carObj.laneIndex);
    } else {
        pos = positions[carObj.direction][position];
    }
    
    carObj.element.style.left = (pos.left / 100 * containerWidth) + 'px';
    carObj.element.style.top = (pos.top / 100 * containerWidth) + 'px';
    carObj.position = position;

    if (position === 'lane') {
        carObj.allocated = positions[carObj.direction].resource;
        carObj.requesting = positions[carObj.direction].nextResource;
        carObj.state = 'waiting';
        
        log(`${carObj.id} ALLOCATED: ${carObj.allocated}, REQUESTING: ${carObj.requesting}`, 'warning');
        
        updateDeadlockConditions();
    }
}

function updateDeadlockConditions() {
    const waitingCars = cars.filter(c => c.state === 'waiting');
    
    document.getElementById('cond1').classList.toggle('active', waitingCars.length > 0);
    document.getElementById('cond2').classList.toggle('active', waitingCars.length > 0);
    document.getElementById('cond3').classList.toggle('active', waitingCars.length > 0);
    
    const hasCircular = checkCircularWait();
    document.getElementById('cond4').classList.toggle('active', hasCircular);
    
    if (hasCircular && !isDeadlockDetected) {
        isDeadlockDetected = true;
        
        log('⚠️ DEADLOCK AUTO-DETECTED!', 'error');
        log('Circular Wait condition satisfied - Cycle formed in RAG', 'error');
        
        waitingCars.forEach(car => {
            car.element.classList.add('deadlocked');
        });
        
        deadlockCount++;
        updateStats();
    }
    
    // Always draw RAG with current deadlock state
    drawRAG();
}

function checkCircularWait() {
    const waitingCars = cars.filter(c => c.state === 'waiting');
    if (waitingCars.length < 2) return false;

    const resourceOwners = {};

    waitingCars.forEach(car => {
        if (car.allocated) {
            resourceOwners[car.allocated] = car.id;
        }
    });

    const visited = new Set();
    const recStack = new Set();

    function hasCycleDFS(processId) {
        visited.add(processId);
        recStack.add(processId);

        const process = cars.find(c => c.id === processId);
        if (!process || !process.requesting) {
            recStack.delete(processId);
            return false;
        }

        const nextProcess = resourceOwners[process.requesting];
        if (!nextProcess) {
            recStack.delete(processId);
            return false;
        }

        if (recStack.has(nextProcess)) {
            return true;
        }

        if (!visited.has(nextProcess)) {
            if (hasCycleDFS(nextProcess)) {
                return true;
            }
        }

        recStack.delete(processId);
        return false;
    }

    for (const car of waitingCars) {
        if (!visited.has(car.id)) {
            if (hasCycleDFS(car.id)) {
                return true;
            }
        }
    }

    return false;
}

function detectDeadlock() {
    const waitingCars = cars.filter(c => c.state === 'waiting');
    
    if (waitingCars.length === 0) {
        log('No processes waiting - No deadlock', 'success');
        drawRAG();
        return false;
    }

    log('=== DEADLOCK DETECTION ALGORITHM ===', 'info');
    log('Using RAG Cycle Detection Method', 'info');

    const hasCircular = checkCircularWait();

    if (hasCircular) {
        if (!isDeadlockDetected) {
            isDeadlockDetected = true;
            deadlockCount++;
            updateStats();
        }
        
        log('DEADLOCK DETECTED!', 'error');
        log('All 4 Coffman Conditions Satisfied:', 'error');
        log('  1. Mutual Exclusion: YES - Resources are exclusive', 'error');
        log('  2. Hold & Wait: YES - Processes hold while requesting', 'error');
        log('  3. No Preemption: YES - Cannot forcefully take resources', 'error');
        log('  4. Circular Wait: YES - Cycle detected in RAG', 'error');
        
        const cycle = findCycle();
        if (cycle.length > 0) {
            log(`Cycle: ${cycle.join(' → ')}`, 'error');
        }

        waitingCars.forEach(car => {
            car.element.classList.add('deadlocked');
        });

        drawRAG();
        return true;
    } else {
        log('No deadlock detected - No cycle in RAG', 'success');
        drawRAG();
        return false;
    }
}

function findCycle() {
    const waitingCars = cars.filter(c => c.state === 'waiting');
    const resourceOwners = {};

    waitingCars.forEach(car => {
        if (car.allocated) {
            resourceOwners[car.allocated] = car.id;
        }
    });

    const cycle = [];
    const visited = new Set();

    function traceCycle(processId) {
        if (visited.has(processId)) {
            return true;
        }
        visited.add(processId);
        cycle.push(processId);

        const process = cars.find(c => c.id === processId);
        if (!process || !process.requesting) return false;

        cycle.push(process.requesting);
        const nextProcess = resourceOwners[process.requesting];
        
        if (!nextProcess) return false;
        return traceCycle(nextProcess);
    }

    for (const car of waitingCars) {
        visited.clear();
        cycle.length = 0;
        if (traceCycle(car.id)) {
            return cycle;
        }
    }

    return [];
}

async function runBankersAlgorithm() {
    log('=== BANKER\'S ALGORITHM ===', 'success');
    
    const processes = cars.filter(c => c.state === 'waiting');
    if (processes.length === 0) {
        log('No processes to evaluate', 'info');
        return;
    }

    const resources = ['R_North', 'R_South', 'R_East', 'R_West'];
    const totalResources = { R_North: 1, R_South: 1, R_East: 1, R_West: 1 };

    const allocation = {};
    const max = {};
    const need = {};

    processes.forEach(p => {
        allocation[p.id] = { R_North: 0, R_South: 0, R_East: 0, R_West: 0 };
        max[p.id] = { R_North: 0, R_South: 0, R_East: 0, R_West: 0 };
        need[p.id] = { R_North: 0, R_South: 0, R_East: 0, R_West: 0 };

        if (p.allocated) {
            allocation[p.id][p.allocated] = 1;
            max[p.id][p.allocated] = 1;
        }
        
        if (p.requesting) {
            max[p.id][p.requesting] = 1;
        }

        resources.forEach(r => {
            need[p.id][r] = max[p.id][r] - allocation[p.id][r];
        });
    });

    const available = { ...totalResources };
    processes.forEach(p => {
        resources.forEach(r => {
            available[r] -= allocation[p.id][r];
        });
    });

    displayBankerMatrices(processes, allocation, need, available, totalResources);

    log('Total Resources: ' + JSON.stringify(totalResources), 'info');
    log('Available Resources: ' + JSON.stringify(available), 'info');
    log('Searching for safe sequence...', 'info');

    const safeSequence = [];
    const finished = new Set();
    const work = { ...available };

    let found = true;
    let iterations = 0;
    const maxIterations = processes.length * processes.length;

    while (finished.size < processes.length && found && iterations < maxIterations) {
        found = false;
        iterations++;

        for (const p of processes) {
            if (finished.has(p.id)) continue;

            let canFinish = true;
            for (const res of resources) {
                if (need[p.id][res] > work[res]) {
                    canFinish = false;
                    break;
                }
            }

            if (canFinish) {
                log(`${p.id} can execute - Need: ${JSON.stringify(need[p.id])}, Work: ${JSON.stringify(work)}`, 'success');
                
                for (const res of resources) {
                    work[res] += allocation[p.id][res];
                }
                
                log(`${p.id} releases resources - New Work: ${JSON.stringify(work)}`, 'info');
                
                safeSequence.push(p.id);
                finished.add(p.id);
                found = true;
                break;
            }
        }

        if (!found && finished.size < processes.length) {
            log(`Cannot find process to execute - Work: ${JSON.stringify(work)}`, 'warning');
            for (const p of processes) {
                if (!finished.has(p.id)) {
                    log(`${p.id} blocked - Needs: ${JSON.stringify(need[p.id])}`, 'warning');
                }
            }
        }
    }

    if (safeSequence.length === processes.length) {
        log(`✓ SAFE SEQUENCE FOUND: ${safeSequence.join(' → ')}`, 'success');
        log('System is in SAFE STATE - No deadlock will occur', 'success');
        log('Executing safe sequence and releasing resources...', 'info');
        
        for (const pid of safeSequence) {
            await sleep(1000);
            const car = cars.find(c => c.id === pid);
            if (car) {
                car.element.classList.remove('deadlocked');
                car.element.remove();
                cars = cars.filter(c => c.id !== pid);
                log(`${pid} completed execution and released resources`, 'success');
                updateStats();
                
                const stillDeadlocked = checkCircularWait();
                if (!stillDeadlocked) {
                    isDeadlockDetected = false;
                }
                drawRAG();
            }
        }
        
        log('✓ All processes completed safely!', 'success');
        isDeadlockDetected = false;
        updateDeadlockConditions();
    } else {
        log('✗ NO SAFE SEQUENCE EXISTS', 'error');
        log('System is in UNSAFE STATE - Potential deadlock!', 'error');
        log(`Only ${safeSequence.length} of ${processes.length} processes can complete`, 'error');
        if (safeSequence.length > 0) {
            log(`Partial sequence: ${safeSequence.join(' → ')}`, 'warning');
        }
        log('Banker\'s Algorithm would PREVENT this allocation', 'error');
    }
}

function displayBankerMatrices(processes, allocation, need, available, total) {
    const resources = ['R_N', 'R_S', 'R_E', 'R_W'];
    
    let html = '<strong>ALLOCATION MATRIX:</strong><table class="matrix-table"><tr><th>Process</th>';
    resources.forEach(r => html += `<th>${r}</th>`);
    html += '</tr>';
    
    processes.forEach(p => {
        html += `<tr><td><strong>${p.id}</strong></td>`;
        ['R_North', 'R_South', 'R_East', 'R_West'].forEach(r => {
            html += `<td>${allocation[p.id][r]}</td>`;
        });
        html += '</tr>';
    });
    html += '</table>';

    html += '<br><strong>NEED MATRIX:</strong><table class="matrix-table"><tr><th>Process</th>';
    resources.forEach(r => html += `<th>${r}</th>`);
    html += '</tr>';
    
    processes.forEach(p => {
        html += `<tr><td><strong>${p.id}</strong></td>`;
        ['R_North', 'R_South', 'R_East', 'R_West'].forEach(r => {
            html += `<td>${need[p.id][r]}</td>`;
        });
        html += '</tr>';
    });
    html += '</table>';

    html += '<br><strong>AVAILABLE VECTOR:</strong><table class="matrix-table"><tr>';
    resources.forEach(r => html += `<th>${r}</th>`);
    html += '</tr><tr>';
    ['R_North', 'R_South', 'R_East', 'R_West'].forEach(r => {
        html += `<td><strong>${available[r]}</strong></td>`;
    });
    html += '</tr></table>';

    document.getElementById('bankerDisplay').innerHTML = html;
}

function drawRAG(showDeadlock = null) {
    // If showDeadlock is not explicitly passed, check current state
    if (showDeadlock === null) {
        showDeadlock = isDeadlockDetected;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const w = canvas.width;
    const h = canvas.height;
    const isDark = document.body.classList.contains('dark');
    
    // Responsive sizing based on screen width
    const isMobile = w < 500;
    const isTablet = w >= 500 && w < 768;
    
    const titleSize = isMobile ? 11 : (isTablet ? 13 : 16);
    const legendSize = isMobile ? 8 : (isTablet ? 9 : 12);
    const resourceSize = isMobile ? 35 : (isTablet ? 50 : 60);
    const processRadius = isMobile ? 16 : (isTablet ? 20 : 25);
    const spacing = isMobile ? Math.min(w, h) * 0.22 : (isTablet ? 120 : 150);
    const circleRadius = isMobile ? Math.min(w, h) * 0.28 : (isTablet ? 140 : 180);
    
    // Title
    ctx.fillStyle = isDark ? '#e0e0e0' : '#1a1a1a';
    ctx.font = `bold ${titleSize}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText('Resource Allocation Graph', 10, titleSize + 5);
    
    // Legend
    ctx.font = `${legendSize}px Arial`;
    ctx.fillStyle = isDark ? '#9ca3af' : '#6b7280';
    if (isMobile) {
        ctx.fillText('○ Process | □ Resource', 10, titleSize + legendSize + 10);
        ctx.fillText('─ Allocated | ··· Requesting', 10, titleSize + legendSize * 2 + 14);
    } else {
        ctx.fillText('Circle = Process | Square = Resource | Solid → = Allocated | Dashed → = Requesting', 10, titleSize + legendSize + 10);
    }

    const waitingCars = cars.filter(c => c.state === 'waiting');
    
    if (waitingCars.length === 0) {
        ctx.fillStyle = isDark ? '#9ca3af' : '#6b7280';
        ctx.font = `${isMobile ? 10 : 14}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('No processes waiting - Add cars to see RAG', w/2, h/2);
        return;
    }

    // Resource positions
    const resourcePos = {
        R_North: { x: w/2 - spacing, y: h/2 - spacing, color: '#3b82f6' },
        R_East: { x: w/2 + spacing, y: h/2 - spacing, color: '#10b981' },
        R_South: { x: w/2 + spacing, y: h/2 + spacing, color: '#ef4444' },
        R_West: { x: w/2 - spacing, y: h/2 + spacing, color: '#f59e0b' }
    };

    // Process positions (circular layout)
    const processPos = {};
    const angleStep = (Math.PI * 2) / waitingCars.length;

    waitingCars.forEach((car, i) => {
        const angle = i * angleStep - Math.PI / 2;
        processPos[car.id] = {
            x: w/2 + Math.cos(angle) * circleRadius,
            y: h/2 + Math.sin(angle) * circleRadius,
            car: car
        };
    });

    // Draw edges - Allocated (solid)
    ctx.lineWidth = isMobile ? 1.5 : 2;
    waitingCars.forEach(car => {
        if (car.allocated && resourcePos[car.allocated] && processPos[car.id]) {
            const rPos = resourcePos[car.allocated];
            const pPos = processPos[car.id];
            
            ctx.strokeStyle = showDeadlock ? '#ff0000' : '#10b981';
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(rPos.x, rPos.y);
            ctx.lineTo(pPos.x, pPos.y);
            ctx.stroke();
            drawArrow(ctx, rPos.x, rPos.y, pPos.x, pPos.y, showDeadlock ? '#ff0000' : '#10b981', isMobile);
        }
    });

    // Draw edges - Requesting (dashed)
    waitingCars.forEach(car => {
        if (car.requesting && resourcePos[car.requesting] && processPos[car.id]) {
            const pPos = processPos[car.id];
            const rPos = resourcePos[car.requesting];
            
            ctx.strokeStyle = showDeadlock ? '#ff0000' : '#ef4444';
            ctx.setLineDash(isMobile ? [5, 3] : [8, 4]);
            ctx.beginPath();
            ctx.moveTo(pPos.x, pPos.y);
            ctx.lineTo(rPos.x, rPos.y);
            ctx.stroke();
            drawArrow(ctx, pPos.x, pPos.y, rPos.x, rPos.y, showDeadlock ? '#ff0000' : '#ef4444', isMobile);
        }
    });
    ctx.setLineDash([]);

    // Draw resources (squares)
    Object.entries(resourcePos).forEach(([name, pos]) => {
        const isAllocated = waitingCars.some(c => c.allocated === name);
        
        const halfSize = resourceSize / 2;
        ctx.fillStyle = isAllocated ? pos.color : '#d1d5db';
        ctx.fillRect(pos.x - halfSize, pos.y - halfSize * 0.66, resourceSize, halfSize * 1.33);
        
        ctx.strokeStyle = showDeadlock ? '#ff0000' : (isDark ? '#4a4a5e' : '#1a1a1a');
        ctx.lineWidth = showDeadlock ? (isMobile ? 2 : 3) : (isMobile ? 1.5 : 2);
        ctx.strokeRect(pos.x - halfSize, pos.y - halfSize * 0.66, resourceSize, halfSize * 1.33);
        
        ctx.fillStyle = isAllocated ? 'white' : '#4b5563';
        ctx.font = `bold ${isMobile ? 8 : (isTablet ? 9 : 11)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(name.split('_')[1], pos.x, pos.y + 3);
    });

    // Draw processes (circles)
    Object.entries(processPos).forEach(([pid, pPos]) => {
        const dirColors = {
            north: '#3b82f6',
            south: '#ef4444',
            east: '#10b981',
            west: '#f59e0b'
        };
        
        ctx.fillStyle = dirColors[pPos.car.direction];
        ctx.beginPath();
        ctx.arc(pPos.x, pPos.y, processRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = showDeadlock ? '#ff0000' : (isDark ? '#4a4a5e' : '#1a1a1a');
        ctx.lineWidth = showDeadlock ? (isMobile ? 2 : 3) : (isMobile ? 1.5 : 2);
        ctx.stroke();
        
        ctx.fillStyle = 'white';
        ctx.font = `bold ${isMobile ? 10 : (isTablet ? 12 : 14)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(pid, pPos.x, pPos.y + (isMobile ? 3 : 5));
    });

    // Bottom status message
    const bottomMargin = isMobile ? 12 : 20;
    if (showDeadlock) {
        ctx.fillStyle = '#ff0000';
        ctx.font = `bold ${isMobile ? 10 : (isTablet ? 12 : 16)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(isMobile ? '⚠️ DEADLOCK!' : '⚠️ DEADLOCK: Circular wait detected!', w/2, h - bottomMargin);
    } else if (waitingCars.length >= 2) {
        ctx.fillStyle = '#10b981';
        ctx.font = `bold ${isMobile ? 9 : (isTablet ? 11 : 14)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('✓ No cycle - System is safe', w/2, h - bottomMargin);
    }
}

function drawArrow(ctx, x1, y1, x2, y2, color, isMobile) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = isMobile ? 8 : 12;
    
    const shorten = isMobile ? 25 : 35;
    const length = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    const ratio = (length - shorten) / length;
    
    const endX = x1 + (x2 - x1) * ratio;
    const endY = y1 + (y2 - y1) * ratio;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI/6), 
              endY - headLength * Math.sin(angle - Math.PI/6));
    ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI/6), 
              endY - headLength * Math.sin(angle + Math.PI/6));
    ctx.closePath();
    ctx.fill();
}

function resetSimulation() {
    cars.forEach(car => car.element.remove());
    cars = [];
    carIdCounter = 1;
    isDeadlockDetected = false;
    setAllConditions(false);
    updateStats();
    drawRAG();
    document.getElementById('bankerDisplay').innerHTML = '<em>Run Banker\'s Algorithm to see allocation matrices...</em>';
    log('Simulation reset - All resources freed', 'info');
}

function setAllConditions(active) {
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`cond${i}`).classList.toggle('active', active);
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark');
    drawRAG();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

window.onload = init;