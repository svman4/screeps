import BaseRole from 'role.base';

import expansionManager from 'manager.expansion';

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
export default Scout;