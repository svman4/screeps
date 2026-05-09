import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/main.js', // Το αρχείο που μου ανέβασες
  output: {
    file: 'dist/main.js', // Εκεί θα βγει το "θηρίο"
    format: 'cjs',        // Το Screeps θέλει CommonJS
    exports: 'named'
  },
  plugins: [
    resolve({
      preferBuiltins: false,
      browser: false,
	  moduleDirectories: ['node_modules', 'src']
    }),
    commonjs() // Αυτό θα πάρει τα require('manager.spawn') και θα βάλει τον κώδικά τους εδώ
  ]
};