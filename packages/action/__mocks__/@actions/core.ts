import { vi } from 'vitest';

import type { InputOptions } from '@actions/core';

export const getInput = vi.fn(
  (name: string, options?: InputOptions): string => {
    const val =
      globalThis.process.env[`INPUT_${name.replace(/ /gu, '_').toUpperCase()}`]
        ?? '';
    if (options?.required === true && !val) {
      throw new Error(`Input required and not supplied: ${name}`);
    }
    return options?.trimWhitespace === false ? val : val.trim();
  },
);

export const getBooleanInput = vi.fn(
  (name: string, options?: InputOptions): boolean => {
    const trueValue = ['true', 'True', 'TRUE'];
    const falseValue = ['false', 'False', 'FALSE'];
    const val = getInput(name, options);
    if (trueValue.includes(val)) {
      return true;
    }
    if (falseValue.includes(val)) {
      return false;
    }
    throw new TypeError(
      `Input does not meet YAML 1.2 "Core Schema" specification: ${name}`,
    );
  },
);

export const addPath = vi.fn();
export const debug = vi.fn();
export const error = vi.fn();
export const exportVariable = vi.fn();
export const getState = vi.fn().mockReturnValue('');
export const group = vi.fn(async (name, fn) => await fn());
export const info = vi.fn();
export const isDebug = vi.fn().mockReturnValue(false);
export const notice = vi.fn();
export const saveState = vi.fn();
export const setFailed = vi.fn((error) => {
  throw new Error(`${error}`);
});
export const setOutput = vi.fn();
export const warning = vi.fn();
