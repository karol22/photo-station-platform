import { describe, expect, it } from 'vitest';
import { parseArgs } from './args';

describe('parseArgs', () => {
  it('separa posicionales y banderas', () => {
    const r = parseArgs(['bundle', '--machine=mch_1', '--json', '--count', '5']);
    expect(r.positional).toEqual(['bundle']);
    expect(r.flags).toEqual({ machine: 'mch_1', json: true, count: '5' });
  });
});
