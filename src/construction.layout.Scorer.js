/*
    CHANGELOG:
    version 1.5.2
    - [FEATURE] Ολοκλήρωση της processRoads:
        - Σύνδεση με RoadPlanner για την κατηγοριοποίηση των δρόμων (critical, logistics, infrastructure).
        - Ανίχνευση terrain (swamp) για τους critical/logistics δρόμους (χτίσιμο σε RCL 2 αν είναι swamp, αλλιώς RCL 3).
        - Υπολογισμός των υπολοίπων δρόμων (Infrastructure) με βάση την εγγύτητα σε άλλα κτίρια (RCL >= 4).
    version 1.5.1
    - [BUGFIX] Διόρθωση της calculateRCL. Πλέον διαβάζει σωστά τα arrays (RCL unlock levels) και όχι ως μέγιστα όρια.
    - [BUGFIX] Ενσωμάτωση του DEFAULTS_RCL για κτίρια που δεν είναι σε steps (π.χ. Storage, Terminal).
    - [REFACTOR] Προσθήκη ταξινόμησης στα object keys (π.χ. extensions) για εγγυημένη σειρά ελέγχου.
    
    version 1.5.0
    - Refactored processRoads to strictly follow the requested hierarchy:
        1. Source to Center paths (RCL 2, High Bonus).
        2. Center to Controller paths (RCL 2/3, Medium Bonus).
        3. Remaining roads (Infrastructure) based on surrounding structures.
*/

// Προστέθηκε το DEFAULTS_RCL στο destructuring
const { PRIORITIES, STRUCTURE_RCL_STEPS, DEFAULTS_RCL } = require('construction.constants');
const RoadPlanner = require('construction.roadPlanner');

class Scorer {
    /**
     * Κεντρική μέθοδος επεξεργασίας του blueprint.
     */
    static process(rawData, roomName) {
        const buildingEntries = [];
        const context = this.getContext(roomName, rawData);

        // Σειρά επεξεργασίας: Από το πιο ειδικό στο πιο γενικό
        this.processContainers(rawData, buildingEntries, context);
        this.processExtensions(rawData, buildingEntries, context);
        this.processLinks(rawData, buildingEntries, context);
        this.processRoads(rawData, buildingEntries, roomName, context);

        // Τελευταίο βήμα: Όλα τα υπόλοιπα structures (Spawns, Towers, Storage κλπ)
        this.processStructures(rawData, buildingEntries, context);

        return buildingEntries;
    } // end of process

    /**
     * Επεξεργασία Links: Controller > Storage > Remote Sources
     */
    static processLinks(rawData, buildingEntries, context) {
        if (!rawData.buildings || !rawData.buildings.link) return;

        const links = rawData.buildings.link;
        const storagePos = rawData.buildings.storage ? rawData.buildings.storage[0] : null;
        const { sources, controller, center } = context;

        const tempLinks = [];

        for (const pos of links) {
            let bonus = 0;
            let distToCenter = Math.abs(pos.x - center.x) + Math.abs(pos.y - center.y);

            const isControllerLink = controller && Math.max(Math.abs(controller.x - pos.x), Math.abs(controller.y - pos.y)) <= 4;
            const isStorageLink = storagePos && Math.max(Math.abs(storagePos.x - pos.x), Math.abs(storagePos.y - pos.y)) <= 2;
            const isSourceLink = sources && sources.some(s => Math.max(Math.abs(s.x - pos.x), Math.abs(s.y - pos.y)) <= 2);

            if (isControllerLink) {
                bonus = 70;
            } else if (isStorageLink) {
                bonus = 500;
            } else if (isSourceLink) {
                // Προτεραιότητα στις απομακρυσμένες πηγές
                bonus = 80 + (distToCenter * 0.5);
            }

            tempLinks.push({ x: pos.x, y: pos.y, dist: distToCenter, bonus: bonus });
        }

        tempLinks.sort((a, b) => b.bonus - a.bonus);

        tempLinks.forEach((link, index) => {
            const count = index + 1;
            const rcl = this.calculateRCL('link', count);
            buildingEntries.push({
                x: link.x,
                y: link.y,
                type: 'link',
                rcl: rcl,
                score: PRIORITIES.LINK + link.bonus
            });
        });
    } // end of processLinks

    /**
     * Επεξεργασία Containers: Controller(R2) > Sources(R2) > Recovery(R6)
     */
    static processContainers(rawData, buildingEntries, context) {
        if (!rawData.buildings || !rawData.buildings.container) return;

        const containers = rawData.buildings.container;
        const { sources, controller, center } = context;
        const tempContainers = [];

        for (const pos of containers) {
            let rcl = 3;
            let bonus = 0;
            let distToCenter = Math.abs(pos.x - center.x) + Math.abs(pos.y - center.y);

            const isController = controller && Math.max(Math.abs(controller.x - pos.x), Math.abs(controller.y - pos.y)) <= 4;
            const isSource = sources && sources.some(s => Math.max(Math.abs(s.x - pos.x), Math.abs(s.y - pos.y)) <= 2);
            const isRecovery = distToCenter <= 3;

            if (isController) {
                rcl = 2; bonus = 100;
            } else if (isSource) {
                rcl = 2; bonus = 80;
            } else if (isRecovery) {
                rcl = 6; bonus = -50;
            }

            tempContainers.push({ x: pos.x, y: pos.y, rcl: rcl, dist: distToCenter, bonus: bonus });
        }

        tempContainers.sort((a, b) => {
            if (a.rcl !== b.rcl) return a.rcl - b.rcl;
            if (b.bonus !== a.bonus) return b.bonus - a.bonus;
            return a.dist - b.dist;
        });

        for (const c of tempContainers) {
            buildingEntries.push({
                x: c.x,
                y: c.y,
                type: 'container',
                rcl: c.rcl,
                score: PRIORITIES.CONTAINER + c.bonus - (c.dist * 0.1)
            });
        }
    } // end of processContainers

    /**
     * Επεξεργασία Roads: Source Paths > Controller Paths > Infrastructure
     */
    static processRoads(rawData, buildingEntries, roomName, context) {
        if (!rawData.buildings || !rawData.buildings.road) return;

        const roads = rawData.buildings.road;
        const tempRoads = [];

        // Ανάκτηση του terrain του δωματίου (αν υπάρχει visibility) για έλεγχο swamp
        let terrain = null;
        if (Game.rooms[roomName]) {
            terrain = Game.rooms[roomName].getTerrain();
        }

        for (const pos of roads) {
            // Λήψη metadata από τον RoadPlanner
            const meta = RoadPlanner.getRoadMetadata(pos.x, pos.y, rawData, buildingEntries, roomName);
            let finalRcl = meta.rcl;
            let finalBonus = meta.bonus;

            // Έλεγχος αν ο δρόμος είναι σε Critical ή Logistics μονοπάτι
            const isCriticalOrLogistics = meta.category === 'critical' || meta.category === 'logistics';

            if (isCriticalOrLogistics) {
                // Έλεγχος αν η συγκεκριμένη συντεταγμένη είναι Swamp
                const isSwamp = terrain && (terrain.get(pos.x, pos.y) === TERRAIN_MASK_SWAMP);

                if (isSwamp) {
                    finalRcl = 2; // Χτίσιμο άμεσα στο RCL 2 αν είναι swamp
                    finalBonus += 10; // Επιπλέον bonus προτεραιότητας
                } else {
                    finalRcl = 3; // Αλλιώς χτίσιμο στο RCL 3
                }
            } else if (meta.category === 'infrastructure') {
                // Οι υπόλοιποι δρόμοι χτίζονται από RCL 4 και μετά
                finalRcl = Math.max(4, meta.rcl);
            }

            tempRoads.push({
                x: pos.x,
                y: pos.y,
                rcl: finalRcl,
                bonus: finalBonus,
                category: meta.category
            });
        }

        // Ταξινόμηση: Πρώτα το RCL (μικρότερο προς μεγαλύτερο) και μετά το Bonus (μεγαλύτερο προς μικρότερο)
        tempRoads.sort((a, b) => {
            if (a.rcl !== b.rcl) return a.rcl - b.rcl;
            return b.bonus - a.bonus;
        });

        for (const r of tempRoads) {
            buildingEntries.push({
                x: r.x,
                y: r.y,
                type: 'road',
                rcl: r.rcl,
                score: PRIORITIES.ROAD + r.bonus,
                category: r.category
            });
        }
    } // end of processRoads

    /**
     * Επεξεργασία Structures: Catch-all για όσα κτίρια δεν έχουν score.
     */
    static processStructures(rawData, buildingEntries, context) {
        if (!rawData.buildings) return;
        const { center } = context;

        const ignoredStructures = ['center', 'road', 'extension', 'container', 'link'];

        for (const [type, positions] of Object.entries(rawData.buildings)) {

            // Παράκαμψη metadata και δρόμων (έχουν δικό τους process)
            if (ignoredStructures.includes(type)) {
                continue;
            }

            positions.forEach((pos, index) => {
                const rcl = this.calculateRCL(type, index + 1);
                const distToCenter = Math.abs(pos.x - center.x) + Math.abs(pos.y - center.y);

                buildingEntries.push({
                    x: pos.x,
                    y: pos.y,
                    type: type,
                    rcl: rcl,
                    score: (PRIORITIES[type.toUpperCase()] || 50) - (distToCenter * 0.1)
                });
            });
        }
    } // end of processStructures

    /**
     * Επεξεργασία Extensions
     */
    static processExtensions(rawData, buildingEntries, context) {
        if (!rawData.buildings || !rawData.buildings.extension) return;
        const { center } = context;
        const extensions = [...rawData.buildings.extension].sort((a, b) => {
            return (Math.abs(a.x - center.x) + Math.abs(a.y - center.y)) -
                (Math.abs(b.x - center.x) + Math.abs(b.y - center.y));
        });

        extensions.forEach((pos, index) => {
            buildingEntries.push({
                x: pos.x, y: pos.y, type: 'extension',
                rcl: this.calculateRCL('extension', index + 1),
                score: PRIORITIES.EXTENSION - (index * 0.5)
            });
        });
    }

    /**
     * Συλλέγει δεδομένα δωματίου (Center, Sources, Controller)
     */
    static getContext(roomName, rawData) {
        const room = Game.rooms[roomName];
        let center = (rawData.buildings && rawData.buildings.center) || { x: 25, y: 25 };
        let sources = [];
        let controller = null;

        if (room) {
            sources = room.find(FIND_SOURCES).map(s => ({ x: s.pos.x, y: s.pos.y }));
            if (room.controller) controller = { x: room.controller.pos.x, y: room.controller.pos.y };
        } else {
            sources = (rawData.sources || []).filter(s => s && s.x !== undefined);
            controller = rawData.controller || null;
        }
        return { center, sources, controller, roomName };
    }

    /**
     * Υπολογίζει το απαιτούμενο RCL για το N-οστό κτίριο ενός συγκεκριμένου τύπου.
     */
    static calculateRCL(type, count) {
        const steps = STRUCTURE_RCL_STEPS[type];

        // 1. Έλεγχος αν ο τύπος δεν υπάρχει στα steps (π.χ. storage, terminal, factory).
        // Σε αυτή την περίπτωση τραβάμε από τα DEFAULTS_RCL. Αν ούτε εκεί υπάρχει, βάζουμε 8.
        if (!steps) {
            return DEFAULTS_RCL[type] || 8;
        }

        // 2. Αν είναι Array (π.χ. 'spawn': [1, 7, 8])
        // Το index του array αντιστοιχεί στο count-1 (το 1ο spawn είναι στο index 0).
        // Η τιμή μέσα στο array είναι το RCL που ξεκλειδώνει.
        if (Array.isArray(steps)) {
            if (count > steps.length) return 8; // Ασφάλεια αν ζητηθούν παραπάνω κτίρια
            return steps[count - 1];
        }

        // 3. Αν είναι Object (π.χ. 'extension': { 1: 0, 2: 5, 3: 10... })
        // Ταξινομούμε τα RCL keys (1, 2, 3...) για να ελέγχουμε από το μικρότερο στο μεγαλύτερο.
        const rclKeys = Object.keys(steps).map(Number).sort((a, b) => a - b);

        for (const rcl of rclKeys) {
            if (count <= steps[rcl]) return rcl;
        }

        // Αν φτάσαμε εδώ, ο αριθμός ξεπερνά τα όρια, επιστρέφουμε 8
        return 8;
    }
}

module.exports = Scorer;