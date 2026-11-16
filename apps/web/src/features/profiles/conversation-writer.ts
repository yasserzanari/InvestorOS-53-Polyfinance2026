/** Serialize idempotent snapshot PUTs so an older retry cannot overwrite a newer save. */
export function createConversationWriter(fetcher: typeof fetch, pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))) {
  let tail: Promise<unknown> = Promise.resolve();
  return (url: string, body: string) => {
    const write = tail.then(async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const response = await fetcher(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
          if (attempt === 3 || ![429, 500, 502, 503, 504].includes(response.status)) return response;
        } catch (error) {
          if (attempt === 3) throw error;
        }
        await pause(500 * (attempt + 1));
      }
    });
    tail = write.catch(() => undefined);
    return write;
  };
}
