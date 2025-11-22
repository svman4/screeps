const minTickToLive = 30;
// Νέα βοηθητική συνάρτηση για κίνηση σε άλλο δωμάτιο
function travelToHomeRoom(creep) {
    const homeRoom = creep.memory.homeRoom;
    if (creep.room.name !== homeRoom) {
        creep.moveTo(new RoomPosition(25, 25, homeRoom), { 
            visualizePathStyle: { stroke: '#ffffff' },
            reusePath: 50
        });
        return true; // Είναι σε διαδικασία ταξιδιού
    }
    return false; // Είναι στο home room του
}
const roleManager = {
    run: function() {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.spawning) continue; // Αν γεννιέται ακόμα, ignore

            switch (creep.memory.role) {
                case 'harvester':
                    this.runHarvester(creep);
                    break;
                case "simpleHarvester":
                    this.runSimpleHarvester(creep);
                    break;
                case 'upgrader':
                    this.runUpgrader(creep);
                    break;
                case 'staticHarvester':
                    this.runStaticHarvester(creep);
                    break;
                case 'builder':
                    this.runBuilder(creep);
                    break;
                case 'claimer':
                    this.runClaimer(creep);
                    break;
                case 'scout': // <--- ΝΕΟ
                    this.runScout(creep);
                    break;
                case "to_be_recycled":
                    runRecycleCreep(creep);
                    break;
            }
        }
    },

    /**
     * ΛΟΓΙΚΗ CLAIMER
     */
    runClaimer: function(creep) {
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) return;

        // 1. TRAVEL TO TARGET ROOM
        if (creep.room.name !== targetRoom) {
            creep.moveTo(new RoomPosition(25, 25, targetRoom), { 
                visualizePathStyle: { stroke: '#ffffff' },
                reusePath: 50
            });
            return;
        } 
        
        // 2. IN TARGET ROOM
        const controller = creep.room.controller;

        if (controller) {
            // A. CLAIM/RESERVE LOGIC
            if (!controller.my) {
                const claimResult = creep.claimController(controller);
                
                if (claimResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, { visualizePathStyle: { stroke: '#ff00ff' } });
                    return;
                } else if (claimResult === ERR_GCL_NOT_ENOUGH) {
                    // Αν δεν αρκεί το GCL, κάνε Reserve (για προστασία)
                    const reserveResult = creep.reserveController(controller);
                    if (reserveResult === ERR_NOT_IN_RANGE) {
                         creep.moveTo(controller, { visualizePathStyle: { stroke: '#ff00ff' } });
                         return;
                    }
                }
            }
            
            // B. BUILDING LOGIC
            if (creep.memory.isBuilder) {
                
                // Check 1: Αν έχει χτιστεί το Spawn.
                if (creep.room.find(FIND_MY_SPAWNS).length > 0) {
                     // --- ΝΕΑ ΛΟΓΙΚΗ ΜΕΤΑΒΑΣΗΣ ---
                     console.log(`✅ Spawn built in ${targetRoom}. Entering Initial Setup Phase (RCL1->RCL2).`);
                     Memory.rooms[targetRoom].type = 'initial_setup'; 
                     // Ο Claimer/Builder τελείωσε τη δουλειά του, αυτοκτονεί
                     creep.suicide(); 
                     return;
                }
                
                // ... (rest of building/refill logic, as previously provided) ...
                if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) {
                    creep.memory.building = false;
                    creep.say('🔄 refill');
                }
                if (!creep.memory.building && creep.store.getFreeCapacity() === 0) {
                    creep.memory.building = true;
                    creep.say('🚧 build');
                }
                
                if (creep.memory.building) {
                    // 1. Βρες το construction site για το Spawn
                    let spawnSite = creep.room.find(FIND_CONSTRUCTION_SITES, {
                        filter: s => s.structureType === STRUCTURE_SPAWN
                    })[0];
                    
                    // 2. Βρες οποιοδήποτε άλλο construction site
                    let targetSite = spawnSite || creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
                    
                    if (targetSite) {
                        if (creep.pos.inRangeTo(targetSite, 3)) {
                            creep.build(targetSite);
                        } else {
                            creep.moveTo(targetSite, { visualizePathStyle: { stroke: '#00ff00' }, reusePath: 5 });
                        }
                        return;
                    }

                    // 3. Fallback: Upgrade controller
                    if (controller.my || controller.reservation) {
                         if (creep.pos.inRangeTo(controller, 3)) {
                            creep.upgradeController(controller);
                        } else { 
                            creep.moveTo(controller, { visualizePathStyle: { stroke: '#00ff00' }, reusePath: 8 });
                        }
                    }
                    
                } else {
                    // Refill energy (χρησιμοποιούμε τη λογική του Builder)
                    this.getEnergy(creep); 
                }
            } 
            // C. SUICIDE LOGIC (Minimal claimer)
            else {
                 if (controller.my || (controller.reservation && controller.reservation.username === 'svman4')) {
                    console.log(`💤 Minimal Claimer finished job in ${targetRoom}. Suiciding.`);
                    creep.suicide();
                 }
            }
        }
    },

    runHarvester: function(creep) {
        if(creep.ticksToLive < minTickToLive && getRecoveryContainerId(creep)) {
            creep.memory.role = "to_be_recycled";
            return;
        }
        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (source && creep.pos.inRangeTo(source,1)) {
            creep.harvest(source);
        } else {
            creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
    },
    runScout: function(creep) {
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) return;

        // Αν φτάσαμε στο δωμάτιο
        if (creep.room.name === targetRoom) {
            // Μετακίνηση προς το κέντρο για να μην μείνει στην είσοδο (και μπλοκάρει ή πηγαινοέρχεται)
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                creep.moveTo(new RoomPosition(25, 25, targetRoom));
            }
            
            // Σημείωση: Δεν χρειάζεται να κάνει κάτι άλλο. 
            // Το ότι υπάρχει εκεί δίνει "Vision".
            // Το expansionManager που τρέχει κάθε 100 ticks θα δει το δωμάτιο, 
            // θα καταγράψει τα sources και θα θέσει scoutNeeded = false.
            // Μπορούμε να τον αφήσουμε να ζήσει μέχρι να πεθάνει (1500 ticks vision).
        } 
        else {
            // Πήγαινε προς το δωμάτιο
            const exit = creep.room.findExitTo(targetRoom);
            if (exit === ERR_NO_PATH) {
                // Δεν υπάρχει μονοπάτι (ίσως walls)
                creep.say("No Path");
            } else {
                creep.moveTo(new RoomPosition(25, 25, targetRoom), { 
                    visualizePathStyle: { stroke: '#ffffff' } 
                });
            }
        }
    },
    runBuilder: function(creep) {
        if(creep.spawning) return;
        
        // 1. Ταξίδι στο Home Room (αν χρειάζεται)
        if (travelToHomeRoom(creep)) {
            creep.say("✈️");
            return;
        }

        // ... (rest of Builder logic is fine, assuming getEnergy handles energy retrieval in the new room)
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
            this.buildStructures(creep);
        } else {
            this.getEnergy(creep);
        }
    },

    buildStructures: function(creep) {
        // 1. Construction sites (εκτός δρόμων)
        const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES,{
            filter: s => s.structureType !== STRUCTURE_ROAD
        });
        
        if (constructionSites.length > 0) {
            const closestSite = creep.pos.findClosestByPath(constructionSites);
            if (closestSite) {
                if (creep.pos.inRangeTo(closestSite, 3)) {
                    creep.build(closestSite);
                } else {
                    creep.moveTo(closestSite, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 8 });                
                }
            }
            return;
        }

        // 2. Δρόμοι
        const constructionRoad = creep.room.find(FIND_CONSTRUCTION_SITES,{
            filter: s => s.structureType === STRUCTURE_ROAD
        });
        
        if (constructionRoad.length > 0) {
            const closestRoad = creep.pos.findClosestByPath(constructionRoad);
            if (closestRoad) {
                if (creep.pos.inRangeTo(closestRoad, 3)) {
                    creep.build(closestRoad);
                } else {
                    creep.moveTo(closestRoad, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 8 });
                }
            }
            return;
        }
        
        // 3. Επισκευές
        const damagedStructures = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.hits < s.hitsMax * 0.8 &&
                         s.structureType !== STRUCTURE_WALL &&
                         s.structureType !== STRUCTURE_RAMPART
        });

        if (damagedStructures.length > 0) {
            const closestDamaged = creep.pos.findClosestByPath(damagedStructures);
            if (closestDamaged) {
                if (creep.pos.inRangeTo(closestDamaged, 3)) { 
                    creep.repair(closestDamaged);
                } else {
                    creep.moveTo(closestDamaged, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 8 });
                }
            }
            return;
        }

        // 4. Upgrade αν δεν υπάρχει τίποτα άλλο
        if (creep.pos.inRangeTo(creep.room.controller, 2)) {
            creep.upgradeController(creep.room.controller);
        } else { 
            creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#00ff00' }, reusePath: 8 });
        }    
    },

    getEnergy: function(creep) {
        // 1. Containers/Storage
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                         s.store[RESOURCE_ENERGY] > 100
        });

        if (containers.length > 0) {
            const closest = creep.pos.findClosestByPath(containers);
            if (closest) {
                if (creep.pos.inRangeTo(closest, 1)) {
                    creep.withdraw(closest, RESOURCE_ENERGY);
                } else {
                    creep.moveTo(closest, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 8 });
                }
            }
            return;
        }

        // 2. Dropped
        const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 40
        });

        if (droppedEnergy.length > 0) {
            const closest = creep.pos.findClosestByPath(droppedEnergy);
            if (closest) {
                if (creep.pos.inRangeTo(closest, 1)) {
                    creep.pickup(closest);
                } else {
                    creep.moveTo(closest, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 8 });                
                }
            }
            return;
        }
        
        // 3. Ruins
        const ruins = creep.room.find(FIND_RUINS, {
           filter: s => s.store[RESOURCE_ENERGY] > 40 
        });
        if (ruins.length > 0) {
            const ruin = creep.pos.findClosestByPath(ruins);
            if (ruin) {
                if (creep.pos.inRangeTo(ruin, 1)) {
                    creep.withdraw(ruin, RESOURCE_ENERGY);
                } else {
                    creep.moveTo(ruin, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 8 });
                }
            }
            return;
        }
        
        // 4. Harvest (last resort)
        const sources = creep.room.find(FIND_SOURCES_ACTIVE);
        if (sources.length > 0) {
            const closestSource = creep.pos.findClosestByPath(sources);
            if (closestSource) {
                if (creep.pos.inRangeTo(closestSource, 1)) {
                    creep.harvest(closestSource);
                } else {
                    creep.moveTo(closestSource, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 8 });                
                }
            }
        }
    },

    runSimpleHarvester: function(creep) {
        if (creep.spawning) return;
        
        // 1. Ταξίδι στο Home Room (αν χρειάζεται)
        if (travelToHomeRoom(creep)) {
            creep.say("✈️");
            return;
        }
        
        // 2. Κανονική λογική Harvester στο Home Room
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('🔄 harvest');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🚚 deliver');
        }

        // ... (rest of simpleHarvester logic is fine)
        if (creep.memory.working) {
            const targets = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType === STRUCTURE_EXTENSION ||
                            s.structureType === STRUCTURE_SPAWN ||
                            s.structureType === STRUCTURE_TOWER) && 
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            
            if (targets.length > 0) {
                if (creep.transfer(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0], {visualizePathStyle: {stroke: '#ffffff'}});
                }
            } else {
                // Αν όλα είναι γεμάτα, κάνε upgrade (για να μην κάθεται)
                
                if (creep.room.controller) {
                    if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
                    }
                }
            }
        } else {
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
    },

    runUpgrader: function(creep) {
        if(creep.ticksToLive < minTickToLive && getRecoveryContainerId(creep)) {
            creep.memory.role = "to_be_recycled";
            return;
        }
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('🔄 harvest');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('⚡ upgrade');
        }

        if (creep.memory.working) {
            if (creep.pos.inRangeTo(creep.room.controller, 2)) {
                creep.upgradeController(creep.room.controller);
            } else {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        } else {
            this.getEnergy(creep);
        }
    },

    runStaticHarvester: function(creep) { 
        if(!creep.memory.sourceId) {
            const closestSource = creep.pos.findClosestByPath(FIND_SOURCES);
            if (closestSource) creep.memory.sourceId = closestSource.id;
            else return;
        }
        const source = Game.getObjectById(creep.memory.sourceId);
        if (!source) return;

        let containerId = creep.memory.containerId;
        if (!containerId) {
            const containers = source.pos.findInRange(FIND_STRUCTURES, 2, { 
                filter: (s) => s.structureType === STRUCTURE_CONTAINER
            });
            if (containers.length > 0) creep.memory.containerId = containers[0].id;
        }

        const container = Game.getObjectById(creep.memory.containerId);
        if (container) {
            if (!creep.pos.inRangeTo(container, 0)) {
                creep.moveTo(container, { visualizePathStyle: {stroke: '#ffaa00'}, reusePath: 10 });
            } 
        } else {
            if (!creep.pos.inRangeTo(source, 1)) {
                creep.moveTo(source, { visualizePathStyle: {stroke: '#ffaa00'}, reusePath: 50 });
                return; 
            }
        }
        creep.harvest(source);
    }
};

function getRecoveryContainerId(creep) { 
    return creep.room.memory.recoveryContainerId;
}

function runRecycleCreep(creep) { 
    if (!creep.room.memory.recoveryContainerId) {
        creep.say("suicide");
        creep.suicide();
        return;
    }
    const recycleContainer = Game.getObjectById(creep.room.memory.recoveryContainerId);
    if (recycleContainer && !creep.pos.inRangeTo(recycleContainer, 0)) {
        creep.moveTo(recycleContainer, { visualizePathStyle: {stroke: '#ffaa00'}, reusePath: 10 });
        return;
    }
    const spawns = creep.room.find(FIND_MY_SPAWNS);
    const closestSpawn = creep.pos.findClosestByRange(spawns);
    if (closestSpawn) closestSpawn.recycleCreep(creep);
}

module.exports = roleManager;