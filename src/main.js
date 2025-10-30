
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var respawManager = require('respawController');
var towerMonitor = require('towerController');
var roomPlanner = require('RoomPlanner');
var roleHarvester = require("role.harvester");
var staticBuilder = require("role.staticBuilder");
var staticUpgrader = require("role.staticUpgrader");
var staticHauler = require("role.Hauler");


module.exports.loop = function() {


	// 1. Έλεγχος και αρχικοποίηση Memory.rooms (αν λείπει)
	if (!Memory.rooms) {
		Memory.rooms = {};
		console.log("Memory.rooms αρχικοποιήθηκε.");
	}

	// 2. Επανάληψη σε όλα τα Δωμάτια που ελέγχουμε
	for (const roomName in Game.rooms) {
		// Εδώ το roomName θα είναι 'E25S7' (και όποιο άλλο δωμάτιο ελέγχετε)

		// Αρχικοποίηση Memory για το συγκεκριμένο δωμάτιο (Αν δεν γίνει ήδη στον Planner)
		if (!Memory.rooms[roomName]) {
			Memory.rooms[roomName] = {};
		}
		if (Game.time % 100 != 0) {
			// 1. Εξοικονόμηση CPU: Τρέχουμε τον planner μόνο κάθε 100 ticks.
			const roomController = Game.rooms[roomName].controller;
			if (roomController) {
				Memory.rooms[roomName].controllerlevel = roomController.level;
				Memory.rooms[roomName].constructionLevel = 1;
			} else {
				Memory.rooms[roomName].controllerLevel = -1;
				Memory.rooms[roomName].constructionLevel = -1;
			}
		}

		// 3. Εκτέλεση Λογικής Δωματίου
		towerMonitor.run(roomName);
		roomPlanner.run(roomName);
		respawManager.run(roomName);
		const creeps = Game.rooms[roomName].find(FIND_MY_CREEPS);
		for (var creep in Game.creeps) {
			runCreep(creep);
		}

	}


}; // end of loop
runCreep = function(creepName) {
	const creep=Game.creeps[creepName];
	if (creep.memory.role == 'harvester') {
		roleHarvester.run(creep);
	} else if (creep.memory.role === 'upgrader') {
		roleUpgrader.run(creep);
	} else if (creep.memory.role === 'builder') {
		roleBuilder.run(creep);
	} else if (creep.memory.role === "staticBuilder") {
		staticBuilder.run(creep);
	} else if (creep.memory.role === "staticUpgrader") {
		staticUpgrader.run(creep);
	} else if (creep.memory.role === "staticHauler") {
		staticHauler.run(creep);
	}
} ; // end of runCreep