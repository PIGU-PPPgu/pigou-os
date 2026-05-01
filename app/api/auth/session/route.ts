import { NextResponse } from 'next/server';
import { SESSION_COOKIE, createSessionToken, getLoginPassword, getSessionUser, sessionMaxAge, verifyPassword } from '@/lib/auth';

export const runtime = 'nodejs';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionMaxAge
  };
}

export async function GET(request: Request) {
  const user = getSessionUser(request);
  return NextResponse.json({ ok: Boolean(user), user });
}

export async function POST(request: Request) {
  if (!getLoginPassword()) {
    return NextResponse.json({ ok: false, message: 'PIGOU_LOGIN_PASSWORD is not configured.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!verifyPassword(password)) {
    return NextResponse.json({ ok: false, message: '密码不对。' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, user: { id: 'pigou', name: 'Pigou' } });
  response.cookies.set(SESSION_COOKIE, createSessionToken(), cookieOptions());
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
  return response;
}
