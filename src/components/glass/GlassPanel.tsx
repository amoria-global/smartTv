import React, { useContext } from 'react';
import { View, ViewStyle } from 'react-native';
import { ThemeContext } from '../../config';
import { glassSurface } from './glassStyle';
import { radii, spacing } from '../../config/tokens';

type Props = {
    children?: React.ReactNode;
    style?: ViewStyle;
    radius?: number;
    raised?: boolean;
    padding?: number;
};

/** A frosted glass panel. Use it for every grouped block of content on the TV. */
export function GlassPanel({ children, style, radius = radii.card, raised, padding = spacing.xl }: Props) {
    const { theme } = useContext(ThemeContext);
    return <View style={[glassSurface(theme.static, { radius, raised }), { padding }, style]}>{children}</View>;
}
