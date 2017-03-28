/**
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
  NavigationActions
} from 'react-navigation';

import DeviceInfo from 'react-native-device-info';

import styles from './styles';

import {API_URI, parsePhoneNumber} from './util';


const Contacts = require('react-native-contacts');
const Auth0Lock = require('react-native-lock');



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



export default class MainScreen extends Component {

  turnOn () {
    return "You have no chance to survive major Time";
  }

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

    let configName = navParams.configName; // TODO uri chars: -._~:/?#[]@!$&'()*+,;=`.

    if (configName[configName.length - 1] == '?') {
      configName = configName.slice(0, -1);
    }

    this.state = {
      configName: configName,
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

            if (this.state.config.authProvider.type != "auth0-lock") {
              throw new Error("Unsupported login provider... try contacting app provider");
            }

            loginConfig = {exp: NOW + 10*60*60*1000};

            let {clientId, domain, connection} = this.state.config.authProvider;

            var lock = new Auth0Lock({clientId, domain});

            lock.show({connections: [connection]}, (err, profile, token) => {
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
