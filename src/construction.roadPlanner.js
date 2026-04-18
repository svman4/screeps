class RoadPlanner {
    static getRoadMetadata(x, y, rawData, buildingEntries, roomName) {
        if (!roomName) return { rcl: 8, bonus: 0, category: 'infrastructure' };

        const spawns = rawData.buildings.spawn || [];
        const controller = rawData.controller;
        const sources = rawData.sources || [];
        const storagePos = rawData.buildings.storage ? rawData.buildings.storage[0] : null;
        const terminalPos = rawData.buildings.terminal ? rawData.buildings.terminal[0] : null;
        const mineralPos = rawData.mineral;

        // 1. Critical Paths (RCL 2)
        for (let s of sources) {
            if (this.isOnActualPath(x, y, spawns[0], s, roomName) || 
                this.isOnActualPath(x, y, spawns[0], controller, roomName)) {
                return { rcl: 2, bonus: 100, category: 'critical' };
            }
        }

        // 2. Logistics Paths (RCL 4-6)
        if (storagePos) {
            for (let s of sources) {
                if (this.isOnActualPath(x, y, storagePos, s, roomName)) return { rcl: 4, bonus: 80, category: 'logistics' };
            }
            if (this.isOnActualPath(x, y, storagePos, controller, roomName)) return { rcl: 4, bonus: 70, category: 'logistics' };
        }
        if (mineralPos && terminalPos) {
            if (this.isOnActualPath(x, y, terminalPos, mineralPos, roomName)) return { rcl: 6, bonus: 60, category: 'logistics' };
        }

        // 3. Infrastructure
        let minNeighborRcl = 8;
        let foundNeighbor = false;
        for (const b of buildingEntries) {
            if (Math.abs(b.x - x) <= 1 && Math.abs(b.y - y) <= 1) {
                if (b.rcl < minNeighborRcl) minNeighborRcl = b.rcl;
                foundNeighbor = true;
            }
        }

        return { rcl: foundNeighbor ? minNeighborRcl : 8, bonus: foundNeighbor ? 10 : 0, category: 'infrastructure' };
    }

    static isOnActualPath(x, y, start, end, roomName) {
        if (!start || !end) return false;
        const pathKey = `path_${start.x}_${start.y}_to_${end.x}_${end.y}`;
        if (!global._pathCache) global._pathCache = {};

        if (!global._pathCache[pathKey]) {
            const search = PathFinder.search(new RoomPosition(start.x, start.y, roomName), 
                { pos: new RoomPosition(end.x, end.y, roomName), range: 1 }, 
                { plainCost: 2, swampCost: 10, roomCallback: () => new PathFinder.CostMatrix() });
            
            const set = new Set();
            search.path.forEach(p => {
                // Προσθέτουμε και τα γειτονικά squares για να "πιάνει" το blueprint
                for(let dx=-1; dx<=1; dx++) for(let dy=-1; dy<=1; dy++) set.add(`${p.x+dx},${p.y+dy}`);
            });
            global._pathCache[pathKey] = set;
        }
        return global._pathCache[pathKey].has(`${x},${y}`);
    }

    static shouldBuildRoad(roadPos, rawData, builtMap, currentRCL) {
        if (roadPos.rcl > currentRCL) return false;
        if (roadPos.category === 'critical' || roadPos.category === 'logistics') return true;
        if (currentRCL >= 4 && roadPos.category === 'infrastructure') return this.hasBuiltNeighbor(roadPos.x, roadPos.y, builtMap);
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
}
module.exports = RoadPlanner;