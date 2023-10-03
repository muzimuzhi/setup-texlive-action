import { createContext } from 'unctx';

import * as ctan from '#/ctan';
import * as log from '#/log';
import * as tlnet from '#/texlive/tlnet';
import { Version } from '#/texlive/version';
import { http } from '#/util';

import data from '#/texlive/release-data.json';

const { Instant, Now, PlainDateTime, ZonedDateTime } = Temporal;
type ZonedDateTime = Temporal.ZonedDateTime;

export interface Release {
  readonly version: Version;
  readonly releaseDate: ZonedDateTime | undefined;
}

export interface ReleaseData {
  readonly latest: Release;
  readonly isLatest: (version: Version) => boolean;
}

export namespace ReleaseData {
  const ctx = createContext<ReleaseData>();
  export const { use } = ctx;

  export async function setup(): Promise<ReleaseData> {
    const latest = new Latest();
    if (Latest.needToCheck()) {
      await latest.checkVersion();
    }
    function isLatest(version: Version): boolean {
      return version === latest.version;
    }
    ctx.set({ latest, isLatest });
    return { latest, isLatest };
  }
}

/** @internal */
export class Latest implements Release {
  releaseDate: ZonedDateTime | undefined;
  #version: Version = data.latest.version as Version;

  get version(): Version {
    return this.#version;
  }

  private set version(latest: Version) {
    if (this.#version !== latest) {
      this.#version = latest;
      this.releaseDate = undefined;
      log.info('A new version of TeX Live has been released: %s', latest);
    } else {
      log.info('Latest version: %s', this.version);
    }
  }

  async checkVersion(): Promise<Version> {
    log.info('Checking for latest version of TeX Live');
    try {
      const { version } = await ctan.api.pkg('texlive');
      this.version = Version.parse(version?.number ?? '');
    } catch (error) {
      log.info({ error }, 'Failed to check for latest version');
      log.info('Use `%s` as latest version', this.version);
    }
    return this.version;
  }

  /**
   * @privateRemarks
   *
   * There appears to be no formal way to check the release date (and time) of
   * TeX Live, but the modified timestamp of the `TEXLIVE_YYYY` file seems to be
   * a good approximation.
   */
  async checkReleaseDate(): Promise<ZonedDateTime> {
    if (this.releaseDate !== undefined) {
      return this.releaseDate;
    }
    if (this.version === data.latest.version) {
      return this.releaseDate = ZonedDateTime.from(data.latest.releaseDate);
    }
    const ctanMaster = await tlnet.ctan({ master: true });
    const url = new URL(`TEXLIVE_${this.version}`, ctanMaster);
    const headers = await http.getHeaders(url);
    const timestamp = headers['last-modified'] ?? '';
    const epoch = Date.parse(timestamp);
    if (Number.isNaN(epoch)) {
      throw new TypeError(`Invalid timestamp: ${timestamp}`);
    }
    return this.releaseDate = new Date(epoch)
      .toTemporalInstant()
      .toZonedDateTimeISO('UTC');
  }

  static needToCheck(): boolean {
    const now = Now.instant();
    /** @see {@link https://en.wikipedia.org/wiki/UTC%2B14:00} */
    const tzEarliest = '+14:00';
    const nextReleaseDate = PlainDateTime
      .from(data.next.releaseDate)
      .toZonedDateTime(tzEarliest)
      .toInstant();
    return Instant.compare(now, nextReleaseDate) >= 0;
  }
}
