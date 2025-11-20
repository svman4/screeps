const minTickToLive=30;
const roleManager = {
    run: function() {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
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
                case 'builder': // Add case for staticBuilder
                    this.runBuilder(creep);
                    break;
                case "to_be_recycled":
                    runRecycleCreep(creep);
                    break;
            }
        }
    },

    runHarvester: function(creep) {
        
        if(creep.ticksToLive<minTickToLive && getRecoveryContainerId(creep)) {
            creep.memory.role="to_be_recycled";
            return;
        }
        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (creep.pos.inRangeTo(source,1)) {
            creep.harvest(source);
        } else {
            creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
        
    }, // end of runHarvester
    runBuilder: function(creep) {
        if(creep.ticksToLive<minTickToLive && getRecoveryContainerId(creep)) {
            creep.memory.role="to_be_recycled";
            return;
        }
        // State management
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
        // Προτεραιότητα 1: Construction sites
        const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES,{
            filter:structure=>(structure.structureType!==STRUCTURE_ROAD)
        });
        
        if (constructionSites && constructionSites.length > 0) {
            const closestSite = creep.pos.findClosestByPath(constructionSites);
            
            if (closestSite&&  creep.pos.inRangeTo(closestSite,3)) {
                creep.build(closestSite);
                
            } else {
                creep.moveTo(closestSite, {
                    visualizePathStyle: { stroke: '#ffffff' },
                    reusePath: 8
                });                
            }
            return;
        }

        // Αν δεν υπάρχουν κτίρια, προχωράει στην κατασκευή δρόμων
        const constructionRoad = creep.room.find(FIND_CONSTRUCTION_SITES,{
            filter:structure=>(structure)!==STRUCTURE_ROAD
        });
        
        if (constructionRoad && constructionRoad.length > 0) {
            const closestSiteRoad = creep.pos.findClosestByPath(constructionRoad);
            if (creep.pos.inRangeTo(closestSiteRoad,3)) {
                creep.build(closestSiteRoad)
            } else {
                creep.moveTo(closestSiteRoad, {
                    visualizePathStyle: { stroke: '#ffffff' },
                    reusePath: 8
                });
            }

            return;
        }
        // Προτεραιότητα 2: Επισκευή κατεστραμμένων δομών
        const damagedStructures = creep.room.find(FIND_STRUCTURES, {
            filter: structure => structure.hits < structure.hitsMax * 0.8 &&
                               structure.structureType !== STRUCTURE_WALL &&
                               structure.structureType !== STRUCTURE_RAMPART
        });

        if (damagedStructures.length > 0) {
            const closestDamaged = creep.pos.findClosestByPath(damagedStructures);
            
            if (creep.pos.inRangeTo(closestDamaged,3)) { 
                creep.repair(closestDamaged);
            }else {
                creep.moveTo(closestDamaged, {
                    visualizePathStyle: { stroke: '#ffaa00' },
                    reusePath: 8
                });
                
                
            }
            
            return;
        }

        // Προτεραιότητα 3: Αναβάθμιση controller αν δεν υπάρχει δουλειά
        if (creep.pos.inRangeTo(creep.room.controller,2)) {
            creep.upgradeController(creep.room.controller);
        } else { 
            creep.moveTo(creep.room.controller, {
                visualizePathStyle: { stroke: '#00ff00' },
                reusePath: 8
            });
            
        }    

    }, // end of buildStructures

    
    getEnergy: function(creep) {
       
        
        
        // Προτεραιότητα 1: Containers με ενέργεια
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: structure => 
                (structure.structureType === STRUCTURE_CONTAINER || 
                 structure.structureType === STRUCTURE_STORAGE) &&
                structure.store[RESOURCE_ENERGY] > 100
        });

        if (containers.length > 0) {
            const closestContainer = creep.pos.findClosestByPath(containers);
            if (closestContainer && creep.pos.inRangeTo(closestContainer,1)) {
                creep.withdraw(closestContainer, RESOURCE_ENERGY);
            } else {
                creep.moveTo(closestContainer, {
                    visualizePathStyle: { stroke: '#ffaa00' },
                    reusePath: 8
                });
            }
            
            return;
        }

        // Προτεραιότητα 2: Dropped energy
        const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: resource => resource.resourceType === RESOURCE_ENERGY && resource.amount > 40
        });

        if (droppedEnergy.length > 0) {
            
            const closestEnergy = creep.pos.findClosestByPath(droppedEnergy);
            creep.say("Drop");
            if (closestEnergy && creep.pos.inRangeTo(closestEnergy,1)) {
                creep.pickup(closestEnergy);
            } else {
                creep.moveTo(closestEnergy, {
                    visualizePathStyle: { stroke: '#ffaa00' },
                    reusePath: 8
                });                
            }
            
            return;
        }
         const ruins=creep.room.find(FIND_RUINS,{
           filter: structure=>structure.store[RESOURCE_ENERGY]>40 
        });
        if (ruins && ruins.length>0 ) {
            const ruin=creep.pos.findClosestByPath(ruins);
            if (ruin && creep.pos.inRangeTo(ruin,1)) {
                creep.withdraw(ruin,RESOURCE_ENERGY);
            } else {
                creep.moveTo(ruin, {
                    visualizePathStyle: { stroke: '#ffaa00' },
                    reusePath: 8
                });
            }
            return;
        }
        
        
        // Προτεραιότητα 3: Harvest από πηγές (τελευταία επιλογή)
        const sources = creep.room.find(FIND_SOURCES_ACTIVE);
        if (sources.length > 0) {
            const closestSource = creep.pos.findClosestByPath(sources);
            if (closestSource && creep.pos.inRangeTo(closestSource,1) ) {
                creep.harvest(closestSource);
            } else {
                creep.moveTo(closestSource, {
                    visualizePathStyle: { stroke: '#ffaa00' },
                    reusePath: 8
                });                
            }
        }
    }
    ,
    runSimpleHarvester: function(creep) {
    // State management
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
        creep.say('🔄 harvest');
    }
    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
        creep.say('🚚 deliver');
    }

    if (creep.memory.working) {
        // Παράδοση ενέργειας
        const targets = creep.room.find(FIND_MY_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_SPAWN ||
                        structure.structureType === STRUCTURE_TOWER) && 
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        if (targets.length > 0) {
            if (creep.transfer(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(targets[0], {visualizePathStyle: {stroke: '#ffffff'}});
            }
        } else {
            // Αν δεν υπάρχουν targets, πήγαινε κοντά στο spawn
            const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
            if (spawn) {
                creep.moveTo(spawn);
            }
        }
    } else {
        // Σύλληψη ενέργειας
        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
    }
},
    runUpgrader: function(creep) {
              if(creep.ticksToLive<minTickToLive && getRecoveryContainerId(creep)) {
            creep.memory.role="to_be_recycled";
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
            if (creep.pos.inRangeTo(creep.room.controller,2) ) {
                creep.upgradeController(creep.room.controller);
            } else {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        } else {
            this.getEnergy(creep);
        }
    }, // end of runUpgrader

    runStaticHarvester: function(creep) { 
        // Δε χρειάζεται μιας και πάντα πεθαίνει πάνω στο container. 
        //if(creep.ticksToLive<minTickToLive && getRecoveryContainerId(creep)) {
        //     creep.memory.role="to_be_recycled";
        //     return;
        // }
        if(!creep.memory.sourceId) {
            console.log(creep.name + " No sourceId found in memory");
            const closestSource = creep.pos.findClosestByPath(FIND_SOURCES);
            if (closestSource) {
                creep.memory.sourceId = closestSource.id;
            } else {
                console.log("----- Δε βρέθηκε source");
                return; // Δεν βρέθηκε Source
            }
        }
        const source=Game.getObjectById(creep.memory.sourceId);
        let containerId=creep.memory.containerId;
        if (!containerId) {
            creep.say("!Container");
            const containers=source.pos.findInRange(FIND_STRUCTURES,2,{ 
                filter: (s)=>(s.structureType===STRUCTURE_CONTAINER)
            });
            
            if (containers && containers.length>0) {
                creep.memory.containerId=containers[0].id;
            }
        }
        const container=Game.getObjectById(creep.memory.containerId);
        if (container) {
            if (creep.pos.inRangeTo(container,0)===false) {
                creep.moveTo(container, {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    reusePath: 10
                });
            } 
        } else {
            if (creep.pos.inRangeTo(source,1)===false) {
                creep.moveTo(source, {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    reusePath: 50
                });
                return; 
            }
        }
        creep.harvest(source);
    } // end of runStaticHarvester()
    
    
}; // end of roleManager
getRecoveryContainerId=function(creep) { 
            return creep.room.memory.recoveryContainerId;
  
};
runRecycleCreep=function(creep) { 
    if (!creep.room.memory.recoveryContainerId) {
        
        creep.say("suicide");
    }
    const recycleContainer=Game.getObjectById(creep.room.memory.recoveryContainerId);
    if (creep.pos.inRangeTo(recycleContainer,0)===false) {
                creep.moveTo(recycleContainer, {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    reusePath: 10
                });
                return;
    }
    const spawns = creep.room.find(FIND_MY_SPAWNS);
    const closestSpawn=creep.pos.findClosestByRange(spawns);
    closestSpawn.recycleCreep(creep);

} // end of    runRecycleCreep 

module.exports = roleManager;