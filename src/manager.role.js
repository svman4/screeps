// manager.role.js - ΕΚΔΟΣΗ ΜΕ SMART PATHFINDING

const minTickToLive = 30;

// --- GLOBAL CACHE (Για το CostMatrix - Όπως στο Logistics) ---
let matrixCache = {}; 
let lastMatrixUpdate = {};

const MoveUtils = {
    /**
     * ΕΛΕΓΧΕΙ ΚΑΙ ΕΠΙΣΤΡΕΦΕΙ ΤΟ CostMatrix TOY ROOM
     */
    getRoomCostMatrix: function(roomName) {
        if (matrixCache[roomName] && lastMatrixUpdate[roomName] > Game.time - 1000) {
            return matrixCache[roomName];
        }

        const room = Game.rooms[roomName];
        if (!room) return new PathFinder.CostMatrix;

        const costs = new PathFinder.CostMatrix;

        // 1. Δρόμοι και Δομές
        room.find(FIND_STRUCTURES).forEach(function(struct) {
            if (struct.structureType === STRUCTURE_ROAD) {
                costs.set(struct.pos.x, struct.pos.y, 1);
            } else if (struct.structureType !== STRUCTURE_CONTAINER && 
                       (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                costs.set(struct.pos.x, struct.pos.y, 0xff);
            }
        });

        // 2. Construction Sites
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
     * ΕΞΥΠΝΗ ΚΙΝΗΣΗ (SmartMove)
     */
    smartMove: function(creep, targetObj, range = 1) {
        if (creep.fatigue > 0) return;

        const targetPos = targetObj.pos || targetObj;

        // Έλεγχος αν έχουμε φτάσει
        if (creep.pos.inRangeTo(targetPos, range)) return;

        // Ανίχνευση "κολλήματος" (Stuck Detection)
        if (!creep.memory._lastPos || creep.memory._lastPos.x !== creep.pos.x || creep.memory._lastPos.y !== creep.pos.y) {
            creep.memory._lastPos = { x: creep.pos.x, y: creep.pos.y };
            creep.memory._stuckCount = 0;
        } else {
            creep.memory._stuckCount = (creep.memory._stuckCount || 0) + 1;
        }

        const isStuck = creep.memory._stuckCount >= 2;

        const ret = PathFinder.search(
            creep.pos, 
            { pos: targetPos, range: range },
            {
                plainCost: 2,
                swampCost: 10,
                roomCallback: (roomName) => {
                    let costs = this.getRoomCostMatrix(roomName);
                    if (isStuck) {
                        costs = costs.clone();
                        const room = Game.rooms[roomName];
                        if (room) {
                            room.find(FIND_CREEPS).forEach(c => {
                                if (c.id !== creep.id) {
                                    costs.set(c.pos.x, c.pos.y, 0xff);
                                }
                            });
                        }
                    }
                    return costs;
                },
                maxOps: 2000 // Αυξημένο λίγο για inter-room travel
            }
        );

        if (ret.path.length > 0) {
            creep.moveByPath(ret.path);
        } else {
            // Fallback
            creep.moveTo(targetPos); 
        }
    }
};

// --- HELPER FUNCTIONS ΓΙΑ ΤΑΞΙΔΙΑ ---

function travelToHomeRoom(creep) {
    const homeRoom = creep.memory.homeRoom;
    if (creep.room.name !== homeRoom) {
        // Range 20: Απλά να μπει στο δωμάτιο, όχι απαραίτητα στο 25,25
        MoveUtils.smartMove(creep, new RoomPosition(25, 25, homeRoom), 20);
        return true; 
    }
    // ΑΝΤΙ-BOUNCE
    if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
        MoveUtils.smartMove(creep, new RoomPosition(25, 25, homeRoom), 20);
        return true;
    }
    return false; 
}

function travelToTargetRoom(creep) {
    const targetRoom = creep.memory.targetRoom;
    if (!targetRoom) return false;
    
    if (creep.room.name !== targetRoom) {
        MoveUtils.smartMove(creep, new RoomPosition(25, 25, targetRoom), 20);
        return true;
    }
    // ΑΝΤΙ-BOUNCE
    if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
        MoveUtils.smartMove(creep, new RoomPosition(25, 25, targetRoom), 20);
        return true;
    }
    return false;
}

const roleManager = {
    run: function() {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.spawning) continue; 

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
                    break;
                case "miner" : 
                    this.runMiner(creep);
                    break;
            }
        }
    },
    runMiner:function(creep) { 
        if (creep.spawning) return;
        
        
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
         
        }
        if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
                creep.memory.working = false;
                if(creep.ticksToLive < 200) {
                    creep.memory.role = "to_be_recycled";
                    return;
                }
                //creep.say('🔄 harvest');
        }
        
        if (creep.memory.working===false ) {
            if(!creep.memory.mineralId) {
                const closestSource = creep.pos.findClosestByPath(FIND_SOURCES);
                if (closestSource) creep.memory.sourceId = closestSource.id;
                else return;
            }
            const source = Game.getObjectById(creep.memory.mineralId);
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
                    MoveUtils.smartMove(creep, container, 0);
                } 
            } else {
                if (!creep.pos.inRangeTo(source, 1)) {
                    MoveUtils.smartMove(creep, source, 1);
                    return; 
                }
            }
            if((source.cooldown>0)===false ) {
                creep.harvest(source);
            }
        }
        else {
            if (creep.pos.inRangeTo(creep.room.terminal,1)===true) {
                for (const resourceType in creep.store) {
                    creep.transfer(creep.room.terminal, resourceType);
                }
            }
            else {
                MoveUtils.smartMove(creep,creep.room.terminal,1);
            
            }

        }
        
    
    },
    runLDHarvester: function(creep) { 
        if (creep.spawning) return;
        if(creep.ticksToLive < 200) {
            creep.memory.role = "to_be_recycled";
            return;
        }

        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
                creep.memory.working = false;
                creep.say('🔄 harvest');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🚚 deliver');
        }
        
        if (creep.memory.working) {
            const road = creep.pos.lookFor(LOOK_STRUCTURES).find(s => 
                s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax
            );
            if (road) {
                creep.repair(road);
            }
            
            if ( (creep.room.name !== creep.memory.homeRoom) && this.buildStructures(creep)) {return;}
            if (travelToHomeRoom(creep)) { 
                return;
            }
            
            if (this.fillContainerOrStorage(creep)) {
                return;
            }
            if (this.fillSpawnExtension(creep)) {return;}
                
            creep.drop(RESOURCE_ENERGY);
        } else {
             const pos = new RoomPosition(
                creep.memory.source.x,
                creep.memory.source.y,
                creep.memory.source.roomName
            );
            
            if (creep.pos.inRangeTo(pos,1)) {
                const source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
                creep.harvest(source);
            } else {
                MoveUtils.smartMove(creep, pos, 1);
            }
        }
    },

    runClaimer: function(creep) {
        if (creep.spawning) return;
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) return;
            
        // 1. TRAVEL TO TARGET ROOM
        if (travelToTargetRoom(creep)) { 
            return;
        }
        
        // 2. IN TARGET ROOM
        const controller = creep.room.controller;
        const isOnTargetRoom = creep.room.name === targetRoom;

        if (isOnTargetRoom && controller && (controller.my)) {
            creep.memory.homeRoom = creep.memory.targetRoom;
            creep.memory.role = "builder";
        }

        if (isOnTargetRoom && controller && (!controller.my)) {
            if (!controller.owner && !controller.upgradeBlocked) {
                if (creep.pos.inRangeTo(controller,1)) {
                    const claimResult = creep.claimController(controller);
                        if (claimResult === 0) {
                            console.log("Claim controller successfully");
                            creep.room.memory = {type:"initial_setup"}
                            creep.memory.role = "builder";
                            return;
                        }
                } else {
                    MoveUtils.smartMove(creep, controller, 1);
                    return;
                }
            }
            if (!((controller.upgradeBlocked || 0) > 0)) {
                if (controller && creep.pos.inRangeTo(controller,1)) {
                    const attackResult = creep.attackController(controller);
                    if (attackResult === 0) {
                        console.log("Attack controller successfully");
                        return;
                    }
                } else {
                    MoveUtils.smartMove(creep, controller, 1);
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

        if (target) {
            if (creep.dismantle(target) === ERR_NOT_IN_RANGE) {
                MoveUtils.smartMove(creep, target, 1);
            }
            console.log("Destroy tower");
            return true;
        } 
        
        target = creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS);
        if (target) {
            if (creep.dismantle(target) === ERR_NOT_IN_RANGE) {
                MoveUtils.smartMove(creep, target, 1);
            }
            console.log("Destroy spawns");
            return true;
        }
        
        target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
            filter: (s) => s.structureType !== STRUCTURE_WALL && 
                           s.structureType !== STRUCTURE_RAMPART &&
                           s.structureType !== STRUCTURE_CONTROLLER 
        });
        if (target) {
            if(creep.pos.inRangeTo(target, 1)) {
                creep.dismantle(target);
            } else {
                MoveUtils.smartMove(creep, target, 1);
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
        if (source) {
            if (creep.pos.inRangeTo(source, 1)) {
                creep.harvest(source);
            } else {
                MoveUtils.smartMove(creep, source, 1);
            }
        }
    },

    runScout: function(creep) {
        if (creep.spawning) return;
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) return;

        if (creep.room.name === targetRoom) {
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                MoveUtils.smartMove(creep, new RoomPosition(25, 25, targetRoom), 20);
            }
            if (creep.room.name !== creep.memory.homeRoom) {
               const hasGCL = Game.gcl.level > _.filter(Game.rooms, r => r.controller && r.controller.my).length;
                getInfoForNeighborRoom(creep.room.name, hasGCL, creep.memory.homeRoom);
            }
            creep.say("Bye bye");
            creep.suicide();
        } 
        else {
            const exit = creep.room.findExitTo(targetRoom);
            if (exit === ERR_NO_PATH) {
                creep.say("No Path");
            } else {
                // Για τους scouts αφήνουμε το moveTo γιατί στοχεύουν exit/position και όχι αντικείμενο
                // και θέλουμε να βρουν δρόμο προς το δωμάτιο
                MoveUtils.smartMove(creep, new RoomPosition(25, 25, targetRoom), 20);
            }
        }
    },

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

    fillContainerOrStorage: function(creep) {
        const targets = creep.room.find(FIND_MY_STRUCTURES, {
            filter: (s) => {
                return (s.structureType === STRUCTURE_CONTAINER ||
                        s.structureType === STRUCTURE_STORAGE ) && 
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            }
        );
        if (targets && targets.length > 0) {
            const target = creep.pos.findClosestByPath(targets); // Βελτιστοποίηση: βρες το κοντινότερο
            if (target) {
                if (creep.pos.inRangeTo(target, 1)) {
                    creep.transfer(target, RESOURCE_ENERGY);
                } else {
                    MoveUtils.smartMove(creep, target, 1);
                }
                return true;
            }
        }
        return false;
    },

    fillSpawnExtension: function(creep) { 
        const targets = creep.room.find(FIND_MY_STRUCTURES, {
            filter: (s) => {
                return (s.structureType === STRUCTURE_EXTENSION ||
                        s.structureType === STRUCTURE_SPAWN ) && 
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            }
        );
        if (targets && targets.length > 0) {
            const target = creep.pos.findClosestByPath(targets);
            if (target) {
                if (creep.pos.inRangeTo(target, 1)) {
                    creep.transfer(target, RESOURCE_ENERGY);
                } else {
                    MoveUtils.smartMove(creep, target, 1);
                }
                return true;
            }
        }
        return false;
    },

    runBuilder: function(creep) {
        if(creep.spawning) return;
        
        if (travelToHomeRoom(creep)) {
            creep.say("✈️");
            return;
        }

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
                // Range 3 για χτίσιμο
                if (creep.pos.inRangeTo(closestSite, 3)) {
                    creep.build(closestSite);
                } else {
                    MoveUtils.smartMove(creep, closestSite, 3);                
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
                    MoveUtils.smartMove(creep, closestRoad, 3);
                }
            }
            return true;
        }
        return false;
    },

    getEnergyFromContainersorStorage: function(creep) { 
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
                    MoveUtils.smartMove(creep, closest, 1);
                }
            }
            return true;
        }
        return false;
    },

    getEnergyFromDroppedEnergy: function(creep) {
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
                    MoveUtils.smartMove(creep, closest, 1);
                }
            }
            return true;
        }  
        return false;
    },

    getEnergyFromRuins: function(creep) { 
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
                    MoveUtils.smartMove(creep, ruin, 1);
                }
            }
            return true;
        }
        return false;
    },

    gotoHarvesting: function(creep) { 
        const sources = creep.room.find(FIND_SOURCES_ACTIVE);
        if (sources.length > 0) {
            const closestSource = creep.pos.findClosestByPath(sources);
            if (closestSource) {
                if (creep.pos.inRangeTo(closestSource, 1)) {
                    creep.harvest(closestSource);
                } else {
                    MoveUtils.smartMove(creep, closestSource, 1);
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
        if (this.gotoHarvesting(creep)) {return ;}
        return true;
    },

    runSimpleHarvester: function(creep) {
        if (creep.spawning) return;
        
        if (travelToHomeRoom(creep)) {
            creep.say("✈️");
            return;
        }
        
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
           if (this.buildStructures(creep)) { return ; }
            this.upgradeController(creep);
        } else {
            if (this.getEnergyFromDroppedEnergy(creep)) { return;}
        
            if (this.getEnergy(creep)) {return ; }
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

    upgradeController: function(creep) { 
        // Χρήση Range 3 για upgrade
        if (creep.pos.inRangeTo(creep.room.controller, 2)) {
                creep.upgradeController(creep.room.controller);
        } else {
            MoveUtils.smartMove(creep, creep.room.controller, 2);
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
                MoveUtils.smartMove(creep, container, 0);
            } 
        } else {
            if (!creep.pos.inRangeTo(source, 1)) {
                MoveUtils.smartMove(creep, source, 1);
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
        MoveUtils.smartMove(creep, recycleContainer, 0);
        return;
    }
    const spawns = creep.room.find(FIND_MY_SPAWNS);
    const closestSpawn = creep.pos.findClosestByRange(spawns);
    if (closestSpawn) closestSpawn.recycleCreep(creep);
}

module.exports = roleManager;