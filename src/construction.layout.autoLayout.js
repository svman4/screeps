/*
    CHANGELOG:
    version 1.1.0
    - Διόρθωση συντακτικών σφαλμάτων στη loadRawData (rommName, tile., extra commas).
    - Ενσωμάτωση του Distance Transform Matrix για την εύρεση πραγματικά ελεύθερου κέντρου (center).
    - Διασφάλιση ορθής ροής και σωστής τοποθέτησης των links, containers, και κρίσιμων δρόμων.
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
        
        // Υπολογισμός Distance Transform Matrix για να γνωρίζουμε πόσο μακριά από τοίχους είναι κάθε tile
        const distanceMatrix = RoomAnalyzer.getDistanceTransform(this.roomName);
        
        // Εύρεση του βέλτιστου κέντρου της βάσης
        const center = this.findOptimalCenter(sources, controller, distanceMatrix);
        
        // Το Storage τοποθετείται στο κέντρο (center)
        const storage = [center];

        // Σχεδιασμός των Spawns γύρω από το κέντρο
        const spawns = this.planSpawns(center, controller);
        
        // Σχεδιασμός των Extensions κυκλικά
        const extensions = this.planExtensions(center, spawns);
        
        // Σχεδιασμός των Towers για άμυνα
        const towers = this.planTowers(center);
        
        // Σχεδιασμός των Links (Storage Link, Source Links, Controller Link)
        const links = this.planLinks(center, sources, controller, storage);
        
        // Σχεδιασμός των Containers (Source & Controller containers)
        const containers = this.planContainers(sources, controller, center);
        
        // Σχεδιασμός των δρόμων (Roads) που ενώνουν τα βασικά σημεία
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
     * Επιλέγουμε ένα σημείο που είναι κοντά στο ιδανικό centroid αλλά και ελεύθερο (walkable terrain).
     */
    findOptimalCenter(sources, controller, distanceMatrix) {
        const padding = 5; // Ελάχιστη απόσταση από τα edges του δωματίου

        // Υπολογισμός του centroid των πηγών
        const sourceCentroid = {
            x: Math.round(sources.reduce((sum, s) => sum + s.pos.x, 0) / sources.length),
            y: Math.round(sources.reduce((sum, s) => sum + s.pos.y, 0) / sources.length)
        };

        // Το ιδανικό γεωμετρικό κέντρο βρίσκεται ανάμεσα στο centroid των πηγών και τον controller
        const controllerPos = controller.pos;
        const idealCenter = {
            x: Math.round((sourceCentroid.x + controllerPos.x) / 2),
            y: Math.round((sourceCentroid.y + controllerPos.y) / 2)
        };

        // Αναζήτηση της καλύτερης walkable θέσης κοντά στο ιδανικό κέντρο χρησιμοποιώντας το distanceMatrix
        let bestCenter = { x: idealCenter.x, y: idealCenter.y };
        let maxDistanceVal = -1;

        for (let dx = -3; dx <= 3; dx++) {
            for (let dy = -3; dy <= 3; dy++) {
                const x = idealCenter.x + dx;
                const y = idealCenter.y + dy;

                if (x < padding || x > 49 - padding || y < padding || y > 49 - padding) continue;

                // Έλεγχος αν η θέση είναι terrain wall
                const terrain = this.room.getTerrain();
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

                // Προτίμηση σε θέσεις που έχουν μεγαλύτερη απόσταση από τοίχους (ανοιχτός χώρος)
                const distVal = distanceMatrix ? distanceMatrix[x][y] : 1;
                if (distVal > maxDistanceVal) {
                    maxDistanceVal = distVal;
                    bestCenter = { x, y };
                }
            }
        }

        return bestCenter;
    }

   
    /**
     * Σχεδιασμός Spawns: Συνήθως 1-3 spawns κοντά στο Storage/Κέντρο.
     */
    planSpawns(center, controller) {
        return [
            { x: center.x - 2, y: center.y - 2 },
            { x: center.x + 2, y: center.y - 2 },
            { x: center.x, y: center.y + 3 }
        ];
    }

    /**
     * Σχεδιασμός Extensions: Γύρω από τα spawns σε compact rings.
     */
    planExtensions(center, spawns) {
        const extensions = [];
        const terrain = this.room.getTerrain();
        
        // Ring 1: 5 extensions
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * 2 * Math.PI;
            const x = Math.round(center.x + 3 * Math.cos(angle));
            const y = Math.round(center.y + 3 * Math.sin(angle));
            if (x >= 2 && x <= 47 && y >= 2 && y <= 47) {
                if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                    extensions.push({ x, y });
                }
            }
        }

        // Ring 2: 5 περισσότερες extensions
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * 2 * Math.PI + Math.PI / 5;
            const x = Math.round(center.x + 4 * Math.cos(angle));
            const y = Math.round(center.y + 4 * Math.sin(angle));
            if (x >= 2 && x <= 47 && y >= 2 && y <= 47) {
                if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                    extensions.push({ x, y });
                }
            }
        }

        return extensions;
    }

    /**
     * Σχεδιασμός Towers: Συνήθως 1-3 towers για coverage γύρω από το κέντρο.
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
     * - 1 Storage Link σε απόσταση 2 από το storage
     * - 1 Link κοντά σε κάθε source σε απόσταση 1
     * - 1 Link κοντά στο controller σε απόσταση 1 (τελευταίο σε προτεραιότητα)
     */
    planLinks(center, sources, controller, storage) {
        const links = [];
        const terrain = this.room.getTerrain();
        const storagePos = storage[0];

        // 1. Storage Link (Σε απόσταση ακριβώς 2 από το storage, προτίμηση προς walkable)
        let storageLinkPlaced = false;
        const storageDist = 2;
        for (let dx = -storageDist; dx <= storageDist; dx++) {
            for (let dy = -storageDist; dy <= storageDist; dy++) {
                if (Math.abs(dx) === storageDist || Math.abs(dy) === storageDist) {
                    const x = storagePos.x + dx;
                    const y = storagePos.y + dy;
                    if (x >= 2 && x <= 47 && y >= 2 && y <= 47 && terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                        links.push({ x, y });
                        storageLinkPlaced = true;
                        break;
                    }
                }
            }
            if (storageLinkPlaced) break;
        }

        // 2. Source Links (1 δίπλα σε κάθε source, σε απόσταση 1 tile)
        for (const source of sources) {
            let linkPlaced = false;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const x = source.pos.x + dx;
                    const y = source.pos.y + dy;
                    if (x >= 2 && x <= 47 && y >= 2 && y <= 47 && terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                        links.push({ x, y });
                        linkPlaced = true;
                        break;
                    }
                }
                if (linkPlaced) break;
            }
        }

        // 3. Controller Link (Σε απόσταση 1 από τον controller - Χαμηλή προτεραιότητα)
        const controllerPos = controller.pos;
        let controllerLinkPlaced = false;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const x = controllerPos.x + dx;
                const y = controllerPos.y + dy;
                if (x >= 2 && x <= 47 && y >= 2 && y <= 47 && terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                    links.push({
                        x, y,
                        isControllerLink: true // Marker για χαμηλή προτεραιότητα κατασκευής
                    });
                    controllerLinkPlaced = true;
                    break;
                }
            }
            if (controllerLinkPlaced) break;
        }

        return links;
    }

    /**
     * Σχεδιασμός Containers: 
     * - 1 container ανά πηγή (απόσταση 1, όσο το δυνατόν πιο κοντά στο κέντρο/storage)
     * - 1 controller container (απόσταση 3, όσο το δυνατόν πιο κοντά στο κέντρο/storage)
     */
    planContainers(sources, controller, center) {
        const containers = [];
        const terrain = this.room.getTerrain();

        // 1. Source Containers (απόσταση 1 από source, κοντά στο κέντρο)
        for (const source of sources) {
            let bestPos = null;
            let minDistanceToCenter = Infinity;

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const x = source.pos.x + dx;
                    const y = source.pos.y + dy;

                    if (x < 2 || x > 47 || y < 2 || y > 47) continue;
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

                    const dist = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
                    if (dist < minDistanceToCenter) {
                        minDistanceToCenter = dist;
                        bestPos = { x, y };
                    }
                }
            }
            if (bestPos) {
                containers.push(bestPos);
            }
        }

        // 2. Controller Container (απόσταση 3 από τον controller, όσο πιο κοντά στο κέντρο γίνεται)
        const controllerPos = controller.pos;
        let bestControllerPos = null;
        let minControllerDistToCenter = Infinity;

        for (let dx = -3; dx <= 3; dx++) {
            for (let dy = -3; dy <= 3; dy++) {
                // Θέλουμε Chebyshev απόσταση ακριβώς 3
                if (Math.max(Math.abs(dx), Math.abs(dy)) === 3) {
                    const x = controllerPos.x + dx;
                    const y = controllerPos.y + dy;

                    if (x < 2 || x > 47 || y < 2 || y > 47) continue;
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

                    const dist = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
                    if (dist < minControllerDistToCenter) {
                        minControllerDistToCenter = dist;
                        bestControllerPos = { x, y };
                    }
                }
            }
        }

        if (bestControllerPos) {
            containers.push(bestControllerPos);
        }

        return containers;
    }

    /**
     * Σχεδιασμός Roads: 
     * - Paths από πηγές στο κέντρο
     * - Paths από κέντρο στο controller
     * - Paths προς τα Spawns
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
        if (spawns) {
            for (const spawn of spawns) {
                addRoadPath(center, spawn);
            }
        }

        return roads;
    }
}

module.exports = AutoLayout;