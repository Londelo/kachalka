export class AppError extends Error {
  public readonly name: string = 'AppError';
  public readonly status: number;
  public readonly cause?: unknown;

  constructor(
    message: string,
    options?: { cause?: unknown; status?: number },
  ) {
    super(message);
    this.cause = options?.cause;
    this.status = options?.status ?? 500;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
    };
  }
}
