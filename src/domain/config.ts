export interface BuildArtifact {
  readonly config: Record<string, unknown>;
  readonly warnings: readonly string[];
}

export interface BuildResult {
  readonly outputPath: string;
  readonly warnings: readonly string[];
}
