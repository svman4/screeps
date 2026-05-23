const BaseRole = require('role.base');
const movementManager = require('manager.movement');
const roomCache = require('utils.RoomCache');
class To_be_recycled extends BaseRole {
    run() {
        if (this.travelToHomeRoom()) return;
        const container = roomCache.in(this.creep.room.name).recoveryContainer;

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
module.exports = To_be_recycled;