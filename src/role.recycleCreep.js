const BaseRole = require('role.base');
const movementManager = require('manager.movement');

class To_be_recycled extends BaseRole {
    run() {
        if (this.travelToHomeRoom()) return;
        const container = Game.getObjectById(this.creep.room.memory.recoveryContainerId);
		this.creep.say("BYE BYE");
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