/**
 * A React Native app shaped to answer one question on both platforms: what does the SDK see when it
 * looks at RN? Each screen puts a different failure mode in front of it on purpose.
 *
 * The widget cases — both native SDKs classify by platform superclass (`TextView`/`UILabel`, …), and
 * RN's views descend from those either way, so nothing crosses the bridge for these:
 *
 *   Home    text, an image and touchables   — does a wireframe of RN read as a screen at all?
 *   Form    inputs with real content        — does `maskText` cover RN text?
 *   List    many rows in a ScrollView       — does a list come out as rows, or as one slab?
 *
 * The navigation cases — the one thing native cannot know is which screen a single-Activity,
 * single-view-controller app is on, so these exercise every way a "place" happens in RN:
 *
 *   Tabs    a bottom-tab navigator          — `getCurrentRoute()` is the focused tab, so each tab
 *                                             reports as its own screen rather than as the container
 *   Outer…  a stack pushed into a nested    — the deepest route wins: InnerFirst reports as itself,
 *           stack                             not as the screen hosting its navigator
 *   Sheet   `presentation: 'modal'`         — a native modal that *is* a route
 *   Popups  RN `Modal`, `Alert`, and an     — the first two are native windows the SDKs detect on
 *           inline panel                      their own; the panel is invisible to both platforms and
 *                                             is what `setSubScreen` exists for
 *
 * Navigation is React Navigation, tracked by spreading `useLightSessionNavigation()` onto the
 * container — the whole integration.
 */
import React, {useEffect, useState} from 'react';
import {
  Alert,
  Image,
  Modal,
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
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import LightSession from '@lightsession/react-native';
import {
  useLightSessionNavigation,
  type NavigationTracking,
} from '@lightsession/react-native/navigation';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const Inner = createNativeStackNavigator();

function HomeScreen({navigation}: any) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.listBody}>
      <Text style={styles.title}>LightSession · React Native</Text>
      <Text style={styles.body}>
        Every widget below is a real Android View underneath. This one is a ReactTextView, which
        descends from TextView — the same class the mask scanner and the wireframe both dispatch on.
      </Text>

      <Image
        style={styles.image}
        source={{uri: 'https://reactnative.dev/img/tiny_logo.png'}}
      />

      <CaseButton first label="Go to the form" onPress={() => navigation.navigate('Form')} />
      <CaseButton label="Go to the list" onPress={() => navigation.navigate('List')} />
      <CaseButton label="Tabs" onPress={() => navigation.navigate('Tabs')} />
      <CaseButton label="Nested navigation" onPress={() => navigation.navigate('OuterHome')} />
      <CaseButton label="Sheet (modal route)" onPress={() => navigation.navigate('Sheet')} />
      <CaseButton label="Popups" onPress={() => navigation.navigate('Popups')} />
    </ScrollView>
  );
}

/** The first button keeps the old filled style so the wireframe has one solid block to find. */
function CaseButton({
  label,
  onPress,
  first,
}: {
  label: string;
  onPress: () => void;
  first?: boolean;
}) {
  return (
    <TouchableOpacity
      style={first ? styles.button : styles.buttonQuiet}
      onPress={onPress}>
      <Text style={first ? styles.buttonText : styles.buttonQuietText}>{label}</Text>
    </TouchableOpacity>
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

      <CaseButton first label="Go to the list" onPress={() => navigation.navigate('List')} />
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

/**
 * Tabs — the case where React Navigation and the native SDKs draw the line differently.
 *
 * On Android, Compose tabs are *parts* of one screen and report as `Screen › Tab`. Here each tab is
 * a route, `getCurrentRoute()` returns the focused one, and Feed / Ranking / Account arrive as three
 * whole screens. Both are honest maps; this screen exists so the difference is visible in the
 * dashboard rather than a surprise in production.
 */
function TabsCase() {
  return (
    <Tabs.Navigator screenOptions={{headerShown: false}}>
      <Tabs.Screen name="Feed" component={FeedTab} />
      <Tabs.Screen name="Ranking" component={RankingTab} />
      <Tabs.Screen name="Account" component={AccountTab} />
    </Tabs.Navigator>
  );
}

function FeedTab() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Feed</Text>
      <Text style={styles.body}>
        One of three tabs. Switching tabs is not a navigation to React Native — the Activity and the
        view controller never change — but it is one to React Navigation, and to a person.
      </Text>
      {[1, 2, 3, 4].map(n => (
        <View key={n} style={styles.row}>
          <View style={styles.avatar} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Post {n}</Text>
            <Text style={styles.rowSub}>Something that happened today</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function RankingTab() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Ranking</Text>
      <Text style={styles.body}>Deliberately different from Feed, so the two wireframes cannot be confused.</Text>
      {['first', 'second', 'third'].map((place, i) => (
        <View key={place} style={styles.row}>
          <Text style={styles.title}>{i + 1}</Text>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>The {place} one</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function AccountTab() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.body}>Text that masking should cover:</Text>
      <TextInput style={styles.input} value="Ada Lovelace" editable={false} />
    </View>
  );
}

/**
 * The nested case, shaped like the Android sample's NestedComposeNavActivity: an outer stack walks
 * `OuterHome → OuterDetail`, and OuterDetail pushes a screen that is itself a navigator. The route
 * names are what the flow map shows, so the point of this case is simply that `InnerFirst` appears
 * under its own name and not as `Inner`.
 */
function OuterHomeScreen({navigation}: any) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Outer home</Text>
      <Text style={styles.body}>The first screen of the outer stack.</Text>
      <CaseButton first label="Push the detail" onPress={() => navigation.navigate('OuterDetail')} />
    </View>
  );
}

function OuterDetailScreen({navigation}: any) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Outer detail</Text>
      <Text style={styles.body}>Pushing again enters a navigator nested inside a route.</Text>
      <CaseButton first label="Enter the inner stack" onPress={() => navigation.navigate('Inner')} />
    </View>
  );
}

function InnerNavigator() {
  return (
    <Inner.Navigator>
      <Inner.Screen name="InnerFirst" component={InnerFirstScreen} />
      <Inner.Screen name="InnerSecond" component={InnerSecondScreen} />
    </Inner.Navigator>
  );
}

function InnerFirstScreen({navigation}: any) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Inner first</Text>
      <Text style={styles.body}>
        This screen lives two navigators deep. If it reports as "Inner", the deepest-route read is
        broken.
      </Text>
      <CaseButton first label="Push inner second" onPress={() => navigation.navigate('InnerSecond')} />
    </View>
  );
}

function InnerSecondScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Inner second</Text>
      <Text style={styles.body}>The bottom of the nesting.</Text>
    </View>
  );
}

/** A route that presents natively as a sheet. Still a route, so it needs no special handling. */
function SheetScreen({navigation}: any) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>A sheet</Text>
      <Text style={styles.body}>
        Presented with {'`presentation: "modal"`'}. React Navigation makes it a route, so it arrives
        as a screen named Sheet with no help.
      </Text>
      <CaseButton first label="Close" onPress={() => navigation.goBack()} />
    </View>
  );
}

/**
 * Three popups that the SDK sees three different ways — the RN translation of the Android sample's
 * TabsAndModalActivity:
 *
 *  * **The dialog** is an RN `Modal`, which is a real native window (a Dialog on Android, a presented
 *    view controller on iOS). Both SDKs detect those on their own — nothing here reports it.
 *  * **The alert** is `Alert.alert`, an AlertDialog / UIAlertController. Also detected natively, and
 *    on iOS it should arrive *named* by its structure (button count, style).
 *  * **The panel** expands inline, inside the screen's own view tree. No window appears, so neither
 *    platform can see that the place changed — this is exactly what `setSubScreen` is for, and the
 *    only case on this screen that needs code.
 */
function PopupsScreen() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const openPanel = (open: boolean) => {
    setPanelOpen(open);
    if (open) {
      LightSession.setSubScreen('Panel');
    } else {
      LightSession.clearSubScreen('Panel');
    }
  };

  // The scripted walk cannot tap buttons, so the popups register themselves as actions it can call.
  useEffect(() => {
    demoActions.set('dialog', () => setDialogOpen(true));
    demoActions.set('dialog-close', () => setDialogOpen(false));
    demoActions.set('panel', () => openPanel(true));
    demoActions.set('panel-close', () => openPanel(false));
    demoActions.set('alert', () =>
      Alert.alert('Delete everything?', 'This is only here to be detected.', [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Delete', style: 'destructive'},
      ]),
    );
    return () => {
      ['dialog', 'dialog-close', 'panel', 'panel-close', 'alert'].forEach(k =>
        demoActions.delete(k),
      );
    };
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Popups</Text>
      <Text style={styles.body}>
        The dialog and the alert are native windows the SDKs find on their own. The panel is not — it
        is declared, which is the one integration line on this screen.
      </Text>

      <CaseButton first label="Open the dialog" onPress={() => setDialogOpen(true)} />
      <CaseButton label="Show the alert" onPress={() => demoActions.get('alert')?.()} />
      <CaseButton
        label={panelOpen ? 'Collapse the panel' : 'Expand the panel'}
        onPress={() => openPanel(!panelOpen)}
      />

      {panelOpen && (
        <View style={styles.panel}>
          <Text style={styles.rowTitle}>A declared sub-screen</Text>
          <Text style={styles.rowSub}>
            Drawn inline — no new window, no navigation. Without setSubScreen this place does not
            exist on the map.
          </Text>
        </View>
      )}

      <Modal
        visible={dialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDialogOpen(false)}>
        <View style={styles.dialogScrim}>
          <View style={styles.dialogCard}>
            <Text style={styles.rowTitle}>A real native window</Text>
            <Text style={styles.rowSub}>
              RN's Modal is a Dialog on Android and a presented controller on iOS — the SDKs see it
              without being told.
            </Text>
            <CaseButton first label="Close" onPress={() => setDialogOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * What the scripted walk can do besides navigate. Screens put their own entries here while mounted;
 * the walk calls them by `do:<name>`. A Map because registration must be undone on unmount — a demo
 * action firing a setState on an unmounted screen is the kind of noise this sample must not teach.
 */
const demoActions = new Map<string, () => void>();

/// Walks the app on its own, when launched with `-demoRoutes Form,List,back`.
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
/// Steps:
///   `back`     pop
///   `A/B`      navigate into a nested navigator: `navigate('A', {screen: 'B'})` — plain `navigate('B')`
///              only finds names registered in the *current* navigator chain, and a tab that has never
///              been visited is not
///   `do:name`  call a registered popup action on the current screen
///   `Name`     navigate
///
/// Nothing in the library knows this exists.
function useDemoWalk(ref: NavigationTracking['ref']) {
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }
    // try, because `Settings` reaches for its TurboModule on first touch and Jest reports the
    // platform as iOS while having no native modules at all. No NSUserDefaults means no walk,
    // which is also the right answer.
    let raw: unknown;
    try {
      raw = Settings.get('demoRoutes');
    } catch {
      return;
    }
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
        } else if (route.startsWith('do:')) {
          demoActions.get(route.slice(3))?.();
        } else if (route.includes('/')) {
          const [outer, inner] = route.split('/');
          ref.current?.navigate(outer as never, {screen: inner} as never);
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
        <Stack.Screen name="Tabs" component={TabsCase} />
        <Stack.Screen name="OuterHome" component={OuterHomeScreen} />
        <Stack.Screen name="OuterDetail" component={OuterDetailScreen} />
        {/* headerShown off so the inner navigator's own header is the only one — two stacked bars
            would also be two bars in every wireframe. */}
        <Stack.Screen name="Inner" component={InnerNavigator} options={{headerShown: false}} />
        <Stack.Screen name="Sheet" component={SheetScreen} options={{presentation: 'modal'}} />
        <Stack.Screen name="Popups" component={PopupsScreen} />
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
  panel: {
    backgroundColor: '#f2ecff',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  dialogScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 32,
  },
  dialogCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 20,
  },
});
