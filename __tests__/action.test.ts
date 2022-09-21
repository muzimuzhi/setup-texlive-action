import type { DeepWritable } from 'ts-essentials';

import * as action from '#/action';
import { Inputs, Outputs, State } from '#/context';
import { InstallTL } from '#/install-tl';
import { type Texmf, Tlmgr, Version } from '#/texlive';
import * as util from '#/utility';
import CacheType = util.CacheType;

const v = (spec: unknown) => new Version(`${spec}`);

let ctx: DeepWritable<{
  inputs: Inputs;
  outputs: Outputs;
}>;
beforeEach(() => {
  ctx = {
    inputs: {
      cache: true,
      packages: new Set(),
      texmf: { TEXDIR: '' } as Texmf,
      tlcontrib: false,
      updateAllPackages: false,
      version: v`latest`,
    },
    outputs: { emit: jest.fn(), cacheHit: false } as unknown as Outputs,
  };
  jest.mocked(Inputs.load).mockResolvedValue(ctx.inputs as unknown as Inputs);
  jest.mocked(Outputs).mockReturnValue(ctx.outputs);
});

jest.unmock('#/action');

it('installs TeX Live if cache not found', async () => {
  await expect(action.run()).toResolve();
  expect(util.restoreCache).toHaveBeenCalled();
  expect(InstallTL.prototype.run).toHaveBeenCalled();
});

it('does not use cache if input cache is false', async () => {
  ctx.inputs.cache = false;
  await expect(action.run()).toResolve();
  expect(util.restoreCache).not.toHaveBeenCalled();
});

it.each<[CacheType]>([['primary'], ['secondary']])(
  'restores cache if cache found (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    await expect(action.run()).toResolve();
    expect(InstallTL.prototype.run).not.toHaveBeenCalled();
  },
);

it.each<[CacheType | undefined]>([['secondary'], [undefined]])(
  'save data in state if full cache not found (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    await expect(action.run()).toResolve();
    expect(State.prototype.save).toHaveBeenCalled();
    const mock = jest.mocked(State).mock;
    expect(mock.instances).toHaveLength(1);
    expect(mock.instances[0]).toHaveProperty(
      'key',
      expect.stringMatching(/^setup-texlive-[^-]+-[^-]+-\d{4}-\w{64}$/u),
    );
    expect(mock.instances[0]).toHaveProperty('texdir', expect.any(String));
  },
);

it('does not save TEXDIR if full cache found', async () => {
  jest.mocked(util.restoreCache).mockResolvedValueOnce('primary');
  await expect(action.run()).toResolve();
  expect(State.prototype.save).toHaveBeenCalled();
  const mock = jest.mocked(State).mock;
  expect(mock.instances).toHaveLength(1);
  expect(mock.instances[0]).toHaveProperty('key');
  expect(mock.instances[0]).not.toHaveProperty('texdir');
});

it.each([[false, undefined], [true, 'primary'], [true, 'secondary']] as const)(
  'sets cache-hit to %s if cache is %s',
  async (value, kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    await expect(action.run()).toResolve();
    expect(ctx.outputs.emit).toHaveBeenCalledOnce();
    expect(ctx.outputs.cacheHit).toBe(value);
  },
);

it('adds TeX Live to path after installation', async () => {
  await expect(action.run()).toResolve();
  expect(Tlmgr.Path.prototype.add).toHaveBeenCalledAfter(
    jest.mocked<(x: any) => unknown>(InstallTL.prototype.run),
  );
});

it.each<[CacheType]>([['primary'], ['secondary']])(
  'adds TeX Live to path after cache restoration (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    await expect(action.run()).toResolve();
    expect(Tlmgr.Path.prototype.add).not.toHaveBeenCalledBefore(
      jest.mocked<(...args: Array<any>) => unknown>(util.restoreCache),
    );
    expect(Tlmgr.Path.prototype.add).toHaveBeenCalled();
  },
);

it.each([[true], [false]])(
  'does not update any TeX packages for new installation',
  async (input) => {
    ctx.inputs.updateAllPackages = input;
    await expect(action.run()).toResolve();
    expect(Tlmgr.prototype.update).not.toHaveBeenCalled();
  },
);

it.each<[CacheType]>([['primary'], ['secondary']])(
  'updates `tlmgr` when restoring cache (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    await expect(action.run()).toResolve();
    expect(Tlmgr.prototype.update).toHaveBeenCalledOnce();
    expect(Tlmgr.prototype.update).toHaveBeenCalledWith(undefined, {
      self: true,
    });
  },
);

it.each<[CacheType]>([['primary'], ['secondary']])(
  'updates all packages if `update-all-packages` is true (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    ctx.inputs.updateAllPackages = true;
    await expect(action.run()).toResolve();
    expect(Tlmgr.prototype.update).toHaveBeenCalledTimes(2);
    expect(Tlmgr.prototype.update).toHaveBeenCalledWith(undefined, {
      all: true,
      reinstallForciblyRemoved: true,
    });
  },
);

it.each<[CacheType, Version]>([
  ['primary', v`2008`],
  ['secondary', v`2011`],
  ['primary', v`2014`],
  ['secondary', v`2017`],
  ['primary', v`2020`],
])('does not update any packages for older versions', async (kind, version) => {
  jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
  ctx.inputs.updateAllPackages = true;
  ctx.inputs.version = version;
  await expect(action.run()).toResolve();
  expect(Tlmgr.prototype.update).not.toHaveBeenCalled();
});

it('does nothing about TEXMF for new installation', async () => {
  await expect(action.run()).toResolve();
  expect(Tlmgr.Conf.prototype.texmf).not.toHaveBeenCalled();
});

it.each<[CacheType | undefined]>([['primary'], ['secondary'], [undefined]])(
  'may adjust TEXMF after adding TeX Live to path (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    await expect(action.run()).toResolve();
    expect(Tlmgr.Conf.prototype.texmf).not.toHaveBeenCalledBefore(
      jest.mocked(Tlmgr.Path.prototype.add),
    );
  },
);

it.each<[CacheType]>([['primary'], ['secondary']])(
  'adjusts old settings if they are not appropriate (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    ctx.inputs.texmf.TEXMFHOME = '<new>';
    // eslint-disable-next-line jest/unbound-method
    const tlmgr = jest.mocked<any>(Tlmgr.Conf.prototype.texmf);
    tlmgr.mockResolvedValue('<old>');
    await expect(action.run()).toResolve();
    expect(tlmgr).toHaveBeenCalledWith('TEXMFHOME', '<new>');
    tlmgr.mockReset();
  },
);

it.each<[CacheType]>([['primary'], ['secondary']])(
  'does not modify old settings if not necessary (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    ctx.inputs.texmf.TEXMFHOME = '<old>';
    // eslint-disable-next-line jest/unbound-method
    const tlmgr = jest.mocked<any>(Tlmgr.Conf.prototype.texmf);
    tlmgr.mockResolvedValue('<old>');
    await expect(action.run()).toResolve();
    expect(tlmgr).not.toHaveBeenCalledWith('TEXMFHOME', expect.anything());
    tlmgr.mockReset();
  },
);

it('does not setup tlcontrib by default', async () => {
  await expect(action.run()).toResolve();
  expect(Tlmgr.Repository.prototype.add).not.toHaveBeenCalled();
  expect(Tlmgr.Pinning.prototype.add).not.toHaveBeenCalled();
});

it('sets up tlcontrib if input tlcontrib is true', async () => {
  ctx.inputs.tlcontrib = true;
  await expect(action.run()).toResolve();
  const {
    Path: { prototype: path },
    Pinning: { prototype: pinning },
    Repository: { prototype: repository },
  } = Tlmgr;
  expect(repository.add).not.toHaveBeenCalledBefore(jest.mocked(path.add));
  expect(repository.add).toHaveBeenCalledWith(expect.anything(), 'tlcontrib');
  expect(pinning.add).not.toHaveBeenCalledBefore(
    jest.mocked<(x: any) => unknown>(repository.add),
  );
  expect(pinning.add).toHaveBeenCalledWith('tlcontrib', '*');
});

it('does not install any packages by default', async () => {
  await expect(action.run()).toResolve();
  expect(Tlmgr.prototype.install).not.toHaveBeenCalled();
});

it('does not install new packages if full cache found', async () => {
  jest.mocked(util.restoreCache).mockResolvedValueOnce('primary');
  await expect(action.run()).toResolve();
});

it.each<[CacheType | undefined]>([['secondary'], [undefined]])(
  'installs specified packages if full cache not found (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    ctx.inputs.packages = new Set(['foo', 'bar', 'baz']);
    await expect(action.run()).toResolve();
    expect(Tlmgr.prototype.install).toHaveBeenCalled();
  },
);

it('saves TEXDIR to cache if cache key and texdir are set', async () => {
  jest.mocked(State).mockReturnValueOnce(
    { key: '<key>', texdir: '<texdir>', post: true } as unknown as State,
  );
  await expect(action.run()).toResolve();
  expect(util.saveCache).toHaveBeenCalled();
});
