'use strict';

const qnm = require('../lib/queue-notifications-memory');
const qnr = require('../lib/queue-notifications-redis');
const crypto = require('crypto');
const interpreter = require('@runnerty/interpreter-core');

class Notifier {
  constructor(args) {
    this.notification = args.notification;
    this.id = args.notification.id;
    this.checkNotifierParams = args.checkNotifierParams;
    this.runtime = args.runtime;
    this.logger = args.logger;
    this.config = args.notification.config;
  }

  async init() {
    try {
      if (!this.notification.type && this.notification.config.type) {
        this.notification.type = this.notification.config.type;
      }
      this.uId = await this.getUid();
      await this.checkNotifierParams(this.notification);
      return this;
    } catch (err) {
      throw err;
    }
  }

  async notificate(values) {
    try {
      const _values = await this.getValues(values);
      await this.queue(this.notification.channel, _values);
    } catch (err) {
      this.logger.log('error', `Notificate ${err}`);
    }
  }

  async sendMain(notification) {
    await this.send(notification);
  }

  send() {
    this.logger.log('error', 'Method send (notification) must be rewrite in child class');
  }

  async end(options) {
    if (!options) options = {};
    options.end = options.end || 'end';

    if (options.end === 'error') {
      this.logger.log('error', options.messageLog);
    }
  }

  async getValues(values) {
    const notifValues = this.notification;
    Object.assign(notifValues, this.config);
    delete notifValues.config;
    try {
      const interpreterOptions = {};
      if (this.runtime.config?.interpreter_max_size) {
        interpreterOptions.maxSize = this.runtime.config.interpreter_max_size;
      }
      const _values = await interpreter.interpret(
        notifValues,
        values,
        interpreterOptions,
        this.runtime.config?.global_values
      );
      return _values;
    } catch (err) {
      this.logger.log('error', `getValues Notifier: ${err}`);
      throw err;
    }
  }

  async queue(listName, notifToQueue) {
    const list = this.id + (listName ? '_' + listName : '');
    // QUEUE REDIS;
    if (this.runtime.config.queueNotifiersExternal && this.runtime.config.queueNotifiersExternal === 'redis') {
      //REDIS QUEUE:
      const qnrParams = {
        runtime: this.runtime,
        logger: this.logger
      };
      const _qnr = new qnr(qnrParams);
      await _qnr.queue(this, notifToQueue, list);
    } else {
      //MEMORY QUEUE:
      const qnmParams = {
        runtime: this.runtime,
        logger: this.logger
      };
      const _qnm = new qnm(qnmParams);
      await _qnm.queue(this, notifToQueue, list);
    }
  }

  async getUid() {
    crypto.randomBytes(16, (err, buffer) => {
      if (err) {
        this.logger.log('error', `setUid Notifier: ${err}`);
        throw new Error(`setUid Notifier: ${err}`);
      } else {
        return this.id + '_' + buffer.toString('hex');
      }
    });
  }
}

module.exports = Notifier;
