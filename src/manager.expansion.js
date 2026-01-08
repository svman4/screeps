const USER_NAME = 'Svman4';

// --- 1. ΟΡΙΣΜΟΣ GLOBAL FUNCTIONS (Πρέπει να είναι πρώτα στο αρχείο) ---

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

    if (!Memory.rooms[neighborRoomName]) Memory.rooms[neighborRoomName] = {};
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

    // Γ. ΕΛΕΓΧΟΣ: ΕΙΝΑΙ ΕΛΕΥΘΕΡΟ
    let isFree = controller && !controller.owner && (!controller.reservation || controller.reservation.username === USER_NAME);

    if (isFree) {
        const sources = neighborRoom.find(FIND_SOURCES);
        if (sources.length > 0) {
            const sourcePositions = sources.map(source => ({
                id: source.id, x: source.pos.x, y: source.pos.y, roomName: source.pos.roomName
            }));

            if (sources.length >= 2 && hasGCL) {
                mem.type = 'claim_target';
                mem.sources = sourcePositions;
            } else {
                mem.type = 'remote_mining';
                mem.sources = sourcePositions;
            }

            mem.controller = { x: controller.pos.x, y: controller.pos.y, roomName: controller.pos.roomName };
            delete mem.enemyInfo;
            return true;
        }
    }
    // Δ. ΕΛΕΓΧΟΣ: ΕΧΘΡΙΚΟ
    else if (controller) {
        mem.type = "enemyCaptured";
        const towers = neighborRoom.find(FIND_HOSTILE_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_TOWER });
        const spawns = neighborRoom.find(FIND_HOSTILE_SPAWNS);
        const walls = neighborRoom.find(FIND_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART });

        mem.enemyInfo = {
            owner: controller.owner ? controller.owner.username : 'Invader/Keeper',
            level: controller.level,
            safeMode: controller.safeMode > 0,
            towers: towers.length,
            spawns: spawns.length,
            minWallHits: walls.length > 0 ? _.min(walls, 'hits').hits : 0,
            energyAvailable: neighborRoom.energyAvailable
        };
        return false;
    }
    return false;
};

// --- 2. ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ (Local) ---

function cleanMemoryRooms(myRoomsNames, neighborsRoomNames) {
    const validRooms = [...myRoomsNames, ...neighborsRoomNames];
    for (let roomName in Memory.rooms) {
        if (!validRooms.includes(roomName) && !myRoomsNames.includes(roomName)) {
            delete Memory.rooms[roomName];
        }
    }
}

function foundNewCapital(myRoomsNames) {
    if (myRoomsNames.length === 0) return null;
    const rooms = myRoomsNames.map(name => Game.rooms[name]).filter(r => r && r.controller);
    const bestRoom = _.sortBy(rooms, [
        (r) => -r.controller.level,
        (r) => -(r.storage ? r.storage.store.getUsedCapacity() : 0)
    ])[0];

    if (bestRoom) {
        Memory.capital = bestRoom.name;
        return bestRoom.name;
    }
    return null;
}

// --- 3. ΤΟ ΑΝΤΙΚΕΙΜΕΝΟ EXPANSION MANAGER ---

const expansionManager = {
    run: function () {
        if (Game.cpu.bucket < 500) return; // Πιο χαμηλό όριο για ασφάλεια

        const myRoomsName = _.filter(Game.rooms, r => r.controller && r.controller.my).map(room => room.name);
        const hasGCL = Game.gcl.level > myRoomsName.length;

        // Φάση 1: Διάβασμα αποτελεσμάτων Observer από το προηγούμενο Tick
        this.observerRead(hasGCL);

        // Φάση 2: Βαριές εργασίες κάθε 200 ticks
        if (Game.time % 500 === 0) {
            const allTargets = this.getUniqueNeighbors(myRoomsName, 2);
            this.refreshQueue(allTargets);
            cleanMemoryRooms(myRoomsName, allTargets);
            if (!Memory.capital || !Game.rooms[Memory.capital]) foundNewCapital(myRoomsName);
        }

        // Φάση 3: Εντολή στον Observer για το επόμενο Tick
        this.observerRequest();
    },

    refreshQueue: function(targets) {
        if (!Memory.observerQueue) Memory.observerQueue = [];
        // Προσθήκη νέων δωματίων που δεν υπάρχουν στην ουρά
        targets.forEach(t => {
            if (!Memory.observerQueue.includes(t)) Memory.observerQueue.push(t);
        });
    },

    observerRead: function(hasGCL) {
        if (!Memory.obsTarget) return;
        
        const targetRoomName = Memory.obsTarget;
        if (Game.rooms[targetRoomName]) {
            global.getInfoForNeighborRoom(targetRoomName, hasGCL, 'ObserverHub');
         //   console.log(`✅ Intel updated via Observer for: ${targetRoomName}`);
        }
        delete Memory.obsTarget;
    },

    observerRequest: function() {
        if (!Memory.observerQueue || Memory.observerQueue.length === 0) return;

        const observers = _.filter(Game.structures, s => s.structureType === STRUCTURE_OBSERVER && s.my);
        if (observers.length === 0) return;

        // Παίρνουμε το πρώτο από την ουρά και το βάζουμε στο τέλος (Round Robin)
        const targetRoomName = Memory.observerQueue.shift();
        Memory.observerQueue.push(targetRoomName);

        for (let obs of observers) {
            if (Game.map.getRoomLinearDistance(obs.room.name, targetRoomName) <= 10) {
                if (obs.observeRoom(targetRoomName) === OK) {
                    Memory.obsTarget = targetRoomName;
                    break;
                }
            }
        }
    },

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
        return [...nodes].filter(name => !myRooms.includes(name));
    }
};

// --- 4. EXPORTS ---

global.shouldSendScout = function(targetRoomName) {
    const mem = Memory.rooms[targetRoomName];
    if (!mem) return true;
    if (mem.lastObserved && Game.time - mem.lastObserved < 5000) return false;
    return mem.scoutNeeded;
};

module.exports = expansionManager;