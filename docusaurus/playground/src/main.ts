// Entry of the playground bundle, loaded by the /playground page in the browser only.
// Monaco with TypeScript's language service, the library's and TypeORM's types, and a runtime
// (loaded in the background) that runs the code against PostgreSQL in WebAssembly.
import * as monaco from '../.generated/monaco-entry';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { format as formatSql } from 'sql-formatter';
import { examples, type Example } from './examples';
import type { RunResult } from './runtime';

declare const __MODELS_SOURCE__: string;

export type { Example, RunResult };
export { examples };

export type Theme = 'light' | 'dark';

export type Diagnostic = { line: number; column: number; message: string };

export type PlaygroundRun = RunResult & {
  /** TypeScript errors of the code: it runs anyway, like in the TypeScript playground */
  diagnostics: Diagnostic[];
};

export interface Playground {
  getCode(): string;
  setCode(code: string): void;
  setTheme(theme: Theme): void;
  /** Shows the code (`main`) or the demo entities (`models`, read only). */
  showFile(file: 'main' | 'models'): void;
  /** Resolves when PostgreSQL is up and the tables are filled. */
  ready: Promise<void>;
  run(): Promise<PlaygroundRun>;
  /** SQL formatted and highlighted, as HTML. */
  highlightSql(sql: string): Promise<string>;
  shareUrl(): string;
  dispose(): void;
}

const assetUrl = (file: string) => new URL(`./${file}`, import.meta.url).href;

(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    const file = label === 'typescript' || label === 'javascript' ? 'ts.worker.js' : 'editor.worker.js';
    return new Worker(assetUrl(file));
  },
};

let stylesLoaded = false;

function loadStyles() {
  if (stylesLoaded) {
    return;
  }

  stylesLoaded = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = assetUrl('main.css');
  document.head.appendChild(link);
}

let typesPromise: Promise<void> | undefined;

/** TypeORM's, reflect-metadata's and the library's declarations, as `node_modules` of the editor. */
function loadTypes(): Promise<void> {
  typesPromise ??= (async () => {
    const ts = monaco.typescript;

    ts.typescriptDefaults.setCompilerOptions({
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      lib: ['es2020', 'dom'],
      strict: true,
      experimentalDecorators: true,
      esModuleInterop: true,
      skipLibCheck: true,
      allowNonTsExtensions: true,
      noEmitOnError: false,
    });
    ts.typescriptDefaults.setEagerModelSync(true);

    const response = await fetch(assetUrl('types.json'));
    const files: Record<string, string> = await response.json();

    for (const [path, content] of Object.entries(files)) {
      ts.typescriptDefaults.addExtraLib(content, `file:///node_modules/${path}`);
    }
  })();

  return typesPromise;
}

const MAIN_URI = 'file:///main.ts';
const MODELS_URI = 'file:///node_modules/playground/index.ts';

function getOrCreateModel(uri: string, code: string): monaco.editor.ITextModel {
  const existing = monaco.editor.getModel(monaco.Uri.parse(uri));

  if (existing) {
    existing.setValue(code);
    return existing;
  }

  return monaco.editor.createModel(code, 'typescript', monaco.Uri.parse(uri));
}

const flattenMessage = (message: string | { messageText: string; next?: unknown[] }): string => {
  if (typeof message === 'string') {
    return message;
  }

  const next = (message.next ?? []) as Array<typeof message>;
  return [message.messageText, ...next.map(flattenMessage)].join(' ');
};

/** The code from the URL (`#code=…`), if any. */
export function codeFromUrl(hash = location.hash): string | undefined {
  const match = /[#&]code=([^&]+)/.exec(hash);
  return match ? decompressFromEncodedURIComponent(match[1]) ?? undefined : undefined;
}

export async function createPlayground(options: {
  element: HTMLElement;
  code: string;
  theme: Theme;
  onChange?: (code: string) => void;
  /** Ctrl / Cmd + Enter */
  onRunShortcut?: () => void;
}): Promise<Playground> {
  loadStyles();
  await loadTypes();

  const modelsModel = getOrCreateModel(MODELS_URI, __MODELS_SOURCE__);
  const mainModel = getOrCreateModel(MAIN_URI, options.code);

  const narrow = window.matchMedia('(max-width: 996px)').matches;

  const editor = monaco.editor.create(options.element, {
    model: mainModel,
    theme: options.theme === 'dark' ? 'vs-dark' : 'vs',
    automaticLayout: true,
    minimap: { enabled: false },
    // phones: wrap long lines instead of scrolling sideways
    wordWrap: narrow ? 'on' : 'off',
    fontSize: narrow ? 13 : 14,
    tabSize: 2,
    scrollBeyondLastLine: false,
    fixedOverflowWidgets: true,
  });

  const changeListener = mainModel.onDidChangeContent(() => options.onChange?.(mainModel.getValue()));
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => options.onRunShortcut?.());

  // PostgreSQL starts in the background while the code is being edited
  const runtimePromise = import('./runtime');
  const ready = runtimePromise.then((runtime) => runtime.getDataSource()).then(() => undefined);

  async function compile(): Promise<{ js: string; diagnostics: Diagnostic[] }> {
    const getWorker = await monaco.typescript.getTypeScriptWorker();
    const worker = await getWorker(mainModel.uri);
    const uri = mainModel.uri.toString();

    const [syntactic, semantic, output] = await Promise.all([
      worker.getSyntacticDiagnostics(uri),
      worker.getSemanticDiagnostics(uri),
      worker.getEmitOutput(uri),
    ]);

    const diagnostics = [...syntactic, ...semantic].map((diagnostic) => {
      const position = mainModel.getPositionAt(diagnostic.start ?? 0);
      return {
        line: position.lineNumber,
        column: position.column,
        message: flattenMessage(diagnostic.messageText as Parameters<typeof flattenMessage>[0]),
      };
    });

    const js = output.outputFiles.find((file: { name: string }) => file.name.endsWith('.js'))?.text ?? '';

    return { js, diagnostics };
  }

  return {
    getCode: () => mainModel.getValue(),
    setCode: (code) => {
      editor.setModel(mainModel);
      mainModel.setValue(code);
    },
    setTheme: (theme) => monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs'),
    showFile: (file) => {
      editor.setModel(file === 'models' ? modelsModel : mainModel);
      editor.updateOptions({ readOnly: file === 'models' });
    },
    ready,
    async run() {
      const [{ js, diagnostics }, runtime] = await Promise.all([compile(), runtimePromise]);
      const result = await runtime.run(js);
      return { ...result, diagnostics };
    },
    async highlightSql(sql) {
      let formatted = sql;

      try {
        formatted = formatSql(sql, { language: 'postgresql', keywordCase: 'upper' });
      } catch {
        // keep the SQL as TypeORM built it
      }

      return monaco.editor.colorize(formatted, 'sql', { tabSize: 2 });
    },
    shareUrl() {
      const url = new URL(location.href);
      url.hash = `code=${compressToEncodedURIComponent(mainModel.getValue())}`;
      return url.toString();
    },
    dispose() {
      changeListener.dispose();
      editor.dispose();
    },
  };
}
