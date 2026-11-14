import React from 'react';
import { View } from 'react-native';
import { AppText } from '../components/AppText';
import { themeStyles } from '../config';

export default function Page() {
    return (
        <View style={themeStyles.container}>
            <AppText variant="display" style={themeStyles.textH2}>This is custom 404!</AppText>
        </View>
    );
}
