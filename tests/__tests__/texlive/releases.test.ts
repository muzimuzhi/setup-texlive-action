import nock from 'nock';

import * as log from '#/log';
import { Latest, ReleaseData } from '#/texlive/releases';

jest.unmock('@actions/http-client');
jest.unmock('#/texlive/releases');

let doMock: () => nock.Scope;

beforeAll(async () => {
  const data = await fixtures('ctan-api-pkg-texlive.json');
  doMock = () => {
    return nock('https://ctan.org')
      .get('/json/2.0/pkg/texlive')
      .reply(200, data);
  };
});

afterAll(nock.restore);

describe('LatestRelease', () => {
  describe('checkVersion', () => {
    it('checks for latest version using the CTAN API', async () => {
      const mock = doMock();
      await expect(new Latest().checkVersion()).resolves.toBe(
        LATEST_VERSION,
      );
      expect(mock.isDone()).toBeTrue();
    });

    it('throws no exception', async () => {
      await expect(new Latest().checkVersion()).toResolve();
      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Failed to check'),
        expect.anything(),
      );
    });
  });
});

describe('ReleaseData.setup', () => {
  let mock: nock.Scope;
  beforeAll(() => {
    mock = doMock();
  });

  it('does not usually check for the latest version', async () => {
    await expect(ReleaseData.setup()).toResolve();
    expect(mock.isDone()).toBeFalse();
  });

  it('checks for the latest version if needed', async () => {
    jest.spyOn(Temporal.Now, 'instant').mockReturnValueOnce(
      Temporal
        .PlainDateTime
        .from('2024-04-01')
        .toZonedDateTime('UTC')
        .toInstant(),
    );
    await expect(ReleaseData.setup()).toResolve();
    expect(mock.isDone()).toBeTrue();
  });
});