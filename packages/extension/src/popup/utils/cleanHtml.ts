// src/popup/utils/cleanHtml.ts

/**
 * Clean HTML content by removing unnecessary attributes and classes
 * while preserving important structural elements
 */
function cleanHtml(html: string): string {
    // Create a temporary DOM element
    const template = document.createElement('div');
    template.innerHTML = html;

    // Function to clean a single element
    const cleanElement = (element: Element) => {
        // Remove all attributes except those we want to keep
        const attributesToKeep = ['href', 'src'];
        const attributes = element.attributes;
        const attributesToRemove = [];

        for (let i = 0; i < attributes.length; i++) {
            const attr = attributes[i];
            if (!attributesToKeep.includes(attr.name)) {
                attributesToRemove.push(attr.name);
            }
        }

        attributesToRemove.forEach(attr => {
            element.removeAttribute(attr);
        });

        // Clean child elements recursively
        element.childNodes.forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
                cleanElement(child as Element);
            }
        });
    };

    // Remove unwanted elements entirely
    const removeUnwanted = (root: Element) => {
        const unwantedSelectors = [
            'script',
            'style',
            'iframe',
            'noscript',
            'svg',
            'video',
            'button',
            'nav',
            'footer',
            '.ad',
            '.advertisement',
            '.social-share',
            '.comments',
            '[role="complementary"]',
            'aside',
        ];

        unwantedSelectors.forEach(selector => {
            root.querySelectorAll(selector).forEach(el => el.remove());
        });
    };

    // Clean the content
    removeUnwanted(template);
    cleanElement(template);

    // Convert specific elements to have proper structure
    const processHeadings = (root: Element) => {
        root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
            const level = heading.tagName.toLowerCase();
            heading.textContent = `[${level}]${heading.textContent?.trim()}[/${level}]`;
        });
    };

    const processLists = (root: Element) => {
        root.querySelectorAll('ul, ol').forEach(list => {
            const items = Array.from(list.querySelectorAll('li'))
                .map(li => `• ${li.textContent?.trim()}`)
                .join('\n');
            const div = document.createElement('div');
            div.textContent = `\n${items}\n`;
            list.replaceWith(div);
        });
    };

    processHeadings(template);
    processLists(template);

    // Get the cleaned HTML and do some final text cleanup
    let cleanedHtml = template.innerHTML
        // Remove empty elements
        .replace(/<[^/>][^>]*>\s*<\/[^>]+>/g, '')
        // Remove multiple blank lines
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        // Remove leftover HTML comments
        .replace(/<!--[\s\S]*?-->/g, '')
        // Trim whitespace
        .trim();

    return cleanedHtml;
}

export { cleanHtml };