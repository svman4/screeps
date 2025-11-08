/*
 * respawController.js - Ελέγχει την ανάγκη και εκτελεί την αναπαραγωγή creeps.
 *
 */

// Ορίζουμε τους μέγιστους αριθμούς για τους βοηθητικούς ρόλους
const UPGRADER_MAX = 2; // Μέγιστος αριθμός Upgraders (που τραβούν ενέργεια)
const BUILDER_MAX = 1;  // Μέγιστος αριθμός Builders (που τραβούν ενέργεια)
const HAULER_MAX = 4;

var SimpleHarvester_MAX = 0;
var LD_HARVESTER_MAX = 0;
var LD_HAULER_MAX = 0;

// Ορισμός ρόλων creeps
const SIMPLE_HARVESTER_ROLE = "simpleHarvester";
const STATIC_HARVESTER_ROLE = 'staticHarvester';
const STATIC_UPGRADER_ROLE = 'staticUpgrader';
const STATIC_BUILDER_ROLE = "staticBuilder";
const STATIC_HAULER_ROLE = "staticHauler";
const SIMPLE_LDHARVESTER_ROLE = "LDHarvester";
const SIMPLE_LDHAULER_ROLE = "LDHauler";

const respawController = {

    run: function(roomName) {
        // Εκτελείται μόνο κάθε 5 ticks για εξοικονόμηση CPU
        if (Game.time % 5 != 0) {
            return;
        }
        
        // 1. Καθαρισμός Μνήμης από νεκρά creeps
        for (let name in Memory.creeps) {
            if (!Game.creeps[name]) {
                // Εάν ο creep ήταν static harvester, απελευθερώνει το sourceId
                if (Memory.creeps[name].role === STATIC_HARVESTER_ROLE && Memory.creeps[name].sourceId) {
                    console.log(`🔌 Απελευθερώθηκε Source ID: ${Memory.creeps[name].sourceId}`);
                }
                delete Memory.creeps[name];
                console.log('🚮 Διαγράφηκε μνήμη για νεκρό creep:', name);
            }
        }
        
        // --- Λογική Spawning ---
        const room = Game.rooms[roomName];
        
        // 3. Εύρεση του spawn στο δωμάτιο
        const currentSpawn = room.find(FIND_STRUCTURES, {
            filter: { structureType: STRUCTURE_SPAWN }
        })[0];
        
        if (!currentSpawn) {
            console.log("δε βρέθηκε spawn στο δωμάτιο " + roomName);
            return;
        }
        
        // Εάν το spawn είναι απασχολημένο, εμφάνιση πληροφοριών
        if (currentSpawn.spawning) {
            const spawningCreep = Game.creeps[currentSpawn.spawning.name];
            if (spawningCreep) {
                currentSpawn.room.visual.text(
                    '🛠️' + spawningCreep.memory.role,
                    currentSpawn.pos.x + 1,
                    currentSpawn.pos.y,
                    { align: 'left', opacity: 0.8 }
                );
            }
            return;
        }
        
        // Λήψη του επιπέδου controller (RCL)
        const rcl = room.controller.level;
        if (!rcl) {
            console.log('Δε βρέθηκε η τιμή rcl στο δωμάτιο ' + roomName);
        }
        
        // 2. Κατηγοριοποίηση creeps ανά ρόλο
        const creeps = room.find(FIND_MY_CREEPS);
        
        const staticHarvesters = _.filter(creeps, (creep) => creep.memory.role === STATIC_HARVESTER_ROLE);
        const upgraders = _.filter(creeps, (creep) => creep.memory.role === STATIC_UPGRADER_ROLE);
        const builders = _.filter(creeps, (creep) => creep.memory.role === STATIC_BUILDER_ROLE);
        const haulers = _.filter(creeps, (creep) => creep.memory.role === STATIC_HAULER_ROLE);
        const simpleHarverters = _.filter(creeps, (creep) => creep.memory.role === SIMPLE_HARVESTER_ROLE);
        
        const LDCreeps=_.filter(Game.creeps,(creep)=>(creep.memory.role===SIMPLE_LDHARVESTER_ROLE || creep.memory.role===SIMPLE_LDHAULER_ROLE) && creep.memory.homeRoom===rooomName);
        //console.log("LDCreep "+LDCreeps.length);
        
        const LDHarvesters = _.filter(Game.creeps, (creep) => creep.memory.role === SIMPLE_LDHARVESTER_ROLE && creep.memory.homeRoom === roomName);
        const LDHaulers = _.filter(Game.creeps, (creep) => creep.memory.role === SIMPLE_LDHAULER_ROLE && creep.memory.homeRoom === roomName);
        
        let result = [];
        
        // --- 4. ΕΛΕΓΧΟΣ ΑΝΑΓΚΗΣ ΔΗΜΙΟΥΡΓΙΑΣ (Με σειρά προτεραιότητας) ---

        // 4.1. Static Harvesters (ΥΨΗΛΟΤΕΡΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
        const sources = room.find(FIND_SOURCES);
        
        // Έλεγχος για simple harvesters
        if (simpleHarverters.length < room.memory.populationMax.simpleHarvester) {
            result = createNewSimpleHarvester(currentSpawn, rcl, roomName);
        }
        
        const STATIC_HARVESTER_MAX = sources.length;
        
        if (staticHarvesters.length < STATIC_HARVESTER_MAX) {
            console.log(roomName + " harvester");
            // Βρίσκουμε τις ήδη δεσμευμένες πηγές
            const assignedSourceIds = staticHarvesters.map(creep => creep.memory.sourceId).filter(id => id);
            
            // Βρίσκουμε ελεύθερη πηγή
            const freeSource = sources.find(source => !assignedSourceIds.includes(source.id));

            if (freeSource) {
                result = createNewStaticHarvester(currentSpawn, freeSource.id, roomName);
            } else if (staticHarvesters.length === 0) {
                // Εάν δεν υπάρχει κανένας harvester, δημιουργούμε έναν για την κοντινότερη πηγή
                const closestSource = currentSpawn.pos.findClosestByPath(FIND_SOURCES);
                if (closestSource) {
                    result = createNewStaticHarvester(currentSpawn, closestSource.id,roomName);
                }
            }
        } 
        // 4.2. Haulers
        else if (haulers.length < room.memory.populationMax.haulers) {
            console.log(roomName + " haulers");
            result = createNewHaulers(currentSpawn, rcl, roomName);
        }
        // 4.3. Upgraders
        else if (upgraders && upgraders.length < room.memory.populationMax.upgraderMax) {
            console.log(roomName + " upgrade");
            result = createNewUpgrader(currentSpawn, rcl, roomName);
        }
        // 4.4. Long Distance Haulers
        else if (LDHaulers && LDHaulers.length < room.memory.populationMax.LDHaulers) {
            result = createNewLDHauler(currentSpawn, rcl, roomName);
        }
        
        // 4.5. Long Distance Harvesters
        else if (LDHarvesters && LDHarvesters.length < room.memory.populationMax.LDHarvesters) {
            result = createNewLDHarvester(currentSpawn, rcl, roomName);
        }
        // 4.6. Builders
        else if (builders.length < room.memory.populationMax.builderMax) {
            const constructionSites = currentSpawn.room.find(FIND_CONSTRUCTION_SITES);
            // Δημιουργούμε builder μόνο αν υπάρχουν construction sites
            if (constructionSites.length > 0 || builders.length === 1) {
                result = this.createNewBuilder(currentSpawn, rcl, roomName, 1200);
            }
        } 
            
        
        // --- 5. ΑΠΟΤΕΛΕΣΜΑ ΔΗΜΙΟΥΡΓΙΑΣ ---
        if (!result) {
            // Δεν απαιτείται δημιουργία creep
        } else if (result.length > 0 && result[0] === OK) {
            const newCreep = Game.creeps[result[1]];
            if (newCreep) {
                console.log(`${roomName} - 🛠️ Ξεκίνησε η δημιουργία νέου creep (${result[1]}). Ρόλος: ${newCreep.memory.role}`);
            }
        } else if (result.length > 0 && result[0] === ERR_NOT_ENOUGH_ENERGY) {
            // Δεν υπάρχει αρκετή ενέργεια
        } else {
            // Άλλο σφάλμα
        }
    }, // end of run

    // Επιστρέφει τα default population settings
    getDefaultPopulation: function() {
        var populationMax = {};
        populationMax.upgraderMax = 2;
        populationMax.builderMax = 1;
        populationMax.haulers = 3;
        populationMax.LDHaulers = 0;
        populationMax.LDHarversters = 0;
        populationMax.simpleHarvester = 0;
        return populationMax;
    },

    // Δημιουργία νέου builder
    createNewBuilder: function(currentSpawn, rlc, roomName, maxPreferredEnergy = 1200) {
        var energyCapacity = currentSpawn.room.energyCapacityAvailable;
        
        const costs = {
            WORK: 100,
            CARRY: 50,
            MOVE: 50
        };
        
        if (maxPreferredEnergy) {
            energyCapacity = Math.min(energyCapacity, maxPreferredEnergy);
        }
     
        const CORE_BODY = [WORK, CARRY, MOVE];
        const CORE_COST = costs.WORK + costs.CARRY + costs.MOVE;
    
        if (energyCapacity < CORE_BODY) {
            return [ERROR_NOT_ENOUGH_ENERGY, bodyType];
        }
        
        let body = [];
        let currentCost = 0;
    
        // Προσθήκη βασικών body parts μέχρι να εξαντληθεί η ενέργεια
        while ((currentCost + CORE_COST) <= energyCapacity) {
            body.push(...CORE_BODY);
            currentCost += CORE_COST;
        }
        
        // Προσθήκη επιπλέον CARRY και MOVE parts
        while ((currentCost + costs.CARRY + costs.MOVE) <= energyCapacity) {
            body.push(CARRY, MOVE);
            currentCost += costs.CARRY + costs.MOVE;
        }
        
        // Προσθήκη επιπλέον MOVE parts
        while ((currentCost + costs.MOVE) <= energyCapacity) {
            body.push(MOVE);
            currentCost += costs.MOVE;
            console.log(energyCapacity + "(4) /" + currentCost + " " + body.length);
        }
        
        body.sort();
        
        const newName = STATIC_BUILDER_ROLE + Game.time;
        const creepMemory = { memory: { role: STATIC_BUILDER_ROLE, homeRoom: roomName } };
        let result = [currentSpawn.spawnCreep(body, newName, creepMemory), newName];
        
        return result;
    } // end of createNewBuilder

}; // end of respawController

// ===========================================
// ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ ΔΗΜΙΟΥΡΓΙΑΣ CREEP
// ===========================================

// Δημιουργία Long Distance Hauler
createNewLDHauler = function(currentSpawn, rcl, roomName) {
    if (rcl < 4) {
        return [];
    }
    
    let bodyParts;
    const bodyType = SIMPLE_LDHAULER_ROLE;
    
    bodyParts = [WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
    
    const newName = bodyType + Game.time;
    const creepMemory = { memory: { role: bodyType, homeRoom: roomName } };

    let result = [currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName];
    return result;
};

// Δημιουργία Long Distance Harvester
createNewLDHarvester = function(currentSpawn, rcl, roomName) {
    if (rcl < 4) {
        return;
    }
    
    let bodyParts;
    const bodyType = SIMPLE_LDHARVESTER_ROLE;
    
    bodyParts = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
    
    const newName = bodyType + Game.time;
    const creepMemory = { memory: { role: bodyType, homeRoom: roomName } };

    let result = [currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName];
    return result;
};

// Δημιουργία Hauler
createNewHaulers = function(currentSpawn, level, roomName) {
    const energyCapacity = currentSpawn.room.energyCapacityAvailable;
    let bodyParts;
    const bodyType = STATIC_HAULER_ROLE;
    
    // Προσαρμογή body parts ανάλογα με το level
    if (level === 1) {
        bodyParts = [WORK, CARRY, CARRY, MOVE, MOVE];
    } else {
        if (level === 2) {
            bodyParts = [WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
        } else if (level === 3) {
            bodyParts = [CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
        } else {
            bodyParts = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, 
                         MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        }
    }
    
    const newName = bodyType + Game.time;
    const creepMemory = { memory: { role: bodyType, homeRoom: roomName } };

    let result = [currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName];
    return result;
};

// Δημιουργία Simple Harvester
createNewSimpleHarvester = function(currentSpawn, rcl, roomName) {
    const energyCapacity = currentSpawn.room.energyCapacityAvailable;
    let bodyParts;
    const bodyType = SIMPLE_HARVESTER_ROLE;
    
    bodyParts = [WORK, CARRY, MOVE];
    
    const newName = bodyType + Game.time;
    const creepMemory = { memory: { role: bodyType, homeRoom: roomName } };

    let result = [currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName];
    return result;
};

// Δημιουργία Static Harvester
createNewStaticHarvester = function(currentSpawn, sourceId, roomName) {
    const energyCapacity = currentSpawn.room.energyCapacityAvailable;
    
    let bodyParts;
    const bodyType = STATIC_HARVESTER_ROLE;
    
    // Προσαρμογή body parts ανάλογα με την διαθέσιμη ενέργεια
    if (energyCapacity >= 600) {
        bodyParts = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE];
    } else if (energyCapacity >= 500) {
        bodyParts = [WORK, WORK, WORK, WORK, CARRY, MOVE];
    } else if (energyCapacity >= 300) {
        bodyParts = [WORK, WORK, CARRY, MOVE];
    } else {
        bodyParts = [WORK, CARRY, MOVE];
    }
    
    const newName = 'SHarv' + Game.time;
    const creepMemory = { memory: { role: bodyType, sourceId: sourceId } };

    let result = [currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName];
    return result;
};

// Δημιουργία Upgrader
createNewUpgrader = function(currentSpawn, rcl, homeroom) {
    const energyCapacity = currentSpawn.room.energyCapacityAvailable;
    let bodyParts;
    const bodyType = 'staticUpgrader';
    
    // Προσαρμογή body parts ανάλογα με την διαθέσιμη ενέργεια
    if (energyCapacity >= 1000) {
        bodyParts = [MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
    } else if (energyCapacity >= 600) {
        bodyParts = [WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
    } else if (energyCapacity >= 400) {
        bodyParts = [WORK, WORK, WORK, CARRY, MOVE];
    } else {
        bodyParts = [WORK, CARRY, MOVE];
    }
    
    const newName = bodyType + Game.time;
    const creepMemory = { memory: { role: bodyType, homeRoom: homeroom } };

    let result = [currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName];
    return result;
};  // end of createNewUpgrader



module.exports = respawController;