/**
 * @flow
 */


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


import React, {Component} from 'react';

const Contacts = require('react-native-contacts');
const Filter = require('bloom-filter');

import {API_URI, parsePhoneNumber} from './util';

export default class AddressBookScreen extends Component {

  static navigationOptions = {
    title: ({state}) => `${state.params.identifier}`,
  };

  constructor(props) {
    super(props);

    let dsRows = [];

    this.state = {
      appId: this.props.navigation.state.params.appId,
      phoneNumber: this.props.navigation.state.params.phoneNumber,
      identifier: this.props.navigation.state.params.identifier,
      authJwt: this.props.navigation.state.params.authJwt,
      returnToUri: this.props.navigation.state.params.returnToUri,
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
        <Text>{this.state.initialUrl}</Text>
        <Text>{this.state.returnToUri}</Text>
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
    this.setState({disabledContactIds, dsRows: this.state.dsRows, contactsDs, shouldSync: true});

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

    //let phone = '5554787672'; // Daniel
    let identifier = this.state.identifier;
    let appId = this.state.appId;
    let uri = `${API_URI}/db/${appId}/${identifier}`;


    let returnToUri = this.state.returnToUri;

    console.log('sync uri: ' + uri);
    console.log('return to uri: ' + returnToUri);

    let contacts = this.state.contacts.filter(c => this.state.disabledContactIds.indexOf(c.recordID) == -1)

    let phoneNumbers = [];

    contacts.forEach(c => {c.phoneNumbers.forEach(pn => {
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

      let matchingContacts = [];

      response.json().then((json) => {
        var responseBloom = new Filter(json);
        var matchingContactIds = [];

        contacts.forEach(c => {c.phoneNumbers.forEach(pn => {



          let normalized = parsePhoneNumber(pn.number);

          let contact = {name: c.givenName, phoneNumber: normalized};

          if (responseBloom.contains(normalized)) {
            console.log("matching contact: " + JSON.stringify(pn.number));
            matchingContactIds.push(c.recordID);

            contact.match = 1;
          }
          matchingContacts.push(contact);
        })});

        this.storePossibleMatches(matchingContactIds).then(() => {
          this.setState({matchingContactIds, shouldSync: false});

          this.loadContacts();

          if (returnToUri) {
            Linking.openURL(`${returnToUri}?contacts=${encodeURIComponent(JSON.stringify(matchingContacts))}`);
          } else {
            Alert.alert('Contacts synced successfully. Any deselected contacts have been removed.');
          }
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
