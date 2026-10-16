class FSM {
    constructor(states) {
        this.states = states;
    }
	
    run(roleInstance, defaultState = 'IDLE',memory) {
        
        const currentState = memory.fsmState || defaultState;
        const stateFunction = this.states[currentState];

        if (stateFunction) {
            stateFunction.call(roleInstance);
        } else {
            console.log(`[FSM Error] Unknown state "${currentState}" for creep ${roleInstance.creep.name}`);
        }
    }

    transition(roleInstance, newState,memory) {
        if (memory.fsmState !== newState) {
            memory.fsmState = newState;
        }		
    } // end of transition
}

module.exports = FSM;