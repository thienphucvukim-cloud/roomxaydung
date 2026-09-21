declare module "tinode-sdk" {
  export class Tinode {
    constructor(config: Record<string, unknown>);
  }
  export const Drafty: { toPlainText(content: unknown): string };
}