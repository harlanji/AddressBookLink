const Phone = require('phone');

export const API_URI = 'http://192.168.3.3:3000';

export function parsePhoneNumber (phoneNumber) {
  let digits = phoneNumber.split('').filter(char => char >= '0' && char <= '9').join('');
  let parsed = Phone(digits);

  if (parsed.length == 0) {
    console.log(`could not parse phone number ${phoneNumber} so normalized to ${digits}.`);

    return digits;
  }

  return parsed[0];
}

