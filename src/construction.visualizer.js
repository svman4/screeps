/**
 * CONSTRUCTION VISUALIZER CLASS
 * Αναλαμβάνει την οπτική απεικόνιση των πλάνων κατασκευής και των στατιστικών στο Room.
 * Version 1.0.0
 */

require('RoomVisual'); // Βεβαιώσου ότι έχεις το RoomVisual polyfill αν χρησιμοποιείς εξωτερικά εργαλεία

class ConstructionVisualizer {
    /**
     * @param {string} roomName - Το όνομα του δωματίου
     */
    constructor(roomName) {
        this.roomName = roomName;
        this.visual = new RoomVisual(roomName);
    }

    /**
     * Κεντρική μέθοδος σχεδίασης του blueprint
     * @param {Array} blueprint - Η λίστα με τα structures από το layout
     * @param {Object} builtMap - Cache με τα ήδη χτισμένα κτίρια
     * @param {number} currentRCL - Το τρέχον RCL του δωματίου
     */
    drawBlueprint(blueprint, builtMap, currentRCL) {
        if (!blueprint || !Array.isArray(blueprint)) return;
        
        for (const s of blueprint) {
             // Αν το κτίριο είναι ήδη χτισμένο στη σωστή θέση, δεν το σχεδιάζουμε στο blueprint
             if (builtMap[`${s.x},${s.y}`] === s.type) continue;
                 const isAvailable = s.rcl <= currentRCL;
             const opacity = isAvailable ? 1 : 1;

             if (s.type === 'road') {
                 this.drawRoad(s, opacity);
             } else {
                 this.drawStructure(s, isAvailable, opacity);
             }
         }
        
        this.drawHeader(currentRCL);
        
    }

    /**
 * Σχεδίαση δρόμου με το κανονικό εικονίδιο της roomVisual
 * και χρωματική επισήμανση ανά κατηγορία.
 */
drawRoad(s, opacity) {
    // Σχεδίαση του βασικού δρόμου (texture)
    this.visual.structure(s.x, s.y, 'road', { opacity: opacity });
	//console.log(s.category);
    // Επικάλυψη χρώματος για critical / logistics
    if (s.category === 'critical') {
        this.visual.circle(s.x, s.y, {
            fill: '#ff0000',
            radius: 0.25,
            opacity: opacity * 0.4
        });
    } else if (s.category === 'logistics') {
        this.visual.circle(s.x, s.y, {
            fill: '#00ffff',
            radius: 0.25,
            opacity: opacity * 0.4
        });
    } else {
        // Προαιρετικά: αμυδρό περίγραμμα για infrastructure
        this.visual.circle(s.x, s.y, {
            stroke: '#ffffff',
            radius: 0.10,
            strokeWidth: 0.05,
            opacity: opacity * 0.6
        });
    }
}

    /**
     * Σχεδίαση κτιρίου με το εικονίδιο του Screeps
     */
    drawStructure(s, isAvailable, opacity) {
        // Χρήση του ενσωματωμένου structure visualizer αν υποστηρίζεται ή fallback σε σχήματα
        try {
            this.visual.structure(s.x, s.y, s.type, { opacity: opacity });
        } catch (e) {
            this.visual.rect(s.x - 0.4, s.y - 0.4, 0.8, 0.8, { 
                fill: 'transparent', 
                stroke: isAvailable ? '#00ff00' : '#ffffff', 
                lineStyle: 'dashed',
                opacity: opacity 
            });
        }
        
        this.drawStructureBadge(s.x, s.y, s.rcl, isAvailable, opacity);
    }

    /**
     * Σχεδίαση του επιπέδου RCL πάνω από το κτίριο
     */
    drawStructureBadge(x, y, rcl, isAvailable, opacity) {
        const rclColor = isAvailable ? '#00ff00' : '#ff4444';
        const labelY = x % 2 === 0 ? y - 0.6 : y + 0.8;

        // Background box για το RCL label
        this.visual.rect(x - 0.3, labelY - 0.2, 0.6, 0.3, {
            fill: '#000000',
            opacity: opacity * 1.5,
            stroke: rclColor,
            strokeWidth: 0.05
        });

        // Κείμενο RCL
        this.visual.text(`R${rcl}`, x, labelY + 0.05, {
            color: rclColor,
            font: 0.2,
            opacity: opacity * 2,
            align: 'center'
        });
    }

    /**
     * Σχεδίαση πληροφοριών στην πάνω αριστερή γωνία
     */
    drawHeader(currentRCL) {
        const x = 0.5;
        let y = 0.5;

        this.visual.text(`🏗️ Construction Manager - RCL ${currentRCL}`, x, y, {
            align: 'left',
            color: '#ffcc00',
            font: 0.7,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backgroundPadding: 0.2
        });
    }

    /**
     * Highlights special containers (Recovery, Controller etc)
     */
    drawSpecialFocus(pos, label, color = '#ff00ff') {
        if (!pos) return;
        this.visual.circle(pos.x, pos.y, {
            fill: 'transparent',
            radius: 0.5,
            stroke: color,
            strokeWidth: 0.1,
            lineStyle: 'dashed'
        });
        this.visual.text(label, pos.x, pos.y - 0.7, {
            color: color,
            font: 0.4,
            stroke: '#000000',
            strokeWidth: 0.05
        });
    }
}

module.exports = ConstructionVisualizer;