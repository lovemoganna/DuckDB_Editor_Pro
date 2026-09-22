import { describe, expect, it, vi } from 'vitest';
import { loadTutorialContent } from './tutorialContentLoader';

const longContent = (label: string) => `# ${label}\n${'content '.repeat(20)}`;

describe('loadTutorialContent', () => {
  it('passes cancellation to document fetches', async () => {
    const controller = new AbortController();
    const fetchDocument = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => longContent('Fetched'),
    });

    await loadTutorialContent(
      { id: 'lesson', docPath: '/lesson.md', isUserTutorial: false },
      {
        signal: controller.signal,
        fetchDocument,
        getUserContent: vi.fn(),
        getEmbeddedContent: vi.fn(),
      },
    );

    expect(fetchDocument).toHaveBeenCalledWith('/lesson.md', {
      signal: controller.signal,
    });
  });

  it('uses a valid embedded snapshot when the network document is unavailable', async () => {
    const embedded = longContent('Embedded');

    await expect(loadTutorialContent(
      { id: 'lesson', docPath: '/lesson.md', isUserTutorial: false },
      {
        signal: new AbortController().signal,
        fetchDocument: vi.fn().mockRejectedValue(new Error('offline')),
        getUserContent: vi.fn(),
        getEmbeddedContent: vi.fn(() => embedded),
      },
    )).resolves.toBe(embedded);
  });

  it('does not turn an aborted request into fallback content', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');

    await expect(loadTutorialContent(
      { id: 'lesson', docPath: '/lesson.md', isUserTutorial: false },
      {
        signal: new AbortController().signal,
        fetchDocument: vi.fn().mockRejectedValue(abortError),
        getUserContent: vi.fn(),
        getEmbeddedContent: vi.fn(() => longContent('Stale fallback')),
      },
    )).rejects.toMatchObject({ name: 'AbortError' });
  });
});
