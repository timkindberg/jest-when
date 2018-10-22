const bunyan = require('bunyan')
const packagejson = require('../package.json')
const assert = require('assert')

const newLogger = name => {
  assert(name, 'Name must be defined')
  return bunyan.createLogger({
    name: name,
    app: packagejson.name,
    src: process.env.NODE_ENV === 'development'
  })
}

module.exports = newLogger
