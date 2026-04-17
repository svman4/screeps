/**
 * BASE LAYOUT CLASS
 * Ορίζει τη δομή ενός πλάνου. Μπορεί να επεκταθεί για Auto-Planner στο μέλλον.
 */
class BaseLayout {
    constructor() {
        this.blueprint = [];
    }

    /**
     * Επιστρέφει το επόμενο κτίριο προς κατασκευή βάσει RCL και προτεραιότητας.
     */
    getPlanForRCL(rcl, builtMap) {
        return this.blueprint.filter(s => s.rcl <= rcl && !builtMap[`${s.x},${s.y}`]);
    }
}
module.exports = BaseLayout;