import type { CSSProperties } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';

interface MarkdownCodeBlockProps {
  code: string;
  language?: string;
}

const PRISM_LANGUAGE_ALIAS: Record<string, string> = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  cxx: 'cpp',
  cc: 'cpp',
};

let languagesRegistered = false;

function registerLanguages() {
  if (languagesRegistered) return;
  languagesRegistered = true;

  SyntaxHighlighter.registerLanguage('bash', bash);
  SyntaxHighlighter.registerLanguage('c', c);
  SyntaxHighlighter.registerLanguage('cpp', cpp);
  SyntaxHighlighter.registerLanguage('css', css);
  SyntaxHighlighter.registerLanguage('go', go);
  SyntaxHighlighter.registerLanguage('java', java);
  SyntaxHighlighter.registerLanguage('javascript', javascript);
  SyntaxHighlighter.registerLanguage('json', json);
  SyntaxHighlighter.registerLanguage('jsx', jsx);
  SyntaxHighlighter.registerLanguage('markdown', markdown);
  SyntaxHighlighter.registerLanguage('python', python);
  SyntaxHighlighter.registerLanguage('rust', rust);
  SyntaxHighlighter.registerLanguage('sql', sql);
  SyntaxHighlighter.registerLanguage('tsx', tsx);
  SyntaxHighlighter.registerLanguage('typescript', typescript);
  SyntaxHighlighter.registerLanguage('yaml', yaml);
}

function normalizeLanguage(language?: string) {
  if (!language) return 'text';
  const normalized = language.toLowerCase().trim();
  return PRISM_LANGUAGE_ALIAS[normalized] ?? normalized;
}

export function MarkdownCodeBlock({ code, language }: MarkdownCodeBlockProps) {
  registerLanguages();
  const normalizedLanguage = normalizeLanguage(language);

  return (
    <SyntaxHighlighter
      style={oneDark as Record<string, CSSProperties>}
      language={normalizedLanguage}
      PreTag="div"
      customStyle={{
        margin: 0,
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
      }}
    >
      {code}
    </SyntaxHighlighter>
  );
}
