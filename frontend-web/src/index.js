import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Reset default browser styles
const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif; -webkit-font-smoothing: antialiased; }
  button { font-family: inherit; }
  input { font-family: inherit; }
`;
document.head.appendChild(style);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
