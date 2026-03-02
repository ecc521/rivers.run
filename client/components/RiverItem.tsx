import React from 'react';
import { View, Text, StyleSheet, Pressable, useColorScheme } from 'react-native';
import { River } from '../models/River';
import { calculateColor } from '../utils/FlowCalculations';

interface RiverItemProps {
    river: River;
    index: number;
    onPress?: () => void;
}

export const RiverItem: React.FC<RiverItemProps> = React.memo(({ river, index, onPress }) => {
    const isDarkMode = useColorScheme() === 'dark';

    // Determine background color
    let backgroundColor = calculateColor(river.running, isDarkMode);
    if (!backgroundColor) {
        if (isDarkMode) {
             backgroundColor = index % 2 === 0 ? '#222222' : '#252525';
        } else {
             backgroundColor = index % 2 === 0 ? '#f4f4f4' : '#f7f7f7';
        }
    }

    const hasDam = !!river.dam;

    // Text colors
    const textColor = isDarkMode ? '#dddddd' : '#000000';

    return (
        <Pressable
            style={[styles.container, { backgroundColor }]}
            onPress={onPress}
        >
            <Text style={[styles.text, styles.name, { color: textColor }]} numberOfLines={2}>
                {river.name}
            </Text>

            <Text style={[styles.text, styles.section, { color: textColor }]} numberOfLines={2}>
                {river.section}
            </Text>

            <View style={styles.skillContainer}>
                <Text style={[styles.text, styles.skill, { color: textColor }]}>{river.skill}</Text>
            </View>

            <Text style={[styles.text, styles.class, { color: textColor }]} numberOfLines={1}>
                {river.class || ""}
            </Text>

            <View style={styles.ratingContainer}>
                 {river.rating === "Error" ? (
                     <Text style={[styles.stars, { opacity: 0.2, color: textColor }]}>☆☆☆☆☆</Text>
                 ) : (
                     <View style={styles.starWrapper}>
                         <Text style={[styles.stars, { position: 'absolute', color: textColor }]}>☆☆☆☆☆</Text>
                         <View style={{ width: `${(river.rating as number) * 20}%`, overflow: 'hidden' }}>
                             <Text style={[styles.stars, { color: 'gold' }]}>★★★★★</Text>
                         </View>
                     </View>
                 )}
            </View>

            <View style={styles.flowContainer}>
                <Text style={[styles.text, styles.flow, { color: textColor }]} numberOfLines={1}>
                    {river.flowString}
                </Text>
                {hasDam && <Text style={[styles.damText, { color: textColor }]}>Dam</Text>}
            </View>
        </Pressable>
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
        minHeight: 48,
        width: '100%',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ccc',
    },
    text: {
        fontSize: 12,
    },
    name: {
        flex: 2.4, // roughly 24%
        paddingRight: 4,
        fontWeight: 'bold',
    },
    section: {
        flex: 3, // roughly 30%
        paddingRight: 4,
    },
    skillContainer: {
        flex: 0.8, // roughly 8%
        alignItems: 'center',
        justifyContent: 'center',
    },
    skill: {
        textAlign: 'center',
    },
    class: {
        flex: 1.1, // roughly 11%
        textAlign: 'center',
    },
    ratingContainer: {
        flex: 2, // roughly 20%
        alignItems: 'center',
        justifyContent: 'center',
    },
    starWrapper: {
        width: 60, // approximate width for 5 chars
        height: 16,
        justifyContent: 'center',
    },
    stars: {
        fontSize: 12,
        letterSpacing: 0,
    },
    flowContainer: {
        flex: 2.5, // remaining
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    flow: {
        textAlign: 'right',
        fontSize: 11,
    },
    damText: {
        fontSize: 9,
        fontStyle: 'italic',
        textAlign: 'right',
        opacity: 0.7,
    }
});
