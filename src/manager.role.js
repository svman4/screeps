/**
 * @file manager.role.js
 */
const movementManager = require('manager.movement'); // <-- IMPORT

const minTickToLive = 30;

// --- ΑΦΑΙΡΕΣΗ ΟΛΟΥ ΤΟΥ ΚΩΔΙΚΑ CACHE ΚΑΙ MoveUtils ΑΠΟ ΕΔΩ ---

// --- Helper Functions (Using movementManager) ---

function travelToHomeRoom(creep) {
    const homeRoom = creep.memory.homeRoom;
    if (creep.room.name !== homeRoom) {
        movementManager.smartMove(creep, new RoomPosition(25, 25, homeRoom), 20); // <-- ΑΛΛΑΓΗ
        return true; 
    }
    // Bounce protection
    if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
        movementManager.smartMove(creep, new RoomPosition(25, 25, homeRoom), 20); // <-- ΑΛΛΑΓΗ
        return true;
    }
    return false; 
}

function travelToTargetRoom(creep) {
    const targetRoom = creep.memory.targetRoom;
    if (!targetRoom) return false;
    
    if (creep.room.name !== targetRoom) {
        movementManager.smartMove(creep, new RoomPosition(25, 25, targetRoom), 20); // <-- ΑΛΛΑΓΗ
        return true;
    }
    if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
        movementManager.smartMove(creep, new RoomPosition(25, 25, targetRoom), 20); // <-- ΑΛΛΑΓΗ
        return true;
    }
    return false;
}

const roleManager = {
    run: function() {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.spawning) continue; 

            try {
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

    runMiner: function(creep) { 
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
        }
        if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
            creep.memory.working = false;
            if(creep.ticksToLive < 200) {
                creep.memory.role = "to_be_recycled";
                return;
            }
        }
        
        if (creep.memory.working === false) {
            if (this.collectMineralsFromContainers(creep) === true) return;

            if(!creep.memory.mineralId) {
                const closestMineral = creep.pos.findClosestByPath(FIND_MINERALS);
                if (closestMineral) creep.memory.mineralId = closestMineral.id;
                else return;
            }
            
            const mineral = Game.getObjectById(creep.memory.mineralId);
            if (!mineral) return;
    
            let containerId = creep.memory.containerId;
            if (!containerId) {
                const containers = mineral.pos.findInRange(FIND_STRUCTURES, 2, { 
                    filter: (s) => s.structureType === STRUCTURE_CONTAINER
                });
                if (containers.length > 0) creep.memory.containerId = containers[0].id;
            }
    
            const container = Game.getObjectById(creep.memory.containerId);
            if (container) {
                if (!creep.pos.inRangeTo(container, 0)) movementManager.smartMove(creep, container, 0); // <-- ΑΛΛΑΓΗ
            } else {
                if (!creep.pos.inRangeTo(mineral, 1)) {
                    movementManager.smartMove(creep, mineral, 1); // <-- ΑΛΛΑΓΗ
                    return; 
                }
            }

            const extractor = mineral.pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_EXTRACTOR);
            if (extractor && extractor.cooldown === 0) {
                 creep.harvest(mineral);
            }
        }
        else {
            const deliveryTarget = creep.room.terminal || creep.room.storage;
            if (deliveryTarget) {
                if (creep.pos.inRangeTo(deliveryTarget, 1)) {
                    for (const resourceType in creep.store) {
                        creep.transfer(deliveryTarget, resourceType);
                    }
                } else {
                    movementManager.smartMove(creep, deliveryTarget, 1); // <-- ΑΛΛΑΓΗ
                }
            }
        }
    },

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
            movementManager.smartMove(creep, target, 1); // <-- ΑΛΛΑΓΗ
            creep.say('💎 fetch');
            return true;
        }
        return false;
    },

    runLDHarvester: function(creep) { 
        if (creep.spawning) return;
        if(creep.ticksToLive < 200) { creep.memory.role = "to_be_recycled"; return; }

        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) creep.memory.working = false;
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) creep.memory.working = true;
        
        if (creep.memory.working) {
            const road = creep.pos.lookFor(LOOK_STRUCTURES).find(s => 
                s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax
            );
            if (road) creep.repair(road);
            if (creep.memory.homeRoom!==creep.room.name && this.buildStructures(creep)) return; 
            if (travelToHomeRoom(creep)) return;
            
            if (this.fillSpawnExtension(creep)) return;
            if (this.fillContainerOrStorage(creep)) return;
            
        } else {
            const pos = new RoomPosition(creep.memory.source.x, creep.memory.source.y, creep.memory.source.roomName);
            
            if (creep.room.name !== creep.memory.source.roomName) {
                movementManager.smartMove(creep, pos, 1); // <-- ΑΛΛΑΓΗ
                return;
            }

            if (creep.pos.inRangeTo(pos,1)) {
                const source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
                if (source) creep.harvest(source);
            } else {
                movementManager.smartMove(creep, pos, 1); // <-- ΑΛΛΑΓΗ
            }
        }
    },

    runClaimer: function(creep) {
        if (creep.spawning) return;
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) return;
            
        if (travelToTargetRoom(creep)) return;
        
        const controller = creep.room.controller;
        const isOnTargetRoom = creep.room.name === targetRoom;

        if (isOnTargetRoom && controller && controller.my) {
            creep.memory.homeRoom = creep.memory.targetRoom;
            creep.memory.role = "builder";
        }

        if (isOnTargetRoom && controller && !controller.my) {
            if (!controller.owner && !controller.upgradeBlocked) {
                if (creep.pos.inRangeTo(controller,1)) {
                    if (creep.claimController(controller) === 0) {
                        creep.room.memory = {type:"initial_setup", targetRoom: targetRoom}; 
                        creep.memory.role = "builder";
                        return;
                    }
                } else {
                    movementManager.smartMove(creep, controller, 1); // <-- ΑΛΛΑΓΗ
                    return;
                }
            }
            if (!(controller.upgradeBlocked > 0)) {
                if (creep.pos.inRangeTo(controller,1)) {
                    creep.attackController(controller);
                } else {
                    movementManager.smartMove(creep, controller, 1); // <-- ΑΛΛΑΓΗ
                    return;
                }
            }
        }    
        
        if (this.destroyHostileStructures(creep) === true) { 
             creep.say("destroy");
             return;
        }
    },

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
                movementManager.smartMove(creep, target, 1); // <-- ΑΛΛΑΓΗ
            }
            return true;
        }
        return false;  
    },

    runHarvester: function(creep) {
        if (creep.spawning) return;
        if(creep.ticksToLive < minTickToLive && getRecoveryContainerId(creep)) {
            creep.memory.role = "to_be_recycled"; return;
        }
        
        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (source) {
            if (creep.pos.inRangeTo(source, 1)) creep.harvest(source);
            else movementManager.smartMove(creep, source, 1); // <-- ΑΛΛΑΓΗ
        }
    },

    runScout: function(creep) {
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) return;

        if (creep.room.name === targetRoom) {
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                movementManager.smartMove(creep, new RoomPosition(25, 25, targetRoom), 20); // <-- ΑΛΛΑΓΗ
            }
            
            if (typeof getInfoForNeighborRoom === "function") {
                const hasGCL = Game.gcl.level > _.filter(Game.rooms, r => r.controller && r.controller.my).length;
                getInfoForNeighborRoom(creep.room.name, hasGCL, creep.memory.homeRoom);
            }
            creep.say("Bye bye");
            creep.suicide(); 
        } 
        else {
            movementManager.smartMove(creep, new RoomPosition(25, 25, targetRoom), 20); // <-- ΑΛΛΑΓΗ
        }
    },

    runSupporter: function(creep) { 
        if(creep.ticksToLive < minTickToLive && getRecoveryContainerId(creep)) {
            creep.memory.role = "to_be_recycled"; return;
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
            if (travelToTargetRoom(creep)) return;
            if (this.fillSpawnExtension(creep)) return;
            if (this.buildStructures(creep)) return;
            if (this.upgradeController(creep)) return;
        } else {
            if (travelToHomeRoom(creep)) return;
            this.getEnergy(creep);
        }
    },

    fillContainerOrStorage: function(creep) {
        const targets = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) && 
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (targets.length > 0) {
            const target = creep.pos.findClosestByPath(targets); 
            if (target) {
                if (creep.pos.inRangeTo(target, 1)) creep.transfer(target, RESOURCE_ENERGY);
                else movementManager.smartMove(creep, target, 1); // <-- ΑΛΛΑΓΗ
                return true;
            }
        }
        return false;
    },

    fillSpawnExtension: function(creep) { 
        const targets = creep.room.find(FIND_MY_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) && 
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (targets.length > 0) {
            const target = creep.pos.findClosestByPath(targets);
            if (target) {
                if (creep.pos.inRangeTo(target, 1)) creep.transfer(target, RESOURCE_ENERGY);
                else movementManager.smartMove(creep, target, 1); // <-- ΑΛΛΑΓΗ
                return true;
            }
        }
        return false;
    },

    runBuilder: function(creep) {
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

    buildStructures: function(creep) {
        let targets = creep.room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType !== STRUCTURE_ROAD });
        if (targets.length === 0) targets = creep.room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_ROAD });

        if (targets.length > 0) {
            const target = creep.pos.findClosestByPath(targets);
            if (target) {
                if (creep.pos.inRangeTo(target, 3)) creep.build(target);
                else movementManager.smartMove(creep, target, 3); // <-- ΑΛΛΑΓΗ
            }
            return true;
        }
        return false;
    },

    getEnergyFromContainersorStorage: function(creep) { 
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                         s.store[RESOURCE_ENERGY] > 100
        });
        if (containers.length > 0) {
            const closest = creep.pos.findClosestByPath(containers);
            if (closest) {
                if (creep.pos.inRangeTo(closest, 1)) creep.withdraw(closest, RESOURCE_ENERGY);
                else movementManager.smartMove(creep, closest, 1); // <-- ΑΛΛΑΓΗ
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
                else movementManager.smartMove(creep, closest, 1); // <-- ΑΛΛΑΓΗ
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
                else movementManager.smartMove(creep, ruin, 1); // <-- ΑΛΛΑΓΗ
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
                else movementManager.smartMove(creep, closest, 1); // <-- ΑΛΛΑΓΗ
            }
            return true;
        }
        return false;
    },

    getEnergy: function(creep) {
        if (this.getEnergyFromContainersorStorage(creep)) return true;
        if (this.getEnergyFromDroppedEnergy(creep)) return true;
        if (this.getEnergyFromRuins(creep)) return true;     
        if (this.gotoHarvesting(creep)) return true;
        return false;
    },

    runSimpleHarvester: function(creep) {
        if ( travelToHomeRoom(creep)) return;
        
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

    runUpgrader: function(creep) {
        if(creep.ticksToLive < minTickToLive && getRecoveryContainerId(creep)) {
            creep.memory.role = "to_be_recycled"; return;
        }
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) creep.memory.working = false;
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) creep.memory.working = true;

        if (creep.memory.working) this.upgradeController(creep);
        else this.getEnergy(creep);
    },

    upgradeController: function(creep) { 
        if (creep.room.controller) {
            if (creep.pos.inRangeTo(creep.room.controller, 2)) {
                creep.upgradeController(creep.room.controller);
            } else {
                movementManager.smartMove(creep, creep.room.controller, 2); // <-- ΑΛΛΑΓΗ
            }
            return true;
        }
        return false;
    },

    runStaticHarvester: function(creep) { 
        if(!creep.memory.sourceId) {
            const closest = creep.pos.findClosestByPath(FIND_SOURCES);
            if (closest) creep.memory.sourceId = closest.id;
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
            if (!creep.pos.inRangeTo(container, 0)) movementManager.smartMove(creep, container, 0); // <-- ΑΛΛΑΓΗ
        } else {
            if (!creep.pos.inRangeTo(source, 1)) {
                movementManager.smartMove(creep, source, 1); // <-- ΑΛΛΑΓΗ
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
        movementManager.smartMove(creep, recycleContainer, 0); // <-- ΑΛΛΑΓΗ
        return;
    }
    const closestSpawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS);
    if (closestSpawn) closestSpawn.recycleCreep(creep);
}

module.exports = roleManager;