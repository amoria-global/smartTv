import Document, { Html, Head, Main, NextScript } from 'next/document';
import React from 'react';
import { CONFIG } from '../config';

class MyDocument extends Document {
    render() {
        return (
            <Html lang="en">
                <Head>
                    <meta name="description" content={CONFIG.welcomeMessage} />
                    <link rel="icon" href="/images/favicon.ico" sizes="any" />
                    {/* App-wide typeface (Pragati Narrow) lives in a real
                        global CSS file — see src/styles/fonts.css, imported
                        from _app.tsx. It can't go in this inline <style>:
                        React HTML-escapes the single quotes a multi-word
                        font-family needs, which the CSS parser then rejects. */}
                    {/* height:100% alone isn't enough: a `flex: 1` child only
                        stretches inside a flex *parent*. #__next is a plain
                        block div by default, so pages using flex:1 (nearly
                        all of them) were only as tall as their own content —
                        any page shorter than the viewport exposed the
                        browser's default white background below it. Making
                        #__next a column flex container (in addition to the
                        height:100% chain) is what actually makes flex:1
                        pages fill the screen. */}
                    <style>{`
                        html, body, #__next { height: 100%; margin: 0; }
                        #__next { display: flex; flex-direction: column; }
                        /* react-native-web's TextInput renders a real <input>,
                           but its style prop doesn't reliably suppress the
                           browser's own default focus outline (tried both
                           outlineWidth:0 and outline:'none' inline — neither
                           reached the actual DOM node). Every screen already
                           draws its own focus-ring border/glow around inputs,
                           so the native outline is always a redundant,
                           clashing rectangle on top of that — safe to kill
                           globally rather than fighting it screen by screen. */
                        input:focus { outline: none; }
                    `}</style>
                </Head>
                <body>
                    <Main />
                    <NextScript />
                </body>
            </Html>
        );
    }
}

export default MyDocument;
