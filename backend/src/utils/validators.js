const Joi = require('joi');

const MIN_BET = parseFloat(process.env.MIN_BET) || 2;
const MAX_BET = parseFloat(process.env.MAX_BET) || 10000;

// Ethiopian phone number: starts with 09 or +2519, 10–13 digits
const ETHIOPIAN_PHONE_REGEX = /^(\+251|0)(9|7)\d{8}$/;

const schemas = {
  registerOTP: Joi.object({
    phone: Joi.string().pattern(ETHIOPIAN_PHONE_REGEX).required()
      .messages({ 'string.pattern.base': 'Invalid Ethiopian phone number' }),
    language: Joi.string().valid('en', 'am', 'or').default('en')
  }),

  verifyOTP: Joi.object({
    phone: Joi.string().pattern(ETHIOPIAN_PHONE_REGEX).required(),
    otp: Joi.string().length(6).pattern(/^\d+$/).required()
  }),

  completeProfile: Joi.object({
    username: Joi.string().alphanum().min(3).max(20).required(),
    fullName: Joi.string().min(2).max(60).required(),
    language: Joi.string().valid('en', 'am', 'or').default('en')
  }),

  createRoom: Joi.object({
    betAmount: Joi.number().min(MIN_BET).max(MAX_BET).required(),
    maxPlayers: Joi.number().valid(2, 3, 4).required(),
    isPrivate: Joi.boolean().default(false),
    name: Joi.string().max(40).optional()
  }),

  sendMessage: Joi.object({
    message: Joi.string().max(200).required()
  }),

  deposit: Joi.object({
    amount: Joi.number().min(MIN_BET).max(MAX_BET).required()
  }),

  withdraw: Joi.object({
    amount: Joi.number().min(MIN_BET).max(MAX_BET).required()
  })
};

const validate = (schemaName) => async (request, reply) => {
  const schema = schemas[schemaName];
  if (!schema) throw new Error(`Unknown validation schema: ${schemaName}`);
  try {
    request.body = await schema.validateAsync(request.body, { abortEarly: false });
  } catch (err) {
    return reply.status(422).send({
      statusCode: 422,
      error: 'Validation Error',
      details: err.details.map((d) => d.message)
    });
  }
};

module.exports = { validate, schemas, ETHIOPIAN_PHONE_REGEX };
