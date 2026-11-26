import { MovementManager } from './manager.movement';
import BaseRole from './role.base';
import { FSM } from './utils.fsm';
const movementManager = new MovementManager();
const minerStates = new FSM({
    COLLECTING: function (this: Miner) {
        if (this.creep.store.getFreeCapacity() === 0) {
            minerStates.transition(this, 'WORKING', this.creep.memory);
            return;
        }
        const target = this.creep.room.terminal || this.creep.room.storage;
        if (target) {
            if (this.creep.pos.inRangeTo(target, 1)) {
                for (const res of Object.keys(this.creep.store) as ResourceConstant[]) {
                    this.creep.transfer(target, res);
                }
            } else {
                movementManager.smartMove(this.creep, target, 1);
            }
        }
    },
    WORKING: function (this: Miner) {
        if (this.creep.store.getCapacity() === this.creep.store.getUsedCapacity()) {
            // Εφόσον είναι γεμάτο αλλάζει κατάσταση.
            minerStates.transition(this, 'COLLECTING', this.creep.memory);
            return;
        }
        if (this.getAnyMineralFromContainers()) return;
        const mineral = Game.getObjectById(this.creep.memory.mineralId) ||
            this.creep.pos.findClosestByPath(FIND_MINERALS);
        if (mineral) {
            this.creep.memory.mineralId = mineral.id;
            if (mineral.mineralAmount > 0) {
                if (!this.creep.pos.inRangeTo(mineral, 1)) movementManager.smartMove(this.creep, mineral, 1);
                else this.creep.harvest(mineral);
            } else {
                this.creep.say('💤 waiting');
            }
        }
        return;
    }
}); // end of minerStates

class Miner extends BaseRole {
    run() {
        if (this.travelToHomeRoom()) return;
        minerStates.run(this, "COLLECTING", this.creep.memory);
    } // end of run()
} // end of Miner
module.exports = Miner;