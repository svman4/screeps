import BaseRole from 'role/role.base';


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
export default Builder;