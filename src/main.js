var spawnManager=require('manager.spawn');
var defenceManager=require('manager.defense');
var constructionManager=require('manager.construction');
var expasionManager=require('manager.expansion');
var logisticsManager=require('manager.logistics');
var roleManager=require('manager.role');


module.exports.loop = function () {
    // 1. Memory Cleanup: Clear memory of dead creeps
    for (const name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
            // console.log('Clearing non-existing creep memory:', name); // Optional: uncomment for debugging
        }
    }
    
    
    
    // 1. Έλεγχος και αρχικοποίηση Memory.rooms (αν λείπει)
    if (!Memory.rooms) {
        Memory.rooms = {};
        console.log("Memory.rooms αρχικοποιήθηκε.");
    }

    // 2. Επανάληψη σε όλα τα Δωμάτια που ελέγχουμε
    for (const roomName in Game.rooms) {
        // Εδώ το roomName θα είναι 'E25S7' (και όποιο άλλο δωμάτιο ελέγχετε)
        
        // Αρχικοποίηση Memory για το συγκεκριμένο δωμάτιο (Αν δεν γίνει ήδη στον Planner)
        if (!Memory.rooms[roomName]) {
             Memory.rooms[roomName] = {};
        }
        if(Game.rooms[roomName].controller.my) {
            // 3. Εκτέλεση Λογικής Δωματίου
            defenceManager.run(roomName);

            // 4. Εκτέλεση Respawn (Συνήθως εκτός βρόχου δωματίων)
            spawnManager.run(roomName);
            logisticsManager.run(roomName);
            constructionManager.run(roomName);
            
           // CPU BUCKET CHECK: Skip low-priority tasks if CPU is low
             if (Game.cpu.bucket > 5000) {
                 // LOW PRIORITY: Expansion
                 expansionManager.run();
             }
             roleManager.run(roomName);
        } else {
            // Το δωμάτιο δεν είναι δικό μας.
            // θα πρέπει να γίνεται έλεγχος αν υπάρχει αντίπαλος.
            // const maxRooms = Game.gcl.level;
            // const ownedRooms = Object.keys(Game.rooms).filter(roomName => Game.rooms[roomName].controller && Game.rooms[roomName].controller.my).length;
            // if (maxRooms>ownedRooms.length) { 
                
            // } else {
            //     // δε μπορώ να Κάνω claim το δωμάτιο.
            // }
                
        }
        
        
        
        
        
    }
    
    
    
    // // 5. Εκτέλεση Λογικής Creeps
    // for(var name in Game.creeps) {
    //     var creep = Game.creeps[name];
        
    //     if(creep.memory.role == 'simpleHarvester') {
    //         roleHarvester.run(creep);
    //     } else if(creep.memory.role === 'upgrader') {
    //         roleUpgrader.run(creep);
    //     } else if(creep.memory.role === 'builder') {
    //         roleBuilder.run(creep);
    //     } else if( creep.memory.role==="staticHarvester") {
    //         staticHarvester.run(creep);
    //     } else if (creep.memory.role==="staticBuilder") {
    //         staticBuilder.run(creep);
    //     } else if (creep.memory.role==="staticUpgrader") {
    //         staticUpgrader.run(creep);
    //     } else if (creep.memory.role=== "staticHauler") {
    //         staticHauler.run(creep);
    //     }else if (creep.memory.role=== "LDHarvester") {
    //         LDHarvester.run(creep);
    //     }else if (creep.memory.role==="claimer") {
    //         roleClaimer.run(creep);
    //     } else if (creep.memory.role==="LDHauler") {
    //         roleLDHauler.run(creep);
    //     }
        
        
    // }

}; // end of loop

checkLink=function(roomName) {
    
    const room=Game.rooms[roomName];
    
    const links=room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_LINK }
        }
    );
    var controllerLink = Game.getObjectById("69050d532340f4c09a643cdd");
    //console.log(Memory.rooms[roomName].controllerLink);
    var controllerLink=Game.getObjectById(Memory.rooms["E25S7"].controllerLink);
    if (!controllerLink) { 
        console.log("No controllerLinkFound)");
        return;
        
    }
    // Βρίσκουμε όλα τα άλλα Links (πιθανούς αποστολείς)
    const senderLinks = links.filter(link => link.id !== controllerLink.id);
    
    if (controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
        return;
    }
    for (const sender of senderLinks) {
            // Έλεγχος Cooldown
            if (sender.cooldown > 0) {
                continue; // Πάμε στο επόμενο Link αν αυτό είναι σε cooldown
            }
            
            
            if (sender.store.getUsedCapacity(RESOURCE_ENERGY) > 550) {
                
                // 3. Εκτέλεση της Μεταφοράς
                const result = sender.transferEnergy(controllerLink);

                if (result === OK) {
                    console.log(`Link: Η μεταφορά ενέργειας από ${sender.id} προς Controller Link ήταν επιτυχής.`);
                    return; // Σταματάμε μόλις γίνει μία επιτυχής μεταφορά (για να σώσουμε CPU)
                } else if (result === ERR_NOT_IN_RANGE) {
                    // Αυτό δεν πρέπει να συμβεί αν όλα τα Links είναι στο ίδιο δωμάτιο
                    console.log("Link Error: Τα Links είναι πολύ μακριά! (Εκτός range)");
                }
            }
        }
}; // end of checkLink
