/**
 * Σταθερές και ρυθμίσεις για το σύστημα παραγωγής Creeps.
 */

 
 
const ROLES = {
    STATIC_HARVESTER: 'staticHarvester',
    SIMPLE_HARVESTER: 'simpleHarvester',
    HAULER: 'hauler',
    UPGRADER: 'upgrader',
    BUILDER: 'builder',
    LD_HARVESTER: 'LDHarvester',
    LD_HAULER: 'LDHauler',
    CLAIMER: 'claimer',
    SCOUT: 'scout',
    SUPPORTER: 'supporter',
    MINER: 'miner',
    DEFAULT: 'default'
};

const BODY_ENERGY_LIMITS = {
    [ROLES.STATIC_HARVESTER]: 800,
    [ROLES.HAULER]: 1000,
    [ROLES.UPGRADER]: 1000,
    [ROLES.BUILDER]: 1000,
    [ROLES.SIMPLE_HARVESTER]: 800,
    [ROLES.DEFAULT]: 800
};

const PRIORITY = {
    [ROLES.SIMPLE_HARVESTER]: 10,
    [ROLES.STATIC_HARVESTER]: 15,
    [ROLES.HAULER]: 20,
    [ROLES.MINER]: 25,
    [ROLES.LD_HARVESTER]: 35,
    [ROLES.LD_HAULER]: 40,
    [ROLES.CLAIMER]: 45,
    [ROLES.UPGRADER]: 60,
    [ROLES.BUILDER]: 70,
    [ROLES.SUPPORTER]: 80,
    [ROLES.SCOUT]: 100
};
const NEED_REPLACEMENT_FLAG="needReplacementFlag";

module.exports = {NEED_REPLACEMENT_FLAG,
    ROLES,
    BODY_ENERGY_LIMITS,
    PRIORITY
};