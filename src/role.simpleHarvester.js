const BaseRole = require('role.base');
const movementManager = require('manager.movement');

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
module.exports = SimpleHarvester;