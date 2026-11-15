import React from 'react';
import { Image, View } from 'react-native';
import { AppText } from './AppText';
import { ICON_LOGO } from '../config';

// logo.png is a 500px square whose visible mark only fills about 56% of the width
// (x 110 to 390), so the file carries roughly 22% transparent padding on each side.
// Laid out at face value, that padding reads as a wide gap before the wordmark.
// Drawing the image larger inside a clipped box of the visible width removes it, so
// the mark and "Connekyt" read as one logo.
const VISIBLE_WIDTH_RATIO = 0.56;

/** Logo mark and wordmark set as a single lockup. `size` is the visible mark height. */
export function BrandMark({ size, color, fontSize, fontWeight = '800' }: { size: number; color: string; fontSize: number; fontWeight?: '700' | '800' }) {
    const image = Math.round(size / VISIBLE_WIDTH_RATIO);
    const boxWidth = Math.round(size * 1.0);
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: boxWidth, height: size, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                <Image source={ICON_LOGO} style={{ width: image, height: image, flexShrink: 0 }} resizeMode="contain" />
            </View>
            <AppText variant="display" style={{ color, fontSize, fontWeight, marginLeft: Math.max(3, Math.round(size * 0.14)) }}>
                Connekyt
            </AppText>
        </View>
    );
}
