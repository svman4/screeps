const BaseLayout = require('construction.layout.BaseLayout');
const { PRIORITIES, STRUCTURE_RCL_STEPS, DEFAULTS_RCL } = require('construction.constants');

/**
 * FILE LAYOUT CLASS
 */
class FileLayout extends BaseLayout {
    constructor(roomName) {
        super();
        this.roomName = roomName;
        this.loadFromFile(roomName);
    }

    loadFromFile(roomName) {
        // Χρήση global cache για αποφυγή επανυπολογισμού σε κάθε tick
        if (!global.blueprintCache) global.blueprintCache = {};

        if (global.blueprintCache[roomName]) {
            this.blueprint = global.blueprintCache[roomName];
            return;
        }

        if (!global.roomBlueprints || !global.roomBlueprints[roomName]) return;
        
        const rawData = global.roomBlueprints[roomName];
        const center = rawData.buildings.center || { x: 25, y: 25 };
        const DISTANCE_FACTOR = 0.1;

        const processedBlueprint = [];

        for (const [type, positions] of Object.entries(rawData.buildings)) {
            if (type === 'center') continue;

            positions.forEach((pos, index) => {
                const typeUpper = type.toUpperCase();
                const basePriority = PRIORITIES[typeUpper] || 0;
                const distance = Math.max(Math.abs(pos.x - center.x), Math.abs(pos.y - center.y));
                const rclReq = this.calculateRCLRequirement(type, index);

                processedBlueprint.push({
                    type: type,
                    x: pos.x,
                    y: pos.y,
                    rcl: rclReq,
                    score: basePriority - (distance * DISTANCE_FACTOR)
                });
            });
        }
        
        // Ταξινόμηση βάσει score (Priority)
        processedBlueprint.sort((a, b) => b.score - a.score);
        
        // Αποθήκευση στο cache και στο instance
        global.blueprintCache[roomName] = processedBlueprint;
        this.blueprint = processedBlueprint;
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