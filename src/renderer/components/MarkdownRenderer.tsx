import { lazy, memo, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const LazyMarkdownCodeBlock = lazy(() =>
  import('./MarkdownCodeBlock').then((module) => ({
    default: module.MarkdownCodeBlock,
  }))
);

const components: Components = {
  // Code blocks with syntax highlighting
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const codeString = String(children).replace(/\n$/, '');
    const isBlock = codeString.includes('\n') || language;

    if (isBlock) {
      return (
        <Suspense
          fallback={
            <pre className="bg-secondary rounded-lg p-4 overflow-x-auto my-2 text-sm">
              <code>{codeString}</code>
            </pre>
          }
        >
          <LazyMarkdownCodeBlock code={codeString} language={language} />
        </Suspense>
      );
    }

    // Inline code
    return (
      <code
        className="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono text-primary"
        {...props}
      >
        {children}
      </code>
    );
  },

  // Links
  a({ href, children, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
        {...props}
      >
        {children}
      </a>
    );
  },

  // Headings
  h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>,

  // Paragraphs
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,

  // Lists
  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="ml-2">{children}</li>,

  // Blockquotes
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground my-2">
      {children}
    </blockquote>
  ),

  // Tables
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border border-border rounded-lg">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-secondary">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-sm font-semibold border-b border-border">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm border-b border-border">{children}</td>
  ),

  // Horizontal rule
  hr: () => <hr className="my-4 border-border" />,

  // Strong and emphasis
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,

  // Pre (for code blocks without language)
  pre: ({ children }) => (
    <pre className="bg-secondary rounded-lg p-4 overflow-x-auto my-2 text-sm">
      {children}
    </pre>
  ),
};

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content prose prose-invert prose-sm max-w-none ${className || ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';
