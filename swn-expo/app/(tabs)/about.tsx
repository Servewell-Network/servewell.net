import { Text, View, StyleSheet, ScrollView } from 'react-native';
import Readme from '../../README.mdx';
import { MDXStyles } from "@bacons/mdx";

export default function AboutScreen() {
  return (
    // <ScrollView horizontal={true}>
      <ScrollView style={styles.container}>
        <Text style={styles.text}>About screen</Text>
        <MDXStyles 
      >
        <Readme />
        </MDXStyles>
      </ScrollView>
  //  </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: '1%',
    
    // backgroundColor: '#222', 
    // color: '#fff',
  },
  text: {
    color: 'pink',
  },
});
