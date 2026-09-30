# Using Naigi Desktop

## Install

Download a package from [Releases](https://github.com/Terriakidesu/naigi-ui/releases). The initial downloads target Linux x86_64 and Windows x64.

### Linux

Make the downloaded AppImage executable using your file manager or `chmod +x`, then launch it. AppImage support depends on your Linux distribution.

### Windows

Extract the ZIP into a folder and run `Naigi.exe`. Do not move the executable away from its accompanying files. The published build is unsigned, so Windows may display a security warning.

## Connect to a server

1. Enter the origin of your [Naigi server](https://github.com/Terriakidesu/naigi), such as `https://chat.example.com`.
2. Select **Check server** to check connectivity and the server version.
3. Select **Connect**, then sign in or create an account.

Use only the origin, without a path, query, or embedded credentials. Remote servers require HTTPS with a valid certificate. Loopback development servers can use HTTP, for example `http://localhost:3000`.

Use **File → Change server…** to choose another server. Each server has separate saved login, encrypted storage, and preferences; switching servers does not erase them.

## Versions

The desktop app and server have independent versions. Both are shown in the launcher, chat sidebar, and **Help → About Naigi**.

Servers supporting `GET /v1/version` report their version. Older servers may show **Unavailable** and can be checked through their health endpoint.

## Encryption and permissions

A desktop session is a new device. Browser encryption keys are not automatically imported; use the app's recovery or device-approval flow when needed.

The app prompts for microphone/camera and notification permissions. External links open in the system browser. See [security and limitations](security.md) for features that still need platform testing.
