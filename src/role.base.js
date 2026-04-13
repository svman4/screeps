const movementManager = require('manager.movement');

class BaseRole {
    constructor(creep) {
        this.creep = creep;
    }

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

    getEnergy() {
        if (this.getEnergyFromContainersorStorage()) return true;
        if (this.getEnergyFromDroppedEnergy()) return true;
        if (this.getEnergyFromRuins()) return true;
        return this.gotoHarvesting();
    }

    getEnergyFromContainersorStorage(resource = RESOURCE_ENERGY) {
        const target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                         s.store[resource] > 0
        });
        if (target) {
            if (this.creep.pos.inRangeTo(target, 1)) this.creep.withdraw(target, resource);
            else movementManager.smartMove(this.creep, target, 1);
            return true;
        }
        return false;
    }

    getAnyMineralFromContainers() {
        const target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_CONTAINER) && 
                         Object.keys(s.store).some(res => res !== RESOURCE_ENERGY && s.store[res] > 0)
        });
        if (target) {
            const resourceType = Object.keys(target.store).find(res => res !== RESOURCE_ENERGY && target.store[res] > 0);
            if (resourceType) {
                if (this.creep.pos.inRangeTo(target, 1)) this.creep.withdraw(target, resourceType);
                else movementManager.smartMove(this.creep, target, 1);
                return true;
            }
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
        const priorityRoles = ['LDHarvester', 'hauler', 'supporter'];
        const blocker = this.creep.pos.findInRange(FIND_MY_CREEPS, 1).find(
            c => c.id !== this.creep.id && priorityRoles.includes(c.memory.role) && c.fatigue === 0
        );
        if (!blocker) return false;
        if (movementManager.isBlockingPath(this.creep)) {
            const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
            for (let dir of directions) {
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

module.exports = BaseRole;