// Credentiale S3 implicite (dev-infra / exemple MinIO). In productie aplicatia trebuie sa
// foloseasca cheia de serviciu limitata la bucket (deploy/storage/setup-minio-uploads.sh).
export const DEFAULT_S3_SECRETS: ReadonlySet<string> = new Set([
  'minioadmin',
  'miniosecret',
  'minio123',
  'password',
  'changeme',
]);

export function usesDefaultS3Credentials(accessKey: string, secretKey: string): boolean {
  return DEFAULT_S3_SECRETS.has(secretKey) || accessKey === 'minioadmin';
}
