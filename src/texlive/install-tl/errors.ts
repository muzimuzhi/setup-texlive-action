import { readFile } from 'node:fs/promises';
import path from 'node:path';

import deline from 'deline';

import { TLError, type TLErrorOptions } from '#/texlive/errors';
import { Exception, type ExecOutput, type MarkNonNullable } from '#/util';

@Exception
export abstract class InstallTLError extends TLError {}

@Exception
export class RepositoryVersionIncompatible extends InstallTLError {
  private constructor(options?: Readonly<TLErrorOptions>) {
    super(
      'The repository is not compatible with this version of install-tl',
      options,
    );
    this['note'] = deline`
      The CTAN mirrors may not have completed synchronisation
      against a release of new version of TeX Live.
      Please try re-running the workflow after a while.
    `;
  }

  private static readonly TAG = 'repository being accessed are not compatible';
  private static readonly RE = /^\s*repository:\s*(?<remote>20\d{2})/mu;

  static check(
    output: Readonly<ExecOutput>,
    options?: Readonly<TLErrorOptions>,
  ): void {
    if (output.exitCode !== 0 && output.stderr.includes(this.TAG)) {
      throw new this({
        ...options,
        remoteVersion: this.RE.exec(output.stderr)?.groups?.['remote'],
      });
    }
  }
}

@Exception
export class UnexpectedVersion extends InstallTLError {
  private constructor(options?: Readonly<TLErrorOptions>) {
    super(
      `Unexpected install-tl version: ${options?.remoteVersion ?? 'unknown'}`,
      options,
    );
  }

  private static readonly RELEASE_TEXT_FILE = 'release-texlive.txt';
  private static readonly RE = /^TeX Live .+ version (20\d{2})/u;

  static async check(
    TEXMFROOT: string,
    options: Readonly<MarkNonNullable<TLErrorOptions, 'version'>>,
  ): Promise<void> {
    const opts = { ...options };
    try {
      const releaseTextPath = path.format({
        dir: TEXMFROOT,
        name: this.RELEASE_TEXT_FILE,
      });
      const text = await readFile(releaseTextPath, 'utf8');
      if (text.includes(`version ${options.version}`)) {
        return;
      }
      opts.remoteVersion = this.RE.exec(text)?.[1];
    } catch (cause) {
      opts.cause = cause;
    }
    throw new this(opts);
  }
}