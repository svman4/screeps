const BaseRole = require('role.base');
const movementManager = require('manager.movement');

class Harvester extends BaseRole {
    run() {
        const source = this.creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (source) {
            if (this.creep.pos.inRangeTo(source, 1)) this.creep.harvest(source);
            else movementManager.smartMove(this.creep, source, 1);
        }
    }
}
module.exports = Harvester;