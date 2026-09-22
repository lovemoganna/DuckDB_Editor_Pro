export interface TutorialContentSource {
  id: string;
  docPath: string;
  isUserTutorial?: boolean;
}

interface DocumentResponse {
  ok: boolean;
  status?: number;
  statusText?: string;
  text(): Promise<string>;
}

export interface TutorialContentLoaderDependencies {
  signal: AbortSignal;
  fetchDocument: (path: string, init: { signal: AbortSignal }) => Promise<DocumentResponse>;
  getUserContent: (tutorialId: string) => Promise<string | null | undefined>;
  getEmbeddedContent: (tutorialId: string) => string;
}

const MIN_TUTORIAL_LENGTH = 100;

function requireUsableContent(content: string | null | undefined): string {
  if (!content || content.length <= MIN_TUTORIAL_LENGTH) {
    throw new Error('Tutorial content is unavailable or incomplete');
  }
  return content;
}

export async function loadTutorialContent(
  tutorial: TutorialContentSource,
  dependencies: TutorialContentLoaderDependencies,
): Promise<string> {
  if (tutorial.isUserTutorial) {
    return requireUsableContent(await dependencies.getUserContent(tutorial.id));
  }

  try {
    const response = await dependencies.fetchDocument(tutorial.docPath, {
      signal: dependencies.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status ?? 0}: ${response.statusText ?? 'request failed'}`);
    }
    return requireUsableContent(await response.text());
  } catch (error) {
    if (dependencies.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      throw error;
    }
    return requireUsableContent(dependencies.getEmbeddedContent(tutorial.id));
  }
}
