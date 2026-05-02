import { handleInboxCapture } from '@/lib/inbox-capture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleInboxCapture(request, { integration: 'shortcut' });
}
