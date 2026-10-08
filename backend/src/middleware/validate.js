import { validationResult } from 'express-validator';

/**
 * validate — express-validator result collector middleware.
 *
 * Place this AFTER your array of express-validator check() rules.
 * If any validation errors exist it returns a 400 with the full
 * error array; otherwise it calls next().
 *
 * @example
 * import { body } from 'express-validator';
 * import validate from '../middleware/validate.js';
 *
 * router.post(
 *   '/register',
 *   [
 *     body('email').isEmail().normalizeEmail(),
 *     body('password').isLength({ min: 6 }),
 *   ],
 *   validate,
 *   authController.register
 * );
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }

  next();
};

export default validate;
