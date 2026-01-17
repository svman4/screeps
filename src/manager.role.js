/**
 * @file manager.role.js
 */
const movementManager = require('manager.movement');

const minTickToLive = 30;

/**
 * --- Η Κεντρική Κλάση (Parent Class) ---
 */
class BaseRole {
    constructor(creep) {
        this.creep = creep;
    }

    // --- Movement Logic ---
    travelToHomeRoom() {
        const homeRoom = this.creep.memory.homeRoom;
        if (this.creep.room.name !== homeRoom || this.isAtEdge()) {
            movementManager.smartMove(this.creep, new RoomPosition(25, 25, homeRoom), 20);
            return true;
        }
        return false;
    }

    travelToTargetRoom() {
        const targetRoom = this.creep.memory.targetRoom;
        if (!targetRoom) return false;
        if (this.creep.room.name !== targetRoom || this.isAtEdge()) {
            movementManager.smartMove(this.creep, new RoomPosition(25, 25, targetRoom), 20);
            return true;
        }
        return false;
    }

    isAtEdge() {
        const { x, y } = this.creep.pos;
        return x === 0 || x === 49 || y === 0 || y === 49;
    }

    // --- Energy & Resource Logic ---
    getEnergy() {
        if (this.getEnergyFromContainersorStorage()) return true;
        if (this.getEnergyFromDroppedEnergy()) return true;
        if (this.getEnergyFromRuins()) return true;
        return this.gotoHarvesting();
    }

    getEnergyFromContainersorStorage() {
        const target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                         s.store[RESOURCE_ENERGY] > 100
        });
        if (target) {
            if (this.creep.pos.inRangeTo(target, 1)) this.creep.withdraw(target, RESOURCE_ENERGY);
            else movementManager.smartMove(this.creep, target, 1);
            return true;
        }
        return false;
    }

    getEnergyFromDroppedEnergy() {
        const dropped = this.creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 40
        });
        if (dropped) {
            if (this.creep.pos.inRangeTo(dropped, 1)) this.creep.pickup(dropped);
            else movementManager.smartMove(this.creep, dropped, 1);
            return true;
        }
        return false;
    }

    getEnergyFromRuins() {
        const ruin = this.creep.pos.findClosestByPath(FIND_RUINS, { filter: s => s.store[RESOURCE_ENERGY] > 40 });
        if (ruin) {
            if (this.creep.pos.inRangeTo(ruin, 1)) this.creep.withdraw(ruin, RESOURCE_ENERGY);
            else movementManager.smartMove(this.creep, ruin, 1);
            return true;
        }
        return false;
    }

    gotoHarvesting() {
        const source = this.creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (source) {
            if (this.creep.pos.inRangeTo(source, 1)) this.creep.harvest(source);
            else movementManager.smartMove(this.creep, source, 1);
            return true;
        }
        return false;
    }

    // --- Delivery & Work ---
    fillSpawnExtension() {
        const target = this.creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
                         s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (target) {
            if (this.creep.pos.inRangeTo(target, 1)) this.creep.transfer(target, RESOURCE_ENERGY);
            else movementManager.smartMove(this.creep, target, 1);
            return true;
        }
        return false;
    }

    buildStructures() {
        let targets = this.creep.room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType !== STRUCTURE_ROAD });
        if (targets.length === 0) targets = this.creep.room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_ROAD });

        if (targets.length > 0) {
            const target = this.creep.pos.findClosestByPath(targets);
            if (target) {
                if (this.creep.pos.inRangeTo(target, 3)) this.creep.build(target);
                else movementManager.smartMove(this.creep, target, 3);
            }
            return true;
        }
        return false;
    }

    upgradeController() {
        if (this.creep.room.controller) {
            if (this.creep.pos.inRangeTo(this.creep.room.controller, 2)) this.creep.upgradeController(this.creep.room.controller);
            else movementManager.smartMove(this.creep, this.creep.room.controller, 2);
            return true;
        }
        return false;
    }

    checkYield() {
        // 1. Έλεγχος αν υπάρχει κάποιος που θέλει να περάσει
        const priorityRoles = ['LDHarvester', 'hauler', 'supporter'];
        const blocker = this.creep.pos.findInRange(FIND_MY_CREEPS, 1).find(
            c => {
                // Εδώ ορίζεις ποιοι ρόλοι έχουν "προτεραιότητα" (Priority Roles)
            
                return c.id !== this.creep.id && 
                    priorityRoles.includes(c.memory.role) && 
                    c.fatigue === 0; // Μόνο αν μπορεί να κινηθεί
                }
            );

    // Αν δεν υπάρχει Hauler κοντά, μην κάνεις yield
    if (!blocker) return false;
        if (movementManager.isBlockingPath(this.creep)) {
            const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
            for (let dir of directions) {
                const pos = this.creep.pos.getPositionAtDirection ? this.creep.pos.getPositionAtDirection(dir) : null; 
                // Fallback αν δεν υπάρχει helper
                const nx = this.creep.pos.x + (dir === RIGHT || dir === TOP_RIGHT || dir === BOTTOM_RIGHT ? 1 : dir === LEFT || dir === TOP_LEFT || dir === BOTTOM_LEFT ? -1 : 0);
                const ny = this.creep.pos.y + (dir === BOTTOM || dir === BOTTOM_RIGHT || dir === BOTTOM_LEFT ? 1 : dir === TOP || dir === TOP_RIGHT || dir === TOP_LEFT ? -1 : 0);
                
                if (nx >= 0 && nx <= 49 && ny >= 0 && ny <= 49) {
                    const terrain = this.creep.room.getTerrain().get(nx, ny);
                    if (terrain !== TERRAIN_MASK_WALL) {
                        const isBlocked = this.creep.room.lookForAt(LOOK_STRUCTURES, nx, ny).some(s => 
                            OBSTACLE_OBJECT_TYPES.includes(s.structureType) && (s.structureType !== STRUCTURE_RAMPART || !s.my)
                        );
                        if (!isBlocked) {
                            this.creep.move(dir);
                            this.creep.say('🚧 yield');
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
}

/**
 * --- Ρόλοι (Child Classes) ---
 */

class Harvester extends BaseRole {
    run() {
        const source = this.creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (source) {
            if (this.creep.pos.inRangeTo(source, 1)) this.creep.harvest(source);
            else movementManager.smartMove(this.creep, source, 1);
        }
    }
}

class SimpleHarvester extends BaseRole {
    run() {
        if (this.travelToHomeRoom()) return;
        if (this.creep.memory.working && this.creep.store[RESOURCE_ENERGY] === 0) this.creep.memory.working = false;
        if (!this.creep.memory.working && this.creep.store.getFreeCapacity() === 0) this.creep.memory.working = true;

        if (this.creep.memory.working) {
            if (this.fillSpawnExtension()) return;
            if (this.buildStructures()) return;
            this.upgradeController();
        } else {
            if (!this.getEnergyFromDroppedEnergy()) this.getEnergy();
        }
    }
}

class Upgrader extends BaseRole {
    run() {
        if (this.checkYield()) return;
        if (this.creep.memory.working && this.creep.store[RESOURCE_ENERGY] === 0) this.creep.memory.working = false;
        if (!this.creep.memory.working && this.creep.store.getFreeCapacity() === 0) this.creep.memory.working = true;

        if (this.creep.memory.working) this.upgradeController();
        else this.getEnergy();
    }
}

class StaticHarvester extends BaseRole {
    run() {
        if (!this.creep.memory.sourceId) {
            const closest = this.creep.pos.findClosestByPath(FIND_SOURCES);
            if (closest) this.creep.memory.sourceId = closest.id;
        }
        const source = Game.getObjectById(this.creep.memory.sourceId);
        if (!source) return;

        let container = Game.getObjectById(this.creep.memory.containerId);
        if (!container) {
            const containers = source.pos.findInRange(FIND_STRUCTURES, 2, { filter: s => s.structureType === STRUCTURE_CONTAINER });
            if (containers.length > 0) {
                container = containers[0];
                this.creep.memory.containerId = container.id;
            }
        }

        if (container) {
            if (!this.creep.pos.inRangeTo(container, 0)) movementManager.smartMove(this.creep, container, 0);
        } else if (!this.creep.pos.inRangeTo(source, 1)) {
            movementManager.smartMove(this.creep, source, 1);
            return;
        }
        this.creep.harvest(source);
    }
}

class Builder extends BaseRole {
    run() {
        if (this.travelToHomeRoom()) return;
        if (this.checkYield()) return;
        if (this.creep.memory.working && this.creep.store[RESOURCE_ENERGY] === 0) this.creep.memory.working = false;
        if (!this.creep.memory.working && this.creep.store.getFreeCapacity() === 0) this.creep.memory.working = true;

        if (this.creep.memory.working) {
            if (!this.buildStructures()) this.upgradeController();
        } else {
            this.getEnergy();
        }
    }
}

class LDHarvester extends BaseRole {
    run() {
        if (this.creep.memory.working && this.creep.store[RESOURCE_ENERGY] === 0) this.creep.memory.working = false;
        if (!this.creep.memory.working && this.creep.store.getFreeCapacity() === 0) this.creep.memory.working = true;

        if (this.creep.memory.working) {
            const road = this.creep.pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax);
            if (road) this.creep.repair(road);
            if (this.creep.memory.homeRoom !== this.creep.room.name && this.buildStructures()) return;
            if (this.travelToHomeRoom()) return;
            if (this.fillSpawnExtension()) return;
            
            // Fill Storage/Container logic
            const target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
            if (target) {
                if (this.creep.pos.inRangeTo(target, 1)) this.creep.transfer(target, RESOURCE_ENERGY);
                else movementManager.smartMove(this.creep, target, 1);
            }
        } else {
            const pos = new RoomPosition(this.creep.memory.source.x, this.creep.memory.source.y, this.creep.memory.source.roomName);
            if (this.creep.room.name !== pos.roomName) {
                movementManager.smartMove(this.creep, pos, 1);
            } else {
                const source = this.creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
                if (source) {
                    if (this.creep.pos.inRangeTo(source, 1)) this.creep.harvest(source);
                    else movementManager.smartMove(this.creep, source, 1);
                }
            }
        }
    }
}

class Supporter extends BaseRole {
    run() {
        if (this.creep.memory.working && this.creep.store[RESOURCE_ENERGY] === 0) this.creep.memory.working = false;
        if (!this.creep.memory.working && this.creep.store.getFreeCapacity() === 0) this.creep.memory.working = true;

        if (this.creep.memory.working) {
            if (this.travelToTargetRoom()) return;
            if (this.fillSpawnExtension()) return;
            if (this.buildStructures()) return;
            this.upgradeController();
        } else {
            if (this.travelToHomeRoom()) return;
            this.getEnergy();
        }
    }
}

class Claimer extends BaseRole {
    run() {
        if (this.travelToTargetRoom()) return;
        const controller = this.creep.room.controller;
        if (!controller) return;

        if (controller.my) {
            this.creep.memory.homeRoom = this.creep.room.name;
            this.creep.memory.role = 'builder';
            return;
        }

        if (!controller.owner && !controller.upgradeBlocked) {
            if (this.creep.pos.inRangeTo(controller, 1)) {
                if (this.creep.claimController(controller) === OK) {
                    this.creep.room.memory = { type: "initial_setup", targetRoom: this.creep.room.name };
                    this.creep.memory.role = "builder";
                }
            } else movementManager.smartMove(this.creep, controller, 1);
        } else {
            if (this.creep.pos.inRangeTo(controller, 1)) this.creep.attackController(controller);
            else movementManager.smartMove(this.creep, controller, 1);
        }
        this.destroyHostiles();
    }

    destroyHostiles() {
        let target = this.creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
        if (!target) target = this.creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS);
        if (target) {
            if (this.creep.dismantle(target) === ERR_NOT_IN_RANGE) movementManager.smartMove(this.creep, target, 1);
            return true;
        }
        return false;
    }
}

class Miner extends BaseRole {
    run() {
        if (!this.creep.memory.working && this.creep.store.getFreeCapacity() === 0) this.creep.memory.working = true;
        if (this.creep.memory.working && this.creep.store.getUsedCapacity() === 0) this.creep.memory.working = false;

        if (!this.creep.memory.working) {
            const mineral = Game.getObjectById(this.creep.memory.mineralId) || this.creep.pos.findClosestByPath(FIND_MINERALS);
            if (mineral) {
                this.creep.memory.mineralId = mineral.id;
                if (!this.creep.pos.inRangeTo(mineral, 1)) movementManager.smartMove(this.creep, mineral, 1);
                else this.creep.harvest(mineral);
            }
        } else {
            const target = this.creep.room.terminal || this.creep.room.storage;
            if (target) {
                if (this.creep.pos.inRangeTo(target, 1)) {
                    for (const res in this.creep.store) this.creep.transfer(target, res);
                } else movementManager.smartMove(this.creep, target, 1);
            }
        }
    }
}

class Scout extends BaseRole {
    run() {
        if (this.travelToTargetRoom()) return;
        this.creep.suicide();
    }
}

/**
 * --- Main Role Manager Object ---
 */
const roleManager = {
    roleClasses: {
        'harvester': Harvester,
        'simpleHarvester': SimpleHarvester,
        'upgrader': Upgrader,
        'staticHarvester': StaticHarvester,
        'builder': Builder,
        'claimer': Claimer,
        'scout': Scout,
        'supporter': Supporter,
        'LDHarvester': LDHarvester,
        'miner': Miner
    },

    run: function() {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.spawning) continue;

            // Recycling check
            if (creep.ticksToLive < minTickToLive && creep.room.memory.recoveryContainerId) {
                creep.memory.role = "to_be_recycled";
            }

            if (creep.memory.role === "to_be_recycled") {
                this.runRecycle(creep);
                continue;
            }

            const RoleClass = this.roleClasses[creep.memory.role];
            if (RoleClass) {
                const roleInstance = new RoleClass(creep);
                try {
                    roleInstance.run();
                } catch (e) {
                    console.log(`Error in role ${creep.memory.role} for ${creep.name}:`, e);
                }
            }
        }
    },

    runRecycle: function(creep) {
        const container = Game.getObjectById(creep.room.memory.recoveryContainerId);
        if (container) {
            if (!creep.pos.inRangeTo(container, 0)) movementManager.smartMove(creep, container, 0);
            else {
                const spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS);
                if (spawn) spawn.recycleCreep(creep);
            }
        } else {
            creep.suicide();
        }
    }
};

module.exports = roleManager;