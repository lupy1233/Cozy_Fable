import { usesDefaultS3Credentials } from './storage-credentials';

describe('usesDefaultS3Credentials', () => {
  it('flags the MinIO root defaults from dev-infra', () => {
    expect(usesDefaultS3Credentials('minioadmin', 'minioadmin')).toBe(true);
  });

  it('flags a known default secret even with another access key', () => {
    expect(usesDefaultS3Credentials('minio', 'miniosecret')).toBe(true);
    expect(usesDefaultS3Credentials('anything', 'changeme')).toBe(true);
  });

  it('flags the minioadmin access key whatever the secret', () => {
    expect(usesDefaultS3Credentials('minioadmin', 'a-rotated-but-still-root-secret')).toBe(true);
  });

  it('accepts a generated service-account key', () => {
    expect(usesDefaultS3Credentials('CZAPPKEYEXAMPLE00001', 'q8Zr0t3KfV1mXy7LpA2sWb9NcE4hJd6UgT5oRiQe')).toBe(false);
  });
});
