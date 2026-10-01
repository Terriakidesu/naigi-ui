# Naigi Desktop

A standalone desktop client for the [Naigi server](https://github.com/Terriakidesu/naigi). The user-facing chat interface is bundled with the app; the server is hosted separately. The server admin console is not included.

## Get started

Download the app from [Releases](https://github.com/Terriakidesu/naigi-ui/releases).

- **Linux:** make the AppImage executable and launch it.
- **Windows:** extract the ZIP and run `Naigi.exe`. Keep the extracted files together.

Enter your Naigi server address, select **Check server**, then **Connect**. Remote servers require HTTPS; HTTP is supported only for local development.

## Development

Requires Node.js 22 or newer and npm:

```sh
npm install
npm start
```

Run a [Naigi server](https://github.com/Terriakidesu/naigi) separately. See the [development guide](docs/development.md) for checks, source layout, and packaging.

## Documentation

- [Using the app](docs/usage.md)
- [Development and packaging](docs/development.md)
- [Security and limitations](docs/security.md)
- [Changelog](CHANGELOG.md)

## License

Naigi Desktop is licensed under the [MIT License](LICENSE). Third-party dependencies and assets retain their own licenses.
