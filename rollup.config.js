import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  // Το σημείο εισόδου της εφαρμογής σου
  input: 'src/main.ts',
  output: {
    file: 'dist/main.js',
    format: 'cjs',
    sourcemap: false,
    exports: 'named'
  },
  plugins: [
    // Επίλυση εξαρτήσεων από το node_modules
    resolve({ rootDir: 'src' }),
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
        passes: 2 // Μην κάνεις πολλαπλές passes για να μειώσεις τον χρόνο μεταγλώττισης
      },
      mangle: {
        toplevel: true // Mangle μόνο τις τοπικές μεταβλητές, όχι τις παγκόσμιες που μπορεί να χρειάζονται για το Screeps
      }
    })
  ]
};