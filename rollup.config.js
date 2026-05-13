import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  // Το σημείο εισόδου της εφαρμογής σου
  input: 'src/main.ts',
  onwarn: (warning, warn) => {
    // Αν το Rollup δεν μπορεί να βρει ένα module (Unresolved Import)
    console.log('--- DEBUG WARNING START ---');
    console.log(warning);
    console.log('--- DEBUG WARNING END ---');
    if (warning.code === 'UNRESOLVED_IMPORT') {
      throw new Error(
        `ΣΦΑΛΜΑ: Το module "${warning.source}" δεν βρέθηκε! \n` +
        `Βεβαιώσου ότι το path είναι σωστό (π.χ. "./constants" αντί για "constants")`
      );
    }
    warn(warning);
  },
  output: {
    file: 'dist/main.js',
    format: 'cjs',
    sourcemap: false,
    exports: 'named'
  },

  external: ["lodash"],
  plugins: [
    // Επίλυση εξαρτήσεων από το node_modules
    resolve({ rootDir: 'src', preferBuiltins: false }),
    // Μετατροπή CommonJS (require) σε ES6
    commonjs(),
    // Μεταγλώττιση TypeScript
    typescript({
      tsconfig: './tsconfig.json',
      outDir: "dist",
      declaration: false

    }),
    // Optimization για CPU: Αφαίρεση κενών, σχολίων και mangle μεταβλητών
    terser({
      format: {
        comments: true // Κράτησε τα σχόλια για το Screeps, μπορεί να είναι χρήσιμα για debugging
      },
      compress: {
        drop_console: false, // Κράτησε το console.log για το Screeps
        passes: 2
      },
      mangle: {
        toplevel: true // Mangle μόνο τις τοπικές μεταβλητές, όχι τις παγκόσμιες που μπορεί να χρειάζονται για το Screeps
      }
    })
  ]
};