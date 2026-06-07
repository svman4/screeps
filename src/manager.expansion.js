/**
 * MODULE: Expansion Manager
 * ΠΕΡΙΓΡΑΦΗ: Διαχειρίζεται την επέκταση και τη συλλογή πληροφοριών (Intel)
 * μέσω Observers και Scouts.
 */

 const {EXPANSION_CONSTANTS,ROOM_TYPE}=require("expansion.constants");
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

		const lastCheck=Memory.expansionCheckTime;
		
		if(!lastCheck || (Game.time-EXPANSION_CONSTANTS.REFRESH_INTEL_GRAPH_INTERVAL)>=lastCheck) {
			Memory.expansionCheckTime=Game.time;
			//console.log(Memory.expansionCheckTime);
			this._refreshViewInNeigbors();
			this._enableRemoteMiningRoom();
		}
		
		
		
		
		// const rooms = Memory.rooms;
		// const roomsName = Object.keys(rooms);

		// //debugConsole.debugObject("Main", "Rooms is", roomsName);

	
		// //const mineRoomsNames = roomsName.filter(name => rooms[name].type === ROOM_TYPE.METROPOLIS);
		// //debugConsole.debugObject("Main", "Metropolis is", mineRoomsNames);

		// const remoteMiningNames = roomsName.filter(name => rooms[name].type === ROOM_TYPE.REMOTE_MINING);
		// //debugConsole.debugObject("Expansion", "Remote mining rooms is", remoteMiningNames);
		// for (const rmRoom of remoteMiningNames) {
			// //debugConsole.debugObject("Expansion", "Remote mining room is", rmRoom);
			// const room = roomCache.in(rmRoom).room;
			// debugConsole.debugText("Expansion", Remote mining room is", rmRoom);
		// } 
		
		
		
		
		

		// 3. Ανάθεση εργασιών στους Observers ή προετοιμασία για αποστολή Scouts

        if (Game.time % EXPANSION_CONSTANTS.DELEGATE_VISION_TASKS_INTERVAL === 0) {
          //  this.delegateVisionTasks();
        }
    }
	_enableRemoteMiningRoom() {
		
		
		
	} // end of _enableRemoteMiningRoom
	_refreshViewInNeigbors() {
		for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                // ΓΙα κάθε δωμάτιο στο οποίο είμαστε κάτοχοι(άρα είναι ή θα γίνει metropolis.
				room.memory.type=ROOM_TYPE.METROPOLIS;
				// έλεγχος για το level του room. 
				if(room.controller.level<3) {
					return;
				}
				this._checkNeighborsFrom(roomName);
			}
        }
	}
	_checkNeighborsFrom(metropolisRoomName){ 
		if(!metropolisRoomName || metropolisRoomName===null) {
			return;
		}
		const room=Game.rooms[metropolisRoomName];
		
		if (!room) {
			return ;
		}
		//console.log(metropolisRoomName.name);
		
		const exits = Game.map.describeExits(metropolisRoomName);
		//debugConsole.debugObject("Extension","exits is",exits);		
		const neighborsNames=Object.values(exits);
        if (!neighborsNames) 
			return;			
        for (const neighborName of neighborsNames) {
            if(!Memory.rooms[neighborName]) {
                Memory.rooms[neighborName]={};
            }
            // Στέλνει scout σε κάθε γείτονα για έλεγχο.
			Memory.rooms[neighborName].city=metropolisRoomName;
			if (Game.rooms[neighborName]) {
			 this.updateRoomIntel(neighborName);						
			}
			else			
			{
				this.sendScout(metropolisRoomName,neighborName);
			}
		}
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

        if (!controller) {
            mem.type = ROOM_TYPE.EMPTY;
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
                mem.type = ROOM_TYPE.REMOTE_MINING;
                mem.sources = sources.map(s => ({ id: s.id, x: s.pos.x, y: s.pos.y }));
                mem.controllerPos = { x: controller.pos.x, y: controller.pos.y };
                delete mem.enemyInfo;

            }
        } else {
            mem.type = ROOM_TYPE.ENEMY;
            mem.enemyInfo = {
                owner: controller.owner?.username || 'Invader',
                level: controller.level,
                towers: room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER }).length
            };
        }
    }

    // /**
     // * Σαρώνει τον χάρτη (BFS) γύρω από τα δωμάτιά μας μέχρι ένα συγκεκριμένο βάθος (MAX_REACH_DEPTH).
     // */
    // refreshIntelGraph(myRoomNames) {
        // let reachableRooms = new Set();
        // let queue = myRoomNames.map(name => ({ name: name, depth: 0 }));
        // let visited = new Set(myRoomNames);

        // while (queue.length > 0) {
            // let current = queue.shift();
            // if (current.depth >= EXPANSION_CONSTANTS.MAX_REACH_DEPTH) continue;

            // const exits = Game.map.describeExits(current.name);
            // if (!exits) continue;

            // for (const neighborName of Object.values(exits)) {
                // if (visited.has(neighborName)) continue;

                // visited.add(neighborName);
                // reachableRooms.add(neighborName);

                // // Συνεχίζουμε το ψάξιμο εκτός αν είναι εχθρικό δωμάτιο
                // if (this.shouldExpandSearchThrough(neighborName)) {
                    // queue.push({ name: neighborName, depth: current.depth + 1 });
                // }
            // }
        // }

        // Memory.observerQueue = Array.from(reachableRooms);
        // this.cleanOldMemory(myRoomNames, Array.from(reachableRooms));
    // }

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
    // markForScout(roomName) {
        // if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
        // if (!Game.rooms[roomName]) {
            // Memory.rooms[roomName].scoutNeeded = true;
        // }
    // }

    /**
     * Επιστρέφει ένα δωμάτιο που χρειάζεται Scout (χρήσιμο για το spawnManager).
     */
    // getScoutTarget() {
        // return _.find(Memory.observerQueue, name => Memory.rooms[name]?.scoutNeeded);
    // }

    // clearScoutFlag(roomName) {
        // if (Memory.rooms[roomName]) {
            // delete Memory.rooms[roomName].scoutNeeded;
        // }
    // }

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