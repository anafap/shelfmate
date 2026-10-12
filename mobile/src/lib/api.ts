export async function getReadiness(): Promise<{ status: string }> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!baseUrl) throw new Error('Set EXPO_PUBLIC_API_URL in mobile/.env to connect.');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/health/ready`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('ShelfMate cannot reach its database. Please try again.');
  return response.json();
}
