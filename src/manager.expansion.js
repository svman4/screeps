const expansionManager = {
    run: function(roomName) {
        // Run less frequently to save CPU
         if (Game.time % 200 !== 0) {
             return; 
         }

        const room = Game.rooms[roomName];
        if (!room) return;

        // 1. See which are the neighboring rooms (Δες ποια είναι τα γειτονικά δωμάτια)
        const exits = Game.map.describeExits(roomName);
        const claimers = _.filter(Game.creeps, (creep) => creep.memory.role === 'claimer');

        // Loop through all exits
        for (let exitDir in exits) {
            let neighborName = exits[exitDir];

            // 2. Add to memory if not exists (αν δεν υπάρχουν πρόσθεσε τα στη μνήμη)
            if (!Memory.rooms[neighborName]) {
                Memory.rooms[neighborName] = {};
            }

            // Check if we have vision of the room (Cannot analyze sources without vision)
            let neighborRoom = Game.rooms[neighborName];

            if (neighborRoom) {
                // We have vision, so we can analyze the room now.
                
                // 3. See if they are free/unclaimed (Δες αν είναι ελεύθερα)
                // We check if there is an owner, or if it is reserved by an enemy.
                let isFree = !neighborRoom.controller.owner && 
                             (!neighborRoom.controller.reservation || neighborRoom.controller.reservation.username === 'svman4'); // Replace 'Me' with your username

                if (isFree) {
                    const sources = neighborRoom.find(FIND_SOURCES);
                    
                    // 4a. One Source -> Remote Mining (αν έχει μια πηγή τότε κάνε remote mining)
                    if (sources.length === 1) {
                        // Tag memory so your SpawnManager knows to send RemoteMiners
                        Memory.rooms[neighborName].type = 'remote_mining';
                        Memory.rooms[neighborName].sourceCount = 1;
                        
                        // Logic to place construction sites for roads can be triggered here
                        // or handled by a separate RoadManager looking at Memory.rooms[neighborName].type
                        // console.log(`Room ${neighborName} marked for Remote Mining.`);
                    }
                    
                    // 4b. Two Sources -> Conquest (Αν εχει δύο πηγές ... πρόχωρά στη κατάκτηση)
                    else if (sources.length === 2) {
                        // Check if we have enough GCL to claim a new room
                        if (Game.gcl.level > _.size(Game.spawns) && claimers.length === 0) {
                            
                            Memory.rooms[neighborName].type = 'claim_target';
                            Memory.rooms[neighborName].sourceCount = 2;
                            
                            console.log(`EXPANSION: Room ${neighborName} is a gold mine (2 sources)! Target set for claiming.`);
                            
                            // Trigger spawn logic (Mockup)
                            // Game.spawns['Spawn1'].memory.spawnQueue.push({role: 'claimer', target: neighborName});
                        } else {
                             // If we can't claim yet, we can still remote mine it
                             Memory.rooms[neighborName].type = 'remote_mining'; 
                        }
                    }
                }
            } else {
                // If neighborRoom is undefined, we have NO vision.
                // We should request a Scout creep to go there so we can analyze it next time.
                if (!Memory.rooms[neighborName].lastScouted) {
                   // console.log(`Need to scout ${neighborName} to decide expansion strategy.`);
                   // Game.spawns['Spawn1'].memory.spawnQueue.push({role: 'scout', target: neighborName});
                }
            }
        }
    }
};

module.exports = expansionManager;