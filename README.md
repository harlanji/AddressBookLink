# AddressBookLink

AddressBookLink is a companion application to give you control of your address book.

It offers integration based on URLs for applications to request portions of address book functionality.

See more at https://addressbook.link or [private-contact-matching](https://github.com/harlanji/private-contact-matching) for technical details.

## Usage

This repo includes two apps and a server. The main AddressBookLink app in `.` and a demo client app in `examples/SpeedDial`.
Assuming you know how to run react native apps, you can work with them accordingly. The server portion is located in `server` and assumes a postgres database--see `schema.sql`.

It's assumed that you have or can setup an Auth0 Passwordless acount... see their documentation for more info. This system
is built to support providers beyond that pretty easily--see the server config route.

* Setup DB with `schema.sql`--default l/p is `bloombase:bloombase123` on `localhost`.
* Start node app by `cd server` and `AUTH0_CLIENT_SECRET="YOUR SECRET" npm run-script run` which will start on `0.0.0.0:3000`.
* Start the main AddressBookLink app on the phone--you can interact using the demo config.
* If you want to explore client functionality, load the SpeedDial app.

### Notes

* By default you need to be on the same LAN as your device or the package loading won't work. 
* The packager is setup to use port 8081 by default, so running two projects simultaneously requires a port change on one.
* I've had problems with nested projects after building example... ""This error is caused by a @providesModule declaration with the same name across two different files." -- worked around by deleting `node_modules` (nested react native projects).


