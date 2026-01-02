export const S3_BUCKET_NAME = import.meta.env.VITE_S3_BUCKET_NAME;

/**
 * @deprecated Use getPresignedUrl from uploadApi instead
 * This function is kept for backward compatibility but will not work with private buckets
 */
export const getS3Url = (key: string): string => {
  if (!S3_BUCKET_NAME) {
    throw new Error('VITE_S3_BUCKET_NAME environment variable is not set');
  }
  // Note: This will not work with private buckets - use presigned URLs instead
  return `https://${S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;
};

