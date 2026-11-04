// Side-effect-free entry point: `typeorm-extensions/helpers`.
// Exports helpers only and patches nothing; importing the package root
// (`typeorm-extensions`) installs every QueryBuilder extension.
export * from './utils/table.utils';
