// src/popup/Popup.tsx
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { cleanHtml } from './utils/cleanHtml';
import {
    Title,
    Text,
    Button,
    Stack,
    LoadingOverlay,
    Alert,
    Paper,
    Container,
    Group,
    Progress,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconHeadphones, IconArticle } from '@tabler/icons-react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ArticleContent {
    title: string;
    author?: string | null;
    content: string;
}

type PopupState = {
    loading: boolean;
    currentUrl: string | null;
    audioUrl: string | null;
    convertStatus: 'idle' | 'converting' | 'done' | 'error';
    error: string | null;
    progress: number;
};

const getArticleContent = async (tab: chrome.tabs.Tab): Promise<ArticleContent> => {
    const response = await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        func: () => {
            // First try to use Mozilla's Readability library if available
            if (typeof window.Readability !== 'undefined') {
                const documentClone = document.cloneNode(true) as Document;
                const reader = new window.Readability(documentClone);
                const article = reader.parse();
                return article ? {
                    content: article.content,
                    title: article.title,
                    author: article.byline
                } : null;
            }

            // Fallback to basic HTML extraction
            const article = {
                title: document.querySelector('h1')?.innerText || document.title,
                author: document.querySelector('[rel="author"], .author, .byline')?.textContent?.trim(),
                content: ''
            };

            // Get main content area - adjust selectors based on common article patterns
            const mainContent = document.querySelector('article, [role="main"], main, .post-content, .article-content');
            if (mainContent) {
                // Clone to avoid modifying the actual page
                const contentClone = mainContent.cloneNode(true) as HTMLElement;

                // Remove unwanted elements
                const unwanted = contentClone.querySelectorAll(
                    'script, style, iframe, nav, footer, .ad, .social-share, .related-articles'
                );
                unwanted.forEach(el => el.remove());

                // Convert specific elements to text with markers
                const headings = contentClone.querySelectorAll('h1, h2, h3, h4, h5, h6');
                headings.forEach(h => {
                    const level = h.tagName[1];
                    h.textContent = `[h${level}]${h.textContent}[/h${level}]`;
                });

                const lists = contentClone.querySelectorAll('ul, ol');
                lists.forEach(list => {
                    const items = Array.from(list.querySelectorAll('li'))
                        .map(li => `• ${li.textContent}`)
                        .join('\n');
                    list.outerHTML = `\n${items}\n`;
                });

                article.content = contentClone.innerHTML;
            }

            return article;
        }
    });

    if (!response[0].result) {
        throw new Error('Failed to extract article content');
    }

    return response[0].result;
};

export function Popup() {
    const [state, setState] = useState<PopupState>({
        loading: true,
        currentUrl: null,
        audioUrl: null,
        convertStatus: 'idle',
        error: null,
        progress: 0,
    });

    useEffect(() => {
        // Get current tab URL and check if it's already converted
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const url = tabs[0]?.url;
            if (!url) return;

            setState(prev => ({ ...prev, currentUrl: url, loading: true }));

            try {
                // Check if URL already has audio version
                const response = await fetch(`http://localhost:3000/api/check?url=${encodeURIComponent(url)}`);
                const data = await response.json();

                if (data.exists) {
                    setState(prev => ({
                        ...prev,
                        audioUrl: data.article.audio_url,
                        convertStatus: 'done',
                        loading: false,
                    }));
                } else {
                    setState(prev => ({ ...prev, loading: false }));
                }
            } catch (error) {
                setState(prev => ({
                    ...prev,
                    error: 'Failed to check article status',
                    loading: false,
                }));
            }
        });
    }, []);

    const handleConvert = async () => {
        if (!state.currentUrl) return;

        setState(prev => ({
            ...prev,
            convertStatus: 'converting',
            progress: 10,
            error: null
        }));

        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Extract article content
            setState(prev => ({ ...prev, progress: 30 }));
            const articleContent = await getArticleContent(tab);

            // Show extraction success
            setState(prev => ({ ...prev, progress: 50 }));
            notifications.show({
                title: 'Content extracted',
                message: 'Converting to audio...',
                color: 'blue',
            });

            // Send to conversion API
            const convertResponse = await fetch('http://localhost:3000/api/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: state.currentUrl,
                    articleText: cleanHtml(typeof articleContent === 'string' ? articleContent : articleContent.content),
                    title: typeof articleContent === 'string' ? '' : articleContent.title,
                    author: typeof articleContent === 'string' ? '' : articleContent.author
                }),
            });

            if (!convertResponse.ok) {
                throw new Error('Conversion failed');
            }

            setState(prev => ({ ...prev, progress: 90 }));

            const data = await convertResponse.json();
            setState(prev => ({
                ...prev,
                audioUrl: data.audio_url,
                convertStatus: 'done',
                progress: 100,
            }));

            notifications.show({
                title: 'Success!',
                message: 'Article converted to audio',
                color: 'green',
            });
        } catch (error) {
            console.error('Conversion error:', error);
            setState(prev => ({
                ...prev,
                error: 'Failed to convert article. Please try again.',
                convertStatus: 'error',
                progress: 0,
            }));

            notifications.show({
                title: 'Error',
                message: 'Failed to convert article',
                color: 'red',
            });
        }
    };

    return (
        <Container p="md" w={320}>
            <LoadingOverlay visible={state.loading} />

            <Stack>
                <Group align="center">
                    <IconHeadphones size={24} color="var(--mantine-color-brand-6)" />
                    <Title order={3}>SpokenPost</Title>
                </Group>

                {state.error && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
                        {state.error}
                    </Alert>
                )}

                <Paper p="md" withBorder>
                    {state.audioUrl ? (
                        <Stack>
                            <Alert color="green" title="Audio Ready">
                                This article has been converted to audio
                            </Alert>
                            <Button
                                fullWidth
                                leftSection={<IconHeadphones size={16} />}
                                onClick={() => window.open(`http://localhost:3000/audio/${state.audioUrl}`)}
                            >
                                Listen Now
                            </Button>
                        </Stack>
                    ) : (
                        <Stack>
                            <Button
                                fullWidth
                                loading={state.convertStatus === 'converting'}
                                onClick={handleConvert}
                                disabled={state.convertStatus === 'converting'}
                                leftSection={<IconArticle size={16} />}
                            >
                                {state.convertStatus === 'converting' ? 'Converting...' : 'Convert to Audio'}
                            </Button>

                            {state.convertStatus === 'converting' && (
                                <Progress
                                    value={state.progress}
                                    size="sm"
                                    color="brand"
                                    animated
                                    label={`${state.progress}%`}
                                />
                            )}

                            <Text size="sm" c="dimmed">
                                Convert this article to audio for easy listening
                            </Text>
                        </Stack>
                    )}
                </Paper>
            </Stack>
        </Container>
    );
}