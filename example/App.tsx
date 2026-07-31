/**
 * A minimal React Native app, shaped to answer one question on both platforms: what does the wireframe scan see
 * when it looks at RN's view tree?
 *
 * Each SDK classifies by its own platform's superclass — `TextView`/`EditText`/`ImageView` on Android,
 * `UILabel`/`UITextField`/`UIImageView` on iOS — and RN's views descend from those widgets either way. So each
 * screen here puts a different widget in front of it on purpose:
 *
 *   Home   text, an image and touchables    — does a wireframe of RN read as a screen at all?
 *   Form   inputs with real content         — does `maskText` cover RN text?
 *   List   many rows in a ScrollView        — does a list come out as rows, or as one slab?
 *
 * Navigation is React Navigation, tracked by spreading `useLightSessionNavigation()` onto the container — the
 * whole integration, and the reason all three screens arrive as three rather than as one node named after
 * whatever hosts them.
 */
import React, {useEffect, useState} from 'react';
import {
  Image,
  Platform,
  Settings,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  useLightSessionNavigation,
  type NavigationTracking,
} from 'lightsession-react-native/navigation';

const Stack = createNativeStackNavigator();

function HomeScreen({navigation}: any) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>LightSession · React Native</Text>
      <Text style={styles.body}>
        Every widget below is a real Android View underneath. This one is a ReactTextView, which
        descends from TextView — the same class the mask scanner and the wireframe both dispatch on.
      </Text>

      <Image
        style={styles.image}
        source={{uri: 'https://reactnative.dev/img/tiny_logo.png'}}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Form')}>
        <Text style={styles.buttonText}>Go to the form</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.buttonQuiet}
        onPress={() => navigation.navigate('List')}>
        <Text style={styles.buttonQuietText}>Go to the list</Text>
      </TouchableOpacity>
    </View>
  );
}

function FormScreen({navigation}: any) {
  const [name, setName] = useState('Ada Lovelace');
  const [email, setEmail] = useState('ada@example.com');

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>A form</Text>
      <Text style={styles.body}>
        The fields are prefilled so there is something for masking to cover. If maskText works, the
        stored wireframe shows blocks here rather than these words.
      </Text>

      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <TextInput style={styles.input} value={email} onChangeText={setEmail} />
      <TextInput
        style={styles.input}
        value="4111 1111 1111 1111"
        editable={false}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('List')}>
        <Text style={styles.buttonText}>Go to the list</Text>
      </TouchableOpacity>
    </View>
  );
}

function ListScreen() {
  const rows = Array.from({length: 14}, (_, i) => i + 1);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.listBody}>
      <Text style={styles.title}>A list</Text>
      <Text style={styles.body}>
        Fourteen rows in a ScrollView. A wireframe showing fourteen bands is reading the tree; one
        grey rectangle means it is not.
      </Text>
      {rows.map(n => (
        <View key={n} style={styles.row}>
          <View style={styles.avatar} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Row number {n}</Text>
            <Text style={styles.rowSub}>Secondary line for row {n}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/// Walks a list of screens on its own, when launched with `-demoRoutes Form,List`.
///
/// Here so the sample can be driven from a script rather than by tapping. The iOS simulator has no equivalent of
/// Android's `uiautomator`, and `simctl openurl` is not a way round it — iOS asks the user to confirm before
/// handing a URL to an app, so the sample sat behind an "Open with…" alert while the script reported every step
/// as sent.
///
/// It reads the argument through `Settings`, which is React Native's own view of `NSUserDefaults` — where
/// `simctl launch -demoRoutes …` writes. That matters: it means this needs **no native code in the example**,
/// which is the thing the example exists to demonstrate.
///
/// Nothing in the library knows this exists.
function useDemoWalk(ref: NavigationTracking['ref']) {
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }
    const raw = Settings.get('demoRoutes');
    if (typeof raw !== 'string' || raw.length === 0) {
      return;
    }
    const routes = raw.split(',').filter(Boolean);
    // Comfortably longer than the SDK's 5.5-second quiet period, which is how long a screen must sit untouched
    // before its real screenshot is taken. Six seconds was the first value here and it is the wrong kind of
    // close: a walk that navigates 0.5 s after the deadline measures whether the timing was lucky.
    const step = 9000;
    const timers = routes.map((route, index) =>
      setTimeout(() => {
        if (route === 'back') {
          ref.current?.goBack();
        } else {
          ref.current?.navigate(route as never);
        }
      }, step * (index + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, [ref]);
}

export default function App() {
  // The one thing the platform cannot work out for itself. Everything else the SDK reads from RN's
  // view tree without being told.
  const tracking = useLightSessionNavigation();
  useDemoWalk(tracking.ref);

  return (
    <NavigationContainer {...tracking}>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Form" component={FormScreen} />
        <Stack.Screen name="List" component={ListScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#ffffff', padding: 20},
  listBody: {paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '700', color: '#111111', marginBottom: 8},
  body: {fontSize: 14, color: '#555555', marginBottom: 20, lineHeight: 20},
  image: {width: 120, height: 120, marginBottom: 24},
  input: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    color: '#111111',
  },
  button: {
    backgroundColor: '#6200ee',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {color: '#ffffff', fontSize: 16, fontWeight: '600'},
  buttonQuiet: {
    borderWidth: 1,
    borderColor: '#6200ee',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonQuietText: {color: '#6200ee', fontSize: 16, fontWeight: '600'},
  row: {flexDirection: 'row', alignItems: 'center', marginBottom: 14},
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dddddd',
    marginRight: 12,
  },
  rowText: {flex: 1},
  rowTitle: {fontSize: 16, color: '#111111'},
  rowSub: {fontSize: 13, color: '#777777'},
});
