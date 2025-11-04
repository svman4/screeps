const spawnManager = {
    run: function() {
        const roles = {
            harvester: { min: 2, body: [WORK, CARRY, MOVE] },
            hauler: { min: 2, body: [CARRY, CARRY, MOVE] },
            upgrader: { min: 3, body: [WORK, CARRY, MOVE] },
            builder: { min: 1, body: [WORK, CARRY, MOVE] },
            repairer: { min: 1, body: [WORK, CARRY, MOVE] },
            defender: { min: 0, body: [TOUGH, ATTACK, MOVE, MOVE] }
        };

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            const creeps = _.filter(Game.creeps, c => c.room.name === roomName);
            const spawn = room.find(FIND_MY_SPAWNS)[0];

            if (!spawn) continue;

            // High alert? Spawn defenders!
            if (room.memory.threatLevel === 'HIGH') {
                roles.defender.min = 2; // Emergency defenders
            } else {
                roles.defender.min = 0;
            }

            // Spawn queue priority
            const spawnQueue = ['harvester', 'hauler', 'defender', 'upgrader', 'builder', 'repairer'];
            
            for (const roleName of spawnQueue) {
                const role = roles[roleName];
                const currentCreeps = _.filter(creeps, c => c.memory.role === roleName).length;

                if (currentCreeps < role.min) {
					
                    this.spawnCreep(spawn, roleName, role.body);
                    break; // Spawn one at a time
                }
            }
        }
    },

    spawnCreep: function(spawn, roleName, body) {
        const energyAvailable = spawn.room.energyAvailable;
		
        const maxEnergy = spawn.room.energyCapacityAvailable;
        
		let finalBody = body;

        // Adaptive spawning: if we have max energy, build bigger creeps
        if (energyAvailable === maxEnergy) {
			if (!finalBody) {
				const bodyMapping = {
					harvester: [WORK, WORK,  CARRY, MOVE, MOVE],
					hauler: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE],
					upgrader: [WORK, WORK, WORK, CARRY, MOVE],
					builder: [WORK, WORK, CARRY, MOVE, MOVE],
					repairer: [WORK, WORK, CARRY, MOVE, MOVE],
					defender: [TOUGH, TOUGH, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE]
				};
            finalBody = bodyMapping[roleName];
			}
        }

		
        const newName = roleName + Game.time;
        const result = spawn.spawnCreep(finalBody, 
							newName, 
							{   memory: { role: roleName, working: false }
							});
		
        if (result === OK) {
            console.log(`Spawning new ${roleName}: ${newName}`);
        } else {
		//	console.log(`Error on Spawning new ${roleName}: ${newName} ${result}`);
		}
    }
};

module.exports = spawnManager;
