/**
 * ROAD PLANNER UTILITY
 * Διαχειρίζεται το δυναμικό ξεκλείδωμα δρόμων βάσει κρίσιμων μονοπατιών και γειτονικών κτιρίων.
 */
class RoadPlanner {
    /**
     * Επιστρέφει το κατάλληλο RCL και Score για έναν δρόμο.
     * @param {number} x 
     * @param {number} y 
     * @param {Object} rawData - Τα δεδομένα του blueprint
     * @param {Array} buildingEntries - Προ-υπολογισμένα κτίρια με τα RCL τους
     */
    static getRoadMetadata(x, y, rawData, buildingEntries) {
        const sources = rawData.sources || [];
        const controller = rawData.controller;
        const spawns = rawData.buildings.spawn || [];
        const storagePos = rawData.buildings.storage ? rawData.buildings.storage[0] : null;
        const terminalPos = rawData.buildings.terminal ? rawData.buildings.terminal[0] : null;
        const mineralPos = rawData.mineral;

        // 1. Έλεγχος για Critical Paths (RCL 2)
        for (let s of sources) {
            if (this.isNearPath(x, y, s, spawns[0]) || this.isNearPath(x, y, s, controller)) {
                return { rcl: 2, bonus: 100 };
            }
        }

        // 2. Logistics & Storage Paths (RCL 4)
        if (storagePos) {
            for (let s of sources) {
                if (this.isNearPath(x, y, s, storagePos)) return { rcl: 4, bonus: 80 };
            }
            if (this.isNearPath(x, y, controller, storagePos)) return { rcl: 4, bonus: 70 };
        }

        // 3. Mineral & Terminal Path (RCL 6)
        if (mineralPos && terminalPos) {
            if (this.isNearPath(x, y, mineralPos, terminalPos)) return { rcl: 6, bonus: 60 };
        }

        // 4. Δυναμικό ξεκλείδωμα βάσει γειτονικών κτιρίων
        // Ένας δρόμος πρέπει να χτίζεται στο RCL του κτιρίου που εξυπηρετεί
        let minNeighborRcl = 8;
        let foundNeighbor = false;

        for (const b of buildingEntries) {
            if (Math.abs(b.x - x) <= 1 && Math.abs(b.y - y) <= 1) {
                if (b.rcl < minNeighborRcl) minNeighborRcl = b.rcl;
                foundNeighbor = true;
            }
        }

        if (foundNeighbor) {
            return { rcl: minNeighborRcl, bonus: 10 };
        }

        return { rcl: 8, bonus: 0 };
    }

    /**
     * Έλεγχος αν ο δρόμος πρέπει να τοποθετηθεί στο Construction Site.
     */
    static shouldBuildRoad(roadPos, rawData, builtMap, currentRCL) {
        // Σημείωση: Στο runtime δεν έχουμε το buildingEntries εύκολα, 
        // οπότε βασιζόμαστε στο rcl που έχει ήδη αποθηκευτεί στο blueprint object.
        // Το construction manager περνάει το roadTarget που έχει ήδη το rcl από το FileLayout.
        if (roadPos.rcl > currentRCL) return false;

        // Για δρόμους υποδομής (όχι critical), ελέγχουμε αν υπάρχει ήδη κτίριο εκεί
        if (currentRCL >= 4 && (!roadPos.bonus || roadPos.bonus < 50)) {
            return this.hasBuiltNeighbor(roadPos.x, roadPos.y, builtMap);
        }

        return true;
    }

    static hasBuiltNeighbor(x, y, builtMap) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const type = builtMap[`${x + dx},${y + dy}`];
                if (type && type !== STRUCTURE_ROAD && type !== STRUCTURE_RAMPART) return true;
            }
        }
        return false;
    }

    /**
     * Βελτιωμένος έλεγχος Path. 
     * Χρησιμοποιεί Manhattan distance για να δει αν το (x,y) ανήκει στο νοητό ορθογώνιο
     * που σχηματίζουν τα δύο σημεία.
     */
    static isNearPath(x, y, start, end) {
        if (!start || !end) return false;
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }
}

module.exports = RoadPlanner;