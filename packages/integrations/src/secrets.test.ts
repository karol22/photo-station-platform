import { inspect } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { SecretHandle, parseSecretsFile, resolveSecret } from './secrets';

const NAME = 'PROVIDER_ONE_CREDENTIAL';
const VALUE = 'plain-text-value-only-for-this-test';

describe('SecretHandle', () => {
  it('nunca revela el valor en conversiones implícitas', () => {
    const handle = new SecretHandle(NAME, VALUE);
    const masked = `[secreto:${NAME}]`;
    expect(String(handle)).toBe(masked);
    expect(`${handle}`).toBe(masked);
    expect([handle].join(',')).toBe(masked);
    expect(JSON.stringify(handle)).toBe(JSON.stringify(masked));
    expect(JSON.stringify({ handle })).toBe(`{"handle":"${masked}"}`);
    expect(inspect(handle)).toBe(masked);
    expect(Object.keys(handle)).toEqual(['name']);
    expect(Object.prototype.toString.call(handle)).toBe('[object SecretHandle]');
    for (const rendering of [String(handle), JSON.stringify({ handle }), inspect(handle), inspect({ handle }, { depth: 5 })]) {
      expect(rendering).not.toContain(VALUE);
    }
  });

  it('reveal() devuelve el valor', () => {
    expect(new SecretHandle(NAME, VALUE).reveal()).toBe(VALUE);
  });
});

describe('resolveSecret', () => {
  const envName = 'PSP_INTEGRATIONS_TEST_ONLY';
  afterEach(() => {
    delete process.env[envName];
  });

  it('busca primero en env y luego en file', () => {
    const fromEnv = resolveSecret(NAME, { env: { [NAME]: 'from-env' }, file: { [NAME]: 'from-file' } });
    expect(fromEnv?.reveal()).toBe('from-env');
    const fromFile = resolveSecret(NAME, { env: {}, file: { [NAME]: 'from-file' } });
    expect(fromFile?.reveal()).toBe('from-file');
    expect(fromFile?.name).toBe(NAME);
  });

  it('valores vacíos cuentan como ausentes', () => {
    expect(resolveSecret(NAME, { env: { [NAME]: '' }, file: { [NAME]: 'from-file' } })?.reveal()).toBe('from-file');
    expect(resolveSecret(NAME, { env: { [NAME]: '' }, file: {} })).toBeUndefined();
    expect(resolveSecret(NAME, { env: {}, file: {} })).toBeUndefined();
  });

  it('usa process.env por defecto', () => {
    expect(resolveSecret(envName)).toBeUndefined();
    process.env[envName] = 'from-process-env';
    expect(resolveSecret(envName)?.reveal()).toBe('from-process-env');
    expect(resolveSecret(envName, { env: {} })).toBeUndefined();
  });
});

describe('parseSecretsFile', () => {
  it('acepta un objeto plano de cadenas y rechaza lo demás', () => {
    expect(parseSecretsFile('{"A":"1","B":"2"}')).toEqual({ A: '1', B: '2' });
    expect(() => parseSecretsFile('[]')).toThrow(TypeError);
    expect(() => parseSecretsFile('{"A":1}')).toThrow(TypeError);
    expect(() => parseSecretsFile('null')).toThrow(TypeError);
  });
});
