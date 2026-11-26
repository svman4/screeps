import BaseRole from './role.base';
import movementManager from './manager.movement';
import { FSM } from './utils.fsm';

const LDHarvesterStates = new FSM({
    COLLECTING: function (this: LDHarvester) {
        if (this.creep.store.getFreeCapacity() === 0) {
            LDHarvesterStates.transition(this, 'WORKING', this.creep.memory);
            return;
        }
        // Πηγαίνει στο δωμάτιο για harvesting
        if (this.travelToTargetRoom()) {
            return;
        }
        const source = this.creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
        if (source) {
            if (this.creep.pos.inRangeTo(source, 1)) this.creep.harvest(source);
            else movementManager.smartMove(this.creep, source, 1);
        }


    },
    WORKING: function (this: LDHarvester) {
        if (this.creep.store[RESOURCE_ENERGY] === 0) {
            LDHarvesterStates.transition(this, 'COLLECTING', this.creep.memory);
            return;
        }

        const road = this.creep.pos.lookFor(LOOK_STRUCTURES)
            .find(s => s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax);
        if (road) this.creep.repair(road);
        if (this.travelToHomeRoom()) return;
        if (this.fillSpawnExtension()) return;

        const target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (target) {
            if (this.creep.pos.inRangeTo(target, 1)) this.creep.transfer(target, RESOURCE_ENERGY);
            else movementManager.smartMove(this.creep, target, 1);
        }

    }
}); // end of LDHarvesterStates



class LDHarvester extends BaseRole {
    constructor(creep: Creep) {
        super(creep);
    }
    run() {
        LDHarvesterStates.run(this, 'COLLECTING', this.creep.memory);
    }
}
export default LDHarvester;

