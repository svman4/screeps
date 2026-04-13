const BaseRole = require('role.base');
const movementManager = require('manager.movement');

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
module.exports = LDHarvester;