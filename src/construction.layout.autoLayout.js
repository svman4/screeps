/*
    CHANGELOG:
    version 1.2.0
    - [FIX] Αφαίρεση του λάθους `return {};` που μπλόκαρε την επιστροφή δεδομένων.
    - [FEATURE] Προσθήκη μηχανισμού `occupied` (Set) για αποφυγή επικάλυψης (overlapping) κτιρίων.
    - [REFACTOR] Το planRoads πλέον χρησιμοποιεί PathFinder για πραγματικά μονοπάτια, παρακάμπτοντας τους τοίχους.
    - [REFACTOR] Πλήρης ενεργοποίηση όλων των structures (Towers, Extensions, Spawns, Links, Containers).
*/

const BaseLayout = require('construction.layout.BaseLayout');
const { MEMORY_KEYS } = require('construction.constants');

// Αν το RoomAnalyzer δεν υπάρχει, βάλε ένα fallback για το distance matrix (γεμίζει 1)
const RoomAnalyzer = require('construction.RoomAnalyzer'); 

/**
 * AUTO LAYOUT CLASS
 * Δημιουργεί αυτόματα ένα optimized layout χωρίς εξάρτηση από αρχεία blueprint.
 * Συνδυάζει room geometry, sources, και controller position για να δημιουργήσει
 * ένα functional layout που μεγιστοποιεί την αποδοτικότητα.
 */
class AutoLayout extends BaseLayout {
    constructor(roomName) {
        super(roomName);
        this.room = Game.rooms[roomName];
        this.init();
    }

    /**
     * Φόρτωση δεδομένων: Συγκέντρωση στοιχείων από το room και geometric analysis.
     */
    loadRawData() {
        if (!this.room) {
            console.log(`[AutoLayout] Room ${this.roomName} is not visible. Cannot auto-plan.`);
            return null;
        }
		const sources = this.room.find(FIND_SOURCES);
        const controller = this.room.controller;
        const exits = this.room.find(FIND_EXIT);

        if (!controller) {
            console.log(`[AutoLayout] No controller in room ${this.roomName}.`);
            return null;
        }
        
        let distanceMatrix = null;
        if (RoomAnalyzer && typeof RoomAnalyzer.getDistanceTransform === 'function') {
            distanceMatrix = RoomAnalyzer.getDistanceTransform(this.roomName);
        }
        
        const center = this.findOptimalCenter(sources, controller, distanceMatrix);
        const storage = [center]; // Το storage πάει ακριβώς στο center

        // Σύστημα αποφυγής επικάλυψης. Κρατάμε τα coordinates ως 'x,y'
        const occupied = new Set();
        occupied.add(`${center.x},${center.y}`);
		// add structures for every source
		// Βρίσκει ΟΛΑ τα δικά σας κτίρια στο δωμάτιο (Spawns, Extensions, Towers κλπ)
const existingStructures = this.room.find(FIND_MY_STRUCTURES);

existingStructures.forEach(structure => {
    // Αγνοούμε τους δρόμους και τα ramparts, καθώς μπορούμε να "πατήσουμε" πάνω τους
    if (structure.structureType !== STRUCTURE_ROAD && structure.structureType !== STRUCTURE_RAMPART) {
        occupied.add(`${structure.pos.x},${structure.pos.y}`);
    }
});
		
		
		
		const roads=[];
		const containers=[];
		const links =[];
		const terminal=[];
		const towers =[];
		sources.forEach(
			source => {
				// Υπολογισμός του μονοπατιού από το κέντρο (π.χ. storage) προς την πηγή
				const path = this.room.findPath(
					new RoomPosition(center.x, center.y, this.room.name), 
					source.pos, 
					{
						ignoreCreeps: true, // Αγνοεί τα creeps
						range: 1           // Σταματάει 1 τετράγωνο πριν
					}
				);
				
				// Χτίζουμε δρόμους για όλα τα βήματα ΕΚΤΟΣ από το τελευταίο
				for (let i = 0; i < path.length - 1; i++) {
					roads.push({x:path[i].x,y:path[i].y});
					//occupied.add({x:path[i].x,y:path[i].y});
					occupied.add(`${path[i].x},${path[i].y}`);
				}

				// Το τελευταίο βήμα είναι αυτό που βρίσκεται ακριβώς δίπλα στο source
				// Εδώ θα χτίσουμε το container
				const lastStep = path[path.length - 1];
				if(!lastStep)
					return;
				containers.push({x:lastStep.x,y:lastStep.y});
				occupied.add(`${lastStep.x},${lastStep.y}`);
					
				// Χτίζουμε το Link
				
				let linkPlaced = false;
				for (let dx = -1; dx <= 1; dx++) {
					for (let dy = -1; dy <= 1; dy++) {
						const lx = lastStep.x + dx;
						const ly = lastStep.y + dy;
            
						// Ελέγχουμε αν είναι χτίσιμο και δεν είναι ήδη occupied
						if (this.isBuildable(lx, ly, this.room.getTerrain(), occupied)) {
							links.push({ x: lx, y: ly });
							occupied.add(`${lx},${ly}`);
							linkPlaced = true;
							break; // Σταματάμε μόλις βρούμε την πρώτη διαθέσιμη θέση
						}
					}
					if (linkPlaced) break;
				}
				
			}
		);
		if(controller) {
			const path = this.room.findPath(
				new RoomPosition(center.x, center.y, this.room.name), 
					controller.pos, 
					{
						ignoreCreeps: true, // Αγνοεί τα creeps
						range: 2            // Σταματάει 1 τετράγωνο πριν
					}
			);
				
			// Χτίζουμε δρόμους για όλα τα βήματα ΕΚΤΟΣ από το τελευταίο
			for (let i = 0; i < path.length - 1; i++) {
				roads.push({x:path[i].x,y:path[i].y});
				occupied.add(`${path[i].x},${path[i].y}`);
			}
			// Το τελευταίο βήμα είναι αυτό που βρίσκεται ακριβώς δίπλα στο source
			// Εδώ θα χτίσουμε το container
			const lastStep = path[path.length - 1];
			if (lastStep) {
				containers.push({x:lastStep.x,y:lastStep.y});
				occupied.add(`${lastStep.x},${lastStep.y}`);				
			}
			
			let linkPlaced = false;
				for (let dx = -1; dx <= 1; dx++) {
					for (let dy = -1; dy <= 1; dy++) {
						const lx = controller.pos.x + dx;
						const ly = controller.pos.y + dy;
            
						// Ελέγχουμε αν είναι χτίσιμο και δεν είναι ήδη occupied
						if (this.isBuildable(lx, ly, this.room.getTerrain(), occupied)) {
							links.push({ x: lx, y: ly });
							occupied.add(`${lx},${ly}`);
							linkPlaced = true;
							break; // Σταματάμε μόλις βρούμε την πρώτη διαθέσιμη θέση
						}
					}
					if (linkPlaced) break;
				}
				// φροντίζουμε ώστε να μη χτίζονται οι θέσεις γύρω από το controller.
				for (let dx = -2; dx <= 2; dx++) {
					for (let dy = -2; dy <= 2; dy++) {
						const lx = controller.pos.x + dx;
						const ly = controller.pos.y + dy;
            
						// Ελέγχουμε αν είναι χτίσιμο και δεν είναι ήδη occupied
						if (this.isBuildable(lx, ly, this.room.getTerrain(), occupied)) {
							occupied.add(`${lx},${ly}`);
							
						}
					}
					
				}
		}
		
		if(storage) {
			const pos=center;
			let linkPlaced = false;
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					const lx = pos.x + dx;
					const ly = pos.y + dy;
            						// Ελέγχουμε αν είναι χτίσιμο και δεν είναι ήδη occupied
					if (this.isBuildable(lx, ly, this.room.getTerrain(), occupied)) {
						links.push({ x: lx, y: ly });
						occupied.add(`${lx},${ly}`);
						linkPlaced = true;
						break; // Σταματάμε μόλις βρούμε την πρώτη διαθέσιμη θέση
					}
				}
				if (linkPlaced) break;
			}
			let terminalPlaced = false;
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					const lx = pos.x + dx;
					const ly = pos.y + dy;
            						// Ελέγχουμε αν είναι χτίσιμο και δεν είναι ήδη occupied
					if (this.isBuildable(lx, ly, this.room.getTerrain(), occupied)) {
						terminal.push({ x: lx, y: ly });
						occupied.add(`${lx},${ly}`);
						terminalPlaced = true;
						break; // Σταματάμε μόλις βρούμε την πρώτη διαθέσιμη θέση
					}
				}
				if (terminalPlaced) break;
			}
			let towerPlaced = false;
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					const lx = pos.x + dx;
					const ly = pos.y + dy;
            						// Ελέγχουμε αν είναι χτίσιμο και δεν είναι ήδη occupied
					if (this.isBuildable(lx, ly, this.room.getTerrain(), occupied)) {
						towers.push({ x: lx, y: ly });
						occupied.add(`${lx},${ly}`);
						towerPlaced = true;
						break; // Σταματάμε μόλις βρούμε την πρώτη διαθέσιμη θέση
					}
				}
				if (towerPlaced) break;
			}
			
			
		}
		
        
        
        
        const spawns =[];// this.planSpawns(center, occupied) || [];
        
        const [ro,extensions] = this.planExtensionsWithFloodFill(center, this.room,occupied) ||[];//occupied) || [];
        roads.push(...ro);
        // Σχεδιασμός δρόμων στο τέλος (οι δρόμοι μπορούν να πατάνε σε containers/ramparts αλλά τους βάζουμε παντού)
        

        return {
             buildings: {
                 center: [center],
                 spawn: spawns,
                 extension: extensions,
                 tower: towers,
                 storage: storage,
                 link: links,
                 container: containers,
				 terminal:terminal,
                 road: roads
             },
             sources: sources.map(s => ({ x: s.pos.x, y: s.pos.y })),
             controller: { x: controller.pos.x, y: controller.pos.y },
             exits: exits.map(e => ({ x: e.x, y: e.y }))
        };
    }

    /**
     * Βοηθητική μέθοδος για να ελέγχει αν μια θέση είναι ελεύθερη για κτίσιμο
     */
    isBuildable(x, y, terrain, occupied) {
        if (x < 2 || x > 47 || y < 2 || y > 47) return false;
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) return false;
        if (occupied && occupied.has(`${x},${y}`)) return false;
        return true;
    }

    /**
     * Εύρεση κέντρου βάσης
     */
    findOptimalCenter(sources, controller, distanceMatrix) {
        const padding = 6; 

        // Centroid πηγών
        const sourceCentroid = {
            x: Math.round(sources.reduce((sum, s) => sum + s.pos.x, 0) / sources.length),
            y: Math.round(sources.reduce((sum, s) => sum + s.pos.y, 0) / sources.length)
        };

        const controllerPos = controller.pos;
        const idealCenter = {
            x: Math.round((sourceCentroid.x + controllerPos.x * 2) / 3), // Τραβάμε λίγο περισσότερο προς το controller
            y: Math.round((sourceCentroid.y + controllerPos.y * 2) / 3)
        };

        let bestCenter = { x: idealCenter.x, y: idealCenter.y };
        let maxDistanceVal = -1;
        const terrain = this.room.getTerrain();

        // Ψάχνουμε 5x5 γύρω από το ιδανικό
        for (let dx = -5; dx <= 5; dx++) {
            for (let dy = -5; dy <= 5; dy++) {
                const x = idealCenter.x + dx;
                const y = idealCenter.y + dy;

                if (x < padding || x > 49 - padding || y < padding || y > 49 - padding) continue;
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

                const distVal = distanceMatrix ? distanceMatrix[x][y] : 1;
                
                // Αν βρούμε σημείο με περισσότερο ελεύθερο χώρο γύρω του, το προτιμάμε
                if (distVal > maxDistanceVal) {
                    maxDistanceVal = distVal;
                    bestCenter = { x, y };
                }
            }
        }

        return bestCenter;
    }

    
    planSpawns(center, occupied) {
        const spawns = [];
        const terrain = this.room.getTerrain();
        
        // Ιδανικές θέσεις: Πάνω, Κάτω αριστερά, Κάτω δεξιά από το κέντρο (απόσταση 2)
        const offsets = [{dx: 0, dy: -2}, {dx: -2, dy: 2}, {dx: 2, dy: 2}];
        
        for (let offset of offsets) {
            const x = center.x + offset.dx;
            const y = center.y + offset.dy;
            if (this.isBuildable(x, y, terrain, occupied)) {
                spawns.push({ x, y });
                occupied.add(`${x},${y}`);
            }
        }
        return spawns;
    }
	
	planExtensionsWithFloodFill(center, room, occupied) {
		const extensions = [];
		const roads = [];
		const queue = [{ x: center.x, y: center.y }];
		const visited = new Set(occupied); 
		visited.add(`${center.x},${center.y}`);

		while (queue.length > 0 && extensions.length < 120) {
			const current = queue.shift();
	
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					if (dx === 0 && dy === 0) continue;
            
					const pos = { x: current.x + dx, y: current.y + dy };
					const key = `${pos.x},${pos.y}`;
            
					if (!visited.has(key)) {
						visited.add(key);
					
						// Ελέγχουμε ΠΡΩΤΑ αν χτίζεται. Αν όχι, το αγνοούμε εντελώς για να γλιτώσουμε CPU.
						const isBuildable = this.isBuildable(pos.x, pos.y, room.getTerrain(), occupied);
						if (!isBuildable) continue; 
                    
						// Αλλάζουμε τα ονόματα για να αποφύγουμε το shadowing
						const distX = Math.abs(pos.x - center.x);
						const distY = Math.abs(pos.y - center.y);
						const dist = Math.max(distX, distY);

                    
                    const isRoadLane = (((distX+ distY )) % 2 === 0) 
                
                    if (dist >= 2) {
                        if (isRoadLane) {
                            roads.push(pos);
                            occupied.add(key);
                        } else {
                            extensions.push(pos);
                            occupied.add(key);
                        }
                    }
                    
						// Μπαίνει στην ουρά μόνο ΜΙΑ φορά και ΜΟΝΟ αν είναι buildable
						queue.push(pos);
					}
				}
			}
		}
		return [roads, extensions];
	}
}

module.exports = AutoLayout;