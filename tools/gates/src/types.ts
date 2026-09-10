export type GateMode = 'quick' | 'full';

export interface GateResult {
  ok: boolean;
  messages: string[];
}

export interface Gate {
  key: string;
  name: string;
  description: string;
  modes: GateMode[];
  run(ctx: GateContext): Promise<GateResult>;
}

export interface GateContext {
  root: string;
  mode: GateMode;
}
