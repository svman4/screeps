var militaryController = {
    /**
     * Κύρια λειτουργία - ελέγχει αν χρειαζόμαστε στρατό και τον δημιουργεί
     */
    run: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return;

        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });

        // Ανίχνευση κατάστασης άμυνας
        const defenseStatus = this.assessDefenseStatus(room, hostiles, towers);
        
        // Απόκριση βάσει κατάστασης
        switch (defenseStatus) {
            case 'CRITICAL':
                this.emergencyResponse(room);
                break;
            case 'HIGH_ALERT':
                this.highAlertResponse(room);
                break;
            case 'LOW_ALERT':
                this.lowAlertResponse(room);
                break;
            case 'SAFE':
                this.peaceTimeMaintenance(room);
                break;
        }
        this.manageMilitaryCreeps(room);
    },

    /**
     * Αξιολόγηση της κατάστασης άμυνας
     */
    assessDefenseStatus: function(room, hostiles, towers) {
        if (hostiles.length === 0) return 'SAFE';

        const hostilePower = this.calculateHostilePower(hostiles);
        const defensePower = this.calculateDefensePower(room, towers);
        
        // Κρίσιμη κατάσταση: εχθροί υπερτερούν σημαντικά
        if (hostilePower > defensePower * 2) {
            return 'CRITICAL';
        }
        
        // Υψηλός κίνδυνος: εχθροί υπερτερούν
        if (hostilePower > defensePower) {
            return 'HIGH_ALERT';
        }
        
        // Χαμηλός κίνδυνος: η άμυνα είναι επαρκής αλλά χρειάζεται ενίσχυση
        return 'LOW_ALERT';
    },

    /**
     * Υπολογισμός εχθρικής δύναμης
     */
    calculateHostilePower: function(hostiles) {
        return hostiles.reduce((power, creep) => {
            const attackParts = creep.getActiveBodyparts(ATTACK);
            const rangedParts = creep.getActiveBodyparts(RANGED_ATTACK);
            const healParts = creep.getActiveBodyparts(HEAL);
            const workParts = creep.getActiveBodyparts(WORK);
            
            return power + (attackParts * 10) + (rangedParts * 8) + (healParts * 6) + (workParts * 5);
        }, 0);
    },

    /**
     * Υπολογισμός αμυντικής δύναμης
     */
    calculateDefensePower: function(room, towers) {
        let power = 0;
        
        // Δύναμη από towers
        power += towers.length * 20;
        
        // Δύναμη από υπάρχοντα στρατιωτικά creeps
        const militaryCreeps = room.find(FIND_MY_CREEPS, {
            filter: creep => creep.memory.role && creep.memory.role.includes('military')
        });
        
        militaryCreeps.forEach(creep => {
            const attackParts = creep.getActiveBodyparts(ATTACK);
            const rangedParts = creep.getActiveBodyparts(RANGED_ATTACK);
            power += (attackParts * 5) + (rangedParts * 4);
        });
        
        return power;
    },

    /**
     * ΚΡΙΣΙΜΗ ΑΠΟΚΡΙΣΗ: Δημιουργία έκτακτων μονάδων
     */
    emergencyResponse: function(room) {
        console.log(`🚨 CRITICAL DEFENSE in ${room.name}! Emergency military production!`);
        
        const spawns = room.find(FIND_MY_SPAWNS);
        const availableSpawns = spawns.filter(spawn => !spawn.spawning);
        
        if (availableSpawns.length === 0) return;

        // Έκτακτη δημιουργία γρήγορων επιθετικών μονάδων
        for (const spawn of availableSpawns) {
            const energyAvailable = room.energyAvailable;
            
            if (energyAvailable >= 130) {
                this.createEmergencyUnit(spawn, energyAvailable);
            }
        }
    },

    /**
     * Δημιουργία έκτακτης μονάδας
     */
    createEmergencyUnit: function(spawn, energy) {
        let body = [];
        
        if (energy >= 770) {
            body = [TOUGH,TOUGH,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK]; // 770 energy
        } else if (energy >= 280) {
            body = [TOUGH,MOVE,ATTACK,RANGED_ATTACK]; // 290 energy
        } else {
            body = [MOVE, ATTACK]; // 130 energy - ελάχιστη μονάδα
        }
        
        const name = `EmergencyGuard_${Game.time}`;
        const result = spawn.spawnCreep(body, name, {
            memory: {
                role: 'military_guard',
                homeRoom: spawn.room.name,
                mission: 'defend',
                emergency: true
            }
        });
        
        if (result === OK) {
            console.log(`🆘 Spawning EMERGENCY guard in ${spawn.room.name}`);
        }
    },

    /**
     * ΑΠΟΚΡΙΣΗ ΥΨΗΛΟΥ ΣΗΜΑΤΟΣ
     */
    highAlertResponse: function(room) {
        const existingMilitary = room.find(FIND_MY_CREEPS, {
            filter: creep => creep.memory.role && creep.memory.role.includes('military')
        }).length;

        // Δημιουργία μονάδων αν χρειάζεται
        if (existingMilitary < 3) {
            this.createBalancedSquad(room);
        }
        
        // Διαχείριση υπαρχόντων μονάδων
        this.manageMilitaryCreeps(room);
    },

    /**
     * Δημιουργία ισορροπημένης ομάδας
     */
    createBalancedSquad: function(room) {
        const spawns = room.find(FIND_MY_SPAWNS);
        const availableSpawns = spawns.filter(spawn => !spawn.spawning);
        
        if (availableSpawns.length === 0) return;

        const militaryCount = room.find(FIND_MY_CREEPS, {
            filter: creep => creep.memory.role && creep.memory.role.includes('military')
        }).length;

        // Ανάλογα με τις ανάγκες, δημιουργία διαφορετικών τύπων
        if (militaryCount === 0) {
            // Πρώτη μονάδα - guard
            this.createGuard(availableSpawns[0]);
        } else if (militaryCount === 1) {
            // Δεύτερη μονάδα - ranged attacker
            this.createRangedAttacker(availableSpawns[0]);
        } else {
            // Επιπλέον μονάδες - guards
            this.createGuard(availableSpawns[0]);
        }
    },

    /**
     * Δημιουργία Guard
     */
    createGuard: function(spawn) {
        const body = [TOUGH, MOVE, ATTACK, ATTACK]; // 280 energy
        const name = `Guard_${Game.time}`;
        
        spawn.spawnCreep(body, name, {
            memory: {
                role: 'military_guard',
                homeRoom: spawn.room.name,
                mission: 'defend'
            }
        });
    },

    /**
     * Δημιουργία Ranged Attacker
     */
    createRangedAttacker: function(spawn) {
        const body = [MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK]; // 300 energy
        const name = `Ranger_${Game.time}`;
        
        spawn.spawnCreep(body, name, {
            memory: {
                role: 'military_ranger', 
                homeRoom: spawn.room.name,
                mission: 'defend'
            }
        });
    },

    /**
     * ΑΠΟΚΡΙΣΗ ΧΑΜΗΛΟΥ ΣΗΜΑΤΟΣ
     */
    lowAlertResponse: function(room) {
        // Μόνο παρακολούθηση - δημιουργία μονάδων μόνο αν υπάρχει πλεόνασμα energy
        const energyStatus = room.energyAvailable / room.energyCapacityAvailable;
        
        if (energyStatus > 0.8) { // 80%+ energy capacity
            const existingMilitary = room.find(FIND_MY_CREEPS, {
                filter: creep => creep.memory.role && creep.memory.role.includes('military')
            }).length;
            
            if (existingMilitary < 2) {
                this.createScout(room);
            }
        }
        
        this.manageMilitaryCreeps(room);
    },

    /**
     * Δημιουργία Scout (φθηνή μονάδα παρακολούθησης)
     */
    createScout: function(room) {
        const spawns = room.find(FIND_MY_SPAWNS, {
            filter: spawn => !spawn.spawning
        });
        
        if (spawns.length === 0) return;
        
        const body = [MOVE, ATTACK]; // 130 energy
        const name = `Scout_${Game.time}`;
        
        spawns[0].spawnCreep(body, name, {
            memory: {
                role: 'military_scout',
                homeRoom: room.name,
                mission: 'patrol'
            }
        });
    },

    /**
     * ΔΙΑΧΕΙΡΙΣΗ ΣΤΡΑΤΙΩΤΙΚΩΝ CREEPS
     */
    manageMilitaryCreeps: function(room) {
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        const militaryCreeps = room.find(FIND_MY_CREEPS, {
            filter: creep => creep.memory.role && creep.memory.role.includes('military')
        });

        for (const creep of militaryCreeps) {
            // Απομόνωση ανά τύπο
            switch (creep.memory.role) {
                case 'military_guard':
                    this.runGuard(creep, hostiles);
                    break;
                case 'military_ranger':
                    this.runRanger(creep, hostiles);
                    break;
                case 'military_scout':
                    this.runScout(creep, hostiles);
                    break;
            }
            
            // Αποσύνθεση έκτακτων μονάδων όταν δεν χρειάζονται
            if (creep.memory.emergency && hostiles.length === 0) {
                if (creep.ticksToLive < 100) {
                    this.recycleCreep(creep);
                }
            }
        }
    },

    /**
     * Συμπεριφορά Guard
     */
    // ... (Στο militaryController)

/**
 * Συμπεριφορά Guard (Διορθωμένη για ATTACK - melee)
 */
runGuard: function(creep, hostiles) {
    if (hostiles.length > 0) {
        const target = creep.pos.findClosestByRange(hostiles);

        // Χρησιμοποιούμε attack() για τα melee μέρη
        if (creep.attack(target) === ERR_NOT_IN_RANGE) {
            // Κινείται μόνο αν δεν είναι δίπλα στον στόχο
            creep.moveTo(target, {visualizePathStyle: {stroke: '#ff0000'}});
        }
    } else {
        // Patrol mode
        this.patrol(creep);
    }
},

    /**
     * Συμπεριφορά Ranger
     */
   // ... (Στο militaryController)

/**
 * Συμπεριφορά Ranger (Διορθωμένη για RANGED_ATTACK)
 */
runRanger: function(creep, hostiles) {
    if (hostiles.length > 0) {
        const target = creep.pos.findClosestByRange(hostiles);
        const range = creep.pos.getRangeTo(target);

        // Πρώτα επιτίθεται (η επίθεση λειτουργεί σε range <= 3)
        creep.rangedAttack(target);

        if (range > 3) {
            // Κινείται προς τον στόχο αν είναι εκτός εμβέλειας
            creep.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}});
        } else if (range < 3 && hostiles.length > 1) {
             // Ελαφριά υποχώρηση για να διατηρηθεί η εμβέλεια ή για AoE
             const retreatDir = creep.pos.getDirectionTo(target) + 4;
             creep.move(retreatDir % 8);
        }
        // Αν range === 3, απλά μένει ακίνητος και επιτίθεται
    } else {
        this.patrol(creep);
    }
},

    /**
     * Συμπεριφορά Scout
     */
    runScout: function(creep, hostiles) {
        if (hostiles.length > 0) {
            // Κράτα απόσταση και επιτέθου από μακριά
            const target = creep.pos.findClosestByRange(hostiles);
            if (creep.pos.getRangeTo(target) > 3) {
                creep.moveTo(target, {visualizePathStyle: {stroke: '#00ff00'}});
            } else {
                creep.rangedAttack(target);
                // Κράτα απόσταση
                const retreatDir = creep.pos.getDirectionTo(target) + 4;
                creep.move(retreatDir % 8);
            }
        } else {
            this.patrol(creep);
        }
    },

    /**
     * Patrol λειτουργία
     */
    patrol: function(creep) {
        const room = creep.room;
        
        // Patrol σε σημαντικά σημεία
        const patrolPoints = [
            room.controller.pos,
            ...room.find(FIND_MY_SPAWNS).map(s => s.pos),
            ...room.find(FIND_MY_STRUCTURES, {
                filter: s => [STRUCTURE_STORAGE, STRUCTURE_TERMINAL].includes(s.structureType)
            }).map(s => s.pos)
        ].filter(Boolean);

        if (patrolPoints.length === 0) return;

        const currentTarget = creep.memory.patrolTarget || 0;
        const targetPos = patrolPoints[currentTarget];

        if (creep.pos.isNearTo(targetPos)) {
            // Επόμενο patrol point
            creep.memory.patrolTarget = (currentTarget + 1) % patrolPoints.length;
        } else {
            creep.moveTo(targetPos, {visualizePathStyle: {stroke: '#ffffff'}});
        }
    },

    /**
     * Ανακύκλωση creep
     */
    recycleCreep: function(creep) {
        creep.memory.role="to_be_recycled";
        
        // const spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS);
        
        // if (spawn && creep.pos.isNearTo(spawn)) {
        //     spawn.recycleCreep(creep);
        // } else if (spawn) {
        //     creep.moveTo(spawn);
        // }
    },

    /**
     * ΠΕΡΙΟΔΟΣ ΕΙΡΗΝΗΣ
     */
    peaceTimeMaintenance: function(room) {
        const militaryCreeps = room.find(FIND_MY_CREEPS, {
            filter: creep => creep.memory.role && creep.memory.role.includes('military')
        });

        // Ανακύκλωση παλιών στρατιωτικών creeps για εξοικονόμηση energy
        for (const creep of militaryCreeps) {
            if (creep.ticksToLive < 200 && !creep.memory.emergency) {
                this.recycleCreep(creep);
            }
        }
    }
};

module.exports = militaryController;