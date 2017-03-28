/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 * @flow
 */

import {
  AppRegistry,
} from 'react-native';



import AddressBookScreen from './src/address-book-screen';
import MainScreen from './src/main-screen';
import App from './src/navigation';




AppRegistry.registerComponent('MainScreen', () => MainScreen);




AppRegistry.registerComponent('AddressBookScreen', () => AddressBookScreen);


AppRegistry.registerComponent('AddressBookLink', () => App);

export default App;
