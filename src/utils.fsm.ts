// Ορισμός τύπου για τις συναρτήσεις των καταστάσεων
export type StateFunction = (...args: any[]) => any;

// Ορισμός τύπου για το dictionary των καταστάσεων
export type StatesMap = Record<string, StateFunction>;

// Minimal interface για τη μνήμη
export interface FSMMemory {
    fsmState?: string;
    [key: string]: any;
}

// Ευέλικτο Context που μπορεί να είναι Creep, Room ή οποιοδήποτε αντικείμενο
export interface FSMContext {
    creep?: { name: string };
    room?: { name: string };
    name?: string;
    [key: string]: any;
}

export class FSM {
    public states: StatesMap;
    constructor(states: StatesMap) {
        this.states = states;
    } // end of constructor

    run(context: FSMContext, defaultState: string = 'IDLE', memory: FSMMemory) {

        const currentState = memory.fsmState || defaultState;
        const stateFunction = this.states[currentState];

        if (stateFunction) {
            return stateFunction.call(context);
        } else {
            // Έξυπνος τρόπος να βρούμε το όνομα είτε είναι Creep, είτε Room, είτε απλό αντικείμενο
            const identifier = context.creep?.name || context.room?.name || context.name || 'Unknown';
            console.log(`[FSM Error] Unknown state "${currentState}" for entity ${identifier}`);
            return [];
        }
    }

    transition(context: FSMContext, newState: string, memory: FSMMemory) {
        if (memory.fsmState !== newState) {
            memory.fsmState = newState;
        }
    } // end of transition
}

module.exports = FSM;