declare module 'javascript-lp-solver' {
  export interface LPModel {
    optimize: string;
    opType: 'max' | 'min';
    constraints: Record<string, { max?: number; min?: number; equal?: number }>;
    variables: Record<string, Record<string, number>>;
  }
  const solver: { Solve(model: LPModel): Record<string, unknown> };
  export default solver;
}
