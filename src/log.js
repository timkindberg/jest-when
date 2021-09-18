const logger = require('diary')
const packagejson = require('../package.json')
const assert = require('assert')

const newLogger = name => {
  assert(name, 'Name must be defined')
  return logger.diary(`${packagejson.name}: ${name}`)
}

module.exports = newLogger
