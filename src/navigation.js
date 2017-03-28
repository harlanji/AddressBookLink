/**
 * @flow
 */

import AddressBookScreen from './address-book-screen';
import MainScreen from './main-screen';

import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  Button,
  Alert,
  ListView,
  Switch,
  AsyncStorage,
  Linking,
  Navigator,
  ActivityIndicator
} from 'react-native';

import {
  StackNavigator
} from 'react-navigation';

const URL = require('url-parse');


let OPENED_URL = null,
  OPENED_SITENAME = null,
  OPENED_RETURNTO = null;

Linking.addEventListener('url', function (event) {
  console.log('LINK: ' + event.url);

  let OPENED_URL = event.url;

  if (!OPENED_URL) {
    return;
  }

  let openedUrl = new URL(OPENED_URL, true);

  let pathComponents = openedUrl.pathname.split('/');

  // FIXME hardcoded... /v0/book/configName
  if (pathComponents[1] == 'v0' && pathComponents[2] == 'book' && pathComponents[3] && openedUrl.query.returnTo) {
    OPENED_SITENAME = pathComponents[3];
    OPENED_RETURNTO = openedUrl.query.returnTo;

    console.log('hacked open...');
  }
});


const App = StackNavigator({
  ABLink: {
    path: 'book/:configName\?returnTo=:returnTo',
    screen: MainScreen,
  },
  // ABLink: {
  //   path: 'book/:configName',
  //   screen: MainScreen,
  // },
  AddressBook: {
    path: 'loggedin/:configName/:returnToUri',
    screen: AddressBookScreen,
  }
}, {
  initialRouteName: 'ABLink',
  initialRouteParams: {configName: 'speeddial.io', initialRoute: true},
  containerOptions: {URIPrefix: 'https://addressbook.link/v0/'
  }});


export default App;