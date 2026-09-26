/**
 * Minimal type declarations for `bs58` (v4 ships no types and there is no
 * @types/bs58 installed). Without this, `tsc` fails with TS7016 on the dynamic
 * `import('bs58')` in src/tools/governance-tools.ts.
 */
declare module "bs58" {
  export function encode(input: Uint8Array | number[]): string;
  export function decode(input: string): Uint8Array;
  const _default: { encode: typeof encode; decode: typeof decode };
  export default _default;
}
