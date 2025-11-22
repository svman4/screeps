/*
 * manager.spawn.js
 */

// Όλοι οι ρόλοι που υποστηρίζει το σύστημα
const ROLES = {
    STATIC_HARVESTER: 'staticHarvester',
    SIMPLE_HARVESTER: 'simpleHarvester',  
    HAULER: 'hauler',
    UPGRADER: 'upgrader',
    BUILDER: 'builder',
    LD_HARVESTER: 'LDHarvester',
    LD_HAULER: 'LDHauler',
    CLAIMER: 'claimer', // <--- ΝΕΟΣ ΡΟΛΟΣ
    SCOUT: 'scout' // <--- ΝΕΟ
};

const respawController = {
    
    run: function(roomName) {
        // ΒΗΜΑ 1: ΕΞΟΙΚΟΝΟΜΗΣΗ CPU - Τρέχουμε μόνο κάθε 5 ticks
        if (Game.time % 5 !== 0) {
            return;
        }
        const roomMemory = Memory.rooms[roomName];
        if (!roomMemory || !roomMemory.populationLimits) {
            initPopulation(roomName);
        }
        
        // ΒΗΜΑ 2: ΚΑΘΑΡΙΣΜΟΣ ΜΝΗΜΗΣ
        this.cleanupDeadCreeps(roomName);
        
        // ΒΗΜΑ 3: ΕΥΡΕΣΗ SPAWN
        const spawn = this.findAvailableSpawn(roomName);
        if (!spawn) return;
        
        if (spawn.spawning) {
            this.showSpawningInfo(spawn);
            return;
        }
        
        const populationMax = Memory.rooms[roomName].populationLimits;
        
        // ΒΗΜΑ 4: ΑΝΑΛΥΣΗ ΠΛΗΘΥΣΜΟΥ
        const population = this.analyzePopulation(roomName, false);
        
        // ΒΗΜΑ 5: ΛΗΨΗ ΑΠΟΦΑΣΗΣ
        this.decideAndSpawnCreep(spawn, roomName, population, populationMax);
    },

    cleanupDeadCreeps: function(roomName) {
        for (let creepName in Memory.creeps) {
            if (!Game.creeps[creepName]) {
                const creepMemory = Memory.creeps[creepName];
                if (creepMemory.role === ROLES.STATIC_HARVESTER && creepMemory.sourceId) {
                    console.log(`🔌 Απελευθερώθηκε πηγή: ${creepMemory.sourceId} από νεκρό creep: ${creepName}`);
                }
                delete Memory.creeps[creepName];
            }
        }
    },
    
    findAvailableSpawn: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return null;
        const spawns = room.find(FIND_MY_SPAWNS);
        return spawns.length > 0 ? spawns[0] : null;
    },
    
    showSpawningInfo: function(spawn) {
        const spawningCreep = Game.creeps[spawn.spawning.name];
        if (spawningCreep) {
            spawn.room.visual.text(
                `🛠️ ${spawningCreep.memory.role}`,
                spawn.pos.x + 1,
                spawn.pos.y,
                { align: 'left', opacity: 0.8 }
            );
        }
    },
    
    analyzePopulation: function(roomName, debug=false) {
        const allCreeps = _.filter(Game.creeps, (creep) => creep.memory.homeRoom === roomName);
        
        const population = {
            [ROLES.STATIC_HARVESTER]: allCreeps.filter(c => c.memory.role === ROLES.STATIC_HARVESTER).length,
            [ROLES.SIMPLE_HARVESTER]: allCreeps.filter(c => c.memory.role === ROLES.SIMPLE_HARVESTER).length,
            [ROLES.HAULER]: allCreeps.filter(c => c.memory.role === ROLES.HAULER).length,
            [ROLES.UPGRADER]: allCreeps.filter(c => c.memory.role === ROLES.UPGRADER).length,
            [ROLES.BUILDER]: allCreeps.filter(c => c.memory.role === ROLES.BUILDER).length,
            [ROLES.LD_HARVESTER]: allCreeps.filter(c => c.memory.role === ROLES.LD_HARVESTER).length,
            [ROLES.LD_HAULER]: allCreeps.filter(c => c.memory.role === ROLES.LD_HAULER).length,
            [ROLES.CLAIMER]: allCreeps.filter(c => c.memory.role === ROLES.CLAIMER).length,
            total: allCreeps.length
        };
        return population;
    },
    
    decideAndSpawnCreep: function(spawn, roomName, population, populationLimit, debug=false) {
        const room = spawn.room;
        const rcl = room.controller ? room.controller.level : 1;
        
        // 0. SIMPLE HARVESTERS
        if (this.needSimpleHarvester(room, population, populationLimit)) {
            return this.createSimpleHarvester(spawn, roomName);
        }
        
        // 1. STATIC HARVESTERS
        if (this.needStaticHarvester(room, population, populationLimit)) {
            if (this.needBuilder(room, population, populationLimit)) {
               return this.createBuilder(spawn, roomName, rcl);
            }
            return this.createStaticHarvester(spawn, roomName);
        }
        
        // 2. HAULERS
        if (this.needHauler(room, population, populationLimit)) {
            if (this.needBuilder(room, population, populationLimit)) {
               return this.createBuilder(spawn, roomName, rcl);
            }
            return this.createHauler(spawn, roomName, rcl);
        }
const scoutTarget = _.findKey(Memory.rooms, (r) => r.scoutNeeded === true);
        
        if (scoutTarget) {
             // Έλεγχος αν υπάρχει ήδη ζωντανός scout για αυτό το δωμάτιο
             const existingScout = _.find(Game.creeps, c => c.memory.role === ROLES.SCOUT && c.memory.targetRoom === scoutTarget);
             
             if (!existingScout) {
                 console.log(`🔭 Spawning Scout για ${scoutTarget}`);
                 return this.createScout(spawn, roomName, scoutTarget);
             }
        }
        // --- ΕΛΕΓΧΟΣ ΓΙΑ EXPANSION / CLAIMER ---
        // Ψάχνουμε αν υπάρχει δωμάτιο στη μνήμη που θέλει CLAIM
        const claimTarget = _.findKey(Memory.rooms, (r) => r.type === 'claim_target');
        
        if (claimTarget) {
            // Ελέγχουμε αν έχουμε ήδη claimer για αυτό το δωμάτιο
            // Ψάχνουμε σε ΟΛΑ τα creeps (όχι μόνο του δωματίου) για να μην φτιάχνουν όλα τα rooms claimers
            const existingClaimer = _.find(Game.creeps, c => c.memory.role === ROLES.CLAIMER && c.memory.targetRoom === claimTarget);
            
            if (!existingClaimer) {
                console.log(`🎯 EXPANSION: Δημιουργία Claimer για το ${claimTarget} από το δωμάτιο ${roomName}`);
                // Προσπαθούμε να τον φτιάξουμε
                const result = this.createClaimer(spawn, roomName, claimTarget);
                if (result) return; // Αν πέτυχε ή προσπάθησε, σταματάμε εδώ
            }
        }
        // ---------------------------------------
        const setupRoomName = _.findKey(Memory.rooms, (r) => r.type === 'initial_setup');
        
        if (setupRoomName) {
            const setupRoom = Game.rooms[setupRoomName];
            
            // Έλεγχος τερματισμού: Αν το δωμάτιο έφτασε RCL 2
            if (setupRoom && setupRoom.controller && setupRoom.controller.level >= 2) {
                console.log(`🎉 Room ${setupRoomName} reached RCL 2! Initial setup complete. Stopping remote spawning.`);
                delete Memory.rooms[setupRoomName].type;
                return;
            }
            
            // Ανάλυση πληθυσμού που στέλνουμε στο νέο δωμάτιο
            const setupRoomCreeps = _.filter(Game.creeps, c => c.memory.homeRoom === setupRoomName);
            
            const builders = setupRoomCreeps.filter(c => c.memory.role === ROLES.BUILDER).length;

            const HARVESTER_LIMIT = 2; // Χρειάζεται ενέργεια
            const BUILDER_LIMIT = 4;   // Χρειάζεται γρήγορο χτίσιμο Spawn/Extensions
            
            
            
            // 2. Προτεραιότητα: Builder
            if (builders < BUILDER_LIMIT) {
                 console.log(`🚧 Spawning Builder for setup room ${setupRoomName}`);
                 // Χρησιμοποιούμε τη συνάρτηση createBuilder, περνώντας το όνομα του νέου δωματίου ως homeRoom
                 return this.createBuilder(spawn, setupRoomName, 1); 
            }
        }
        // 3. UPGRADERS
        if (this.needUpgrader(population, populationLimit)) {
            if (this.needBuilder(room, population, populationLimit)) {
               return this.createBuilder(spawn, roomName, rcl);
            }
            return this.createUpgrader(spawn, roomName, rcl);
        }
        
        // 4. BUILDERS
        if (this.needBuilder(room, population, populationLimit)) {
            return this.createBuilder(spawn, roomName, rcl);
        }
    },
    
    // --- Checks ---

    needStaticHarvester: function(room, population, populationMax) {
        const maxNeeded = populationMax.STATIC_HARVESTER;
        const current = population[ROLES.STATIC_HARVESTER];
        return current < maxNeeded;
    },
    
    needSimpleHarvester: function(room, population, populationMax) {
        const current = population[ROLES.SIMPLE_HARVESTER];
        const maxAllowed = populationMax.SIMPLE_HARVESTER;
        if (current >= maxAllowed) return false;
        
        const roomEnergy = room.energyAvailable;
        const hasEnoughEnergy = roomEnergy >= 250;
        const needsEmergencyEnergy = !hasEnoughEnergy && population[ROLES.HAULER] === 0;
        const noHarvesters = population[ROLES.STATIC_HARVESTER] === 0 && current === 0;
        
        return needsEmergencyEnergy || noHarvesters;
    },
    
    needHauler: function(room, population, populationMax) {
        const current = population[ROLES.HAULER];
        const maxAllowed = populationMax.HAULER;
        
        const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
            filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount > 100
        }).length;

        const containersWithEnergy = room.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 100
        }).length;

        const hasHarvesters = population[ROLES.STATIC_HARVESTER] > 0;
        const needsHaulers = (droppedEnergy > 0 || containersWithEnergy > 0 || hasHarvesters) && current < maxAllowed;

        return needsHaulers;
    },
    
    needUpgrader: function(population, populationMax) {
        return population[ROLES.UPGRADER] < populationMax.UPGRADER;
    },
    
    needBuilder: function(room, population, populationMax) {
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        const current = population[ROLES.BUILDER];
        const maxAllowed = populationMax.BUILDER;
        
        const hasWork = constructionSites.length > 0;
        const underLimit = current < maxAllowed;
        
        return underLimit && (hasWork || current === 0);
    },
    
    // --- Spawns ---

    createStaticHarvester: function(spawn, roomName) {
        const room = spawn.room;
        const sources = room.find(FIND_SOURCES);
        const existingHarvesters = _.filter(Game.creeps, creep => 
            creep.memory.role === ROLES.STATIC_HARVESTER && creep.memory.homeRoom === roomName
        );
        
        const assignedSources = existingHarvesters.map(creep => creep.memory.sourceId);
        const freeSource = sources.find(source => !assignedSources.includes(source.id));
        
        if (!freeSource) return false;
        
        const energy = spawn.room.energyCapacityAvailable;
        let body;
        
        if (energy >= 600) body = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE];
        else if (energy >= 500) body = [WORK, WORK, WORK, WORK, CARRY, MOVE];
        else if (energy >= 300) body = [WORK, WORK, CARRY, MOVE];
        else body = [WORK, CARRY, MOVE];
        
        const creepName = `StaticHarvester_${Game.time}`;
        return spawn.spawnCreep(body, creepName, { 
            memory: { role: ROLES.STATIC_HARVESTER, sourceId: freeSource.id, homeRoom: roomName, working: false } 
        }) === OK;
    },
    
    createSimpleHarvester: function(spawn, roomName) {
        const body = [WORK, CARRY, MOVE]; 
        const creepName = `SimpleHarvester_${Game.time}`;
        return spawn.spawnCreep(body, creepName, { 
            memory: { role: ROLES.SIMPLE_HARVESTER, homeRoom: roomName, working: false } 
        }) === OK;
    },
    createScout: function(spawn, homeRoom, targetRoom) {
        // Το πιο φθηνό creep: Μόνο 1 MOVE (50 energy)
        const body = [MOVE];
        const creepName = `Scout_${targetRoom}_${Game.time}`;
        
        return spawn.spawnCreep(body, creepName, { 
            memory: { 
                role: ROLES.SCOUT, 
                homeRoom: homeRoom, 
                targetRoom: targetRoom 
            } 
        }) === OK;
    },
    createHauler: function(spawn, roomName, rcl, maxPreferredEnergy=1200) {
        let energy = spawn.room.energyCapacityAvailable;
        energy = Math.min(energy, maxPreferredEnergy);
        const CORE_BODY = [CARRY, MOVE];
        const CORE_COST = 100;
        
        if (energy < CORE_COST) return ERR_NOT_ENOUGH_ENERGY;
        
        let body = [];
        let currentCost = 0;
        while((currentCost + CORE_COST) <= energy) {
            body.push(...CORE_BODY);
            currentCost += CORE_COST;
        }
        
        const creepName = `Hauler_${Game.time}`;
        body.sort();
        return spawn.spawnCreep(body, creepName, { 
            memory: { role: ROLES.HAULER, homeRoom: roomName, working: false } 
        }) === OK;
    },
    
    createUpgrader: function(spawn, roomName, rcl, maxPreferredEnergy=1000) {
        let energy = spawn.room.energyCapacityAvailable;
        energy = Math.min(energy, maxPreferredEnergy);
        const CORE_BODY = [WORK, CARRY, MOVE, MOVE]; // 250
        const CORE_COST = 250;
        
        let body = [];
        let currentCost = 0;
        
        while (currentCost + CORE_COST <= energy) {
            body = body.concat(CORE_BODY);
            currentCost += CORE_COST;
        }
        while (currentCost + 100 <= energy) {
            body.push(CARRY, MOVE);
            currentCost += 100;
        }
        
        body.sort();
        const creepName = `Upgrader_${Game.time}`;
        return spawn.spawnCreep(body, creepName, { 
            memory: { role: ROLES.UPGRADER, homeRoom: roomName, working: false } 
        }) === OK;
    },
    
    createBuilder: function(spawn, roomName, rcl, maxPreferredEnergy=1000) {
        let energy = spawn.room.energyCapacityAvailable;
        energy = Math.min(energy, maxPreferredEnergy);
        const CORE_BODY = [WORK, CARRY, MOVE, MOVE];
        const CORE_COST = 250;
        
        let body = [];
        let currentCost = 0;
        
        while (currentCost + CORE_COST <= energy) {
            body = body.concat(CORE_BODY);
            currentCost += CORE_COST;
        }
        while (currentCost + 100 <= energy) {
            body.push(CARRY, MOVE);
            currentCost += 100;
        }
        
        body.sort();
        const creepName = `Builder_${Game.time}`;
        return spawn.spawnCreep(body, creepName, { 
            memory: { role: ROLES.BUILDER, homeRoom: roomName, working: false } 
        }) === OK;
    },

    /**
     * ΔΗΜΙΟΥΡΓΙΑ CLAIMER
     * Απαιτείται RCL 3 (Energy Capacity >= 650)
     */
   createClaimer: function(spawn, homeRoom, targetRoom) {
        const energy = spawn.room.energyCapacityAvailable;
        
        // Έλεγχος για υβριδικό Claimer/Builder
        if (energy < 800) {
            // Fallback σε απλό Claimer (αν έχει τουλάχιστον 650 energy)
            if (energy >= 650) {
                 const creepName = `Claimer_${targetRoom}_${Game.time}`;
                 const memory = { role: ROLES.CLAIMER, homeRoom: homeRoom, targetRoom: targetRoom, isBuilder: false };
                 const body = (energy >= 700) ? [CLAIM, MOVE, MOVE] : [CLAIM, MOVE];
                 console.log(`🚩 Spawning minimal Claimer for ${targetRoom} (Cost: ${body.reduce((c,p)=>c+BODYPART_COST[p],0)})`);
                 return spawn.spawnCreep(body, creepName, { memory: memory }) === OK;
            }
            console.log(`⚠️ Cannot spawn Claimer/Builder. Needs 800 energy. Has ${energy}.`);
            return false;
        }

        // Στόχευση σε καλό Claimer/Builder (π.χ. μέχρι 1500 energy)
        let maxEnergy = Math.min(energy, 1500); 
        
        let body = [CLAIM, MOVE]; // 650 cost (το CLAIM είναι το πιο σημαντικό)
        let currentCost = 650;
        
        // Προσθήκη WORK/CARRY/MOVE τριπλέτας για building
        const BUILDER_PART = [WORK, CARRY, MOVE]; // 200 cost
        const BUILDER_COST = 200;

        while (currentCost + BUILDER_COST <= maxEnergy) {
            body = body.concat(BUILDER_PART);
            currentCost += BUILDER_COST;
        }

        const creepName = `ClaimerBuilder_${targetRoom}_${Game.time}`;
        const memory = {
            role: ROLES.CLAIMER,
            homeRoom: homeRoom,
            targetRoom: targetRoom,
            isBuilder: true, // ΝΕΟ Flag: Έχει builder parts
            building: false // State για τη λογική building/refilling
        };
        
        body.sort();
        console.log(`🚩 Spawning Claimer/Builder for ${targetRoom} (Cost: ${currentCost})`);
        return spawn.spawnCreep(body, creepName, { memory: memory }) === OK;
    },
};

function initPopulation(roomName) {
    console.log("Initialize population on Room " + roomName);
    const room = Game.rooms[roomName];
    if (!room) return;
    
    var populationLimits = {};
    const sourceCount = room.find(FIND_SOURCES).length;
    
    populationLimits['SIMPLE_HARVESTER'] = 2;
    populationLimits['STATIC_HARVESTER'] = sourceCount;
    populationLimits['HAULER'] = sourceCount;
    populationLimits['UPGRADER'] = 1;
    populationLimits['BUILDER'] = 2;
    populationLimits['LD_HARVESTER'] = 0;
    populationLimits['LD_HAULER'] = 0;
    populationLimits['CLAIMER'] = 0; // Δυναμικός έλεγχος, δεν χρειάζεται όριο εδώ
    
    if (!room.memory.populationLimits) {
        room.memory.populationLimits = populationLimits;
    }
};

module.exports = respawController;