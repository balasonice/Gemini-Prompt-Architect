import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  return (
    <div className={`prose prose-slate dark:prose-invert max-w-none 
      prose-headings:font-bold 
      prose-a:text-primary-600 dark:prose-a:text-primary-400 
      prose-code:text-pink-600 dark:prose-code:text-pink-400
      prose-pre:bg-slate-900 dark:prose-pre:bg-slate-950 prose-pre:text-slate-50 
      prose-pre:border prose-pre:border-slate-800
      ${className}`}>
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline ? (
              <div className="relative group">
                <pre className={`${className} p-4 rounded-lg overflow-x-auto bg-slate-900 dark:bg-black text-slate-100 my-4 shadow-inner border border-slate-700 dark:border-slate-800`}>
                  <code {...props} className={match ? `language-${match[1]}` : ''}>
                    {children}
                  </code>
                </pre>
              </div>
            ) : (
              <code className="bg-slate-100 dark:bg-slate-800 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded text-sm font-mono border border-slate-200 dark:border-slate-700" {...props}>
                {children}
              </code>
            );
          },
          h1: ({ children }) => <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 mt-6 border-b pb-2 border-slate-200 dark:border-slate-800">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-3 mt-5 flex items-center gap-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2 mt-4">{children}</h3>,
          p: ({ children }) => <p className="mb-4 text-slate-600 dark:text-slate-300 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-outside ml-5 mb-4 text-slate-600 dark:text-slate-300 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ml-5 mb-4 text-slate-600 dark:text-slate-300 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary-500 pl-4 py-1 my-4 bg-indigo-50 dark:bg-primary-950/30 italic text-slate-700 dark:text-slate-300 rounded-r-md">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
