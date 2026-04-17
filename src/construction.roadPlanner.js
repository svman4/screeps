/**
 * ROAD PLANNER UTILITY
 * Διαχειρίζεται την ιεράρχηση, το RCL ξεκλείδωμα και τις εξαρτήσεις των δρόμων.
 */
class RoadPlanner {
    /**
     * Επιστρέφει το κατάλληλο RCL και Score για έναν δρόμο.
     * @param {number} x 
     * @param {number} y 
     * @param {Object} rawData - Τα δεδομένα του blueprint
     * @returns {Object} { rcl: number, bonus: number }
     */
    static getRoadMetadata(x, y, rawData) {
        if (!rawData.buildings || !rawData.buildings.road) return { rcl: 8, bonus: 0 };

        const sources = rawData.sources || [];
        const controller = rawData.controller;
        const spawns = rawData.buildings.spawn || [];
        const storagePos = rawData.buildings.storage ? rawData.buildings.storage[0] : null;
        const mineralPos = rawData.mineral;
		
		
		
		// TODO να εντοπίζει από το rawData τα μονοπάτια που ενώνουν τα sources με τo spawns[0] , το controller και τo storage, τα critical path.
		// από αυτά να ενεργοποιεί τα Path  Source -> Spawn και Source -> Controller στο rcl 2 
		// Και τα logistic path στο επίπεδο 4.
		// Ακόμα να εντοπίζει το path πάλι από το rawData που ενώνει το mineral με το terminal και να το δίνει στο rcl 6.
		// Αν κάποιο road από το Path έχει ξεκλειδωθεί σε προηγούμενο rcl δε θα το αλλάζουμε.
		
		// TODO Να γίνεται έλεγχος, και να ενεργοποιείται το road στο μικρότερο rcl στο οποίο ενεργοποιείται Κάποιο structure.
		//	Π.χ. αν ένα road είναι δίπλα μόνο στο terminal θα ξεκλειδώνει στο επίπεδο του terminal. Αν όμως έχει δίπλα και το storage να ξεκλειδώνει στο επίπεδο του storage.
		
        // 1. PHASE 1: Energy & Upgrade Critical Paths (RCL 2)
        // Δρόμοι Source -> Spawn και Source -> Controller
        for (let s of sources) {
            if (this.isNearPath(x, y, s, spawns[0]) || this.isNearPath(x, y, s, controller)) {
                return { rcl: 2, bonus: 60 };
            }
        }

        // 2. PHASE 2: Logistics & Storage Paths (RCL 4)
        // Ενεργοποιούνται όταν ξεκλειδώνει το Storage
        if (storagePos) {
            // Source to Storage
            for (let s of sources) {
                if (this.isNearPath(x, y, s, storagePos)) return { rcl: 4, bonus: 55 };
            }
            // Storage to Controller
            if (this.isNearPath(x, y, controller, storagePos)) return { rcl: 4, bonus: 50 };
        }

        // 3. PHASE 3: Mineral Path (RCL 6)
        // Ενεργοποιείται όταν ξεκλειδώνει ο Extractor
        if (mineralPos && storagePos) {
            if (this.isNearPath(x, y, mineralPos, storagePos)) {
                return { rcl: 6, bonus: 40 };
            }
        }

        // 4. Infrastructure Roads (Δρόμοι γειτνίασης με κτίρια)
        // Ξεκλειδώνουν στο RCL 4 που έχουμε μαζική επέκταση (Extensions)
        return { rcl: 4, bonus: 0 };
    }

    /**
     * Ελέγχει αν ένας δρόμος επιτρέπεται να χτιστεί βάσει των κανόνων σου.
     * @param {Object} roadPos - {x, y}
     * @param {Object} rawData - Blueprint data
     * @param {Object} builtMap - Memory cache των χτισμένων κτιρίων
     * @param {number} currentRCL - Το τρέχον RCL του δωματίου
     */
    static shouldBuildRoad(roadPos, rawData, builtMap, currentRCL) {
        const metadata = this.getRoadMetadata(roadPos.x, roadPos.y, rawData);
        
        // 1. Έλεγχος RCL: Αν το RCL του δρόμου είναι μεγαλύτερο από το τρέχον, σταμάτα
        if (metadata.rcl > currentRCL) return false;

        // 2. Ειδικός κανόνας για Mineral Path (RCL 6): Πρέπει να υπάρχει ο Extractor
        if (metadata.rcl === 6) {
            const extractorPos = rawData.buildings.extractor ? rawData.buildings.extractor[0] : null;
            if (extractorPos && !builtMap[`${extractorPos.x},${extractorPos.y}`]) {
                return false;
            }
        }

        // 3. Κανόνας γειτνίασης (RCL >= 4): 
        // Αν δεν είναι Critical Path (bonus === 0), πρέπει να έχει κτίριο δίπλα
        if (currentRCL >= 4 && metadata.bonus === 0) {
            return this.hasBuiltNeighbor(roadPos.x, roadPos.y, builtMap);
        }

        // Οι Critical δρόμοι (Phase 1 & 2) χτίζονται χωρίς έλεγχο γειτνίασης
        return true;
    }

    /**
     * Ελέγχει αν υπάρχει χτισμένο κτίριο (όχι δρόμος/rampart) γύρω.
     */
    static hasBuiltNeighbor(x, y, builtMap) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const type = builtMap[`${x + dx},${y + dy}`];
                // Αγνοούμε δρόμους και ramparts για τον έλεγχο γειτνίασης
                if (type && type !== STRUCTURE_ROAD && type !== STRUCTURE_RAMPART) return true;
            }
        }
        return false;
    }

    /**
     * Bounding box check για το αν ένα σημείο είναι "κοντά" σε ευθεία διαδρομή.
     */
    static isNearPath(x, y, start, end) {
        if (!start || !end) return false;
        const minX = Math.min(start.x, end.x) - 1;
        const maxX = Math.max(start.x, end.x) + 1;
        const minY = Math.min(start.y, end.y) - 1;
        const maxY = Math.max(start.y, end.y) + 1;
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }
}

module.exports = RoadPlanner;