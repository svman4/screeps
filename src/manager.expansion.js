/**
 * MODULE: Expansion Manager
 * ΠΕΡΙΓΡΑΦΗ: Διαχειρίζεται την επέκταση και τη συλλογή πληροφοριών (Intel)
 * μέσω Observers και Scouts.
 */

 const {EXPANSION_CONSTANTS}=require("expansion.constants");
 const roomCache=require("utils.RoomCache");
 const spawnManager=require("manager.spawn");
 const {ROLES}=require("spawn.constants");
 const debugConsole=require("utils.debugConsole");
class ExpansionManager {
    constructor() {
		
    } // end of constructor

    /**
     * Κύρια μέθοδος εκτέλεσης (καλείται από το main.js)
     */
    run() {
        // Εξοικονόμηση CPU: Σταματάμε αν το bucket είναι χαμηλό
        if (Game.cpu.bucket < 500) return;


		if(Game.time%EXPANSION_CONSTANTS.REFRESH_INTEL_GRAPH_INTERVAL===0) {
			this.refreshViewInNeigbors();
		}
		

		
		
		
        // Βρίσκουμε τα δωμάτια που μας ανήκουν
        //const hasGCL = Game.gcl.level > myRoomNames.length;
		// TODO κάθε 30 tick
		// έλεγχος για κάθε γειτονικό δωμάτιο. remote mining ή αν υπάρχει Observer και όλα τα υπόλοιπα.
		
		
		// Κάθε refresh_intel_graph_interval 
		//	Αν δεν υπάρχει observer αποστολή scout για έλεγχο του γειτονικού δωματίου.
			
		//


        // 1. Επεξεργασία δεδομένων από το προηγούμενο tick (από Observer ή Scout)
        //this.readVisionData(false);
        
        // 2. Ανανέωση του χάρτη (Graph) των γειτονικών δωματίων (Βαριά εργασία)
        if (Game.time % EXPANSION_CONSTANTS.REFRESH_INTEL_GRAPH_INTERVAL === 0) {
          //  this.refreshIntelGraph(myRoomNames);
        }

        // 3. Ανάθεση εργασιών στους Observers ή προετοιμασία για αποστολή Scouts

        if (Game.time % EXPANSION_CONSTANTS.DELEGATE_VISION_TASKS_INTERVAL === 0) {
          //  this.delegateVisionTasks();
        }
    }
	refreshViewInNeigbors() {
		for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                // ΓΙα κάθε δωμάτιο στο οποίο είμαστε κάτοχοι(άρα είναι ή θα γίνει metropolis.
				
				// έλεγχος για το level του room. 
				if(room.controller.level<3) {
					return;
				}
				this.checkNeighborsFrom(roomName);
			}
        }
	}
	checkNeighborsFrom(roomName){ 
		if(!roomName || roomName===null) {
			return;
		}
		const room=Game.rooms[roomName];
		
		if (!room) {
			return ;
		}
		console.log(room.name);
		
		const exits = Game.map.describeExits(roomName);
		//debugConsole.debugObject("Extension","exits is",exits);		
		const neighborsNames=Object.values(exits);
         if (neighborsNames) {
			
            for (const neighborName of neighborsNames) {
               // Στέλνει scout σε κάθε γείτονα για έλεγχο.
			  this.sendScout(roomName,neighborName);
            }
		 }
		
		//debugConsole.debugObject("Extension","Neighbors is",neighborsNames);	
	} 
    /**
     * Ελέγχει και αποθηκεύει δεδομένα για τα δωμάτια στα οποία έχουμε ορατότητα.
     */
    readVisionData(hasGCL) {
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
    }

    /**
     * Ενημερώνει τη μνήμη με τα δεδομένα του δωματίου (Sources, Controller, Enemies).
     */
    updateRoomIntel(room) {
        const mem = Memory.rooms[room.name] || (Memory.rooms[room.name] = {});
        const controller = room.controller;

        mem.lastScouted = Game.time;
        mem.scoutNeeded = false; // Καθαρίζει τη σημαία εφόσον έχουμε vision

        if (!controller) {
            mem.type = 'corridor';
            return;
        }

        // Αν είναι δικό μας ή το κάνουμε reserve
        if (controller.my || (controller.reservation?.username === EXPANSION_CONSTANTS.USERNAME)) {
            this.clearIntelTags(mem);
            return;
        }

        const isFree = !controller.owner && (!controller.reservation || controller.reservation.username === EXPANSION_CONSTANTS.USERNAME);

        if (isFree) {
            const sources = room.find(FIND_SOURCES);
            if (sources.length > 0) {
                mem.type = 'remote_mining'; 
                mem.sources = sources.map(s => ({ id: s.id, x: s.pos.x, y: s.pos.y }));
                mem.controllerPos = { x: controller.pos.x, y: controller.pos.y };
                delete mem.enemyInfo;
				//TODO ΠΩς θα ξεκινήσω τη διαχείριση του δωματίου για remotemining.
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

    /**
     * Σαρώνει τον χάρτη (BFS) γύρω από τα δωμάτιά μας μέχρι ένα συγκεκριμένο βάθος (MAX_REACH_DEPTH).
     */
    refreshIntelGraph(myRoomNames) {
        let reachableRooms = new Set();
        let queue = myRoomNames.map(name => ({ name: name, depth: 0 }));
        let visited = new Set(myRoomNames);

        while (queue.length > 0) {
            let current = queue.shift();
            if (current.depth >= EXPANSION_CONSTANTS.MAX_REACH_DEPTH) continue;

            const exits = Game.map.describeExits(current.name);
            if (!exits) continue;

            for (const neighborName of Object.values(exits)) {
                if (visited.has(neighborName)) continue;

                visited.add(neighborName);
                reachableRooms.add(neighborName);

                // Συνεχίζουμε το ψάξιμο εκτός αν είναι εχθρικό δωμάτιο
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

    delegateVisionTasks() {
        if (!Memory.observerQueue || Memory.observerQueue.length === 0) return;

        const observers = _.filter(Game.structures, s => s.structureType === STRUCTURE_OBSERVER && s.my);

        const targets = _.filter(Memory.observerQueue, name => {
            const mem = Memory.rooms[name];
            return !mem || !mem.lastScouted || (Game.time - mem.lastScouted > EXPANSION_CONSTANTS.INTEL_STALE_TIME);
        }).slice(0, Math.max(observers.length, 5));

        if (observers.length > 0) {
            targets.forEach((targetName, index) => {
                const obs = observers[index % observers.length];
                if (Game.map.getRoomLinearDistance(obs.room.name, targetName) <= EXPANSION_CONSTANTS.OBSERVER_RANGE) {
                    if (obs.observeRoom(targetName) === OK) {
                        Memory.obsTarget = targetName;
                    }
                } else {
                    this.markForScout(targetName);
                }
            });
        } else {
            // Δεν υπάρχουν observers, άρα χρειαζόμαστε scouts
            targets.forEach(t => this.sendScout(t));
        }
    }
	sendScout(roomName,targetName) {
		spawnManager.addRoleToQueue(roomName, ROLES.SCOUT, 50, [MOVE],  {},  targetName);
		
	} // end of sendScout
    markForScout(roomName) {
        if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
        if (!Game.rooms[roomName]) {
            Memory.rooms[roomName].scoutNeeded = true;
        }
    }

    /**
     * Επιστρέφει ένα δωμάτιο που χρειάζεται Scout (χρήσιμο για το spawnManager).
     */
    getScoutTarget() {
        return _.find(Memory.observerQueue, name => Memory.rooms[name]?.scoutNeeded);
    }

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
        // Επιστρέφει true αν το GCL μας επιτρέπει να πάρουμε νέο δωμάτιο.
        const myRoomNames = _.filter(Game.rooms, r => r.controller && r.controller.my).length;
        return Game.gcl.level > myRoomNames;
    }
}

module.exports = new ExpansionManager();