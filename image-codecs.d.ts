declare module "*.wasm?module" {
  const module: WebAssembly.Module;
  export default module;
}
declare module "omggif" {
  export class GifReader {
    constructor(data: Uint8Array);
    width: number;
    height: number;
    decodeAndBlitFrameRGBA(frame: number, data: Uint8Array): void;
  }
}
