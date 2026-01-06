const USER_NAME = 'Svman4';

// 1. Ορισμός Global Functions
global.getInfoForNeighborRoom = function (neighborRoomName, hasGCL = false, callingRoomName = 'unknown', observerId = null) {
    const neighborRoom = Game.rooms[neighborRoomName];

    // Α. Δεν έχουμε Vision
    if (!neighborRoom) {
        // Αν υπάρχει observer, δοκίμασε να παρατηρήσεις
        if (observerId) {
            const observer = Game.getObjectById(observerId);
            if (observer && observer.observeRoom(neighborRoomName) === OK) {
                console.log(`👁️ Observer παρατήρησε δωμάτιο: ${neighborRoomName} από ${callingRoomName}`);
                // Περίμενε 1 tick για να ενημερωθεί το Game.rooms
                return 'observed';
            }
        }
        // console.log(`❌ EXPANSION: [${callingRoomName}] No vision for room ${neighborRoomName}`);
        return false;
    }
    
    // Αρχικοποίηση μνήμης αν δεν υπάρχει
    if (!Memory.rooms[neighborRoomName]) {
        Memory.rooms[neighborRoomName] = {};
    }
    const mem = Memory.rooms[neighborRoomName];
    
    // Ενημέρωση scouting info
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
                // console.log(`⛏️ EXPANSION: ${neighborRoomName} set for REMOTE MINING.`);
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

        console.log(`⚔️ INTEL: [${neighborRoomName}] Owner: ${enemyInfo.owner} | Lvl: ${enemyInfo.level} | Towers: ${enemyInfo.towers} | Walls(min): ${Math.floor(enemyInfo.minWallHits / 1000)}k`);
        return false;
    }

    return false;
};

// 2. Βοηθητικές συναρτήσεις για Observers
function getRoomObserver(roomName) {
    const room = Game.rooms[roomName];
    if (!room) return null;
    
    const observers = room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_OBSERVER }
    });
    
    return observers.length > 0 ? observers[0] : null;
}

function canObserverReach(observer, targetRoom) {
    if (!observer) return false;
    
    const observerRoom = observer.room.name;
    const range = Game.map.getRoomLinearDistance(observerRoom, targetRoom);
    
    // Ο Observer μπορεί να παρατηρήσει σε απόσταση 5 δωματίων
    return range <= 5;
}

// 3. Βοηθητικές συναρτήσεις
function getNeighborFromMyRooms(myRooms) {
    const neighbors = [];

    for (let roomName of myRooms) {
        const exits = Game.map.describeExits(roomName);
        if (exits) {
            for (let direction in exits) {
                neighbors.push(exits[direction]);
            }
        }
    }

    const uniqueNeighbors = _.uniq(neighbors);
    return _.filter(uniqueNeighbors, name => !myRooms.includes(name));
}

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

// 4. Κύριο expansion manager με Observer support
const expansionManager = {
    run: function () {
        // Εκτέλεση κάθε 50 ticks για εξοικονόμηση CPU
        if (Game.cpu.bucket < 2000 || Game.time % 50 !== 0) return;
        
        const myRoomsName = _.filter(Game.rooms, r => r.controller && r.controller.my).map(room => room.name);
        
        // Ενημέρωση γειτονικών δωματίων για κάθε δικό μας δωμάτιο
        for (let myRoomName of myRoomsName) {
            const room = Game.rooms[myRoomName];
            if (!room) continue;
            
            // Αρχικοποίηση memory για γείτονες
            if (!room.memory.neighbors) {
                const exits = Game.map.describeExits(myRoomName);
                let neig = [];
                if (exits) {
                    for (let direction in exits) {
                        neig.push(exits[direction]);
                    }
                }
                room.memory.neighbors = neig;
            }
            
            // Ελέγχουμε αν έχουμε Observer σε αυτό το δωμάτιο
            const observer = getRoomObserver(myRoomName);
            
            // Ενημέρωση γειτονικών δωματίων
            this.updateNeighborRooms(myRoomName, observer);
        }
        
        const hasGCL = Game.gcl.level > myRoomsName.length;
        const neighborRoomNames = getNeighborFromMyRooms(myRoomsName);
        
        // Ενημέρωση πρωτεύουσας
        if (!Memory.capital || !myRoomsName.includes(Memory.capital)) {
            foundNewCapital(myRoomsName);
        }
        
        // Καθαρισμός μνήμης
        cleanMemoryRooms(myRoomsName, neighborRoomNames);
    },
    
    updateNeighborRooms: function(roomName, observer) {
        const room = Game.rooms[roomName];
        if (!room) return;
        
        // ΔΙΟΡΘΩΣΗ: Βεβαιώνουμε ότι το neighbors είναι πίνακας
        let neighbors = room.memory.neighbors;
        if (!neighbors || !Array.isArray(neighbors)) {
            // Αν δεν είναι πίνακας, δημιουργούμε νέο από τα exits
            const exits = Game.map.describeExits(roomName);
            neighbors = [];
            if (exits) {
                for (let direction in exits) {
                    neighbors.push(exits[direction]);
                }
            }
            room.memory.neighbors = neighbors;
        }
        
        const hasGCL = Game.gcl.level > _.filter(Game.rooms, r => r.controller && r.controller.my).length;
        
        // Ενημέρωση κάθε γειτονικού δωματίου
        for (let neighborRoomName of neighbors) {
            // Εξασφαλίζουμε ότι το neighborRoomName είναι έγκυρο string
            if (!neighborRoomName || typeof neighborRoomName !== 'string') continue;
            
            if (!Memory.rooms[neighborRoomName]) {
                Memory.rooms[neighborRoomName] = {};
            }
            
            const mem = Memory.rooms[neighborRoomName];
            const neighborRoom = Game.rooms[neighborRoomName];
            
            // Προτεραιότητα: χρήση Observer αν υπάρχει
            if (observer && canObserverReach(observer, neighborRoomName)) {
                // Χρησιμοποιούμε observer για παρατήρηση
                const result = global.getInfoForNeighborRoom(neighborRoomName, hasGCL, roomName, observer.id);
                
                if (result === 'observed') {
                    // Το δωμάτιο παρατηρήθηκε με επιτυχία
                    mem.lastObserved = Game.time;
                    mem.scoutNeeded = false;
                    continue;
                } else if (result === true) {
                    // Έχουμε ήδη vision
                    mem.lastScouted = Game.time;
                    mem.scoutNeeded = false;
                    continue;
                }
            }
            
            // Εναλλακτικά: direct vision ή scout
            if (neighborRoom) {
                // Έχουμε άμεση πρόσβαση
                global.getInfoForNeighborRoom(neighborRoomName, hasGCL, roomName);
            } else {
                // Χρειάζεται scout μόνο αν δεν έχουμε παρατηρήσει πρόσφατα
                const lastCheck = mem.lastObserved || mem.lastScouted || 0;
                const needsScout = !lastCheck || (Game.time - lastCheck > 10000);
                
                if (needsScout && !mem.scoutNeeded) {
                    mem.scoutNeeded = true;
                    mem.scoutMethod = 'creep';
                    // console.log(`🔭 EXPANSION: requesting Scout for ${neighborRoomName} (no observer available)`);
                }
            }
        }
    }
};

// 5. Ενημέρωση spawn manager για να λαμβάνει υπόψη observers
global.shouldSendScout = function(targetRoomName) {
    // Έλεγχος αν υπάρχει observer που μπορεί να καλύψει το δωμάτιο
    const myRooms = _.filter(Game.rooms, r => r.controller && r.controller.my);
    
    for (const room of myRooms) {
        const observer = getRoomObserver(room.name);
        if (observer && canObserverReach(observer, targetRoomName)) {
            // Έχουμε observer που μπορεί να παρατηρήσει αυτό το δωμάτιο
            const mem = Memory.rooms[targetRoomName];
            if (mem && mem.lastObserved && Game.time - mem.lastObserved < 5000) {
                // Έχουμε πρόσφατη παρατήρηση
                return false;
            }
        }
    }
    
    // Χρειάζεται scout
    return true;
};

module.exports = expansionManager;