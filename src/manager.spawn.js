/*
 * respawController.js - Ελέγχει την ανάγκη και εκτελεί την αναπαραγωγή creeps.
 * 
 * ΣΕΙΡΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ:
 * 1. Static Harvesters (1 για κάθε πηγή) → ΥΨΗΛΟΤΕΡΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ
 * 2. Simple Harvesters (για έκτακτη ανάγκη)
 * 3. Haulers (μεταφορά ενέργειας)
 * 4. Upgraders (αναβάθμιση controller)
 * 5. Long Distance Haulers/Harvesters (για μακρινά δωμάτια)
 * 6. Builders (χτίσιμο) → ΧΑΜΗΛΟΤΕΡΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ
 */

// ===========================================
// ΠΑΡΑΜΕΤΡΟΙ ΣΥΣΤΗΜΑΤΟΣ - ΕΔΩ ΑΛΛΑΖΟΥΜΕ ΤΙΣ ΡΥΘΜΙΣΕΙΣ
// ===========================================

const POPULATION_LIMITS = {
            STATIC_HARVESTER: 2,
            SIMPLE_HARVESTER: 2,    // ΠΡΟΣΘΗΚΗ: Τουλάχιστον 1 simple harvester
            HAULER: 3,
            UPGRADER: 2,
            BUILDER:2,
            LD_HAULER: 0,
            LD_HARVESTER: 0
        };
// Όλοι οι ρόλοι που υποστηρίζει το σύστημα
const ROLES = {
    STATIC_HARVESTER: 'staticHarvester',
    SIMPLE_HARVESTER: 'simpleHarvester',  // ΠΡΟΣΘΗΚΗ
    HAULER: 'hauler',
    UPGRADER: 'upgrader',
    BUILDER: 'builder',
    LD_HARVESTER: 'LDHarvester',
    LD_HAULER: 'LDHauler'
};

// ===========================================
// ΚΥΡΙΟ ΑΝΤΙΚΕΙΜΕΝΟ CONTROLLER
// ===========================================

const respawController = {
    
    /**
     * ΚΥΡΙΑ ΣΥΝΑΡΤΗΣΗ - Τρέχει κάθε 5 ticks για εξοικονόμηση CPU
     */
    run: function(roomName) {
       // console.log(`🔧 RespawController εκτελείται για δωμάτιο: ${roomName}`);
        
        // ΒΗΜΑ 1: ΕΞΟΙΚΟΝΟΜΗΣΗ CPU - Τρέχουμε μόνο κάθε 5 ticks
        if (Game.time % 5 !== 0) {
            return;
        }
        
        // ΒΗΜΑ 2: ΚΑΘΑΡΙΣΜΟΣ ΜΝΗΜΗΣ - Διαγραφή νεκρών creeps
        this.cleanupDeadCreeps(roomName);
        
        // ΒΗΜΑ 3: ΕΥΡΕΣΗ SPAWN - Χρειαζόμαστε spawn για να δημιουργήσουμε creeps
        const spawn = this.findAvailableSpawn(roomName);
        if (!spawn) {
            console.log(`❌ Δεν βρέθηκε διαθέσιμο spawn στο δωμάτιο ${roomName}`);
            return;
        }
        
        // Εάν το spawn είναι απασχολημένο, εμφανίζουμε πληροφορίες και σταματάμε
        if (spawn.spawning) {
            this.showSpawningInfo(spawn);
            return;
        }
        
        if (!Game.rooms[roomName].memory.populationLimits) {     
            this.setPopulationLimits(roomName);
        }
        const populationMax=Game.rooms[roomName].memory.populationLimits;
        
        
        // ΒΗΜΑ 4: ΑΝΑΛΥΣΗ ΤΟΥ ΤΡΕΧΟΝΤΟΣ ΠΛΗΘΥΣΜΟΥ
        const population = this.analyzePopulation(roomName,false);
        
        // ΒΗΜΑ 5: ΕΛΕΓΧΟΣ ΑΝΑΓΚΗΣ ΔΗΜΙΟΥΡΓΙΑΣ ΚΑΙ ΔΗΜΙΟΥΡΓΙΑ CREEP
        this.decideAndSpawnCreep(spawn, roomName, population,populationMax);
    }, // end of run
    setPopulationLimits:function(roomName) { 
        console.log("Initialize population on Room "+roomName);
        const room=Game.rooms[roomName];
        var populationLimits={};
        const sourceCount=room.find(FIND_SOURCES).length;
        populationLimits['SIMPLE_HARVESTER']=2;
        populationLimits['STATIC_HARVESTER']=sourceCount;
        populationLimits['HAULER']=sourceCount;
        populationLimits['UPGRADER']=3;
        populationLimits['BUILDER']=3;
        populationLimits['LD_HARVESTER']=0;
        populationLimits['LD_HAULER']=0;
        room.memory.populationLimits=populationLimits;
        
        
    } //end of setPopulationLimits
    ,
    /**
     * ΒΗΜΑ 2: ΚΑΘΑΡΙΣΜΟΣ ΜΝΗΜΗΣ ΝΕΚΡΩΝ CREEPS
     * Διαγράφει τη μνήμη creeps που έχουν πεθάνει
     */
    cleanupDeadCreeps: function(roomName) {
        let cleanedCount = 0;
        
        for (let creepName in Memory.creeps) {
            if (!Game.creeps[creepName]) {
                const creepMemory = Memory.creeps[creepName];
                
                // Ειδική περίπτωση: Αν ήταν static harvester, απελευθερώνουμε την πηγή
                if (creepMemory.role === ROLES.STATIC_HARVESTER && creepMemory.sourceId) {
                    console.log(`🔌 Απελευθερώθηκε πηγή: ${creepMemory.sourceId} από νεκρό creep: ${creepName}`);
                }
                
                delete Memory.creeps[creepName];
                cleanedCount++;
                console.log(`🚮 Διαγράφηκε μνήμη για νεκρό creep: ${creepName}`);
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Καθαρίστηκαν ${cleanedCount} νεκρά creeps από τη μνήμη`);
        }
    },
    
    /**
     * ΒΗΜΑ 3: ΕΥΡΕΣΗ ΔΙΑΘΕΣΙΜΟΥ SPAWN
     * Βρίσκει το πρώτο διαθέσιμο spawn στο δωμάτιο
     */
    findAvailableSpawn: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) {
            console.log(`❌ Δεν βρέθηκε δωμάτιο: ${roomName}`);
            return null;
        }
        
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) {
            console.log(`❌ Δεν βρέθηκαν spawns στο δωμάτιο: ${roomName}`);
            return null;
        }
        
        // Επιστρέφουμε το πρώτο spawn (μπορείς να αλλάξεις λογική για πολλά spawns)
        return spawns[0];
    },
    
    /**
     * ΕΜΦΑΝΙΣΗ ΠΛΗΡΟΦΟΡΙΩΝ ΓΙΑ CREEP ΠΟΥ ΔΗΜΙΟΥΡΓΕΙΤΑΙ
     */
    showSpawningInfo: function(spawn) {
        const spawningCreep = Game.creeps[spawn.spawning.name];
        if (spawningCreep) {
            // Εμφάνιση οπτικού μηνύματος πάνω από το spawn
            spawn.room.visual.text(
                `🛠️ ${spawningCreep.memory.role}`,
                spawn.pos.x + 1,
                spawn.pos.y,
                { align: 'left', opacity: 0.8 }
            );
            console.log(`⚡ Το spawn ${spawn.name} δημιουργεί: ${spawningCreep.memory.role}`);
        }
    },
    
    /**
     * ΒΗΜΑ 4: ΑΝΑΛΥΣΗ ΤΟΥ ΤΡΕΧΟΝΤΑ ΠΛΗΘΥΣΜΟΥ ΣΤΟ ΔΩΜΑΤΙΟ
     * Μετράει πόσα creeps υπάρχουν από κάθε ρόλο
     */
    analyzePopulation: function(roomName,debug=false) {
        const room = Game.rooms[roomName];
        const allCreeps = room.find(FIND_MY_CREEPS);
        
        // Κατηγοριοποίηση creeps ανά ρόλο
        const population = {
            [ROLES.STATIC_HARVESTER]: allCreeps.filter(c => c.memory.role === ROLES.STATIC_HARVESTER).length,
            [ROLES.SIMPLE_HARVESTER]: allCreeps.filter(c => c.memory.role === ROLES.SIMPLE_HARVESTER).length,
            [ROLES.HAULER]: allCreeps.filter(c => c.memory.role === ROLES.HAULER).length,
            [ROLES.UPGRADER]: allCreeps.filter(c => c.memory.role === ROLES.UPGRADER).length,
            [ROLES.BUILDER]: allCreeps.filter(c => c.memory.role === ROLES.BUILDER).length,
            [ROLES.LD_HARVESTER]: allCreeps.filter(c => c.memory.role === ROLES.LD_HARVESTER).length,
            [ROLES.LD_HAULER]: allCreeps.filter(c => c.memory.role === ROLES.LD_HAULER).length,
            total: allCreeps.length
        };
        if(debug===true) {
            console.log(`📊 Πληθυσμός ${roomName}: Σύνολο ${population.total} creeps`);
            console.log(`   ├── Static Harvesters: ${population[ROLES.STATIC_HARVESTER]}`);
            console.log(`   ├── Simple Harvesters: ${population[ROLES.SIMPLE_HARVESTER]}`);
            console.log(`   ├── Haulers: ${population[ROLES.HAULER]}`);
            console.log(`   ├── Upgraders: ${population[ROLES.UPGRADER]}`);
            console.log(`   ├── Builders: ${population[ROLES.BUILDER]}`);
            console.log(`   └── LD Harvesters/Haulers: ${population[ROLES.LD_HARVESTER]}/${population[ROLES.LD_HAULER]}`);
        }
        return population;
    },
    
    /**
     * ΒΗΜΑ 5: ΛΗΨΗ ΑΠΟΦΑΣΗΣ ΚΑΙ ΔΗΜΙΟΥΡΓΙΑ CREEP
     * Ελέγχει ποιος ρόλος χρειάζεται και δημιουργεί αντίστοιχο creep
     */
    decideAndSpawnCreep: function(spawn, roomName, population,populationLimit, debug=false) {
    const room = spawn.room;
    const rcl = room.controller ? room.controller.level : 1;
    
    //console.log(`🤔 Ελέγχω αν χρειάζεται νέο creep στο ${roomName} (RCL: ${rcl})`);
    
    // ΝΕΑ ΣΕΙΡΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ:
    // 0. SIMPLE HARVESTERS (ΥΨΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ ΣΤΗΝ ΑΡΧΗ)
    if (this.needSimpleHarvester(room, population,populationLimit)) {
        if(debug===true) console.log(`🎯 ΠΡΟΤΕΡΑΙΟΤΗΤΑ 0: Χρειάζεται Simple Harvester`);
       
        return this.createSimpleHarvester(spawn, roomName);
    }
    
    // 1. STATIC HARVESTERS
    if (this.needStaticHarvester(room, population)) {
        
        if (this.needBuilder(room, population)) {
           if(debug===true) console.log(`🎯 ΠΡΟΤΕΡΑΙΟΤΗΤΑ 1.5: Χρειάζεται Builder`);
           return this.createBuilder(spawn, roomName, rcl);
        }
        
        
        if(debug===true) console.log(`🎯 ΠΡΟΤΕΡΑΙΟΤΗΤΑ 1: Χρειάζεται Static Harvester`);
        return this.createStaticHarvester(spawn, roomName);
    }
    
    // 2. HAULERS (ΜΕΤΑΦΟΡΑ ΕΝΕΡΓΕΙΑΣ)
    if (this.needHauler(room, population)) {
        if (this.needBuilder(room, population)) {
           if(debug===true) console.log(`🎯 ΠΡΟΤΕΡΑΙΟΤΗΤΑ 2.5: Χρειάζεται Builder`);
           return this.createBuilder(spawn, roomName, rcl);
        }
        if(debug===true) console.log(`🎯 ΠΡΟΤΕΡΑΙΟΤΗΤΑ 2: Χρειάζεται Hauler`);
        return this.createHauler(spawn, roomName, rcl);
    }
    
    // 3. UPGRADERS
    if (this.needUpgrader(population)) {
        if (this.needBuilder(room, population)) {
           if(debug===true) console.log(`🎯 ΠΡΟΤΕΡΑΙΟΤΗΤΑ 3.5: Χρειάζεται Builder`);
           return this.createBuilder(spawn, roomName, rcl);
        }
        if(debug===true) console.log(`🎯 ΠΡΟΤΕΡΑΙΟΤΗΤΑ 3: Χρειάζεται Upgrader`);
        return this.createUpgrader(spawn, roomName, rcl);
    }
    
    // 4. BUILDERS
    if (this.needBuilder(room, population)) {
        if(debug===true) console.log(`🎯 ΠΡΟΤΕΡΑΙΟΤΗΤΑ 4: Χρειάζεται Builder`);
        return this.createBuilder(spawn, roomName, rcl);
    }
    
    if(debug===true) console.log(`✅ Όλα τα creeps είναι σε καλή κατάσταση. Δεν χρειάζεται νέο creep.`);
},
    
    // ===========================================
    // ΣΥΝΑΡΤΗΣΕΙΣ ΕΛΕΓΧΟΥ ΑΝΑΓΚΗΣ
    // ===========================================
    
    /**
     * ΕΛΕΓΧΟΣ: Χρειαζόμαστε Static Harvester;
     * Κανόνας: 1 Static Harvester για κάθε πηγή στο δωμάτιο
     */
    needStaticHarvester: function(room, population) {
        const sources = room.find(FIND_SOURCES);
        const maxNeeded = sources.length;
        const current = population[ROLES.STATIC_HARVESTER];
        
        //console.log(`   🔍 Static Harvesters: ${current}/${maxNeeded} (${sources.length} πηγές)`);
        return current < maxNeeded;
    },
    
   /**
 * ΕΛΕΓΧΟΣ: Χρειαζόμαστε Simple Harvester (έκτακτη ανάγκη);
 */
needSimpleHarvester: function(room, population) {
    const current = population[ROLES.SIMPLE_HARVESTER];
    const maxAllowed = POPULATION_LIMITS.SIMPLE_HARVESTER;
    
    // Εάν έχουμε ήδη τον μέγιστο αριθμό, δεν χρειαζόμαστε άλλο
    if (current >= maxAllowed) {
        return false;
    }
    
    // ΕΛΕΓΧΟΣ: Αν το spawn έχει πολύ λίγη ενέργεια (< 200) 
    // και δεν υπάρχουν haulers ή static harvesters ακόμα
    const roomEnergy = room.energyAvailable;
    const hasEnoughEnergy = roomEnergy >=250;
    
    // Αν έχουμε πολύ λίγη ενέργεια και δεν έχουμε haulers, χρειαζόμαστε simple harvester
    const needsEmergencyEnergy = !hasEnoughEnergy && population[ROLES.HAULER] === 0;
    
    // Ή αν δεν έχουμε καθόλου harvesters ακόμα
    const noHarvesters = population[ROLES.STATIC_HARVESTER] === 0 && current === 0;
    
    //console.log(`   🔍 Simple Harvesters: ${current}/${maxAllowed}, Room Energy: ${roomEnergy}, Needs Emergency: ${needsEmergencyEnergy}, No Harvesters: ${noHarvesters}`);
    
    return needsEmergencyEnergy || noHarvesters;
},
    
    /**
     * ΕΛΕΓΧΟΣ: Χρειαζόμαστε Hauler;
     */
    // Βελτιωμένη συνάρτηση needHauler
needHauler: function(room, population) {
    const current = population[ROLES.HAULER];
    const maxAllowed = POPULATION_LIMITS.HAULER;

    // Ελέγχουμε αν υπάρχει ενέργεια που χρειάζεται μεταφορά
    const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
        filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount > 100
    }).length;

    const containersWithEnergy = room.find(FIND_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_CONTAINER && 
                       s.store[RESOURCE_ENERGY] > 100
    }).length;

    // Εάν υπάρχει τουλάχιστον ένας harvester, χρειαζόμαστε και hauler
    const hasHarvesters = population[ROLES.STATIC_HARVESTER] > 0;

    // Εάν υπάρχει ενέργεια για μεταφορά ή έχουμε harvesters, χρειαζόμαστε haulers
    const needsHaulers = (droppedEnergy > 0 || containersWithEnergy > 0 || hasHarvesters) && current < maxAllowed;

    //console.log(`   🔍 Haulers: ${current}/${maxAllowed}, Dropped Energy: ${droppedEnergy}, Containers: ${containersWithEnergy}, Has Harvesters: ${hasHarvesters}`);

    return needsHaulers;
},
    
    /**
     * ΕΛΕΓΧΟΣ: Χρειαζόμαστε Upgrader;
     */
    needUpgrader: function(population) {
        const current = population[ROLES.UPGRADER];
        const maxAllowed = POPULATION_LIMITS.UPGRADER;
        
      //  console.log(`   🔍 Upgraders: ${current}/${maxAllowed}`);
        return current < maxAllowed;
    },
    
    /**
     * ΕΛΕΓΧΟΣ: Χρειαζόμαστε Long Distance Team;
     * Κανόνας: Μόνο για RCL >= 4
     */
    needLongDistanceTeam: function(population, rcl) {
        if (rcl < 4) {
            console.log(`   🔍 Long Distance: Απενεργοποιημένο (RCL < 4)`);
            return false;
        }
        
        const needHauler = population[ROLES.LD_HAULER] < POPULATION_LIMITS.LD_HAULER;
        const needHarvester = population[ROLES.LD_HARVESTER] < POPULATION_LIMITS.LD_HARVESTER;
        
        //console.log(`   🔍 Long Distance: Harvesters ${population[ROLES.LD_HARVESTER]}/${POPULATION_LIMITS.LD_HARVESTER}, Haulers ${population[ROLES.LD_HAULER]}/${POPULATION_LIMITS.LD_HAULER}`);
        
        return needHauler || needHarvester;
    },
    
    /**
     * ΕΛΕΓΧΟΣ: Χρειαζόμαστε Builder;
     * Κανόνας: Μόνο αν υπάρχουν construction sites ή έχουμε μόνο 1 builder
     */
    needBuilder: function(room, population) {
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        const current = population[ROLES.BUILDER];
        const maxAllowed = POPULATION_LIMITS.BUILDER;
        
        const hasWork = constructionSites.length > 0;
        const underLimit = current < maxAllowed;
        
        //console.log(`   🔍 Builders: ${current}/${maxAllowed}, Construction Sites: ${constructionSites.length}`);
        
        return underLimit && (hasWork || current === 0);
    },
    
    // ===========================================
    // ΣΥΝΑΡΤΗΣΕΙΣ ΔΗΜΙΟΥΡΓΙΑΣ CREEPS
    // ===========================================
    
    /**
     * ΔΗΜΙΟΥΡΓΙΑ STATIC HARVESTER
     * Σκοπός: Mining σε συγκεκριμένη πηγή
     */
    createStaticHarvester: function(spawn, roomName) {
        const room = spawn.room;
        const sources = room.find(FIND_SOURCES);
        
        // Βρίσκουμε ελεύθερη πηγή (που δεν έχει harvester)
        const existingHarvesters = _.filter(Game.creeps, creep => 
            creep.memory.role === ROLES.STATIC_HARVESTER && creep.memory.homeRoom === roomName
        );
        
        const assignedSources = existingHarvesters.map(creep => creep.memory.sourceId);
        const freeSource = sources.find(source => !assignedSources.includes(source.id));
        
        if (!freeSource) {
            console.log(`❌ Δεν βρέθηκε ελεύθερη πηγή για Static Harvester`);
            return false;
        }
        
        console.log(`✅ Βρέθηκε ελεύθερη πηγή: ${freeSource.id}`);
        
        // Ορισμός body parts ανάλογα με την διαθέσιμη ενέργεια
        const energy = spawn.room.energyCapacityAvailable;
        let body;
        
        if (energy >= 600) {
            body = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE]; // 600 energy
            console.log(`   🔧 Body: 5xWORK, 1xCARRY, 1xMOVE (600 energy)`);
        } else if (energy >= 500) {
            body = [WORK, WORK, WORK, WORK, CARRY, MOVE]; // 500 energy
            console.log(`   🔧 Body: 4xWORK, 1xCARRY, 1xMOVE (500 energy)`);
        } else if (energy >= 300) {
            body = [WORK, WORK, CARRY, MOVE]; // 300 energy
            console.log(`   🔧 Body: 2xWORK, 1xCARRY, 1xMOVE (300 energy)`);
        } else {
            body = [WORK, CARRY, MOVE]; // 200 energy
            console.log(`   🔧 Body: 1xWORK, 1xCARRY, 1xMOVE (200 energy)`);
        }
        
        const creepName = `StaticHarvester_${Game.time}`;
        const memory = {
            role: ROLES.STATIC_HARVESTER,
            sourceId: freeSource.id,
            homeRoom: roomName,
            working: false
        };
        
        console.log(`🛠️ Δημιουργία Static Harvester: ${creepName} για πηγή ${freeSource.id}`);
        const result = spawn.spawnCreep(body, creepName, { memory: memory });
        
        if (result === OK) {
            console.log(`✅ Επιτυχής έναρξη δημιουργίας Static Harvester: ${creepName}`);
        } else {
            console.log(`❌ Σφάλμα δημιουργίας Static Harvester: ${result}`);
        }
        
        return result === OK;
    },
    
    /**
 * ΔΗΜΙΟΥΡΓΙΑ SIMPLE HARVESTER
 * Σκοπός: Έκτακτη ανάγκη, απλό mining και μεταφορά
 */
createSimpleHarvester: function(spawn, roomName) {
    // Απλό body που μπορεί να μαζέψει και να μεταφέρει ενέργεια
    const body = [WORK, CARRY, MOVE]; 
    const creepName = `SimpleHarvester_${Game.time}`;
    const memory = {
        role: ROLES.SIMPLE_HARVESTER,
        homeRoom: roomName,
        working: false
    };
    
    console.log(`🛠️ Δημιουργία Simple Harvester: ${creepName}`);
    const result = spawn.spawnCreep(body, creepName, { memory: memory });
    
    if (result === OK) {
        console.log(`✅ Επιτυχής έναρξη δημιουργίας Simple Harvester: ${creepName}`);
    } else {
        console.log(`❌ Σφάλμα δημιουργίας Simple Harvester: ${result}`);
    }
    
    return result === OK;
},
    
    /**
     * ΔΗΜΙΟΥΡΓΙΑ HAULER
     * Σκοπός: Μεταφορά ενέργειας από harvesters σε spawn & extensions
     */
    createHauler: function(spawn, roomName, rcl,maxPreferredEnergy=1200) {
        
        var energy = spawn.room.energyCapacityAvailable;
        
        
        const costs={ WORK:100, CARRY:50, MOVE:50};
        energy=Math.min(energy,maxPreferredEnergy);
        
        const CORE_BODY=[CARRY,MOVE];
        const CORE_COST=costs.CARRY+costs.MOVE;
        
        if (energy<CORE_BODY) {
            return ERROR_NOTENOUGH_ENERGY;
        }
        let body=[];
         let currentCost=0;
         while((currentCost+CORE_COST)<=energy ) {
             body.push(...CORE_BODY);
             currentCost+=CORE_COST;
         }
        
         while((currentCost+costs.MOVE)<=energy ) {
             body.push(MOVE);
             currentCost+=costs.MOVE;
         }
        
        
        
        // if (energy<=300 ) {
        //     body = [MOVE, CARRY, CARRY, MOVE, MOVE]; // 250 energy
        //     console.log(`   🔧 Body: 1xWORK, 2xCARRY, 2xMOVE (RCL 1)`);
        // } else if (energy<=550 ) {
        //     body = [ CARRY, CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE, MOVE, MOVE]; // 450 energy
        //     console.log(`   🔧 Body: 1xWORK, 2xCARRY, 3xMOVE (RCL 2)`);
        // } else if (energy<=800) {
        //     body = [CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE]; // 500 energy
        //     console.log(`   🔧 Body: 5xCARRY, 5xMOVE (RCL 3)`);
        // } else {
        //     // RCL 4 και πάνω - μεγαλύτερα bodies
        //     body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, 
        //           MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]; // 800 energy
        //     console.log(`   🔧 Body: 8xCARRY, 8xMOVE (RCL 4+)`);
        // }
        
        
        
        const creepName = `Hauler_${Game.time}`;
        const memory = {
            role: ROLES.HAULER,
            homeRoom: roomName,
            working: false
        };
        
        console.log(`🛠️ Δημιουργία Hauler: ${creepName}`);
        const result = spawn.spawnCreep(body, creepName, { memory: memory });
        
        if (result === OK) {
            console.log(`✅ Επιτυχής έναρξη δημιουργίας Hauler: ${creepName}`);
        } else {
            console.log(`❌ Σφάλμα δημιουργίας Hauler: ${result}`);
        }
        
        return result === OK;
    },
    
    /**
     * ΔΗΜΙΟΥΡΓΙΑ UPGRADER
     * Σκοπός: Αναβάθμιση controller
     */
    createUpgrader: function(spawn, roomName, rcl) {
        let body;
        const energy = spawn.room.energyCapacityAvailable;
        
        if (energy >= 1000) {
            body = [MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
            console.log(`   🔧 Body: 5xMOVE, 5xWORK, 6xCARRY (1000 energy)`);
        } else if (energy >= 600) {
            body = [WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
            console.log(`   🔧 Body: 3xWORK, 4xCARRY, 4xMOVE (600 energy)`);
        } else if (energy >= 400) {
            body = [WORK, WORK, WORK, CARRY, MOVE];
            console.log(`   🔧 Body: 3xWORK, 1xCARRY, 1xMOVE (400 energy)`);
        } else {
            body = [WORK, CARRY, MOVE];
            console.log(`   🔧 Body: 1xWORK, 1xCARRY, 1xMOVE (200 energy)`);
        }
        
        const creepName = `Upgrader_${Game.time}`;
        const memory = {
            role: ROLES.UPGRADER,
            homeRoom: roomName,
            working: false
        };
        
        console.log(`🛠️ Δημιουργία Upgrader: ${creepName}`);
        const result = spawn.spawnCreep(body, creepName, { memory: memory });
        
        if (result === OK) {
            console.log(`✅ Επιτυχής έναρξη δημιουργίας Upgrader: ${creepName}`);
        } else {
            console.log(`❌ Σφάλμα δημιουργίας Upgrader: ${result}`);
        }
        
        return result === OK;
    },
    
    /**
     * ΔΗΜΙΟΥΡΓΙΑ BUILDER
     * Σκοπός: Χτίσιμο structures
     */
    createBuilder: function(spawn, roomName, rcl) {
        const energy = spawn.room.energyCapacityAvailable;
        let body = [];
        
        // Βασικό body part κοστίζει 200 energy (WORK+CARRY+MOVE)
        const CORE_BODY = [WORK, CARRY, MOVE];
        const CORE_COST = 200;
        
        let currentCost = 0;
        
        // Προσθέτουμε όσο περισσότερα core bodies μπορούμε
        while (currentCost + CORE_COST <= energy) {
            body = body.concat(CORE_BODY);
            currentCost += CORE_COST;
        }
        
        // Προσθέτουμε επιπλέον CARRY+MOVE αν χωράει
        while (currentCost + 100 <= energy) { // CARRY(50) + MOVE(50) = 100
            body.push(CARRY, MOVE);
            currentCost += 100;
        }
        
        // Ταξινόμηση για καλύτερη οπτική
        body.sort();
        
        console.log(`   🔧 Body: ${body.length} parts (${currentCost}/${energy} energy)`);
        
        const creepName = `Builder_${Game.time}`;
        const memory = {
            role: ROLES.BUILDER,
            homeRoom: roomName,
            working: false
        };
        
        console.log(`🛠️ Δημιουργία Builder: ${creepName}`);
        const result = spawn.spawnCreep(body, creepName, { memory: memory });
        
        if (result === OK) {
            console.log(`✅ Επιτυχής έναρξη δημιουργίας Builder: ${creepName}`);
        } else {
            console.log(`❌ Σφάλμα δημιουργίας Builder: ${result}`);
        }
        
        return result === OK;
    },
    
    /**
     * ΔΗΜΙΟΥΡΓΙΑ LONG DISTANCE HAULER
     * Σκοπός: Μεταφορά από μακρινά δωμάτια
     */
    createLongDistanceHauler: function(spawn, roomName) {
        const body = [WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, 
                     MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        
        const creepName = `LDHauler_${Game.time}`;
        const memory = {
            role: ROLES.LD_HAULER,
            homeRoom: roomName,
            working: false
        };
        
        console.log(`🛠️ Δημιουργία Long Distance Hauler: ${creepName}`);
        const result = spawn.spawnCreep(body, creepName, { memory: memory });
        
        if (result === OK) {
            console.log(`✅ Επιτυχής έναρξη δημιουργίας LD Hauler: ${creepName}`);
        } else {
            console.log(`❌ Σφάλμα δημιουργίας LD Hauler: ${result}`);
        }
        
        return result === OK;
    },
    
    /**
     * ΔΗΜΙΟΥΡΓΙΑ LONG DISTANCE HARVESTER
     * Σκοπός: Mining σε μακρινά δωμάτια
     */
    createLongDistanceHarvester: function(spawn, roomName) {
        const body = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, 
                     MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        
        const creepName = `LDHarvester_${Game.time}`;
        const memory = {
            role: ROLES.LD_HARVESTER,
            homeRoom: roomName,
            working: false
        };
        
        console.log(`🛠️ Δημιουργία Long Distance Harvester: ${creepName}`);
        const result = spawn.spawnCreep(body, creepName, { memory: memory });
        
        if (result === OK) {
            console.log(`✅ Επιτυχής έναρξη δημιουργίας LD Harvester: ${creepName}`);
        } else {
            console.log(`❌ Σφάλμα δημιουργίας LD Harvester: ${result}`);
        }
        
        return result === OK;
    },
    
    /**
     * ΒΟΗΘΗΤΙΚΗ: Επιστρέφει τα default population settings
     */
    getDefaultPopulation: function() {
        return POPULATION_LIMITS;
    }
};

// ===========================================
// ΕΞΑΓΩΓΗ ΤΟΥ MODULE
// ===========================================

module.exports = respawController;