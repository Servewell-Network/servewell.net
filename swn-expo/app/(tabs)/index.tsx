// File name conventions: Index file names, such as index.tsx, match their parent directory and do not add a path segment. For example, the index.tsx file in the app directory matches / route.

import { Text, View, StyleSheet, ScrollView } from 'react-native';

export default function Index() {
  return (
    <ScrollView style={styles.horizScroll} horizontal={true}>
      <ScrollView style={styles.vertScroll} >
        <Text style={styles.text}>Home screen</Text>
        <View style={{ flexDirection: 'row' }}>
          <Text style={styles.bulletMarker}>{'•'}</Text>
          <Text style={styles.bulletText}>Bullet 1 goes on and on and on</Text>
        </View>

        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 48 }} />
          <Text style={styles.bulletMarker}>{'●'}</Text>
          <Text style={styles.bulletText}>Bullet 1.1</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 48 }} />
          <View style={{ width: 48 }} />
          <Text style={styles.bulletMarker}>{'●'}</Text>
          <Text style={styles.bulletText}>Bullet 1.1.1</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 48 }} />
          <View style={{ width: 48 }} />
          <View style={{ width: 48 }} />
          <Text style={styles.bulletMarker}>{'●'}</Text>
          <Text style={styles.bulletText}>Bullet 1.1.1.1</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 48 }} />
          <View style={{ width: 48 }} />
          <View style={{ width: 48 }} />
          <View style={{ width: 48 }} />
          <Text style={styles.bulletMarker}>{'●'}</Text>
          <Text style={styles.bulletText}>Bullet 1.1.1.1.1 goes on and on and on</Text>
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  horizScroll: {
    margin: '5%'
  },
  vertScroll: {
    flex: 1
    // padding: '5%',
    // margin: '5%',
  },
  text: {
    fontSize: 24,
  },
  bulletMarker: {
    paddingLeft: 15,
    fontSize: 21,
  },
  bulletText: {
    paddingLeft: 15,
    fontSize: 24,
    display: 'flex',
    flexWrap: 'wrap',
    width: '50%'
  }
});
