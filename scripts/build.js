import { cpSync, mkdirSync, rmSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/vendor', { recursive: true });
cpSync('public', 'dist', { recursive: true });
cpSync('node_modules/angular/angular.min.js', 'dist/vendor/angular.min.js');
cpSync('node_modules/angular/LICENSE.md', 'dist/vendor/ANGULAR-LICENSE.md');
console.log('Built static AngularJS client in dist/. The API still runs through npm start.');
