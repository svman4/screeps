/*
    CHANGELOG:
    version 1.1.0
    - Αναβάθμιση σε Orchestrator κλάση.
    - Προσθήκη template method init() για τη διαχείριση της ροής (loading -> scoring -> caching).
    - Ενσωμάτωση κεντρικού μηχανισμού caching στη Memory.
    
    version 1.0.0
    - Αρχική δομή BaseLayout.
*/

/**
 * BASE LAYOUT CLASS
 * Ορίζει τη δομή ενός πλάνου. Μπορεί να επεκταθεί για Auto-Planner στο μέλλον.
 */
const LayoutScorer = require('construction.layout.Scorer');
const { MEMORY_KEYS } = require('construction.constants');

class BaseLayout {
    constructor(roomName) {
        this.roomName = roomName;
        this.blueprint = [];
    }

    /**
     * Κεντρική μέθοδος αρχικοποίησης.
     */
    init() {
        const rootMem = Memory.rooms[this.roomName] && Memory.rooms[this.roomName][MEMORY_KEYS.ROOT];
        
        if (rootMem && rootMem[MEMORY_KEYS.BLUE_PRINT]) {
            this.blueprint = rootMem[MEMORY_KEYS.BLUE_PRINT];
            return;
        }

        const rawData = this.loadRawData();
        if (rawData) {
            console.log(`[BaseLayout] Processing new layout for ${this.roomName}...`);
            this.blueprint = LayoutScorer.process(rawData, this.roomName);
            this.saveToCache();
        } else {
            this.blueprint = [];
        }
    }

    saveToCache() {
        if (!Memory.rooms[this.roomName]) Memory.rooms[this.roomName] = {};
        if (!Memory.rooms[this.roomName][MEMORY_KEYS.ROOT]) {
            Memory.rooms[this.roomName][MEMORY_KEYS.ROOT] = {};
        }
        Memory.rooms[this.roomName][MEMORY_KEYS.ROOT][MEMORY_KEYS.BLUE_PRINT] = this.blueprint;
    }

    getPlanForRCL(rcl, builtMap) {
        if (!this.blueprint) return [];
        return this.blueprint.filter(s => s.rcl <= rcl && !builtMap[`${s.x},${s.y}`]);
    }
    
    loadRawData() { 
        throw new Error(`[BaseLayout] loadRawData not implemented for ${this.constructor.name}`); 
    }
}

module.exports = BaseLayout;