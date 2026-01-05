// Reexport the native module. On web, it will be resolved to MattOnahModule.web.ts
// and on native platforms to MattOnahModule.ts
export { default } from './src/MattOnahModule';
export { default as MattOnahView } from './src/MattOnahView';
export * from  './src/MattOnah.types';
