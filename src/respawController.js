/*
 * respawController.js - Ελέγχει την ανάγκη και εκτελεί την αναπαραγωγή creeps.
 *
 
 */
// Ορίζουμε τους μέγιστους αριθμούς για τους βοηθητικούς ρόλους
const UPGRADER_MAX = 2; // Μέγιστος αριθμός Upgraders (που τραβούν ενέργεια)
const BUILDER_MAX = 1;  // Μέγιστος αριθμός Builders (που τραβούν ενέργεια)
const HAULER_MAX=4;

var SimpleHarvester_MAX=0;
var LD_HARVESTER_MAX=0;
var LD_HAULER_MAX=0;
// Ορίζουμε τον ρόλο του Harvester ως STATIC_HARVESTER
const SIMPLE_HARVESTER_ROLE="simpleHarvester";
const STATIC_HARVESTER_ROLE = 'staticHarvester';
const STATIC_UPGRADER_ROLE= 'staticUpgrader';
const STATIC_BUILDER_ROLE = "staticBuilder";
const STATIC_HAULER_ROLE="staticHauler";
const SIMPLE_LDHARVESTER_ROLE="LDHarvester";
const SIMPLE_LDHAULER_ROLE="LDHauler";


const respawController = {

    run: function(roomName) {
         if(Game.time%5!=0) {
                  // 1. Εξοικονόμηση CPU: Τρέχουμε τον planner μόνο κάθε 100 ticks.
             return;
         }
        // 1. Καθαρισμός Μνήμης από νεκρά creeps
        for (let name in Memory.creeps) {
            if (!Game.creeps[name]) {
                // Ελέγχουμε αν υπήρχε sourceId για να το απελευθερώσουμε
                if (Memory.creeps[name].role === STATIC_HARVESTER_ROLE && Memory.creeps[name].sourceId) {
                    console.log(`🔌 Απελευθερώθηκε Source ID: ${Memory.creeps[name].sourceId}`);
                }
                delete Memory.creeps[name];
                console.log('🚮 Διαγράφηκε μνήμη για νεκρό creep:', name);
            }
        }
        
        // --- Λογική Spawning ---
        const room=(Game.rooms[roomName]);
        // 3. Ορίζουμε το Spawn που θα χρησιμοποιήσουμε
        const currentSpawn=room.find(FIND_STRUCTURES, {
            filter: { structureType: STRUCTURE_SPAWN }
            })[0];
        
        
        if (!currentSpawn) {
            console.log("δε βρέθηκε spawn στο δωμάτιο "+roomName);
            return; // Ελέγχουμε την ύπαρξη Spawn
        }
        
        
        if (!room.memory.populationMax) {
            console.log(roomName+"Δε βρέθηκαν μέγιστα πληθυσμού. Δημιουργία νέων");
            
            room.memory.populationMax={};
            
             room.memory.populationMax.upgraderMax=2;
             room.memory.populationMax.builderMax=1;
            room.memory.populationMax.haulers=3;
            room.memory.populationMax.LDHaulers=0;
            room.memory.populationMax.LDHarverster=0;
            room.memory.populationMax.simpleHarvester=0;
        }
        
        
        if (currentSpawn.spawning) {
            // Εμφάνιση του creep που παράγεται για οπτική επιβεβαίωση
            const spawningCreep = Game.creeps[currentSpawn.spawning.name];
            if (spawningCreep) {
                currentSpawn.room.visual.text(
                    '🛠️' + spawningCreep.memory.role,
                    currentSpawn.pos.x + 1,
                    currentSpawn.pos.y,
                    {align: 'left', opacity: 0.8}
                );
            }
            return;
        }
        
        
        const rcl=room.controller.level;
         if(!rcl) {
             console.log('Δε βρέθηκε η τιμή rcl στο δωμάτιο '+ roomName);
         } 
        
        
        
        // 2. Βρίσκουμε όλα τα creeps ανά ρόλο
        const creeps = room.find(FIND_MY_CREEPS);
		
        
        
        const staticHarvesters = _.filter(creeps, (creep) => creep.memory.role === STATIC_HARVESTER_ROLE);
        const upgraders = _.filter(creeps, (creep) => creep.memory.role === STATIC_UPGRADER_ROLE);
        const builders = _.filter(creeps, (creep) => creep.memory.role === STATIC_BUILDER_ROLE);
        const haulers= _.filter(creeps,(creep)=>creep.memory.role===STATIC_HAULER_ROLE);
        const simpleHarverters=_.filter(creeps,(creep)=>creep.memory.role===SIMPLE_HARVESTER_ROLE);
        
        
        const LDHarvesters=_.filter(Game.creeps,(creep)=>creep.memory.role===SIMPLE_LDHARVESTER_ROLE && creep.memory.homeRoom===roomName );
        const LDHaulers=   _.filter(Game.creeps,(creep)=>creep.memory.role===SIMPLE_LDHAULER_ROLE && creep.memory.homeRoom===roomName );
        
        
        
        //  if (staticHarvesters.length===0 || haulers.length===0 ) {
        //       SimpleHarvester_MAX=5;
        //   } else { 
        //       SimpleHarvester_MAX=0;
        //   }
        let result = [];
        
        // --- 4. ΕΛΕΓΧΟΣ ΑΝΑΓΚΗΣ ΔΗΜΙΟΥΡΓΙΑΣ (Με σειρά προτεραιότητας) ---

        // 4.1. Static Harvesters (ΥΨΗΛΟΤΕΡΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
        // Ορίζουμε το μέγιστο των Static Harvesters ίσο με τον αριθμό των Sources.
        const sources = room.find(FIND_SOURCES);
        if(simpleHarverters.length<room.memory.populationMax.simpleHarvester) { 
            result=createNewSimpleHarvester(currentSpawn,rcl,roomName);
        }
        const STATIC_HARVESTER_MAX = sources.length;
        
        if (staticHarvesters.length < STATIC_HARVESTER_MAX) {
            console.log(roomName+ "harvester");
            // Βρίσκουμε ποιες Sources είναι ήδη δεσμευμένες
            const assignedSourceIds = staticHarvesters.map(creep => creep.memory.sourceId).filter(id => id);
            
            // Βρίσκουμε μια ελεύθερη Source
            const freeSource = sources.find(source => !assignedSourceIds.includes(source.id));

            if (freeSource) {
                result = createNewStaticHarvester(currentSpawn, freeSource.id,roomName);
            } else if (staticHarvesters.length === 0) {
                 // Αν δεν υπάρχει κανένας Harvester, φτιάχνουμε τον 1ο με την κοντινότερη Source
                 const closestSource = currentSpawn.pos.findClosestByPath(FIND_SOURCES);
                 if (closestSource) {
                     result = createNewStaticHarvester(currentSpawn, closestSource.id);
                 }
            }
        } 
        else if (haulers.length<room.memory.populationMax.haulers) { 
            console.log(roomName+ " haulers");
            result=createNewHaulers(currentSpawn,rcl,roomName);
            
            
        }
        
        
        else if (upgraders && upgraders.length < room.memory.populationMax.upgraderMax) {
            console.log(roomName+ " upgrade");
            result = createNewUpgrader(currentSpawn,rcl,roomName);
            
            
            
        }else if (LDHaulers && LDHaulers.length < room.memory.populationMax.LDHaulers) {
          
            result=createNewLDHauler(currentSpawn,rcl,roomName);
        } 
        
        else if (LDHarvesters && LDHarvesters.length < LD_HARVESTER_MAX) {
            result=createNewLDHarvester(currentSpawn,rcl,roomName);
        } 
        
        // 4.3. Builders (ΤΡΙΤΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ - Μόνο αν υπάρχει Construction Site)
        else if (builders.length < room.memory.populationMax.builderMax) {
            const constructionSites = currentSpawn.room.find(FIND_CONSTRUCTION_SITES);
            // Ελέγχουμε αν υπάρχει κάτι για χτίσιμο ΠΡΙΝ φτιάξουμε builder
            if(constructionSites.length >0 || builders.length===1){
                result = this.createNewBuilder(currentSpawn,rcl,roomName);
            }
        }
        
        
        // --- 5. ΑΠΟΤΕΛΕΣΜΑ ΔΗΜΙΟΥΡΓΙΑΣ ---
        if (!result) {
            
        }
        else if (result.length > 0 && result[0] === OK) {
            const newCreep = Game.creeps[result[1]];
            if (newCreep) {
                console.log(`${roomName} - 🛠️ Ξεκίνησε η δημιουργία νέου creep (${result[1]}). Ρόλος: ${newCreep.memory.role}`);
            }
        } else if (result.length > 0 && result[0] === ERR_NOT_ENOUGH_ENERGY) {
            
          //    console.log(`${roomName} - Δεν υπάρχει αρκετή ενέργεια για να φτιαχτεί το creep.  ${result[1]}`);
        }  else {
        //    console.log(`${roomName} - Error creep.  ${result[1]}`);
        }
        
    }     // end of run
    ,
    createNewBuilder:function(currentSpawn,rlc, roomName,maxPreferredEnergy=1200 ) {
        var energyCapacity = currentSpawn.room.energyCapacityAvailable;
        
        
    
        const costs = {
            WORK: 100,
            CARRY: 50,
            MOVE: 50
        };
        if(maxPreferredEnergy) {
            energyCapacity=Math.min(energyCapacity,maxPreferredEnergy);
        }
     
        const CORE_BODY = [WORK, CARRY, MOVE];
        const CORE_COST = costs.WORK + costs.CARRY + costs.MOVE;
    
    
        if (energyCapacity<CORE_BODY) { 
            return [ERROR_NOT_ENOUGH_ENERGY,bodyType];
        }
        let bodyParts;
        const bodyType = STATIC_BUILDER_ROLE;
    
        let body=[];
        let currentCost=0; 
    
        while((currentCost+CORE_COST)<=energyCapacity) { 
            body.push(...CORE_BODY);
            currentCost+=CORE_COST;
           // console.log(energyCapacity+"(0) /"+currentCost+" "+body.length);
        }
        while((currentCost+costs.CARRY+costs.MOVE)<=energyCapacity) { 
            body.push(CARRY,MOVE);
            currentCost+=costs.CARRY+costs.MOVE;
            //console.log(energyCapacity+"(1) /"+currentCost+" "+body.length);
        }
        
        
        while((currentCost+costs.MOVE)<=energyCapacity) { 
            body.push(MOVE);
            currentCost+=costs.MOVE;
            console.log(energyCapacity+"(4) /"+currentCost+" "+body.length);
        }
        body.sort();
        
        const newName = bodyType + Game.time;
        const creepMemory = { memory: { role: bodyType, homeRoom: roomName } };
        let result = [ currentSpawn.spawnCreep(body, newName, creepMemory), newName ];
        
        return result;
    } // end of createNewBuilder


}; // end of respawController

// ===========================================
// ΛΟΓΙΚΗ ΔΗΜΙΟΥΡΓΙΑΣ CREP (Helper Functions)
// ===========================================
    



createNewLDHauler=function(currentSpawn,rcl,roomName) { 
    if (rcl<4) {
        return [];
    }
        let bodyParts;
    const bodyType = SIMPLE_LDHAULER_ROLE;
    
        bodyParts = [WORK, CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY, CARRY, MOVE,MOVE, MOVE,MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]; 
    
    
    const newName = bodyType + Game.time;
    const creepMemory = { memory: { role: bodyType, homeRoom: roomName} };

    let result = [ currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName ];
    return result;
};
createNewLDHarvester=function(currentSpawn,rcl, roomName) { 
    if(rcl<4) {
        return;
    }
        let bodyParts;
    const bodyType = SIMPLE_LDHARVESTER_ROLE;
    
        bodyParts = [WORK,WORK,WORK, WORK, WORK, WORK, CARRY,CARRY, CARRY, MOVE,MOVE, MOVE,MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]; 
    
    
    const newName = bodyType + Game.time;
    const creepMemory = { memory: { role: bodyType, homeRoom: roomName } };

    let result = [ currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName ];
    return result;
};
createNewHaulers=function(currentSpawn,level,roomName) {
    const energyCapacity = currentSpawn.room.energyCapacityAvailable;
    let bodyParts;
    const bodyType = STATIC_HAULER_ROLE;
    
    if (level===1) {
        bodyParts = [WORK,CARRY,CARRY,MOVE ,MOVE]; 
    }
    else {
        if (level===2) {
            bodyParts = [WORK, CARRY, CARRY, CARRY, CARRY, MOVE,MOVE, MOVE, MOVE];
        } else if (level===3) {
            bodyParts = [CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE]; 
            } else {
            bodyParts = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, 
                             MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]; 
        }
    }
    
    const newName = bodyType + Game.time;
    const creepMemory = { memory: { role: bodyType, homeRoom: roomName } };

    let result = [ currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName ];
    return result;
};
createNewSimpleHarvester=function(currentSpawn,rcl,roomName) { 
    const energyCapacity = currentSpawn.room.energyCapacityAvailable;
    let bodyParts;
    const bodyType = SIMPLE_HARVESTER_ROLE;
    
        bodyParts = [WORK,  CARRY, MOVE]; 
    
    
    const newName = bodyType + Game.time;
    const creepMemory = { memory: { role: bodyType, homeRoom: roomName } };

    let result = [ currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName ];
    return result;
}


// Τροποποιημένη συνάρτηση για Static Harvester
createNewStaticHarvester = function(currentSpawn, sourceId) {
    const energyCapacity = currentSpawn.room.energyCapacityAvailable; 
    
    let bodyParts;
    const bodyType = STATIC_HARVESTER_ROLE;
    
    // Ο Static Harvester χρειάζεται MAX WORK και ΕΝΑ CARRY + MOVE
    if (energyCapacity >= 600) {
        bodyParts = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE]; // 600 Energy (5 WORK, 1 CARRY, 1 MOVE)
    } else if (energyCapacity >= 500) {
        bodyParts = [WORK, WORK, WORK, WORK, CARRY, MOVE]; // 500 Energy (4 WORK, 1 CARRY, 1 MOVE)
    } else if (energyCapacity >= 300) {
        bodyParts = [WORK, WORK, CARRY, MOVE]; // 300 Energy (2 WORK, 1 CARRY, 1 MOVE)
    } else {
        bodyParts = [WORK, CARRY, MOVE]; // 200 Energy (Starter)
    }
    
    // Δημιουργία μοναδικού ονόματος με χρήση του Game.time
    const newName = 'SHarv' + Game.time;
    // Ορισμός της μνήμης (memory) με τον ρόλο ΚΑΙ το sourceId!
    const creepMemory = { memory: { role: bodyType, sourceId: sourceId } };

    // Καλούμε τη μέθοδο spawnCreep()
    let result = [ currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName ];
    return result;
};

createNewUpgrader = function(currentSpawn,rcl,homeroom) {
    const energyCapacity = currentSpawn.room.energyCapacityAvailable;
    let bodyParts;
    const bodyType = 'staticUpgrader';
    
    // Ο Upgrader χρειάζεται πολλά WORK parts και CARRY/MOVE για να τραβάει ενέργεια
    // Work parts: 100, Carry: 50, Move: 50
    if (energyCapacity >= 1000) {
        bodyParts = [MOVE,MOVE,MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY];
    } else if (energyCapacity >= 600) {
        bodyParts = [WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY,MOVE, MOVE,MOVE, MOVE]; // 600 Energy (5 WORK, 1 CARRY, 1 MOVE)
    } else if (energyCapacity >= 400) {
        bodyParts = [WORK, WORK, WORK, CARRY, MOVE]; // 400 Energy (3 WORK, 1 CARRY, 1 MOVE)
    } else {
        bodyParts = [WORK, CARRY, MOVE]; // 200 Energy (Starter)
    }
    
    const newName = bodyType + Game.time;
    const creepMemory = { memory: { role: bodyType, homeRoom: homeroom } };

    let result = [currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName];
    return result;
};
showPopuationInfo=function() {
    
}

module.exports = respawController;
