import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, ActivityIndicator, useColorScheme, Platform, StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { River } from '../models/River';
import { DataService } from '../services/DataService';
import { RiverItem } from '../components/RiverItem';

export default function Index() {
    const [rivers, setRivers] = useState<River[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const isDarkMode = useColorScheme() === 'dark';

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async (refresh = false) => {
        if (!refresh) setLoading(true);
        else setRefreshing(true);

        try {
            const data = await DataService.getRivers(refresh);
            setRivers(data);
        } catch (e) {
            console.error("Failed to load data", e);
            // Optionally show error message
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        loadData(true);
    };

    const filteredRivers = useMemo(() => {
        if (!searchQuery) return rivers;
        const query = searchQuery.toLowerCase();
        return rivers.filter(r =>
            r.name.toLowerCase().includes(query) ||
            r.section.toLowerCase().includes(query)
        );
    }, [rivers, searchQuery]);

    const renderItem = ({ item, index }: { item: River, index: number }) => (
        <RiverItem river={item} index={index} />
    );

    const backgroundColor = isDarkMode ? '#090920' : '#dffaff';
    const textColor = isDarkMode ? '#dddddd' : '#000000';
    const searchBg = isDarkMode ? '#1e2021' : '#fff';
    const searchBorder = isDarkMode ? '#585858' : '#ccc';
    const placeholderColor = isDarkMode ? '#888' : '#666';

    return (
        <View style={[styles.container, { backgroundColor }]}>
            <Stack.Screen
                options={{
                    title: "River Information",
                    headerStyle: { backgroundColor: isDarkMode ? '#000' : '#fff' },
                    headerTintColor: textColor,
                    headerTitleStyle: { color: textColor }
                }}
            />
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

            <View style={styles.searchContainer}>
                <TextInput
                    style={[styles.searchInput, { backgroundColor: searchBg, color: textColor, borderColor: searchBorder }]}
                    placeholder="Search rivers..."
                    placeholderTextColor={placeholderColor}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={textColor} />
                    <Text style={{ color: textColor, marginTop: 10 }}>Loading river data...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredRivers}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => item.id || index.toString()}
                    initialNumToRender={15}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS !== 'web'}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        padding: 8,
    },
    searchInput: {
        height: 40,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
    },
});
