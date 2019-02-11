const Web3 = require('web3');
const retry = require('async-retry');
const tempSaveArtifacts = require('./TO_BE_REFACTORED/tempSaveArtifacts');
const models = require('./models');

/**
 * DIP Event Listener microservice
 */
class DipEventListener {
  /**
   * Constructor
   * @param {object} amqp
   * @param {object} db
   * @param {object} log
   * @param {object} config
   */
  constructor(
    {
      amqp, db, log, config,
    },
  ) {
    this._amqp = amqp;
    this._models = models(db);
    this._log = log;
    this._config = config;
    this._networkName = config.networkName;

    this.setWeb3();
  }

  /**
   * Initialize web3
   * @return {void}
   */
  setWeb3() {
    this._web3 = new Web3(new Web3.providers.WebsocketProvider(this._config.rpcNode));
  }

  /**
   * Bootstrap and listen
   * @return {void}
   */
  async bootstrap() {
    try {
      /* TO_BE_REFACTORED */
      this._log.info('Saving artifacts');

      const { Contract } = this._models;

      const knownContracts = await tempSaveArtifacts(this._web3);

      for (let i = 0; i < knownContracts.length; i += 1) {
        await Contract.query().delete().where({
          product: knownContracts[i].contractName,
          networkName: this._networkName,
          version: '1.0.0',
        });

        const { blockNumber } = await this._web3.eth.getTransaction(knownContracts[i].transactionHash);

        await Contract.query()
          .upsertGraph({
            product: knownContracts[i].contractName,
            networkName: this._networkName,
            version: '1.0.0',
            address: knownContracts[i].address.toLowerCase(),
            abi: JSON.stringify(knownContracts[i].abi),
            transactionHash: knownContracts[i].transactionHash,
            blockNumber,
          });
      }

      this._log.info('Artifacts saved');
      /* TO_BE_REFACTORED */

      await retry(this.watchEvents.bind(this), {
        retries: 10,
        onRetry: () => this._log.info('Try to reconnect'),
      });

      await this._amqp.consume({
        messageType: 'existingEventsRequest',
        messageTypeVersion: '1.*',
        handler: this.sendExistingEvents.bind(this),
      });

      await this._amqp.consume({
        messageType: 'artifact',
        messageTypeVersion: '1.*',
        handler: this.saveArtifact.bind(this),
      });

      await this._amqp.consume({
        messageType: 'contractDeployment',
        messageTypeVersion: '1.*',
        handler: this.saveArtifact.bind(this),
      });
    } catch (e) {
      const error = new Error(JSON.stringify({ message: e.message, stack: e.stack }));
      error.exit = true;
      this._log.error(error);
      throw error;
    }
  }

  /**
   * Check past events
   */
  async checkPastEvents() {
    try {
      const { Contract } = this._models;
      let offset = 0;
      let addresses = [];

      do {
        addresses = await Contract.query()
          .select('address')
          .where('networkName', this._networkName)
          .limit(1000)
          .offset(offset);

        if (addresses.length === 0) {
          return;
        }

        offset += 1000;

        await this.getPastEvents(addresses);
      } while (addresses.length > 0);
    } catch (e) {
      this._log.error(new Error(JSON.stringify({ message: e.message, stack: e.stack })));
    }
  }

  /**
   * Get past events
   * @param {[]} addresses
   * @return {void}
   */
  async getPastEvents(addresses) {
    this._log.info('Get past events');

    try {
      const { Event, Contract } = this._models;

      for (let i = 0, l = addresses.length; i < l; i += 1) {
        const { address } = addresses[i];

        let fromBlock;

        const [lastevent] = await Event.query()
          .select('blockNumber')
          .where({ networkName: this._networkName, address: address.toLowerCase() })
          .orderBy('blockNumber', 'DESC')
          .limit(1);

        if (lastevent && lastevent.blockNumber) {
          fromBlock = lastevent.blockNumber + 1;
        } else {
          const [contract] = await Contract.query()
            .select('blockNumber')
            .where({ networkName: this._networkName, address: address.toLowerCase() })
            .orderBy('blockNumber', 'DESC')
            .limit(1);

          fromBlock = contract && contract.blockNumber ? contract.blockNumber : 0;
        }

        this._log.info(`Get past logs for ${address} from ${fromBlock} block`);

        const events = await this._web3.eth.getPastLogs({
          fromBlock: this._web3.utils.toHex(fromBlock),
          address,
        });

        for (let j = 0, k = events.length; j < k; j += 1) {
          await this.handleEvent(events[j]);
        }
      }
    } catch (e) {
      this._log.error(new Error(JSON.stringify({ message: e.message, stack: e.stack })));
    }
  }

  /**
   * Handle event
   * @param {object} event
   * @return {void}
   */
  async onData(event) {
    try {
      this.fromBlock = event.blockNumber;
      const { Contract } = this._models;
      const contracts = await Contract.query().where({
        address: event.address.toLowerCase(),
        networkName: this._networkName,
      });
      if (contracts.length > 0) {
        this.handleEvent(event);
      }
    } catch (e) {
      this._log.error(new Error(JSON.stringify({ message: e.message, stack: e.stack })));
    }
  }

  /**
   * Handle error
   * @param {error} e
   * @return {void}
   */
  onError(e) {
    this._log.error(new Error(JSON.stringify({ message: e.message, stack: e.stack })));
    this.reconnect();
  }

  /**
   * Watch events
   * @return {void}
   */
  async watchEvents() {
    this.setWeb3();
    const fromBlock = await this._web3.eth.getBlockNumber();

    await this.checkPastEvents();

    this._web3.eth.subscribe('logs', { fromBlock }, (e) => {
      if (!e) return;
      this._log.error(new Error(JSON.stringify({ message: e.message, stack: e.stack })));
      throw new Error(e);
    })
      .on('data', this.onData.bind(this))
      .on('error', this.onError.bind(this));
  }

  /**
   * Handle event
   * @param {object} event
   * @return {void}
   */
  async handleEvent(event) {
    try {
      const { Contract, Event } = this._models;
      const contract = await Contract.query().where({
        networkName: this._networkName,
        address: event.address.toLowerCase(),
      }).first();
      if (!contract) {
        return;
      }
      const abi = contract.abi
        .filter(i => i.type === 'event')
        .map(i => Object.assign(i, { signature: this._web3.eth.abi.encodeEventSignature(i) }))
        .filter(i => i.signature === event.topics[0]);
      const decodedEvent = this._web3.eth.abi.decodeLog(abi[0].inputs, event.data, event.topics.slice(1));
      // const block = await this._web3.eth.getBlock(event.blockNumber);

      // TODO: TEMPORARY FIX
      const existsEvent = await Event.query().where({
        networkName: this._networkName,
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
      }).first();

      if (existsEvent) {
        return;
      }

      await Event.query().upsertGraph({
        networkName: this._networkName,
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        address: event.address.toLowerCase(),
        topics: JSON.stringify(event.topics),
        data: event.data,
        blockNumber: event.blockNumber,
        // timeStamp: Event.raw('to_timestamp(?)', event.timeStamp),
        timeStamp: Event.raw('to_timestamp(?)', 1549531779), // todo: get block timestamp!
        transactionIndex: event.transactionIndex,
        eventName: abi[0].name,
        eventArgs: decodedEvent,
        version: contract.version,
        product: contract.product,
      });
      const eventModel = await Event.query().where({
        networkName: this._networkName,
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
      }).first();
      if (!eventModel) {
        return;
      }
      await this._amqp.publish({
        messageType: 'decodedEvent',
        messageTypeVersion: '1.*',
        content: eventModel,
      });
    } catch (e) {
      this._log.error(new Error(JSON.stringify({ message: e.message, stack: e.stack })));
    }
  }


  /**
   * Send existing events
   * @param {{}} params
   * @param {{}} params.content
   * @param {{}} params.fields
   * @param {{}} params.properties
   * @return {void}
   */
  async sendExistingEvents({ content, fields, properties }) {
    try {
      // const event = await this.db.raw(`SELECT * FROM ${schema}.events`, []);
      const { Event } = this._models;

      // todo: filter by network, version, address, fromBlock and any other fields including eventArgs
      const events = await Event.query().select();

      await this._amqp.publish({
        messageType: 'decodedEvent',
        messageTypeVersion: '1.*',
        content: events,
        correlationId: properties.correlationId,
      });
    } catch (e) {
      this._log.error(new Error(JSON.stringify({ message: e.message, stack: e.stack })));
    }
  }

  /**
   * Request artifacts
   * @param {{}} params
   * @param {{}} params.content
   * @param {{}} params.fields
   * @param {{}} params.properties
   * @return {void}
   */
  async requestArtifacts({ content, fields, properties }) {
    try {
      const { version, list } = content;
      list.forEach((contract) => {
        this._amqp.publish({
          messageType: 'artifactRequest',
          messageTypeVersion: '1.*',
          content: { network: contract.networkName, version, contract },
          correlationId: properties.correlationId,
        });
      });
    } catch (e) {
      this._log.error(new Error(JSON.stringify({ message: e.message, stack: e.stack })));
    }
  }

  /**
   * Save artifact
   * @param {{}} params
   * @param {{}} params.content
   * @param {{}} params.fields
   * @param {{}} params.properties
   * @return {void}
   */
  async saveArtifact({ content, fields, properties }) {
    try {
      const {
        product, network, version, artifact,
      } = content;
      const artifactObject = JSON.parse(artifact);
      const networkId = Object.keys(artifactObject.networks)[0];
      const { address } = artifactObject.networks[networkId];
      const abi = JSON.stringify(artifactObject.abi);
      const { Contract } = this._models;

      await Contract.query()
        .upsertGraph({
          product,
          networkName: network,
          version,
          address: address.toLowerCase(),
          abi,
        });
    } catch (e) {
      this._log.error(new Error(JSON.stringify({ message: e.message, stack: e.stack })));
    }
  }
}

module.exports = DipEventListener;
