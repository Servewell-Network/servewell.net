import { Text, View, StyleSheet } from 'react-native';
import Readme from '../../README.mdx';
import { MDXStyles } from "@bacons/mdx";

export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>About screen</Text>
      <MDXStyles
      >
        <Readme />
      </MDXStyles>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start', // vertical
    alignItems: 'flex-start', // horizontal
    paddingHorizontal: '10%',
    // backgroundColor: '#222', 
    // color: '#fff',
    overflow: 'scroll',
  },
  text: {
    color: 'pink',
  },
});
