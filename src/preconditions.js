var _ = require('lodash');

export class PreCondition {
  checkState(condition, message) {
    if (!condition) {
      throw new Error(
        `InvalidState`,
      );
    }
  }
  checkArgument(condition, argumentName, message, docsPath) {
    if (!condition) {
      throw new Error(
        `InvalidArgument`,
      );
    }
  }
  checkArgumentType(argument, type, argumentName) {
    argumentName = argumentName || '(unknown name)';
    if (_.isString(type)) {
      if (type === 'Buffer') {
        var BufferUtil = require('./buffer');
        if (!BufferUtil.isBuffer(argument)) {
          throw new Error(
            `InvalidArgumentType`,
          );
        }
      } else if (typeof argument !== type) {
          throw new Error(
            `InvalidArgumentType`,
          );
      }
    } else {
      if (!(argument instanceof type)) {
        // throw new errors.InvalidArgumentType(argument, type.name, argumentName);
          throw new Error(
            `InvalidArgumentType`,
          );
      }
    }
  }
}