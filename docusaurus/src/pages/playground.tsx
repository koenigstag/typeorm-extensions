import React, { useCallback, useEffect, useRef, useState } from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { useColorMode } from '@docusaurus/theme-common';
import styles from './playground.module.css';

// The editor and the database are a separate bundle (docusaurus/playground), loaded in the browser only.
type Example = { id: string; title: string; code: string };
type ExecutedQuery = { sql: string; parameters?: unknown[]; error?: string };
type Diagnostic = { line: number; column: number; message: string };
type PlaygroundRun = {
  queries: ExecutedQuery[];
  result?: unknown;
  error?: string;
  durationMs: number;
  diagnostics: Diagnostic[];
};
type Playground = {
  getCode(): string;
  setCode(code: string): void;
  setTheme(theme: 'light' | 'dark'): void;
  showFile(file: 'main' | 'models'): void;
  ready: Promise<void>;
  run(): Promise<PlaygroundRun>;
  highlightSql(sql: string): Promise<string>;
  shareUrl(): string;
  dispose(): void;
};
type PlaygroundModule = {
  examples: Example[];
  codeFromUrl(): string | undefined;
  createPlayground(options: {
    element: HTMLElement;
    code: string;
    theme: 'light' | 'dark';
    onChange?: (code: string) => void;
    onRunShortcut?: () => void;
  }): Promise<Playground>;
};

type Status = 'loading-editor' | 'starting-database' | 'ready' | 'running' | 'failed';

const STATUS_TEXT: Record<Status, string> = {
  'loading-editor': 'Loading the editor…',
  'starting-database': 'Starting PostgreSQL in your browser…',
  ready: 'Ready',
  running: 'Running…',
  failed: 'Failed to load',
};

type Output = PlaygroundRun & { highlighted: string[] };

function PlaygroundApp(): JSX.Element {
  const bundleUrl = useBaseUrl('/playground-assets/main.js');
  const { colorMode } = useColorMode();
  const editorRef = useRef<HTMLDivElement>(null);
  const playgroundRef = useRef<Playground>();
  const runningRef = useRef(false);

  const [status, setStatus] = useState<Status>('loading-editor');
  const [loadError, setLoadError] = useState<string>();
  const [examples, setExamples] = useState<Example[]>([]);
  const [exampleId, setExampleId] = useState('');
  const [file, setFile] = useState<'main' | 'models'>('main');
  const [output, setOutput] = useState<Output>();
  const [copied, setCopied] = useState(false);

  const run = useCallback(async () => {
    const playground = playgroundRef.current;
    if (!playground || runningRef.current) return;

    runningRef.current = true;
    setStatus('running');
    setFile('main');
    playground.showFile('main');

    try {
      const result = await playground.run();
      const highlighted = await Promise.all(result.queries.map((query) => playground.highlightSql(query.sql)));
      setOutput({ ...result, highlighted });
    } finally {
      runningRef.current = false;
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        const module: PlaygroundModule = await import(/* webpackIgnore: true */ bundleUrl);
        if (disposed || !editorRef.current) return;

        const fromUrl = module.codeFromUrl();
        const initial = fromUrl ? undefined : module.examples[0];
        setExamples(module.examples);
        setExampleId(initial?.id ?? '');

        const playground = await module.createPlayground({
          element: editorRef.current,
          code: fromUrl ?? initial?.code ?? '',
          theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
          onChange: () => setCopied(false),
          onRunShortcut: () => void run(),
        });

        if (disposed) {
          playground.dispose();
          return;
        }

        playgroundRef.current = playground;
        setStatus('starting-database');
        await playground.ready;
        if (!disposed) await run();
      } catch (error) {
        setStatus('failed');
        setLoadError(error instanceof Error ? error.message : String(error));
      }
    })();

    return () => {
      disposed = true;
      playgroundRef.current?.dispose();
      playgroundRef.current = undefined;
    };
  }, [bundleUrl, run]);

  useEffect(() => {
    playgroundRef.current?.setTheme(colorMode === 'dark' ? 'dark' : 'light');
  }, [colorMode]);

  const selectExample = (id: string) => {
    const example = examples.find((item) => item.id === id);
    if (!example || !playgroundRef.current) return;

    setExampleId(id);
    setFile('main');
    playgroundRef.current.setCode(example.code);
    history.replaceState(null, '', location.pathname);
    void run();
  };

  const showFile = (next: 'main' | 'models') => {
    setFile(next);
    playgroundRef.current?.showFile(next);
  };

  const share = async () => {
    const url = playgroundRef.current?.shareUrl();
    if (!url) return;

    history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // the link is in the address bar anyway
    }
  };

  const ready = status === 'ready';

  return (
    <div className={styles.playground}>
      <div className={styles.toolbar}>
        <select
          className={styles.select}
          value={exampleId}
          onChange={(event) => selectExample(event.target.value)}
          disabled={!ready}
          aria-label="Example"
        >
          {exampleId === '' && <option value="">Shared code</option>}
          {examples.map((example) => (
            <option key={example.id} value={example.id}>
              {example.title}
            </option>
          ))}
        </select>
        <button className="button button--primary" onClick={() => void run()} disabled={!ready} title="Ctrl / Cmd + Enter">
          Run ▶
        </button>
        <button className="button button--secondary" onClick={() => void share()} disabled={status === 'loading-editor' || status === 'failed'}>
          {copied ? 'Link copied' : 'Share'}
        </button>
        <span className={styles.status} role="status">
          {STATUS_TEXT[status]}
          {output && ready ? ` · ${output.queries.length} ${output.queries.length === 1 ? 'query' : 'queries'}, ${Math.round(output.durationMs)} ms` : ''}
        </span>
      </div>

      <div className={styles.panes}>
        <div className={styles.editorPane}>
          <div className={styles.tabs} role="tablist">
            <button role="tab" aria-selected={file === 'main'} className={file === 'main' ? styles.activeTab : styles.tab} onClick={() => showFile('main')}>
              main.ts
            </button>
            <button role="tab" aria-selected={file === 'models'} className={file === 'models' ? styles.activeTab : styles.tab} onClick={() => showFile('models')}>
              playground (entities)
            </button>
          </div>
          <div ref={editorRef} className={styles.editor} data-testid="editor" />
        </div>

        <div className={styles.outputPane} data-testid="output">
          {loadError && <div className={styles.error}>The playground could not load: {loadError}</div>}

          {output && output.diagnostics.length > 0 && (
            <div className={styles.warning}>
              <strong>TypeScript: {output.diagnostics.length} {output.diagnostics.length === 1 ? 'error' : 'errors'}</strong> (the code ran anyway)
              <ul>
                {output.diagnostics.map((diagnostic, i) => (
                  <li key={i}>
                    main.ts:{diagnostic.line}:{diagnostic.column} {diagnostic.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h3 className={styles.heading}>SQL</h3>
          {output?.queries.length === 0 && <p className={styles.muted}>No queries.</p>}
          {output?.queries.map((query, i) => (
            <div key={i} className={styles.query}>
              <pre className={styles.sql} dangerouslySetInnerHTML={{ __html: output.highlighted[i] }} />
              {query.parameters && query.parameters.length > 0 && (
                <div className={styles.parameters}>
                  {query.parameters.map((parameter, j) => (
                    <code key={j}>
                      ${j + 1} = {JSON.stringify(parameter)}
                    </code>
                  ))}
                </div>
              )}
              {query.error && <div className={styles.error}>{query.error}</div>}
            </div>
          ))}

          <h3 className={styles.heading}>Result</h3>
          {output?.error ? (
            <div className={styles.error}>{output.error}</div>
          ) : (
            output && <pre className={styles.result}>{JSON.stringify(output.result, null, 2) ?? 'undefined'}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlaygroundPage(): JSX.Element {
  return (
    <Layout
      title="Playground"
      description="Try typeorm-extensions in the browser: write a query, see the SQL and run it on PostgreSQL in WebAssembly."
      noFooter
    >
      <BrowserOnly fallback={<div className={styles.fallback}>Loading the playground…</div>}>{() => <PlaygroundApp />}</BrowserOnly>
    </Layout>
  );
}
