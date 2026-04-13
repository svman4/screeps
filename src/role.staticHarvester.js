const BaseRole = require('role.base');
const movementManager = require('manager.movement');

class StaticHarvester extends BaseRole {
    run() {
        if (!this.creep.memory.sourceId) {
            const closest = this.creep.pos.findClosestByPath(FIND_SOURCES);
            if (closest) this.creep.memory.sourceId = closest.id;
        }
        const source = Game.getObjectById(this.creep.memory.sourceId);
        if (!source) return;

        let container = Game.getObjectById(this.creep.memory.containerId);
        if (!container) {
            const containers = source.pos.findInRange(FIND_STRUCTURES, 2, { filter: s => s.structureType === STRUCTURE_CONTAINER });
            if (containers.length > 0) {
                container = containers[0];
                this.creep.memory.containerId = container.id;
            }
        }

        if (container) {
            if (!this.creep.pos.inRangeTo(container, 0)) movementManager.smartMove(this.creep, container, 0);
        } else if (!this.creep.pos.inRangeTo(source, 1)) {
            movementManager.smartMove(this.creep, source, 1);
            return;
        }
        this.creep.harvest(source);
    }
}
module.exports = StaticHarvester;