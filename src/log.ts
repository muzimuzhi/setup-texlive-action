import { EOL } from 'node:os';
import { env, stdout } from 'node:process';
import { formatWithOptions } from 'node:util';

import * as core from '@actions/core';
import ansi, {
  type CSPair,
  type ForegroundColorName,
  type ModifierName,
} from 'ansi-styles';
import type { MarkRequired } from 'ts-essentials';
import { P, match } from 'ts-pattern';

export type LogLevel = keyof typeof LogLevel;

export const LogLevel = {
  debug: 20,
  info: 30,
  warn: 40,
  fatal: 60,
} as const;

export interface LogOptions {
  readonly error?: unknown;
  readonly linePrefix?: string;
}

export interface LogFn<Options extends LogOptions = LogOptions> {
  (format: string, ...values: readonly unknown[]): void;
  (options: Options, format: string, ...values: readonly unknown[]): void;
  (options: MarkRequired<Options, 'error'>): void;
}

export const notify: typeof warn = setLogFn('info', core.notice);

export const debug = setLogFn('debug', core.debug);
export const info = setLogFn('info', core.info);
export const warn = setLogFn('warn', core.warning);
export const fatal = setLogFn('fatal', core.setFailed);

export namespace symbols {
  export const note = Symbol('note');
}

declare global {
  interface Error {
    [symbols.note]?: string;
  }
}

export function hasColors(): boolean {
  if (core.isDebug()) {
    return false;
  }
  const NO_COLOR = 'NO_COLOR';
  // `internal.tty.hasColors` supports `NO_COLOR` (https://no-color.org/),
  // but its handling of empty strings does not conform to the spec.
  // https://github.com/nodejs/node/blob/v21.0.0/lib/internal/tty.js#L129
  if (env[NO_COLOR] === '') {
    delete env[NO_COLOR];
  }
  // `process.stdout` is not necessarily an instance of `tty.WriteStream`.
  return (stdout as Partial<typeof stdout>).hasColors?.() ?? !(NO_COLOR in env);
}

export namespace styles {
  const stylize = (
    style: ForegroundColorName | ModifierName,
  ): (input: string | TemplateStringsArray) => string => {
    const group = style in ansi.modifier ? ansi.modifier : ansi.color;
    const { open, close } = group[style as keyof typeof group] as CSPair;
    return (input) => {
      const text = (Array.isArray(input) ? input[0] : input) as string;
      return hasColors() ? `${open}${text}${close}` : text;
    };
  };

  export const dim = stylize('dim');
  export const red = stylize('red');
  export const blue = stylize('blue');
}

const defaultInspectOptions = {
  depth: 10,
  compact: false,
  maxArrayLength: 10,
  maxStringLength: 200,
} as const;

const logger = { debug, info, warn, fatal } as const;

function setLogFn<
  const L extends LogLevel,
>(level: L, logFn: (msg: string) => void): LogFn<
  // dprint-ignore
  L extends ('warn' | 'error' | 'fatal')
    ? Omit<LogOptions, 'linePrefix'>
    : LogOptions
> {
  function log(
    ...args:
      | readonly [string, ...unknown[]]
      | readonly [LogOptions, string, ...unknown[]]
      | readonly [MarkRequired<LogOptions, 'error'>]
  ): void {
    if (LogLevel[level] <= LogLevel.debug && !core.isDebug()) {
      return;
    }
    const [message, options] = match(args)
      .returnType<[message: string, options?: LogOptions]>()
      .with(
        [P.string, ...P.array()],
        (inputs) => [format(...inputs)],
      )
      .with(
        [{ error: P._ }, P.string, ...P.array()],
        ([options, ...inputs]) => [
          `${format(...inputs)}: ${options.error}`,
          options,
        ],
      )
      .with(
        [P._, P.string, ...P.array()],
        ([options, ...inputs]) => [format(...inputs), options],
      )
      .with(
        [{ error: P._ }],
        ([options]) => [String(options.error), options],
      )
      .exhaustive();
    const { error, linePrefix } = options ?? {};
    const warning = LogLevel[level] > LogLevel.info;
    if (error !== undefined) {
      let prefix = styles[warning ? 'red' : 'dim']('|') + ' ';
      if (linePrefix !== undefined) {
        prefix = linePrefix + prefix;
      }
      logger[warning ? 'info' : level]({ linePrefix: prefix }, '%O', error);
    }
    if (!warning && linePrefix !== undefined) {
      logFn(indent(message, linePrefix));
    } else {
      logFn(message);
    }
    if (warning && error instanceof Error) {
      for (const note of new Set(collectNotes(error))) {
        core.notice(note);
      }
    }
  }
  return log;
}

function* collectNotes(
  error: Readonly<Error>,
  depth: number = defaultInspectOptions.depth,
): Generator<string, void, void> {
  if (depth > 0) {
    const errors = match(error)
      .with(
        P.instanceOf(AggregateError),
        { name: 'AggregateError', errors: P.array() },
        ({ errors }) => errors,
      )
      .with(
        { name: 'SuppressedError', error: P._, suppressed: P._ },
        ({ error: err, suppressed }) => [err, suppressed],
      )
      .with(
        { cause: P._ },
        ({ cause }) => [cause],
      )
      .otherwise(() => []);
    for (const e of errors) {
      if (e instanceof Error) {
        yield* collectNotes(e, depth - 1);
      }
    }
    if (Object.hasOwn(error, symbols.note)) {
      yield error[symbols.note]!;
    }
  }
}

function format(fmt: string, ...values: readonly unknown[]): string {
  return formatWithOptions(
    { colors: hasColors(), ...defaultInspectOptions },
    fmt,
    ...values,
  );
}

function indent(text: string, prefix: string): string {
  return text.split('\n').map((line) => `${prefix}${line}`.trimEnd()).join(EOL);
}

export { group } from '@actions/core';
