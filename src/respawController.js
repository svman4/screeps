/*
 * respawController.js - Ελέγχει την ανάγκη και εκτελεί την αναπαραγωγή creeps.
 */
const Harvester_MAX=10;
const upgrader_MAX=3;
const builder_MAX=2;
const respawController = {
    
    run: function() {
        // 1. Καθαρισμός Μνήμης από νεκρά creeps
        // Είναι κρίσιμο για να μη γεμίσει η μνήμη του server.
        for (let name in Memory.creeps) {
            // Ελέγχουμε αν το creep υπάρχει ακόμα στο Game.creeps (είναι ζωντανό)
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
                console.log('🚮 Διαγράφηκε μνήμη για νεκρό creep:', name);
            }
            
        }
        // --- Λογική Spawning ---
        
        
        // 3. Ορίζουμε το Spawn που θα χρησιμοποιήσουμε (πρέπει να υπάρχει!)
        const currentSpawn = Game.spawns['Spawn1'];

        if (currentSpawn && currentSpawn.spawning) {
             // Εμφάνιση του creep που παράγεται για οπτική επιβεβαίωση
             currentSpawn.room.visual.text(
                '🛠️' + Game.creeps[currentSpawn.spawning.name].memory.role,
                currentSpawn.pos.x + 1,
                currentSpawn.pos.y,
                {align: 'left', opacity: 0.8}
            );
            return;
        }
        
        // 2. Βρίσκουμε όλα τα creeps με ρόλο 'harvester'
        const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester');
        const upgrader=_.filter(Game.creeps,(creep)=>creep.memory.role==="upgrader");
        const builders=_.filter(Game.creeps,(creep)=>creep.memory.role==="builder");
        let result=[];
        
        // 4. Ελέγχουμε αν πρέπει να φτιάξουμε ένα νέο harvester
        if (harvesters.length < Harvester_MAX) { 
            result=createNewHarvester(currentSpawn);
        } else if (upgrader.length<upgrader_MAX) {
            result=createNewUpgrader(currentSpawn);
        } else if (builders.length<builder_MAX) { 
            // Βρίσκουμε όλα τα Construction Sites (εργοτάξια) στο δωμάτιο
            const constructionSites = currentSpawn.room.find(FIND_CONSTRUCTION_SITES);
            
            if(constructionSites.length!=0){
                result=createNewBuilder(currentSpawn);
            }
        }
        if (result[0] === OK) {
                console.log('🛠️ Ξεκίνησε η δημιουργία νέου creep'+result[1]);
        } else if (result[0] === ERR_NOT_ENOUGH_ENERGY) {
            // Αυτό είναι φυσιολογικό στην αρχή. Μπορείτε να το απενεργοποιήσετε.
            //console.log('Δεν υπάρχει αρκετή ενέργεια για να φτιαχτεί το creep (Χρειάζεται: ' + 
              //           currentSpawn.room.energyAvailable + ' / '  + ').');
        } else if (result[0] === ERR_BUSY) {
            // Αυτό δεν θα συμβεί λόγω του check !currentSpawn.spawning
        }
    }    
};
createNewBuilder=function(currentSpawn) {
    const energyCapacity = currentSpawn.room.energyCapacityAvailable;
    let bodyParts;
    const bodyType="builder";
    
    if (energyCapacity >= 550) {
        // Tier 3: 4 WORK, 1 CARRY, 2 MOVE (550)
        bodyParts = [WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE]; 
    } else if (energyCapacity >= 300) {
        // Tier 2: 2 WORK, 1 CARRY, 1 MOVE (250)
        bodyParts = [WORK, WORK, CARRY, MOVE];
    } else {
        // Tier 1: 1 WORK, 1 CARRY, 1 MOVE (200)
        bodyParts = [WORK, CARRY, MOVE]; 
    }
    
    // Δημιουργία μοναδικού ονόματος με χρήση του Game.time
    const newName = bodyType + Game.time;
    // Ορισμός της μνήμης (memory) για τον ρόλο
    const creepMemory = { memory: { role: bodyType } };

    // Καλούμε τη μέθοδο spawnCreep()
    let result=[ currentSpawn.spawnCreep(bodyParts, newName, creepMemory),newName];
     return result;
};
createNewHarvester=function(currentSpawn) {
    const energyCapacity = currentSpawn.room.energyCapacityAvailable;
    let bodyParts;
    
   
    if (energyCapacity >= 550) {
        // Tier 3: 4 WORK, 1 CARRY, 2 MOVE (550)
        bodyParts = [WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE]; 
    } else if (energyCapacity >= 300) {
        // Tier 2: 2 WORK, 1 CARRY, 1 MOVE (250)
        bodyParts = [WORK, WORK, CARRY, MOVE];
    } else {
        // Tier 1: 1 WORK, 1 CARRY, 1 MOVE (200)
        bodyParts = [WORK, CARRY, MOVE]; 
    }
    
    // Δημιουργία μοναδικού ονόματος με χρήση του Game.time
    const newName = 'Harvester' + Game.time;
    // Ορισμός της μνήμης (memory) για τον ρόλο
    const creepMemory = { memory: { role: 'harvester' } };

    // Καλούμε τη μέθοδο spawnCreep()
    let result=[ currentSpawn.spawnCreep(bodyParts, newName, creepMemory),newName];
     return result;
};
createNewUpgrader=function(currentSpawn) {
    const energyCapacity = currentSpawn.room.energyCapacityAvailable;
    let bodyParts;
    
        // Tier 1: 1 WORK, 1 CARRY, 1 MOVE (200)
        bodyParts = [WORK, CARRY, MOVE]; 
    
    
    // Δημιουργία μοναδικού ονόματος με χρήση του Game.time
    const newName = 'upgrader' + Game.time;
    // Ορισμός της μνήμης (memory) για τον ρόλο
    const creepMemory = { memory: { role: 'upgrader' } };

    // Καλούμε τη μέθοδο spawnCreep()
    let result=[currentSpawn.spawnCreep(bodyParts, newName, creepMemory),newName];
    return result;
};
module.exports = respawController;