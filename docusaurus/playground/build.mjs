// Builds the playground into static/playground-assets, before `docusaurus start` / `docusaurus build`:
// - main.js: Monaco (TypeScript + SQL only) and the playground's editor glue
// - runtime chunk: TypeORM's browser build, typeorm-extensions compiled from ../src, PGlite
// - ts.worker.js / editor.worker.js: Monaco's web workers
// - types.json: .d.ts files of typeorm, reflect-metadata and typeorm-extensions for the editor
// - pglite.wasm.gz / pglite.data.gz / initdb.wasm.gz: PostgreSQL compiled to WebAssembly
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const playgroundDir = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.dirname(playgroundDir);
const repoDir = path.dirname(docsDir);
const srcDir = path.join(repoDir, 'src');
const nodeModules = path.join(docsDir, 'node_modules');
const outDir = path.join(docsDir, 'static', 'playground-assets');
const generatedDir = path.join(playgroundDir, '.generated');

const started = Date.now();
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(generatedDir, { recursive: true });

// --- Monaco entry: editor.main without the languages the playground doesn't use ---------------

const monacoVs = path.join(nodeModules, 'monaco-editor', 'esm', 'vs');
const editorMainDir = path.join(monacoVs, 'editor');
const keepLanguages = ['typescript', 'sql'];

const monacoEntry = fs
  .readFileSync(path.join(editorMainDir, 'editor.main.js'), 'utf8')
  .split('\n')
  .filter((line) => {
    const definition = /languages\/definitions\/([\w-]+)\/register\.js/.exec(line);
    if (definition) {
      return keepLanguages.includes(definition[1]);
    }
    // language services (workers) of css / html / json, and the LSP client
    if (/languages\/features\/(css|html|json)\/register\.js|__src_languages_features_(css|html|json)_register_ts|monaco-lsp-client|\bindex as lsp\b/.test(line)) {
      return false;
    }
    return true;
  })
  .map((line) =>
    line.replace(/(from |import )'(\.{1,2}\/[^']+)'/, (_, keyword, specifier) =>
      `${keyword}${JSON.stringify(path.resolve(editorMainDir, specifier))}`,
    ),
  )
  .join('\n');

fs.writeFileSync(path.join(generatedDir, 'monaco-entry.js'), monacoEntry);
// types for playground/tsconfig.json: the same API as the full editor
fs.writeFileSync(path.join(generatedDir, 'monaco-entry.d.ts'), "export * from 'monaco-editor/esm/vs/index';\n");

// --- types.json: declarations for the editor's `node_modules` --------------------------------

function collectDts(dir, prefix, skip = () => false) {
  const files = {};
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const relative = path.relative(dir, full);
      if (skip(relative)) continue;
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.d.ts')) files[`${prefix}/${relative.split(path.sep).join('/')}`] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(dir);
  return files;
}

function compileLibraryDeclarations() {
  const options = {
    declaration: true,
    emitDeclarationOnly: true,
    outDir: '/out',
    rootDir: srcDir,
    target: ts.ScriptTarget.ES2019,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    lib: ['lib.es2019.d.ts', 'lib.dom.d.ts'],
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    types: [],
    // the repository root has no node_modules in the docs build: use the docs' typeorm
    baseUrl: docsDir,
    paths: { typeorm: ['node_modules/typeorm'], 'typeorm/*': ['node_modules/typeorm/*'] },
  };

  const program = ts.createProgram([path.join(srcDir, 'index.ts'), path.join(srcDir, 'helpers.ts')], options);
  const diagnostics = ts.getPreEmitDiagnostics(program);

  if (diagnostics.length) {
    const host = { getCanonicalFileName: (f) => f, getCurrentDirectory: () => repoDir, getNewLine: () => '\n' };
    throw new Error(`typeorm-extensions declarations:\n${ts.formatDiagnostics(diagnostics, host)}`);
  }

  const files = {};
  program.emit(undefined, (fileName, text) => {
    files[`typeorm-extensions/${path.relative('/out', fileName).split(path.sep).join('/')}`] = text;
  });
  return files;
}

const packageJson = (name) => JSON.stringify({ name, types: 'index.d.ts' });

const types = {
  ...collectDts(path.join(nodeModules, 'typeorm'), 'typeorm', (relative) => relative === 'browser' || relative === 'node_modules'),
  'typeorm/package.json': packageJson('typeorm'),
  'reflect-metadata/index.d.ts': fs.readFileSync(path.join(nodeModules, 'reflect-metadata', 'index.d.ts'), 'utf8'),
  'reflect-metadata/package.json': packageJson('reflect-metadata'),
  ...compileLibraryDeclarations(),
  'typeorm-extensions/package.json': packageJson('typeorm-extensions'),
};

fs.writeFileSync(path.join(outDir, 'types.json'), JSON.stringify(types));

// --- bundles ---------------------------------------------------------------------------------

const typeormDir = path.join(nodeModules, 'typeorm');

/**
 * `typeorm` → its browser build, with the browser-field replacements of TypeORM's package.json
 * (platform tools, disabled drivers) except the PostgreSQL driver, which PGlite plugs into.
 */
const typeormBrowserPlugin = {
  name: 'typeorm-browser',
  setup(build) {
    const { browser } = JSON.parse(fs.readFileSync(path.join(typeormDir, 'package.json'), 'utf8'));
    const replacements = new Map(
      Object.entries(browser)
        .filter(([from]) => !from.includes('driver/postgres/'))
        .map(([from, to]) => [path.join(typeormDir, from), path.join(typeormDir, to)]),
    );
    // TypeORM's browser build imports without extensions: './globals' is './globals.js' or './globals/index.js'
    const resolveFile = (file) =>
      [file, `${file}.js`, path.join(file, 'index.js')].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? file;
    const resolved = (file) => {
      const resolvedFile = resolveFile(file);
      return { path: replacements.get(resolvedFile) ?? resolvedFile };
    };

    build.onResolve({ filter: /^typeorm(\/.*)?$/ }, (args) => {
      const subpath = args.path.slice('typeorm'.length).replace(/^\//, '');
      return resolved(path.join(typeormDir, 'browser', subpath.replace(/\.js$/, '') || 'index'));
    });

    // relative imports inside TypeORM, resolved here so esbuild doesn't apply the browser field itself
    build.onResolve({ filter: /^\.\.?\// }, (args) => {
      if (!args.importer.startsWith(typeormDir + path.sep)) return undefined;
      return resolved(path.resolve(args.resolveDir, args.path));
    });
  },
};

/** typeorm-pglite `require`s PGlite: use its ES module build, which finds its .wasm next to the bundle. */
const pgliteEsmPlugin = {
  name: 'pglite-esm',
  setup(build) {
    const pgliteEntry = path.join(nodeModules, '@electric-sql', 'pglite', 'dist', 'index.js');
    build.onResolve({ filter: /^@electric-sql\/pglite$/ }, () => ({ path: pgliteEntry }));
  },
};

/**
 * Node built-ins and optional driver packages, imported on code paths the browser never takes
 * (PGlite's Node file system, TypeORM's React Native driver): an empty CommonJS module, so named
 * imports bundle and are `undefined`. `buffer` and `events` are bundled from their npm polyfills.
 */
const stubbedModules = /^(node:.*|fs|fs\/promises|path|url|crypto|module|os|util|stream|zlib|worker_threads|child_process|perf_hooks|react-native-sqlite-storage)$/;

const browserStubsPlugin = {
  name: 'browser-stubs',
  setup(build) {
    build.onResolve({ filter: stubbedModules }, (args) => ({ path: args.path, namespace: 'browser-stub' }));
    build.onLoad({ filter: /.*/, namespace: 'browser-stub' }, () => ({ contents: 'module.exports = {};', loader: 'js' }));
  },
};

const common = {
  bundle: true,
  minify: true,
  legalComments: 'none',
  logLevel: 'warning',
  target: 'es2020',
};

const result = await esbuild.build({
  ...common,
  entryPoints: { main: path.join(playgroundDir, 'src', 'main.ts') },
  outdir: outDir,
  format: 'esm',
  splitting: true,
  platform: 'browser',
  metafile: true,
  loader: { '.ttf': 'file' },
  assetNames: '[name]-[hash]',
  define: {
    'process.env.NODE_ENV': '"production"',
    global: 'globalThis',
    __MODELS_SOURCE__: JSON.stringify(fs.readFileSync(path.join(playgroundDir, 'src', 'models.ts'), 'utf8')),
  },
  tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } },
  plugins: [typeormBrowserPlugin, pgliteEsmPlugin, browserStubsPlugin],
});

await esbuild.build({
  ...common,
  entryPoints: {
    'editor.worker': path.join(monacoVs, 'editor', 'editor.worker.js'),
    'ts.worker': path.join(monacoVs, 'languages', 'features', 'typescript', 'ts.worker.js'),
  },
  outdir: outDir,
  format: 'iife',
  platform: 'browser',
});

// gzipped here, unzipped by the runtime: the hosting may not compress .wasm / .data (15 MB → 5 MB)
for (const file of ['pglite.wasm', 'pglite.data', 'initdb.wasm']) {
  const content = fs.readFileSync(path.join(nodeModules, '@electric-sql', 'pglite', 'dist', file));
  fs.writeFileSync(path.join(outDir, `${file}.gz`), zlib.gzipSync(content, { level: 9 }));
}

// a static `import "fs"` left in the bundle would stop the page from loading
const leftovers = new Set(
  Object.values(result.metafile.outputs)
    .flatMap((output) => output.imports)
    .filter((imported) => imported.external && imported.kind === 'import-statement')
    .map((imported) => imported.path),
);

if (leftovers.size) {
  const importers = Object.entries(result.metafile.inputs).flatMap(([input, { imports }]) =>
    imports.filter((imported) => leftovers.has(imported.path)).map((imported) => `${imported.path} ← ${input}`),
  );
  throw new Error(`Static imports of Node built-ins would break the page:\n${[...new Set(importers)].join('\n')}`);
}

const size = fs.readdirSync(outDir).reduce((sum, file) => sum + fs.statSync(path.join(outDir, file)).size, 0);
console.log(`playground: built ${fs.readdirSync(outDir).length} files, ${(size / 1024 / 1024).toFixed(1)} MB, in ${((Date.now() - started) / 1000).toFixed(1)}s`);
