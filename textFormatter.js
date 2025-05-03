/**
 * TextFormatter - Enhanced text formatting for AI outputs
 * This module provides advanced formatting capabilities for various text types
 */

class TextFormatter {
    /**
     * Format any AI-generated text with appropriate styling
     * @param {string} text - The raw text from the AI
     * @returns {string} Formatted HTML
     */
    static format(text) {
        if (!text) return '';
        
        // Check if the text is already in HTML format
        if (this.isCompleteHtml(text)) {
            // If it's already HTML, just ensure code blocks have copy buttons
            // and process any markdown code blocks that might be inside
            return this.processHtmlContent(text);
        }

        // Pre-process the text to identify and tag different sections
        text = this.preProcess(text);
        
        // Apply specific formatters to different content types
        text = this.formatCode(text);
        text = this.formatLists(text);
        text = this.formatTables(text);
        text = this.formatHeadings(text);
        text = this.formatBlockquotes(text);
        text = this.formatInlineElements(text);
        text = this.formatParagraphs(text);
        
        return text;
    }
    
    /**
     * Check if the text already appears to be complete HTML
     */
    static isCompleteHtml(text) {
        // Look for HTML document structure or significant HTML tags
        const htmlIndicators = [
            /<html/i,
            /<body/i,
            /<div/i,
            /<p>[\s\S]*?<\/p>/i,
            /<h[1-6]>[\s\S]*?<\/h[1-6]>/i,
            /<ul>[\s\S]*?<\/ul>/i,
            /<ol>[\s\S]*?<\/ol>/i,
            /<table>[\s\S]*?<\/table>/i
        ];
        
        // Check if text contains multiple HTML elements
        let htmlElements = 0;
        for (const pattern of htmlIndicators) {
            if (pattern.test(text)) {
                htmlElements++;
            }
            // If we find 2 or more HTML elements, consider it HTML
            if (htmlElements >= 2) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Process HTML content that may contain markdown code blocks
     */
    static processHtmlContent(html) {
        // Process markdown code blocks that might be inside the HTML
        // The AI might still use markdown style code blocks inside otherwise HTML responses
        html = html.replace(/```(\w*)([\s\S]*?)```/g, (match, language, code) => {
            // Clean the code by removing any extra whitespace at start and end
            let cleanCode = code.trim();
            
            // Format the code with proper indentation preserved
            const formattedCode = this.formatCodeByLanguage(cleanCode, language);
            
            // Return as proper HTML
            return `<pre data-language="${language}" class="copy-enabled"><code class="language-${language}">${formattedCode}</code></pre>`;
        });
        
        return html;
    }

    /**
     * Pre-process text to identify different content types
     */
    static preProcess(text) {
        // Add content-type markers for special formats
        
        // First, protect code blocks as they should be processed differently
        text = this.preserveCodeBlocks(text);
        
        // Identify poetry blocks (indented text with short lines)
        text = this.identifyPoetry(text);
        
        // Identify terminal/console output
        text = this.identifyTerminalOutput(text);
        
        return text;
    }

    /**
     * Preserve code blocks from other transformations
     */
    static preserveCodeBlocks(text) {
        const codeBlockRegex = /```(\w*)([\s\S]*?)```/g;
        
        // Replace code blocks with a placeholder that won't be affected by other formatting
        let codeBlocks = [];
        let index = 0;
        
        text = text.replace(codeBlockRegex, (match, language, code) => {
            const placeholder = `__CODE_BLOCK_${index}__`;
            codeBlocks.push({
                placeholder, 
                language: language.trim(), 
                code: code.trim()
            });
            index++;
            return placeholder;
        });
        
        // Store code blocks for later restoration
        this.codeBlocks = codeBlocks;
        
        return text;
    }

    /**
     * Identify poetry blocks (indented text with short lines)
     */
    static identifyPoetry(text) {
        // Look for patterns that might indicate poetry:
        // - Multiple short lines (< 50 chars)
        // - Consistent indentation
        // - Limited punctuation at line end
        
        const lines = text.split('\n');
        let inPotentialPoem = false;
        let poemLines = [];
        let result = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isShortLine = line.trim().length > 0 && line.trim().length < 50;
            const hasLimitedPunctuation = !line.trim().match(/[.!?]$/) || line.trim().match(/[,;:]$/);
            
            // Potential poetry line
            if (isShortLine && hasLimitedPunctuation) {
                if (!inPotentialPoem) {
                    inPotentialPoem = true;
                }
                poemLines.push(line);
            } 
            // End of potential poem
            else if (inPotentialPoem) {
                // If we have at least 3 lines, consider it poetry
                if (poemLines.length >= 3) {
                    result.push(`<poetry>\n${poemLines.join('\n')}\n</poetry>`);
                } else {
                    result.push(poemLines.join('\n'));
                }
                result.push(line);
                inPotentialPoem = false;
                poemLines = [];
            } 
            else {
                result.push(line);
            }
        }
        
        // Handle any remaining poem lines
        if (inPotentialPoem && poemLines.length >= 3) {
            result.push(`<poetry>\n${poemLines.join('\n')}\n</poetry>`);
        } else if (poemLines.length > 0) {
            result.push(poemLines.join('\n'));
        }
        
        return result.join('\n');
    }

    /**
     * Identify terminal/console output
     */
    static identifyTerminalOutput(text) {
        // Patterns that might indicate terminal output:
        // - Command prompts ($ or > at beginning of lines)
        // - Output with system paths
        // - Multiple lines with similar formatting
        
        const terminalPatterns = [
            /^\s*[$>]\s+\w+/gm,                           // Command prompts
            /^\s*\[[^\]]+\]\s+/gm,                         // Log lines with brackets
            /^(INFO|WARNING|ERROR|DEBUG):/gm,              // Log levels
            /^(user@[\w\-]+:~[$#>])/gm                     // Bash-like prompts
        ];
        
        let isTerminalOutput = false;
        for (const pattern of terminalPatterns) {
            const matches = text.match(pattern) || [];
            if (matches.length >= 2) {  // At least 2 lines matching terminal patterns
                isTerminalOutput = true;
                break;
            }
        }
        
        if (isTerminalOutput) {
            return `<terminal>\n${text}\n</terminal>`;
        }
        
        return text;
    }

    /**
     * Format code blocks with syntax highlighting
     */
    static formatCode(text) {
        // Restore code blocks with proper formatting
        if (this.codeBlocks) {
            this.codeBlocks.forEach(({placeholder, language, code}) => {
                // Format the code based on language
                const formattedCode = this.formatCodeByLanguage(code, language);
                
                // Create a div-based code block with line numbers
                const lines = formattedCode.split('\n');
                let codeHtml = '<div class="code-block" data-language="' + language + '">';
                
                // Add a header with language and copy button
                codeHtml += '<div class="code-header">';
                codeHtml += '<span class="code-language">' + language + '</span>';
                codeHtml += '<button class="copy-code-button" title="Copy to clipboard"><i class="far fa-copy"></i> Copy</button>';
                codeHtml += '</div>';
                
                // Add the code content with line numbers
                codeHtml += '<div class="code-content">';
                codeHtml += '<div class="code-line-numbers">';
                for (let i = 1; i <= lines.length; i++) {
                    codeHtml += '<div class="line-number">' + i + '</div>';
                }
                codeHtml += '</div>';
                
                // Add the actual code with line breaks
                codeHtml += '<div class="code-lines">';
                lines.forEach(line => {
                    // Calculate the indentation as spaces at the beginning of the line
                    const indentMatch = line.match(/^(\s*)/);
                    const indentation = indentMatch ? indentMatch[0] : '';
                    // Replace indentation with non-breaking spaces for the data attribute
                    const indentAttribute = indentation.replace(/ /g, '\u00A0');
                    
                    // Remove the indentation from the visible line content
                    const content = line.substring(indentation.length);
                    
                    // If line is empty after removing indentation, add a non-breaking space
                    const lineContent = content.length === 0 ? '&nbsp;' : this.escapeHtml(content);
                    
                    // Add the line with indentation as a data attribute
                    codeHtml += `<div class="code-line" data-indent="${indentAttribute}">${lineContent}</div>`;
                });
                codeHtml += '</div>'; // Close code-lines
                codeHtml += '</div>'; // Close code-content
                codeHtml += '</div>'; // Close code-block
                
                // Replace placeholder with the new code block
                text = text.replace(placeholder, codeHtml);
            });
        }
        
        // Handle inline code
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Handle terminal output - also using the new approach
        text = text.replace(/<terminal>\n([\s\S]*?)\n<\/terminal>/g, (match, content) => {
            const lines = content.split('\n');
            let terminalHtml = '<div class="terminal-output">';
            
            // Add the terminal content with line breaks
            lines.forEach(line => {
                // Calculate the indentation
                const indentMatch = line.match(/^(\s*)/);
                const indentation = indentMatch ? indentMatch[0] : '';
                // Replace spaces with non-breaking spaces for the data attribute
                const indentAttribute = indentation.replace(/ /g, '\u00A0');
                
                // Remove the indentation from the visible line content
                const visibleContent = line.substring(indentation.length);
                
                // If line is empty after removing indentation, add a non-breaking space
                const lineContent = visibleContent.length === 0 ? '&nbsp;' : this.escapeHtml(visibleContent);
                
                // Add the line with indentation as a data attribute
                terminalHtml += `<div class="terminal-line" data-indent="${indentAttribute}">${lineContent}</div>`;
            });
            
            terminalHtml += '</div>';
            return terminalHtml;
        });
        
        return text;
    }
    
    /**
     * Format code with the appropriate language syntax
     */
    static formatCodeByLanguage(code, language) {
        // Escape HTML to prevent issues
        code = this.escapeHtml(code);
        
        // Add proper indentation and line breaks
        code = this.preserveIndentation(code);
        
        // Apply syntax highlighting based on language
        switch (language.toLowerCase()) {
            case 'javascript':
            case 'js':
                return this.highlightJavaScript(code);
            case 'python':
            case 'py':
                return this.highlightPython(code);
            case 'html':
                return this.highlightHTML(code);
            case 'css':
                return this.highlightCSS(code);
            case 'json':
                return this.highlightJSON(code);
            case 'bash':
            case 'sh':
                return this.highlightBash(code);
            default:
                return code;
        }
    }

    /**
     * Preserve code indentation
     */
    static preserveIndentation(code) {
        // Split into lines
        const lines = code.split('\n');
        
        // Find the minimum indentation across all non-empty lines
        let minIndent = Infinity;
        for (const line of lines) {
            if (line.trim().length === 0) continue;
            const indent = line.match(/^\s*/)[0].length;
            if (indent < minIndent) minIndent = indent;
        }
        
        // Remove common indentation but preserve relative indentation
        const normalizedLines = lines.map(line => {
            if (line.trim().length === 0) return '';
            return line.substring(Math.min(minIndent, line.match(/^\s*/)[0].length));
        });
        
        // Join with explicit newlines to preserve them in HTML
        return normalizedLines.join('\n');
    }

    /**
     * Format lists (ordered and unordered)
     */
    static formatLists(text) {
        // Handle unordered lists (*, -, +)
        text = this.formatUnorderedLists(text);
        
        // Handle ordered lists (1., 2., etc)
        text = this.formatOrderedLists(text);
        
        return text;
    }
    
    /**
     * Format unordered lists with proper HTML
     */
    static formatUnorderedLists(text) {
        // Find groups of unordered list items
        const listItemRegex = /^[\s]*[-*+][\s]+(.*?)$/gm;
        
        // First, mark list items
        text = text.replace(listItemRegex, '||UL_ITEM||$1');
        
        // Group consecutive list items into a single list
        const groups = text.split('\n');
        const result = [];
        let inList = false;
        
        for (let i = 0; i < groups.length; i++) {
            const line = groups[i];
            
            if (line.startsWith('||UL_ITEM||')) {
                if (!inList) {
                    inList = true;
                    result.push('<ul>');
                }
                result.push(`<li>${line.substring(11)}</li>`);
            } else {
                if (inList) {
                    inList = false;
                    result.push('</ul>');
                }
                result.push(line);
            }
        }
        
        // Close any open list
        if (inList) {
            result.push('</ul>');
        }
        
        return result.join('\n');
    }
    
    /**
     * Format ordered lists with proper HTML
     */
    static formatOrderedLists(text) {
        // Find groups of ordered list items
        const listItemRegex = /^[\s]*(\d+)\.[\s]+(.*?)$/gm;
        
        // First, mark list items
        text = text.replace(listItemRegex, '||OL_ITEM||$2');
        
        // Group consecutive list items into a single list
        const groups = text.split('\n');
        const result = [];
        let inList = false;
        
        for (let i = 0; i < groups.length; i++) {
            const line = groups[i];
            
            if (line.startsWith('||OL_ITEM||')) {
                if (!inList) {
                    inList = true;
                    result.push('<ol>');
                }
                result.push(`<li>${line.substring(11)}</li>`);
            } else {
                if (inList) {
                    inList = false;
                    result.push('</ol>');
                }
                result.push(line);
            }
        }
        
        // Close any open list
        if (inList) {
            result.push('</ol>');
        }
        
        return result.join('\n');
    }

    /**
     * Format tables
     */
    static formatTables(text) {
        // Regular expression to find Markdown tables
        const tableRegex = /^\|(.+)\|[\s]*$/gm;
        const separatorRegex = /^\|[\s]*(?::?[-]+:?[\s]*\|)+[\s]*$/gm;
        
        // First, find all table separators
        const separators = [];
        let match;
        while ((match = separatorRegex.exec(text)) !== null) {
            separators.push(match.index);
        }
        
        // Process only if we find separator rows
        if (separators.length > 0) {
            // Split the text into lines for processing
            const lines = text.split('\n');
            
            for (let sepIndex of separators) {
                // Find the header line (before separator)
                let lineIndex = 0;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].match(separatorRegex)) {
                        if (i > 0 && lines[i-1].match(tableRegex)) {
                            // Convert the header line, separator, and any following table rows
                            let tableStartIndex = i - 1;
                            let tableEndIndex = i + 1;
                            
                            // Find how far the table extends
                            while (tableEndIndex < lines.length && lines[tableEndIndex].match(tableRegex)) {
                                tableEndIndex++;
                            }
                            
                            // If we found a valid table with header, separator, and at least one row
                            if (tableEndIndex > i) {
                                // Convert header
                                let headerCells = this.parseTableRow(lines[tableStartIndex]);
                                let headerHtml = '<thead><tr>' + 
                                    headerCells.map(cell => `<th>${cell}</th>`).join('') + 
                                    '</tr></thead>';
                                
                                // Convert rows
                                let rowsHtml = '<tbody>';
                                for (let r = i + 1; r < tableEndIndex; r++) {
                                    let cells = this.parseTableRow(lines[r]);
                                    rowsHtml += '<tr>' + 
                                        cells.map(cell => `<td>${cell}</td>`).join('') + 
                                        '</tr>';
                                }
                                rowsHtml += '</tbody>';
                                
                                // Replace the original table text with HTML
                                const tableHtml = `<table class="table">${headerHtml}${rowsHtml}</table>`;
                                lines.splice(tableStartIndex, tableEndIndex - tableStartIndex, tableHtml);
                                
                                // Adjust line index after replacement
                                break;
                            }
                        }
                    }
                    lineIndex++;
                }
            }
            
            text = lines.join('\n');
        }
        
        return text;
    }
    
    /**
     * Parse a table row into cells
     */
    static parseTableRow(row) {
        // Remove the first and last pipe characters
        row = row.trim();
        if (row.startsWith('|')) row = row.substring(1);
        if (row.endsWith('|')) row = row.substring(0, row.length - 1);
        
        // Split by pipe character and trim each cell
        return row.split('|').map(cell => cell.trim());
    }

    /**
     * Format headings (# Heading 1, ## Heading 2, etc.)
     */
    static formatHeadings(text) {
        // Replace headings
        text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        
        return text;
    }

    /**
     * Format blockquotes
     */
    static formatBlockquotes(text) {
        // Handle multi-line blockquotes
        const lines = text.split('\n');
        const result = [];
        let inBlockquote = false;
        let blockquoteContent = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.match(/^>\s*(.*)/)) {
                const content = line.replace(/^>\s*(.*)/, '$1');
                if (!inBlockquote) {
                    inBlockquote = true;
                }
                blockquoteContent.push(content);
            } else {
                if (inBlockquote) {
                    inBlockquote = false;
                    result.push(`<blockquote>${blockquoteContent.join('<br>')}</blockquote>`);
                    blockquoteContent = [];
                }
                result.push(line);
            }
        }
        
        // Handle any remaining blockquote content
        if (inBlockquote) {
            result.push(`<blockquote>${blockquoteContent.join('<br>')}</blockquote>`);
        }
        
        return result.join('\n');
    }

    /**
     * Format inline elements (bold, italic, links)
     */
    static formatInlineElements(text) {
        // Bold
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
        
        // Italic
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/_(.*?)_/g, '<em>$1</em>');
        
        // Links
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Strikethrough
        text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');
        
        // Horizontal rule
        text = text.replace(/^\-\-\-+$/gm, '<hr>');
        text = text.replace(/^\*\*\*+$/gm, '<hr>');
        
        return text;
    }

    /**
     * Format paragraphs
     */
    static formatParagraphs(text) {
        // Handle poetry blocks with special formatting
        text = text.replace(/<poetry>\n([\s\S]*?)\n<\/poetry>/g, (match, content) => {
            const formattedContent = content
                .split('\n')
                .map(line => line.trim())
                .join('<br>');
                
            return `<div class="poetry">${formattedContent}</div>`;
        });
        
        // Make sure paragraphs are formatted correctly
        // Replace double newlines with paragraph breaks, excluding HTML elements
        const chunks = text.split(/\n\s*\n/);
        
        return chunks.map(chunk => {
            // Skip wrapping if it's already an HTML element or empty
            if (chunk.trim() === '' || 
                chunk.trim().startsWith('<') && chunk.trim().endsWith('>')) {
                return chunk;
            }
            
            // Wrap text in paragraph tags
            return `<p>${chunk}</p>`;
        }).join('\n\n');
    }

    /**
     * JavaScript syntax highlighting
     */
    static highlightJavaScript(code) {
        // Keywords
        const keywords = ['var', 'let', 'const', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'try', 'catch', 'throw', 'finally', 'class', 'extends', 'super', 'import', 'export', 'from', 'as', 'async', 'await', 'of', 'in'];
        
        // Special values
        const values = ['true', 'false', 'null', 'undefined', 'NaN', 'Infinity'];
        
        // Built-in objects
        const objects = ['Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Math', 'RegExp', 'Map', 'Set', 'Promise', 'JSON'];
        
        // Apply highlighting
        code = code
            // Highlight strings
            .replace(/(["'])(.*?)\1/g, '<span class="code-string">$1$2$1</span>')
            // Highlight comments
            .replace(/\/\/(.*?)(?:\n|$)/g, '<span class="code-comment">//$1</span>\n')
            .replace(/\/\*([\s\S]*?)\*\//g, '<span class="code-comment">/*$1*/</span>');
        
        // Highlight keywords
        keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            code = code.replace(regex, `<span class="code-keyword">${keyword}</span>`);
        });
        
        // Highlight values
        values.forEach(value => {
            const regex = new RegExp(`\\b${value}\\b`, 'g');
            code = code.replace(regex, `<span class="code-value">${value}</span>`);
        });
        
        // Highlight built-in objects
        objects.forEach(object => {
            const regex = new RegExp(`\\b${object}\\b`, 'g');
            code = code.replace(regex, `<span class="code-object">${object}</span>`);
        });
        
        // Highlight function calls
        code = code.replace(/(\w+)(\s*\()/g, '<span class="code-function">$1</span>$2');
        
        // Highlight numbers
        code = code.replace(/\b(\d+\.?\d*)\b/g, '<span class="code-number">$1</span>');
        
        return code;
    }

    /**
     * Python syntax highlighting
     */
    static highlightPython(code) {
        // Keywords
        const keywords = ['def', 'class', 'import', 'from', 'as', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'pass', 'break', 'continue', 'and', 'or', 'not', 'is', 'in', 'lambda', 'global', 'nonlocal', 'True', 'False', 'None', 'raise'];
        
        // Apply highlighting
        code = code
            // Highlight strings
            .replace(/(["'])(.*?)\1/g, '<span class="code-string">$1$2$1</span>')
            // Highlight triple-quoted strings
            .replace(/(?:""")([\s\S]*?)(?:""")/g, '<span class="code-string">"""$1"""</span>')
            .replace(/(?:''')/g, '<span class="code-string">\'\'\'</span>')
            // Highlight comments
            .replace(/#(.*?)(?:\n|$)/g, '<span class="code-comment">#$1</span>\n');
        
        // Highlight keywords
        keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            code = code.replace(regex, `<span class="code-keyword">${keyword}</span>`);
        });
        
        // Highlight function definitions
        code = code.replace(/\b(def)\s+(\w+)(\s*\()/g, '<span class="code-keyword">def</span> <span class="code-function">$2</span>$3');
        
        // Highlight class definitions
        code = code.replace(/\b(class)\s+(\w+)/g, '<span class="code-keyword">class</span> <span class="code-class">$2</span>');
        
        // Highlight numbers
        code = code.replace(/\b(\d+\.?\d*)\b/g, '<span class="code-number">$1</span>');
        
        return code;
    }

    /**
     * HTML syntax highlighting
     */
    static highlightHTML(code) {
        // Highlight tags
        code = code
            .replace(/(&lt;[\/]?)([\w\-]+)/g, '$1<span class="code-tag">$2</span>')
            .replace(/(&lt;)([\/]?[\w\-]+)([^&>]*?)(&gt;)/g, '<span class="code-bracket">$1</span><span class="code-tag">$2</span>$3<span class="code-bracket">$4</span>')
            // Highlight attributes
            .replace(/(\s+)([\w\-]+)=(".*?"|'.*?')/g, '$1<span class="code-attribute">$2</span>=<span class="code-string">$3</span>');
        
        return code;
    }

    /**
     * CSS syntax highlighting
     */
    static highlightCSS(code) {
        // Highlight CSS
        code = code
            // Highlight selectors
            .replace(/([.#][\w\-]+)/g, '<span class="code-selector">$1</span>')
            // Highlight properties
            .replace(/([\w\-]+)(\s*:)/g, '<span class="code-property">$1</span>$2')
            // Highlight values
            .replace(/(:)(\s*)([\w\-#]+)/g, '$1$2<span class="code-value">$3</span>')
            // Highlight units
            .replace(/(\d+)(px|em|rem|%|vh|vw|s|ms)/g, '<span class="code-number">$1</span><span class="code-unit">$2</span>')
            // Highlight comments
            .replace(/\/\*([\s\S]*?)\*\//g, '<span class="code-comment">/*$1*/</span>');
        
        return code;
    }

    /**
     * JSON syntax highlighting
     */
    static highlightJSON(code) {
        // Highlight JSON
        code = code
            // Highlight strings and keys
            .replace(/(".*?")(\s*:)/g, '<span class="code-key">$1</span>$2')
            .replace(/(".*?")/g, '<span class="code-string">$1</span>')
            // Highlight boolean and null
            .replace(/\b(true|false|null)\b/g, '<span class="code-value">$1</span>')
            // Highlight numbers
            .replace(/\b(\d+\.?\d*)\b/g, '<span class="code-number">$1</span>');
        
        return code;
    }

    /**
     * Bash syntax highlighting
     */
    static highlightBash(code) {
        // Keywords
        const keywords = ['if', 'then', 'else', 'elif', 'fi', 'case', 'esac', 'for', 'while', 'do', 'done', 'in', 'function', 'time', 'until', 'select', 'return', 'exit'];
        
        // Common commands
        const commands = ['echo', 'cd', 'ls', 'mkdir', 'rm', 'cp', 'mv', 'sudo', 'apt', 'yum', 'cat', 'grep', 'find', 'sed', 'awk', 'curl', 'wget', 'tar', 'ssh', 'systemctl', 'chmod', 'chown'];
        
        code = code
            // Highlight strings
            .replace(/(["'])(.*?)\1/g, '<span class="code-string">$1$2$1</span>')
            // Highlight comments
            .replace(/#(.*?)(?:\n|$)/g, '<span class="code-comment">#$1</span>\n')
            // Highlight variables
            .replace(/(\$\w+|\$\{.*?\})/g, '<span class="code-variable">$1</span>');
        
        // Highlight keywords
        keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            code = code.replace(regex, `<span class="code-keyword">${keyword}</span>`);
        });
        
        // Highlight commands
        commands.forEach(command => {
            const regex = new RegExp(`\\b${command}\\b`, 'g');
            code = code.replace(regex, `<span class="code-command">${command}</span>`);
        });
        
        // Highlight command prompt
        code = code.replace(/^(\$|>|\#)(.*?)$/gm, '<span class="code-prompt">$1</span>$2');
        
        return code;
    }

    /**
     * Helper function to escape HTML
     */
    static escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// Export the TextFormatter
window.TextFormatter = TextFormatter; 