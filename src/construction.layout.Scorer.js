/*
    CHANGELOG:
    version 1.5.0
    - Refactored processRoads to strictly follow the requested hierarchy:
        1. Source to Center paths (RCL 2, High Bonus).
        2. Center to Controller paths (RCL 2/3, Medium Bonus).
        3. Remaining roads (Infrastructure) based on surrounding structures.
    version 1.4.1
    - Refactored processStructures to be the final step.
    - Added coordinate-based check in processStructures to skip already processed buildings.
    - Ensured all structures from rawData are handled if not caught by specialized processors.
    version 1.4.0
    - Implemented processLinks logic: Controller, Storage, and distance-based Source links.
*/

const { PRIORITIES, STRUCTURE_RCL_STEPS } = require('construction.constants');
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
        
        // Τελευταίο βήμα: Όλα τα υπόλοιπα structures (Spawns, Towers, κλπ)
        this.processStructures(rawData, buildingEntries, context);

        return buildingEntries;
    }

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
                bonus = 100;
            } else if (isStorageLink) {
                bonus = 90;
            } else if (isSourceLink) {
                // Προτεραιότητα στις απομακρυσμένες πηγές
                bonus = 50 + (distToCenter * 0.5); 
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
    }

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
    }

    /**
     * Επεξεργασία Roads: Source Paths > Controller Paths > Infrastructure
     */
    static processRoads(rawData, buildingEntries, roomName, context) {
        if (!rawData.buildings || !rawData.buildings.road) return;

        const roads = rawData.buildings.road;
        const { center, controller, sources } = context;
        const tempRoads = [];

        for (const pos of roads) {
            // Χρήση του RoadPlanner για να βρούμε αν ο δρόμος ανήκει σε κρίσιμο μονοπάτι
            const meta = RoadPlanner.getRoadMetadata(pos.x, pos.y, rawData, buildingEntries, roomName);
            
            let bonus = meta.bonus || 0;
            let rcl = meta.rcl || 8;

            // Εξειδίκευση προτεραιότητας βάσει της επιθυμητής ιεραρχίας
            if (meta.category === 'critical') {
                // Έλεγχος αν είναι Source path ή Controller path
                const isSourcePath = sources.some(s => RoadPlanner.isOnActualPath(pos.x, pos.y, center, s, roomName));
                
                if (isSourcePath) {
                    bonus += 50; // Οι δρόμοι των πηγών προηγούνται
                } else {
                    bonus += 30; // Οι δρόμοι του controller ακολουθούν
                }
            } else if (meta.category === 'logistics') {
                bonus += 10;
            }

            tempRoads.push({
                x: pos.x,
                y: pos.y,
                rcl: rcl,
                bonus: bonus,
                category: meta.category
            });
        }

        // Ταξινόμηση: Πρώτα το RCL και μετά το Bonus
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
				category:r.category
            });
        }
    }

    /**
     * Επεξεργασία Structures: Catch-all για όσα κτίρια δεν έχουν score.
     */
    static processStructures(rawData, buildingEntries, context) {
        if (!rawData.buildings) return;
        const { center } = context;

        // Δημιουργία ενός Set με τα ήδη επεξεργασμένα coordinates για ταχύτητα
        const processedCoords = new Set(buildingEntries.map(e => `${e.x},${e.y}`));

        for (const [type, positions] of Object.entries(rawData.buildings)) {
            // Παράκαμψη metadata και δρόμων (οι δρόμοι έχουν δικό τους process)
            if (type === 'center' || type === 'road') continue;

            positions.forEach((pos, index) => {
                // Έλεγχος αν το κτίριο σε αυτή τη θέση έχει ήδη υπολογιστεί
                if (processedCoords.has(`${pos.x},${pos.y}`)) return;

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
    }

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
        let center = (rawData.buildings && rawData.buildings.center && rawData.buildings.center[0]) || { x: 25, y: 25 };
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

    static calculateRCL(type, count) {
        const steps = STRUCTURE_RCL_STEPS[type];
        if (!steps) return 8;
        if (Array.isArray(steps)) {
            for (let rcl = 1; rcl <= 8; rcl++) if (count <= steps[rcl - 1]) return rcl;
        } else {
            for (const [rcl, maxCount] of Object.entries(steps)) if (count <= maxCount) return parseInt(rcl);
        }
        return 8;
    }
}

module.exports = Scorer;