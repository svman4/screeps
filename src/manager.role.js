const minTickToLive = 30;
// Νέα βοηθητική συνάρτηση για κίνηση σε άλλο δωμάτιο
function travelToHomeRoom(creep) {
    const homeRoom = creep.memory.homeRoom;
    if (creep.room.name !== homeRoom) {
        
        creep.moveTo(new RoomPosition(25, 25, homeRoom), { 
            reusePath: 50
        });
        return true; 
    }
    // ΑΝΤΙ-BOUNCE: Αν είναι ακόμα πάνω στο border παρόλο που είναι στο σωστό δωμάτιο
    if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
        creep.moveTo(new RoomPosition(25, 25, homeRoom));
        
        return true;
    }
    
    return false; 
}
function travelToTargetRoom(creep) {
    const targetRoom = creep.memory.targetRoom;
    if (!targetRoom) return false;
    
    if (creep.room.name !== targetRoom) {
        creep.moveTo(new RoomPosition(25, 25, targetRoom), { 
            visualizePathStyle: { stroke: '#ffffff' },
            reusePath: 30
        });
        return true;
    }
    // ΑΝΤΙ-BOUNCE: Αν μόλις μπήκε στο target room, κάνε ένα βήμα μέσα
    if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
        creep.moveTo(new RoomPosition(25, 25, targetRoom));
        return true;
    }
    return false;
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
                case 'scout': 
                    this.runScout(creep);
                    break;
                case "to_be_recycled":
                    runRecycleCreep(creep);
                    break;
                case  "supporter":
                    this.runSupporter(creep);
                    break;    
                case "LDHarvester": 
                    this.runLDHarvester(creep);
            }
        }
    },
    runLDHarvester: function(creep) { 
        if (creep.spawning) return;
        if(creep.ticksToLive < 200) {
            creep.memory.role = "to_be_recycled";
            return;
        }

        // Απλοποίηση εναλλαγής κατάστασης - μόνο όταν είναι στο σωστό δωμάτιο
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
                creep.memory.working = false;
                creep.say('🔄 harvest');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🚚 deliver');
        }
        

        if (creep.memory.working) {
            // Πήγαινε στο home room και παράδωσε ενέργεια
            if ( (creep.room.name !== creep.memory.homeRoom) && this.buildStructures(creep)) {return;}
            if (travelToHomeRoom(creep)) { 
                return;
            }
            
            // Εδώ είμαστε στο home room - παράδωσε ενέργεια
            if (this.fillContainerOrStorage(creep)) {
                return;
            }
            // Fallback: γέμισε spawn/extensions
            this.fillSpawnExtension(creep);
        } else {
            // Πήγαινε στο target room και μάζεψε ενέργεια
            
             const pos = new RoomPosition(
                creep.memory.source.x,
                creep.memory.source.y,
                creep.memory.source.roomName
            );
            
            if (creep.pos.inRangeTo(pos,1)) {
                const source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
                creep.harvest(source);
            } else {
                creep.moveTo(pos,{visualizePathStyle: {stroke: '#ffaa00'},reusePath: 50});
            }
        }
    },
    /**
     * ΛΟΓΙΚΗ CLAIMER
     */
    runClaimer: function(creep) {
        if (creep.spawning) return;
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
             // αν υπάρχει controller
            if (!controller.my) {
                if (!controller.owner && !controller.upgradeBlocked) {
                    // αν γίνεται claim...
                    if (controller && creep.pos.inRangeTo(controller,1)) {
                        const claimResult = creep.claimController(controller);
                        if (claimResult===0  ) {
                            console.log("Attack controller"+attackResult);
                            creep.say("Attack controller"+attackResult);    
                        }
                    } else {
                        creep.moveTo(controller, { visualizePathStyle: { stroke: '#ff00ff' } });    
                        return ;
                    }
                    
                }
                
                if (!((controller.upgradeBlocked || 0) > 0)) {
                    // True αν είναι έτοιμος για νέα επίθεση
                    if (controller && creep.pos.inRangeTo(controller,1)) {
                        const attackResult = creep.attackController(controller);
                        if (attackResult===0  ) {
                            console.log("Attack controller"+attackResult);
                            creep.say("Attack controller"+attackResult);    
                        }
                    } else {
                        creep.moveTo(controller, { visualizePathStyle: { stroke: '#ff00ff' } });    
                        return;
                    }
                }
                    
            }
            if (this.destroyTowers(creep)===true) { return };
            // B. BUILDING LOGIC
            if (creep.memory.isBuilder) {
                
                // Check 1: Αν έχει χτιστεί το Spawn.
                if (creep.room.find(FIND_MY_SPAWNS).length > 0) {
                     // --- ΝΕΑ ΛΟΓΙΚΗ ΜΕΤΑΒΑΣΗΣ ---
                     console.log(`✅ Spawn built in ${targetRoom}. Entering Initial Setup Phase (RCL1->RCL2).`);
                     Memory.rooms[targetRoom].type = 'initial_setup'; 
                     creep.memory.role="builder";
                     // Ο Claimer/Builder τελείωσε τη δουλειά του, αυτοκτονεί
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
    destroyTowers:function(creep) {
        creep.say("destroy");
        let target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_TOWER
        });

        if (target) {
            // 3. Προσπάθεια διάλυσης (Dismantle)
            if (creep.dismantle(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
            }
            return true;
        } 
        // Αν δεν υπάρχουν Towers, διάλυσε το Spawn ή άλλα κτίρια
        target = creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS);
        if (target) {
            if (creep.dismantle(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
            return true;
        }
        // Αν δεν υπάρχουν Towers, διάλυσε το Spawn ή άλλα κτίρια
        target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
        if (target) {
            if (creep.dismantle(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
            return true;
        }
        
        return false;  
    },
    runHarvester: function(creep) {
        if (creep.spawning) return;
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
        if (creep.spawning) return;
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) return;

        // Αν φτάσαμε στο δωμάτιο
        if (creep.room.name === targetRoom) {
            // Μετακίνηση προς το κέντρο για να μην μείνει στην είσοδο (και μπλοκάρει ή πηγαινοέρχεται)
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                creep.moveTo(new RoomPosition(25, 25, targetRoom), { 
                    visualizePathStyle: { stroke: '#ffffff' } , reusePath: 20
                });
            }
            if (creep.room.name !== creep.memory.homeRoom) {
               const hasGCL = Game.gcl.level > _.filter(Game.rooms, r => r.controller && r.controller.my).length;
                getInfoForNeighborRoom(creep.room.name, hasGCL, creep.memory.homeRoom);
            }
            creep.say("Bye bye");
            creep.suicide();
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
                    visualizePathStyle: { stroke: '#ffffff' } , reusePath:40
                });
            }
        }
    },
    runSupporter:function(creep) { 
          if(creep.spawning) return;
        
        

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
    fillContainerOrStorage:function(creep) {
        const targets = creep.room.find(FIND_MY_STRUCTURES, {
            filter: (s) => {
                return (s.structureType === STRUCTURE_CONTAINER ||
                        s.structureType === STRUCTURE_STORAGE ) && 
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            }
        );
        if (targets && targets.length > 0) {
            if (creep.pos.inRangeTo(targets[0],1)) {
                creep.transfer(targets[0], RESOURCE_ENERGY);
            } else {
                creep.moveTo(targets[0], {visualizePathStyle: {stroke: '#ffffff'}, reusePath: 8});
            }
            return true;
        }
        return false;
    },
    fillSpawnExtension:function(creep) { 
        const targets = creep.room.find(FIND_MY_STRUCTURES, {
            filter: (s) => {
                return (s.structureType === STRUCTURE_EXTENSION ||
                        s.structureType === STRUCTURE_SPAWN ) && 
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            }
        );
        if (targets && targets.length > 0) {
            if (creep.pos.inRangeTo(targets[0],1)) {
                creep.transfer(targets[0], RESOURCE_ENERGY);
            } else {
                creep.moveTo(targets[0], {visualizePathStyle: {stroke: '#ffffff'}, reusePath: 8});
            }
            return true;
        }
        return false;
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
            if (this.buildStructures(creep)){ return ;}
            this.upgradeController(creep);
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
            return true;
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
            return true;
        }
        

        // 4. Upgrade αν δεν υπάρχει τίποτα άλλο
        
        
        return false;
    },
    getEnergyFromContainersorStorage:function(creep) { 
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
            return true;
        }
        return false;
    },
    getEnergyFromDroppedEnergy:function(creep) {
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
            return true;
        }  
        return false;
    },
    getEnergyFromRuins:function(creep) { 
        
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
            return true;
        }
        return false;
    },
    gotoHarvesting:function(creep) { 
        
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
                return true;
            }
        }
        return false;
    },
    getEnergy: function(creep) {
        if (this.getEnergyFromContainersorStorage(creep)) { return;}
        if (this.getEnergyFromDroppedEnergy(creep)) { return;}
        if (this.getEnergyFromRuins(creep)) { return;}    
        if(this.gotoHarvesting(creep)) {return ;}
        return true;
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

        
        if (creep.memory.working) {
           if(this.fillSpawnExtension(creep)) {return ; }
                // Αν όλα είναι γεμάτα, κάνε upgrade (για να μην κάθεται)
            
            this.upgradeController(creep);
            
        } else {
            if (this.getEnergyFromDroppedEnergy(creep)) { return;}
            if (this.getEnergy(creep)) {return ; }
            //if(this.gotoHarvesting(creep)) {return ;}
        }
    },

    runUpgrader: function(creep) {
        if (creep.spawning) return;
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
            this.upgradeController(creep);
        } else {
            this.getEnergy(creep);
        }
    },
    upgradeController : function(creep) { 
        if (creep.pos.inRangeTo(creep.room.controller, 2)) {
                creep.upgradeController(creep.room.controller);
        } else {
            //creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } ,reusePath:30});
            creep.moveTo(creep.room.controller, { reusePath:30});
        }
        return true;
    },
    runStaticHarvester: function(creep) { 
        if (creep.spawning) return;
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