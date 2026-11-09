/**
 * MODULE: Expansion Manager
 * ΠΕΡΙΓΡΑΦΗ: Διαχειρίζεται την επέκταση και τη συλλογή πληροφοριών (Intel)
 * μέσω Observers και Scouts.
 */
import * as _ from "lodash";
import { EXPANSION_CONSTANTS, ROOM_TYPE, CPU_BUCKET_SAFETY_THRESHOLD } from "./expansion.constants";
import spawnManager = require("./manager.spawn");
import { ROLES } from "./spawn.constants";

class ExpansionManager {
    constructor() {

    } // end of constructor

    /**
     * Κύρια μέθοδος εκτέλεσης (καλείται από το main.js)
     */
    run(): void {
        // Εξοικονόμηση CPU: Σταματάμε αν το bucket είναι χαμηλό
        if (Game.cpu.bucket < CPU_BUCKET_SAFETY_THRESHOLD) return;

        const lastCheck = Memory.expansionCheckTime;

        if (!lastCheck || (Game.time - EXPANSION_CONSTANTS.REFRESH_INTEL_GRAPH_INTERVAL) >= lastCheck) {
            Memory.expansionCheckTime = Game.time;
            //console.log(Memory.expansionCheckTime);
            this._refreshViewInNeigbors();
            this._enableRemoteMiningRoom();
        }


        if (Game.time % EXPANSION_CONSTANTS.DELEGATE_VISION_TASKS_INTERVAL === 0) {
            //  this.delegateVisionTasks();
        }
    }
    private _enableRemoteMiningRoom(): void {



    } // end of _enableRemoteMiningRoom
    private _refreshViewInNeigbors() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                // ΓΙα κάθε δωμάτιο στο οποίο είμαστε κάτοχοι(άρα είναι ή θα γίνει metropolis.
                room.memory.type = ROOM_TYPE.METROPOLIS;
                // έλεγχος για το level του room. 
                if (room.controller.level < 3) {
                    return;
                }
                this._checkNeighborsFrom(roomName);
            }
        }
    }
    private _checkNeighborsFrom(metropolisRoomName: string): void {
        if (!metropolisRoomName || metropolisRoomName === null) {
            return;
        }
        const room = Game.rooms[metropolisRoomName];
        room.memory.type
        if (!room) {
            return;
        }
        //console.log(metropolisRoomName.name);

        const exits = Game.map.describeExits(metropolisRoomName);
        //debugConsole.debugObject("Extension","exits is",exits);		
        const neighborsNames = Object.values(exits);
        if (!neighborsNames)
            return;
        for (const neighborName of neighborsNames) {
            if (!Memory.rooms[neighborName]) {
                Memory.rooms[neighborName] = {};
            }
            // Στέλνει scout σε κάθε γείτονα για έλεγχο.
            Memory.rooms[neighborName].city = metropolisRoomName;
            if (Game.rooms[neighborName]) {
                this.updateRoomIntelWithRoomName(neighborName, false);
            }
            else {
                this.sendScout(metropolisRoomName, neighborName);
            }
        }
    } // end of _checkNeighborsFrom(metropolis)



    /**
     * Ελέγχει και αποθηκεύει δεδομένα για τα δωμάτια στα οποία έχουμε ορατότητα.
     */
    public readVisionData(hasGCL?: boolean): void {
        // Έλεγχος του δωματίου που στόχευσε ο Observer στο προηγούμενο tick
        if (Memory.obsTarget && Game.rooms[Memory.obsTarget]) {
            this.updateRoomIntel(Game.rooms[Memory.obsTarget], hasGCL);
            delete Memory.obsTarget;
        }

        // Έλεγχος όλων των δωματίων στην ουρά (π.χ. από Scouts που έφτασαν)
        if (Memory.observerQueue) {
            for (const roomName of Memory.observerQueue) {
                if (Game.rooms[roomName]) {
                    this.updateRoomIntel(Game.rooms[roomName], hasGCL);
                }
            }
        }
    } // end of readVisionData



    private shouldExpandSearchThrough(roomName: string): boolean {
        const mem = Memory.rooms[roomName];
        if (mem && mem.type === 'enemy') return false;
        return true;
    }

    public updateRoomIntelWithRoomName(roomName: string, hasGCL: boolean): void {
        const room = Game.rooms[roomName];
        this.updateRoomIntel(room, hasGCL);

    }
    public updateRoomIntel(room: Room, hasGCL: boolean = true): void {
        const mem = ((Memory.rooms[room.name] || (Memory.rooms[room.name] = {})) as RoomMemory);
        const controller = room.controller;

        mem.lastScouted = Game.time;
        mem.scoutNeeded = false; // Καθαρίζει αυτόματα τη σημαία όταν αποκτήσουμε vision

        if (!controller) {
            mem.type = 'corridor';
            return;
        }

        if (controller.my || (controller.reservation?.username === EXPANSION_CONSTANTS.USERNAME)) {
            this.clearIntelTags(mem);
            return;
        }

        const isFree = !controller.owner && (!controller.reservation || controller.reservation.username === EXPANSION_CONSTANTS.USERNAME);

        if (isFree) {
            const sources = room.find(FIND_SOURCES);
            if (sources.length > 0) {
                mem.type = (sources.length >= 2 && hasGCL) ? 'remote_mining' : 'remote_mining';
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

    public delegateVisionTasks(): void {
        if (!Memory.observerQueue || Memory.observerQueue.length === 0) return;

        const observers = _.filter(Game.structures, s => s.structureType === STRUCTURE_OBSERVER && s.my);

        const targets = _.filter(Memory.observerQueue, name => {
            const mem = Memory.rooms[name] as RoomMemoryData;
            return !mem || !mem.lastScouted || (Game.time - mem.lastScouted > EXPANSION_CONSTANTS.INTEL_STALE_TIME);
        }).slice(0, Math.max(observers.length, 5));

        if (observers.length > 0) {
            targets.forEach((targetName, index) => {
                const obs = observers[index % observers.length];
                if (Game.map.getRoomLinearDistance(obs.room.name, targetName) <= EXPANSION_CONSTANTS.OBSERVER_RANGE) {
                    if ((obs as StructureObserver).observeRoom(targetName) === OK) {
                        Memory.obsTarget = targetName;
                    }
                }
            });
        } else {
            // Δεν υπάρχουν observers, άρα χρειαζόμαστε scouts
            targets.forEach(t => this.sendScout(t));
        }
    }
    public sendScout(targetRoomName: string, metropolisName: string = ""): void {
        if (metropolisName === "") {
            //TODO find the nearest metropolisTo send scount
        } else {
            spawnManager.addRoleToQueue(metropolisName, ROLES.SCOUT, 50, [MOVE], {}, targetRoomName);

        }
    }

    public cleanOldMemory(myRooms: string[], neighbors: string[]): void {
        const valid = _.union(myRooms, neighbors);
        for (const name in Memory.rooms) {
            if (!valid.includes(name)) delete Memory.rooms[name];
        }
    }

    private clearIntelTags(mem: RoomMemoryData): void {
        delete mem.type;
        delete mem.sources;
        delete mem.enemyInfo;
        delete mem.scoutNeeded;
    }

    public canIExpand(): boolean {
        // Επιστρέφει true αν το GCL μας επιτρέπει να πάρουμε νέο δωμάτιο.
        const myRoomNames = _.filter(Game.rooms, r => r.controller && r.controller.my).length;
        return Game.gcl.level > myRoomNames;
    }
} // end of ExpansionManager

export = new ExpansionManager();