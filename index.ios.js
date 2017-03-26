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
  Navigator,
  ActivityIndicator
} from 'react-native';

import {
  StackNavigator, NavigationActions
} from 'react-navigation';

import DeviceInfo from 'react-native-device-info'

const Filter = require('bloom-filter');
const Contacts = require('react-native-contacts');
const Auth0Lock = require('react-native-lock');

const URL = require('url-parse');

const Phone = require('phone');

const API_URI = 'http://192.168.3.3:3000';

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

const TEST_LOGIN = false;
const TEST_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2FuYWxvZ3plbi5hdXRoMC5jb20vIiwic3ViIjoic21zfDU4ZDAxOTI5ODc5ZjE4Mjg4YTdhMGMwNyIsImF1ZCI6InZrTmZvalB3NVBzNzN2bkdiRDhTMVJ4TGxRTTdhZ0djIiwiZXhwIjoxNDkwNDA2MjQxLCJpYXQiOjE0OTAzNzAyNDF9.jorqH_TAbHlB5XAbL3oSfMslpkM0o_7doobtolUc1X4';
const TEST_PROFILE = {extraInfo: {clientID: 'vkNfojPw5Ps73vnGbD8S1RxLlQM7agGc', phone_number: '+14155655555'}};


function loadConfig (configName, defaultVal) {
  return AsyncStorage.getItem(`@Config:${configName}`)
    .then((returnLinksJson) => {
      return returnLinksJson ? JSON.parse(returnLinksJson) : defaultVal;
    })
    .catch(() => defaultVal);
}

function storeConfig (configName, config) {
  return AsyncStorage.setItem(`@Config:${configName}`, JSON.stringify(config));
}


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

  constructor (props) {
    super(props);

    let navParams = props.navigation.state.params;

    if (!navParams.configName) {
      throw new Error('missing config name');
    }

    let returnTo = navParams.returnTo;

    this.state = {
      configName: navParams.configName,
      returnTo: navParams.returnTo ? decodeURIComponent(navParams.returnTo) : null,
      config: null
    };
  }

  hack_urlListener = null;

  componentWillMount () {
    console.log('main will mount');

    fetch(`${API_URI}/config/${this.state.configName}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    }).then((configResponse) => {
      configResponse.json().then((config) => {
        this.setState({config});
      });
    });

  }

  componentDidMount () {

    // FIXME is there an event we can use?
    // this.hack_urlListener = setInterval(() => {
    //   if (OPENED_SITENAME == this.state.configName && OPENED_RETURNTO != this.state.returnTo) {
    //     try {
    //       this.setState({returnTo: OPENED_RETURNTO});
    //     } catch (e) {
    //       console.log('error hacking returnTo state');
    //     }
    //   }
    //   }, 50);

  }

  componentWillDismont () {
    //clearInterval(this.hack_urlListener);
  }

  render() {



    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>AddressBook.Link</Text>
        <Text style={styles.instructions}>
          AddressBook.Link helps keep your contacts private and connect you with friends. <Text>Learn More &gt;</Text>
        </Text>
        <Text>{this.state.configName}</Text>
        <Text>{this.state.returnTo}</Text>
        <ActivityIndicator
          hidesWhenStopped={true}
          animating={this.isWaitingForConfig()}
          size="large"/>

        {!this.isWaitingForConfig() &&

        <View>
          <Button title="Enable" style={styles.enable} onPress={() => this.onEnablePressed()}/>
        </View>
        }
      </View>
    );
  }

  isWaitingForConfig () {
    return this.state.config == null;
  }

  onEnablePressed() {
    this.gotoAddressBook();
  }

  gotoAddressBook () {
    var config = this.state.config;

    this.setupContactPermission().then(() => {
      this.login().then((loginResult) => {

        let returnUriAllowed = this.state.returnTo && config.returnTo.filter((allowedReturnTo) => this.state.returnTo.indexOf(allowedReturnTo) == 0).length > 0;
        let returnToUri = returnUriAllowed ? this.state.returnTo : null;

        console.log(`gotoAddressBook with returnTo: ${returnToUri}`);

        const resetAction = NavigationActions.navigate({
          routeName: 'AddressBook',
          params: {returnToUri , ...loginResult}
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
        console.log(`contineWithProfile. token=${authJwt}`);

        let appId = profile.extraInfo.clientID;
        let phoneNumber = profile.extraInfo.phone_number;

        let identifier = parsePhoneNumber(phoneNumber);

        return resolve({appId, identifier, authJwt, phoneNumber});
      }

      if (TEST_LOGIN) {
        return continueWithProfile(TEST_PROFILE, TEST_TOKEN);
      } else {
        const NOW = new Date().getTime();

        loadConfig(`login:${this.state.configName}`)
          .then((loginConfig => {

            if (loginConfig && loginConfig.exp >= NOW) {
              return continueWithProfile(loginConfig.profile, loginConfig.token.idToken);
            }

            loginConfig = {exp: NOW + 10*60*60*1000};

            var lock = new Auth0Lock({clientId: loginConfig.clientId, loginConfig.domain});

            lock.show({connections: ['sms']}, (err, profile, token) => {
              if (err) {
                //Alert.alert('login err :(' + err)

                console.log(err);
                return reject();
              }
              // Authentication worked!
              console.log('Logged in with Auth0!: ' + JSON.stringify(profile));

              // https://auth0.com/docs/user-profile/user-profile-structure
              // phone_number, phone_verified

              Object.assign(loginConfig, {profile, token});

              storeConfig(`login:${this.state.configName}`, loginConfig);

              return continueWithProfile(profile, token.idToken);
            });
          }));
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

AppRegistry.registerComponent('AddressBookScreen', () => AddressBookScreen);

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

AppRegistry.registerComponent('AddressBookLink', () => App);

export default App;
