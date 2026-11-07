// Ορισμός της δομής ενός στοιχείου στο blueprint
export interface BlueprintStructure {
    x: number;
    y: number;
    type: string;
    rcl: number;
    category?: 'critical' | 'logistics' | 'industrial' | string;
}

// Ορισμός θέσης για ειδικά focus
export interface Position {
    x: number;
    y: number;
}