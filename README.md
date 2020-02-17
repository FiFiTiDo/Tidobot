# Tidobot
This is yet another chat moderation bot designed to work with multiple platforms
including Twitch and Mixer.

### Table of Contents
* [Introduction](#Introduction)
* [Getting Started](#Getting-Started)
    * [Requirements](#Requirements)
    * [Installation](#Installation)
    * [Configuration](#Configuration)
    * [Building](#Building)
    * [Running](#Running)
    * [Debugging](#Debugging)
* [Testing](#Running-the-tests)
* [Authors](#Authors)
* [License](#License)

## Introduction

Tidobot is designed to be as flexible as possible to meet your needs in the best
way possible. The main goal of this project is to make all of the language used
service-independent so it can easily be modified to support a new platform. It
also supports connecting to multiple channels at one time though all of the data 
for each channel is separate. The functionality of the bot is divided into separate 
modules that each only handle one aspect and can be enabled or disabled independently.
I also strive to bring new and innovating features that other chat bots do not offer
from the way it functions to the way it interacts with its users.

## Getting Started

### Requirements

* Node
* Git

### Installation

```shell script
$ git clone https://github.com/FiFiTiDo/Tidobot.git
$ cd ./Tidobot
$ npm install
```

### Configuration

1. Rename the `config-default` directory to `config`
2. Add your login details and API keys as needed into the config files for each
service you intend to use.

### Building
You can build the Typescript source files into compiled plain Javascript files using
```shell script
$ npm build
```

### Running
To run the bot, first you must [build](#Building) the project then run using
```shell script
$ npm run
```

### Debugging
When running the debugger, it is not necessary to build the sources as it debugs
using the sources rather than the compiled javascript files. Start the debugger
by using
```shell script
$ npm debug
```

## Running the tests
The Tidobot project uses the mocha testing framework for testing certain aspects
of the functionality to ensure that it works the way it intends to work. All test
files are located in the `test` directory and can be run using
```shell script
$ npm test
```

## Authors
* **Evan Fiordeliso** - *Main author* - [FiFiTiDo](https://github.com/FiFiTiDo)

See also the list of [contributors](https://github.com/FiFiTiDo/Tidobot/graphs/contributors) who participated in this project.

## License
This project is licensed under the GPL v3.0 License.
See the [LICENSE.md](LICENSE.md) file for more details.