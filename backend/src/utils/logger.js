const { createLogger, format, transports } = require('winston');
const { combine, timestamp, errors, json, colorize, simple } = format;

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'ludoline-backend' },
  transports: [
    new transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 5242880, maxFiles: 5 }),
    new transports.File({ filename: 'logs/combined.log', maxsize: 5242880, maxFiles: 10 })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: combine(colorize(), simple())
  }));
}

module.exports = logger;
