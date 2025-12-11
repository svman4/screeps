const expansionManager = {
    run: function(roomName) {
        // Εκτέλεση κάθε 100 ticks
        if (Game.time % 100 !== 0) return;

        const room = Game.rooms[roomName];
        if (!room) return;

        const myRooms = _.filter(Game.rooms, r => r.controller && r.controller.my).length;
        const hasGCL = Game.gcl.level > myRooms;

        const exits = Game.map.describeExits(roomName);
        if (!room.memory.neighbors) {
            room.memory.neighbors = {};
        }
        
        for (let exitDir in exits) {
            let neighborName = exits[exitDir];

            if (!Memory.rooms[neighborName]) {
                Memory.rooms[neighborName] = {};
            }
            if (!room.memory.neighbors[neighborName]) { 
                room.memory.neighbors[neighborName] = {};
            }
            
            let neighborRoom = Game.rooms[neighborName];

            // Α. ΕΧΟΥΜΕ VISION
            if (neighborRoom) {
                this.getInfoForNeighborRoom(roomName, neighborName, neighborRoom, hasGCL);
            } 
            // Β. ΔΕΝ ΕΧΟΥΜΕ VISION -> ΖΗΤΑ SCOUT
            else {
                const mem = Memory.rooms[neighborName];
                // Αν δεν έχουμε scoutάρει τις τελευταίες 5000 ticks και δεν έχουμε ζητήσει ήδη scout
                if (!mem.scoutNeeded && (!mem.lastScouted || (Game.time - mem.lastScouted > 5000))) {
                    mem.scoutNeeded = true;
                    console.log(`🔭 EXPANSION: ${roomName}_Ζητείται Scout για το ${neighborName}`);
                }
            }
        }
    },
    
    getInfoForNeighborRoom: function(roomName, neighborName, neighborRoom, hasGCL) {
        // Καθαρισμός flag αν υπάρχει vision
        Memory.rooms[neighborName].scoutNeeded = false;
        Memory.rooms[neighborName].lastScouted = Game.time;

        const controller = neighborRoom.controller;
        let isFree = controller && !controller.owner && 
                     (!controller.reservation || controller.reservation.username === 'svman4');

        if (isFree) {
            const sources = neighborRoom.find(FIND_SOURCES);
            if (sources.length > 0) {
                if (sources.length >= 2 && hasGCL) {
                    Memory.rooms[neighborName].type = 'claim_target';
                    Memory.rooms[neighborName].sourceCount = sources.length;
                    console.log(`🚩 EXPANSION: Target ${neighborName} set for CLAIMING.`);
                } else {
                    Memory.rooms[neighborName].type = 'remote_mining';
                    Memory.rooms[neighborName].sourceCount = sources.length;
                }
            }
        }
    }
};

// Εξαγωγή της function ώστε να είναι διαθέσιμη από οπουδήποτε
global.getInfoForNeighborRoom = function(neighborRoomName, hasGCL, callingRoomName = 'unknown') {
    const neighborRoom = Game.rooms[neighborRoomName];
    
    if (!neighborRoom) {
        console.log(`❌ EXPANSION: [${callingRoomName}] No vision for room ${neighborRoomName}`);
        return;
    }
    
    if (!Memory.rooms[neighborRoomName]) {
        Memory.rooms[neighborRoomName] = {};
    }
    
    // Καθαρισμός flag αν υπάρχει vision
    Memory.rooms[neighborRoomName].scoutNeeded = false;
    Memory.rooms[neighborRoomName].lastScouted = Game.time;

    const controller = neighborRoom.controller;
    let isFree = controller && !controller.owner && 
                 (!controller.reservation || controller.reservation.username === 'svman4');

    if (isFree) {
        const sources = neighborRoom.find(FIND_SOURCES);
        if (sources.length > 0) {
            if (sources.length >= 2 && hasGCL) {
                Memory.rooms[neighborRoomName].type = 'claim_target';
                Memory.rooms[neighborRoomName].sourceCount = sources.length;
                console.log(`🚩 EXPANSION: [${callingRoomName}] Target ${neighborRoomName} free for CLAIMING.`);
            } else {
                Memory.rooms[neighborRoomName].type = 'remote_mining';
                Memory.rooms[neighborRoomName].sourceCount = sources.length;
                console.log(`⛏️ EXPANSION: [${callingRoomName}] ${neighborRoomName} set for REMOTE MINING.`);
            }
        }
    } else {
        // Το δωμάτιο δεν είναι ελεύθερο.
        Memory.rooms[neighborRoomName].type = "enemyCaptured";
        
        // Αποθήκευση level του controller
        if (controller && controller.owner) {
            Memory.rooms[neighborRoomName].enemyControllerLevel = controller.level;
        }
        
        // Αποθήκευση διαθέσιμης ενέργειας
        Memory.rooms[neighborRoomName].energyAvailable = neighborRoom.energyAvailable;
        
        console.log(`⚠️ EXPANSION: [${callingRoomName}] ${neighborRoomName} captured by enemy. Controller level: ${controller.level || 'N/A'}`);
    }
};

module.exports = expansionManager;