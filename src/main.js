const defenseManager = require('manager.defense');
const spawnManager = require('manager.spawn');
const logisticsManager = require('manager.logistics');
const constructionManager = require('manager.construction');
const expansionManager = require('manager.expansion');
const roleManager = require('manager.role');

module.exports.loop = function () {

    // 1. Memory Cleanup: Clear memory of dead creeps
    for (const name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
            // console.log('Clearing non-existing creep memory:', name); // Optional: uncomment for debugging
        }
    }

    // 2. Run Managers in order of priority
    // HIGHEST PRIORITY: Defense
    defenseManager.run();

    // HIGH PRIORITY: Spawning
    spawnManager.run();

    // MEDIUM PRIORITY: Logistics and Construction
    logisticsManager.run();
    constructionManager.run();

    // CPU BUCKET CHECK: Skip low-priority tasks if CPU is low
    if (Game.cpu.bucket > 5000) {
        // LOW PRIORITY: Expansion
        expansionManager.run();
    }

    // 3. Run Creep Roles
    // The roleManager will iterate through all creeps and run their specific logic
    roleManager.run();

    // Optional: CPU Usage stats
    if (Game.time % 10 === 0) {
        console.log(`CPU Bucket: ${Game.cpu.bucket} | Creeps: ${Object.keys(Game.creeps).length}`);
    }
};
