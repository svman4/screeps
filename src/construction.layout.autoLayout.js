/*
    CHANGELOG:
    version 1.0.0
    - Αρχική υλοποίηση αυτόματης σχεδίασης βάσης.
    - Δημιουργία layout με βάση room geometry και controller/sources positions.
    - Storage τοποθέτηση κοντά στο Controller.
    - Controller Link κατασκευή τελευταία.
*/

const BaseLayout = require('construction.layout.BaseLayout');
const { MEMORY_KEYS } = require('construction.constants');

const RoomAnalyzer = require("construction.RoomAnalyzer");
/**
 * AUTO LAYOUT CLASS
 * Δημιουργεί αυτόματα ένα optimized layout χωρίς εξάρτηση από αρχεία blueprint.
 * Συνδυάζει room geometry, sources, και controller position για να δημιουργήσει
 * ένα functional layout που μεγιστοποιεί την αποδοτικότητα.
 */
class AutoLayout extends BaseLayout {
    constructor(roomName) {
        super(roomName);
        this.room = Game.rooms[roomName];
        this.init();
    }

    /**
     * Φόρτωση δεδομένων: Συγκέντρωση στοιχείων από το room και geometric analysis.
     */
    loadRawData() {
        if (!this.room) {
            console.log(`[AutoLayout] Room ${this.roomName} is not visible. Cannot auto-plan.`);
            return null;
        }

        const sources = this.room.find(FIND_SOURCES);
        const controller = this.room.controller;
        const exits = this.room.find(FIND_EXIT);

        if (!controller) {
            console.log(`[AutoLayout] No controller in room ${this.roomName}.`);
            return null;
        }
        
        const distanceMatrix=RoomAnalyzer.getDistanceTransform(this.rommName);
        
        const center = this.findOptimalCenter(sources, controller,distanceMatrix);
        const storage = center; // Το storage θα χτιστεί στο center.

        //σχεδιάζει τους κεντρικούς δρόμους.

        // Βάζει τα container στη θέση τους. Σε κάθε source 1 με απόσταση 1tile(όσο πιο κοντά γίνεται στο center),
        //και δίπλα στο controller 1 σε απόσταση 3tile(όσο πιο κοντά γίνεται στο center)

        //Δίπλα από κάθε source, υποχρεώτικά σε απόσταση 1, μπαίνουν τα Link σε κάθε πηγή.
         //   Δίπλα στο controller σε απόσταση 1 μπαίνει το link.
         // Σε απόσταση 2 από το storage θα μπει το link του storage.


        const criticalRoads = this.planRoads(center, sources, controller, null);


        const spawns = this.planSpawns(center, controller);
        const extensions = this.planExtensions(center, spawns);
        const towers = this.planTowers(center);
        const links = this.planLinks(center, sources, controller, storage);
        const containers = this.planContainers(sources, controller);
        const roads = this.planRoads(center, sources, controller, spawns);

        return {
            buildings: {
                center: [center],
                spawn: spawns,
                extension: extensions,
                tower: towers,
                storage: storage,
                link: links,
                container: containers,
                road: roads
            },
            sources: sources.map(s => ({ x: s.pos.x, y: s.pos.y })),
            controller: { x: controller.pos.x, y: controller.pos.y },
            exits: exits.map(e => ({ x: e.x, y: e.y }))
        };
    }

    /**
     * Εύρεση κέντρου βάσης: Βάσει των πηγών και του controller.
     * Επιλέγουμε ένα σημείο που είναι:
     * 1. Κοντά στις πηγές
     * 2. Κοντά στο controller
     * 3. Σε ασφαλή απόσταση από τα edges του δωματίου
     */
    findOptimalCenter(sources, controller) {
        const padding = 5; // Ελάχιστη απόσταση από τα edges

        // Υπολογισμός του centroid των πηγών
        const sourceCentroid = {
            x: Math.round(sources.reduce((sum, s) => sum + s.pos.x, 0) / sources.length),
            y: Math.round(sources.reduce((sum, s) => sum + s.pos.y, 0) / sources.length)
        };

        // Ο κέντρος θα είναι κάπου μεταξύ sourceCentroid και controller
        const controllerPos = controller.pos;
        const idealCenter = {
            x: Math.round((sourceCentroid.x + controllerPos.x) / 2),
            y: Math.round((sourceCentroid.y + controllerPos.y) / 2)
        };

        // Εξασφάλιση ότι ο κέντρος είναι εντός των ορίων
        return {
            x: Math.max(padding, Math.min(49 - padding, idealCenter.x)),
            y: Math.max(padding, Math.min(49 - padding, idealCenter.y))
        };
    }

    /**
     * Εύρεση θέσης Storage: Κοντά στο Controller (<5 tiles Chebyshev distance).
     * Προτιμώνται θέσεις ανατολικά και νότια του controller.
     */
    findStoragePosition(center, controller) {
        const controllerPos = controller.pos;
        const MAX_DISTANCE = 5;
        const candidates = [];

        // Διάσχιση όλων των σημείων κοντά στο controller
        for (let dx = -MAX_DISTANCE; dx <= MAX_DISTANCE; dx++) {
            for (let dy = -MAX_DISTANCE; dy <= MAX_DISTANCE; dy++) {
                const x = controllerPos.x + dx;
                const y = controllerPos.y + dy;

                // Έλεγχος ορίων
                if (x < 2 || x > 47 || y < 2 || y > 47) continue;

                // Έλεγχος ότι η θέση είναι walkable
                const terrain = this.room.getTerrain();
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

                // Προτίμηση θέσεις ανατολικά/νότια του controller
                const preference = (dx > 0 ? 1 : 0) + (dy > 0 ? 1 : 0);
                const distance = Math.max(Math.abs(dx), Math.abs(dy));

                candidates.push({
                    x, y,
                    distance,
                    preference,
                    score: preference * 10 - distance
                });
            }
        }

        // Ταξινόμηση και επιλογή καλύτερης θέσης
        if (candidates.length === 0) {
            console.log(`[AutoLayout] No suitable storage position found. Using center.`);
            return [center];
        }

        candidates.sort((a, b) => b.score - a.score);
        return [{ x: candidates[0].x, y: candidates[0].y }];
    }

    /**
     * Σχεδιασμός Spawns: Συνήθως 1-3 spawns κοντά στο Storage.
     */
    planSpawns(center, controller) {
        // Βασική προσέγγιση: 1 spawn κοντά στο center, λίγο αποστασιάκι
        return [
            { x: center.x - 2, y: center.y - 2 },
            { x: center.x + 2, y: center.y - 2 },
            { x: center.x, y: center.y + 3 }
        ];
    }

    /**
     * Σχεδιασμός Extensions: Γύρω από τα spawns σε ένα compact ring.
     */
    planExtensions(center, spawns) {
        const extensions = [];
        
        // Ring 1: 5 extensions
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * 2 * Math.PI;
            const x = Math.round(center.x + 3 * Math.cos(angle));
            const y = Math.round(center.y + 3 * Math.sin(angle));
            if (x >= 1 && x <= 48 && y >= 1 && y <= 48) {
                extensions.push({ x, y });
            }
        }

        // Ring 2: 5 περισσότερες extensions
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * 2 * Math.PI + Math.PI / 5;
            const x = Math.round(center.x + 4 * Math.cos(angle));
            const y = Math.round(center.y + 4 * Math.sin(angle));
            if (x >= 1 && x <= 48 && y >= 1 && y <= 48) {
                extensions.push({ x, y });
            }
        }

        return extensions;
    }

    /**
     * Σχεδιασμός Towers: Συνήθως 1-3 towers για coverage.
     */
    planTowers(center) {
        return [
            { x: center.x + 3, y: center.y },
            { x: center.x, y: center.y + 4 },
            { x: center.x - 3, y: center.y }
        ];
    }

    /**
     * Σχεδιασμός Links: 
     * - 1 Link κοντά στο controller (τελευταίο σε προτεραιότητα)
     * - 1 Link κοντά στο storage
     * - 1 Link ανά πηγή
     */
    planLinks(center, sources, controller, storage) {
        const links = [];

        // Storage Link (κοντά στο storage)
        const storagePos = storage[0];
        links.push({
            x: storagePos.x + 1,
            y: storagePos.y
        });

        // Source Links (1 ανά πηγή)
        for (const source of sources) {
            links.push({
                x: source.pos.x + 1,
                y: source.pos.y + 1
            });
        }

        // Controller Link (θα κατασκευαστεί ΤΕΛΕΥΤΑΙΟ - βλέπε Scorer modification)
        const controllerPos = controller.pos;
        links.push({
            x: controllerPos.x + 1,
            y: controllerPos.y + 1,
            // Marker για το Scorer ώστε να το δώσει χαμηλότερη προτεραιότητα
            isControllerLink: true
        });

        return links;
    }

    /**
     * Σχεδιασμός Containers: 
     * - 1 ανά πηγή
     * - 1 controller container
     */
    planContainers(sources, controller) {
        const containers = [];

        // Source containers
        for (const source of sources) {
            containers.push({
                x: source.pos.x,
                y: source.pos.y + 1
            });
        }

        // Controller container
        containers.push({
            x: controller.pos.x + 2,
            y: controller.pos.y
        });

        return containers;
    }

    /**
     * Σχεδιασμός Roads: 
     * - Paths από πηγές στο κέντρο
     * - Paths από κέντρο στο controller
     * - Άλλες λογιστικές διαδρομές
     */
    planRoads(center, sources, controller, spawns) {
        const roads = [];
        const addedRoads = new Set();

        const addRoadPath = (from, to) => {
            const dx = to.x > from.x ? 1 : to.x < from.x ? -1 : 0;
            const dy = to.y > from.y ? 1 : to.y < from.y ? -1 : 0;
            
            let current = { x: from.x, y: from.y };
            while (current.x !== to.x || current.y !== to.y) {
                const key = `${current.x},${current.y}`;
                if (!addedRoads.has(key)) {
                    roads.push({ x: current.x, y: current.y });
                    addedRoads.add(key);
                }
                current.x += dx;
                current.y += dy;
            }
        };

        // Roads από πηγές προς κέντρο
        for (const source of sources) {
            addRoadPath(source.pos, center);
        }

        // Roads από κέντρο προς controller
        addRoadPath(center, controller.pos);

        // Roads γύρω από spawns
        for (const spawn of spawns) {
            addRoadPath(center, spawn);
        }

        return roads;
    }
}

module.exports = AutoLayout;