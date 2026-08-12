import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';

// Think component for collapsible reasoning
const Think = ({ children, isCollapsed, onToggle }) => {
  return (
    <div className="think-container">
      <button 
        className="think-toggle" 
        onClick={onToggle}
        title={isCollapsed ? "Show reasoning" : "Hide reasoning"}
      >
        <span className="think-icon">🧠</span>
        <span className="think-text">
          {isCollapsed ? "Show reasoning" : "Hide reasoning"}
        </span>
        <span className={`think-arrow ${isCollapsed ? 'collapsed' : ''}`}>▼</span>
      </button>
      {!isCollapsed && (
        <div className="think-content">
          {children}
        </div>
      )}
    </div>
  );
};

// Component to render message content with think blocks
const MessageContent = ({ content, isStreaming = false }) => {
  const [collapsedThinks, setCollapsedThinks] = useState(new Set());

  const toggleThink = (index) => {
    setCollapsedThinks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Handle streaming think blocks (incomplete think tags)
  const renderContent = () => {
    const parts = [];
    let currentIndex = 0;
    let inThinkBlock = false;
    let thinkContent = '';
    let regularContent = '';
    
    // Process content character by character to handle incomplete think tags
    let i = 0;
    while (i < content.length) {
      if (content.substring(i, i + 7) === '<think>') {
        // Start of think block
        if (regularContent.trim()) {
          parts.push({
            type: 'regular',
            content: regularContent.trim(),
            index: currentIndex++
          });
          regularContent = '';
        }
        inThinkBlock = true;
        i += 7;
      } else if (content.substring(i, i + 8) === '</think>') {
        // End of think block
        if (thinkContent.trim()) {
          parts.push({
            type: 'think',
            content: thinkContent.trim(),
            index: currentIndex++
          });
        }
        inThinkBlock = false;
        thinkContent = '';
        i += 8;
      } else {
        // Regular character
        if (inThinkBlock) {
          thinkContent += content[i];
        } else {
          regularContent += content[i];
        }
        i++;
      }
    }
    
    // Handle any remaining content
    if (inThinkBlock && thinkContent.trim()) {
      // Incomplete think block (still streaming)
      parts.push({
        type: 'think',
        content: thinkContent.trim(),
        index: currentIndex++,
        isIncomplete: true
      });
    } else if (regularContent.trim()) {
      parts.push({
        type: 'regular',
        content: regularContent.trim(),
        index: currentIndex++
      });
    }
    
    return parts;
  };

  const contentParts = renderContent();
  
  return (
    <div className="message-content">
      {contentParts.map((part) => {
        if (part.type === 'think') {
          return (
            <Think
              key={part.index}
              isCollapsed={collapsedThinks.has(part.index)}
              onToggle={() => toggleThink(part.index)}
            >
              <div className="think-text-content">
                {part.content.split('\n').map((line, i) => (
                  <p key={i}>
                    {line}
                    {part.isIncomplete && i === part.content.split('\n').length - 1 && (
                      <span className="streaming-cursor">|</span>
                    )}
                  </p>
                ))}
              </div>
            </Think>
          );
        } else {
          return (
            <div key={part.index}>
              {part.content.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          );
        }
      })}
    </div>
  );
};

const SAMPLE_CODE = `// Example snippet shown on the right‑hand side
fetch(\`\${ollamaUrl}/api/chat\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: modelName,
    messages: [...messages, userMessage],
  }),
});`;

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [modelName, setModelName] = useState('');
  const [modelList, setModelList] = useState([]);
  const [code, setCode] = useState(SAMPLE_CODE);
  const [copied, setCopied] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingCode, setStreamingCode] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');
  const [abortController, setAbortController] = useState(null);
  const [wasStopped, setWasStopped] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editInput, setEditInput] = useState('');
  const [editedMessages, setEditedMessages] = useState(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewCss, setPreviewCss] = useState('');
  const [previewReact, setPreviewReact] = useState('');
  const [activePreviewTab, setActivePreviewTab] = useState('preview');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Only highlight code in the main code panel, not in preview
    const codeElements = document.querySelectorAll('.code-panel pre code:not(.preview-content code)');
    codeElements.forEach(element => {
      try {
        Prism.highlightElement(element);
      } catch (error) {
        console.warn('Prism highlighting failed:', error);
        // Fallback to plain text if highlighting fails
        element.className = 'language-plaintext';
      }
    });
  }, [code, streamingCode]);

  useEffect(() => {
    // Highlight preview content only when preview tabs change
    if (showPreview) {
      const previewCodeElements = document.querySelectorAll('.preview-content pre code');
      previewCodeElements.forEach(element => {
        try {
          Prism.highlightElement(element);
        } catch (error) {
          console.warn('Prism highlighting failed for preview:', error);
          // Fallback to plain text if highlighting fails
          element.className = 'language-plaintext';
        }
      });
    }
  }, [activePreviewTab, showPreview]);

  useEffect(() => {
    updatePreview();
  }, [code, streamingCode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const resizer = document.querySelector('.resizer');
    const left = document.querySelector('.left-panel');
    const right = document.querySelector('.right-panel');

    let isDragging = false;

    const onMouseDown = () => {
      isDragging = true;
      document.body.style.cursor = 'col-resize';
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const container = resizer.parentNode;
      const containerRect = container.getBoundingClientRect();
      const pointerX = e.clientX - containerRect.left;
      const containerWidth = container.offsetWidth;

      const leftWidth = (pointerX / containerWidth) * 100;
      const rightWidth = 100 - leftWidth;

      left.style.width = `${leftWidth}%`;
      right.style.width = `${rightWidth}%`;
    };

    const onMouseUp = () => {
      isDragging = false;
      document.body.style.cursor = 'default';
    };

    resizer.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      resizer.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);
    
    // Reset streaming states
    setStreamingCode('');
    setStreamingText('');
    setCurrentAssistantMessage('');
    setWasStopped(false);
    
    // Add a small delay to show the typing indicator briefly
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: [...messages, userMessage],
          stream: true,
          options: { temperature: 0.7, top_p: 0.9, repeat_penalty: 1.1 }
        }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`Error: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let inCodeBlock = false;
      let codeBlockContent = '';
      let textContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              const content = data.message.content;
              
              // Enhanced code block detection
              if (content.includes('```')) {
                const codeBlockStart = content.indexOf('```');
                const codeBlockEnd = content.lastIndexOf('```');
                
                if (!inCodeBlock) {
                  // Starting a code block
                  if (codeBlockStart !== codeBlockEnd) {
                    // Code block starts and ends in same chunk
                    inCodeBlock = false;
                    const codeStart = codeBlockStart + 3;
                    const firstNewline = content.indexOf('\n', codeStart);
                    const codeEnd = codeBlockEnd;
                    if (firstNewline !== -1 && codeEnd > firstNewline) {
                      const extractedCode = content.substring(firstNewline + 1, codeEnd);
                      console.log('Extracted code block:', extractedCode.substring(0, 100) + '...');
                      setStreamingCode(extractedCode);
                      setCode(extractedCode);
                    }
                  } else {
                    // Code block starts
                    inCodeBlock = true;
                    codeBlockContent = '';
                    const codeStart = codeBlockStart + 3;
                    const firstNewline = content.indexOf('\n', codeStart);
                    if (firstNewline !== -1) {
                      codeBlockContent = content.substring(firstNewline + 1);
                    }
                  }
                } else {
                  // Ending a code block
                  inCodeBlock = false;
                  const codeEnd = codeBlockEnd;
                  if (codeEnd !== -1) {
                    codeBlockContent += content.substring(0, codeEnd);
                  }
                  console.log('Completed code block:', codeBlockContent.substring(0, 100) + '...');
                  setStreamingCode(codeBlockContent);
                  setCode(codeBlockContent);
                }
              } else if (inCodeBlock) {
                // Inside a code block
                codeBlockContent += content;
                setStreamingCode(codeBlockContent);
              } else {
                // Check if this content looks like code even without code blocks
                const extractedCode = extractAnyCode(content);
                if (extractedCode) {
                  console.log('Extracted code from text:', extractedCode.substring(0, 100) + '...');
                  setStreamingCode(extractedCode);
                  setCode(extractedCode);
                } else {
                  // Regular text content
                  textContent += content;
                  setStreamingText(textContent);
                  setCurrentAssistantMessage(textContent);
                }
              }
            }
          } catch (e) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }

      // Finalize the response
      if (textContent.trim()) {
        setMessages((prev) => [...prev, { role: 'assistant', content: textContent.trim() }]);
      }
      
      if (codeBlockContent.trim()) {
        setCode(codeBlockContent.trim());
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        // Request was aborted by user, don't show error message
        console.log('Request was aborted by user');
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingCode('');
      setStreamingText('');
      setCurrentAssistantMessage('');
      setAbortController(null);
      setWasStopped(false);
    }
  };

  const checkOllamaConnection = async () => {
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`);
      if (!res.ok) throw new Error('Failed to fetch models');
      const data = await res.json();
      const models = data.models?.map((m) => m.name) || [];
      setModelList(models);
      if (models[0]) setModelName(models[0]);
      alert(`Connected! Models: ${models.join(', ')}`);
    } catch (e) {
      alert(`Connection failed: ${e.message}`);
    }
  };

  const copyCode = () => {
    const codeToCopy = isStreaming ? streamingCode : code;
    navigator.clipboard.writeText(codeToCopy)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(console.error);
  };

  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
    }
    setIsLoading(false);
    setIsStreaming(false);
    
    // Add a "Stopped" message if there was some content
    if (currentAssistantMessage.trim() || streamingCode.trim()) {
      const stoppedMessage = currentAssistantMessage.trim() 
        ? `${currentAssistantMessage.trim()}\n\n[Generation stopped by user]`
        : '[Generation stopped by user]';
      setMessages((prev) => [...prev, { role: 'assistant', content: stoppedMessage }]);
    }
    
    setStreamingCode('');
    setStreamingText('');
    setCurrentAssistantMessage('');
    setAbortController(null);
    setWasStopped(true);
  };

  const startEditing = (messageIndex) => {
    const message = messages[messageIndex];
    if (message.role === 'user') {
      setEditingMessage(messageIndex);
      setEditInput(message.content);
    }
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setEditInput('');
  };

  const extractHtmlAndCss = (code) => {
    if (!code) return { html: '', css: '', react: '' };
    
    let htmlParts = [];
    let cssParts = [];
    let reactParts = [];
    
    // Comprehensive patterns for all types of code extraction
    const patterns = [
      // HTML patterns
      { regex: /```html\s*([\s\S]*?)```/gi, type: 'html' },
      { regex: /```jsx\s*([\s\S]*?)```/gi, type: 'html' },
      { regex: /```xml\s*([\s\S]*?)```/gi, type: 'html' },
      { regex: /```vue\s*([\s\S]*?)```/gi, type: 'html' },
      
      // CSS patterns
      { regex: /```css\s*([\s\S]*?)```/gi, type: 'css' },
      { regex: /```scss\s*([\s\S]*?)```/gi, type: 'css' },
      { regex: /```sass\s*([\s\S]*?)```/gi, type: 'css' },
      { regex: /```less\s*([\s\S]*?)```/gi, type: 'css' },
      
      // JavaScript/TypeScript patterns
      { regex: /```javascript\s*([\s\S]*?)```/gi, type: 'js' },
      { regex: /```js\s*([\s\S]*?)```/gi, type: 'js' },
      { regex: /```typescript\s*([\s\S]*?)```/gi, type: 'js' },
      { regex: /```ts\s*([\s\S]*?)```/gi, type: 'js' },
      { regex: /```tsx\s*([\s\S]*?)```/gi, type: 'js' },
      
      // Python patterns
      { regex: /```python\s*([\s\S]*?)```/gi, type: 'python' },
      { regex: /```py\s*([\s\S]*?)```/gi, type: 'python' },
      
      // Java patterns
      { regex: /```java\s*([\s\S]*?)```/gi, type: 'java' },
      
      // C/C++ patterns
      { regex: /```c\s*([\s\S]*?)```/gi, type: 'c' },
      { regex: /```cpp\s*([\s\S]*?)```/gi, type: 'cpp' },
      { regex: /```c\+\+\s*([\s\S]*?)```/gi, type: 'cpp' },
      
      // Go patterns
      { regex: /```go\s*([\s\S]*?)```/gi, type: 'go' },
      
      // Rust patterns
      { regex: /```rust\s*([\s\S]*?)```/gi, type: 'rust' },
      
      // PHP patterns
      { regex: /```php\s*([\s\S]*?)```/gi, type: 'php' },
      
      // Ruby patterns
      { regex: /```ruby\s*([\s\S]*?)```/gi, type: 'ruby' },
      
      // Swift patterns
      { regex: /```swift\s*([\s\S]*?)```/gi, type: 'swift' },
      
      // Kotlin patterns
      { regex: /```kotlin\s*([\s\S]*?)```/gi, type: 'kotlin' },
      
      // SQL patterns
      { regex: /```sql\s*([\s\S]*?)```/gi, type: 'sql' },
      
      // Shell/Bash patterns
      { regex: /```bash\s*([\s\S]*?)```/gi, type: 'bash' },
      { regex: /```shell\s*([\s\S]*?)```/gi, type: 'bash' },
      { regex: /```sh\s*([\s\S]*?)```/gi, type: 'bash' },
      
      // JSON patterns
      { regex: /```json\s*([\s\S]*?)```/gi, type: 'json' },
      
      // YAML patterns
      { regex: /```yaml\s*([\s\S]*?)```/gi, type: 'yaml' },
      { regex: /```yml\s*([\s\S]*?)```/gi, type: 'yaml' },
      
      // Markdown patterns
      { regex: /```markdown\s*([\s\S]*?)```/gi, type: 'markdown' },
      { regex: /```md\s*([\s\S]*?)```/gi, type: 'markdown' },
      
      // Generic code blocks (catch-all for any language not specifically listed)
      { regex: /```(\w+)\s*([\s\S]*?)```/gi, type: 'generic' }
    ];
    
    // Extract content from code blocks
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(code)) !== null) {
        const content = match[1] || match[2]; // Handle both specific and generic patterns
        const language = match[1] || 'text'; // For generic patterns, get the language
        
        if (pattern.type === 'html') {
          htmlParts.push(content);
        } else if (pattern.type === 'css') {
          cssParts.push(content);
        } else if (pattern.type === 'js') {
          // Check if this is React/JSX code
          if (content.includes('import React') || content.includes('export default') || 
              content.includes('function') || content.includes('const') || 
              content.includes('return') || content.includes('jsx') || 
              content.includes('className') || content.includes('onClick')) {
            reactParts.push(content);
          } else {
            // Look for HTML in template literals or JSX-like content
            const templateRegex = /`([\s\S]*?)`/g;
            const jsxRegex = /<[^>]+>/g;
            
            if (content.includes('`') || content.match(jsxRegex)) {
              // Extract HTML-like content from JavaScript
              let templateMatch;
              while ((templateMatch = templateRegex.exec(content)) !== null) {
                const templateContent = templateMatch[1];
                if (templateContent.includes('<') && templateContent.includes('>')) {
                  htmlParts.push(templateContent);
                }
              }
            }
          }
        } else if (pattern.type === 'generic') {
          // For generic code blocks, add to appropriate category based on language
          if (['html', 'xml', 'vue'].includes(language.toLowerCase())) {
            htmlParts.push(content);
          } else if (['css', 'scss', 'sass', 'less'].includes(language.toLowerCase())) {
            cssParts.push(content);
          } else if (['javascript', 'js', 'typescript', 'ts', 'tsx'].includes(language.toLowerCase())) {
            if (content.includes('import React') || content.includes('export default') || 
                content.includes('function') || content.includes('const') || 
                content.includes('return') || content.includes('jsx') || 
                content.includes('className') || content.includes('onClick')) {
              reactParts.push(content);
            }
          }
        }
      }
    });
    
    // If no specific code blocks found, try generic extraction
    if (htmlParts.length === 0 && cssParts.length === 0) {
      // Look for complete HTML document structure
      const htmlDocRegex = /<html[^>]*>[\s\S]*?<\/html>/gi;
      const htmlMatch = code.match(htmlDocRegex);
      if (htmlMatch) {
        htmlParts.push(htmlMatch[0]);
      } else {
        // Look for body content
        const bodyRegex = /<body[^>]*>[\s\S]*?<\/body>/gi;
        const bodyMatch = code.match(bodyRegex);
        if (bodyMatch) {
          htmlParts.push(bodyMatch[0]);
        } else {
          // Look for main content sections
          const mainContentRegex = /<(div|section|main|header|footer|article|nav|aside)[^>]*>[\s\S]*?<\/\1>/gi;
          const mainMatches = code.match(mainContentRegex);
          if (mainMatches) {
            htmlParts.push(...mainMatches);
          }
        }
      }
      
      // Extract CSS from style tags
      const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
      let styleMatch;
      while ((styleMatch = styleTagRegex.exec(code)) !== null) {
        cssParts.push(styleMatch[1]);
      }
    }
    
    // Remove duplicates and clean up
    const uniqueHtml = [...new Set(htmlParts)].join('\n\n');
    const uniqueCss = [...new Set(cssParts)].join('\n\n');
    const uniqueReact = [...new Set(reactParts)].join('\n\n');
    
    // If we have HTML but no CSS, try to extract CSS from the HTML
    let finalCss = uniqueCss;
    if (uniqueHtml && !uniqueCss) {
      const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
      let styleMatch;
      const extractedStyles = [];
      while ((styleMatch = styleRegex.exec(uniqueHtml)) !== null) {
        extractedStyles.push(styleMatch[1]);
      }
      if (extractedStyles.length > 0) {
        finalCss = extractedStyles.join('\n\n');
      }
    }
    
    return { 
      html: uniqueHtml.trim(), 
      css: finalCss.trim(),
      react: uniqueReact.trim()
    };
  };

  // Enhanced function to extract any code from the response
  const extractAnyCode = (content) => {
    if (!content) return '';
    
    // Look for any code block pattern
    const codeBlockRegex = /```(?:\w+)?\s*([\s\S]*?)```/gi;
    const matches = [];
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      matches.push(match[1].trim());
    }
    
    // If no code blocks found, check if the entire content looks like code
    if (matches.length === 0) {
      // Check for common code indicators
      const codeIndicators = [
        /function\s+\w+\s*\(/i,
        /const\s+\w+\s*=/i,
        /let\s+\w+\s*=/i,
        /var\s+\w+\s*=/i,
        /import\s+/i,
        /export\s+/i,
        /class\s+\w+/i,
        /if\s*\(/i,
        /for\s*\(/i,
        /while\s*\(/i,
        /return\s+/i,
        /console\./i,
        /<[^>]+>/i, // HTML tags
        /[{}();]/i, // Code punctuation
      ];
      
      const isCode = codeIndicators.some(indicator => indicator.test(content)) &&
                    content.length > 20; // Minimum length to avoid false positives
      
      if (isCode) {
        return content.trim();
      }
    }
    
    return matches.join('\n\n');
  };

  // Function to detect the language of the code
  const detectLanguage = (code) => {
    if (!code) return 'javascript';
    
    // Check for language hints in code blocks first
    const languageMatch = code.match(/```(\w+)/);
    if (languageMatch) {
      const lang = languageMatch[1].toLowerCase();
      // Only return supported languages
      const supportedLanguages = ['javascript', 'js', 'jsx', 'typescript', 'ts', 'tsx', 'html', 'css', 'python', 'java', 'c', 'cpp', 'php', 'ruby', 'sql', 'bash', 'json', 'yaml', 'markup', 'xml'];
      if (supportedLanguages.includes(lang)) {
        return lang === 'js' ? 'javascript' : lang === 'ts' ? 'typescript' : lang;
      }
    }
    
    // Detect based on code content
    if (code.includes('import React') || code.includes('export default') || 
        code.includes('className') || code.includes('onClick') || 
        code.includes('useState') || code.includes('useEffect')) {
      return 'jsx';
    }
    
    if (code.includes('def ') || code.includes('import ') || code.includes('print(') || 
        code.includes('if __name__') || code.includes('class ') && code.includes(':')) {
      return 'python';
    }
    
    if (code.includes('public class') || code.includes('public static void') || 
        code.includes('System.out.println') || code.includes('import java.')) {
      return 'java';
    }
    
    if (code.includes('#include') || code.includes('int main') || 
        code.includes('printf') || code.includes('scanf')) {
      return 'c';
    }
    
    if (code.includes('#include') && (code.includes('iostream') || code.includes('vector') || 
        code.includes('std::') || code.includes('cout') || code.includes('cin'))) {
      return 'cpp';
    }
    
    if (code.includes('<?php') || code.includes('echo ') || code.includes('$')) {
      return 'php';
    }
    
    if (code.includes('def ') && code.includes('end') || code.includes('puts ') || 
        code.includes('require ') || code.includes('module ')) {
      return 'ruby';
    }
    
    if (code.includes('SELECT ') || code.includes('INSERT ') || code.includes('UPDATE ') || 
        code.includes('DELETE ') || code.includes('CREATE TABLE')) {
      return 'sql';
    }
    
    if (code.includes('#!/bin/bash') || code.includes('echo ') || code.includes('$') || 
        code.includes('if [') || code.includes('for ') && code.includes('in ')) {
      return 'bash';
    }
    
    if (code.includes('"') && code.includes(':') && code.includes('{') && code.includes('}')) {
      return 'json';
    }
    
    if (code.includes(':') && (code.includes('- ') || code.includes('---'))) {
      return 'yaml';
    }
    
    if (code.includes('<html') || code.includes('<div') || code.includes('<body')) {
      return 'markup';
    }
    
    if (code.includes('{') && code.includes('}') && code.includes(':')) {
      return 'css';
    }
    
    // Default to JavaScript
    return 'javascript';
  };

  const updatePreview = () => {
    const currentCode = isStreaming ? streamingCode : code;
    if (currentCode) {
      const { html, css, react } = extractHtmlAndCss(currentCode);
      console.log('=== Preview Extraction Debug ===');
      console.log('Original code length:', currentCode.length);
      console.log('Extracted HTML length:', html.length);
      console.log('Extracted CSS length:', css.length);
      console.log('Extracted React length:', react.length);
      console.log('HTML preview:', html.substring(0, 200) + (html.length > 200 ? '...' : ''));
      console.log('CSS preview:', css.substring(0, 200) + (css.length > 200 ? '...' : ''));
      console.log('React preview:', react.substring(0, 200) + (react.length > 200 ? '...' : ''));
      console.log('================================');
      setPreviewHtml(html);
      setPreviewCss(css);
      setPreviewReact(react);
    }
  };

  const handlePreviewTabChange = (tab) => {
    setActivePreviewTab(tab);
  };

  const saveEdit = async () => {
    if (!editInput.trim()) return;

    // Update the message content
    const updatedMessages = [...messages];
    updatedMessages[editingMessage] = { ...updatedMessages[editingMessage], content: editInput };
    setMessages(updatedMessages);
    
    // Mark this message as edited
    setEditedMessages(prev => new Set([...prev, editingMessage]));

    // Remove the assistant response that followed this message
    const messagesToKeep = updatedMessages.slice(0, editingMessage + 1);
    setMessages(messagesToKeep);

    // Cancel editing mode
    setEditingMessage(null);
    setEditInput('');

    // Resend the edited message
    const userMessage = { role: 'user', content: editInput };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setIsStreaming(true);
    
    // Reset streaming states
    setStreamingCode('');
    setStreamingText('');
    setCurrentAssistantMessage('');
    setWasStopped(false);
    
    // Add a small delay to show the typing indicator briefly
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: messagesToKeep,
          stream: true,
          options: { temperature: 0.7, top_p: 0.9, repeat_penalty: 1.1 }
        }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`Error: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let inCodeBlock = false;
      let codeBlockContent = '';
      let textContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              const content = data.message.content;
              
              // Enhanced code block detection
              if (content.includes('```')) {
                const codeBlockStart = content.indexOf('```');
                const codeBlockEnd = content.lastIndexOf('```');
                
                if (!inCodeBlock) {
                  // Starting a code block
                  if (codeBlockStart !== codeBlockEnd) {
                    // Code block starts and ends in same chunk
                    inCodeBlock = false;
                    const codeStart = codeBlockStart + 3;
                    const firstNewline = content.indexOf('\n', codeStart);
                    const codeEnd = codeBlockEnd;
                    if (firstNewline !== -1 && codeEnd > firstNewline) {
                      const extractedCode = content.substring(firstNewline + 1, codeEnd);
                      setStreamingCode(extractedCode);
                      setCode(extractedCode);
                    }
                  } else {
                    // Code block starts
                    inCodeBlock = true;
                    codeBlockContent = '';
                    const codeStart = codeBlockStart + 3;
                    const firstNewline = content.indexOf('\n', codeStart);
                    if (firstNewline !== -1) {
                      codeBlockContent = content.substring(firstNewline + 1);
                    }
                  }
                } else {
                  // Ending a code block
                  inCodeBlock = false;
                  const codeEnd = codeBlockEnd;
                  if (codeEnd !== -1) {
                    codeBlockContent += content.substring(0, codeEnd);
                  }
                  setStreamingCode(codeBlockContent);
                  setCode(codeBlockContent);
                }
              } else if (inCodeBlock) {
                // Inside a code block
                codeBlockContent += content;
                setStreamingCode(codeBlockContent);
              } else {
                // Check if this content looks like code even without code blocks
                const extractedCode = extractAnyCode(content);
                if (extractedCode) {
                  setStreamingCode(extractedCode);
                  setCode(extractedCode);
                } else {
                  // Regular text content
                  textContent += content;
                  setStreamingText(textContent);
                  setCurrentAssistantMessage(textContent);
                }
              }
            }
          } catch (e) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }

      // Finalize the response
      if (textContent.trim()) {
        setMessages((prev) => [...prev, { role: 'assistant', content: textContent.trim() }]);
      }
      
      if (codeBlockContent.trim()) {
        setCode(codeBlockContent.trim());
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        // Request was aborted by user, don't show error message
        console.log('Request was aborted by user');
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingCode('');
      setStreamingText('');
      setCurrentAssistantMessage('');
      setAbortController(null);
      setWasStopped(false);
    }
  };

  return (
    <div className="app">
      <div className="settings-panel">
        <h2>Arjun Coding Agent</h2>
        <div className="settings-row">
          <label>
            Ollama URL:
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
            />
          </label>
          <button onClick={checkOllamaConnection}>Test Connection</button>
        </div>

        <div className="settings-row">
          <label>
            Model Name:
            <select
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              disabled={modelList.length === 0}
            >
              {modelList.length === 0
                ? <option value="">No models found</option>
                : modelList.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="main-content">
        <div className="resizable-container">
          <div className="chat-container resizable-panel left-panel">
            <div className="messages">
              {messages.length === 0 ? (
                <div className="welcome-message">
                  <p>Welcome! Click <strong>Test Connection</strong> and start chatting.</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className={`message ${msg.role}`}>
                    {editingMessage === idx ? (
                      <div className="edit-mode">
                        <textarea
                          value={editInput}
                          onChange={(e) => setEditInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.ctrlKey && e.key === 'Enter') {
                              e.preventDefault();
                              saveEdit();
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelEditing();
                            }
                          }}
                          placeholder="Edit your message... (Ctrl+Enter to save, Esc to cancel)"
                          rows={Math.max(3, editInput.split('\n').length)}
                        />
                        <div className="edit-actions">
                          <button onClick={saveEdit} disabled={!editInput.trim() || isLoading}>
                            Save & Resend
                          </button>
                          <button onClick={cancelEditing} disabled={isLoading}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <MessageContent content={msg.content} />
                        {editedMessages.has(idx) && (
                          <span className="edited-indicator">(edited)</span>
                        )}
                        {msg.role === 'user' && !isLoading && !isStreaming && (
                          <button 
                            className="edit-button"
                            onClick={() => startEditing(idx)}
                            title="Edit this message"
                          >
                            ✏️ Edit
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
              {isLoading && (
                <div className="message assistant">
                  {currentAssistantMessage ? (
                    <MessageContent content={currentAssistantMessage} isStreaming={true} />
                  ) : (
                    <div className="typing-indicator"><span>●</span><span>●</span><span>●</span></div>
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="input-area">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message…"
                disabled={isLoading}
              />
              {isStreaming ? (
                <button type="button" onClick={stopGeneration} className="stop-button">
                  Stop
                </button>
              ) : (
                <button type="submit" disabled={isLoading || !input.trim()}>
                  Send
                </button>
              )}
            </form>
          </div>

          <div className="resizer" />

          <div className={`code-panel resizable-panel right-panel ${isStreaming ? 'streaming' : ''}`}>
            <div className="code-toolbar">
              <span>
                Code preview
                {(isStreaming ? streamingCode : code) && (
                  <span style={{ color: '#888', marginLeft: '8px', fontSize: '0.9em' }}>
                    ({(() => {
                      try {
                        return detectLanguage(isStreaming ? streamingCode : code);
                      } catch (error) {
                        console.warn('Language detection failed:', error);
                        return 'javascript';
                      }
                    })()})
                  </span>
                )}
                {isStreaming && <span style={{ color: '#00ff00', marginLeft: '8px' }}>● Live</span>}
                {wasStopped && <span style={{ color: '#ffc107', marginLeft: '8px' }}>● Stopped</span>}
              </span>
              <div className="code-toolbar-actions">
                <button 
                  onClick={() => {
                    setShowPreview(!showPreview);
                    // Re-highlight main code when preview is toggled off
                    if (showPreview) {
                      setTimeout(() => {
                        const codeElements = document.querySelectorAll('.code-panel pre code:not(.preview-content code)');
                        codeElements.forEach(element => {
                          Prism.highlightElement(element);
                        });
                      }, 100);
                    }
                  }}
                  className={`preview-toggle ${showPreview ? 'active' : ''}`}
                  title={showPreview ? 'Hide Preview' : 'Show Preview'}
                >
                  👁️ {showPreview ? 'Hide' : 'Preview'}
                </button>
                <button onClick={copyCode}>{copied ? 'Copied!' : 'Copy'}</button>
              </div>
            </div>
            {showPreview ? (
              <div className="preview-container">
                <div className="preview-frame">
                  <iframe
                    srcDoc={`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <meta charset="utf-8">
                          <meta name="viewport" content="width=device-width, initial-scale=1">
                          <style>
                            body { 
                              margin: 0; 
                              padding: 20px; 
                              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                              line-height: 1.6;
                              background: white;
                            }
                            ${previewCss}
                          </style>
                        </head>
                        <body>
                          ${previewHtml ? 
                            (previewHtml.includes('<html') ? 
                              previewHtml.replace(/<html[^>]*>[\s\S]*?<body[^>]*>|<\/body>[\s\S]*?<\/html>/gi, '') : 
                              previewHtml
                            ) : 
                            '<p>No HTML content found. Check the HTML tab to see extracted content.</p>'
                          }
                        </body>
                      </html>
                    `}
                    title="Code Preview"
                    sandbox="allow-scripts"
                    className="preview-iframe"
                  />
                </div>
                <div className="preview-info">
                  <div className="preview-tabs">
                    <button 
                      className={`preview-tab ${activePreviewTab === 'preview' ? 'active' : ''}`}
                      onClick={() => handlePreviewTabChange('preview')}
                    >
                      Preview
                    </button>
                    <button 
                      className={`preview-tab ${activePreviewTab === 'html' ? 'active' : ''}`}
                      onClick={() => handlePreviewTabChange('html')}
                    >
                      HTML {previewHtml && <span className="content-indicator">●</span>}
                    </button>
                    <button 
                      className={`preview-tab ${activePreviewTab === 'css' ? 'active' : ''}`}
                      onClick={() => handlePreviewTabChange('css')}
                    >
                      CSS {previewCss && <span className="content-indicator">●</span>}
                    </button>
                    <button 
                      className={`preview-tab ${activePreviewTab === 'react' ? 'active' : ''}`}
                      onClick={() => handlePreviewTabChange('react')}
                    >
                      React {previewReact && <span className="content-indicator">●</span>}
                    </button>
                  </div>
                  <div className="preview-content">
                    {activePreviewTab === 'preview' && (
                      <div className="preview-placeholder">
                        <p>Live preview is shown above</p>
                        {previewReact && (
                          <div className="react-notice">
                            <p>⚠️ React components detected. Live preview shows HTML/CSS only.</p>
                            <p>Check the React tab to view the component code.</p>
                          </div>
                        )}
                      </div>
                    )}
                    {activePreviewTab === 'html' && (
                      <pre><code className="language-markup">{previewHtml || 'No HTML found'}</code></pre>
                    )}
                    {activePreviewTab === 'css' && (
                      <pre><code className="language-css">{previewCss || 'No CSS found'}</code></pre>
                    )}
                    {activePreviewTab === 'react' && (
                      <div>
                        {previewReact ? (
                          <pre><code className="language-jsx">{previewReact}</code></pre>
                        ) : (
                          <div className="preview-placeholder">
                            <p>No React/JSX code found</p>
                            <p>Try asking the AI to generate React components</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <pre><code className={`language-${(() => {
                try {
                  return detectLanguage(isStreaming ? streamingCode : code);
                } catch (error) {
                  console.warn('Language detection failed:', error);
                  return 'javascript';
                }
              })()} ${isStreaming ? 'streaming' : ''}`}>{isStreaming ? streamingCode : code}</code></pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
