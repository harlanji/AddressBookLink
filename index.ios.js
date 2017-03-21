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
  let parsed = Phone(phoneNumber);

  let normalized = (parsed[0] || phoneNumber).split('').filter(char => char >= '0' && char <= '9').join('');

  return normalized;
}

function isSimulator () {
  return DeviceInfo.getModel() === "Simulator";
}



class MatchScreen extends Component {

  static navigationOptions = {
    title: ({state}) => `AddressBook.Link Matches`,
  };

  constructor(props) {
    super(props);

    this.state = {
      appId: this.props.navigation.state.params.appId,
      identifier: this.props.navigation.state.params.identifier,
    };
  }


  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>AddressBook.Link</Text>
        <Text style={styles.instructions}>
          Welcome to AddressBook.Link
        </Text>
        <View style={{flex: 1, flexDirection: 'row'}}>
          <View style={{flex: 1, flexDirection: 'row'}}>
            <Text>App ID</Text><Text>{this.state.appId}</Text>
          </View>
          <View style={{flex: 1, flexDirection: 'row'}}>
            <Text>User ID</Text><Text>{this.state.identifier}</Text>
          </View>
        </View>
      </View>
    );
  }
}

AppRegistry.registerComponent('MatchScreen', () => MatchScreen);


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

  componentWillMount () {
    Contacts.checkPermission((err, permission) => {
      if (permission === 'authorized') {
        this.gotoAddressBook();
      }
    });
  }


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
    Contacts.checkPermission((err, permission) => {
      // Contacts.PERMISSION_AUTHORIZED || Contacts.PERMISSION_UNDEFINED || Contacts.PERMISSION_DENIED
      if (permission === 'undefined') {
        Contacts.requestPermission((err, permission) => {
          if (permission == 'authorized') {
            this.onEnablePressed();
          }
        })
      }
      if (permission === 'authorized') {
        this.gotoAddressBook();
      }
      if (permission === 'denied') {
        // x.x
      }
    })


  }

  gotoAddressBook () {


    //

    //Alert.alert('login!');

    console.log('login');

    if (true || isSimulator()) {
      let profile = {extraInfo: {clientID: 'vkNfojPw5Ps73vnGbD8S1RxLlQM7agGc', phone_number: '+14155651452'}};

      this.continueWithProfile(profile);
    } else {
      var lock = new Auth0Lock({clientId: 'vkNfojPw5Ps73vnGbD8S1RxLlQM7agGc', domain: 'analogzen.auth0.com'});

      // todo -- cache login

      lock.show({connections: ['sms']}, (err, profile, token) => {
        if (err) {
          Alert.alert('login err :(' + err)

          console.log(err);
          return;
        }
        // Authentication worked!
        console.log('Logged in with Auth0!: ' + JSON.stringify(profile));

        // https://auth0.com/docs/user-profile/user-profile-structure
        // phone_number, phone_verified

        this.continueWithProfile(profile);
      });
    }


  }

  continueWithProfile (profile) {
    let appId = profile.extraInfo.clientID;
    let phoneNumber = profile.extraInfo.phone_number;

    let identifier = parsePhoneNumber(phoneNumber);

    const resetAction = NavigationActions.reset({
      index: 0,
      actions: [
        NavigationActions.navigate({routeName: 'AddressBook', params: {appId, identifier, phoneNumber: identifier}})
      ]
    })
    this.props.navigation.dispatch(resetAction);

  }
}

AppRegistry.registerComponent('MainScreen', () => MainScreen);


class AddressBookScreen extends Component {

  static navigationOptions = {
    title: ({state}) => `${state.params.phoneNumber}`,
  }

  constructor(props) {
    super(props);

    this.state = {
      appId: this.props.navigation.state.params.appId,
      phoneNumber: this.props.navigation.state.params.phoneNumber,
      disabledContactIds: [],
      matchingContacts: [],
      shouldSync: true,
      contactsDataSource: AddressBookScreen.ds.cloneWithRows([])
    };
  }

  componentWillMount() {
    this.fetchContacts().done();
    this.fetchDisabled().done();
    this.fetchPossibleMatches().done();
  }

  render() {
    return (
      <View style={{flex: 1}}>
        <ListView dataSource={this.state.contactsDataSource}
                  renderRow={(rowData) => this.renderContactRow(rowData.contact)}
                  enableEmptySections={true}/>
        <View style={styles.syncPanel}>
          <Button style={styles.syncButton} title="Sync" onPress={() => this.onSyncPressed() }/>
        </View>
      </View>

    );
  }

  renderContactRow(contact) {
    return (
      <View style={{flex: 1, flexDirection: 'row'}} key={'contact-row-' + contact.recordID}>
        <Switch value={this.isContactSelected(contact)}
                onValueChange={(enabled) => this.onContactSwitched(contact, enabled)}/>
        <View style={{flex: 1, flexDirection: 'column'}}>
          <View style={{flex: 1, flexDirection: 'row'}}>
            <Text style={styles.displayName}>{contact.givenName + ' ' + contact.familyName}</Text>
            <Text>{this.state.matchingContacts.map(match => match.recordID).indexOf(contact.recordID) > -1 ? ' ** match' : ''}</Text>
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

  // -- view model

  isContactSelected(contact) {
    if (!contact.recordID) {
      throw new Error("Problematic contact: " + JSON.stringify(contact));
    }

    return this.state.disabledContactIds.indexOf(contact.recordID) < 0;
  }

  // -- actions

  onContactSwitched(contact, enabled) {
    var newState = this.state; //{disabledContactIds: this.state.disabledContactIds};

    if (!enabled) {
      newState.disabledContactIds.push(contact.recordID);
    } else {
      newState.disabledContactIds = newState.disabledContactIds.filter((cid) => cid != contact.recordID);
    }
    newState.shouldSync = true;

    this.storeDisabled(newState).done();

    this.setState(newState);
  }

  onSyncPressed() {
    //this.props.navigation.goBack(null);

    let ep = 'https://addressbooklink.com/api';
    //let phone = '5554787672'; // Daniel
    let phone = this.state.phoneNumber; // Fake H
    let appId = this.state.appId;
    let uri = `${ep}/db/${appId}/${phone}`;


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

    let contactsHash = contactsBloom.toObject();



    return fetch(uri, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactsHash)
    }).then((response) => {

      response.json().then((json) => {
        var responseBloom = new Filter(json);
        var matchingContacts = [];

        contacts.forEach(c => {c.phoneNumbers.forEach(pn => {
          let normalized = parsePhoneNumber(pn.number);

          if (responseBloom.contains(normalized)) {
            matchingContacts.push(c);
            console.log("matchingContacts: " + JSON.stringify(pn.number));
          }
        })});

        this.storePossibleMatches({matchingContacts});

        this.setState({matchingContacts, shouldSync: false});

        Alert.alert('Contacts synced successfully. Any deselected contacts have been removed.');

      });


    })
    .catch((error) => {
      console.error(error);
    });


  }

  // -- model

  async fetchContacts() {
    Contacts.getAllWithoutPhotos((err, contacts) => {
      if (err) {
        Alert.alert("Error getting contacts.");
        return;
      }
      let dsRows = contacts.map((contact) => new Object({contact, 'key': contact.recordID}));

      this.setState({contacts, contactsDataSource: AddressBookScreen.ds.cloneWithRows(dsRows)});
    });
  }

  async fetchDisabled() {
    try {
      let disabledContactIdsP = AsyncStorage.getItem('@AddressBookScreen:disabledContactIds')
        .then((json) => json ? JSON.parse(json) : [])
        .then((disabledContactIds) => {
          this.setState({disabledContactIds});
          return disabledContactIds;
        });

      return disabledContactIdsP;
    } catch (error) {
      Alert.alert('error loading disable contacts: ' + error);
    }
  }

  async fetchPossibleMatches() {
    try {
      let disabledContactIdsP = AsyncStorage.getItem('@AddressBookScreen:possibleMatches')
        .then((json) => json ? JSON.parse(json) : [])
        .then((matchingContacts) => {
          this.setState({matchingContacts});
          return matchingContacts;
        });

      return disabledContactIdsP;
    } catch (error) {
      Alert.alert('error loading disable contacts: ' + error);
    }
  }

  async storePossibleMatches (state) {
    if (!state) {
      state = this.state;
    }
    try {
      let json = JSON.stringify(state.matchingContacts);

      return AsyncStorage.setItem('@AddressBookScreen:possibleMatches', json);
    } catch (error) {
      // Error saving data
      Alert.alert('error storing matching contacts: ' + error);
    }
  }

  async storeDisabled(state) {
    if (!state) {
      state = this.state;
    }
    try {
      let json = JSON.stringify(state.disabledContactIds);

      return AsyncStorage.setItem('@AddressBookScreen:disabledContactIds', json);
    } catch (error) {
      // Error saving data
      Alert.alert('error storing disable contacts: ' + error);
    }
  }

  // -- extras

  static ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1.recordID !== r2.recordID});
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
  console.log('Linking::url');
  console.log(event);
});


AppRegistry.registerComponent('AddressBookScreen', () => AddressBookScreen);

const App = StackNavigator({
  Main: {
    screen: MainScreen,
  },
  AddressBook: {
    path: 'book/:appId/:identifier',
    screen: AddressBookScreen,
  },
  Match: {
    path: 'match/:appId/:identifier',
    screen: MatchScreen,
  }
  }, {containerOptions: {URIPrefix: 'https://addressbook.link/v0/'}});

AppRegistry.registerComponent('AddressBookLink', () => App);

export default App;
