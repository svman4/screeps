/*
    CHANGELOG:
    version 1.0.0
    - Αρχική υλοποίηση της κλάσης Scorer.
    - Απόσπαση της λογικής preprocessing και scoring από την FileLayout για καλύτερο decoupling.
    - Υποστήριξη υπολογισμού RCL και δυναμικής ιεράρχησης κτιρίων και δρόμων.
*/

const { PRIORITIES, STRUCTURE_RCL_STEPS } = require('construction.constants');
const RoadPlanner = require('construction.roadPlanner');

class Scorer {
    /**
     * Μετατρέπει raw δεδομένα σε επεξεργασμένη λίστα blueprint με scores.
     */
    static process(rawData, roomName) {
        const center = rawData.buildings.center || { x: 25, y: 25 };
        const DISTANCE_FACTOR = 0.1;
        const buildingEntries = [];
		this.processContainers();
		this.processExtensions();
		this.processRoads(); 
		this.processStructures();
        // 1. Επεξεργασία κτιρίων (εκτός δρόμων)
        for (const [type, positions] of Object.entries(rawData.buildings)) {
            if (type === 'center' || type === 'road' ) continue;

            const sortedPositions = [...positions].sort((a, b) => {
                const distA = Math.abs(a.x - center.x) + Math.abs(a.y - center.y);
                const distB = Math.abs(b.x - center.x) + Math.abs(b.y - center.y);
                return distA - distB;
            });

            sortedPositions.forEach((pos, index) => {
                const distance = Math.abs(pos.x - center.x) + Math.abs(pos.y - center.y);
                buildingEntries.push({
                    type: type,
                    x: pos.x,
                    y: pos.y,
                    rcl: this.calculateRCLRequirement(type, index),
                    score: (PRIORITIES[type.toUpperCase()] || 0) - (distance * DISTANCE_FACTOR)
                });
            });
        }

        // 2. Επεξεργασία δρόμων
        const roadPositions = rawData.buildings.road || [];
        const roadEntries = roadPositions.map(pos => {
            const roadMeta = RoadPlanner.getRoadMetadata(pos.x, pos.y, rawData, buildingEntries, roomName);
            const distance = Math.abs(pos.x - center.x) + Math.abs(pos.y - center.y);
            
            return {
                type: 'road',
                x: pos.x,
                y: pos.y,
                rcl: roadMeta.rcl,
                category: roadMeta.category,
                score: (PRIORITIES.ROAD || 0) + roadMeta.bonus - (distance * DISTANCE_FACTOR)
            };
        });

        const finalBlueprint = [...buildingEntries, ...roadEntries];
        finalBlueprint.sort((a, b) => b.score - a.score);

        return finalBlueprint;
    } 
	static processContainers() {
		//TODO να βάζει τα containers δίπλα στη πηγή να χτίζονται στο επίπεδο 2.
		//TODO ΤΟ container που βρίσκεται δίπλα στο controller(λιγότερο από 4 tile μακριά) επίσης στο επίπεδο 2, με μικρότερο score από αυτά των source.
		//TODO το container του recovery (Near spawn ) να χτίζεται στο rcl=5.
		
		
	}
	static processExtensions() {
		//TODO να υπολογίζει το score στα extension. 
		//Τόσο σε ποιο rcl Θα χτιστεί, όσο και το score. Όσο πιο κοντά στο κέντρο, τόσο πιο γρήγορα.
	}
	static processRoads(){ 
		/* Θέλω να κάνει το εξής.
		Σε πρώτη προτεραιότητα(μετά τα κτίρια) να χτίζεται το Path από τις sources προς το κέντρο και σίγουρα μετά ή στο rcl2.
		
		Αμέσως μετά να χτίζει το path από το Κέντρο προς το controller.
		
		Για όσα road structures η τιμή δεν έχει υπολογισθεί ακόμα να χτίζεται στο rcl που θα χτιστούν extension ή άλλα κτίρια.
		*/
	}
			
	static processStructures() {
		// Να υπολογίζει το rcl και το score όλων των structures Που δεν έχουν ακόμα rcl ή σ
	}
			

    /**
     * Βοηθητική μέθοδος για τον υπολογισμό του απαιτούμενου RCL.
     */
    static calculateRCLRequirement(type, index) {
        const steps = STRUCTURE_RCL_STEPS[type];
        if (steps) {
            if (Array.isArray(steps)) return steps[index] || steps[steps.length - 1];
            if (typeof steps === 'object') {
                for (let rcl = 1; rcl <= 8; rcl++) {
                    if (index < steps[rcl]) return rcl;
                }
            }
        }
        return 8; 
    }
}

module.exports = Scorer;