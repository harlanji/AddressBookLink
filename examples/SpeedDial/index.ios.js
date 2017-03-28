/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 * @flow
 */

import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  ListView,
  Linking,
  Button,
  ActivityIndicator,
  AsyncStorage
} from 'react-native';

import {
  StackNavigator, NavigationActions
} from 'react-navigation';

const Phone = require('phone');
const URL = require('url-parse');
const deepEqual = require('deep-equal');


const abLinkReturnPath = '/ablink-result';

const TEST_ABLINK = false;
const DISABLE_CACHE = false; // FIXME expiration machinery

class AddressBookLink {

  getAllWithoutPhotos () {
    this.loadFromCache()
      .then((contacts) => { console.log('using cached contacts'); this.gotAllContacts(contacts); })
      .catch(() => { this.loadFromABLink() });
  }

  loadFromABLink () {
    if (TEST_ABLINK) {
      //simulated:
      setTimeout(() => {
        let matches = [
          {selected: false, contact: {name: 'Alice'}},
          {selected: true, contact: {name: 'Bob'}}
        ];
        this.onOpenedWithURL({url: `https://speeddial.io${abLinkReturnPath}?contacts=${JSON.stringify(matches)}`})
      }, 2000 * Math.random());

      return;
    }


    var uri = 'https://addressbook.link/v0/book/speeddial.io?returnTo=' + encodeURIComponent(`https://speeddial.io${abLinkReturnPath}`);


    // void return (promise is no good since the value can be updated)
    Linking.openURL(uri).catch(err => console.log('an error occurred: ' + err));
  }

  loadFromCache () {
    if (DISABLE_CACHE) {
      return Promise.reject();
    }

    return AsyncStorage.getItem(`@Contacts`)
      .then((contactsJson) => {
        let contacts = JSON.parse(contactsJson);

        return contacts;
      });
  }

  addEventListener (listener) {
    this.contactListeners.push(listener);
  }

  urlListener = null;

  initEnv () {
    if (!this.urlListener) {
      this.urlListener = (event) => this.onOpenedWithURL(event);
      Linking.addEventListener('url', this.urlListener);
    }
  }

  cleanupEnv () {
    Linking.removeEventListener('url', this.urlListener);
    this.urlListener = null;
  }

  onOpenedWithURL (event) {
    console.log('Linking event: ' + event.url);

    let url = new URL(event.url, true);

    if (url.pathname != abLinkReturnPath) {
      console.log('not for us: ' + url.pathname);
      return;
    }

    let contacts = JSON.parse(url.query.contacts);
    this.gotAllContacts(contacts);

    AsyncStorage.setItem("@Contacts", JSON.stringify(contacts));
  }

  gotAllContacts (contacts) {
    console.log("gotAllContacts");
    this.contactListeners.forEach((listener) => listener(contacts));
  }

  contactListeners = [];
}


const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => deepEqual(r1, r2, true)});
const addressBookLink = new AddressBookLink();

addressBookLink.initEnv(); // TODO when do we cleanup? is there a way to tie a singleton to a component? having one? what stage?

export default class SpeedDial extends Component {

  constructor(props, context) {
    super(props, context);

    let abData = [];

    this.state = {
      abData,
      isWaitingForContacts: false,
      addressBookDS: ds.cloneWithRows(abData)
    }
  }

  componentWillMount () {
    addressBookLink.addEventListener((contacts) => this.gotAllContacts(contacts));

    addressBookLink.loadFromCache()
      .then((contacts) => this.gotAllContacts(contacts))
      .catch(() => { console.log('no cache (componentWillMount)') });
  }


  gotAllContacts (contacts) {
    let abData = contacts.map(c => {return {contact: c}})
    this.setState({isWaitingForContacts: false, abData, addressBookDS: ds.cloneWithRows(abData)});
  }

  render() {
    return (
      <View style={styles.container}>
        <View style={styles.row}>
          <Text style={styles.welcome}>
            Welcome to Speed Dial!
          </Text>
        </View>
        <ListView dataSource={this.state.addressBookDS}
                  renderRow={(rowData) => this.renderRow(rowData)}
                  enableEmptySections={true}/>

        <View>
          <Button title="Sync Now" disabled={this.state.isWaitingForContacts} onPress={() => this.onSyncNowPressed()}/>
          <ActivityIndicator
            hidesWhenStopped={true}
            animating={this.state.isWaitingForContacts}
            style={{height: 80}}
            size="large"
          />
        </View>
      </View>
    );
  }

  renderRow (rowData) {
    return <View style={{flex: 1, flexDirection: 'row'}}><Text>{rowData.contact.name}</Text><Text>{rowData.contact.phoneNumber}</Text><Text>{rowData.contact.match}</Text></View>
  }

  onSyncNowPressed () {
    // var ep = 'https://addressbook.link/v0/',
    //     // id = 1, // the sender will know the id and appId... but's embedded in the token. will be opaqueuntil authenticated.
    //     // appId = 'test',
    //     uri = `${ep}match?token={token}`;
    // Linking.openURL(uri).catch(err => console.log('an error occurred: ' + err));

    addressBookLink.loadFromABLink();

    this.setState({isWaitingForContacts: true});
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
});

AppRegistry.registerComponent('SpeedDial', () => SpeedDial);
