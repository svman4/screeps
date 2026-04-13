/**
 * ExpansionManager - Advanced Path-based Intel & Expansion
 * Υποστηρίζει Observers και Scouts ως fallback.
 */
class ExpansionManager {
    constructor() {
        this.USERNAME = 'Svman4';
        this.OBSERVER_RANGE = 10;
        this.MAX_REACH_DEPTH = 2;
        this.INTEL_STALE_TIME = 5000; // Πότε θεωρούμε το intel παλιό
    }

    run() {
        if (Game.cpu.bucket < 500) return;

        const myRoomNames = _.filter(Game.rooms, r => r.controller && r.controller.my).map(r => r.name);
        const hasGCL = Game.gcl.level > myRoomNames.length;

        // 1. Επεξεργασία αποτελεσμάτων από το προηγούμενο tick (Observer ή Scout που μπήκε στο δωμάτιο)
        this.readVisionData(hasGCL);

        // 2. Βαριές εργασίες συντήρησης (Κάθε 1000 ticks)
        if (Game.time % 1000 === 0) {
            this.refreshIntelGraph(myRoomNames);
        }

        // 3. Ανάθεση εργασιών (Κάθε 30 ticks)
        if (Game.time % 30 === 0) {
            this.delegateVisionTasks();
        }
    }

    /**
     * Ελέγχει όλα τα δωμάτια στα οποία έχουμε Vision αυτή τη στιγμή
     */
    readVisionData(hasGCL) {
        if (Memory.obsTarget && Game.rooms[Memory.obsTarget]) {
            this.updateRoomIntel(Game.rooms[Memory.obsTarget], hasGCL);
            delete Memory.obsTarget;
        }

        if (Memory.observerQueue) {
            for (const roomName of Memory.observerQueue) {
                if (Game.rooms[roomName]) {
                    this.updateRoomIntel(Game.rooms[roomName], hasGCL);
                }
            }
        }
    }

    refreshIntelGraph(myRoomNames) {
        let reachableRooms = new Set();
        let queue = myRoomNames.map(name => ({ name: name, depth: 0 }));
        let visited = new Set(myRoomNames);

        while (queue.length > 0) {
            let current = queue.shift();
            if (current.depth >= this.MAX_REACH_DEPTH) continue;

            const exits = Game.map.describeExits(current.name);
            if (!exits) continue;

            for (const neighborName of Object.values(exits)) {
                if (visited.has(neighborName)) continue;

                visited.add(neighborName);
                reachableRooms.add(neighborName);

                if (this.shouldExpandSearchThrough(neighborName)) {
                    queue.push({ name: neighborName, depth: current.depth + 1 });
                }
            }
        }

        Memory.observerQueue = Array.from(reachableRooms);
        this.cleanOldMemory(myRoomNames, Array.from(reachableRooms));
    }

    shouldExpandSearchThrough(roomName) {
        const mem = Memory.rooms[roomName];
        if (mem && mem.type === 'enemy') return false;
        return true;
    }

    updateRoomIntel(room, hasGCL) {
        const mem = Memory.rooms[room.name] || (Memory.rooms[room.name] = {});
        const controller = room.controller;

        mem.lastScouted = Game.time;
        mem.scoutNeeded = false; // Καθαρίζει αυτόματα τη σημαία όταν αποκτήσουμε vision

        if (!controller) {
            mem.type = 'corridor';
            return;
        }

        if (controller.my || (controller.reservation?.username === this.USERNAME)) {
            this.clearIntelTags(mem);
            return;
        }

        const isFree = !controller.owner && (!controller.reservation || controller.reservation.username === this.USERNAME);

        if (isFree) {
            const sources = room.find(FIND_SOURCES);
            if (sources.length > 0) {
                mem.type = (sources.length >= 2 && hasGCL) ? 'claim_target' : 'remote_mining';
                mem.sources = sources.map(s => ({ id: s.id, x: s.pos.x, y: s.pos.y }));
                mem.controllerPos = { x: controller.pos.x, y: controller.pos.y };
                delete mem.enemyInfo;
            }
        } else {
            mem.type = 'enemy';
            mem.enemyInfo = {
                owner: controller.owner?.username || 'Invader',
                level: controller.level,
                towers: room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER }).length
            };
        }
    }

    delegateVisionTasks() {
        if (!Memory.observerQueue || Memory.observerQueue.length === 0) return;

        const observers = _.filter(Game.structures, s => s.structureType === STRUCTURE_OBSERVER && s.my);

        const targets = _.filter(Memory.observerQueue, name => {
            const mem = Memory.rooms[name];
            return !mem || !mem.lastScouted || (Game.time - mem.lastScouted > this.INTEL_STALE_TIME);
        }).slice(0, Math.max(observers.length, 5));

        if (observers.length > 0) {
            targets.forEach((targetName, index) => {
                const obs = observers[index % observers.length];
                if (Game.map.getRoomLinearDistance(obs.room.name, targetName) <= this.OBSERVER_RANGE) {
                    if (obs.observeRoom(targetName) === OK) {
                        Memory.obsTarget = targetName;
                    }
                } else {
                    this.markForScout(targetName);
                }
            });
        } else {
            targets.forEach(t => this.markForScout(t));
        }
    }

    markForScout(roomName) {
        if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
        // Θέτουμε τη σημαία μόνο αν δεν υπάρχει ήδη vision ή αν το intel είναι παλιό
        if (!Game.rooms[roomName]) {
            Memory.rooms[roomName].scoutNeeded = true;
        }
    }

    /**
     * PUBLIC API: Καλέστε το από το Spawn Logic σας.
     * Επιστρέφει το όνομα του δωματίου που χρειάζεται Scout.
     */
    getScoutTarget() {
        return _.find(Memory.observerQueue, name => Memory.rooms[name]?.scoutNeeded);
    }

    /**
     * Καθαρίζει τη σημαία. Καλό είναι να καλείται αμέσως μετά το επιτυχημένο Spawn.
     */
    clearScoutFlag(roomName) {
        if (Memory.rooms[roomName]) {
            delete Memory.rooms[roomName].scoutNeeded;
        }
    }

    cleanOldMemory(myRooms, neighbors) {
        const valid = _.union(myRooms, neighbors);
        for (const name in Memory.rooms) {
            if (!valid.includes(name)) delete Memory.rooms[name];
        }
    }

    clearIntelTags(mem) {
        delete mem.type;
        delete mem.sources;
        delete mem.enemyInfo;
        delete mem.scoutNeeded;
    }
	canIExpand() {
		const myRoomNames = _.filter(Game.rooms, r => r.controller && r.controller.my).length;
		return Game.gcl.level > myRoomNames;
	}
}

module.exports = new ExpansionManager();