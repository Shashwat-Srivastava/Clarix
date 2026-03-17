import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderHighlightedText } from './text-highlighter.jsx';

describe('renderHighlightedText', () => {
  it('uses the local highlight style when global and local queries overlap', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        renderHighlightedText('generate profile', [
          { query: 'generate', tone: 'global' },
          { query: 'generate', tone: 'local' },
        ]),
      ),
    );

    expect(markup).toContain('bg-yellow-300/60');
    expect(markup).not.toContain('bg-sky-300/55');
  });

  it('renders global and local highlights independently when they match different substrings', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        renderHighlightedText('generate profile basic', [
          { query: 'generate', tone: 'global' },
          { query: 'basic', tone: 'local' },
        ]),
      ),
    );

    expect(markup).toContain('bg-sky-300/55');
    expect(markup).toContain('bg-yellow-300/60');
  });
});
