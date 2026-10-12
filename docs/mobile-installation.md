# Run ShelfMate on your phone

ShelfMate has a signed Android internal-test APK. No iOS installer or public store release has been produced. The project uses Expo SDK 57; Expo Go must match that SDK.

## Install the signed APK on two Android phones

The current APK is at `.local/artifacts/ShelfMate-internal.apk` in the repository and is signed with a local Android key. You do not need an Expo account to install it. Keep `.local/android/shelfmate-upload.keystore` and `.local/android/signing.properties` private and backed up; they are required to sign updates with the same identity. Never commit or send them with the APK.

This internal build connects to the Mac's LAN address chosen when it was built. Both phones and the Mac must be on the same trusted Wi-Fi, and the Mac, PostgreSQL, and API must stay running. From each phone's browser, open `http://YOUR_MAC_LAN_IP:5050/api/v1/health/ready` and confirm it reports ready before launching ShelfMate. If the Mac's LAN address changes, rebuild with the current address using `python3 scripts/build_signed_android.py --api-url http://YOUR_MAC_LAN_IP:5050 --allow-local-http` from the repository root. Local HTTP is for this private network test only; do not use this APK with real household data on an untrusted network.

Copy the APK to each phone (USB, a private file transfer, or a file share you control), open it, and allow installation from that source when Android prompts. Reinstall it after a rebuild to receive UI changes such as the inventory date picker. Keep the original local signing key safe for later updates. For USB debugging, connect one phone and run `adb install -r .local/artifacts/ShelfMate-internal.apk`; repeat for the second phone. This app is separate from Expo Go.

On phone A, create an account and household. In Settings, generate an invitation. On phone B, create a separate account and join using that invite. Add an inventory item on one phone and confirm it appears on the other; then test shopping, purchase, and the explicit transfer into inventory. The computer must remain reachable for these tests. In-app alerts work, but push delivery is not configured until a real Expo project and Android Firebase credentials are added.

## Start the database and API on your computer

Follow the root [README](../README.md#local-setup) to configure your ignored `.env`, start PostgreSQL, apply migrations and start the API on `http://0.0.0.0:5050`. Keep it running.

Connect the phone and computer to the same Wi-Fi. Find the computer's LAN address in network settings (on many Macs, `ipconfig getifaddr en0` works). In `mobile/.env`, set:

```dotenv
# Example only: replace with your computer's actual LAN address.
EXPO_PUBLIC_API_URL=http://192.168.1.10:5050
```

From the phone's browser, visit `http://YOUR_COMPUTER_IP:5050/api/v1/health/ready`; it should show `{"status":"ready"}`. On a physical phone, `localhost` points to the phone, not the computer. If unreachable, check API startup, firewall access to port 5050, VPNs, and Wi-Fi client isolation. Expo's tunnel serves the JavaScript bundle; it does not expose this API automatically. HTTP here is local development only.

## Android: quickest development preview

1. Install the current Expo Go client from [Expo Go downloads](https://expo.dev/go). Select SDK **57** if the page offers a version choice. The SDK must match; see [Expo's compatibility guidance](https://docs.expo.dev/develop/development-builds/faq/#open-projects-using-other-sdk-versions).
2. In a terminal on the computer, run:

```sh
cd mobile
npm ci
npx expo start --go
```

3. Open Expo Go and scan the terminal QR code. Keep the development server, API and database running. Restart Expo whenever you change `mobile/.env`.
4. Create your ShelfMate account. Create a household and confirm its time zone, or enter your partner's invitation code. Home displays the dashboard; Inventory manages products; Settings manages invitations/account. Your partner uses a separate ShelfMate account.

## iPhone: compatible client or a ShelfMate development build

The current App Store Expo Go client supports SDK 57. Sign in to the same Expo account in both Expo Go and Expo CLI (`npx expo login`), then run `npx expo start --go` and scan the QR code. See [Expo's login instructions](https://expo.dev/changelog/expo-go-57-login). A development build is also an option. This repository has not configured EAS signing or produced one. The following is the setup process, not a claim that a build already exists.

For a cloud build, you need your Expo account and, for physical iPhone distribution, an Apple Developer membership and a registered device. From `mobile`, install the development client and configure EAS:

```sh
npx expo install expo-dev-client
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest device:create
```

Choose an app identifier you own when prompted. Ensure `eas.json` has a development profile with `developmentClient: true` and `distribution: "internal"`; physical iPhone builds must not set `ios.simulator: true`. Then build:

```sh
npx eas-cli@latest build --profile development --platform ios
```

Open the finished EAS installation link on the registered iPhone and follow installation/Developer Mode prompts. Run `npx expo start --dev-client` on the computer and open the project in the installed ShelfMate client. The LAN API configuration above still applies. These setup commands add dependencies/configuration and the cloud build uploads project source to Expo; review and commit the resulting setup separately.

A local Xcode build on a Mac is another option, including without a paid Apple membership: install `expo-dev-client`, configure your unique `ios.bundleIdentifier`, connect the iPhone, enable Developer Mode, and run `npx expo run:ios --device`. Xcode/device signing must be configured. Native directories are generated by Expo; do not edit them by hand. See the [official development-build guide](https://docs.expo.dev/develop/development-builds/introduction/) and [internal distribution guide](https://docs.expo.dev/build/internal-distribution/) for signing requirements.

If you do use a compatible Expo Go client on a physical iPhone, Expo currently requires the CLI and Expo Go to use the same Expo account: run `npx expo login` and sign into the client. This Expo tooling account is separate from each person's ShelfMate account. See [opening a project on a device](https://docs.expo.dev/get-started/start-developing/).

## Simulators and use away from home

For iOS Simulator use `http://localhost:5050`; Android Emulator uses `http://10.0.2.2:5050`. Compatible Expo Go clients can be selected for simulators at expo.dev/go; after starting Expo press `i` or `a` with the relevant simulator installed.

Using ShelfMate away from this computer needs a deployed HTTPS API/database and a production app build. Public distribution additionally needs release signing configuration and store listing/review. Physical two-phone acceptance remains outstanding.
