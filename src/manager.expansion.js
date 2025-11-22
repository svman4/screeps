const expansionManager = {
    run: function(roomName) {
        // Εκτέλεση κάθε 100 ticks
        if (Game.time % 100 !== 0) return;

        const room = Game.rooms[roomName];
        if (!room) return;

        const myRooms = _.filter(Game.rooms, r => r.controller && r.controller.my).length;
        const hasGCL = Game.gcl.level > myRooms;

        const exits = Game.map.describeExits(roomName);

        for (let exitDir in exits) {
            let neighborName = exits[exitDir];

            if (!Memory.rooms[neighborName]) {
                Memory.rooms[neighborName] = {};
            }

            let neighborRoom = Game.rooms[neighborName];

            // Α. ΕΧΟΥΜΕ VISION
            if (neighborRoom) {
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
            // Β. ΔΕΝ ΕΧΟΥΜΕ VISION -> ΖΗΤΑ SCOUT
            else {
                const mem = Memory.rooms[neighborName];
                // Αν δεν έχουμε scoutάρει τις τελευταίες 5000 ticks και δεν έχουμε ζητήσει ήδη scout
                if (!mem.scoutNeeded && (!mem.lastScouted || (Game.time - mem.lastScouted > 5000))) {
                    mem.scoutNeeded = true;
                    console.log(`🔭 EXPANSION: Ζητείται Scout για το ${neighborName}`);
                }
            }
        }
    }
};

module.exports = expansionManager;