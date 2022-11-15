export class FigmaInput {
  constructor(public file: string, public page?: string) { }

  static cast(path: string): FigmaInput {
    const [fileId, page] = path.split('/')
    return new FigmaInput(fileId, page)
  }
}
