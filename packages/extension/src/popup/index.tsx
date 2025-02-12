// src/popup/index.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { Popup } from './Popup';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

const theme = createTheme({
    primaryColor: 'indigo',
    colors: {
        // Custom gradient colors - matching webapp
        brand: [
            '#F3EEFF',
            '#E4D9FF',
            '#D0BFFF',
            '#BCA5FF',
            '#A78BFF',
            '#9371FF',
            '#7F57FF',
            '#6B3DFF',
            '#5723FF',
            '#4309FF'
        ],
    },
    components: {
        Button: {
            defaultProps: {
                size: 'sm',
                color: 'brand',
            },
        },
    },
});

function App() {
    return (
        <MantineProvider theme={theme} defaultColorScheme="light">
            <Notifications />
            <Popup />
        </MantineProvider>
    );
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);