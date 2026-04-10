const USER_NAME = 'Svman4';

// --- 1. ΟΡΙΣΜΟΣ GLOBAL FUNCTIONS ---

global.getInfoForNeighborRoom = function (neighborRoomName, hasGCL = false, callingRoomName = 'unknown') {
    const neighborRoom = Game.rooms[neighborRoomName];

    // Αν δεν έχουμε Vision, δεν μπορούμε να κάνουμε τίποτα εδώ
    if (!neighborRoom) return false;

    if (!Memory.rooms[neighborRoomName]) Memory.rooms[neighborRoomName] = {};
    const mem = Memory.rooms[neighborRoomName];

    mem.scoutNeeded = false;
    mem.lastScouted = Game.time;

    const controller = neighborRoom.controller;

    // Α. ΕΛΕΓΧΟΣ: ΕΙΝΑΙ ΔΙΚΟ ΜΟΥ ΔΩΜΑΤΙΟ Ή RESERVED ΑΠΟ ΜΕΝΑ;
    if (controller && (controller.my || (controller.reservation && controller.reservation.username === USER_NAME))) {
        delete mem.type;
        delete mem.sources;
        delete mem.enemyInfo;
        delete mem.scoutNeeded;
        return true;
    }

    // Β. ΕΛΕΓΧΟΣ: ΕΙΝΑΙ ΕΛΕΥΘΕΡΟ (ΓΙΑ REMOTE MINING Ή CLAIM)
    let isFree = controller && !controller.owner && (!controller.reservation || controller.reservation.username === USER_NAME);

    if (isFree) {
        const sources = neighborRoom.find(FIND_SOURCES);
        if (sources.length > 0) {
            const sourcePositions = sources.map(source => ({
                id: source.id, x: source.pos.x, y: source.pos.y, roomName: source.pos.roomName
            }));

            // Αν έχουμε ελεύθερο GCL και 2 sources, το θεωρούμε στόχο για expansion
            if (sources.length >= 2 && hasGCL) {
                mem.type = 'claim_target';
            } else {
                mem.type = 'remote_mining';
            }
            mem.sources = sourcePositions;
            mem.controller = { x: controller.pos.x, y: controller.pos.y, roomName: controller.pos.roomName };
            delete mem.enemyInfo;
            return true;
        }
    }
    // Γ. ΕΛΕΓΧΟΣ: ΕΧΘΡΙΚΟ ΔΩΜΑΤΙΟ
    else if (controller) {
        mem.type = "enemyCaptured";
        const towers = neighborRoom.find(FIND_HOSTILE_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_TOWER });
        const spawns = neighborRoom.find(FIND_HOSTILE_SPAWNS);
        const walls = neighborRoom.find(FIND_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART });

        mem.enemyInfo = {
            owner: controller.owner ? controller.owner.username : 'Invader/Keeper',
            level: controller.level,
            safeMode: (controller.safeMode || 0) > 0,
            towers: towers.length,
            spawns: spawns.length,
            minWallHits: walls.length > 0 ? _.min(walls, 'hits').hits : 0,
            energyAvailable: neighborRoom.energyAvailable
        };
        return false;
    }
    return false;
};

// --- 2. ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ ---

function cleanMemoryRooms(myRoomsNames, neighborsRoomNames) {
    const validRooms = [...myRoomsNames, ...neighborsRoomNames];
    for (let roomName in Memory.rooms) {
        // Διαγράφουμε μόνο αν δεν είναι δικό μας και δεν είναι στη λίστα γειτόνων
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
        if (Game.cpu.bucket < 500) return; 

        const myRoomsName = _.filter(Game.rooms, r => r.controller && r.controller.my).map(room => room.name);
        const hasGCL = Game.gcl.level > myRoomsName.length;

        // Φάση 1: Διάβασμα αποτελεσμάτων Observer (από το προηγούμενο tick)
        this.observerRead(hasGCL);
        
        // Φάση 2: Βαριές εργασίες (Κάθε 500 ticks)
        if (Game.time % 10000 === 0) {
            const allTargets = this.getUniqueNeighbors(myRoomsName, 2);
            this.refreshQueue(allTargets);
            cleanMemoryRooms(myRoomsName, allTargets);
            if (!Memory.capital || !Game.rooms[Memory.capital]) foundNewCapital(myRoomsName);
        }
		if(Game.time%30===0 ) 
			// Φάση 3: Επιλογή επόμενου δωματίου για παρατήρηση
			this.processNextObserverTarget();
			
    },

    processNextObserverTarget: function() {
        if (!Memory.observerQueue || Memory.observerQueue.length === 0) return;

        // Round Robin: Παίρνουμε το πρώτο, το βάζουμε στο τέλος
        const targetRoomName = Memory.observerQueue.shift();
        Memory.observerQueue.push(targetRoomName);

        const observers = _.filter(Game.structures, s => s.structureType === STRUCTURE_OBSERVER && s.my);
        let observerFound = false;

        for (let obs of observers) {
            // Έλεγχος εμβέλειας (10 squares)
            if (Game.map.getRoomLinearDistance(obs.room.name, targetRoomName) <= 10) {
                if (obs.observeRoom(targetRoomName) === OK) {
                    Memory.obsTarget = targetRoomName;
                    observerFound = true;
                    break; 
                }
            }
        }

        // Αν δεν βρέθηκε observer, σήκωσε σημαία για Scout
        if (!observerFound) {
            if (!Memory.rooms[targetRoomName]) Memory.rooms[targetRoomName] = {};
            Memory.rooms[targetRoomName].scoutNeeded = true;
        }
    },

    refreshQueue: function(targets) {
        if (!Memory.observerQueue) Memory.observerQueue = [];
        targets.forEach(t => {
            if (!Memory.observerQueue.includes(t)) Memory.observerQueue.push(t);
        });
    },

    observerRead: function(hasGCL) {
        if (!Memory.obsTarget) return;
        const targetRoomName = Memory.obsTarget;
        
        // Αν το δωμάτιο είναι πλέον ορατό λόγω του observer
        if (Game.rooms[targetRoomName]) {
            global.getInfoForNeighborRoom(targetRoomName, hasGCL, 'ObserverHub');
        }
        delete Memory.obsTarget;
    },

    getUniqueNeighbors: function(myRooms, depth) {
        let nodes = new Set(myRooms);
        let currentLevel = [...myRooms];

        for (let i = 0; i < depth; i++) {
            let nextLevel = [];
            for (let roomName of currentLevel) {
                // Cache των εξόδων στη μνήμη για οικονομία CPU
                if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
                if (!Memory.rooms[roomName].neighbors) {
                    const exits = Game.map.describeExits(roomName);
                    Memory.rooms[roomName].neighbors = exits ? Object.values(exits) : [];
                }

                const neighbors = Memory.rooms[roomName].neighbors;
                for (let neighborName of neighbors) {
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
    // Αν το είδαμε πρόσφατα (π.χ. τελευταία 5000 ticks), δεν χρειάζεται scout
    if (mem.lastScouted && Game.time - mem.lastScouted < 5000) return false;
    return mem.scoutNeeded || false;
};

module.exports = expansionManager;