const USER_NAME = 'Svman4';

// 1. Ορισμός της Global Function (Πρώτα, ώστε να είναι διαθέσιμη)
global.getInfoForNeighborRoom = function(neighborRoomName, hasGCL = false, callingRoomName = 'unknown') {
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
                console.log(`🚩 EXPANSION: [${callingRoomName}] Target ${neighborRoomName} free for CLAIMING.`);
            } else {
                mem.type = 'remote_mining';
                mem.sources = sourcePositions;
                // console.log(`⛏️ EXPANSION: [${callingRoomName}] ${neighborRoomName} set for REMOTE MINING.`);
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
        
        console.log(`⚔️ INTEL: [${neighborRoomName}] Owner: ${enemyInfo.owner} | Lvl: ${enemyInfo.level} | Towers: ${enemyInfo.towers} | Walls(min): ${Math.floor(enemyInfo.minWallHits/1000)}k`);
        
        return false;
    }
    
    return false;
};

// 2. Το Module του Expansion Manager
const expansionManager = {
    run: function(roomName) {
        // Εκτέλεση κάθε 100 ticks για εξοικονόμηση CPU
        if (Game.time % 100 !== 0) return;

        const room = Game.rooms[roomName];
        if (!room) return;

        const myRooms = _.filter(Game.rooms, r => r.controller && r.controller.my).length;
        const hasGCL = Game.gcl.level > myRooms;

        const exits = Game.map.describeExits(roomName);
        
        // Δεν χρειάζεται πλέον τοπική μνήμη room.memory.neighbors αν όλα πάνε στο Memory.rooms
        // Αλλά αν το χρησιμοποιείς για pathfinding, κράτα το.
        
        for (let exitDir in exits) {
            let neighborName = exits[exitDir];

            // Ensure memory exists
            if (!Memory.rooms[neighborName]) {
                Memory.rooms[neighborName] = {};
            }
            
            let neighborRoom = Game.rooms[neighborName];

            // Α. ΕΧΟΥΜΕ VISION -> ΚΑΛΟΥΜΕ ΤΗΝ GLOBAL
            if (neighborRoom) {
                global.getInfoForNeighborRoom(neighborName, hasGCL, roomName);
            } 
            // Β. ΔΕΝ ΕΧΟΥΜΕ VISION -> ΖΗΤΑ SCOUT
            else {
                const mem = Memory.rooms[neighborName];
                
                // Αν είναι ήδη δικό μας (από προηγούμενη μνήμη), δεν στέλνουμε scout
                // (Προσοχή: Αν χάσουμε το δωμάτιο και δεν έχουμε vision, αυτό ίσως χρειαστεί αλλαγή, 
                // αλλά υποθέτουμε ότι στα δικά μας δωμάτια έχουμε vision).
                
                // Έλεγχος αν χρειάζεται scout
                if (!mem.scoutNeeded && (!mem.lastScouted || (Game.time - mem.lastScouted > 5000))) {
                    mem.scoutNeeded = true;
                    console.log(`🔭 EXPANSION: ${roomName} requesting Scout for ${neighborName}`);
                }
            }
        }
    }
};

module.exports = expansionManager;