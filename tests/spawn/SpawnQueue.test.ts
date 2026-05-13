import SpawnQueue from '../../src/spawn/SpawnQueue';
import { ROLES } from '../../src/spawn/spawn.constants';

// Mock του Global Game αντικειμένου του Screeps
global.Game = {
   time: 1000
} as any;

describe('SpawnQueue Module', () => {
   let queue: SpawnQueue;

   beforeEach(() => {
      // Δημιουργία φρέσκιας ουράς πριν από κάθε test
      queue = new SpawnQueue();
      global.Game.time = 1000;
   });

   test('should add a unique request to the queue', () => {
      const request = {
         role: ROLES.HAULER,
         priority: 50,
         homeRoom: 'W1N1'
      };

      const added = queue.add(request);

      expect(added).toBe(true);
      expect(queue.length).toBe(1);
      expect(queue.getAt(0).role).toBe(ROLES.HAULER);
   });

   test('should NOT add a duplicate request', () => {
      const request = {
         role: ROLES.HAULER,
         priority: 50,
         homeRoom: 'W1N1'
      };

      queue.add(request);
      const addedAgain = queue.add(request);

      expect(addedAgain).toBe(false);
      expect(queue.length).toBe(1);
   });

   test('should sort requests by priority (lower number first)', () => {
      queue.add({ role: ROLES.BUILDER, priority: 70, homeRoom: 'W1N1' }); // Χαμηλή προτεραιότητα
      queue.add({ role: ROLES.HAULER, priority: 30, homeRoom: 'W1N1' });  // Υψηλή προτεραιότητα

      queue.sort();

      expect(queue.getAt(0).role).toBe(ROLES.HAULER);
      expect(queue.getAt(1).role).toBe(ROLES.BUILDER);
   });

   test('should sort by age (addedAt) if priorities are equal', () => {
      global.Game.time = 1000;
      queue.add({ role: ROLES.UPGRADER, priority: 60, homeRoom: 'W1N1' });

      global.Game.time = 1010; // Το δεύτερο αίτημα μπαίνει αργότερα
      queue.add({ role: ROLES.BUILDER, priority: 60, homeRoom: 'W1N1' });

      queue.sort();

      // Το Upgrader πρέπει να είναι πρώτο γιατί μπήκε στο tick 1000
      expect(queue.getAt(0).role).toBe(ROLES.UPGRADER);
   });

   test('flush() should empty the queue', () => {
      queue.add({ role: ROLES.HAULER, priority: 30, homeRoom: 'W1N1' });
      queue.flush();
      expect(queue.length).toBe(0);
   });

   test('should remove stale requests after 500 ticks', () => {
      // Προσθέτουμε ένα αίτημα στο tick 1000
      global.Game.time = 1000;
      queue.add({ role: ROLES.HAULER, priority: 30, homeRoom: 'W1N1' });

      // Προχωράμε το χρόνο στο 1600 (διαφορά > 500)
      global.Game.time = 1600;

      // Η μέθοδος _cleanStaleRequests καλείται μόνο κάθε 100 ticks (στο Game.time % 100 === 0)
      // Στον constructor καλείται πάντα η _cleanStaleRequests, αλλά για να το δούμε 
      // σε δράση πρέπει να την καλέσουμε manually ή να φτιάξουμε νέο instance

      // @ts-ignore - Πρόσβαση σε private method για το test
      queue._cleanStaleRequests();

      expect(queue.length).toBe(0);
   });
});