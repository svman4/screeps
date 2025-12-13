const USER_NAME='Svman4';
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
                room.memory.neighbors[neighborName] = {sources: {}};
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
                    console.log(`🔭 EXPANSION: ${roomName} Ζητείται Scout για το ${neighborName}`);
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
                     (!controller.reservation || controller.reservation.username === USER_NAME);

        if (isFree) {
            const sources = neighborRoom.find(FIND_SOURCES);
            if (sources.length > 0) {
                // Serialize source positions for memory
                const sourcePositions = sources.map(source => ({
                    x: source.pos.x,
                    y: source.pos.y,
                    roomName: source.pos.roomName
                }));
                
                if (sources.length >= 2 && hasGCL) {
                    Memory.rooms[neighborName].type = 'claim_target';
                    Memory.rooms[neighborName].sourceCount = sources.length;
                    Memory.rooms[neighborName].sources = sourcePositions;
                    console.log(`🚩 EXPANSION: Target ${neighborName} set for CLAIMING.`);
                } else {
                    // Το δωμάτιο έχει μία ή λίγες πηγές
                    console.log(`⛏️ EXPANSION: Found new room for mining ${neighborName}`);
                    Memory.rooms[neighborName].type = 'remote_mining';
                    Memory.rooms[neighborName].sourceCount = sources.length;
                    Memory.rooms[neighborName].sources = sourcePositions;
                    
                    // Update room's neighbor memory too
                    const room = Game.rooms[roomName];
                    if (room && room.memory.neighbors) {
                        room.memory.neighbors[neighborName] = {
                            type: 'remote_mining',
                            sourceCount: sources.length,
                            sources: sourcePositions
                        };
                    }
                }
                
                // Store controller position if exists
                if (controller) {
                    Memory.rooms[neighborName].controller = {
                        x: controller.pos.x,
                        y: controller.pos.y,
                        roomName: controller.pos.roomName
                    };
                }
            }
        } else if (controller) {
            // Το δωμάτιο δεν είναι ελεύθερο
            Memory.rooms[neighborName].type = "enemyCaptured";
            
            // Αποθήκευση level του controller
            if (controller.owner) {
                Memory.rooms[neighborName].enemyControllerLevel = controller.level;
                Memory.rooms[neighborName].enemyUsername = controller.owner.username;
            } else if (controller.reservation) {
                Memory.rooms[neighborName].reservedBy = controller.reservation.username;
                Memory.rooms[neighborName].reservationTicks = controller.reservation.ticksToEnd;
            }
            
            // Αποθήκευση διαθέσιμης ενέργειας
            Memory.rooms[neighborName].energyAvailable = neighborRoom.energyAvailable;
            
            console.log(`⚠️ EXPANSION: ${neighborName} captured by enemy/reserved. Controller level: ${controller.level || 'N/A'}`);
        }
    }
};

// Εξαγωγή της function ώστε να είναι διαθέσιμη από οπουδήποτε
global.getInfoForNeighborRoom = function(neighborRoomName, hasGCL, callingRoomName = 'unknown') {
    const neighborRoom = Game.rooms[neighborRoomName];
    
    if (!neighborRoom) {
        console.log(`❌ EXPANSION: [${callingRoomName}] No vision for room ${neighborRoomName}`);
        return false;
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
            // Serialize source positions
            const sourcePositions = sources.map(source => ({
                x: source.pos.x,
                y: source.pos.y,
                roomName: source.pos.roomName
            }));
            
            if (sources.length >= 2 && hasGCL) {
                Memory.rooms[neighborRoomName].type = 'claim_target';
                Memory.rooms[neighborRoomName].sources = sourcePositions;
                console.log(`🚩 EXPANSION: [${callingRoomName}] Target ${neighborRoomName} free for CLAIMING.`);
            } else {
                Memory.rooms[neighborRoomName].type = 'remote_mining';
                Memory.rooms[neighborRoomName].sourceCount = sources.length;
                Memory.rooms[neighborRoomName].sources = sourcePositions;
                console.log(`⛏️ EXPANSION: [${callingRoomName}] ${neighborRoomName} set for REMOTE MINING.`);
            }
            
            // Store controller position
            if (controller) {
                Memory.rooms[neighborRoomName].controller = {
                    x: controller.pos.x,
                    y: controller.pos.y,
                    roomName: controller.pos.roomName
                };
            }
            return true;
        }
    } else if (controller) {
        // Το δωμάτιο δεν είναι ελεύθερο.
        Memory.rooms[neighborRoomName].type = "enemyCaptured";
        
        // Αποθήκευση level του controller
        if (controller.owner) {
            Memory.rooms[neighborRoomName].enemyControllerLevel = controller.level;
            Memory.rooms[neighborRoomName].enemyUsername = controller.owner.username;
        } else if (controller.reservation) {
            Memory.rooms[neighborRoomName].reservedBy = controller.reservation.username;
            Memory.rooms[neighborRoomName].reservationTicks = controller.reservation.ticksToEnd;
        }
        
        // Αποθήκευση διαθέσιμης ενέργειας
        Memory.rooms[neighborRoomName].energyAvailable = neighborRoom.energyAvailable;
        
        console.log(`⚠️ EXPANSION: [${callingRoomName}] ${neighborRoomName} captured by enemy. Controller level: ${controller.level || 'N/A'}`);
        return false;
    }
    
    return false;
};

module.exports = expansionManager;