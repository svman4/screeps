const defenseManager = {
    run: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            const hostiles = room.find(FIND_HOSTILE_CREEPS);

            if (hostiles.length > 0) {
                const towers = room.find(FIND_MY_STRUCTURES, {
                    filter: { structureType: STRUCTURE_TOWER }
                });

                // Prioritize targets: Healers > Attackers > Others
                const target = hostiles.sort((a, b) => {
                    const aIsHealer = a.body.some(p => p.type === HEAL);
                    const bIsHealer = b.body.some(p => p.type === HEAL);
                    const aIsAttacker = a.body.some(p => p.type === ATTACK || p.type === RANGED_ATTACK);
                    const bIsAttacker = b.body.some(p => p.type === ATTACK || p.type === RANGED_ATTACK);

                    if (aIsHealer && !bIsHealer) return -1;
                    if (!aIsHealer && bIsHealer) return 1;
                    if (aIsAttacker && !bIsAttacker) return -1;
                    if (!aIsAttacker && bIsAttacker) return 1;
                    return 0;
                })[0];

                towers.forEach(tower => tower.attack(target));
                
                // Set threat level for the spawn manager
                room.memory.threatLevel = 'HIGH';

            } else {
                const towers = room.find(FIND_MY_STRUCTURES, {
                    filter: { structureType: STRUCTURE_TOWER }
                });

                // If no hostiles, towers can repair
                if (towers.length > 0) {
                    const damagedStructure = room.find(FIND_STRUCTURES, {
                        filter: (s) => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART
                    }).sort((a, b) => a.hits - b.hits)[0];

                    if (damagedStructure) {
                        towers.forEach(tower => tower.repair(damagedStructure));
                    }
                }
                
                // Reset threat level
                room.memory.threatLevel = 'NONE';
            }
        }
    }
};

module.exports = defenseManager;
