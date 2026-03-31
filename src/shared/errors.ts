export class PhaseZeroPlaceholderError extends Error {
  public constructor(message = "Feature not implemented in Phase 0.") {
    super(message);
    this.name = "PhaseZeroPlaceholderError";
  }
}
