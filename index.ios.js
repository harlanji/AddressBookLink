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
  AsyncStorage
} from 'react-native';

import {
  StackNavigator,
} from 'react-navigation';

const Filter = require('bloom-filter');
const Contacts = require('react-native-contacts');

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
        this.props.navigation.navigate('AddressBook');
      }
      if (permission === 'denied') {
        // x.x
      }
    })


  }
}

AppRegistry.registerComponent('MainScreen', () => MainScreen);


class AddressBookScreen extends Component {

  static navigationOptions = {
    title: ({state}) => `AddressBook.Link`,
  }

  constructor() {
    super();

    this.state = {
      disabledContactIds: [],
      matchingContacts: [],
      shouldSync: false,
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
        <Button title="Sync" disabled={!this.state.shouldSync} onPress={() => this.onSyncPressed() }/>
      </View>

    );
  }

  renderContactRow(contact) {
    return (
      <View style={{flex: 1, flexDirection: 'row'}}>
        <Switch value={this.isContactSelected(contact)}
                onValueChange={(enabled) => this.onContactSwitched(contact, enabled)}/>
        <View style={{flex: 1, flexDirection: 'column'}}>
          <View style={{flex: 1, flexDirection: 'row'}}>
            <Text style={styles.displayName}>{contact.givenName + ' ' + contact.familyName}</Text>
            <Text>{this.state.matchingContacts.map(match => match.recordID).indexOf(contact.recordID) > -1 ? ' ** match' : ''}</Text>
          </View>
          <View style={{flex: 1, flexDirection: 'column'}}>
            {contact.phoneNumbers.map((p) => (
              <View style={{flex: 1, flexDirection: 'row'}}>
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

    let ep = 'http://localhost:3000';
    //let phone = '5554787672'; // Daniel
    let phone = '5555655555'; // Fake H
    let uri = `${ep}/db/test/${phone}`;

    let contacts = this.state.contacts;



    let phoneNumbers = [];

    contacts.forEach(c => {c.phoneNumbers.forEach(pn => {
      let normalized = pn.number.split('').filter(char => char >= '0' && char <= '9').join('');
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
          let normalized = pn.number.split('').filter(char => char >= '0' && char <= '9').join('');

          if (responseBloom.contains(normalized)) {
            matchingContacts.push(c);
            console.log("matchingContacts: " + JSON.stringify(pn.number));
          }
        })});

        this.storePossibleMatches({matchingContacts});

        this.setState({matchingContacts, shouldSync: false});

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
  }
});


AppRegistry.registerComponent('AddressBookScreen', () => AddressBookScreen);

const App = StackNavigator({
  Main: {
    screen: MainScreen,
  },
  AddressBook: {
    path: 'address-book',
    screen: AddressBookScreen,
  },
});

AppRegistry.registerComponent('AddressBookLink', () => App);

export default App;