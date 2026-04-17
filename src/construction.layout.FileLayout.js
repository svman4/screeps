const BaseLayout = require('construction.layout.BaseLayout');
const { PRIORITIES, STRUCTURE_RCL_STEPS, DEFAULTS_RCL } = require('construction.constants');
const RoadPlanner = require('construction.roadPlanner');

/**
 * FILE LAYOUT CLASS
 * Διαβάζει blueprints και υπολογίζει δυναμικά το RCL βάσει εγγύτητας στο κέντρο.
 */
class FileLayout extends BaseLayout {
    constructor(roomName) {
        super();
        this.roomName = roomName;
        this.loadFromFile(roomName);
    }

    loadFromFile(roomName) {
        if (!global.blueprintCache) global.blueprintCache = {};
        if (global.blueprintCache[this.roomName]) {
            this.blueprint = global.blueprintCache[this.roomName];
            return;
        }

        if (!global.roomBlueprints || !global.roomBlueprints[this.roomName]) return;
        
        const rawData = global.roomBlueprints[this.roomName];
        const center = rawData.buildings.center || { x: 25, y: 25 };
        const DISTANCE_FACTOR = 0.1;
        const processedBlueprint = [];

        // Προ-υπολογισμός RCL για κτίρια (εκτός δρόμων)
        const buildingEntries = [];

        for (const [type, positions] of Object.entries(rawData.buildings)) {
            if (type === 'center' || type === 'road') continue;

            // Ταξινομούμε τις θέσεις κάθε τύπου κτιρίου με βάση την απόσταση από το κέντρο
            const sortedPositions = [...positions].sort((a, b) => {
                const distA = Math.abs(a.x - center.x) + Math.abs(a.y - center.y);
                const distB = Math.abs(b.x - center.x) + Math.abs(b.y - center.y);
                return distA - distB;
            });

            sortedPositions.forEach((pos, index) => {
                const rclReq = this.calculateRCLRequirement(type, index);
                const distance = Math.abs(pos.x - center.x) + Math.abs(pos.y - center.y);
                
                buildingEntries.push({
                    type,
                    x: pos.x,
                    y: pos.y,
                    rcl: rclReq,
                    score: (PRIORITIES[type.toUpperCase()] || 0) - (distance * DISTANCE_FACTOR)
                });
            });
        }

        // Τώρα επεξεργαζόμαστε τους δρόμους, έχοντας ήδη τα RCL των κτιρίων
        const roadPositions = rawData.buildings.road || [];
        const roadEntries = roadPositions.map(pos => {
            // Ο RoadPlanner λαμβάνει υπόψη τα RCL των κτιρίων που υπολογίσαμε παραπάνω
            const roadMeta = RoadPlanner.getRoadMetadata(pos.x, pos.y, rawData, buildingEntries);
            const distance = Math.abs(pos.x - center.x) + Math.abs(pos.y - center.y);
            
            return {
                type: 'road',
                x: pos.x,
                y: pos.y,
                rcl: roadMeta.rcl,
                score: (PRIORITIES.ROAD || 0) + roadMeta.bonus - (distance * DISTANCE_FACTOR)
            };
        });

        const finalBlueprint = [...buildingEntries, ...roadEntries];
        finalBlueprint.sort((a, b) => b.score - a.score);

        global.blueprintCache[this.roomName] = finalBlueprint;
        this.blueprint = finalBlueprint;
    }

    /**
     * Υπολογίζει το RCL βάσει της σειράς (από το κέντρο προς τα έξω).
     */
    calculateRCLRequirement(type, index) {
        if (STRUCTURE_RCL_STEPS[type]) {
            const steps = STRUCTURE_RCL_STEPS[type];
            if (Array.isArray(steps)) return steps[index] || steps[steps.length - 1];
            if (typeof steps === 'object') {
                for (let rcl = 1; rcl <= 8; rcl++) {
                    if (index < (steps[rcl] || 0)) return rcl;
                }
                return 8;
            }
        }
        return DEFAULTS_RCL[type] || 8;
    }
}

module.exports = FileLayout;