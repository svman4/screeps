import BaseRole from './role.base';
import { FSM } from './utils.fsm';
const builderStates = new FSM({
    COLLECTING: function (this: Builder) {
        if (this.creep.store.getFreeCapacity() === 0) {
            builderStates.transition(this, 'WORKING', this.creep.memory);
            return;
        }
        this.getEnergy();
    },
    WORKING: function (this: Builder) {
        if (this.creep.store[RESOURCE_ENERGY] === 0) {
            builderStates.transition(this, 'COLLECTING', this.creep.memory);
            return;
        }
        if (this.buildStructures()) {
            return;
        }
        if (this.upgradeController()) {
            return;
        }
        return;
    }
}); // end of upgraderStates


class Builder extends BaseRole {
    constructor(creep: Creep) {
        super(creep);
    }
    run() {
        if (this.travelToHomeRoom()) return;

        if (this.checkYield()) return;
        builderStates.run(this, "COLLECTING", this.creep.memory);

    } //end of run
}
module.exports = Builder;
