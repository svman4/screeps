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
    sourcemap: false, // Απενεργοποίηση για μείωση μεγέθους upload
    exports: 'named'
  },
  plugins: [
    // Επίλυση εξαρτήσεων από το node_modules
    resolve({ rootDir: 'src' }),
    // Μετατροπή CommonJS (require) σε ES6
    commonjs(),
    // Μεταγλώττιση TypeScript
    typescript({ tsconfig: './tsconfig.json' }),
    // Optimization για CPU: Αφαίρεση κενών, σχολίων και mangle μεταβλητών
    terser({
      format: {
        comments: false
      },
      compress: {
        drop_console: false, // Κράτησε το console.log για το Screeps
        passes: 2
      },
      mangle: {
        toplevel: true
      }
    })
  ]
};