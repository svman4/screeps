const BaseRole = require('role.base');

const FSM = require('utils.fsm');
const simpleHarvesterStates = new FSM({
    COLLECTING: function() {
        if (this.creep.store.getFreeCapacity() === 0) {
            simpleHarvesterStates.transition(this, 'WORKING',this.creep.memory);
            return;
        }
		if (!this.getEnergyFromDroppedEnergy()) 
			this.getEnergy();
    }, 
    WORKING: function() {
        if (this.creep.store[RESOURCE_ENERGY] === 0) {
            simpleHarvesterStates.transition(this, 'COLLECTING',this.creep.memory);
            return;
        }        
        if (this.fillSpawnExtension()) return;
        if (this.buildStructures()) return;
        this.upgradeController();
    }
}); // end of simpleHarvesterStates

class SimpleHarvester extends BaseRole {
    run() {
        if (this.travelToHomeRoom()) return;
        simpleHarvesterStates.run(this,'COLLECTING',this.creep.memory);
    }
}
module.exports = SimpleHarvester;
