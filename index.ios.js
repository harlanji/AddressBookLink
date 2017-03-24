/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 * @flow
 */

import React, {Component} from 'react';
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
  Navigator
} from 'react-native';

import {
  StackNavigator, NavigationActions
} from 'react-navigation';

import DeviceInfo from 'react-native-device-info'

const Filter = require('bloom-filter');
const Contacts = require('react-native-contacts');
const Auth0Lock = require('react-native-lock');

const Phone = require('phone');

function parsePhoneNumber (phoneNumber) {
  let digits = phoneNumber.split('').filter(char => char >= '0' && char <= '9').join('');
  let parsed = Phone(digits);

  if (parsed.length == 0) {
    console.log(`could not parse phone number ${phoneNumber} so normalized to ${digits}.`);

    return digits;
  }

  return parsed[0];
}

function isSimulator () {
  return DeviceInfo.getModel() === "Simulator";
}

const TEST_MODE = true;
const TEST_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2FuYWxvZ3plbi5hdXRoMC5jb20vIiwic3ViIjoic21zfDU4ZDAxOTI5ODc5ZjE4Mjg4YTdhMGMwNyIsImF1ZCI6InZrTmZvalB3NVBzNzN2bkdiRDhTMVJ4TGxRTTdhZ0djIiwiZXhwIjoxNDkwMzI3NjIzLCJpYXQiOjE0OTAyOTE2MjN9.iqqf4LkNep57rfbsqoywCYvCuiAWL7tmbxLNjthmdDg';
const TEST_PROFILE = {extraInfo: {clientID: 'vkNfojPw5Ps73vnGbD8S1RxLlQM7agGc', phone_number: '+14155651452'}};


class MainScreen extends Component {

  static navigationOptions = {

    title: ({state}) => `AddressBook.Link`,

    // header: ({ state, setParams }) => ({
    //     // Render a button on the right side of the header
    //     // When pressed switches the screen to edit mode.
    //     right: (
    //         <Button
    //             title={state.params.editing ? 'Done' : 'Edit'}
    //             onPress={() => setParams({editing: state.params.editing ? false : true})}
    //         />
    //     ),
    // }),
  };

  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>AddressBook.Link</Text>
        <Text style={styles.instructions}>
          AddressBook.Link helps keep your contacts private and connect you with friends. <Text>Learn More &gt;</Text>
        </Text>
        <Button title="Enable" style={styles.enable} onPress={() => this.onEnablePressed()}/>
      </View>
    );
  }

  onEnablePressed() {
    this.gotoAddressBook();
  }

  gotoAddressBook () {
    this.setupContactPermission().then(() => {
      this.login().then((loginResult) => {
        const resetAction = NavigationActions.reset({
          index: 0,
          actions: [
            NavigationActions.navigate({routeName: 'AddressBook', params: loginResult})
          ]
        });
        this.props.navigation.dispatch(resetAction);
      });
    });
  }


  // resolve if there is permission, ask the first time
  setupContactPermission () {
    return new Promise((resolve, reject) => {
      Contacts.checkPermission((err, permission) => {
        // Contacts.PERMISSION_AUTHORIZED || Contacts.PERMISSION_UNDEFINED || Contacts.PERMISSION_DENIED
        if (permission === 'undefined') {
          Contacts.requestPermission((err, permission) => {
            if (permission == 'authorized') {
              resolve();
            } else {
              reject();
            }
          })
        }
        if (permission === 'authorized') {
          resolve();
        }
        if (permission === 'denied') {
          reject();
        }
      })
    });
  }

  // login and resolve params: {appId, identifier, authJwt, phoneNumber}
  login () {
    return new Promise((resolve, reject) => {
      console.log('login');

      function continueWithProfile (profile, authJwt) {
        console.log('contineWithProfile');
        let appId = profile.extraInfo.clientID;
        let phoneNumber = profile.extraInfo.phone_number;

        let identifier = parsePhoneNumber(phoneNumber);

        return resolve({appId, identifier, authJwt, phoneNumber});
      }

      if (TEST_MODE) {
        return continueWithProfile(TEST_PROFILE, TEST_TOKEN);
      } else {
        var lock = new Auth0Lock({clientId: 'vkNfojPw5Ps73vnGbD8S1RxLlQM7agGc', domain: 'analogzen.auth0.com'});

        // todo -- cache login

        lock.show({connections: ['sms']}, (err, profile, token) => {
          if (err) {
            Alert.alert('login err :(' + err)

            console.log(err);
            return reject();
          }
          // Authentication worked!
          console.log('Logged in with Auth0!: ' + JSON.stringify(profile));

          // https://auth0.com/docs/user-profile/user-profile-structure
          // phone_number, phone_verified

          return continueWithProfile(profile, token.idToken);
        });
      }
    });
  }


}

AppRegistry.registerComponent('MainScreen', () => MainScreen);


class AddressBookScreen extends Component {

  static navigationOptions = {
    title: ({state}) => `${state.params.identifier}`,
  }

  constructor(props) {
    super(props);

    let dsRows = [];

    this.state = {
      appId: this.props.navigation.state.params.appId,
      phoneNumber: this.props.navigation.state.params.phoneNumber,
      identifier: this.props.navigation.state.params.identifier,
      authJwt: this.props.navigation.state.params.authJwt,
      disabledContactIds: [],
      matchingContactIds: [],
      shouldSync: true,
      dsRows: dsRows,
      contactsDs: AddressBookScreen.ds.cloneWithRows(dsRows)
    };
  }

  componentWillMount() {
    this.loadContacts();
  }

  render() {
    return (
      <View style={{flex: 1}}>
        <ListView dataSource={this.state.contactsDs}
                  renderRow={(rowData) => this.renderContactRow(rowData)}
                  enableEmptySections={true}/>
        <View style={styles.syncPanel}>
          <Button style={styles.syncButton} title="Sync" onPress={() => this.onSyncPressed() }/>
        </View>
      </View>

    );
  }

  renderContactRow(rowData) {
    let contact = rowData.contact;
    return (
      <View style={{flex: 1, flexDirection: 'row'}} key={'contact-row-' + contact.recordID}>
        <Switch value={rowData.selected}
                onValueChange={(enabled) => this.onContactSwitched(rowData, enabled)}/>
        <View style={{flex: 1, flexDirection: 'column'}}>
          <View style={{flex: 1, flexDirection: 'row'}}>
            <Text style={styles.displayName}>{contact.givenName + ' ' + contact.familyName}</Text>
            <Text>{rowData.match ? ' ** match' : ''}</Text>
          </View>
          <View style={{flex: 1, flexDirection: 'column'}}>
            {contact.phoneNumbers.map((p, i) => (
              <View style={{flex: 1, flexDirection: 'row'}} key={'contact-num-' + contact.recordID + '-' + i}>
                <Text style={styles.phoneLabel}>{p.label}</Text>
                <Text style={styles.phoneNumber}>{p.number}</Text>
              </View>))}
          </View>
        </View>
      </View>

    );
  }

  // -- actions

  onContactSwitched(rowData, enabled) {
    rowData.selected = enabled; // testing: does this update dsRows OG? settings tate

    let disabledContactIds = this.state.disabledContactIds.slice(0);

    if (!enabled) {
      disabledContactIds.push(rowData.contact.recordID);
    } else {
      disabledContactIds = disabledContactIds.filter((cid) => cid != rowData.contact.recordID);
    }

    var contactsDs = AddressBookScreen.ds.cloneWithRows(this.state.dsRows);
    this.setState({dsRows: this.state.dsRows, contactsDs, shouldSync: true});

    console.log('storeDisabled');
    console.log(disabledContactIds);
    this.storeDisabled(disabledContactIds).then(() => {
      console.log('storeDisabled done!');

    }).done();
  }

  onSyncPressed() {
    this.syncContacts();
  }

  syncContacts () {
    //this.props.navigation.goBack(null);

    //let ep = 'https://addressbooklink.com/api';
    let ep = 'http://192.168.3.3:3000';

    //let phone = '5554787672'; // Daniel
    let identifier = this.state.identifier;
    let appId = this.state.appId;
    let uri = `${ep}/db/${appId}/${identifier}`;


    console.log('sync uri: ' + uri);

    let contacts = this.state.contacts;




    let phoneNumbers = [];

    contacts.filter(c => this.state.disabledContactIds.indexOf(c.recordID) == -1).forEach(c => {c.phoneNumbers.forEach(pn => {
      let normalized = parsePhoneNumber(pn.number);
      phoneNumbers.push(normalized);
    })});

    let n = Math.pow(2, Math.ceil(Math.log2(phoneNumbers.length)));
    console.log("bloom n=" + n + " for len = " + phoneNumbers.length);

    let contactsBloom = Filter.create(n, 0.0000000001);

    phoneNumbers.forEach(p => {contactsBloom.insert(p)});

    let contactsHash = contactsBloom.toObject(),
      authJwt = this.state.authJwt;

    return fetch(uri, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({contactsHash, authJwt})
    }).then((response) => {

      response.json().then((json) => {
        var responseBloom = new Filter(json);
        var matchingContactIds = [];

        contacts.forEach(c => {c.phoneNumbers.forEach(pn => {
          let normalized = parsePhoneNumber(pn.number);

          if (responseBloom.contains(normalized)) {
            matchingContactIds.push(c.recordID);
            console.log("matching contact: " + JSON.stringify(pn.number));
          }
        })});

        this.storePossibleMatches(matchingContactIds).then(() => {
          this.setState({matchingContactIds, shouldSync: false});

          this.loadContacts();

          Alert.alert('Contacts synced successfully. Any deselected contacts have been removed.');
        });
      });


    })
    .catch((error) => {
      console.error(error);
    });
  }

  // -- model

  loadContacts() {
    Promise.all([this.loadDisabled(), this.loadPossibleMatches()])
      .then(([disabledContactIds, matchingContactIds]) => {
      Contacts.getAllWithoutPhotos((err, contacts) => {
        if (err) {
          Alert.alert("Error getting contacts.");
          return;
        }
        let dsRows = contacts.map((contact) => new Object({
            contact,
            key: contact.recordID,
            selected: disabledContactIds.indexOf(contact.recordID) == -1,
            match: matchingContactIds.indexOf(contact.recordID) > -1
          })),
          contactsDs = AddressBookScreen.ds.cloneWithRows(dsRows);

        this.setState({disabledContactIds, matchingContactIds, contacts, contactsDs, dsRows});
      });
    });
  }

  loadDisabled() {
    return AsyncStorage.getItem(`@AddressBookScreen:${this.state.appId}:${this.state.identifier}:disabledContactIds`)
      .then((json) => json ? JSON.parse(json) : [])
      .catch(() => []);
  }

  loadPossibleMatches() {
    return AsyncStorage.getItem(`@AddressBookScreen:${this.state.appId}:${this.state.identifier}:possibleMatches`)
      .then((json) => json ? JSON.parse(json) : [])
      .catch(() => []);
  }

  storePossibleMatches (matchingContactIds) {
    let json = JSON.stringify(matchingContactIds);
    return AsyncStorage.setItem(`@AddressBookScreen:${this.state.appId}:${this.state.identifier}:possibleMatches`, json);
  }

  storeDisabled(disabledContactIds) {
    let json = JSON.stringify(disabledContactIds);
    return AsyncStorage.setItem(`@AddressBookScreen:${this.state.appId}:${this.state.identifier}:disabledContactIds`, json);
  }

  // -- extras

  static ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1.selected !== r2.selected || r1.match != r2.match});
}

AppRegistry.registerComponent('AddressBookScreen', () => AddressBookScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
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
  enable: {
    backgroundColor: 'blue',
    color: 'white',
    fontSize: 32
  },


  displayName: {
    fontWeight: 'bold',
    fontSize: 24
  },
  phoneLabel: {
    fontSize: 16
  },
  phoneNumber: {
    fontSize: 16
  },

  syncPanel: {
    padding: 4
  },

  syncButton: {
    fontSize: 32,
  }
});

Linking.addEventListener('url', function (event) {
  console.log(`Linking::url length: ${event.url.length}`);
});

AppRegistry.registerComponent('AddressBookScreen', () => AddressBookScreen);

const App = StackNavigator({
  Main: {
    screen: MainScreen,
  },
  AddressBook: {
    path: 'book/:appId/:identifier',
    screen: AddressBookScreen,
  }
  }, {containerOptions: {URIPrefix: 'https://addressbook.link/v0/'}});

AppRegistry.registerComponent('AddressBookLink', () => App);

export default App;
