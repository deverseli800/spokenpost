// src/popup/Popup.tsx
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
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
} from '@mantine/core';
import { IconAlertCircle, IconHeadphones } from '@tabler/icons-react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PopupState = {
    loading: boolean;
    currentUrl: string | null;
    audioUrl: string | null;
    convertStatus: 'idle' | 'converting' | 'done' | 'error';
    error: string | null;
};

export function Popup() {
    const [state, setState] = useState<PopupState>({
        loading: true,
        currentUrl: null,
        audioUrl: null,
        convertStatus: 'idle',
        error: null,
    });

    useEffect(() => {
        // Get current tab URL
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

        setState(prev => ({ ...prev, convertStatus: 'converting' }));

        try {
            // Get article content from current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.scripting.executeScript({
                target: { tabId: tab.id! },
                func: () => document.body.innerText,
            });

            const articleText = response[0].result;

            // Send to conversion API
            const convertResponse = await fetch('http://localhost:3000/api/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: state.currentUrl,
                    articleText,
                }),
            });

            if (!convertResponse.ok) {
                throw new Error('Conversion failed');
            }

            const data = await convertResponse.json();
            setState(prev => ({
                ...prev,
                audioUrl: data.audio_url,
                convertStatus: 'done',
            }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                error: 'Failed to convert article',
                convertStatus: 'error',
            }));
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
                            >
                                {state.convertStatus === 'converting' ? 'Converting...' : 'Convert to Audio'}
                            </Button>
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