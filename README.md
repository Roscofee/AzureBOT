# AzureBOT

A collection of BOTs and games based on the ropeybot framework.

## Running

The bot can either be run locally or via the Docker image.

### Running Locally

- Get an environment with NodeJS, pnpm (https://pnpm.io/installation) and git
- Check out the bot's code
  `git clone https://github.com/FriendsOfBC/ropeybot.git`
- Copy `config.sample.json` to `config.json` and customise it: you'll need to provide
  at least a username and password for an account that the bot can log in as. You can
  also choose what game the bot will run.
- Enter the directory and install the dependencies:
  `cd ropeybot`
  `pnpm install`
- Start the bot!
  `pnpm start`

### Running with Docker

- Install docker
- Create a config file as in the steps for running locally
- Run the bot, mapping in the config file you just made:
  `docker run --rm -it -v ${PWD}/config.json:/bot/cfg/config.json ghcr.io/FriendsOfBC/ropeybot:main`
- Alternatively you can build the docker container yourself:
  `docker build --tag ropeybot .`
- And then run said container with the config file mapped in
  `docker run --rm -it -v ${PWD}/config.json:/bot/cfg/config.json ropeybot`

## Games

The bot comes with some built games. In brackets is the value to use for 'game' in the config
file to run that game.

### Dairy Blue Farms ('dairy')

Scripted milking map, ported to the ropeybot framework, includes a custom game based on milking rooms 
where volunteers may join to unlock classes and skills to make more score (milk)
