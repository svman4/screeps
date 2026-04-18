const BaseLayout = require('construction.layout.BaseLayout');
const { PRIORITIES, STRUCTURE_RCL_STEPS, DEFAULTS_RCL } = require('construction.constants');
const RoadPlanner = require('construction.roadPlanner');

class FileLayout extends BaseLayout {
    constructor(roomName) {
        super();
        this.roomName = roomName;
        this.loadFromMemory(roomName);
    }

    loadFromMemory(roomName) {
        const mem = Memory.rooms[roomName].construction;
        
        // Αν υπάρχει ήδη στη μνήμη, το φορτώνουμε
        if (mem.blueprint) {
            this.blueprint = mem.blueprint;
            return;
        }

        if (!global.roomBlueprints || !global.roomBlueprints[this.roomName]) return;
        
        const rawData = global.roomBlueprints[this.roomName];
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
                const rclReq = this.calculateRCLRequirement(type, index);
                const distance = Math.abs(pos.x - center.x) + Math.abs(pos.y - center.y);
                
                buildingEntries.push({
                    type, x: pos.x, y: pos.y, rcl: rclReq,
                    score: (PRIORITIES[type.toUpperCase()] || 0) - (distance * DISTANCE_FACTOR)
                });
            });
        }

        // Επεξεργασία δρόμων με categories
        const roadPositions = rawData.buildings.road || [];
        const roadEntries = roadPositions.map(pos => {
            const roadMeta = RoadPlanner.getRoadMetadata(pos.x, pos.y, rawData, buildingEntries,roomName);
            const distance = Math.abs(pos.x - center.x) + Math.abs(pos.y - center.y);
            
            return {
                type: 'road',
                x: pos.x,
                y: pos.y,
                rcl: roadMeta.rcl,
                category: roadMeta.category, // Αποθήκευση κατηγορίας
                score: (PRIORITIES.ROAD || 0) + roadMeta.bonus - (distance * DISTANCE_FACTOR)
            };
        });

        const finalBlueprint = [...buildingEntries, ...roadEntries];
        finalBlueprint.sort((a, b) => b.score - a.score);

        // Αποθήκευση στο Memory
        mem.blueprint = finalBlueprint;
        this.blueprint = finalBlueprint;
    }

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