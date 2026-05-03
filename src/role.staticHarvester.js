/**
 * ROLE: Static Harvester
 * VERSION: 2.5.2
 * TYPE: Logistics & Resource Extraction
 * * CHANGE LOG:
 * 2.5.2: Μετατροπή της απόστασης αντικατάστασης σε σταθερά εντός της μεθόδου handleRetirement.
 * 2.5.1: Τροποποίηση συνθήκης retirement βάσει οδηγίας χρήστη (έλεγχος για false flag).
 * 2.5.0: Πλήρες Refactoring σε αυτόνομες μεθόδους. Βελτίωση λογικής αυτοκτονίας.
 * 2.4.1: Διόρθωση logs και debugging για το NEED_REPLACEMENT_FLAG.
 */

const BaseRole = require('role.base');
const movementManager = require('manager.movement');
const { NEED_REPLACEMENT_FLAG } = require('spawn.constants');

class StaticHarvester extends BaseRole {
    /**
     * Κύρια ροή εργασιών του creep.
     */
    run() {
        const source = this.resolveSource();
        if (!source) return;
        
        const container = this.resolveContainer(source);

        // Έλεγχος αν ο αντικαταστάτης είναι εδώ για να αποχωρήσει (suicide)
        if (this.handleRetirement(source)) return;

        // Διαχείριση κίνησης προς το σημείο εργασίας
        if (this.handlePositioning(source, container)) return;

        // Αρχικοποίηση δεδομένων αντικατάστασης μόλις φτάσει
        this.initialiseLifecycle(container);

        // Έλεγχος αν πρέπει να ζητηθεί αντικαταστάτης
        this.checkReplacementNeeds();

        // Διαχείριση εφοδιασμού (Links/Containers)
        this.manageLogistics(container);

        // Εκτέλεση εξόρυξης
        this.performHarvest(source);
    }

    /**
     * Εντοπίζει ή ανακτά την πηγή ενέργειας από τη μνήμη.
     */
    resolveSource() {
        if (!this.creep.memory.sourceId) {
            const closest = this.creep.pos.findClosestByPath(FIND_SOURCES);
            if (closest) this.creep.memory.sourceId = closest.id;
        }
        return Game.getObjectById(this.creep.memory.sourceId);
    }

    /**
     * Εντοπίζει το container αποθήκευσης κοντά στην πηγή.
     */
    resolveContainer(source) {
        let container = Game.getObjectById(this.creep.memory.containerId);
        if (!container && this.creep.ticksToLive % 10 === 0) {
            const containers = source.pos.findInRange(FIND_STRUCTURES, 2, { 
                filter: s => s.structureType === STRUCTURE_CONTAINER 
            });
            if (containers.length > 0) {
                container = containers[0];
                this.creep.memory.containerId = container.id;
            }
        }
        return container;
    }

    /**
     * Διαχειρίζεται την "αποστρατεία" του creep.
     * Επιστρέφει true αν το creep αυτοκτόνησε.
     */
    handleRetirement(source) {
        const flag = NEED_REPLACEMENT_FLAG || 'needReplacementFlag';
        const ARRIVAL_RANGE = 1; // Απόσταση στην οποία θεωρούμε ότι ο αντικαταστάτης έφτασε
        
        // Τροποποιημένη συνθήκη: Αν υπάρχει το flag και είναι false, προχωράμε σε suicide αν έφτασε ο αντικαταστάτης
        if (this.creep.memory[flag] !== false) return false;

        // Αναζήτηση για τον αντικαταστάτη που πλησιάζει
        const replacement = this.creep.pos.findInRange(FIND_MY_CREEPS, ARRIVAL_RANGE, {
            filter: c => c.memory.role === this.creep.memory.role && 
                         c.memory.sourceId === source.id && 
                         c.id !== this.creep.id
        });
        
        if (replacement.length > 0) {
            //console.log(`[${this.creep.room.name}] ${this.creep.name}: Ο αντικαταστάτης ${replacement[0].name} έφτασε και το flag είναι false. Αυτοκτονία.`);
            this.creep.suicide();
            return true;
        }
        return false;
    }

    /**
     * Μετακινεί το creep στη σωστή θέση (πάνω στο container ή δίπλα στην πηγή).
     */
    handlePositioning(source, container) {
        const targetPos = container ? container.pos : source.pos;
        const range = container ? 0 : 1;

        if (!this.creep.pos.inRangeTo(targetPos, range)) {
            movementManager.smartMove(this.creep, targetPos, range);
            return true; 
        }
        return false;
    }

    /**
     * Εκτελείται μία φορά όταν το creep φτάσει στη θέση του.
     */
    initialiseLifecycle() {
        if (this.creep.memory.init === true) {
            const travelTime = CREEP_LIFE_TIME - this.creep.ticksToLive;
            const spawnTime = this.creep.body.length * 3;
            const buffer = 15; 
            
            this.creep.memory.leadTime = travelTime + spawnTime + buffer;
            delete this.creep.memory.init;
        }
    }

    /**
     * Ελέγχει το χρόνο ζωής και ενεργοποιεί το αίτημα αντικατάστασης.
     */
    checkReplacementNeeds() {
        const flag = NEED_REPLACEMENT_FLAG || 'needReplacementFlag';
        
        if (this.creep.memory.leadTime && (this.creep.ticksToLive < this.creep.memory.leadTime)) {
            console.log(`[${this.creep.room.name}] ${this.creep.name}: Χαμηλό TTL. Αίτημα αντικατάστασης (Lead: ${this.creep.memory.leadTime})`);
            this.creep.memory[flag] = true; 
            delete this.creep.memory.leadTime;
        }
    }

    /**
     * Μεταφέρει ενέργεια σε Link αν υπάρχει.
     */
    manageLogistics(container) {
        if (this.creep.memory.linkId === undefined) {
            const searchPos = container ? container.pos : this.creep.pos;
            const links = searchPos.findInRange(FIND_STRUCTURES, 1, { 
                filter: s => s.structureType === STRUCTURE_LINK 
            });
            this.creep.memory.linkId = links.length > 0 ? links[0].id : null;
        }

        if (this.creep.memory.linkId) {
            const link = Game.getObjectById(this.creep.memory.linkId);
            if (link && this.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                this.creep.transfer(link, RESOURCE_ENERGY);
            }
        }
    }

    /**
     * Εκτελεί το harvest στην πηγή.
     */
    performHarvest(source) {
        if (source.energy > 0) {
            this.creep.harvest(source);
        }
    } // end of performHarvest
	/**
		Ο staticHarvester θέλουμε να εργάζεται μέχρι το τελευταίο tick.
	*/
	getRetirementThreshold() { 
		return 0;
	}
}

module.exports = StaticHarvester;