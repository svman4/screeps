const USER_NAME = 'Svman4';

// 1. Ορισμός της Global Function (Πρώτα, ώστε να είναι διαθέσιμη)
global.getInfoForNeighborRoom = function (neighborRoomName, hasGCL = false, callingRoomName = 'unknown') {
    const neighborRoom = Game.rooms[neighborRoomName];

    // Α. Δεν έχουμε Vision
    if (!neighborRoom) {
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

    const controller = neighborRoom.controller;

    // Β. ΕΛΕΓΧΟΣ: ΕΙΝΑΙ ΔΙΚΟ ΜΟΥ ΔΩΜΑΤΙΟ;
    // Αν το δωμάτιο ανήκει στον Svman4 (είτε έχει controller, είτε είναι reserved από σένα)
    if (controller && (controller.my || (controller.reservation && controller.reservation.username === USER_NAME))) {
        // Καθαρισμός περιττών δεδομένων expansion/επίθεσης
        delete mem.type;
        delete mem.sources;
        delete mem.enemyInfo;
        delete mem.scoutNeeded;
        // Αν θες να κρατήσεις κάτι, μπορείς να βάλεις mem.type = 'owned';
        return true;
    }

    // Γ. ΕΛΕΓΧΟΣ: ΕΙΝΑΙ ΕΛΕΥΘΕΡΟ (Για Expansion/Remote);
    let isFree = controller && !controller.owner &&
        (!controller.reservation || controller.reservation.username === USER_NAME); // (Το reservation check εδώ είναι τυπικό, το καλύψαμε πάνω, αλλά ασφαλές)

    if (isFree) {
        const sources = neighborRoom.find(FIND_SOURCES);
        if (sources.length > 0) {
            // Serialize source positions
            const sourcePositions = sources.map(source => ({
                id: source.id,
                x: source.pos.x,
                y: source.pos.y,
                roomName: source.pos.roomName
            }));

            // Λογική Expansion vs Remote Mining
            if (sources.length >= 2 && hasGCL) {
                mem.type = 'claim_target';
                mem.sources = sourcePositions;
                console.log(`🚩 EXPANSION:  Target ${neighborRoomName} free for CLAIMING.`);
            } else {
                mem.type = 'remote_mining';
                mem.sources = sourcePositions;
                // console.log(`⛏️ EXPANSION: ${neighborRoomName} set for REMOTE MINING.`);
            }

            // Αποθήκευση θέσης controller
            mem.controller = {
                x: controller.pos.x,
                y: controller.pos.y,
                roomName: controller.pos.roomName
            };

            // Καθαρισμός τυχόν παλιών enemy info
            delete mem.enemyInfo;

            return true;
        }
    }
    // Δ. ΕΛΕΓΧΟΣ: ΕΧΘΡΙΚΟ / ΚΑΤΕΙΛΗΜΜΕΝΟ
    else if (controller) {
        mem.type = "enemyCaptured";

        // --- MILITARY INTEL (Συλλογή Πληροφοριών για Επίθεση) ---
        const enemyInfo = {
            owner: controller.owner ? controller.owner.username : 'Invader/Keeper',
            level: controller.level,
            safeMode: controller.safeMode > 0, // True αν είναι ενεργό
            safeModeCooldown: controller.safeModeCooldown || 0,
            towers: 0,
            spawns: 0,
            minWallHits: 0,
            energyAvailable: neighborRoom.energyAvailable
        };

        // Μέτρηση Αμυνών
        const towers = neighborRoom.find(FIND_HOSTILE_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_TOWER
        });
        enemyInfo.towers = towers.length;

        const spawns = neighborRoom.find(FIND_HOSTILE_SPAWNS);
        enemyInfo.spawns = spawns.length;

        // Υπολογισμός δύναμης τειχών (βρίσκουμε το πιο αδύναμο σημείο για πιθανή εισβολή)
        const walls = neighborRoom.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART
        });

        if (walls.length > 0) {
            // Βρίσκουμε το ελάχιστο hits (το πιο αδύναμο σημείο)
            enemyInfo.minWallHits = _.min(walls, 'hits').hits;
        }

        // Αποθήκευση στο memory
        mem.enemyInfo = enemyInfo;

        console.log(`⚔️ INTEL: [${neighborRoomName}] Owner: ${enemyInfo.owner} | Lvl: ${enemyInfo.level} | Towers: ${enemyInfo.towers} | Walls(min): ${Math.floor(enemyInfo.minWallHits / 1000)}k`);

        return false;
    }

    return false;
};

getNeighborFromMyRooms = function (myRooms) {
    const neighbors = [];

    // Το myRooms αναμένεται να είναι array από room names ή room objects
    for (let roomName of myRooms) {
        // Παίρνουμε τα exits (επιστρέφει αντικείμενο π.χ. {"1": "W1N2", "3": "W1N1"})
        const exits = Game.map.describeExits(roomName);
        if (exits) {
            for (let direction in exits) {
                neighbors.push(exits[direction]);
            }
        }
    }

    // Αφαίρεση διπλοτύπων (δωμάτια που συνορεύουν με πάνω από ένα δικά μας)
    // και αφαίρεση των ίδιων των δικών μας δωματίων από τη λίστα scout
    const uniqueNeighbors = _.uniq(neighbors);
    return _.filter(uniqueNeighbors, name => !myRooms.includes(name));
};
cleanMemoryRooms = function(myRoomsNames, neighborsRoomNames) {
    // Συνδυάζουμε τις δύο λίστες σε μία για ευκολότερο έλεγχο
    const validRooms = [...myRoomsNames, ...neighborsRoomNames];

    for (let roomName in Memory.rooms) {
        // Αν το όνομα του δωματίου στη Memory δεν υπάρχει στη λίστα validRooms
        if (!validRooms.includes(roomName)) {
            delete Memory.rooms[roomName];
            // console.log(`🧹 MEMORY: Cleared old room data: ${roomName}`);
        }
    }
};
// 2. Το Module του Expansion Manager
const expansionManager = {
    run: function () {
        // Εκτέλεση κάθε 100 ticks για εξοικονόμηση CPU
        if ( (Game.cpu.bucket < 2000 ) || (Game.time % 100 !== 0)) return;
        

        var myRoomsName = (_.filter(Game.rooms, r => r.controller && r.controller.my)).map(room => room.name);
        for (let myRoomName of myRoomsName ) {
            const room=Game.rooms[myRoomName];
            if (!room) {
                continue;
            }
            if (!room.memory.neighbors) {
                const exits = Game.map.describeExits(myRoomName);
                let neig=[];
                if (exits) {
                    for (let direction in exits) {
                        neig.push(exits[direction]);
                    }
                }
                room.memory.neighbors=neig;
                
            }
        }
        const hasGCL = Game.gcl.level > myRoomsName;


        const neighborRoomNames = getNeighborFromMyRooms(myRoomsName);
        
        if (!Memory.capital || (myRoomsName.includes(Memory.capital))===false) {
            foundNewCapital(myRoomsName);
        }
       // printToConsole(myRoomsName,neighborRoomNames);
        
        
        
        for (let neighborRoomName of neighborRoomNames) {
            // Ensure memory exists
            if (!Memory.rooms[neighborRoomName]) {
                Memory.rooms[neighborRoomName] = {};
            }
            
            let neighborRoom = Game.rooms[neighborRoomName];
            if (neighborRoom) {
                //έχουμε πρόσβαση
                global.getInfoForNeighborRoom(neighborRoomName, hasGCL);
            } else {
                const mem = Memory.rooms[neighborRoomName];

                // Έλεγχος αν χρειάζεται scout
                if (!mem.scoutNeeded && (!mem.lastScouted || (Game.time - mem.lastScouted > 5000))) {
                    mem.scoutNeeded = true;
                    console.log(`🔭 EXPANSION: requesting Scout for ${neighborRoomName}`);
                }
            }
        }
        cleanMemoryRooms(myRoomsName, neighborRoomNames);
        
    }
    
};
const printToConsole=function(myRoomsNames,neighborRoomNames) {
    console.log("---- Expansion start----");
    if(Memory.capital) {
        console.log('Capital is '+Memory.capital);
    }
    console.log('My Rooms: ' + JSON.stringify(myRoomsNames));
    console.log('neighbor Rooms: ' + JSON.stringify(neighborRoomNames));
};

const foundNewCapital = function(myRoomsNames) {
    if (myRoomsNames.length === 0) return null;

    // Μετατρέπουμε τα ονόματα σε αντικείμενα Room για να έχουμε πρόσβαση στα properties
    const rooms = myRoomsNames.map(name => Game.rooms[name]).filter(r => r && r.controller);

    // Ταξινόμηση βάσει RCL -> Storage Usage -> Energy Available
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
};
module.exports = expansionManager;