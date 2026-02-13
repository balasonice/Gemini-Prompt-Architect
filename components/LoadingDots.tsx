import React from 'react';

export const LoadingDots: React.FC = () => {
  return (
    <div className="flex space-x-1 items-center justify-center p-4">
      <div className="w-2 h-2 bg-primary-600 dark:bg-primary-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-2 h-2 bg-primary-600 dark:bg-primary-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-2 h-2 bg-primary-600 dark:bg-primary-400 rounded-full animate-bounce"></div>
    </div>
  );
};
