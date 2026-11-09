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
//import debugConsole from './utils.debugConsole';
import BaseRole = require('./role.base');
const movementManager = require('manager.movement');
const { NEED_REPLACEMENT_FLAG } = require('spawn.constants');
const roomCache = require('./utils.RoomCache');
const FSM = require('utils.fsm');

const staticHarvesterStates = new FSM(
    {
        gotoSource: function (this: StaticHarvester) {
            const source: Source = this.resolveSource();
            if (!source) return;

            const container: StructureContainer | null = roomCache.in(this.creep.room.name).getSourceContainer(source.id);
            if (this.handlePositioning(source, container)) return;
            staticHarvesterStates.transition(this, "initialiseLifecycle", this.creep.memory);
        },
        initialiseLifecycle: function (this: StaticHarvester) {

            const travelTime = CREEP_LIFE_TIME - this.creep.ticksToLive;
            const spawnTime = this.getSpawningDuration();
            const buffer = 30;

            this.creep.memory.leadTime = travelTime + spawnTime + buffer;
            delete this.creep.memory.init;
            staticHarvesterStates.transition(this, "harvesting", this.creep.memory);


        },
        harvesting: function (this: StaticHarvester) {
            //Εφόσον είναι ήδη στη θέση, ξεκινά την εξόρυξη.
            const source = this.resolveSource();
            // Έλεγχος αν ο αντικαταστάτης είναι εδώ για να αποχωρήσει (suicide)
            if (this.handleRetirement(source)) return;



            // Έλεγχος αν πρέπει να ζητηθεί αντικαταστάτης
            this.checkReplacementNeeds();

            // Διαχείριση εφοδιασμού (Links/Containers)
            this.manageLogistics();

            // Εκτέλεση εξόρυξης
            this.performHarvest(source);



        }
    }); // end of staticHarvesterStates



class StaticHarvester extends BaseRole {
    constructor(creep: Creep) {
        super(creep);
    }
    /**
     * Κύρια ροή εργασιών του creep.
     */
    run(): void {
        staticHarvesterStates.run(this, "gotoSource", this.creep.memory);
    }

    /**
     * Εντοπίζει ή ανακτά την πηγή ενέργειας από τη μνήμη.
     */
    resolveSource(): Source | null {
        if (!this.creep.memory.sourceId) {
            const closest = this.creep.pos.findClosestByPath(FIND_SOURCES);
            if (closest) this.creep.memory.sourceId = closest.id;
        }
        return this.creep.memory.sourceId ? Game.getObjectById(this.creep.memory.sourceId) : null;
    }


    /**
     * Διαχειρίζεται την "αποστρατεία" του creep.
     * Επιστρέφει true αν το creep αυτοκτόνησε.
     */
    handleRetirement(source: Source) {
        const flag = NEED_REPLACEMENT_FLAG || 'needReplacementFlag';
        const ARRIVAL_RANGE = 1; // Απόσταση στην οποία θεωρούμε ότι ο αντικαταστάτης έφτασε

        if (this.creep.memory[flag] !== false)
            return false;

        // Αναζήτηση για τον αντικαταστάτη που πλησιάζει
        const replacement = roomCache.in(this.creep.room.name).myCreeps.filter(
            c => c.memory.role === this.creep.memory.role &&
                c.memory.sourceId === source.id &&
                c.id !== this.creep.id &&
                c.pos.inRangeTo(this.creep.pos, ARRIVAL_RANGE)
        );


        if (replacement.length > 0) {
            //console.log(`[${this.creep.room.name}] ${this.creep.name}: Ο αντικαταστάτης ${replacement[0].name} έφτασε και το flag είναι false. Αυτοκτονία.`);
            this.creep.suicide();
            return true;
        }
        return false;
    } // end of handleRetirement(source)

    /**
     * Μετακινεί το creep στη σωστή θέση (πάνω στο container ή δίπλα στην πηγή).
     */
    handlePositioning(source: Source, container: StructureContainer | null): boolean {
        const targetPos: RoomPosition = container ? container.pos : source.pos;
        const range: number = container ? 0 : 1;

        if (!this.creep.pos.inRangeTo(targetPos, range)) {
            movementManager.smartMove(this.creep, targetPos, range);
            return true;
        }
        return false;
    }

    /**
 * Ελέγχει το χρόνο ζωής και ενεργοποιεί το αίτημα αντικατάστασης.
 */
    checkReplacementNeeds(): void {
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
    manageLogistics(): void {
        if (!this.creep.memory.sourceId)
            return;
        const link: StructureLink = roomCache.in(this.creep.room.name).getSourceLink(this.creep.memory.sourceId);
        if (link && this.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            this.creep.transfer(link, RESOURCE_ENERGY);
        }

    }


    /**
     * Εκτελεί το harvest στην πηγή.
     */
    performHarvest(source: Source): void {
        if (source.energy > 0) {
            this.creep.harvest(source);
        }
    } // end of performHarvest
    /**
        Ο staticHarvester θέλουμε να εργάζεται μέχρι το τελευταίο tick.
    */
    getRetirementThreshold(): number {
        return 0;
    }
} // end of class 

export = StaticHarvester;