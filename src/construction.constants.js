/**
 * Construction Constants & Configuration
 * Shared across different layout managers.
 * Version 1.0.1
 */

module.exports = {
	
	MAX_CONSTRUCTION_SITE:2,
    // Προτεραιότητες κατασκευής (Υψηλότερο = Πιο σημαντικό)
    PRIORITIES: {
        SPAWN: 130,
        TOWER: 120,
        EXTENSION: 110,
        STORAGE: 100,
        CONTAINER: 110,
        TERMINAL: 80,
        LINK: 70,
        LAB: 60,
        FACTORY: 50,
        POWER_SPAWN: 40,
        NUKER: 30,
        OBSERVER: 20,
        ROAD: 10,
        RAMPART: 1,
        CONSTRUCTEDWALL: 3
    },

    // Επίπεδα RCL ανά ποσότητα κτιρίων
    STRUCTURE_RCL_STEPS: {
        'spawn': [1, 7, 8],
        'tower': [3, 5, 7, 8, 8, 8],
        'extension': { 1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60 },
        'link': [5, 5, 6, 7, 8, 8],
        'lab': [6, 6, 6, 7, 7, 8, 8, 8, 8, 8],
        'container': { 3: 4, 4: 5 },
    },
	
    // Προεπιλεγμένα RCL ξεκλειδώματος αν δεν ορίζεται στα steps
    DEFAULTS_RCL: { 
        road: 3, 
        container: 1, 
        spawn: 1, 
        extension: 2, 
        rampart: 4, 
        constructedWall: 4, 
        tower: 3, 
        storage: 4, 
        link: 5 ,
        terminal:6,
        extractor:6,
        factory:7
    },
	MEMORY_KEYS: {
		ROOT: 'construction',
        STRUCTURES: 'builtStructures',
        RECOVERY: 'recoveryContainerId',
        CONTROLLER: 'controllerContainerId',
        ROAD_PLAN: 'roadPlannerData',
		BLUE_PRINT: 'blueprint'
    } // end of MEMORY_KEYS
	
};