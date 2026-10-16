/*
version 1.0.1
*/
const BaseRole = require('role.base');
const FSM = require('utils.fsm');
const upgraderStates = new FSM({
    COLLECTING: function() {
        if (this.creep.store.getFreeCapacity() === 0) {
            upgraderStates.transition(this, 'WORKING',this.creep.memory);
            return;
        }
        this.getEnergy();
    },  
    WORKING: function() {
        if (this.creep.store[RESOURCE_ENERGY] === 0) {
            upgraderStates.transition(this, 'COLLECTING',this.creep.memory);
            return;
        }        
        this.upgradeController();
    }
}); // end of upgraderStates
class Upgrader extends BaseRole {
    run() {
		
        if (this.travelToHomeRoom()) return;
        
        if (this.checkYield()) return;
        
        upgraderStates.run(this, 'COLLECTING',this.creep.memory);
    }
} // end of upgraders




// class Upgrader extends BaseRole {
    // run() {
        // if (this.travelToHomeRoom()) return;
		
		
        // if (this.checkYield()) return;
        // if (this.creep.memory.working && this.creep.store[RESOURCE_ENERGY] === 0) this.creep.memory.working = false;
        // if (!this.creep.memory.working && this.creep.store.getFreeCapacity() === 0) 
			// this.creep.memory.working = true;

        // if (this.creep.memory.working) this.upgradeController();
        // else this.getEnergy();
    // }
// }
module.exports = Upgrader;



