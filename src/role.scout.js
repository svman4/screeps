const BaseRole = require('role.base');
const movementManager = require('manager.movement');
const expansionManager = require('manager.expansion');
class Scout extends BaseRole {
    run() {
        if (this.travelToTargetRoom()) return;
        const targetRoom = this.creep.memory.targetRoom;
		
		expansionManager.updateRoomIntel(
			this.creep.room,
			expansionManager.canIExpand()
		);
        //getInfoForNeighborRoom(targetRoom);
        
        this.creep.suicide();
    }
}
module.exports = Scout;