const BaseRole = require('role.base');
const movementManager = require('manager.movement');

class Miner extends BaseRole {
    run() {
        if (!this.creep.memory.working && this.creep.store.getFreeCapacity() === 0) this.creep.memory.working = true;
        if (this.creep.memory.working && this.creep.store.getUsedCapacity() === 0) this.creep.memory.working = false;

        if (!this.creep.memory.working) {
            if (this.getAnyMineralFromContainers()) return;
            const mineral = Game.getObjectById(this.creep.memory.mineralId) || this.creep.pos.findClosestByPath(FIND_MINERALS);
            if (mineral) {
                this.creep.memory.mineralId = mineral.id;
                if (mineral.mineralAmount > 0) {
                    if (!this.creep.pos.inRangeTo(mineral, 1)) movementManager.smartMove(this.creep, mineral, 1);
                    else this.creep.harvest(mineral);
                } else {
                    this.creep.say('💤 waiting');
                }
            }
        } else {
            const target = this.creep.room.terminal || this.creep.room.storage;
            if (target) {
                if (this.creep.pos.inRangeTo(target, 1)) {
                    for (const res in this.creep.store) {
                        this.creep.transfer(target, res);
                    }
                } else {
                    movementManager.smartMove(this.creep, target, 1);
                }
            }
        }
    }
}
module.exports = Miner;