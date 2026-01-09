/**
 * @file manager.role.js
 * @description Σύστημα διαχείρισης ρόλων Creeps με εξελιγμένο Pathfinding (CostMatrix) 
 * και αυτόματη αποφυγή εμποδίων.
 */

const minTickToLive = 30;

/** * @section GLOBAL PATHFINDING CACHE 
 * Αποθήκευση των CostMatrix για μείωση του CPU usage.
 */
let matrixCache = {}; 
let lastMatrixUpdate = {};

/**
 * @namespace MoveUtils
 * @description Βοηθητικές συναρτήσεις για την κίνηση και την εύρεση μονοπατιών.
 */
const MoveUtils = {
    /**
     * Δημιουργεί ή ανακτά ένα CostMatrix για ένα συγκεκριμένο δωμάτιο.
     * Λαμβάνει υπόψη δρόμους (cost 1) και στατικά εμπόδια (cost 255).
     * * @param {string} roomName - Το όνομα του δωματίου.
     * @returns {PathFinder.CostMatrix} Το matrix με τα κόστη μετακίνησης.
     */
    getRoomCostMatrix: function(roomName) {
        // Χρήση cache αν το matrix ενημερώθηκε τα τελευταία 50 ticks
        if (matrixCache[roomName] && lastMatrixUpdate[roomName] > Game.time - 50) {
            return matrixCache[roomName];
        }

        const room = Game.rooms[roomName];
        if (!room) return new PathFinder.CostMatrix;

        const costs = new PathFinder.CostMatrix;

        // 1. Καταγραφή υπαρχουσών δομών (Structures)
        room.find(FIND_STRUCTURES).forEach(function(struct) {
            if (struct.structureType === STRUCTURE_ROAD) {
                // Οι δρόμοι έχουν το ελάχιστο κόστος
                costs.set(struct.pos.x, struct.pos.y, 1);
            } else if (struct.structureType !== STRUCTURE_CONTAINER && 
                       (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                // Όλα τα άλλα (εκτός containers/ramparts μας) είναι αδιάβατα
                costs.set(struct.pos.x, struct.pos.y, 0xff);
            }
        });

        // 2. Καταγραφή υπό κατασκευή δομών (Construction Sites)
        room.find(FIND_MY_CONSTRUCTION_SITES).forEach(function(site) {
             if (site.structureType !== STRUCTURE_ROAD && 
                 site.structureType !== STRUCTURE_CONTAINER && 
                 site.structureType !== STRUCTURE_RAMPART) {
                 costs.set(site.pos.x, site.pos.y, 0xff);
             }
        });

        matrixCache[roomName] = costs;
        lastMatrixUpdate[roomName] = Game.time;

        return costs;
    },

    /**
     * Έξυπνη κίνηση με ανίχνευση "κολλήματος" (stuck detection).
     * Αν το creep κολλήσει, επανυπολογίζει το μονοπάτι θεωρώντας τα άλλα creeps ως εμπόδια.
     * * @param {Creep} creep - Το creep που κινείται.
     * @param {Object|RoomPosition} targetObj - Ο στόχος (αντικείμενο ή θέση).
     * @param {number} [range=1] - Η απόσταση στην οποία θέλουμε να φτάσουμε.
     */
    smartMove: function(creep, targetObj, range = 1) {
    if (creep.fatigue > 0) return;

    const targetPos = targetObj.pos || targetObj;
    if (creep.pos.inRangeTo(targetPos, range)) return;

    // Stuck Detection
    if (!creep.memory._lastPos || creep.memory._lastPos.x !== creep.pos.x || creep.memory._lastPos.y !== creep.pos.y) {
        creep.memory._lastPos = { x: creep.pos.x, y: creep.pos.y };
        creep.memory._stuckCount = 0;
    } else {
        creep.memory._stuckCount = (creep.memory._stuckCount || 0) + 1;
    }

    // Αν κολλήσει έστω και 1 tick, ενεργοποιούμε την αποφυγή
    const isStuck = creep.memory._stuckCount >= 1; 

    const ret = PathFinder.search(
        creep.pos, 
        { pos: targetPos, range: range },
        {
            plainCost: 2,
            swampCost: 10,
            roomCallback: (roomName) => {
                let costs = this.getRoomCostMatrix(roomName).clone(); // Πάντα clone για ασφάλεια
                
                // Αν είμαστε stuck, προσθέτουμε ΟΛΑ τα creeps ως αδιάβατα (255)
                if (isStuck) {
                    const room = Game.rooms[roomName];
                    if (room) {
                        room.find(FIND_CREEPS).forEach(c => {
                            costs.set(c.pos.x, c.pos.y, 0xff);
                        });
                        // Επίσης τα Power Creeps αν υπάρχουν
                        room.find(FIND_POWER_CREEPS).forEach(c => {
                            costs.set(c.pos.x, c.pos.y, 0xff);
                        });
                    }
                }
                return costs;
            },
            maxOps: 2000 
        }
    );

    if (ret.path.length > 0) {
        // Χρήση move αντί για moveByPath για πιο άμεση απόκριση σε μικρές αποστάσεις
        creep.move(creep.pos.getDirectionTo(ret.path[0]));
    } else {
        creep.moveTo(targetPos, { reusePath: 0 }); // Hard reset κίνησης
    }
}
};

/**
 * @section TRAVEL HELPERS
 * Συναρτήσεις για μετακίνηση μεταξύ δωματίων και αποφυγή "bounce" στις εξόδους.
 */

/**
 * Καθοδηγεί το creep στο δωμάτιο βάσης του (homeRoom).
 * @param {Creep} creep 
 * @returns {boolean} True αν το creep βρίσκεται σε διαδικασία ταξιδιού.
 */
function travelToHomeRoom(creep) {
    const homeRoom = creep.memory.homeRoom;
    if (creep.room.name !== homeRoom) {
        MoveUtils.smartMove(creep, new RoomPosition(25, 25, homeRoom), 20);
        return true; 
    }
    // Αποφυγή ταλάντωσης (bounce) στα όρια του δωματίου
    if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
        MoveUtils.smartMove(creep, new RoomPosition(25, 25, homeRoom), 20);
        return true;
    }
    return false; 
}

/**
 * Καθοδηγεί το creep στο δωμάτιο στόχο (targetRoom).
 * @param {Creep} creep 
 * @returns {boolean} True αν το creep βρίσκεται σε διαδικασία ταξιδιού.
 */
function travelToTargetRoom(creep) {
    const targetRoom = creep.memory.targetRoom;
    if (!targetRoom) return false;
    
    if (creep.room.name !== targetRoom) {
        MoveUtils.smartMove(creep, new RoomPosition(25, 25, targetRoom), 20);
        return true;
    }
    if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
        MoveUtils.smartMove(creep, new RoomPosition(25, 25, targetRoom), 20);
        return true;
    }
    return false;
}

/**
 * @namespace roleManager
 * @description Ο κεντρικός εγκέφαλος διανομής εργασιών στα Creeps.
 */
const roleManager = {
    /**
     * Η κύρια λούπα που εκτελείται κάθε tick για όλα τα creeps.
     */
    run: function() {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.spawning) continue; 

            try {
                // Διαχωρισμός συμπεριφοράς βάσει του role στη μνήμη
                switch (creep.memory.role) {
                    case 'harvester': this.runHarvester(creep); break;
                    case "simpleHarvester": this.runSimpleHarvester(creep); break;
                    case 'upgrader': this.runUpgrader(creep); break;
                    case 'staticHarvester': this.runStaticHarvester(creep); break;
                    case 'builder': this.runBuilder(creep); break;
                    case 'claimer': this.runClaimer(creep); break;
                    case 'scout': this.runScout(creep); break;
                    case "to_be_recycled": runRecycleCreep(creep); break;
                    case "supporter": this.runSupporter(creep); break;    
                    case "LDHarvester": this.runLDHarvester(creep); break;
                    case "miner": this.runMiner(creep); break;
                }
            } catch (e) {
                console.log(`Error in role ${creep.memory.role} for creep ${creep.name}:`, e);
            }
        }
    },

    /**
     * @role MINER
     * Εξειδικευμένο creep για εξόρυξη ορυκτών (Minerals).
     * Μεταφέρει τα ορυκτά στο Terminal ή το Storage.
     */
    runMiner: function(creep) { 
        if (creep.spawning) return;
        
        // Διαχείριση κατάστασης (Working = Παράδοση, !Working = Εξόρυξη)
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
        }
        if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
            creep.memory.working = false;
            // Αν πλησιάζει το θάνατο, πάει για ανακύκλωση
            if(creep.ticksToLive < 200) {
                creep.memory.role = "to_be_recycled";
                return;
            }
        }
        
        if (creep.memory.working === false) {
            // Προτεραιότητα: Μάζεψε ορυκτά από containers πριν σκάψεις
            if (this.collectMineralsFromContainers(creep)===true) return;

            // Εύρεση Mineral Source αν δεν υπάρχει στη μνήμη
            if(!creep.memory.mineralId) {
                const closestMineral = creep.pos.findClosestByPath(FIND_MINERALS);
                if (closestMineral) {
                    creep.memory.mineralId = closestMineral.id;
                } else return;
            }
            
            const mineral = Game.getObjectById(creep.memory.mineralId);
            if (!mineral) return;
    
            // Εύρεση Container κοντά στο mineral για στατική εξόρυξη
            let containerId = creep.memory.containerId;
            if (!containerId) {
                const containers = mineral.pos.findInRange(FIND_STRUCTURES, 2, { 
                    filter: (s) => s.structureType === STRUCTURE_CONTAINER
                });
                if (containers.length > 0) creep.memory.containerId = containers[0].id;
            }
    
            const container = Game.getObjectById(creep.memory.containerId);
            if (container) {
                if (!creep.pos.inRangeTo(container, 0)) MoveUtils.smartMove(creep, container, 0);
            } else {
                if (!creep.pos.inRangeTo(mineral, 1)) {
                    MoveUtils.smartMove(creep, mineral, 1);
                    return; 
                }
            }

            // Εξόρυξη μόνο αν ο Extractor δεν είναι σε cooldown
            const extractor = mineral.pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_EXTRACTOR);
            if (extractor && extractor.cooldown === 0) {
                 creep.harvest(mineral);
            }
        }
        else {
            // Παράδοση στο Terminal (προτεραιότητα) ή Storage
            const deliveryTarget = creep.room.terminal || creep.room.storage;
            if (deliveryTarget) {
                if (creep.pos.inRangeTo(deliveryTarget, 1)) {
                    for (const resourceType in creep.store) {
                        creep.transfer(deliveryTarget, resourceType);
                    }
                } else {
                    MoveUtils.smartMove(creep, deliveryTarget, 1);
                }
            }
        }
    },

    /**
     * Συλλέγει οτιδήποτε ΔΕΝ είναι ενέργεια από containers.
     * @returns {boolean}
     */
    collectMineralsFromContainers: function(creep) {
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_CONTAINER && 
                           (s.store.getUsedCapacity() > s.store[RESOURCE_ENERGY])
        });
    
        if (containers.length === 0) return false;
    
        const target = creep.pos.findClosestByPath(containers);
        if (!target) return false;
    
        if (creep.pos.isNearTo(target)) {
            for (const resourceType in target.store) {
                if (resourceType !== RESOURCE_ENERGY) {
                    const result = creep.withdraw(target, resourceType);
                    if (result === OK) return true; 
                }
            }
        } else {
            MoveUtils.smartMove(creep, target, 1);
            creep.say('💎 fetch');
            return true;
        }
        return false;
    },

    /**
     * @role LDHarvester (Long Distance Harvester)
     * Μαζεύει ενέργεια από άλλο δωμάτιο και την φέρνει πίσω, 
     * επισκευάζοντας δρόμους κατά τη διαδρομή.
     */
    runLDHarvester: function(creep) { 
        if (creep.spawning) return;
        if(creep.ticksToLive < 200) { creep.memory.role = "to_be_recycled"; return; }

        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) creep.memory.working = false;
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) creep.memory.working = true;
        
        if (creep.memory.working) {
            // Maintenance: Επισκευή δρόμου στην τρέχουσα θέση
            const road = creep.pos.lookFor(LOOK_STRUCTURES).find(s => 
                s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax
            );
            if (road) creep.repair(road);
            if (this.buildStructures(creep)) return; 
            // Επιστροφή στο Home Room
            if (travelToHomeRoom(creep)) return;
            
            // Παράδοση ενέργειας με σειρά προτεραιότητας
            if (this.fillSpawnExtension(creep)) return;
            if (this.fillContainerOrStorage(creep)) return;
            
        } else {
            // Μετάβαση στο Target Room για εξόρυξη
            const pos = new RoomPosition(creep.memory.source.x, creep.memory.source.y, creep.memory.source.roomName);
            
            if (creep.room.name !== creep.memory.source.roomName) {
                MoveUtils.smartMove(creep, pos, 1);
                return;
            }

            if (creep.pos.inRangeTo(pos,1)) {
                const source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
                if (source) creep.harvest(source);
            } else {
                MoveUtils.smartMove(creep, pos, 1);
            }
        }
    },

    /**
     * @role CLAIMER
     * Καταλαμβάνει νέα δωμάτια ή κάνει attack σε εχθρικούς controllers.
     */
    runClaimer: function(creep) {
        if (creep.spawning) return;
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) return;
            
        if (travelToTargetRoom(creep)) return;
        
        const controller = creep.room.controller;
        const isOnTargetRoom = creep.room.name === targetRoom;

        // Αν το δωμάτιο έγινε δικό μας, ο Claimer μετατρέπεται σε Builder
        if (isOnTargetRoom && controller && controller.my) {
            creep.memory.homeRoom = creep.memory.targetRoom;
            creep.memory.role = "builder";
        }

        if (isOnTargetRoom && controller && !controller.my) {
            // Claiming logic
            if (!controller.owner && !controller.upgradeBlocked) {
                if (creep.pos.inRangeTo(controller,1)) {
                    if (creep.claimController(controller) === 0) {
                        creep.room.memory = {type:"initial_setup", targetRoom: targetRoom}; 
                        creep.memory.role = "builder";
                        return;
                    }
                } else {
                    MoveUtils.smartMove(creep, controller, 1);
                    return;
                }
            }
            // Αν είναι κατειλημμένο, επίθεση στον controller
            if (!(controller.upgradeBlocked > 0)) {
                if (creep.pos.inRangeTo(controller,1)) {
                    creep.attackController(controller);
                } else {
                    MoveUtils.smartMove(creep, controller, 1);
                    return;
                }
            }
        }    
        
        // Dismantle εχθρικών δομών αν δεν έχει τι άλλο να κάνει
        if (this.destroyHostileStructures(creep) === true) { 
             creep.say("destroy");
             return;
        }
    },

    /**
     * Καταστρέφει εχθρικά Towers, Spawns και λοιπά κτίρια (dismantle).
     * @returns {boolean}
     */
    destroyHostileStructures: function(creep) {
        let target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_TOWER
        });

        if (!target) target = creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS);
        if (!target) {
            target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                filter: (s) => s.structureType !== STRUCTURE_WALL && 
                               s.structureType !== STRUCTURE_RAMPART &&
                               s.structureType !== STRUCTURE_CONTROLLER 
            });
        }

        if (target) {
            if (creep.dismantle(target) === ERR_NOT_IN_RANGE) {
                MoveUtils.smartMove(creep, target, 1);
            }
            return true;
        }
        return false;  
    },

    /**
     * @role HARVESTER (Απλός)
     * Απλή εξόρυξη ενέργειας από το κοντινότερο source.
     */
    runHarvester: function(creep) {
        if (creep.spawning) return;
        if(creep.ticksToLive < minTickToLive && getRecoveryContainerId(creep)) {
            creep.memory.role = "to_be_recycled"; return;
        }
        
        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (source) {
            if (creep.pos.inRangeTo(source, 1)) creep.harvest(source);
            else MoveUtils.smartMove(creep, source, 1);
        }
    },

    /**
     * @role SCOUT
     * Πηγαίνει σε ένα δωμάτιο για να δώσει vision και αυτοκτονεί αφού καταγράψει δεδομένα.
     */
    runScout: function(creep) {
        if (creep.spawning) return;
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) return;

        if (creep.room.name === targetRoom) {
            // Κίνηση προς το κέντρο για μέγιστο vision
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                MoveUtils.smartMove(creep, new RoomPosition(25, 25, targetRoom), 20);
            }
            
            // Κλήση εξωτερικής συνάρτησης για καταγραφή δωματίου (αν υπάρχει)
            if (typeof getInfoForNeighborRoom === "function") {
                const hasGCL = Game.gcl.level > _.filter(Game.rooms, r => r.controller && r.controller.my).length;
                getInfoForNeighborRoom(creep.room.name, hasGCL, creep.memory.homeRoom);
            }
            creep.say("Bye bye");
            creep.suicide(); 
        } 
        else {
            MoveUtils.smartMove(creep, new RoomPosition(25, 25, targetRoom), 20);
        }
    },

    /**
     * @role SUPPORTER
     * Πολυμορφικό creep που γεμίζει Spawns, χτίζει ή αναβαθμίζει controller σε ξένα δωμάτια.
     */
    runSupporter: function(creep) { 
        if(creep.spawning) return;
        
        if(creep.ticksToLive < minTickToLive && getRecoveryContainerId(creep)) {
            creep.memory.role = "to_be_recycled";
            return;
        }
        
        if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.building = false;
            creep.say('🔄 refill');
        }
        if (!creep.memory.building && creep.store.getFreeCapacity() === 0) {
            creep.memory.building = true;
            creep.say('🚧 build');
        }

        if (creep.memory.building) {
            if (travelToTargetRoom(creep)) { 
                return;
            }
            
            if (this.fillSpawnExtension(creep)){return ;}
            if (this.buildStructures(creep)) {return;}
            if(this.upgradeController(creep)) {return;}
        } else {
            if (travelToHomeRoom(creep)) { 
                return;
            }
            this.getEnergy(creep);
        }
    },

    /**
     * Γεμίζει Containers ή Storage με ενέργεια.
     * @returns {boolean}
     */
    fillContainerOrStorage: function(creep) {
        const targets = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) && 
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (targets.length > 0) {
            const target = creep.pos.findClosestByPath(targets); 
            if (target) {
                if (creep.pos.inRangeTo(target, 1)) creep.transfer(target, RESOURCE_ENERGY);
                else MoveUtils.smartMove(creep, target, 1);
                return true;
            }
        }
        return false;
    },

    /**
     * Γεμίζει Spawns και Extensions.
     * @returns {boolean}
     */
    fillSpawnExtension: function(creep) { 
        const targets = creep.room.find(FIND_MY_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) && 
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (targets.length > 0) {
            const target = creep.pos.findClosestByPath(targets);
            if (target) {
                if (creep.pos.inRangeTo(target, 1)) creep.transfer(target, RESOURCE_ENERGY);
                else MoveUtils.smartMove(creep, target, 1);
                return true;
            }
        }
        return false;
    },

    /**
     * @role BUILDER
     * Επικεντρώνεται στο χτίσιμο δομών και την αναβάθμιση του controller.
     */
    runBuilder: function(creep) {
        if(creep.spawning) return;
        if (travelToHomeRoom(creep)) return;

        if(creep.ticksToLive < minTickToLive && getRecoveryContainerId(creep)) {
            creep.memory.role = "to_be_recycled"; return;
        }
        
        if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) creep.memory.building = false;
        if (!creep.memory.building && creep.store.getFreeCapacity() === 0) creep.memory.building = true;

        if (creep.memory.building) {
            if (this.buildStructures(creep)) return;
            this.upgradeController(creep);
        } else {
            this.getEnergy(creep);
        }
    },

    /**
     * Αναζητά και χτίζει Construction Sites.
     * Προτεραιότητα: Κτίρια (όχι δρόμοι) -> Δρόμοι.
     * @returns {boolean}
     */
    buildStructures: function(creep) {
        // 1. Προτεραιότητα σε κτίρια (όχι δρόμους)
        let targets = creep.room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType !== STRUCTURE_ROAD });
        
        // 2. Αν δεν υπάρχουν κτίρια, έλεγχος για δρόμους
        if (targets.length === 0) targets = creep.room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_ROAD });

        if (targets.length > 0) {
            const target = creep.pos.findClosestByPath(targets);
            if (target) {
                if (creep.pos.inRangeTo(target, 3)) creep.build(target);
                else MoveUtils.smartMove(creep, target, 3);
            }
            return true;
        }
        return false;
    },

    /**
     * @section ENERGY COLLECTION METHODS
     * Διαδοχικές μέθοδοι για την εύρεση ενέργειας.
     */

    getEnergyFromContainersorStorage: function(creep) { 
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                         s.store[RESOURCE_ENERGY] > 100
        });
        if (containers.length > 0) {
            const closest = creep.pos.findClosestByPath(containers);
            if (closest) {
                if (creep.pos.inRangeTo(closest, 1)) creep.withdraw(closest, RESOURCE_ENERGY);
                else MoveUtils.smartMove(creep, closest, 1);
            }
            return true;
        }
        return false;
    },

    getEnergyFromDroppedEnergy: function(creep) {
        const dropped = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 40
        });
        if (dropped.length > 0) {
            const closest = creep.pos.findClosestByPath(dropped);
            if (closest) {
                if (creep.pos.inRangeTo(closest, 1)) creep.pickup(closest);
                else MoveUtils.smartMove(creep, closest, 1);
            }
            return true;
        }  
        return false;
    },

    getEnergyFromRuins: function(creep) { 
        const ruins = creep.room.find(FIND_RUINS, { filter: s => s.store[RESOURCE_ENERGY] > 40 });
        if (ruins.length > 0) {
            const ruin = creep.pos.findClosestByPath(ruins);
            if (ruin) {
                if (creep.pos.inRangeTo(ruin, 1)) creep.withdraw(ruin, RESOURCE_ENERGY);
                else MoveUtils.smartMove(creep, ruin, 1);
            }
            return true;
        }
        return false;
    },

    gotoHarvesting: function(creep) { 
        const sources = creep.room.find(FIND_SOURCES_ACTIVE);
        if (sources.length > 0) {
            const closest = creep.pos.findClosestByPath(sources);
            if (closest) {
                if (creep.pos.inRangeTo(closest, 1)) creep.harvest(closest);
                else MoveUtils.smartMove(creep, closest, 1);
            }
            return true;
        }
        return false;
    },

    /**
     * Κεντρική συνάρτηση λήψης ενέργειας (ιεραρχική αναζήτηση).
     */
    getEnergy: function(creep) {
        if (this.getEnergyFromContainersorStorage(creep)) return true;
        if (this.getEnergyFromDroppedEnergy(creep)) return true;
        if (this.getEnergyFromRuins(creep)) return true;     
        if (this.gotoHarvesting(creep)) return true;
        return false;
    },

    /**
     * @role SIMPLE HARVESTER
     * Creep γενικής χρήσης για τα αρχικά στάδια.
     */
    runSimpleHarvester: function(creep) {
        if (creep.spawning || travelToHomeRoom(creep)) return;
        
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) creep.memory.working = false;
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) creep.memory.working = true;
        
        if (creep.memory.working) {
           if(this.fillSpawnExtension(creep)) return;
           if (this.buildStructures(creep)) return;
           this.upgradeController(creep);
        } else {
            if (!this.getEnergyFromDroppedEnergy(creep)) this.getEnergy(creep);
        }
    },

    /**
     * @role UPGRADER
     * Creep αποκλειστικά για την αναβάθμιση του Controller.
     */
    runUpgrader: function(creep) {
        if (creep.spawning) return;
        if(creep.ticksToLive < minTickToLive && getRecoveryContainerId(creep)) {
            creep.memory.role = "to_be_recycled"; return;
        }
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) creep.memory.working = false;
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) creep.memory.working = true;

        if (creep.memory.working) this.upgradeController(creep);
        else this.getEnergy(creep);
    },

    /**
     * Εκτελεί την ενέργεια αναβάθμισης στον Controller του δωματίου.
     * @returns {boolean}
     */
    upgradeController: function(creep) { 
        if (creep.room.controller) {
            if (creep.pos.inRangeTo(creep.room.controller, 2)) {
                creep.upgradeController(creep.room.controller);
            } else {
                MoveUtils.smartMove(creep, creep.room.controller, 2);
            }
            return true;
        }
        return false;
    },

    /**
     * @role STATIC HARVESTER
     * Παραμένει πάνω σε ένα container και σκάβει συνεχώς ένα source.
     */
    runStaticHarvester: function(creep) { 
        if (creep.spawning) return;
        if(!creep.memory.sourceId) {
            const closest = creep.pos.findClosestByPath(FIND_SOURCES);
            if (closest) creep.memory.sourceId = closest.id;
            else return;
        }
        const source = Game.getObjectById(creep.memory.sourceId);
        if (!source) return;

        // Αναζήτηση container δίπλα στο source
        let containerId = creep.memory.containerId;
        if (!containerId) {
            const containers = source.pos.findInRange(FIND_STRUCTURES, 2, { 
                filter: (s) => s.structureType === STRUCTURE_CONTAINER
            });
            if (containers.length > 0) creep.memory.containerId = containers[0].id;
        }

        const container = Game.getObjectById(creep.memory.containerId);
        if (container) {
            if (!creep.pos.inRangeTo(container, 0)) MoveUtils.smartMove(creep, container, 0);
        } else {
            if (!creep.pos.inRangeTo(source, 1)) {
                MoveUtils.smartMove(creep, source, 1);
                return; 
            }
        }
        creep.harvest(source);
    }
};

/**
 * Επιστρέφει το ID του container ανακύκλωσης από τη μνήμη του δωματίου.
 * @param {Creep} creep 
 */
function getRecoveryContainerId(creep) { 
    return creep.room.memory.recoveryContainerId;
}

/**
 * Στέλνει το creep στο σημείο ανακύκλωσης και καλεί την recycleCreep του Spawn.
 * @param {Creep} creep 
 */
function runRecycleCreep(creep) { 
    if (!creep.room.memory.recoveryContainerId) {
        creep.say("suicide");
        creep.suicide();
        return;
    }
    const recycleContainer = Game.getObjectById(creep.room.memory.recoveryContainerId);
    if (recycleContainer && !creep.pos.inRangeTo(recycleContainer, 0)) {
        MoveUtils.smartMove(creep, recycleContainer, 0);
        return;
    }
    const closestSpawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS);
    if (closestSpawn) closestSpawn.recycleCreep(creep);
}

module.exports = roleManager;