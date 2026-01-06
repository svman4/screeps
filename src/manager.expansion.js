const USER_NAME = 'Svman4';

// 1. Ορισμός Global Functions
global.getInfoForNeighborRoom = function (neighborRoomName, hasGCL = false, callingRoomName = 'unknown', observerId = null) {
    const neighborRoom = Game.rooms[neighborRoomName];

    // Α. Δεν έχουμε Vision
    if (!neighborRoom) {
        if (observerId) {
            const observer = Game.getObjectById(observerId);
            if (observer && observer.observeRoom(neighborRoomName) === OK) {
                console.log(`👁️ Observer παρατήρησε δωμάτιο: ${neighborRoomName} από ${callingRoomName}`);
                return 'observed';
            }
        }
        return false;
    }
    
    if (!Memory.rooms[neighborRoomName]) {
        Memory.rooms[neighborRoomName] = {};
    }
    const mem = Memory.rooms[neighborRoomName];
    
    mem.scoutNeeded = false;
    mem.lastScouted = Game.time;
    mem.scoutMethod = observerId ? 'observer' : 'direct';

    const controller = neighborRoom.controller;

    // Β. ΕΛΕΓΧΟΣ: ΕΙΝΑΙ ΔΙΚΟ ΜΟΥ ΔΩΜΑΤΙΟ;
    if (controller && (controller.my || (controller.reservation && controller.reservation.username === USER_NAME))) {
        delete mem.type;
        delete mem.sources;
        delete mem.enemyInfo;
        delete mem.scoutNeeded;
        return true;
    }

    // Γ. ΕΛΕΓΧΟΣ: ΕΙΝΑΙ ΕΛΕΥΘΕΡΟ (Για Expansion/Remote);
    let isFree = controller && !controller.owner &&
        (!controller.reservation || controller.reservation.username === USER_NAME);

    if (isFree) {
        const sources = neighborRoom.find(FIND_SOURCES);
        if (sources.length > 0) {
            const sourcePositions = sources.map(source => ({
                id: source.id,
                x: source.pos.x,
                y: source.pos.y,
                roomName: source.pos.roomName
            }));

            if (sources.length >= 2 && hasGCL) {
                mem.type = 'claim_target';
                mem.sources = sourcePositions;
                console.log(`🚩 EXPANSION: Target ${neighborRoomName} free for CLAIMING.`);
            } else {
                mem.type = 'remote_mining';
                mem.sources = sourcePositions;
            }

            mem.controller = {
                x: controller.pos.x,
                y: controller.pos.y,
                roomName: controller.pos.roomName
            };

            delete mem.enemyInfo;
            return true;
        }
    }
    
    // Δ. ΕΛΕΓΧΟΣ: ΕΧΘΡΙΚΟ / ΚΑΤΕΙΛΗΜΜΕΝΟ
    else if (controller) {
        mem.type = "enemyCaptured";

        const enemyInfo = {
            owner: controller.owner ? controller.owner.username : 'Invader/Keeper',
            level: controller.level,
            safeMode: controller.safeMode > 0,
            safeModeCooldown: controller.safeModeCooldown || 0,
            towers: 0,
            spawns: 0,
            minWallHits: 0,
            energyAvailable: neighborRoom.energyAvailable
        };

        const towers = neighborRoom.find(FIND_HOSTILE_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_TOWER
        });
        enemyInfo.towers = towers.length;

        const spawns = neighborRoom.find(FIND_HOSTILE_SPAWNS);
        enemyInfo.spawns = spawns.length;

        const walls = neighborRoom.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART
        });

        if (walls.length > 0) {
            enemyInfo.minWallHits = _.min(walls, 'hits').hits;
        }

        mem.enemyInfo = enemyInfo;
        console.log(`⚔️ INTEL: [${neighborRoomName}] Owner: ${enemyInfo.owner} | Lvl: ${enemyInfo.level} | Towers: ${enemyInfo.towers}`);
        return false;
    }

    return false;
};

// 2. Βοηθητικές συναρτήσεις
function cleanMemoryRooms(myRoomsNames, neighborsRoomNames) {
    const validRooms = [...myRoomsNames, ...neighborsRoomNames];
    for (let roomName in Memory.rooms) {
        if (!validRooms.includes(roomName)) {
            delete Memory.rooms[roomName];
        }
    }
}

function foundNewCapital(myRoomsNames) {
    if (myRoomsNames.length === 0) return null;
    const rooms = myRoomsNames.map(name => Game.rooms[name]).filter(r => r && r.controller);
    const bestRoom = _.sortBy(rooms, [
        (r) => -r.controller.level,
        (r) => -(r.storage ? r.storage.store.getUsedCapacity() : 0),
        (r) => -r.energyAvailable
    ])[0];

    if (bestRoom) {
        Memory.capital = bestRoom.name;
        return bestRoom.name;
    }
    return null;
}

// 4. Κύριο expansion manager
const expansionManager = {
    run: function () {
        // Εκτέλεση κάθε 50 ticks
        if (Game.cpu.bucket < 2000 || Game.time % 50 !== 0) return;
        
        const myRoomsName = _.filter(Game.rooms, r => r.controller && r.controller.my).map(room => room.name);
        
        // Βρίσκουμε όλους τους γείτονες σε ακτίνα 2 (BFS) - καλύπτει όλες τις κατευθύνσεις
        const allTargets = this.getUniqueNeighbors(myRoomsName, 2);
        const hasGCL = Game.gcl.level > myRoomsName.length;

        // Διαχείριση Observer
        this.processObserverQueue(allTargets, hasGCL);

        // Ενημέρωση πρωτεύουσας
        if (!Memory.capital || !myRoomsName.includes(Memory.capital)) {
            foundNewCapital(myRoomsName);
        }

        // Καθαρισμός μνήμης
        cleanMemoryRooms(myRoomsName, allTargets);
    },

    // Σάρωση δωματίων προς όλες τις κατευθύνσεις (Breadth-First Search)
    getUniqueNeighbors: function(myRooms, depth) {
        let nodes = new Set(myRooms);
        let currentLevel = [...myRooms];

        for (let i = 0; i < depth; i++) {
            let nextLevel = [];
            for (let roomName of currentLevel) {
                const exits = Game.map.describeExits(roomName);
                if (!exits) continue;
                for (let dir in exits) {
                    const neighborName = exits[dir];
                    if (!nodes.has(neighborName)) {
                        nodes.add(neighborName);
                        nextLevel.push(neighborName);
                    }
                }
            }
            currentLevel = nextLevel;
        }
        // Επιστρέφουμε μόνο τα δωμάτια που ΔΕΝ είναι δικά μας
        return [...nodes].filter(name => !myRooms.includes(name));
    },

    processObserverQueue: function(targets, hasGCL) {
        if (targets.length === 0) return;

        const observers = _.filter(Game.structures, s => s.structureType === STRUCTURE_OBSERVER && s.my);
        
        // Round Robin: Κάθε tick διαλέγουμε ένα διαφορετικό δωμάτιο από τη λίστα targets
        // Χρησιμοποιούμε το Game.time για να εναλλάσσονται οι στόχοι αυτόματα
        let targetIndex = Game.time % targets.length;
        let targetRoomName = targets[targetIndex];

        if (observers.length > 0) {
            for (let obs of observers) {
                // Έλεγχος αν ο συγκεκριμένος observer φτάνει το δωμάτιο (range 10)
                if (Game.map.getRoomLinearDistance(obs.room.name, targetRoomName) <= 10) {
                    const result = global.getInfoForNeighborRoom(targetRoomName, hasGCL, obs.room.name, obs.id);
                    if (result === 'observed') {
                        if (!Memory.rooms[targetRoomName]) Memory.rooms[targetRoomName] = {};
                        Memory.rooms[targetRoomName].lastObserved = Game.time;
                        // Μόλις ένας observer αναλάβει το τρέχον target, σταματάμε για αυτό το tick
                        break; 
                    }
                }
            }
        }
        
        // Παράλληλα, για όλα τα targets, ελέγχουμε αν υπάρχει ήδη Vision (π.χ. από creeps)
        // ή αν πρέπει να ζητηθεί physical scout
        for (let tName of targets) {
            this.simpleScoutCheck(tName, hasGCL);
        }
    },

    simpleScoutCheck: function(targetRoomName, hasGCL) {
        const neighborRoom = Game.rooms[targetRoomName];
        if (neighborRoom) {
            // Έχουμε ήδη vision, τρέξε την ενημέρωση πληροφοριών
            global.getInfoForNeighborRoom(targetRoomName, hasGCL);
        } else {
            const mem = Memory.rooms[targetRoomName] || {};
            const lastCheck = mem.lastObserved || mem.lastScouted || 0;
            // Αν το δωμάτιο είναι "σκοτεινό" για πάνω από 10.000 ticks, ζήτα creep
            if (Game.time - lastCheck > 10000 && !mem.scoutNeeded) {
                if (!Memory.rooms[targetRoomName]) Memory.rooms[targetRoomName] = {};
                Memory.rooms[targetRoomName].scoutNeeded = true;
            }
        }
    }
};

// 5. Ενημέρωση spawn manager
global.shouldSendScout = function(targetRoomName) {
    const mem = Memory.rooms[targetRoomName];
    if (!mem) return true;
    
    // Αν παρατηρήθηκε πρόσφατα μέσω Observer, δεν στέλνουμε scout
    if (mem.lastObserved && Game.time - mem.lastObserved < 5000) return false;
    
    return mem.scoutNeeded;
};

module.exports = expansionManager;