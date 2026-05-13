import BaseRole from 'role/role.base';
import movementManager from 'manager.movement';

class To_be_recycled extends BaseRole {
    run() {
        if (this.travelToHomeRoom()) return;
        const container = Game.getObjectById(this.creep.room.memory.recoveryContainerId);

        if (container) {
            if (!this.creep.pos.inRangeTo(container, 0)) {
                movementManager.smartMove(this.creep, container, 0);
            } else {
                const spawn = this.creep.pos.findClosestByRange(FIND_MY_SPAWNS);
                if (spawn) spawn.recycleCreep(this.creep);
            }
        } else {
            this.creep.suicide();
        }
    }
}
export default To_be_recycled;