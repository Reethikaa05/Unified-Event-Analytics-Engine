/**
 * Standard API response formatter
 */
const generateApiResponse = (message, data = null, statusCode = 200, code = 'SUCCESS') => {
  const response = {
    success: statusCode >= 200 && statusCode < 300,
    message,
    code,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  return response;
};

/**
 * Error response formatter
 */
const generateErrorResponse = (message, errorCode = 'ERROR', details = null) => {
  return {
    success: false,
    message,
    code: errorCode,
    timestamp: new Date().toISOString(),
    ...(details && { details })
  };
};

module.exports = {
  generateApiResponse,
  generateErrorResponse
};