/**
 * MODULE: Body Factory
 * ΠΕΡΙΓΡΑΦΗ: Υπεύθυνο αποκλειστικά για τον υπολογισμό και τον σχεδιασμό των σωμάτων των Creeps.
 *	Version 1.0.0
 */

const { ROLES } = require('spawn.constants');

class BodyFactory {
    /**
     * Επιστρέφει το βέλτιστο σώμα για έναν ρόλο βάσει της διαθέσιμης ενέργειας.
     */
    static getBody(role, maxEnergy) {
        switch (role) {
            case ROLES.STATIC_HARVESTER:
                return this.buildStaticHarvester(maxEnergy);
            case ROLES.HAULER:
                return this.buildPatternWorker(maxEnergy, [CARRY, CARRY, MOVE], 150, 20);
            case ROLES.UPGRADER:
            case ROLES.BUILDER:
                return this.buildPatternWorker(maxEnergy, [WORK, CARRY, MOVE, MOVE], 250, 15);
            default:
                return [WORK, CARRY, MOVE];
        }
    }

    static buildStaticHarvester(maxEnergy) {
        let body = [MOVE, WORK, WORK];
        let workParts = 2;
        // Max 6 WORK parts για βέλτιστο harvesting σε πηγές των 3000
        while (this.calculateCost(body) + 100 <= maxEnergy && workParts < 6) {
            body.push(WORK);
            workParts++;
        }
        return body;
    }

    static buildPatternWorker(maxEnergy, pattern, patternCost, maxPatterns) {
        let body = [];
        let count = 0;
        while (this.calculateCost(body) + patternCost <= maxEnergy && count < maxPatterns) {
            body = body.concat(pattern);
            count++;
        }
        return body;
    }

    static calculateCost(body) {
        return _.sum(body, part => BODYPART_COST[part]);
    }
}

module.exports = BodyFactory;