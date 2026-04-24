/*
    CHANGELOG:
    version 1.2.1
    - Προσθήκη αναλυτικού μηνύματος λάθους (console.error) κατά τη δυναμική φόρτωση blueprint.
    
    version 1.2.0
    - Υλοποίηση Dynamic Loading (Lazy Load) των blueprint αρχείων.
    - Κατάργηση εξάρτησης από το global.roomBlueprints.
    - Προσθήκη error handling για δωμάτια χωρίς αρχείο blueprint.
*/

const BaseLayout = require('construction.layout.BaseLayout');
const { PRIORITIES, STRUCTURE_RCL_STEPS, MEMORY_KEYS } = require('construction.constants');
const RoadPlanner = require('construction.roadPlanner');

class FileLayout extends BaseLayout {
    constructor(roomName) {
        super();
        this.roomName = roomName;
        this.blueprint = null;
        this.init(roomName);
    }

    /**
     * Αρχικοποιεί το layout φορτώνοντας από τη μνήμη ή το αρχείο.
     */
    init(roomName) {
        const rootMem = Memory.rooms[roomName][MEMORY_KEYS.ROOT];
        
        // 1. Προσπάθεια φόρτωσης από την Cache της μνήμης (αν έχει ήδη υπολογιστεί)
        if (rootMem && rootMem[MEMORY_KEYS.BLUE_PRINT]) {
            this.blueprint = rootMem[MEMORY_KEYS.BLUE_PRINT];
            return;
        }

        // 2. Αν δεν υπάρχει στην Cache, προσπάθεια Δυναμικής Φόρτωσης του αρχείου
        const rawData = this.loadRawData(roomName);
        
        if (rawData) {
            console.log(`[FileLayout] New blueprint file detected for ${roomName}. Processing...`);
            this.processRawData(rawData, roomName);
        } else {
            // Αν δεν βρεθεί αρχείο, η blueprint παραμένει null και ο manager θα το χειριστεί
            this.blueprint = [];
        }
    }

    /**
     * Φορτώνει δυναμικά το module του blueprint.
     * Το αρχείο πρέπει να ονομάζεται ακριβώς όπως το roomName (π.χ. E12N34.js)
     * και να βρίσκεται στο φάκελο blueprints.
     */
    loadRawData(roomName) {
        try {
            // Δυναμικό require. Στο Screeps τα αρχεία φορτώνονται από το root ή συγκεκριμένο path.
            // Υποθέτουμε ότι τα blueprints σου είναι στο φάκελο "blueprints"
            return require(`blueprints.${roomName}`);
        } catch (e) {
            // Καταγραφή του σφάλματος στην κονσόλα για ευκολότερο debugging
//            console.log(`[FileLayout] Error loading blueprint for ${roomName}: File 'blueprints.${roomName}' not found or contains errors.</span>`);
            return null;
        }
    } // end of loadRawData

    /**
     * Μετατρέπει τα Raw δεδομένα του blueprint σε επεξεργασμένη λίστα.
     */
    processRawData(rawData, roomName) {
        const center = rawData.buildings.center || { x: 25, y: 25 };
        const DISTANCE_FACTOR = 0.1;
        const buildingEntries = [];

        // Επεξεργασία κτιρίων
        for (const [type, positions] of Object.entries(rawData.buildings)) {
            if (type === 'center' || type === 'road') continue;

            const sortedPositions = [...positions].sort((a, b) => {
                const distA = Math.abs(a.x - center.x) + Math.abs(a.y - center.y);
                const distB = Math.abs(b.x - center.x) + Math.abs(b.y - center.y);
                return distA - distB;
            });

            sortedPositions.forEach((pos, index) => {
                const distance = Math.abs(pos.x - center.x) + Math.abs(pos.y - center.y);
                buildingEntries.push({
                    type: type,
                    x: pos.x,
                    y: pos.y,
                    rcl: this.calculateRCLRequirement(type, index),
                    score: (PRIORITIES[type.toUpperCase()] || 0) - (distance * DISTANCE_FACTOR)
                });
            });
        }

        // Επεξεργασία δρόμων
        const roadPositions = rawData.buildings.road || [];
        const roadEntries = roadPositions.map(pos => {
            const roadMeta = RoadPlanner.getRoadMetadata(pos.x, pos.y, rawData, buildingEntries, roomName);
            const distance = Math.abs(pos.x - center.x) + Math.abs(pos.y - center.y);
            
            return {
                type: 'road',
                x: pos.x,
                y: pos.y,
                rcl: roadMeta.rcl,
                category: roadMeta.category,
                score: (PRIORITIES.ROAD || 0) + roadMeta.bonus - (distance * DISTANCE_FACTOR)
            };
        });

        const finalBlueprint = [...buildingEntries, ...roadEntries];
        finalBlueprint.sort((a, b) => b.score - a.score);

        // Αποθήκευση στην Cache της μνήμης
        const rootMem = Memory.rooms[roomName][MEMORY_KEYS.ROOT];
        if (rootMem) {
            rootMem[MEMORY_KEYS.BLUE_PRINT] = finalBlueprint;
        }
        
        this.blueprint = finalBlueprint;
    }

    calculateRCLRequirement(type, index) {
        if (STRUCTURE_RCL_STEPS[type]) {
            const steps = STRUCTURE_RCL_STEPS[type];
            if (Array.isArray(steps)) return steps[index] || steps[steps.length - 1];
            if (typeof steps === 'object') {
                for (let rcl = 1; rcl <= 8; rcl++) {
                    if (index < steps[rcl]) return rcl;
                }
            }
        }
        return 8; 
    }
}

module.exports = FileLayout;