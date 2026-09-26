import { describe, it, expect, vi, afterEach } from 'vitest';
import { askAssistant } from '../lib/assistant';
import { RailTimeoutError } from '../lib/errors';

const SNAPSHOT = { id: 'order-1', status: 'Paid' };

function geminiOk(text: string): Response {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
  });
}

function geminiFail(status: number): Response {
  return new Response(JSON.stringify({ error: { code: status } }), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('askAssistant failover', () => {
  it('primary 200 answers with one call', async () => {
    const fetchMock = vi.fn(async () => geminiOk('Paid, ship next.'));
    vi.stubGlobal('fetch', fetchMock);
    const res = await askAssistant(SNAPSHOT, 'Where is my order?');
    expect(res.answer).toContain('Paid');
    expect(res.scope).toBe('order');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('gemini-3.8-flash');
  });

  it('primary 503 fails over to fallback once', async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(geminiFail(503))
      .mockResolvedValueOnce(geminiOk('All good.'));
    vi.stubGlobal('fetch', fetchMock);
    const res = await askAssistant(SNAPSHOT, 'Status?');
    expect(res.answer).toBe('All good.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('gemini-3.5-flash');
  });

  it('primary 429 does not reroute, throws 502-class error', async () => {
    const fetchMock = vi.fn(async () => geminiFail(429));
    vi.stubGlobal('fetch', fetchMock);
    await expect(askAssistant(SNAPSHOT, 'Status?')).rejects.toBeInstanceOf(RailTimeoutError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('empty model output degrades to refusal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => geminiOk('   ')));
    const res = await askAssistant(SNAPSHOT, 'Status?');
    expect(res.answer).toContain('only answer questions about this specific order');
  });
});
