let cars = [];
let carIdCounter = 1;
let deadlockCount = 0;
let canvas, ctx;
let isDeadlockDetected = false;
let simulationMode = 'detection'; // 'detection', 'avoidance', or 'prevention'
let completedProcesses = 0;
let deniedRequests = 0;

const positions = {
    north: {
        start: { left: 46.43, top: -10.71 },
        laneBase: { left: 46.43, top: 21.43 },
        intersection: { left: 46.43, top: 46.43 },
        exit: { left: 46.43, top: 110.71 },
        resource: 'R_North',
        nextResource: 'R_East',
        offsetAxis: 'top',
        offsetDirection: -1
    },
    south: {
        start: { left: 46.43, top: 110.71 },
        laneBase: { left: 46.43, top: 78.57 },
        intersection: { left: 46.43, top: 53.57 },
        exit: { left: 46.43, top: -10.71 },
        resource: 'R_South',
        nextResource: 'R_West',
        offsetAxis: 'top',
        offsetDirection: 1
    },
    east: {
        start: { left: 110.71, top: 46.43 },
        laneBase: { left: 78.57, top: 46.43 },
        intersection: { left: 53.57, top: 46.43 },
        exit: { left: -10.71, top: 46.43 },
        resource: 'R_East',
        nextResource: 'R_South',
        offsetAxis: 'left',
        offsetDirection: 1
    },
    west: {
        start: { left: -10.71, top: 46.43 },
        laneBase: { left: 21.43, top: 46.43 },
        intersection: { left: 46.43, top: 46.43 },
        exit: { left: 110.71, top: 46.43 },
        resource: 'R_West',
        nextResource: 'R_North',
        offsetAxis: 'left',
        offsetDirection: -1
    }
};

// Define max demand for each car direction (for Banker's Algorithm)
const maxDemands = {
    north: { R_North: 1, R_South: 0, R_East: 1, R_West: 0 },
    south: { R_North: 0, R_South: 1, R_East: 0, R_West: 1 },
    east: { R_North: 0, R_South: 1, R_East: 1, R_West: 0 },
    west: { R_North: 1, R_South: 0, R_East: 0, R_West: 1 }
};

// Resource ordering for prevention (prevents circular wait)
const resourceOrder = {
    R_North: 0,
    R_East: 1,
    R_South: 2,
    R_West: 3
};

function init() {
    canvas = document.getElementById('ragCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    
    setupEventListeners();
    updateModeDisplay();
    
    log('System initialized - Deadlock Detection & Prevention Simulator', 'success');
    log('Model: Cars=Processes, Lanes=Resources (single-instance)', 'info');
    log(`Mode: ${simulationMode.toUpperCase()}`, 'info');
    updateStats();
    updateResourceStatus();
    drawRAG();
}

function setupEventListeners() {
    document.querySelectorAll('.btn-add').forEach(btn => {
        btn.addEventListener('click', function() {
            addCar(this.dataset.direction);
        });
    });

    // Mode selector buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const newMode = this.dataset.mode;
            setMode(newMode);
        });
    });

    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
    document.getElementById('detectBtn').addEventListener('click', detectDeadlock);
    document.getElementById('bankerBtn').addEventListener('click', runBankersAlgorithm);
    document.getElementById('resetBtn').addEventListener('click', resetSimulation);
    document.getElementById('advanceBtn').addEventListener('click', advanceAllCars);

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
    document.getElementById('completedCount').textContent = completedProcesses;
    document.getElementById('deniedCount').textContent = deniedRequests;
}

function updateResourceStatus() {
    const resources = ['R_North', 'R_South', 'R_East', 'R_West'];
    const html = resources.map(r => {
        const owner = cars.find(c => c.allocated === r);
        const waiters = cars.filter(c => c.requesting === r);
        
        let status = owner ? `<span style="color: #ef4444;">BUSY (${owner.id})</span>` : '<span style="color: #10b981;">FREE</span>';
        let waitList = waiters.length > 0 ? ` | Waiting: ${waiters.map(c => c.id).join(', ')}` : '';
        
        return `<div class="resource-item"><strong>${r}:</strong> ${status}${waitList}</div>`;
    }).join('');
    
    document.getElementById('resourceStatus').innerHTML = html;
}

function updateModeDisplay() {
    // Update active button
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === simulationMode) {
            btn.classList.add('active');
        }
    });
}

function setMode(newMode) {
    simulationMode = newMode;
    
    log(`🔄 Switched to ${simulationMode.toUpperCase()} mode`, 'info');
    updateModeDisplay();
    
    if (simulationMode === 'avoidance') {
        log('🟢 Banker\'s Algorithm: Checks if granting resources keeps system in safe state', 'info');
        log('Prevents deadlock by ensuring safe sequence always exists', 'info');
    } else if (simulationMode === 'prevention') {
        log('🟡 Resource Ordering Prevention: Enforces strict ordering on resource requests', 'info');
        log('Order: R_North(0) → R_East(1) → R_South(2) → R_West(3)', 'info');
        log('Eliminates Circular Wait condition - deadlock is IMPOSSIBLE by design', 'info');
    } else {
        log('🔴 Detection Mode: Allows all requests, detects cycles in RAG', 'info');
        log('Deadlock can occur - will be detected after formation', 'info');
    }
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
    
    // MODE-SPECIFIC CHECKS BEFORE ADDING
    if (simulationMode === 'avoidance') {
        // Banker's Algorithm - Check if allocation is safe
        if (!checkBankersSafety(direction)) {
            log(`❌ ${carId} request DENIED by Banker's Algorithm - Would create unsafe state`, 'error');
            deniedRequests++;
            updateStats();
            return;
        }
        log(`✅ ${carId} request APPROVED - System remains safe`, 'success');
    } else if (simulationMode === 'prevention') {
        // Resource Ordering: Check if this maintains order
        if (!checkResourceOrdering(direction)) {
            log(`❌ ${carId} request DENIED by Resource Ordering - Would violate order constraint`, 'error');
            log(`Hint: Resources must be requested in order: R_North(0) → R_East(1) → R_South(2) → R_West(3)`, 'warning');
            log(`Prevention ensures circular wait CANNOT occur by design`, 'info');
            deniedRequests++;
            updateStats();
            return;
        }
        log(`✅ ${carId} request APPROVED - Maintains resource ordering`, 'success');
    }
    
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
        maxDemand: { ...maxDemands[direction] },
        laneIndex: laneIndex,
        timestamp: Date.now()
    };

    cars.push(carObj);
    log(`${carId} created - Requesting ${positions[direction].resource}`, 'info');
    
    updateStats();
    updateResourceStatus();

    setTimeout(() => moveCar(carObj, 'lane'), 500);
}

// Banker's Algorithm safety check
function checkBankersSafety(direction) {
    // Create a hypothetical scenario where this new car gets its FIRST resource
    const hypotheticalCars = cars.map(c => ({
        id: c.id,
        direction: c.direction,
        allocated: c.allocated,
        requesting: c.requesting,
        maxDemand: { ...c.maxDemand },
        state: c.state
    }));
    
    // Add the new car with ONLY first resource allocated
    const newCar = {
        id: `P${carIdCounter}`,
        direction: direction,
        allocated: positions[direction].resource,
        requesting: positions[direction].nextResource,
        maxDemand: { ...maxDemands[direction] },
        state: 'waiting'
    };
    
    hypotheticalCars.push(newCar);
    
    // Check if a safe sequence exists with this allocation
    const safeSeq = findSafeSequence(hypotheticalCars);
    
    if (safeSeq === null) {
        log(`Banker's Analysis: No safe sequence exists if ${newCar.id} is added`, 'warning');
        return false;
    }
    
    log(`Banker's Analysis: Safe sequence exists: ${safeSeq.join(' → ')}`, 'success');
    return true;
}

function checkResourceOrdering(direction) {
    const requestedResource = positions[direction].resource;
    const requestedOrder = resourceOrder[requestedResource];
    const nextResource = positions[direction].nextResource;
    const nextOrder = resourceOrder[nextResource];
    
    // Rule 1: Check if the new car itself would violate ordering
    // A car requesting resources in DECREASING order violates the rule
    if (requestedOrder > nextOrder) {
        log(`❌ Resource ordering violation: ${requestedResource}(${requestedOrder}) → ${nextResource}(${nextOrder})`, 'error');
        log(`Cannot request lower-numbered resource after higher-numbered resource`, 'error');
        return false;
    }
    
    // Rule 2: Check for potential circular wait with existing processes
    // We need to ensure the new process doesn't create a cycle
    for (const car of cars) {
        if (car.allocated && car.requesting) {
            const carAllocatedOrder = resourceOrder[car.allocated];
            const carRequestingOrder = resourceOrder[car.requesting];
            
            // Check if existing car + new car could form circular wait
            // Case 1: Existing car holds lower, wants higher (correct)
            if (carAllocatedOrder < carRequestingOrder) {
                // New car should not want what existing car holds AND hold what existing car wants
                if (nextOrder === carAllocatedOrder && requestedOrder === carRequestingOrder) {
                    log(`❌ Would create circular wait with ${car.id}`, 'error');
                    log(`${car.id}: ${car.allocated}(${carAllocatedOrder}) → ${car.requesting}(${carRequestingOrder})`, 'error');
                    return false;
                }
            }
            // Case 2: Existing car violates ordering (holds higher, wants lower)
            else if (carAllocatedOrder > carRequestingOrder) {
                // System already has an ordering violation - be very strict
                log(`⚠️  Warning: ${car.id} already violates ordering`, 'warning');
                
                // Don't allow new car if it could complete a cycle
                if ((requestedOrder < carRequestingOrder && nextOrder > carAllocatedOrder) ||
                    (requestedOrder > carRequestingOrder && requestedOrder < carAllocatedOrder)) {
                    log(`❌ Would complete circular wait with ${car.id}`, 'error');
                    return false;
                }
            }
        }
    }
    
    // Rule 3: Check against all currently held resources
    const heldResources = cars
        .filter(c => c.allocated)
        .map(c => ({ id: c.id, resource: c.allocated, order: resourceOrder[c.allocated] }));
    
    // If new car wants a resource with lower order than any held resource,
    // and that car might later want what we hold, it could deadlock
    for (const held of heldResources) {
        if (nextOrder < held.order && requestedOrder > held.order) {
            const holdingCar = cars.find(c => c.id === held.id);
            if (holdingCar && holdingCar.requesting) {
                const holderWantsOrder = resourceOrder[holdingCar.requesting];
                if (holderWantsOrder === requestedOrder || holderWantsOrder === nextOrder) {
                    log(`❌ Circular wait risk with ${held.id} holding ${held.resource}`, 'error');
                    return false;
                }
            }
        }
    }
    
    log(`✅ Resource ordering maintained: ${requestedResource}(${requestedOrder}) → ${nextResource}(${nextOrder})`, 'success');
    return true;
}

function findSafeSequence(carsList) {
    const waitingCars = carsList.filter(c => c.state === 'waiting' || c.state === 'approaching');
    if (waitingCars.length === 0) return [];
    
    const resources = ['R_North', 'R_South', 'R_East', 'R_West'];
    const totalResources = { R_North: 1, R_South: 1, R_East: 1, R_West: 1 };
    
    // Calculate allocation matrix
    const allocation = {};
    waitingCars.forEach(p => {
        allocation[p.id] = { R_North: 0, R_South: 0, R_East: 0, R_West: 0 };
        if (p.allocated) {
            allocation[p.id][p.allocated] = 1;
        }
    });
    
    // Calculate need matrix
    const need = {};
    waitingCars.forEach(p => {
        need[p.id] = { R_North: 0, R_South: 0, R_East: 0, R_West: 0 };
        resources.forEach(r => {
            need[p.id][r] = p.maxDemand[r] - allocation[p.id][r];
        });
    });
    
    // Calculate available
    const available = { ...totalResources };
    waitingCars.forEach(p => {
        resources.forEach(r => {
            available[r] -= allocation[p.id][r];
        });
    });
    
    // Find safe sequence using Banker's Algorithm
    const safeSequence = [];
    const finished = new Set();
    const work = { ...available };
    
    let found = true;
    let iterations = 0;
    
    while (finished.size < waitingCars.length && found && iterations < 100) {
        found = false;
        iterations++;
        
        for (const p of waitingCars) {
            if (finished.has(p.id)) continue;
            
            // Check if this process can finish with available resources
            let canFinish = true;
            for (const res of resources) {
                if (need[p.id][res] > work[res]) {
                    canFinish = false;
                    break;
                }
            }
            
            if (canFinish) {
                // This process can complete, release its resources
                for (const res of resources) {
                    work[res] += allocation[p.id][res];
                }
                
                safeSequence.push(p.id);
                finished.add(p.id);
                found = true;
                break;
            }
        }
    }
    
    return safeSequence.length === waitingCars.length ? safeSequence : null;
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
        updateResourceStatus();
    } else if (position === 'intersection') {
        carObj.state = 'running';
        log(`${carObj.id} crossing intersection`, 'info');
    }
    
    drawRAG();
}

function advanceAllCars() {
    log('=== Attempting to advance all waiting cars ===', 'info');
    
    const waitingCars = cars.filter(c => c.state === 'waiting');
    
    if (waitingCars.length === 0) {
        log('No cars waiting to advance', 'info');
        return;
    }
    
    let advanced = false;
    
    for (const car of waitingCars) {
        if (tryAdvanceCar(car)) {
            advanced = true;
        }
    }
    
    if (!advanced) {
        log('No cars can advance - all waiting for allocated resources', 'warning');
        log('This may indicate deadlock. Run detection to verify.', 'warning');
    }
    
    updateResourceStatus();
}

function tryAdvanceCar(carObj) {
    if (carObj.state !== 'waiting') return false;
    
    // Check if requested resource is available
    const resourceOwner = cars.find(c => 
        c.allocated === carObj.requesting && c.id !== carObj.id
    );
    
    if (!resourceOwner) {
        // In avoidance mode, check safety before granting second resource
        if (simulationMode === 'avoidance') {
            // Simulate granting this resource
            const testCars = cars.map(c => {
                if (c.id === carObj.id) {
                    return {
                        ...c,
                        allocated: carObj.requesting, // Now has both resources (will release first)
                        requesting: null,
                        state: 'waiting'
                    };
                }
                return { ...c };
            });
            
            const safeSeq = findSafeSequence(testCars);
            if (safeSeq === null) {
                log(`❌ Cannot grant ${carObj.requesting} to ${carObj.id} - Would create unsafe state`, 'error');
                return false;
            }
            log(`✅ Granting ${carObj.requesting} to ${carObj.id} - System remains safe`, 'success');
        }
        
        // Resource available! Grant it
        log(`${carObj.id} granted ${carObj.requesting}`, 'success');
        
        const oldResource = carObj.allocated;
        carObj.allocated = carObj.requesting;
        carObj.requesting = null;
        
        // Move through intersection
        moveCar(carObj, 'intersection');
        
        // Complete and exit after crossing
        setTimeout(() => {
            completeCar(carObj);
        }, 1500);
        
        return true;
    }
    
    return false;
}

function completeCar(carObj) {
    log(`${carObj.id} completed journey - Releasing all resources`, 'success');
    
    carObj.element.style.transition = 'all 0.8s ease';
    const intersection = document.getElementById('intersection');
    const containerWidth = intersection.offsetWidth;
    const exitPos = positions[carObj.direction].exit;
    
    carObj.element.style.left = (exitPos.left / 100 * containerWidth) + 'px';
    carObj.element.style.top = (exitPos.top / 100 * containerWidth) + 'px';
    
    setTimeout(() => {
        carObj.element.remove();
        cars = cars.filter(c => c.id !== carObj.id);
        completedProcesses++;
        
        updateStats();
        updateResourceStatus();
        drawRAG();
        
        // Check if deadlock is resolved
        const stillDeadlocked = checkCircularWait();
        if (!stillDeadlocked && isDeadlockDetected) {
            isDeadlockDetected = false;
            log('✅ Deadlock resolved!', 'success');
            cars.forEach(c => c.element.classList.remove('deadlocked'));
        }
        
        updateDeadlockConditions();
        
        // Try to advance other waiting cars
        const waitingCars = cars.filter(c => c.state === 'waiting');
        waitingCars.forEach(tryAdvanceCar);
    }, 800);
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

    log('=== DEADLOCK DETECTION (RAG Cycle Detection) ===', 'info');

    const hasCircular = checkCircularWait();

    if (hasCircular) {
        if (!isDeadlockDetected) {
            isDeadlockDetected = true;
            deadlockCount++;
            updateStats();
        }
        
        log('🔴 DEADLOCK DETECTED!', 'error');
        log('All 4 Coffman Conditions Satisfied:', 'error');
        log('  1. Mutual Exclusion: ✓ Resources are single-instance', 'error');
        log('  2. Hold & Wait: ✓ Processes hold while requesting', 'error');
        log('  3. No Preemption: ✓ Cannot forcefully take resources', 'error');
        log('  4. Circular Wait: ✓ Cycle detected in RAG', 'error');
        
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
        log('✅ No deadlock detected - No cycle in RAG', 'success');
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
    log('=== BANKER\'S ALGORITHM (Deadlock Avoidance) ===', 'success');
    log('Note: This analyzes the CURRENT state for safety', 'info');
    
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
        max[p.id] = { ...p.maxDemand };
        need[p.id] = { R_North: 0, R_South: 0, R_East: 0, R_West: 0 };

        if (p.allocated) {
            allocation[p.id][p.allocated] = 1;
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

    displayBankerMatrices(processes, allocation, max, need, available, totalResources);

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
    }

    if (safeSequence.length === processes.length) {
        log(`✅ SAFE STATE: Sequence found: ${safeSequence.join(' → ')}`, 'success');
        log('In avoidance mode, this allocation would be ALLOWED', 'success');
        
        const execute = confirm('Execute this safe sequence? (Will complete processes in order)');
        if (execute) {
            log('Executing safe sequence...', 'info');
            for (const pid of safeSequence) {
                await sleep(1500);
                const car = cars.find(c => c.id === pid);
                if (car) {
                    completeCar(car);
                    await sleep(500);
                }
            }
            log('✅ All processes completed safely!', 'success');
        }
    } else {
        log('❌ UNSAFE STATE: No safe sequence exists', 'error');
        log('System is in an UNSAFE state - Deadlock possible!', 'error');
        log(`Only ${safeSequence.length} of ${processes.length} processes can complete`, 'error');
        if (safeSequence.length > 0) {
            log(`Partial sequence: ${safeSequence.join(' → ')}`, 'warning');
        }
        log('In avoidance mode, this allocation would have been PREVENTED', 'error');
    }
}

function displayBankerMatrices(processes, allocation, max, need, available, total) {
    const resources = ['R_N', 'R_S', 'R_E', 'R_W'];
    const fullResources = ['R_North', 'R_South', 'R_East', 'R_West'];
    
    let html = '<strong>MAX MATRIX (Declared Requirements):</strong><table class="matrix-table"><tr><th>Process</th>';
    resources.forEach(r => html += `<th>${r}</th>`);
    html += '</tr>';
    
    processes.forEach(p => {
        html += `<tr><td><strong>${p.id}</strong></td>`;
        fullResources.forEach(r => {
            html += `<td>${max[p.id][r]}</td>`;
        });
        html += '</tr>';
    });
    html += '</table>';

    html += '<br><strong>ALLOCATION MATRIX (Currently Held):</strong><table class="matrix-table"><tr><th>Process</th>';
    resources.forEach(r => html += `<th>${r}</th>`);
    html += '</tr>';
    
    processes.forEach(p => {
        html += `<tr><td><strong>${p.id}</strong></td>`;
        fullResources.forEach(r => {
            html += `<td>${allocation[p.id][r]}</td>`;
        });
        html += '</tr>';
    });
    html += '</table>';

    html += '<br><strong>NEED MATRIX (Still Required):</strong><table class="matrix-table"><tr><th>Process</th>';
    resources.forEach(r => html += `<th>${r}</th>`);
    html += '</tr>';
    
    processes.forEach(p => {
        html += `<tr><td><strong>${p.id}</strong></td>`;
        fullResources.forEach(r => {
            html += `<td>${need[p.id][r]}</td>`;
        });
        html += '</tr>';
    });
    html += '</table>';

    html += '<br><strong>AVAILABLE VECTOR:</strong><table class="matrix-table"><tr>';
    resources.forEach(r => html += `<th>${r}</th>`);
    html += '</tr><tr>';
    fullResources.forEach(r => {
        html += `<td><strong>${available[r]}</strong></td>`;
    });
    html += '</tr></table>';

    document.getElementById('bankerDisplay').innerHTML = html;
}

function drawRAG(showDeadlock = null) {
    if (showDeadlock === null) {
        showDeadlock = isDeadlockDetected;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const w = canvas.width;
    const h = canvas.height;
    const isDark = document.body.classList.contains('dark');
    
    const isMobile = w < 500;
    const isTablet = w >= 500 && w < 768;
    
    const titleSize = isMobile ? 11 : (isTablet ? 13 : 16);
    const legendSize = isMobile ? 8 : (isTablet ? 9 : 12);
    const resourceSize = isMobile ? 35 : (isTablet ? 50 : 60);
    const processRadius = isMobile ? 16 : (isTablet ? 20 : 25);
    const spacing = isMobile ? Math.min(w, h) * 0.22 : (isTablet ? 120 : 150);
    const circleRadius = isMobile ? Math.min(w, h) * 0.28 : (isTablet ? 140 : 180);
    
    ctx.fillStyle = isDark ? '#e0e0e0' : '#1a1a1a';
    ctx.font = `bold ${titleSize}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText('Resource Allocation Graph', 10, titleSize + 5);
    
    ctx.font = `${legendSize}px Arial`;
    ctx.fillStyle = isDark ? '#9ca3af' : '#6b7280';
    if (isMobile) {
        ctx.fillText('○ Process | □ Resource', 10, titleSize + legendSize + 10);
        ctx.fillText('── Allocated | ··· Requesting', 10, titleSize + legendSize * 2 + 14);
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

    const resourcePos = {
        R_North: { x: w/2 - spacing, y: h/2 - spacing, color: '#3b82f6' },
        R_East: { x: w/2 + spacing, y: h/2 - spacing, color: '#10b981' },
        R_South: { x: w/2 + spacing, y: h/2 + spacing, color: '#ef4444' },
        R_West: { x: w/2 - spacing, y: h/2 + spacing, color: '#f59e0b' }
    };

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

    // Draw edges - Allocated (solid) - GREEN
    ctx.lineWidth = isMobile ? 1.5 : 2;
    waitingCars.forEach(car => {
        if (car.allocated && resourcePos[car.allocated] && processPos[car.id]) {
            const rPos = resourcePos[car.allocated];
            const pPos = processPos[car.id];
            
            ctx.strokeStyle = '#10b981';
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(rPos.x, rPos.y);
            ctx.lineTo(pPos.x, pPos.y);
            ctx.stroke();
            drawArrow(ctx, rPos.x, rPos.y, pPos.x, pPos.y, '#10b981', isMobile);
        }
    });

    // Draw edges - Requesting (dashed) - RED
    waitingCars.forEach(car => {
        if (car.requesting && resourcePos[car.requesting] && processPos[car.id]) {
            const pPos = processPos[car.id];
            const rPos = resourcePos[car.requesting];
            
            ctx.strokeStyle = '#ef4444';
            ctx.setLineDash(isMobile ? [5, 3] : [8, 4]);
            ctx.beginPath();
            ctx.moveTo(pPos.x, pPos.y);
            ctx.lineTo(rPos.x, rPos.y);
            ctx.stroke();
            drawArrow(ctx, pPos.x, pPos.y, rPos.x, rPos.y, '#ef4444', isMobile);
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
        ctx.fillText('✅ No cycle - System is safe', w/2, h - bottomMargin);
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
    completedProcesses = 0;
    deniedRequests = 0;
    isDeadlockDetected = false;
    setAllConditions(false);
    updateStats();
    updateResourceStatus();
    drawRAG();
    document.getElementById('bankerDisplay').innerHTML = '<em>Run Banker\'s Algorithm to see allocation matrices...</em>';
    log('Simulation reset - All resources freed', 'info');
    log(`Mode: ${simulationMode.toUpperCase()}`, 'info');
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